// Keyframe emote packs (".mj" files).
// Built-in packs are sold in the Armory. Any pack can also be imported from a .mj file,
// which unlocks it (a shop pack's id grants the shop pack).
export const MJ_FORMAT = 'mj-emote';
export const MJ_VERSION = 1;
export const MJ_MAX_BYTES = 64 * 1024;
export const MJ_MAX_IMPORTS = 20;
export const MJ_PARTS = ['body', 'torso', 'head', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];
const ROT_LIMIT = 6.3; // radians
const POS_LIMIT = 1.5; // metres (only "body" may move)

// Keyframes: { t, parts: { <partName>: { rot: [x,y,z], pos: [x,y,z] } } }
// Rotation x > 0 raises an arm forward/up. Body rot.x < 0 leans the character forward (towards -Z).
export const BUILTIN_PACKS = [
  {
    id: 'moonwalk',
    name: '🕺 Moonwalk',
    desc: 'Sliding moonwalk: one foot glides back while the other snaps forward, with a swinging arm rhythm.',
    rarityKey: 'EPIC',
    price: 400,
    icon: '🕺',
    duration: 0.6,
    loop: true,
    knife: true,
    keyframes: [
      {
        t: 0,
        parts: {
          leftLeg: { rot: [0.5, 0, 0] },
          rightLeg: { rot: [-0.5, 0, 0] },
          leftArm: { rot: [-0.4, 0, 0.2] },
          rightArm: { rot: [0.4, 0, -0.2] },
          body: { rot: [0.08, 0, 0], pos: [0, 0, 0] }
        }
      },
      {
        t: 0.5,
        parts: {
          leftLeg: { rot: [-0.45, 0, 0] },
          rightLeg: { rot: [0.45, 0, 0] },
          leftArm: { rot: [0.4, 0, 0.2] },
          rightArm: { rot: [-0.4, 0, -0.2] },
          body: { rot: [0.08, 0, 0], pos: [0, 0.03, 0] }
        }
      },
      {
        t: 0.6,
        parts: {
          leftLeg: { rot: [0.5, 0, 0] },
          rightLeg: { rot: [-0.5, 0, 0] },
          leftArm: { rot: [-0.4, 0, 0.2] },
          rightArm: { rot: [0.4, 0, -0.2] },
          body: { rot: [0.08, 0, 0], pos: [0, 0, 0] }
        }
      }
    ]
  },
  {
    id: 'lean_forward',
    name: '🧍 Forward Lean',
    desc: 'A cool forward lean with a slow sway, hands loose at your sides.',
    rarityKey: 'RARE',
    price: 200,
    icon: '🧍',
    duration: 2.0,
    loop: true,
    knife: true,
    keyframes: [
      {
        t: 0,
        parts: {
          body: { rot: [-0.35, 0, 0], pos: [0, -0.04, 0] },
          leftArm: { rot: [-0.2, 0, 0.12] },
          rightArm: { rot: [-0.2, 0, -0.12] },
          leftLeg: { rot: [0.08, 0, 0] },
          rightLeg: { rot: [-0.08, 0, 0] }
        }
      },
      {
        t: 1.0,
        parts: {
          body: { rot: [-0.42, 0, 0.06], pos: [0, -0.05, 0] },
          leftArm: { rot: [-0.2, 0, 0.12] },
          rightArm: { rot: [-0.2, 0, -0.12] },
          leftLeg: { rot: [0.08, 0, 0] },
          rightLeg: { rot: [-0.08, 0, 0] }
        }
      },
      {
        t: 2.0,
        parts: {
          body: { rot: [-0.35, 0, 0], pos: [0, -0.04, 0] },
          leftArm: { rot: [-0.2, 0, 0.12] },
          rightArm: { rot: [-0.2, 0, -0.12] },
          leftLeg: { rot: [0.08, 0, 0] },
          rightLeg: { rot: [-0.08, 0, 0] }
        }
      }
    ]
  }
];

export const BUILTIN_PACK_IDS = BUILTIN_PACKS.map((p) => p.id);

function readVec(v, limit, what) {
  if (!Array.isArray(v) || v.length !== 3) throw new Error(`${what} must be an array of 3 numbers`);
  return v.map((n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) throw new Error(`${what} contains a non-number`);
    return Math.max(-limit, Math.min(limit, x));
  });
}

/** Validates a parsed .mj object. Returns a clean, clamped pack definition or throws an Error with a readable message. */
export function validatePack(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('The file is not a JSON object.');
  if (raw.format !== MJ_FORMAT) throw new Error(`Not a .mj emote file (format must be "${MJ_FORMAT}").`);
  if (raw.version !== MJ_VERSION) throw new Error(`Unsupported .mj version: ${raw.version}.`);
  const id = String(raw.id || '');
  if (!/^[a-z0-9_]{3,32}$/.test(id)) throw new Error('"id" must be 3-32 characters: a-z, 0-9, underscore.');
  const name = String(raw.name || '').slice(0, 40);
  if (!name) throw new Error('"name" is required.');
  const desc = String(raw.desc || '').slice(0, 140);
  const duration = Number(raw.duration);
  if (!(duration >= 0.2 && duration <= 12)) throw new Error('"duration" must be between 0.2 and 12 seconds.');
  const loop = raw.loop !== false;
  const knife = raw.knife !== false;
  if (!Array.isArray(raw.keyframes) || raw.keyframes.length < 1 || raw.keyframes.length > 120) {
    throw new Error('"keyframes" must contain 1 to 120 entries.');
  }
  const keyframes = raw.keyframes.map((kf) => {
    const t = Number(kf && kf.t);
    if (!(t >= 0 && t <= duration)) throw new Error('A keyframe time is outside 0..duration.');
    const parts = {};
    for (const [partName, data] of Object.entries((kf && kf.parts) || {})) {
      if (!MJ_PARTS.includes(partName)) throw new Error(`Unknown body part "${partName}".`);
      const entry = {};
      if (data && data.rot !== undefined) entry.rot = readVec(data.rot, ROT_LIMIT, `${partName}.rot`);
      if (data && data.pos !== undefined) {
        if (partName !== 'body') throw new Error('Only "body" can have "pos".');
        entry.pos = readVec(data.pos, POS_LIMIT, 'body.pos');
      }
      parts[partName] = entry;
    }
    return { t, parts };
  });
  keyframes.sort((a, b) => a.t - b.t);
  if (keyframes[0].t !== 0) throw new Error('The first keyframe must be at t = 0.');
  return { format: MJ_FORMAT, version: MJ_VERSION, id, name, desc, duration, loop, knife, keyframes };
}

// ---- sampling ----
const compiledCache = new WeakMap();

function compilePack(def) {
  const tracks = {};
  for (const part of MJ_PARTS) {
    const frames = def.keyframes
      .filter((kf) => kf.parts[part])
      .map((kf) => ({ t: kf.t, rot: kf.parts[part].rot, pos: kf.parts[part].pos }));
    if (frames.length) tracks[part] = frames;
  }
  return { ...def, tracks };
}

function lerpVec(a, b, k) {
  const A = a || [0, 0, 0];
  const B = b || [0, 0, 0];
  return [A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k];
}

function sampleTrack(frames, time, duration, loop) {
  const n = frames.length;
  if (n === 1) return { rot: frames[0].rot, pos: frames[0].pos };
  const t = loop ? ((time % duration) + duration) % duration : Math.min(time, duration);
  let i = 0;
  while (i < n - 1 && frames[i + 1].t <= t) i++;
  const a = frames[i];
  let b;
  let tb;
  if (i < n - 1) {
    b = frames[i + 1];
    tb = b.t;
  } else {
    if (!loop) return { rot: a.rot, pos: a.pos }; // hold the last pose
    b = frames[0]; // wrap around to the first keyframe
    tb = frames[0].t + duration;
  }
  const span = tb - a.t;
  const k = span > 1e-6 ? Math.min(1, Math.max(0, (t - a.t) / span)) : 0;
  return {
    rot: lerpVec(a.rot, b.rot, k),
    pos: a.pos || b.pos ? lerpVec(a.pos, b.pos, k) : null
  };
}

/** Returns { partName: { rot, pos } } for the pack at the given emote time. */
export function samplePose(def, time) {
  let compiled = compiledCache.get(def);
  if (!compiled) {
    compiled = compilePack(def);
    compiledCache.set(def, compiled);
  }
  const out = {};
  for (const [part, frames] of Object.entries(compiled.tracks)) {
    out[part] = sampleTrack(frames, time, compiled.duration, compiled.loop);
  }
  return out;
}

// ---- registry: built-in packs plus imported ones ----
let importedPacks = [];
export function setImportedPacks(list) {
  importedPacks = Array.isArray(list) ? list : [];
}

export function getPackById(id) {
  return BUILTIN_PACKS.find((p) => p.id === id) || importedPacks.find((p) => p.id === id) || null;
}

/** Strips shop-only fields so the file can be shared as a plain .mj. */
export function toMjFile(pack) {
  return {
    format: MJ_FORMAT,
    version: MJ_VERSION,
    id: pack.id,
    name: pack.name,
    desc: pack.desc,
    duration: pack.duration,
    loop: pack.loop,
    knife: pack.knife,
    keyframes: pack.keyframes
  };
}
