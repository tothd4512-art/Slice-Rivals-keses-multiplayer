// LAN multiplayer, phase 1: rooms, host settings, auto-start when full, and live presence.
// The lobby preview shows every player's knife-holding avatar; their yaw follows what they do.
import * as THREE from 'three';
import { RivalCharacter } from './character.js';

const TORSO_COLORS = ['#2563eb', '#e11d48', '#16a34a', '#f59e0b', '#7c3aed', '#0891b2', '#db2777', '#84cc16'];
const SEND_INTERVAL_MS = 100; // presence updates at 10 Hz

let getProfile = () => ({ skinId: 'karambit_crimson', hatId: 'hat_none', wrapId: null });
let hooks = {}; // game callbacks (set by main.js through initMultiplayer)
let inMatch = false;
let poseTimer = null;
let hostEndBtn = null;
let socket = null;
let myId = null;
let myRoom = null; // latest room snapshot
let statusText = '';

const peers = new Map(); // id -> { char, skinKey, yaw, pitch, targetYaw }
let localYaw = 0;
let localPitch = 0;
let lastSent = 0;
let dragging = false;
let dragX = 0;
let renderer = null;
let scene = null;
let camera = null;
let rafId = 0;

const el = (id) => document.getElementById(id);

function serverUrl() {
  // 1) Online build: the frontend (e.g. on Vercel) points at the game server given at build time.
  if (import.meta.env.VITE_SERVER_URL) return import.meta.env.VITE_SERVER_URL;
  // 2) Desktop app (exe): the page is a local file, the game server runs inside the app on this PC.
  if (location.protocol === 'file:') return 'ws://127.0.0.1:8787/ws';
  // 3) Browser on the same origin: the LAN server serves the page directly, or the Vite dev/preview
  //    server (5173) forwards /ws to it (see vite.config.js).
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws`;
}

function setError(text) {
  el('mp-error').textContent = text || '';
}

function setStatus(text) {
  statusText = text;
  el('mp-room-status').textContent = text;
}

// Online: the free hosting sleeps when idle, so the first connection may wait about a minute.
// Local LAN server: no waiting, a failed connection is reported at once.
const REMOTE_SERVER = !!import.meta.env.VITE_SERVER_URL;
const WAKE_WINDOW_MS = REMOTE_SERVER ? 120000 : 0;
const RETRY_MS = 3000;
let connectStartedAt = 0;
let retryTimer = 0;

function healthUrl() {
  const u = new URL(serverUrl());
  u.protocol = u.protocol === 'wss:' ? 'https:' : 'http:';
  u.pathname = '/healthz';
  u.search = '';
  return u.toString();
}

function setWake(text) {
  el('mp-wake').textContent = text || '';
}

function connect() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
  if (!retryTimer) connectStartedAt = Date.now();
  openSocket();
}

function openSocket() {
  clearTimeout(retryTimer);
  retryTimer = 0;
  // An HTTP request wakes a sleeping free server; the WebSocket below may still fail while it starts, then we retry.
  if (REMOTE_SERVER) fetch(healthUrl(), { mode: 'no-cors', cache: 'no-store' }).catch(() => {});
  let opened = false;
  const ws = new WebSocket(serverUrl());
  socket = ws;
  ws.addEventListener('open', () => {
    opened = true;
    setWake('');
    setError('');
    ws.send(JSON.stringify({ type: 'hello', ...helloPayload() }));
    while (pending.length) ws.send(JSON.stringify(pending.shift()));
  });
  ws.addEventListener('message', (ev) => {
    if (socket === ws) handleMessage(JSON.parse(ev.data));
  });
  ws.addEventListener('close', () => {
    if (socket === ws) socket = null;
    if (!opened && Date.now() - connectStartedAt < WAKE_WINDOW_MS) {
      setWake('A szerver ébresztése… (ingyenes szerver: az első belépés akár 1 percet is várhat)');
      retryTimer = setTimeout(openSocket, RETRY_MS);
      return;
    }
    if (!opened) {
      pending.length = 0;
      setWake('');
      setError(REMOTE_SERVER ? 'A szerver nem érhető el. Próbáld újra később.' : 'Nem érhető el a LAN-szerver (npm run server).');
      return;
    }
    myRoom = null;
    if (inMatch) {
      endInMatchLocal();
      hooks.onDisconnect?.();
    }
    el('mp-room').classList.add('hidden');
    el('mp-entry').classList.remove('hidden');
    setError('A kapcsolat megszakadt a szerverrel.');
  });
  ws.addEventListener('error', () => {}); // the close event always follows and handles it
}

function helloPayload() {
  const p = getProfile();
  return {
    name: el('mp-name').value.trim() || 'Játékos',
    skinId: p.skinId,
    hatId: p.hatId,
    wrapId: p.wrapId
  };
}

// Messages sent before the socket is open are queued and flushed on open (never silently dropped)
const pending = [];
function sendMsg(obj) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(obj));
  } else {
    pending.push(obj);
  }
}

function handleMessage(msg) {
  switch (msg.type) {
    case 'welcome':
      myId = msg.id;
      break;
    case 'joined':
      el('mp-entry').classList.add('hidden');
      el('mp-room').classList.remove('hidden');
      setError('');
      if (streamerMode()) copyCode(msg.code);
      break;
    case 'room':
      myRoom = msg.room;
      renderRoom();
      break;
    case 'peer': {
      const p = peers.get(msg.id);
      if (p) {
        p.targetYaw = msg.yaw;
        p.pitch = msg.pitch;
      }
      hooks.onPeerPose?.(msg);
      break;
    }
    case 'countdown':
      setStatus(`Megtelt a szoba! Indulás ${msg.seconds} mp múlva...`);
      break;
    case 'countdown_cancel':
      setStatus('Valaki kilépett, a visszaszámlálás megállt.');
      break;
    case 'match_start':
      inMatch = true;
      el('mp-modal').classList.add('hidden');
      startPoseSync();
      showHostEndButton(msg.endRule);
      hooks.onMatchStart?.(msg);
      break;
    case 'hit':
      hooks.onHit?.(msg);
      break;
    case 'hp':
      // Server-owned HP for this player (authoritative)
      hooks.onHp?.(msg.hp);
      break;
    case 'kill':
      hooks.onKill?.(msg);
      break;
    case 'clock':
      hooks.onClock?.(msg);
      break;
    case 'match_end':
      endInMatchLocal();
      hooks.onMatchEnd?.(msg);
      break;
    case 'act':
      hooks.onPeerAct?.(msg);
      break;
    case 'throw':
      hooks.onPeerThrow?.(msg);
      break;
    case 'notice':
      hooks.onNotice?.(msg.message);
      break;
    case 'left':
      myRoom = null;
      el('mp-room').classList.add('hidden');
      el('mp-entry').classList.remove('hidden');
      break;
    case 'error':
      setError(msg.message);
      break;
    default:
      break;
  }
}

function renderRoom() {
  if (!myRoom) return;
  const r = myRoom;
  const isHost = r.hostId === myId;
  el('mp-room-code').textContent = streamerMode() ? '••••••' : r.code;
  el('mp-room-mode').textContent = `${r.modeLabel} • ${describeEndRule(r.endRule)}`;
  el('mp-room-count').textContent = `${r.players.length}/${r.size} játékos`;

  const hostBox = el('mp-host-controls');
  hostBox.classList.toggle('hidden', !isHost);
  el('mp-host-mode').value = r.mode;
  el('mp-host-size').value = r.size;
  el('mp-host-size-row').classList.toggle('hidden', r.mode !== 'ffa');
  el('mp-host-size').disabled = r.mode !== 'ffa';
  el('mp-host-end-type').value = r.endRule.type;
  el('mp-host-points-target').value = r.endRule.pointsTarget;
  el('mp-host-kill-target').value = r.endRule.killTarget;
  el('mp-host-time-limit').value = r.endRule.timeLimitMin;
  applyEndVisibility('#mp-host-end', r.endRule.type);

  el('mp-players').innerHTML = r.players
    .map((p) => `<div class="mp-player${p.id === myId ? ' me' : ''}">${p.id === r.hostId ? '👑 ' : ''}${escapeHtml(p.name)}${p.id === myId ? ' (te)' : ''}</div>`)
    .join('');

  if (r.status === 'lobby') {
    const hint = streamerMode() ? 'A kód a vágólapon van.' : `Oszd meg a kódot: ${r.code}`;
    setStatus(r.players.length < r.size ? `Várakozás a többiekre (${r.players.length}/${r.size}). ${hint}` : statusText);
  }

  syncPeers(r.players);
}

// ---- Match end rules and Streamer mode ----
function streamerMode() {
  return el('mp-streamer') ? el('mp-streamer').checked : false;
}

function readEndRule(prefix) {
  return {
    endType: el(`${prefix}end-type`).value,
    pointsTarget: Number(el(`${prefix}points-target`).value),
    killTarget: Number(el(`${prefix}kill-target`).value),
    timeLimitMin: Number(el(`${prefix}time-limit`).value)
  };
}

function applyEndVisibility(scopeSelector, type) {
  const scope = document.querySelector(scopeSelector);
  if (!scope) return;
  scope.querySelectorAll('[class*="end-points"]').forEach((e) => e.classList.toggle('hidden', type !== 'points'));
  scope.querySelectorAll('[class*="end-timed"]').forEach((e) => e.classList.toggle('hidden', type !== 'timed_kills'));
}

function describeEndRule(r) {
  if (!r) return '';
  if (r.type === 'points') return `cél: ${r.pointsTarget} pont`;
  if (r.type === 'timed_kills') return `cél: ${r.killTarget} kill, ${r.timeLimitMin} perc`;
  return 'nincs vége (csak pontszámolás)';
}

// Streamer mode: the code never appears on screen; it goes to the clipboard instead
function copyCode(code) {
  if (!navigator.clipboard || !navigator.clipboard.writeText) {
    setStatus('Streamer mód: a vágólap nem érhető el, a kód rejtve maradt.');
    return;
  }
  navigator.clipboard.writeText(code).then(
    () => setStatus('Streamer mód: a szobakód a vágólapra került.'),
    () => setStatus('Streamer mód: a vágólapra másolás nem sikerült, a kód rejtve maradt.')
  );
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function skinKey(p) {
  return `${p.skinId}|${p.hatId}|${p.wrapId}`;
}

function syncPeers(players) {
  if (!scene) return;
  const seen = new Set();
  players.forEach((p, index) => {
    seen.add(p.id);
    const key = skinKey(p);
    let entry = peers.get(p.id);
    if (entry && entry.key !== key) {
      removePeerEntry(p.id);
      entry = null;
    }
    if (!entry) {
      const char = new RivalCharacter(scene, p.skinId, {
        torsoColor: TORSO_COLORS[index % TORSO_COLORS.length],
        legsColor: '#1e293b',
        angry: false,
        hatId: p.hatId,
        wrapId: p.wrapId
      });
      entry = { char, key, yaw: 0, pitch: 0, targetYaw: 0, slot: 0 };
      peers.set(p.id, entry);
    }
    entry.slot = index;
  });
  for (const id of [...peers.keys()]) {
    if (!seen.has(id)) removePeerEntry(id);
  }
}

function removePeerEntry(id) {
  const entry = peers.get(id);
  if (!entry) return;
  scene.remove(entry.char.root);
  entry.char.dispose();
  peers.delete(id);
}

function ensureRenderer() {
  if (renderer) return;
  const canvas = el('mp-canvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.width, canvas.height, false);
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111827);
  camera = new THREE.PerspectiveCamera(38, canvas.width / canvas.height, 0.1, 50);
  camera.position.set(0, 2.2, 6.2);
  camera.lookAt(0, 1.0, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.0);
  key.position.set(3, 6, 5);
  scene.add(key);
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(4.2, 48),
    new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9 })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    dragX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    localYaw -= (e.clientX - dragX) * 0.01;
    dragX = e.clientX;
  });
  canvas.addEventListener('pointerup', () => {
    dragging = false;
  });
}

// Players stand in a row facing the camera, so nobody hides behind anyone else
function slotPosition(index, count) {
  const spacing = count <= 2 ? 1.6 : count <= 4 ? 1.3 : 0.95;
  return new THREE.Vector3((index - (count - 1) / 2) * spacing, 0, 0);
}

function frame(now) {
  rafId = requestAnimationFrame(frame);
  if (!renderer || el('mp-modal').classList.contains('hidden')) return;
  const dt = 1 / 60;
  const count = myRoom ? myRoom.players.length : 1;
  const players = myRoom ? myRoom.players : [];

  // Local avatar follows the drag; remote avatars follow their network yaw
  const selfIndex = players.findIndex((p) => p.id === myId);
  if (myRoom && selfIndex >= 0) {
    const selfEntry = peers.get(myId);
    if (selfEntry) {
      selfEntry.targetYaw = localYaw;
      selfEntry.yaw = localYaw;
    }
  }
  for (const [id, entry] of peers) {
    if (id !== myId) entry.yaw += (entry.targetYaw - entry.yaw) * 0.25;
    const pos = slotPosition(entry.slot, count);
    const state = {
      pos,
      vel: new THREE.Vector3(),
      yaw: entry.yaw,
      pitch: entry.pitch || 0,
      grounded: true,
      dead: false,
      gunMode: false,
      hasKnife: true,
      chargingThrow: false,
      chronoTimer: 0,
      rageTimer: 0,
      sliding: false,
      stunTimer: 0,
      throwWindup: 0,
      vaulting: false,
      parryTimer: 0
    };
    entry.char.update(state, dt);
  }

  if (myRoom && now - lastSent > SEND_INTERVAL_MS) {
    lastSent = now;
    sendMsg({ type: 'state', pos: [0, 0, 0], yaw: localYaw, pitch: localPitch });
  }
  renderer.render(scene, camera);
}

function openModal() {
  ensureRenderer();
  el('mp-cold-note').classList.toggle('hidden', !REMOTE_SERVER);
  el('mp-modal').classList.remove('hidden');
  connect();
  if (!rafId) rafId = requestAnimationFrame(frame);
}

function closeModal() {
  el('mp-modal').classList.add('hidden');
}

// ---- Match sync (phase 2) ----
// Pose (position, aim, HP, dead, parry) goes out 10x per second while a match runs.
function startPoseSync() {
  stopPoseSync();
  poseTimer = setInterval(() => {
    if (!hooks.getLocalPose || !socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: 'state', ...hooks.getLocalPose() }));
  }, SEND_INTERVAL_MS);
}

function stopPoseSync() {
  if (poseTimer) clearInterval(poseTimer);
  poseTimer = null;
}

function endInMatchLocal() {
  inMatch = false;
  stopPoseSync();
  showHostEndButton(null);
}

// Endless matches have no end rule, so the host gets a button to close them
function showHostEndButton(endRule) {
  if (!hostEndBtn) {
    hostEndBtn = document.createElement('button');
    hostEndBtn.textContent = '🏁 Meccs lezárása';
    hostEndBtn.style.cssText =
      'position:fixed;top:12px;right:12px;z-index:60;padding:6px 10px;border-radius:8px;' +
      'border:1px solid #f59e0b;background:#1f2937;color:#fde68a;font:600 13px system-ui,sans-serif;cursor:pointer;display:none';
    hostEndBtn.addEventListener('click', () => sendMsg({ type: 'end_match' }));
    document.body.appendChild(hostEndBtn);
  }
  const show = !!endRule && endRule.type === 'endless' && netIsHost();
  hostEndBtn.style.display = show ? 'block' : 'none';
}

export function netMyId() {
  return myId;
}

export function netIsHost() {
  return !!myRoom && myRoom.hostId === myId;
}

// Sends are dropped when the socket is down, so nothing piles up in the queue during a match
function sendIfOpen(obj) {
  if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(obj));
}

export function netSendHit(victimId, data) {
  sendIfOpen({ type: 'hit', victimId, ...data });
}

// Storm and poison damage to our own player: the server caps and applies it
export function netSendSelfHit(damage, method) {
  sendIfOpen({ type: 'self_hit', damage, method });
}

export function netSendDied(data) {
  sendIfOpen({ type: 'died', ...data });
}

export function netSendAlive() {
  sendIfOpen({ type: 'alive' });
}

export function netSendAct(data) {
  sendIfOpen({ type: 'act', ...data });
}

export function netSendThrow(data) {
  sendIfOpen({ type: 'throw', ...data });
}

export function netRematch() {
  sendIfOpen({ type: 'rematch' });
}

export function netLeaveMatch() {
  endInMatchLocal();
  sendIfOpen({ type: 'leave' });
}

export function initMultiplayer(options = {}) {
  if (options.getProfile) getProfile = options.getProfile;
  if (options.game) hooks = options.game;
  el('mp-name').value = localStorage.getItem('mp_name') || 'Játékos';

  el('btn-open-mp').addEventListener('click', openModal);
  el('btn-close-mp').addEventListener('click', closeModal);

  el('mp-name').addEventListener('change', () => {
    localStorage.setItem('mp_name', el('mp-name').value.trim() || 'Játékos');
    sendMsg({ type: 'hello', ...helloPayload() });
  });

  el('mp-mode').addEventListener('change', () => {
    el('mp-size').disabled = el('mp-mode').value !== 'ffa';
  });
  el('mp-size').disabled = el('mp-mode').value !== 'ffa';

  el('mp-create').addEventListener('click', () => {
    setError('');
    connect();
    sendMsg({ type: 'hello', ...helloPayload() });
    sendMsg({ type: 'create', mode: el('mp-mode').value, size: Number(el('mp-size').value), ...readEndRule('mp-') });
  });

  el('mp-join').addEventListener('click', () => {
    setError('');
    connect();
    sendMsg({ type: 'hello', ...helloPayload() });
    sendMsg({ type: 'join', code: el('mp-code').value });
  });

  el('mp-leave').addEventListener('click', () => {
    sendMsg({ type: 'leave' });
    for (const id of [...peers.keys()]) removePeerEntry(id);
    myRoom = null;
  });

  const pushSettings = () => {
    const endRule = readEndRule('mp-host-');
    applyEndVisibility('#mp-host-end', endRule.endType);
    sendMsg({ type: 'settings', mode: el('mp-host-mode').value, size: Number(el('mp-host-size').value), endType: endRule.endType, pointsTarget: endRule.pointsTarget, killTarget: endRule.killTarget, timeLimitMin: endRule.timeLimitMin });
  };
  el('mp-host-mode').addEventListener('change', pushSettings);
  el('mp-host-size').addEventListener('change', pushSettings);
  el('mp-host-end-type').addEventListener('change', pushSettings);
  for (const id of ['mp-host-points-target', 'mp-host-kill-target', 'mp-host-time-limit']) {
    el(id).addEventListener('change', pushSettings);
  }

  // Entry form: end-rule fields follow the chosen rule
  el('mp-end-type').addEventListener('change', () => applyEndVisibility('#mp-entry', el('mp-end-type').value));
  applyEndVisibility('#mp-entry', el('mp-end-type').value);

  // Streamer mode: remembered per browser; turning it on while in a room copies the code
  el('mp-streamer').checked = localStorage.getItem('mp_streamer') === '1';
  el('mp-streamer').addEventListener('change', () => {
    localStorage.setItem('mp_streamer', el('mp-streamer').checked ? '1' : '0');
    if (myRoom) {
      renderRoom();
      if (streamerMode()) copyCode(myRoom.code);
    }
  });
}
