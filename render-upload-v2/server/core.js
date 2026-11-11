// Blade Rivals LAN server: serves the built game (dist/), handles rooms and lobby over WebSocket (/ws),
// and runs the match rules: teams, hit relay, kill counting, end rule and match clock.
// Run: npm run build && npm run server   (then open http://<this-machine-ip>:8787 on the other devices)
//
// LAN authority model: the victim's client owns its HP. The attacker's client detects the hit and sends it;
// the server checks it and relays it to the victim. The victim reports its own death; the server counts it.
// (An internet server will need to own HP itself. That is phase 3.)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let DIST = path.resolve(__dirname, '..', 'dist');
const COUNTDOWN_SECONDS = 3;
const CLOCK_TICK_MS = 1000;
const MAX_HIT_DAMAGE = 200;
// Server-side checks (the server owns HP, deaths, kills and respawn timing)
const SLASH_REACH = 9; // m: melee reach plus dash and network tolerance
const THROW_REACH = 160; // m: a thrown knife can fly across the arena
const HIT_RATE_PER_SEC = 12; // max hit claims per attacker per second
const SELF_DMG_PER_SEC = 60; // max self-reported damage (storm, poison) per player per second
const SELF_METHODS = new Set(['storm', 'poison']);
const RESPAWN_MS = 3000;
const MSG_RATE_PER_SEC = 200; // max messages per client per second (flood guard)
const MAX_PAYLOAD = 16 * 1024;

// Room sizes per mode. Duel and team sizes are fixed; FFA lets the host pick 2–8.
const MODE_RULES = {
  duel: { label: '1v1', fixedSize: 2 },
  team: { label: '2v2', fixedSize: 4 },
  ffa: { label: 'Mindenki ellen', minSize: 2, maxSize: 8 }
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json'
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }).end('ok');
    return;
  }
  const safe = path.normalize(urlPath).replace(/^([/\\\\])+/, '');
  let file = path.join(DIST, safe || 'index.html');
  if (!file.startsWith(DIST)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  if (!fs.existsSync(file)) {
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('The game is not built yet. Run: npm run build');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: MAX_PAYLOAD });

/** @type {Map<string, any>} */
const rooms = new Map();
/** @type {Map<string, any>} */
const clients = new Map(); // id -> { id, ws, name, skinId, hatId, wrapId, roomCode }

function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from(crypto.randomBytes(4), (b) => alphabet[b % alphabet.length]).join('');
  } while (rooms.has(code));
  return code;
}

function send(ws, msg) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function num(v, lo, hi, def) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def;
}

function str(v, max = 64) {
  return String(v ?? '').slice(0, max);
}

function roomSnapshot(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    mode: room.mode,
    modeLabel: MODE_RULES[room.mode].label,
    size: room.size,
    endRule: room.endRule,
    status: room.status,
    players: [...room.members].map((id) => {
      const c = clients.get(id);
      return { id, name: c?.name || 'Player', skinId: c?.skinId || 'karambit_crimson', hatId: c?.hatId || 'hat_none', wrapId: c?.wrapId || null };
    })
  };
}

function broadcastRoom(room) {
  const snap = roomSnapshot(room);
  for (const id of room.members) send(clients.get(id)?.ws, { type: 'room', room: snap });
}

function sendToRoom(room, msg) {
  for (const id of room.members) send(clients.get(id)?.ws, msg);
}

function relayToOthers(room, fromId, msg) {
  for (const id of room.members) if (id !== fromId) send(clients.get(id)?.ws, msg);
}

// Match end rules, chosen by the host:
// points: first to pointsTarget points wins; timed_kills: first to killTarget kills within timeLimitMin
// (if time runs out, most kills wins); endless: no time limit and no winner, points are just counted.
// One kill = one point.
const END_RULES = ['points', 'timed_kills', 'endless'];

function clampInt(v, lo, hi, def) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def;
}

function sanitizeEndRule(msg) {
  return {
    type: END_RULES.includes(msg.endType) ? msg.endType : 'points',
    pointsTarget: clampInt(msg.pointsTarget, 1, 100, 10),
    killTarget: clampInt(msg.killTarget, 1, 100, 15),
    timeLimitMin: clampInt(msg.timeLimitMin, 1, 30, 5)
  };
}

function sanitizeSize(mode, size) {
  const rule = MODE_RULES[mode];
  if (!rule) return null;
  if (rule.fixedSize) return rule.fixedSize;
  const n = Math.round(Number(size));
  if (!Number.isFinite(n)) return rule.minSize;
  return Math.min(rule.maxSize, Math.max(rule.minSize, n));
}

// ---- Match state ----
function liveRoster(m) {
  return [...m.players.values()].filter((p) => !p.gone);
}

// Scoring unit: a team in team/duel modes, each player in FFA
function unitKey(m, p) {
  return m.mode === 'ffa' ? p.id : p.team;
}

function unitTotals(m) {
  const units = new Map();
  for (const p of liveRoster(m)) {
    const key = unitKey(m, p);
    if (!units.has(key)) {
      units.set(key, {
        key,
        kills: 0,
        ids: [],
        label: m.mode === 'team' ? (p.team === 'red' ? 'Red team' : 'Blue team') : p.name
      });
    }
    const u = units.get(key);
    u.kills += p.kills;
    u.ids.push(p.id);
  }
  return [...units.values()].sort((a, b) => b.kills - a.kills);
}

function stopMatchTimers(room) {
  if (!room.match) return;
  clearInterval(room.match.tick);
  clearTimeout(room.match.timeout);
}

function clockPayload(room) {
  const m = room.match;
  const now = Date.now();
  const rule = room.endRule;
  const elapsed = Math.floor((now - m.startedAt) / 1000);
  const timeLeft =
    rule.type === 'timed_kills'
      ? Math.max(0, Math.ceil((m.startedAt + rule.timeLimitMin * 60000 - now) / 1000))
      : null;
  return {
    type: 'clock',
    elapsed,
    timeLeft,
    players: liveRoster(m).map((p) => ({ id: p.id, name: p.name, team: p.team, kills: p.kills, deaths: p.deaths, alive: p.alive })),
    units: unitTotals(m).map((u) => ({ key: u.key, label: u.label, kills: u.kills }))
  };
}

function beginMatch(room) {
  const ids = [...room.members];
  const half = Math.ceil(ids.length / 2);
  const players = new Map();
  let blueIdx = 0;
  let redIdx = 0;
  ids.forEach((pid, slot) => {
    const c = clients.get(pid);
    let team;
    let spawnIndex;
    if (room.mode === 'ffa') {
      team = `p${slot}`;
      spawnIndex = slot;
    } else {
      team = slot < half ? 'blue' : 'red';
      spawnIndex = team === 'blue' ? blueIdx++ : redIdx++;
    }
    players.set(pid, {
      id: pid,
      name: c?.name || 'Player',
      skinId: c?.skinId || 'karambit_crimson',
      hatId: c?.hatId || 'hat_none',
      wrapId: c?.wrapId || null,
      team,
      slot,
      spawnIndex,
      kills: 0,
      deaths: 0,
      alive: true,
      gone: false,
      hp: 100,
      pos: null,
      respawnAt: 0,
      hitLog: [],
      selfLog: []
    });
  });

  room.status = 'playing';
  room.match = { mode: room.mode, players, startedAt: Date.now(), ended: false, tick: null, timeout: null };
  const list = [...players.values()].map((p) => ({
    id: p.id,
    name: p.name,
    skinId: p.skinId,
    hatId: p.hatId,
    wrapId: p.wrapId,
    team: p.team,
    slot: p.slot,
    spawnIndex: p.spawnIndex
  }));
  sendToRoom(room, { type: 'match_start', code: room.code, mode: room.mode, endRule: room.endRule, players: list });
  broadcastRoom(room);

  room.match.tick = setInterval(() => {
    if (room.match && !room.match.ended) sendToRoom(room, clockPayload(room));
  }, CLOCK_TICK_MS);
  if (room.endRule.type === 'timed_kills') {
    room.match.timeout = setTimeout(() => endMatch(room, 'time'), room.endRule.timeLimitMin * 60000);
  }
  sendToRoom(room, clockPayload(room));
}

function recentCount(log, now) {
  while (log.length && now - log[0] > 1000) log.shift();
  return log.length;
}

function dist3(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

// Tells the victim's client its authoritative HP.
function sendHp(p) {
  send(clients.get(p.id)?.ws, { type: 'hp', hp: p.hp });
}

// The server decides the kill (killer is null for storm, poison and other non-player damage).
function killPlayer(room, v, killer, method, headshot, kind) {
  if (!v.alive) return;
  v.alive = false;
  v.hp = 0;
  v.deaths++;
  v.respawnAt = Date.now() + RESPAWN_MS;
  if (killer) killer.kills++;
  sendHp(v);
  sendToRoom(room, {
    type: 'kill',
    killerId: killer ? killer.id : null,
    killerName: killer ? killer.name : null,
    victimId: v.id,
    victimName: v.name,
    method: str(method, 16),
    headshot: !!headshot,
    kind: kind ? str(kind, 16) : null
  });
  if (killer) checkEndRule(room);
}

function applyDamage(room, p, damage, killer, method, headshot, kind) {
  if (!p.alive || damage <= 0) return;
  p.hp = Math.max(0, p.hp - damage);
  if (p.hp <= 0) killPlayer(room, p, killer, method, headshot, kind);
  else sendHp(p);
}

function checkEndRule(room) {
  const rule = room.endRule;
  if (rule.type === 'endless') return;
  const target = rule.type === 'points' ? rule.pointsTarget : rule.killTarget;
  const top = unitTotals(room.match)[0];
  if (top && top.kills >= target) endMatch(room, 'target', top);
}

function endMatch(room, reason, winnerUnit = null) {
  const m = room.match;
  if (!m || m.ended) return;
  m.ended = true;
  stopMatchTimers(room);

  let winner = winnerUnit;
  if (reason === 'time') {
    const units = unitTotals(m);
    const top = units[0];
    const tie = units.length > 1 && units[1].kills === top?.kills;
    winner = top && top.kills > 0 && !tie ? top : null;
  }
  room.status = 'ended';

  const standings = liveRoster(m)
    .slice()
    .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)
    .map((p) => ({ id: p.id, name: p.name, team: p.team, kills: p.kills, deaths: p.deaths }));
  sendToRoom(room, {
    type: 'match_end',
    reason,
    winnerIds: winner ? winner.ids : [],
    winnerLabel: winner ? winner.label : null,
    standings
  });
  broadcastRoom(room);
}

// ---- Rooms ----
function leaveRoom(client) {
  const room = rooms.get(client.roomCode);
  client.roomCode = null;
  if (!room) return;
  room.members.delete(client.id);
  if (room.match && !room.match.ended) {
    const p = room.match.players.get(client.id);
    if (p) {
      p.gone = true;
      p.alive = false;
    }
  }
  if (room.members.size === 0) {
    stopMatchTimers(room);
    rooms.delete(room.code);
    return;
  }
  if (room.hostId === client.id) room.hostId = [...room.members][0];
  if (room.status === 'countdown' && room.members.size < room.size) {
    clearTimeout(room.countdownTimer);
    room.status = 'lobby';
    sendToRoom(room, { type: 'countdown_cancel' });
  }
  if (room.status === 'playing' && room.match && !room.match.ended && liveRoster(room.match).length < 2) {
    endMatch(room, 'abandoned');
    return;
  }
  broadcastRoom(room);
}

function startCountdownIfFull(room) {
  if (room.status !== 'lobby' || room.members.size < room.size) return;
  room.status = 'countdown';
  sendToRoom(room, { type: 'countdown', seconds: COUNTDOWN_SECONDS });
  room.countdownTimer = setTimeout(() => {
    if (!rooms.has(room.code) || room.status !== 'countdown') return;
    beginMatch(room);
  }, COUNTDOWN_SECONDS * 1000);
  broadcastRoom(room);
}

wss.on('connection', (ws) => {
  const id = crypto.randomUUID().slice(0, 8);
  const client = { id, ws, name: 'Player', skinId: 'karambit_crimson', hatId: 'hat_none', wrapId: null, roomCode: null };
  clients.set(id, client);
  send(ws, { type: 'welcome', id });

  client.windowStart = Date.now();
  client.msgCount = 0;

  ws.on('message', (raw) => {
    try {
    const nowMs = Date.now();
    if (nowMs - client.windowStart >= 1000) {
      client.windowStart = nowMs;
      client.msgCount = 0;
    }
    if (++client.msgCount > MSG_RATE_PER_SEC) return; // flood: drop
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    // Only well-formed messages: null, numbers, arrays or a non-string type would break the switch below
    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;
    const room = rooms.get(client.roomCode);
    const playing = !!room && room.status === 'playing' && !!room.match && !room.match.ended;

    switch (msg.type) {
      case 'hello': {
        client.name = str(msg.name || 'Player', 16);
        client.skinId = str(msg.skinId || client.skinId);
        client.hatId = str(msg.hatId || client.hatId);
        client.wrapId = msg.wrapId ? str(msg.wrapId) : null;
        if (room) broadcastRoom(room);
        break;
      }
      case 'create': {
        leaveRoom(client);
        const mode = MODE_RULES[msg.mode] ? msg.mode : 'duel';
        const newRoom = {
          code: makeCode(),
          hostId: id,
          mode,
          size: sanitizeSize(mode, msg.size),
          endRule: sanitizeEndRule(msg),
          status: 'lobby',
          members: new Set([id]),
          countdownTimer: null,
          match: null
        };
        rooms.set(newRoom.code, newRoom);
        client.roomCode = newRoom.code;
        send(ws, { type: 'joined', code: newRoom.code, id });
        broadcastRoom(newRoom);
        break;
      }
      case 'join': {
        const code = str(msg.code, 12).trim().toUpperCase();
        const target = rooms.get(code);
        if (!target) {
          send(ws, { type: 'error', message: 'Nincs ilyen szoba.' });
          break;
        }
        if (target.status !== 'lobby') {
          send(ws, { type: 'error', message: 'This room has already started or is full.' });
          break;
        }
        if (target.members.size >= target.size) {
          send(ws, { type: 'error', message: 'A szoba megtelt.' });
          break;
        }
        leaveRoom(client);
        target.members.add(id);
        client.roomCode = code;
        send(ws, { type: 'joined', code, id });
        broadcastRoom(target);
        startCountdownIfFull(target);
        break;
      }
      case 'leave': {
        leaveRoom(client);
        send(ws, { type: 'left' });
        break;
      }
      case 'settings': {
        if (!room || room.hostId !== id || room.status !== 'lobby') break;
        if (!MODE_RULES[msg.mode]) break;
        room.mode = msg.mode;
        room.size = sanitizeSize(msg.mode, msg.size);
        room.endRule = sanitizeEndRule(msg);
        // Shrinking the room below the current head-count kicks nobody; it just waits.
        if (room.members.size > room.size) room.size = room.members.size;
        broadcastRoom(room);
        startCountdownIfFull(room);
        break;
      }
      case 'state': {
        // Pose relay: position, aim, and the status other players see (HP, dead, sliding, parry)
        if (!room) break;
        const raw3 = Array.isArray(msg.pos) ? msg.pos.slice(0, 3) : [];
        while (raw3.length < 3) raw3.push(0);
        const me = room.match?.players.get(id);
        const pos = raw3.map((v) => num(v, -500, 500, 0));
        if (me && !me.gone) me.pos = pos;
        relayToOthers(room, id, {
          type: 'peer',
          id,
          pos,
          yaw: num(msg.yaw, -1000, 1000, 0),
          pitch: num(msg.pitch, -2, 2, 0),
          hp: me ? me.hp : Math.round(num(msg.hp, 0, 100, 100)),
          dead: me ? !me.alive : !!msg.dead,
          sliding: !!msg.sliding,
          parry: !!msg.parry
        });
        break;
      }
      case 'act': {
        // Visual-only combat animation (slash), relayed to the others
        if (!playing || msg.kind !== 'slash') break;
        relayToOthers(room, id, { type: 'act', id, kind: 'slash', step: Math.round(num(msg.step, 0, 2, 0)) });
        break;
      }
      case 'throw': {
        // A knife was thrown: the others draw a visual-only copy; damage is decided by the thrower's client
        if (!playing) break;
        const vec = (v) => (Array.isArray(v) ? v.slice(0, 3).map((n) => num(n, -1000, 1000, 0)) : null);
        const origin = vec(msg.origin);
        const dir = vec(msg.dir);
        if (!origin || !dir || origin.length < 3 || dir.length < 3) break;
        relayToOthers(room, id, {
          type: 'throw',
          id,
          origin,
          dir,
          speed: num(msg.speed, 10, 80, 40),
          skinId: str(msg.skinId),
          wrapId: msg.wrapId ? str(msg.wrapId) : null,
          trailId: str(msg.trailId || 'trail_skin'),
          charged: !!msg.charged,
          burst: !!msg.burst
        });
        break;
      }
      case 'hit': {
        // Attacker's client claims a hit. The server checks team, life state, rate and reach, then applies it.
        if (!playing) break;
        const m = room.match;
        const now = Date.now();
        const att = m.players.get(id);
        const vic = m.players.get(str(msg.victimId, 32));
        if (!att || !vic || att.gone || vic.gone || !att.alive || att.id === vic.id) break;
        if (att.team === vic.team || !vic.alive) break;
        if (recentCount(att.hitLog, now) >= HIT_RATE_PER_SEC) break;
        att.hitLog.push(now);
        const method = str(msg.method, 16);
        const reach = method === 'throw' ? THROW_REACH : SLASH_REACH;
        if (att.pos && vic.pos && dist3(att.pos, vic.pos) > reach) break;
        const deflected = !!msg.deflected;
        const damage = deflected ? 0 : num(msg.damage, 0, MAX_HIT_DAMAGE, 0);
        const headshot = !!msg.headshot;
        const kind = msg.kind ? str(msg.kind, 16) : null;
        // The victim's client shows the hit (effects, flash) and then takes the server's HP value
        send(clients.get(vic.id)?.ws, {
          type: 'hit',
          attackerId: att.id,
          damage,
          headshot,
          deflected,
          method,
          kind
        });
        applyDamage(room, vic, damage, att, method, headshot, kind);
        break;
      }
      case 'self_hit': {
        // Storm and poison damage: each player's own client reports it, the server caps it and applies it
        if (!playing) break;
        const p = room.match.players.get(id);
        if (!p || p.gone || !p.alive) break;
        const method = str(msg.method, 16);
        if (!SELF_METHODS.has(method)) break;
        const now = Date.now();
        p.selfLog = p.selfLog.filter((e) => now - e.t <= 1000);
        const used = p.selfLog.reduce((sum, e) => sum + e.d, 0);
        const damage = Math.min(num(msg.damage, 0, 25, 0), Math.max(0, SELF_DMG_PER_SEC - used));
        if (damage > 0) p.selfLog.push({ t: now, d: damage });
        applyDamage(room, p, damage, null, method, false, null);
        break;
      }
      case 'died': {
        // Informational only: the server decides deaths from the HP it owns (see hit / self_hit)
        break;
      }
      case 'alive': {
        // Respawn request: allowed only once the server's respawn timer has run out
        if (!playing) break;
        const p = room.match.players.get(id);
        if (!p || p.gone || p.alive) break;
        if (Date.now() < p.respawnAt - 300) break;
        p.alive = true;
        p.hp = 100;
        p.hitLog = [];
        p.selfLog = [];
        sendHp(p);
        break;
      }
      case 'end_match': {
        // Host ends an endless match
        if (!playing || room.hostId !== id) break;
        endMatch(room, 'host');
        break;
      }
      case 'rematch': {
        // Host starts a new match in the same room (needs a full room)
        if (!room || room.hostId !== id) break;
        if (room.status !== 'ended') break;
        if (room.members.size < room.size) {
          send(ws, { type: 'notice', message: 'The room must be full to start a new match.' });
          break;
        }
        room.match = null;
        room.status = 'lobby';
        broadcastRoom(room);
        startCountdownIfFull(room);
        break;
      }
      default:
        break;
    }
    } catch (err) {
      // A bad message must never take the whole server down
      console.error('Error handling a message (the server keeps running):', err?.message || err);
    }
  });

  ws.on('close', () => {
    leaveRoom(client);
    clients.delete(id);
  });
});

/**
 * Starts the game server. Used by the standalone entry (server/server.js), by the desktop app
 * (electron-main.cjs, which hosts a room on the player's own PC), and by the online server.
 * Resolves with the bound port, rejects if the port is taken.
 */
export function startGameServer({ port = 8787, host = '0.0.0.0', distDir, log = console.log } = {}) {
  if (distDir) DIST = path.resolve(distDir);
  return new Promise((resolve, reject) => {
    const onError = (err) => reject(err);
    server.once('error', onError);
    server.listen(port, host, () => {
      server.off('error', onError);
      const bound = server.address().port;
      log(`Blade Rivals game server: http://${host === '0.0.0.0' ? 'localhost' : host}:${bound} (ws: /ws)`);
      resolve(bound);
    });
  });
}

export function stopGameServer() {
  return new Promise((resolve) => {
    for (const client of wss.clients) client.terminate();
    server.close(() => resolve());
  });
}
