import * as THREE from 'three';
import { WRAPS, WRAP_DROP_CHANCE, getWrapById, applyWrapToMaterial } from './wraps.js';
import { readSavedProfileJson, writeSavedProfileJson } from './storage.js';

export const RARITY_TIERS = {
  COMMON: { id: 'COMMON', label: 'COMMON', color: '#38bdf8', tierIndex: 0, dupeRefund: 45 },
  RARE: { id: 'RARE', label: 'RARE', color: '#a855f7', tierIndex: 1, dupeRefund: 85 },
  EPIC: { id: 'EPIC', label: 'EPIC', color: '#ff2a55', tierIndex: 2, dupeRefund: 140 },
  LEGENDARY: { id: 'LEGENDARY', label: 'LEGENDARY', color: '#fbbf24', tierIndex: 3, dupeRefund: 240 },
  MYTHIC: { id: 'MYTHIC', label: 'MYTHIC', color: '#10f587', tierIndex: 4, dupeRefund: 400 },
  ASCENDANT: { id: 'ASCENDANT', label: 'ASCENDANT', color: '#e8b730', tierIndex: 5, dupeRefund: 700 }
};

// Salvo knives: one per rarity. The rarity sets the clip size (max knives per clip); ASCENDANT has an unlimited clip.
const BURST_MAGAZINES = { COMMON: 2, RARE: 4, EPIC: 6, LEGENDARY: 8, MYTHIC: 10, ASCENDANT: Infinity };
const BURST_SKINS = Object.entries(BURST_MAGAZINES).map(([rk, mag]) => {
  const color = RARITY_TIERS[rk].color;
  const hex = parseInt(color.slice(1), 16);
  return {
    id: `burst_salvo_${rk.toLowerCase()}`,
    name: `Burst: Salvo Clip (${rk})`,
    rarityKey: rk,
    rarity: rk,
    rarityColor: color,
    type: 'burst',
    magazine: mag,
    trailColor: hex,
    glowColor: hex,
    bladeColor: 0x9ca3af,
    edgeColor: 0xf1f5f9,
    handleColor: 0x1f2937,
    accentColor: hex,
    emissive: 0x111827,
    emissiveIntensity: 0.4,
    desc: mag === Infinity
      ? 'ASCENDANT: unlimited clip. Each press fires a 10-knife salvo, then a short cooldown.'
      : `${rk}: clip of ${mag} knives. A press fires the whole clip in a salvo (0.5 s apart). Knives return one by one; when empty you punch.`
  };
});

// Trick knives: each has its own throw behaviour (projectiles.js handles it by `type`)
const TRICK_SKINS = [
  { id: 'ricochet_shard', name: 'Ricochet Shard', rarityKey: 'EPIC', type: 'ricochet', color: 0xa3e635,
    desc: 'EPIC: bounces off walls up to twice and banks toward the nearest enemy.' },
  { id: 'hunter_hawk', name: 'Hunter Hawk', rarityKey: 'LEGENDARY', type: 'homing', color: 0xf472b6,
    desc: 'LEGENDARY: flies straight and steers toward the nearest enemy after the throw.' },
  { id: 'trident_fan', name: 'Trident Fan', rarityKey: 'RARE', type: 'fan', color: 0x38bdf8,
    desc: 'RARE: throws three blades in a fan. Each blade deals 60% of the normal damage.' },
  { id: 'c4_charge', name: 'C4 Charge', rarityKey: 'LEGENDARY', type: 'c4', color: 0xef4444,
    desc: 'LEGENDARY: sticks where it lands and explodes 1.6 s later (95 to 25 damage, 4.5 m radius). A hit detonates it at once.' },
  { id: 'ember_brand', name: 'Ember Brand', rarityKey: 'MYTHIC', type: 'fire', color: 0xff6a00,
    desc: 'MYTHIC: where it lands it starts a fire that spreads to nearby ground and burns enemies who stand in it.' }
].map((t) => ({
  ...t,
  rarity: t.rarityKey,
  rarityColor: RARITY_TIERS[t.rarityKey].color,
  trailColor: t.color,
  glowColor: t.color,
  bladeColor: 0x9ca3af,
  edgeColor: 0xf1f5f9,
  handleColor: 0x1f2937,
  accentColor: t.color,
  emissive: 0x111827,
  emissiveIntensity: 0.4
}));

export const KNIFE_SKINS = [
  ...TRICK_SKINS,
  // === GYAKORI (COMMON) ===
  {
    id: 'tactical_starter',
    name: 'Basic Tactical Knife',
    rarityKey: 'COMMON',
    rarity: 'COMMON',
    rarityColor: '#94a3b8',
    type: 'standard',
    trailColor: 0xe2e8f0,
    glowColor: 0x94a3b8,
    bladeColor: 0xdbe4ee,
    edgeColor: 0xffffff,
    handleColor: 0x1e293b,
    accentColor: 0x64748b,
    emissive: 0x000000,
    emissiveIntensity: 0,
    desc: 'A reliable military knife. Every rookie starts with one!'
  },
  {
    id: 'blueprint_blade',
    name: 'Blueprint Prototype',
    rarityKey: 'COMMON',
    rarity: 'COMMON',
    rarityColor: '#38bdf8',
    type: 'standard',
    trailColor: 0x38bdf8,
    glowColor: 0x38bdf8,
    bladeColor: 0x0284c7,
    edgeColor: 0xe0f2fe,
    handleColor: 0x0f172a,
    accentColor: 0xffffff,
    emissive: 0x0369a1,
    emissiveIntensity: 0.28,
    desc: 'Engineering test-range release with a blue CAD blueprint coating and a white edge.'
  },
  {
    id: 'classic_blox_dagger',
    name: 'Classic Blox Dagger',
    rarityKey: 'COMMON',
    rarity: 'COMMON',
    rarityColor: '#38bdf8',
    type: 'standard',
    trailColor: 0xef4444,
    glowColor: 0xf87171,
    bladeColor: 0xcbd5e1,
    edgeColor: 0xffffff,
    handleColor: 0xdc2626,
    accentColor: 0xfacc15,
    emissive: 0x000000,
    emissiveIntensity: 0,
    desc: 'A true old-school Roblox dueling dagger with a red and yellow grip!'
  },
  {
    id: 'orange_dev_knife',
    name: 'Dev-Grid Narancs',
    rarityKey: 'COMMON',
    rarity: 'COMMON',
    rarityColor: '#38bdf8',
    type: 'bayonet',
    trailColor: 0xf97316,
    glowColor: 0xfb923c,
    bladeColor: 0xea580c,
    edgeColor: 0xffedd5,
    handleColor: 0x27272a,
    accentColor: 0xf97316,
    emissive: 0x9a3412,
    emissiveIntensity: 0.25,
    desc: 'An assault knife inspired by the legendary orange test-range texture.'
  },

  // === RITKA (RARE) ===
  {
    id: 'kunai_shadow',
    name: 'Kunai: Shadow',
    rarityKey: 'RARE',
    rarity: 'RARE',
    rarityColor: '#a855f7',
    type: 'kunai',
    trailColor: 0xa855f7,
    glowColor: 0xc084fc,
    bladeColor: 0x2e1065,
    edgeColor: 0xd8b4fe,
    handleColor: 0x1e1b4b,
    accentColor: 0xa855f7,
    emissive: 0x581c87,
    emissiveIntensity: 0.45,
    desc: 'A ninja throwing knife with a finger ring. Press [F] to spin it fast on your finger!'
  },
  {
    id: 'karambit_hazard',
    name: 'Karambit: Test Zone',
    rarityKey: 'RARE',
    rarity: 'RARE',
    rarityColor: '#a855f7',
    type: 'karambit',
    trailColor: 0xfacc15,
    glowColor: 0xfde047,
    bladeColor: 0xeab308,
    edgeColor: 0xfef9c3,
    handleColor: 0x18181b,
    accentColor: 0xfacc15,
    emissive: 0x854d0e,
    emissiveIntensity: 0.35,
    desc: 'An industrial yellow-black hazard-zone karambit with a curved blade.'
  },
  {
    id: 'balisong_cobalt',
    name: 'Butterfly Knife: Cobalt',
    rarityKey: 'RARE',
    rarity: 'RARE',
    rarityColor: '#a855f7',
    type: 'balisong',
    trailColor: 0x60a5fa,
    glowColor: 0x60a5fa,
    bladeColor: 0x94a3b8,
    edgeColor: 0x60a5fa,
    handleColor: 0x1d4ed8,
    accentColor: 0x93c5fd,
    emissive: 0x1e40af,
    emissiveIntensity: 0.35,
    desc: 'A two-piece cobalt-blue butterfly knife with a flashy [F] flip trick.'
  },

  // === EPIKUS (EPIC) ===
  {
    id: 'karambit_crimson',
    name: 'Karambit: Blood Moon',
    rarityKey: 'EPIC',
    rarity: 'EPIC',
    rarityColor: '#ff2a55',
    type: 'karambit',
    trailColor: 0xff2a55,
    glowColor: 0xff2a55,
    bladeColor: 0xd90429,
    edgeColor: 0xff8fa3,
    handleColor: 0x111318,
    accentColor: 0xff2a55,
    emissive: 0x800f2f,
    emissiveIntensity: 0.55,
    desc: 'A curved predator blade with a crimson glow and finger-ring spin!'
  },
  {
    id: 'balisong_neon',
    name: 'Butterfly Knife: Neon Pulse',
    rarityKey: 'EPIC',
    rarity: 'EPIC',
    rarityColor: '#ff2a55',
    type: 'balisong',
    trailColor: 0x00f0ff,
    glowColor: 0x00f0ff,
    bladeColor: 0x0f172a,
    edgeColor: 0x00f0ff,
    handleColor: 0x311042,
    accentColor: 0xff2a55,
    emissive: 0x00b4d8,
    emissiveIntensity: 0.68,
    desc: 'A titanium grip with a cyan-pink plasma edge. A true Rivals fan favorite!'
  },
  {
    id: 'bayonet_emerald',
    name: 'M9 Bajonett: Smaragd',
    rarityKey: 'EPIC',
    rarity: 'EPIC',
    rarityColor: '#ff2a55',
    type: 'bayonet',
    trailColor: 0x10f587,
    glowColor: 0x10f587,
    bladeColor: 0x059669,
    edgeColor: 0x6ee7b7,
    handleColor: 0x0f172a,
    accentColor: 0x10f587,
    emissive: 0x047857,
    emissiveIntensity: 0.55,
    desc: 'A serrated M9 assault knife with a glowing emerald-green anodized blade.'
  },

  // === LEGENDÁS (LEGENDARY) ===
  {
    id: 'balisong_royal_gold',
    name: 'Butterfly Knife: 24K Gold',
    rarityKey: 'LEGENDARY',
    rarity: 'LEGENDARY',
    rarityColor: '#fbbf24',
    type: 'balisong',
    trailColor: 0xfbbf24,
    glowColor: 0xfde68a,
    bladeColor: 0xf59e0b,
    edgeColor: 0xffffff,
    handleColor: 0x78350f,
    accentColor: 0xfde047,
    emissive: 0xb45309,
    emissiveIntensity: 0.65,
    desc: 'A solid gold champion butterfly knife with a blinding white glow.'
  },
  {
    id: 'dragon_gold',
    name: 'Dragon Dagger: Gold Flame',
    rarityKey: 'LEGENDARY',
    rarity: 'LEGENDARY',
    rarityColor: '#fbbf24',
    type: 'dragon',
    trailColor: 0xff9e00,
    glowColor: 0xffb703,
    bladeColor: 0xf59e0b,
    edgeColor: 0xfffbeb,
    handleColor: 0x450a0a,
    accentColor: 0xffd166,
    emissive: 0xd97706,
    emissiveIntensity: 0.8,
    desc: 'An ancient gilded dragon blade with a glowing ember core!'
  },

  // === MITIKUS (MYTHIC) ===
  {
    id: 'karambit_void_mythic',
    name: 'Karambit: Cosmic Void',
    rarityKey: 'MYTHIC',
    rarity: 'MYTHIC',
    rarityColor: '#10f587',
    type: 'karambit',
    trailColor: 0x10f587,
    glowColor: 0x00f0ff,
    bladeColor: 0x090d16,
    edgeColor: 0x10f587,
    handleColor: 0x090d16,
    accentColor: 0x00f0ff,
    emissive: 0x059669,
    emissiveIntensity: 0.95,
    desc: 'PEAK RARITY (0.5%–14% chance): an obsidian void blade with a pulsing neon-emerald aura!'
  },
  // === ASCENDANT (legritkább, csak dropboxból) ===
  {
    id: 'nunchaku_aurum',
    name: 'Nunchaku: Aurum Twin',
    rarityKey: 'ASCENDANT',
    rarity: 'ASCENDANT',
    rarityColor: '#e8b730',
    type: 'nunchaku',
    trailColor: 0xffd166,
    glowColor: 0xffb020,
    bladeColor: 0xe8e2d0,
    edgeColor: 0xfff3c4,
    handleColor: 0x1c1408,
    accentColor: 0xe8b730,
    emissive: 0x7a4a00,
    emissiveIntensity: 0.6,
    desc: 'ASCENDANT: two blades on a short chain. The trailing knife swings with real momentum on every slash.'
  },
  {
    id: 'grapple_iron_anchor',
    name: 'Grapple: Iron Anchor',
    rarityKey: 'ASCENDANT',
    rarity: 'ASCENDANT',
    rarityColor: '#e8b730',
    type: 'grapple',
    trailColor: 0x8b5cf6,
    glowColor: 0x7c3aed,
    bladeColor: 0x9aa4b2,
    edgeColor: 0xe2e8f0,
    handleColor: 0x0f172a,
    accentColor: 0xcbd5e1,
    emissive: 0x2e1065,
    emissiveIntensity: 0.4,
    desc: 'ASCENDANT: a hooked knife on a chain. A hit drags the target toward you. It can never kill in one hit.'
  },
  {
    id: 'poison_viper_fang',
    name: 'Venom: Viper Fang',
    rarityKey: 'ASCENDANT',
    rarity: 'ASCENDANT',
    rarityColor: '#e8b730',
    type: 'poison',
    trailColor: 0x22c55e,
    glowColor: 0x16a34a,
    bladeColor: 0x1f2a1f,
    edgeColor: 0x4ade80,
    handleColor: 0x0b1409,
    accentColor: 0x22c55e,
    emissive: 0x064e1f,
    emissiveIntensity: 0.9,
    desc: 'ASCENDANT: a venom blade. Every hit poisons the target for 4 HP per second over 5 seconds.'
  },
  {
    id: 'dual_pine_thorn',
    name: 'Dual: Pine Thorn',
    rarityKey: 'ASCENDANT',
    rarity: 'ASCENDANT',
    rarityColor: '#e8b730',
    type: 'dual',
    trailColor: 0x86efac,
    glowColor: 0x22c55e,
    bladeColor: 0xb8c4b0,
    edgeColor: 0xe2f5d8,
    handleColor: 0x0f2a1a,
    accentColor: 0xe8b730,
    emissive: 0x0d3b1f,
    emissiveIntensity: 0.5,
    desc: 'ASCENDANT: one knife per hand with pine-needle spikes. The left knife slashes, the right knife is thrown and returns after a short recharge.'
  },
  ...BURST_SKINS,
  // === TUTORIAL REWARD (exclusive: not in any dropbox, shop, or trade) ===
  {
    id: 'mentor_fang',
    name: 'Mentor: Ivory Fang',
    rarityKey: 'LEGENDARY',
    rarity: 'LEGENDARY',
    rarityColor: '#fbbf24',
    type: 'karambit',
    exclusive: 'tutorial',
    heals: true,
    trailColor: 0xfacc15,
    glowColor: 0xfacc15,
    bladeColor: 0xd6d3d1,
    edgeColor: 0xffffff,
    handleColor: 0x1c1917,
    accentColor: 0xeab308,
    emissive: 0x3f1d00,
    emissiveIntensity: 0.3,
    desc: 'Tutorial reward. Heals you when no one is fighting, once you have won 2 matches.'
  }
];

export const DROPBOXES = [
  {
    id: 'basic_box',
    name: '📦 Blueprint Dropbox',
    price: 100,
    color: '#38bdf8',
    desc: 'Entry-level Rivals crate! Open one after every won match.',
    weights: {
      COMMON: 58,
      RARE: 28,
      EPIC: 11,
      LEGENDARY: 2.5,
      MYTHIC: 0.5,
      ASCENDANT: 0.1
    }
  },
  {
    id: 'rival_box',
    name: '💎 Rival Elite Dropbox',
    price: 250,
    color: '#ff2a55',
    desc: 'No Common skins! Guaranteed at least Rare, with high Epic and Legendary odds.',
    weights: {
      COMMON: 0,
      RARE: 48,
      EPIC: 35,
      LEGENDARY: 14,
      MYTHIC: 3,
      ASCENDANT: 0.4
    }
  },
  {
    id: 'champion_box',
    name: '👑 Champion Gold Dropbox',
    price: 500,
    color: '#fbbf24',
    desc: 'Premium crate for champions: ONLY Epic, Legendary or Mythic knives can drop!',
    weights: {
      COMMON: 0,
      RARE: 0,
      EPIC: 48,
      LEGENDARY: 38,
      MYTHIC: 14,
      ASCENDANT: 1.2
    }
  }
];

function pickSkinByWeights(weights) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const total = entries.reduce((acc, [, w]) => acc + w, 0);
  let r = Math.random() * total;
  let chosenRarity = entries[0][0];
  for (const [rarityKey, w] of entries) {
    if (r < w) {
      chosenRarity = rarityKey;
      break;
    }
    r -= w;
  }

  // Knife wraps ("fólia") can drop from any knife dropbox, matching the rolled rarity
  const wrapPool = WRAPS.filter((w) => w.pattern !== 'none' && !w.exclusive && w.rarityKey === chosenRarity);
  if (wrapPool.length > 0 && Math.random() < WRAP_DROP_CHANCE) {
    return wrapPool[Math.floor(Math.random() * wrapPool.length)];
  }

  // Filter dropbox pool (exclude starter knife from paid boxes so every drop feels special!)
  const pool = KNIFE_SKINS.filter((s) => s.rarityKey === chosenRarity && s.id !== 'tactical_starter' && !s.exclusive);
  const fallbackPool = KNIFE_SKINS.filter((s) => s.rarityKey === chosenRarity && !s.exclusive);
  const list = pool.length > 0 ? pool : fallbackPool;
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Rolls an RNG Dropbox and returns `{ winner, reelItems, winnerIndex }` for the animated CS/Rivals spinner!
 */
export function rollDropbox(boxId) {
  const box = DROPBOXES.find((b) => b.id === boxId) || DROPBOXES[0];
  const winner = pickSkinByWeights(box.weights);
  const totalSlots = 44;
  const winnerIndex = 38;
  const reelItems = [];

  for (let i = 0; i < totalSlots; i++) {
    if (i === winnerIndex) {
      reelItems.push(winner);
    } else {
      reelItems.push(pickSkinByWeights(box.weights));
    }
  }

  return { box, winner, reelItems, winnerIndex };
}

const STORAGE_KEY = 'blade_rivals_profile_v2';

export function createDefaultBotMemory() {
  return {
    level: 1,
    xp: 0,
    elo: 100,
    tutorialCompleted: false,
    coachTipsEnabled: true,
    roundsPlayed: 0,
    playerRoundWins: 0,
    botRoundWins: 0,
    // Tracked player combat habits so the bot genuinely adapts!
    playerSlashes: 0,
    playerThrows: 0,
    playerParries: 0,
    playerHeadshots: 0,
    playerSlidesAndDashes: 0,
    laneLeft: 0,
    laneMid: 0,
    laneRight: 0,
    lastAdaptSummary: 'Training level (Level 1): the bot is watching your movement and aim!'
  };
}

// ?dev in the URL unlocks every knife (for testing). Unlocks are saved with the profile.
function isDevUrl() {
  try {
    return typeof location !== 'undefined' && new URLSearchParams(location.search).has('dev');
  } catch {
    return false;
  }
}

export function loadProfile() {
  const p = loadProfileBase();
  if (isDevUrl()) {
    p.unlockedSkins = Array.from(new Set([...p.unlockedSkins, ...KNIFE_SKINS.map((k) => k.id)]));
    p.unlockedWraps = Array.from(new Set([...p.unlockedWraps, ...WRAPS.map((w) => w.id)]));
  }
  return p;
}

function loadProfileBase() {
  const fallback = {
    equippedSkin: 'tactical_starter',
    unlockedSkins: ['tactical_starter'],
    equippedKillEffect: 'voxel_classic',
    unlockedKillEffects: ['voxel_classic'],
    equippedTrail: 'trail_skin',
    unlockedTrails: ['trail_skin'],
    equippedHat: 'hat_none',
    unlockedHats: ['hat_none'],
    equippedWrap: 'wrap_none',
    unlockedWraps: ['wrap_none'],
    unlockedEmotePacks: [],
    importedPacks: [],
    equippedGun: 'gun_pistol',
    unlockedGuns: [],
    unlockedAbilities: ['ability_dash', 'ability_adrenaline'],
    abilityWheel: ['ability_dash', 'ability_adrenaline', null, null],
    activeWheelSlot: 0,
    rankedRp: 120,
    cash: 320, // Starter $ so players can open Ability / Knife / Effect Dropboxes right away!
    tutorial: { status: 'pending' },
    stats: {
      kills: 0,
      wins: 0,
      rankedWins: 0,
      ffaWins: 0,
      dojoBestScore: 0,
      losses: 0,
      parries: 0,
      headshots: 0,
      boxesOpened: 0
    },
    botMemory: createDefaultBotMemory(),
    settings: {
      sensitivity: 1.0,
      fov: 85,
      volume: 0.7,
      cameraMode: 'first',
      tpsDistance: 3.6,
      victoryEmote: 'blade_flourish',
      showFps: true,
      quality: 'high'
    }
  };
  try {
    const raw = readSavedProfileJson();
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    const wheel = Array.isArray(parsed.abilityWheel) && parsed.abilityWheel.length === 4
      ? parsed.abilityWheel
      : fallback.abilityWheel;
    return {
      ...fallback,
      ...parsed,
      abilityWheel: wheel,
      stats: { ...fallback.stats, ...(parsed.stats || {}) },
      botMemory: { ...fallback.botMemory, ...(parsed.botMemory || {}) },
      settings: { ...fallback.settings, ...(parsed.settings || {}) },
      unlockedSkins: Array.from(new Set([...fallback.unlockedSkins, ...(parsed.unlockedSkins || [])])),
      unlockedKillEffects: Array.from(new Set([...fallback.unlockedKillEffects, ...(parsed.unlockedKillEffects || [])])),
      unlockedTrails: Array.from(new Set([...fallback.unlockedTrails, ...(parsed.unlockedTrails || [])])),
      unlockedHats: Array.from(new Set([...fallback.unlockedHats, ...(parsed.unlockedHats || [])])),
      unlockedWraps: Array.from(new Set([...fallback.unlockedWraps, ...(parsed.unlockedWraps || [])])),
      unlockedEmotePacks: Array.from(new Set([...fallback.unlockedEmotePacks, ...(parsed.unlockedEmotePacks || [])])),
      importedPacks: Array.isArray(parsed.importedPacks) ? parsed.importedPacks : [],
      equippedGun: typeof parsed.equippedGun === 'string' ? parsed.equippedGun : 'gun_pistol',
      unlockedGuns: Array.isArray(parsed.unlockedGuns) ? parsed.unlockedGuns : [],
      unlockedAbilities: Array.from(new Set([...fallback.unlockedAbilities, ...(parsed.unlockedAbilities || [])]))
    };
  } catch {
    return fallback;
  }
}

export function saveProfile(profile) {
  try {
    writeSavedProfileJson(JSON.stringify(profile));
  } catch {
    // Ignore storage quota errors
  }
}

export function getSkinById(id) {
  return KNIFE_SKINS.find((s) => s.id === id) || KNIFE_SKINS[0];
}

/**
 * Builds a detailed, articulated 3D Knife Group oriented along -Z (blade pointing forward -Z)
 */
// ================= ASCENDANT knives (legritkább ritkaság, csak dropboxból) =================
// nunchaku: két kés rövid láncon (a második penge rugós fizikával lenget)
// grapple:  horgos kés (a dobott horog ránt; nem szed le egy ütéssel)
// poison:   mérgező kés (a találat hosszan sebez)
export const ASCENDANT_TYPES = new Set(['nunchaku', 'grapple', 'poison', 'dual']);

function makeBladeMesh(len, bladeMat, zOffset) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.026);
  shape.lineTo(-len * 0.7, 0.026);
  shape.lineTo(-len, -0.004);
  shape.quadraticCurveTo(-len * 0.7, -0.034, -len * 0.35, -0.03);
  shape.lineTo(0, -0.028);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.011, bevelEnabled: true, bevelThickness: 0.0045, bevelSize: 0.0045, bevelSegments: 2
  });
  const mesh = new THREE.Mesh(geo, bladeMat);
  mesh.rotation.y = -Math.PI / 2;
  mesh.position.set(0.0055, 0, zOffset);
  return mesh;
}

function addHilt(group, handleMat, accentMat) {
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.038, 0.16), handleMat);
  grip.position.set(0, 0, 0.03);
  group.add(grip);
  const pommel = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.044, 0.024), accentMat);
  pommel.position.set(0, 0, 0.115);
  group.add(pommel);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.092, 0.022), accentMat);
  guard.position.set(0, 0, -0.052);
  group.add(guard);
}

// Pine-needle spikes along the back edge of a blade (same local frame as makeBladeMesh)
function makeSpikes(len, mat, zOffset) {
  const group = new THREE.Group();
  const SPIKES = 6;
  for (let i = 0; i < SPIKES; i++) {
    const t = 0.12 + (i / (SPIKES - 1)) * 0.8;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.0075, 0.02, 4), mat);
    spike.position.set(0.0055, 0.036, zOffset - len * 0.7 * t);
    spike.rotation.set(0, Math.PI / 4, 0);
    group.add(spike);
  }
  return group;
}

function buildDualKnife(skin, root, spinPivot, { bladeMat, handleMat, accentMat }, opts = {}) {
  // Thrown knife: a single spiked blade
  if (opts.single) {
    spinPivot.add(makeBladeMesh(0.28, bladeMat, -0.06));
    spinPivot.add(makeSpikes(0.28, bladeMat, -0.06));
    return;
  }
  // Right hand: the throwing knife (hidden while it is out; viewmodel.js toggles it by charges)
  const throwHand = new THREE.Group();
  addHilt(throwHand, handleMat, accentMat);
  throwHand.add(makeBladeMesh(0.28, bladeMat, -0.06));
  throwHand.add(makeSpikes(0.28, bladeMat, -0.06));
  spinPivot.add(throwHand);
  root.userData.throwHand = throwHand;
  // Left hand: the melee knife, a little to the left
  const meleeHand = new THREE.Group();
  meleeHand.position.set(-0.13, -0.015, 0.02);
  meleeHand.rotation.set(0, 0, 0.06);
  addHilt(meleeHand, handleMat, accentMat);
  meleeHand.add(makeBladeMesh(0.28, bladeMat, -0.06));
  meleeHand.add(makeSpikes(0.28, bladeMat, -0.06));
  spinPivot.add(meleeHand);
}

function buildAscendantKnife(skin, root, spinPivot, { bladeMat, handleMat, accentMat }, opts = {}) {
  if (skin.type === 'dual') {
    buildDualKnife(skin, root, spinPivot, { bladeMat, handleMat, accentMat }, opts);
    return;
  }
  if (skin.type === 'nunchaku') {
    addHilt(spinPivot, handleMat, accentMat);
    spinPivot.add(makeBladeMesh(0.3, bladeMat, -0.06));
    // Thrown knives are single blades (the chain and second knife stay in hand)
    if (opts.single) return;

    // Chain anchored at the pommel of the held knife; the swing group is driven by a spring in viewmodel.js
    const swing = new THREE.Group();
    swing.position.set(0, 0, 0.13);
    spinPivot.add(swing);

    // Second knife hangs below and slightly to the side, blade pointing forward like the first one,
    // so both blades are visible in first-person
    const SECOND = { x: -0.1, y: -0.03, z: 0.2 };
    const second = new THREE.Group();
    second.position.set(SECOND.x, SECOND.y, SECOND.z - 0.13);
    addHilt(second, handleMat, accentMat);
    second.add(makeBladeMesh(0.26, bladeMat, -0.06));
    swing.add(second);

    // Chain links along the line from the pommel to the second knife's pommel
    const LINKS = 5;
    for (let i = 0; i < LINKS; i++) {
      const t = (i + 0.5) / LINKS;
      const link = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.0035, 8, 14), accentMat);
      link.position.set(SECOND.x * t, SECOND.y * t, SECOND.z * t - 0.13 * t);
      link.rotation.set(t * 0.8, i % 2 ? Math.PI / 2 : 0, 0);
      swing.add(link);
    }
    root.userData.chainSwing = swing;
  } else if (skin.type === 'grapple') {
    addHilt(spinPivot, handleMat, accentMat);
    spinPivot.add(makeBladeMesh(0.3, bladeMat, -0.06));

    // Chain coiled around the grip
    for (let i = 0; i < 5; i++) {
      const link = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.004, 8, 14), accentMat);
      link.position.set(0, 0, -0.01 + i * 0.02);
      spinPivot.add(link);
    }

    // Hook at the pommel
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.007, 8, 18, Math.PI * 1.2), accentMat);
    hook.position.set(0, 0.03, 0.15);
    hook.rotation.z = Math.PI * 0.9;
    spinPivot.add(hook);
  } else if (skin.type === 'poison') {
    addHilt(spinPivot, handleMat, accentMat);
    spinPivot.add(makeBladeMesh(0.3, bladeMat, -0.06));

    const greenMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 1.4, metalness: 0.2, roughness: 0.4
    });
    // Venom channel along the blade's top edge
    const vein = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.003, 0.22), greenMat);
    vein.position.set(0, 0.026, -0.2);
    spinPivot.add(vein);
    // Glowing venom vial under the grip
    const vial = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.04, 10), greenMat);
    vial.position.set(0, -0.04, 0.03);
    spinPivot.add(vial);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.01, 0.016), accentMat);
    cap.position.set(0, -0.065, 0.03);
    spinPivot.add(cap);
  }
}

export function createKnifeMesh(skinId = 'tactical_starter', wrapId = null, opts = {}) {
  const skin = getSkinById(skinId);
  const wrap = getWrapById(wrapId);
  const root = new THREE.Group();
  root.userData.skin = skin;

  const spinPivot = new THREE.Group();
  root.add(spinPivot);
  root.userData.spinPivot = spinPivot;

  const bladeMat = new THREE.MeshStandardMaterial({
    color: skin.bladeColor,
    metalness: 0.82,
    roughness: 0.2,
    emissive: skin.emissive,
    emissiveIntensity: skin.emissiveIntensity
  });

  const edgeMat = new THREE.MeshStandardMaterial({
    color: skin.edgeColor,
    metalness: 0.9,
    roughness: 0.12,
    emissive: skin.glowColor,
    emissiveIntensity: skin.emissiveIntensity * 0.85 + 0.15
  });

  const handleMat = new THREE.MeshStandardMaterial({
    color: skin.handleColor,
    metalness: 0.3,
    roughness: 0.6
  });

  // Knife wrap (fólia) covers the blade and the grip
  applyWrapToMaterial(bladeMat, wrap);
  applyWrapToMaterial(handleMat, wrap, true);

  const accentMat = new THREE.MeshStandardMaterial({
    color: skin.accentColor,
    metalness: 0.75,
    roughness: 0.25,
    emissive: skin.accentColor,
    emissiveIntensity: 0.35
  });

  if (ASCENDANT_TYPES.has(skin.type)) {
    buildAscendantKnife(skin, root, spinPivot, { bladeMat, handleMat, accentMat }, opts);
    return root;
  }

  if (skin.type === 'karambit') {
    spinPivot.position.set(0, -0.02, 0.11);
    const body = new THREE.Group();
    body.position.set(0, 0.02, -0.11);
    spinPivot.add(body);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.008, 12, 24), accentMat);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(0, -0.02, 0.11);
    body.add(ring);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.044, 0.15), handleMat);
    grip.position.set(0, -0.005, 0.025);
    grip.rotation.x = 0.12;
    body.add(grip);

    for (let i = 0; i < 3; i++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.01, 0.016), accentMat);
      rib.position.set(0, -0.022, -0.01 + i * 0.038);
      body.add(rib);
    }

    const shape = new THREE.Shape();
    shape.moveTo(0, 0.02);
    shape.quadraticCurveTo(-0.14, 0.03, -0.27, -0.11);
    shape.quadraticCurveTo(-0.16, -0.04, -0.01, -0.024);
    shape.closePath();

    const extrude = new THREE.ExtrudeGeometry(shape, {
      depth: 0.012,
      bevelEnabled: true,
      bevelThickness: 0.004,
      bevelSize: 0.004,
      bevelSegments: 2
    });
    const blade = new THREE.Mesh(extrude, bladeMat);
    blade.rotation.y = -Math.PI / 2;
    blade.position.set(0.006, 0.005, -0.045);
    body.add(blade);

    const edgeRibbon = new THREE.Mesh(extrude, edgeMat);
    edgeRibbon.rotation.y = -Math.PI / 2;
    edgeRibbon.scale.set(0.96, 0.96, 0.45);
    edgeRibbon.position.set(0.003, 0.001, -0.048);
    body.add(edgeRibbon);
  } else if (skin.type === 'balisong') {
    const safeHandlePivot = new THREE.Group();
    const biteHandlePivot = new THREE.Group();
    safeHandlePivot.position.set(0, 0.016, -0.045);
    biteHandlePivot.position.set(0, -0.016, -0.045);
    spinPivot.add(safeHandlePivot, biteHandlePivot);
    root.userData.safeHandle = safeHandlePivot;
    root.userData.biteHandle = biteHandlePivot;

    const hGeo = new THREE.BoxGeometry(0.022, 0.02, 0.175);
    const safeH = new THREE.Mesh(hGeo, handleMat);
    safeH.position.set(0, 0, 0.088);
    safeHandlePivot.add(safeH);

    const biteH = new THREE.Mesh(hGeo, handleMat);
    biteH.position.set(0, 0, 0.088);
    biteHandlePivot.add(biteH);

    const slotGeo = new THREE.BoxGeometry(0.025, 0.006, 0.12);
    const sSlot = new THREE.Mesh(slotGeo, edgeMat);
    sSlot.position.set(0, 0, 0.09);
    safeHandlePivot.add(sSlot);

    const bSlot = new THREE.Mesh(slotGeo, accentMat);
    bSlot.position.set(0, 0, 0.09);
    biteHandlePivot.add(bSlot);

    const pinGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.028, 12);
    pinGeo.rotateZ(Math.PI / 2);
    const pin1 = new THREE.Mesh(pinGeo, accentMat);
    pin1.position.set(0, 0.016, -0.045);
    const pin2 = new THREE.Mesh(pinGeo, accentMat);
    pin2.position.set(0, -0.016, -0.045);
    spinPivot.add(pin1, pin2);

    const shape = new THREE.Shape();
    shape.moveTo(0, 0.02);
    shape.lineTo(-0.22, 0.012);
    shape.lineTo(-0.31, -0.002);
    shape.lineTo(-0.20, -0.022);
    shape.lineTo(0, -0.02);
    shape.closePath();

    const bladeGeo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.009,
      bevelEnabled: true,
      bevelThickness: 0.004,
      bevelSize: 0.004,
      bevelSegments: 2
    });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.rotation.y = -Math.PI / 2;
    blade.position.set(0.0045, 0, -0.045);
    spinPivot.add(blade);

    const core = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.006, 0.25), edgeMat);
    core.position.set(0, 0, -0.17);
    spinPivot.add(core);
  } else if (skin.type === 'kunai') {
    spinPivot.position.set(0, 0, 0.13);
    const body = new THREE.Group();
    body.position.set(0, 0, -0.13);
    spinPivot.add(body);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.007, 12, 24), accentMat);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(0, 0, 0.13);
    body.add(ring);

    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.15, 12), handleMat);
    grip.rotation.x = Math.PI / 2;
    grip.position.set(0, 0, 0.025);
    body.add(grip);

    const shape = new THREE.Shape();
    shape.moveTo(0, 0.012);
    shape.lineTo(-0.07, 0.046);
    shape.lineTo(-0.31, 0);
    shape.lineTo(-0.07, -0.046);
    shape.lineTo(0, -0.012);
    shape.closePath();

    const bladeGeo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.012,
      bevelEnabled: true,
      bevelThickness: 0.006,
      bevelSize: 0.005,
      bevelSegments: 2
    });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.rotation.y = -Math.PI / 2;
    blade.position.set(0.006, 0, -0.045);
    body.add(blade);

    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.02, 0), edgeMat);
    gem.scale.set(0.7, 0.7, 1.8);
    gem.position.set(0, 0, -0.12);
    body.add(gem);
  } else {
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.038, 0.16), handleMat);
    grip.position.set(0, 0, 0.03);
    spinPivot.add(grip);

    const pommel = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.044, 0.024), accentMat);
    pommel.position.set(0, 0, 0.115);
    spinPivot.add(pommel);

    const guardHeight = skin.type === 'dragon' ? 0.115 : 0.092;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.036, guardHeight, 0.022), accentMat);
    guard.position.set(0, 0, -0.052);
    if (skin.type === 'dragon') guard.rotation.x = 0.2;
    spinPivot.add(guard);

    if (skin.type === 'bayonet') {
      const mRing = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.005, 10, 20), accentMat);
      mRing.position.set(0, 0.048, -0.052);
      spinPivot.add(mRing);
    }

    const shape = new THREE.Shape();
    if (skin.type === 'dragon') {
      shape.moveTo(0, 0.028);
      shape.quadraticCurveTo(-0.15, 0.045, -0.35, 0.008);
      shape.quadraticCurveTo(-0.22, -0.045, -0.08, -0.032);
      shape.lineTo(0, -0.028);
      shape.closePath();
    } else {
      shape.moveTo(0, 0.026);
      shape.lineTo(-0.23, 0.026);
      shape.lineTo(-0.34, -0.004);
      shape.quadraticCurveTo(-0.24, -0.034, -0.14, -0.03);
      shape.lineTo(0, -0.028);
      shape.closePath();
    }

    const bladeGeo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.011,
      bevelEnabled: true,
      bevelThickness: 0.0045,
      bevelSize: 0.0045,
      bevelSegments: 2
    });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.rotation.y = -Math.PI / 2;
    blade.position.set(0.0055, 0, -0.06);
    spinPivot.add(blade);

    const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.009, 0.21), edgeMat);
    fuller.position.set(0, 0.005, -0.18);
    spinPivot.add(fuller);

    if (skin.type === 'bayonet') {
      for (let i = 0; i < 6; i++) {
        const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.007, 0.016, 4), edgeMat);
        tooth.position.set(0, 0.033, -0.09 - i * 0.026);
        tooth.rotation.x = -0.3;
        spinPivot.add(tooth);
      }
    }
  }

  return root;
}
