import * as THREE from 'three';
import { updateWrapTime } from './wraps.js';
import { sfx } from './audio.js';
import { GUN_DEFS, GUN_ORDER, GUN_MODE_MIN_RP, getGunDef, spreadDirection, GUN_DROPBOX, gunAsItem, rollGunDropbox, rpgEmoteAsItem } from './guns.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  RARITY_TIERS,
  KNIFE_SKINS,
  DROPBOXES,
  rollDropbox,
  createDefaultBotMemory,
  loadProfile,
  saveProfile,
  getSkinById,
  createKnifeMesh
} from './skins.js';
import { WRAPS, getWrapById } from './wraps.js';
import { knifeShopValue, knifeBaseSale, wrapSaleBonus, fairValue, blockReason, sellKnife, startHaggle, haggleCounter, haggleAccept, tradeCandidates, tradeKnife, tickKnifeCooldowns, HAGGLE_MAX_COUNTERS } from './market.js';
import { TUTORIAL_REWARD, TUTORIAL_STEPS, tutorialRequired, skipTutorial, completeTutorial } from './tutorial.js';
import {
  BUILTIN_PACKS,
  BUILTIN_PACK_IDS,
  MJ_MAX_BYTES,
  MJ_MAX_IMPORTS,
  validatePack,
  setImportedPacks
} from './emotePacks.js';
import {
  KILL_EFFECTS,
  KNIFE_TRAILS,
  CHARACTER_HATS,
  COSMETIC_DROPBOX,
  rollCosmeticDropbox,
  getKillEffectById,
  getKnifeTrailById,
  getHatById,
  createHatMesh
} from './cosmetics.js';
import { createRobloxHeadTexture } from './textures.js';
import { MAPS, buildArena, resolveArenaPhysics } from './maps.js';
import { RivalCharacter, VICTORY_EMOTES } from './character.js';
import {
  initMultiplayer,
  netMyId,
  netIsHost,
  netSendHit,
  netSendDied,
  netSendAlive,
  netSendAct,
  netSendThrow,
  netRematch,
  netLeaveMatch
} from './multiplayer.js';
import { ViewmodelController } from './viewmodel.js';
import { ParticleSystem } from './particles.js';
import { ProjectileManager } from './projectiles.js';
import { StormController } from './storm.js';
import { DojoController } from './dojo.js';
import {
  ABILITIES,
  ABILITY_DROPBOX,
  rollAbilityDropbox,
  getAbilityById,
  getRankInfo
} from './abilities.js';
import {
  RivalAI,
  updateBotLearningAfterRound,
  getCoachTipForRound
} from './ai.js';

// ================= INITIALIZATION & STATE =================
const profile = loadProfile();
sfx.setVolume(profile.settings.volume);

// ================= v5 QUEUE, THROW & ABILITY CONSTANTS =================
const NORMAL_THROW_RECHARGE = 3.0; // Normál: 3 mp dobás cooldown
const RANKED_THROW_RECHARGE = 0.0; // Ranked: NINCS dobás cooldown (azonnali újradobás)
// Rarity scales the Normal-mode throw recharge: the rarer the knife, the faster it recharges
const RECHARGE_MUL_BY_RARITY = { COMMON: 1.0, RARE: 0.9, EPIC: 0.8, LEGENDARY: 0.65, MYTHIC: 0.55, ASCENDANT: 0.45 };
function knifeRechargeFor(skinId, base) {
  return base * (RECHARGE_MUL_BY_RARITY[getSkinById(skinId).rarityKey] ?? 1);
}
// Nunchaku carries two knives (two charges); every other knife has one
function knifeMaxChargesFor(skinId) {
  const skin = getSkinById(skinId);
  if (skin.type === 'burst') return skin.magazine; // salvo knives: rarity sets the clip size
  return skin.type === 'nunchaku' ? 2 : 1;
}
const RANKED_RP_WIN = 25;
const RANKED_RP_LOSS = 18;
const VAULT_MIN_WALL_H = 0.65; // m, relative to feet
const VAULT_MAX_WALL_H = 2.55; // m
const VAULT_MAX_THICK = 1.6; // thicker blocks are mantled onto instead of vaulted over
const SPRINT_SPEED = 14.2; // m/s, Shift tartva (alap 10.4)
const STAB_RANGE = 2.9; // m, szúrás távolsága (korábban 3.65)
const STAB_CONE_DOT = 0.55; // szúrás kúp szélessége (korábban 0.34)
const VAULT_REACH = 1.25; // m from body edge to wall face

let selectedQueue = 'normal'; // 'normal' | 'ranked'
let matchIsRanked = false;

// Circular ability wheel (in-match) runtime state
const wheel = {
  open: false,
  holdSource: null, // 'tab' | 'q'
  pointerX: 0,
  pointerY: 0,
  hovered: -1,
  qPending: false,
  qHold: 0
};

// Per-ability cooldown timers (id -> seconds left)
const abilityCooldowns = {};

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.autoClear = false;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const worldScene = new THREE.Scene();
// Soft studio reflections on knives, armor and glossy blocks
const pmrem = new THREE.PMREMGenerator(renderer);
const worldEnvTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
worldScene.environment = worldEnvTexture;
worldScene.environmentIntensity = 0.45;

// ================= GRAPHICS QUALITY PRESETS =================
// 'high' is the default and matches the original look. Stronger machines can pick 'ultra'.
const QUALITY_PRESETS = {
  low: { label: 'Low (older PCs)', maxDpr: 1, shadows: false, shadowSize: 0, env: false },
  medium: { label: 'Medium', maxDpr: 1.5, shadows: true, shadowSize: 1024, env: true },
  high: { label: 'High (default)', maxDpr: 2, shadows: true, shadowSize: 2048, env: true },
  ultra: { label: 'Ultra (strong GPUs)', maxDpr: 3, shadows: true, shadowSize: 4096, env: true }
};
let worldDirLight = null; // sun light of the current arena (the shadow caster)

function applyGraphicsQuality() {
  const q = QUALITY_PRESETS[profile.settings.quality] || QUALITY_PRESETS.high;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.maxDpr));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = q.shadows;
  worldScene.environment = q.env ? worldEnvTexture : null;
  if (worldDirLight) {
    worldDirLight.castShadow = q.shadows;
    if (q.shadows) {
      const size = Math.min(q.shadowSize, renderer.capabilities.maxTextureSize);
      if (worldDirLight.shadow.mapSize.x !== size) {
        worldDirLight.shadow.mapSize.set(size, size);
        if (worldDirLight.shadow.map) worldDirLight.shadow.map.dispose();
        if (worldDirLight.shadow.mapPass) worldDirLight.shadow.mapPass.dispose();
        worldDirLight.shadow.map = null; // three.js recreates the target at the new size
        worldDirLight.shadow.mapPass = null;
      }
    }
  }
}
const worldCamera = new THREE.PerspectiveCamera(
  profile.settings.fov,
  window.innerWidth / window.innerHeight,
  0.08,
  190
);

const viewmodel = new ViewmodelController(window.innerWidth / window.innerHeight);
viewmodel.setSkin(profile.equippedSkin, profile.equippedWrap);

const floatingContainer = document.getElementById('floating-texts');
const particles = new ParticleSystem(worldScene, floatingContainer);
const projectiles = new ProjectileManager(worldScene, particles);
const storm = new StormController(worldScene);
const dojo = new DojoController(worldScene);

// Menu 3D Floating Knife Showcase
const menuKnifeGroup = new THREE.Group();
worldScene.add(menuKnifeGroup);
let menuKnifeMesh = null;
function rebuildMenuKnife() {
  while (menuKnifeGroup.children.length > 0) {
    menuKnifeGroup.remove(menuKnifeGroup.children[0]);
  }
  menuKnifeMesh = createKnifeMesh(profile.equippedSkin, profile.equippedWrap);
  menuKnifeMesh.scale.setScalar(4.0);
  menuKnifeGroup.add(menuKnifeMesh);
}
rebuildMenuKnife();

// Menu Bridge Showcase Characters
const playerChar = new RivalCharacter(worldScene, profile.equippedSkin, {
  torsoColor: '#2563eb',
  legsColor: '#1e293b',
  angry: false,
  hatId: profile.equippedHat,
  wrapId: profile.equippedWrap
});
const menuRivalChar = new RivalCharacter(worldScene, 'karambit_crimson', {
  torsoColor: '#e11d48',
  legsColor: '#1e3a8a',
  angry: true,
  hatId: 'hat_samurai'
});
const menuDummyState = {
  pos: new THREE.Vector3(1.55, 2.2, 0),
  vel: new THREE.Vector3(),
  yaw: Math.PI * 0.42,
  pitch: 0,
  dead: false,
  grounded: true,
  sliding: false,
  hasKnife: true,
  throwWindup: 0,
  parryTimer: 0,
  stunTimer: 0
};

// Armory Dedicated 3D Preview Renderer
const armoryCanvas = document.getElementById('armory-canvas');
const armoryRenderer = new THREE.WebGLRenderer({ canvas: armoryCanvas, antialias: true, alpha: true });
armoryRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
armoryRenderer.outputColorSpace = THREE.SRGBColorSpace;
const armoryScene = new THREE.Scene();
const armoryCam = new THREE.PerspectiveCamera(45, 2, 0.05, 10);
armoryCam.position.set(0, 0.08, 0.82);
armoryScene.add(new THREE.AmbientLight(0xffffff, 1.15));
const armoryKey = new THREE.DirectionalLight(0xfffbeb, 2.0);
armoryKey.position.set(1.5, 2, 2);
armoryScene.add(armoryKey);
const armoryRim = new THREE.DirectionalLight(0x00f0ff, 1.4);
armoryRim.position.set(-2, -0.5, -1);
armoryScene.add(armoryRim);
const armoryTurntable = new THREE.Group();
armoryScene.add(armoryTurntable);
let currentArmoryTab = 'knives'; // 'knives' | 'killEffects' | 'trails' | 'hats'
let selectedArmoryItemId = profile.equippedSkin;
let armoryPreviewObj = null;
let armorySpinTrickTimer = 0;

// Game Mode & Arena State
const GAME_MODES = {
  duel_1v1: {
    id: 'duel_1v1',
    btnLabel: '⚔️ START 1v1 MATCH',
    hudSub: '1v1 • FIRST TO 5 WINS',
    desc: 'Classic <strong>1v1 First-to-5 knife duel</strong>. At 4–4 and in the last 20 s, a <strong>Sudden Death shrinking zone</strong> kicks in!'
  },
  ffa_storm: {
    id: 'ffa_storm',
    btnLabel: '🌪️ START FFA STORM ZONE (6 PLAYERS)',
    hudSub: 'FFA ROYALE • LAST ONE STANDING WINS',
    desc: '<strong>Six-player free-for-all</strong> with a shrinking storm zone. Live storm radar, kills heal +35 HP, and bots fight each other too!'
  },
  team_2v2: {
    id: 'team_2v2',
    btnLabel: '🛡️ START 2v2 TEAM MATCH',
    hudSub: '2v2 TEAM • FIRST TO 5 WINS',
    desc: '<strong>2v2 team duel.</strong> Fight 2 rivals with a blue Roblox teammate. Winning 1v2 earns a <strong>match payout</strong> is paid at the end of the game!'
  },
  team_4v4: {
    id: 'team_4v4',
    btnLabel: '🔥 START 4v4 ARENA BRAWL',
    hudSub: '4v4 ARENA • FIRST TO 5 WINS',
    desc: '<strong>4v4 chaotic knife arena</strong> on a wide map. 8 Roblox fighters, flying throws, parries and a teammate Spectator camera!'
  },
  gun_mode: {
    id: 'gun_mode',
    btnLabel: '🔫 START GUN MODE',
    hudSub: 'GUN MODE • FIRST TO 5 WINS',
    desc: '<strong>1v1 gun duel.</strong> Pistol by default, Shotgun and AR from crates. Left click to fire, <strong>R</strong> reload, <strong>Y</strong> switch weapon. Requires <strong>Platinum (500 RP)</strong>.'
  },
  training_dojo: {
    id: 'training_dojo',
    btnLabel: '🎯 ENTER TRAINING DOJO',
    hudSub: 'DOJO • [R] 30 S CHALLENGE • [T] PARRY CANNON',
    desc: '<strong>Aim and movement dojo.</strong> Moving Roblox-head targets, a <strong>[T] auto-parry cannon</strong>, a <strong>[R] 30-second record challenge</strong> and instant knife reloads.'
  }
};

let selectedGameMode = 'duel_1v1';
let selectedMapId = 'blueprint_cad';
let selectedAiMode = 'adaptive';
let arena = buildArena(worldScene, selectedMapId, { wideFFA: false });
worldDirLight = arena.dirLight;
applyGraphicsQuality();

// Dynamic Active Combatants List (Player + AI Bots + Dojo Dummies)
const combatants = [];
const activeBots = []; // { id, name, team, ai, char, state, nametagEl, killEffectId, trailId }
const nametagsLayer = document.getElementById('nametags-layer');

const ROUNDS_TO_WIN = 5;
const ROUND_TIME_LIMIT = 75;

let appMode = 'menu'; // 'menu' | 'playing' | 'paused' | 'matchEnd'
let roundPhase = 'countdown'; // 'countdown' | 'live' | 'roundOver'
// Tutorial: 'lessons' (no enemy, step checks) -> 'duel' (MENTOR) -> null (normal play)
let tutorialPhase = null;
const tut = { step: 0, moved: 0, lx: null, lz: null, wasGrounded: true, duelIn: 0, baseSlash: 0, baseThrow: 0 };
// Knife healing: a knife that heals only works after 2 match wins, and only out of combat
const KNIFE_HEAL_RATE = 5;      // HP/s
const KNIFE_HEAL_MIN_WINS = 2;
const KNIFE_HEAL_QUIET = 4;     // s without any damage in the match
let lastCombatAt = -999;
let roundWinner = null; // 'blue' | 'red' | 'ffa_winner' | 'draw'
let roundShowcaseCombatant = null;
let countdownTimer = 3.0;
let lastCountdownInt = 4;
let roundTimer = ROUND_TIME_LIMIT;
let roundStartElapsed = 0;
let laneRecordedThisRound = false;
let roundEndTimer = 0;
let hitstopTimer = 0;
let slowMoTimer = 0;
let cameraShake = 0;
let spectateIndex = 0;

// FPS Counter
let fpsFrames = 0;
let fpsAccum = 0;
let currentFps = 60;

// Smooth Camera State
let currentCamDist = profile.settings.cameraMode === 'third' ? profile.settings.tpsDistance : 0;
let manualEmoteActive = false;
const cineCamPos = new THREE.Vector3();
const cineLookTarget = new THREE.Vector3();
let cineOrbitTime = 0;
const camCollisionRay = new THREE.Raycaster();

const matchStats = {
  playerScore: 0,
  enemyScore: 0,
  roundNumber: 1,
  kills: 0,
  throwHits: 0,
  parries: 0,
  headshots: 0,
  cashEarned: 0,
  winStreak: 0,
  ffaPlacement: 1
};

// Player Entity
const player = {
  pos: new THREE.Vector3(0, 0, 19.8),
  vel: new THREE.Vector3(),
  yaw: 0,
  pitch: 0,
  radius: 0.5,
  height: 2.1,
  hp: 100,
  maxHp: 100,
  dead: false,
  grounded: true,
  jumpsLeft: 2,
  sliding: false,
  slideTimer: 0,
  slideCd: 0,
  slideDir: new THREE.Vector3(),
  dashing: false,
  dashTimer: 0,
  dashCd: 0,
  dashDir: new THREE.Vector3(),
  hasKnife: true,
  knifeRecharge: 0,
  knifeCharges: 1,
  burstShots: 0, // salvo knife: knives still to fire
  burstTimer: 0,
  knifeMaxCharges: 1,
  knifeMaxRecharge: NORMAL_THROW_RECHARGE,
  lastThrowInstant: false,
  chargingThrow: false,
  chargeDuration: 0,
  slashCd: 0,
  comboStep: 0,
  comboResetTimer: 0,
  parryTimer: 0,
  parryCd: 0,
  // v5 abilities & parkour
  rageTimer: 0,
  chronoTimer: 0,
  speedBoostTimer: 0,
  vaultBoostTimer: 0,
  vaulting: false,
  vaultData: null,
  vaultTilt: 0,
  vaultCandidate: null,
  slamming: false,
  slamAir: 0,
  barrageLeft: 0,
  barrageTimer: 0
};

const playerCombatant = {
  id: 'player',
  name: 'YOU',
  team: 'blue',
  isPlayer: true,
  radarColor: '#00f0ff',
  state: player,
  char: playerChar
};

const keys = {};
let isPointerLocked = false;
let fallbackDragActive = false;
let lastPointerX = 0;
let lastPointerY = 0;

// ================= DOM REFERENCES =================
const elMainMenu = document.getElementById('main-menu');
const elHud = document.getElementById('hud');
const elDropboxModal = document.getElementById('dropbox-modal');
const elArmoryModal = document.getElementById('armory-modal');
const elPauseModal = document.getElementById('pause-modal');
const elMatchEndModal = document.getElementById('match-end-modal');

const elFxHurt = document.getElementById('fx-hurt');
const elFxParry = document.getElementById('fx-parry');
const elFxSpeed = document.getElementById('fx-speed');
const elFxHeadshot = document.getElementById('fx-headshot');
const elFxStorm = document.getElementById('fx-storm');

const elHudLeftLabel = document.getElementById('hud-left-label');
const elPlayerScore = document.getElementById('player-score');
const elEnemyScore = document.getElementById('enemy-score');
const elPlayerPips = document.getElementById('player-pips');
const elEnemyPips = document.getElementById('enemy-pips');
const elRoundLabel = document.getElementById('round-label');
const elRoundTimer = document.getElementById('round-timer');
const elHudModeSub = document.getElementById('hud-mode-sub');
const elHudRivalName = document.getElementById('hud-rival-name');

const elStormAlertPill = document.getElementById('storm-alert-pill');
const elStormRadarWrap = document.getElementById('storm-radar-wrap');
const elStormRadarCanvas = document.getElementById('storm-radar');
const elRadarAliveTxt = document.getElementById('radar-alive-txt');

const elDojoHudBar = document.getElementById('dojo-hud-bar');
const elDojoStatusTxt = document.getElementById('dojo-status-txt');
const elDojoBestVal = document.getElementById('dojo-best-val');

const elSpectatorPill = document.getElementById('spectator-pill');
const elSpecName = document.getElementById('spec-name');

const elHudCashVal = document.getElementById('hud-cash-val');
const elHudFpsPill = document.getElementById('hud-fps-pill');
const elHudHsVal = document.getElementById('hud-hs-val');
const elHudCamPill = document.getElementById('hud-cam-pill');
const elHudStreakPill = document.getElementById('hud-streak-pill');
const elKillfeed = document.getElementById('killfeed');

const elCrosshair = document.getElementById('crosshair');
const elChargeBar = document.getElementById('charge-bar');
const elHitmarker = document.getElementById('hitmarker');
const elKnifeReloadPill = document.getElementById('knife-reload-pill');

const elRoundBanner = document.getElementById('round-banner');
const elBannerMain = document.getElementById('banner-main');
const elBannerSub = document.getElementById('banner-sub');

const elCoachBanner = document.getElementById('coach-banner');
const elCoachText = document.getElementById('coach-text');

const elPlayerHpText = document.getElementById('player-hp-text');
const elPlayerHpFill = document.getElementById('player-hp-fill');
const elPlayerHpTrail = document.getElementById('player-hp-trail');

const elSlotSlashLabel = document.getElementById('slot-slash-label');
const elCdThrow = document.getElementById('cd-throw');
const elCdParry = document.getElementById('cd-parry');
// v5: dash cooldown is shown on the Q ability slot (#cd-ability); keep a safe fallback element
const elCdDash = document.getElementById('cd-dash') || document.createElement('div');
const elSlotParry = document.getElementById('slot-parry');

// v5 HUD / menu refs
const elSlotThrowLabel = document.getElementById('slot-throw-label');
const elHudQueuePill = document.getElementById('hud-queue-pill');
const elBuffPill = document.getElementById('active-buff-pill');
const elFxRage = document.getElementById('fx-rage');
const elVaultPrompt = document.getElementById('vault-prompt-pill');
const elAbIcon = document.getElementById('hud-ab-icon');
const elAbTitle = document.getElementById('hud-ab-title');
const elCdAbility = document.getElementById('cd-ability');
const elRadialOverlay = document.getElementById('radial-wheel-overlay');
const elRadialNodes = [0, 1, 2, 3].map((i) => document.getElementById(`rnode-${i}`));
const elRcPointer = document.getElementById('rc-pointer');
const elRcSub = document.getElementById('rc-sub');
const elQueueNormal = document.getElementById('btn-queue-normal');
const elQueueRanked = document.getElementById('btn-queue-ranked');
const elRankChip = document.getElementById('stat-rank-chip');
const elMenuWheelStrip = document.getElementById('menu-wheel-strip');
const elWheelModal = document.getElementById('wheel-modal');
const elAbilityCatalog = document.getElementById('ability-catalog-grid');
const elEditorCenter = document.getElementById('editor-center-label');
const WHEEL_SLOT_NAMES = ['1. TOP SLOT', '2. RIGHT SLOT', '3. BOTTOM SLOT', '4. LEFT SLOT'];
let wheelEditorSlot = 0;

// ================= ECONOMY & FULLSCREEN HELPERS =================
function awardCash(amount) {
  profile.cash += amount;
  matchStats.cashEarned += amount;
  saveProfile(profile);
  elHudCashVal.textContent = profile.cash;
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.().catch(() => {});
  }
}

document.getElementById('btn-fullscreen').addEventListener('click', toggleFullscreen);
document.getElementById('btn-pause-fullscreen').addEventListener('click', toggleFullscreen);

// ================= UNIFIED SENSITIVITY, CAMERA & EMOTE CONTROLS =================
const sliderSens = document.getElementById('slider-sens');
const inpPauseSens = document.getElementById('inp-pause-sens');
const sliderMenuSens = document.getElementById('slider-menu-sens');
const inpMenuSens = document.getElementById('inp-menu-sens');

function setSensitivity(rawVal) {
  const clamped = Math.max(0.1, Math.min(3.5, Math.round(parseFloat(rawVal || 1.0) * 100) / 100));
  profile.settings.sensitivity = clamped;
  saveProfile(profile);

  sliderSens.value = String(clamped);
  inpPauseSens.value = clamped.toFixed(2);
  sliderMenuSens.value = String(clamped);
  inpMenuSens.value = clamped.toFixed(2);
}

sliderSens.addEventListener('input', () => setSensitivity(sliderSens.value));
sliderMenuSens.addEventListener('input', () => setSensitivity(sliderMenuSens.value));
inpPauseSens.addEventListener('change', () => setSensitivity(inpPauseSens.value));
inpMenuSens.addEventListener('change', () => setSensitivity(inpMenuSens.value));

document.getElementById('btn-pause-sens-dec').addEventListener('click', () => setSensitivity(profile.settings.sensitivity - 0.05));
document.getElementById('btn-pause-sens-inc').addEventListener('click', () => setSensitivity(profile.settings.sensitivity + 0.05));
document.getElementById('btn-menu-sens-dec').addEventListener('click', () => setSensitivity(profile.settings.sensitivity - 0.05));
document.getElementById('btn-menu-sens-inc').addEventListener('click', () => setSensitivity(profile.settings.sensitivity + 0.05));

function setCameraMode(mode) {
  profile.settings.cameraMode = mode === 'third' ? 'third' : 'first';
  if (profile.settings.cameraMode === 'third' && profile.settings.tpsDistance < 1.8) {
    profile.settings.tpsDistance = 3.6;
  }
  saveProfile(profile);
  syncCameraUI();
}

function toggleCameraMode() {
  sfx.playInspectClick();
  setCameraMode(profile.settings.cameraMode === 'first' ? 'third' : 'first');
}

function syncCameraUI() {
  const isThird = profile.settings.cameraMode === 'third';
  document.getElementById('btn-cam-first').classList.toggle('active', !isThird);
  document.getElementById('btn-cam-third').classList.toggle('active', isThird);
  document.getElementById('btn-pause-cam-first').classList.toggle('active', !isThird);
  document.getElementById('btn-pause-cam-third').classList.toggle('active', isThird);

  elHudCamPill.textContent = isThird
    ? '🎥 [F2 / V] Third-person (TPS)'
    : '👁️ [F1 / V] First-person (FPS)';
}

document.getElementById('btn-cam-first').addEventListener('click', () => { sfx.playInspectClick(); setCameraMode('first'); });
document.getElementById('btn-cam-third').addEventListener('click', () => { sfx.playInspectClick(); setCameraMode('third'); });
document.getElementById('btn-pause-cam-first').addEventListener('click', () => { sfx.playInspectClick(); setCameraMode('first'); });
document.getElementById('btn-pause-cam-third').addEventListener('click', () => { sfx.playInspectClick(); setCameraMode('third'); });

const menuEmoteSelect = document.getElementById('menu-emote-select');
const pauseEmoteSelect = document.getElementById('pause-emote-select');
setImportedPacks(profile.importedPacks || []);

// Owned dance packs: shop packs bought in the Armory plus imported .mj packs
function isEmoteOwned(packId) {
  return profile.unlockedEmotePacks.includes(packId) || profile.importedPacks.some((p) => p.id === packId);
}

function getOwnedEmoteOptions() {
  const builtin = BUILTIN_PACKS.filter((p) => isEmoteOwned(p.id)).map((p) => ({ id: `mj:${p.id}`, name: p.name }));
  if (isEmoteOwned('rpg_launch')) builtin.push({ id: 'rpg_launch', name: '🚀 RPG Launch (Gun Mode)' });
  const imported = profile.importedPacks
    .filter((p) => !BUILTIN_PACK_IDS.includes(p.id))
    .map((p) => ({ id: `mj:${p.id}`, name: `📦 ${p.name}` }));
  return [...builtin, ...imported];
}

function populateEmoteSelects() {
  const options = [...VICTORY_EMOTES, ...getOwnedEmoteOptions()];
  [menuEmoteSelect, pauseEmoteSelect].forEach((sel) => {
    sel.innerHTML = '';
    options.forEach((em) => {
      const opt = document.createElement('option');
      opt.value = em.id;
      opt.textContent = em.name;
      if (em.id === profile.settings.victoryEmote) opt.selected = true;
      sel.appendChild(opt);
    });
  });
}

function setVictoryEmote(emoteId) {
  profile.settings.victoryEmote = emoteId;
  saveProfile(profile);
  populateEmoteSelects();
  if (appMode === 'menu') {
    playerChar.playEmote(emoteId);
  }
}

menuEmoteSelect.addEventListener('change', () => {
  sfx.playInspectClick();
  setVictoryEmote(menuEmoteSelect.value);
});
pauseEmoteSelect.addEventListener('change', () => {
  sfx.playInspectClick();
  setVictoryEmote(pauseEmoteSelect.value);
});
document.getElementById('btn-preview-emote').addEventListener('click', () => {
  sfx.init();
  sfx.playInspectClick();
  playerChar.playEmote(profile.settings.victoryEmote);
});

const chkShowFps = document.getElementById('chk-show-fps');
chkShowFps.checked = profile.settings.showFps !== false;
elHudFpsPill.classList.toggle('hidden', !chkShowFps.checked);
chkShowFps.addEventListener('change', () => {
  profile.settings.showFps = chkShowFps.checked;
  elHudFpsPill.classList.toggle('hidden', !chkShowFps.checked);
  saveProfile(profile);
});

setSensitivity(profile.settings.sensitivity);
syncCameraUI();
populateEmoteSelects();

// ================= GAME MODE & MENU UI =================
function selectGameMode(modeId) {
  if (modeId === 'gun_mode' && !isGunModeUnlocked()) { showGunModeLocked(); return; }
  selectedGameMode = GAME_MODES[modeId] ? modeId : 'duel_1v1';
  const cfg = GAME_MODES[selectedGameMode];
  if (selectedQueue === 'ranked' && selectedGameMode !== 'duel_1v1') selectedQueue = 'normal';
  syncQueueButtons();

  document.querySelectorAll('#gamemode-pills .mode-pill').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === selectedGameMode);
  });

  document.getElementById('mode-desc-text').innerHTML = cfg.desc;
  document.getElementById('btn-start-match').textContent =
    selectedQueue === 'ranked' ? '🏆 START RANKED 1v1' : cfg.btnLabel;
  document.getElementById('diff-selector-group').style.opacity = selectedGameMode === 'training_dojo' ? '0.45' : '1';
  refreshGunSelect();
}

document.querySelectorAll('#gamemode-pills .mode-pill').forEach((btn) => {
  btn.addEventListener('click', () => {
    sfx.init();
    sfx.playInspectClick();
    selectGameMode(btn.dataset.mode);
  });
});

function refreshMenuProfileUI() {
  document.getElementById('stat-cash').textContent = profile.cash;
  document.getElementById('stat-wins').textContent = profile.stats.wins;
  document.getElementById('stat-ffa-wins').textContent = profile.stats.ffaWins || 0;
  const elStatHs = document.getElementById('stat-headshots');
  if (elStatHs) elStatHs.textContent = profile.stats.headshots;
  document.getElementById('stat-bot-lvl').textContent = profile.botMemory.level;
  document.getElementById('armory-cash').textContent = profile.cash;
  document.getElementById('dropbox-cash').textContent = profile.cash;
  elHudCashVal.textContent = profile.cash;

  const eq = getSkinById(profile.equippedSkin);
  document.getElementById('equipped-skin-short').textContent = eq.name.split(':')[0];

  // Mini Cosmetics Loadout Strip
  document.getElementById('mini-killfx').textContent = getKillEffectById(profile.equippedKillEffect).name;
  document.getElementById('mini-trail').textContent = getKnifeTrailById(profile.equippedTrail).name;
  document.getElementById('mini-hat').textContent = getHatById(profile.equippedHat).name;

  const rankInfo = getRankInfo(profile.rankedRp);
  elRankChip.textContent = `${rankInfo.icon} ${rankInfo.name} • ${profile.rankedRp} RP`;
  elRankChip.style.color = rankInfo.color;
  renderMenuWheelStrip();
  syncQueueButtons();

  const bm = profile.botMemory;
  const roleTitle =
    bm.level === 1
      ? 'Training Sparring Partner'
      : bm.level <= 3
      ? 'Learning Duelist'
      : bm.level <= 6
      ? 'Veteran Rival'
      : 'Master Adaptive AI';
  document.getElementById('menu-bot-title').textContent = `Level ${bm.level} • ${roleTitle}`;
  document.getElementById('menu-bot-elo').textContent = `IQ: ${Math.round(bm.elo)}`;
  document.getElementById('menu-bot-xp').style.width = `${Math.min(100, bm.xp)}%`;
  document.getElementById('menu-bot-summary').textContent = bm.lastAdaptSummary;
  document.getElementById('chk-coach-tips').checked = bm.coachTipsEnabled;
}

document.getElementById('chk-coach-tips').addEventListener('change', (e) => {
  profile.botMemory.coachTipsEnabled = e.target.checked;
  saveProfile(profile);
});

document.getElementById('btn-reset-bot').addEventListener('click', () => {
  sfx.playInspectClick();
  profile.botMemory = createDefaultBotMemory();
  saveProfile(profile);
  refreshMenuProfileUI();
});

function renderMapCards() {
  const container = document.getElementById('map-cards');
  container.innerHTML = '';
  MAPS.forEach((m) => {
    const btn = document.createElement('button');
    btn.className = 'map-card' + (m.id === selectedMapId ? ' active' : '');
    btn.innerHTML = `
      <div class="map-badge">${m.badge}</div>
      <div class="map-title">${m.name}</div>
      <div class="map-sub">${m.subtitle}</div>
    `;
    btn.addEventListener('click', () => {
      sfx.playInspectClick();
      selectedMapId = m.id;
      renderMapCards();
      rebuildWorldArena(false);
    });
    container.appendChild(btn);
  });
}

function rebuildWorldArena(wideFFA = false) {
  if (arena) arena.dispose();
  projectiles.clear();
  particles.clear();
  storm.stop();
  arena = buildArena(worldScene, selectedMapId, { wideFFA });
  worldDirLight = arena.dirLight;
  applyGraphicsQuality();
}

document.querySelectorAll('#diff-buttons .diff-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    sfx.playInspectClick();
    document.querySelectorAll('#diff-buttons .diff-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    selectedAiMode = btn.dataset.diff;
  });
});

// ================= RNG DROPBOXES (3 KNIFE BOXES + 1 COSMETIC FX/TRAIL/HAT BOX!) =================
const ALL_CRATES = [...DROPBOXES, ABILITY_DROPBOX, COSMETIC_DROPBOX, GUN_DROPBOX]; // 6 crates total
let selectedBoxId = ALL_CRATES[0].id;
let isSpinningDropbox = false;
let lastUnboxedItem = null;

function openDropboxModal() {
  if (isSpinningDropbox) return;
  elArmoryModal.classList.add('hidden');
  elMatchEndModal.classList.add('hidden');
  elDropboxModal.classList.remove('hidden');
  document.getElementById('unbox-result-panel').classList.add('hidden');
  refreshMenuProfileUI();
  renderCrateCards();
  populateIdleReelPreview();
}

function renderCrateCards() {
  const row = document.getElementById('crate-cards');
  row.innerHTML = '';
  ALL_CRATES.forEach((box) => {
    const active = box.id === selectedBoxId;
    const div = document.createElement('div');
    div.className = 'crate-card' + (active ? ' active' : '');
    if (active) div.style.borderColor = box.color;
    div.innerHTML = `
      <div class="crate-card-head">
        <span style="color:${box.color}">${box.name}</span>
        <span class="crate-price">$${box.price}</span>
      </div>
      <div class="crate-desc">${box.desc}</div>
    `;
    div.addEventListener('click', () => {
      if (isSpinningDropbox) return;
      sfx.playInspectClick();
      selectedBoxId = box.id;
      renderCrateCards();
      populateIdleReelPreview();
    });
    row.appendChild(div);
  });

  const curBox = ALL_CRATES.find((b) => b.id === selectedBoxId) || ALL_CRATES[0];
  const spinBtn = document.getElementById('btn-spin-box');
  spinBtn.textContent =
    profile.cash >= curBox.price
      ? `🎲 OPEN ${curBox.name.toUpperCase()} ($${curBox.price})`
      : `🔒 NOT ENOUGH CASH ($${curBox.price} needed, play a match!)`;
  spinBtn.disabled = profile.cash < curBox.price || isSpinningDropbox;

  const oddsBar = document.getElementById('odds-bar');
  oddsBar.innerHTML = Object.entries(curBox.weights)
    .filter(([, w]) => w > 0)
    .map(([rKey, w]) => {
      const t = RARITY_TIERS[rKey];
      return `<span style="color:${t.color}">● ${t.label}: ${w}%</span>`;
    })
    .join(' &nbsp;|&nbsp; ');
}

function buildReelIcon(item) {
  if (item.icon) return item.icon;
  if (item.type === 'karambit') return '🌙';
  if (item.type === 'balisong') return '🦋';
  if (item.type === 'kunai') return '💠';
  if (item.type === 'dragon') return '🐉';
  if (item.type === 'bayonet') return '🗡️';
  return '🔪';
}

function renderReelDOM(items) {
  const strip = document.getElementById('roulette-strip');
  strip.innerHTML = '';
  strip.style.transform = 'translateX(0px)';
  items.forEach((item) => {
    const el = document.createElement('div');
    el.className = 'reel-item';
    el.style.borderBottomColor = item.rarityColor;
    el.innerHTML = `
      <div class="reel-rarity" style="color:${item.rarityColor}">${item.rarity}</div>
      <div class="reel-icon">${buildReelIcon(item)}</div>
      <div class="reel-name">${item.name}</div>
    `;
    strip.appendChild(el);
  });
}

function populateIdleReelPreview() {
  const curBox = ALL_CRATES.find((b) => b.id === selectedBoxId) || ALL_CRATES[0];
  const { reelItems } = rollCrateResult(curBox);
  renderReelDOM(reelItems.slice(0, 14));
}

function spinSelectedDropbox() {
  if (isSpinningDropbox) return;
  const curBox = ALL_CRATES.find((b) => b.id === selectedBoxId) || ALL_CRATES[0];
  if (profile.cash < curBox.price) {
    sfx.playHurt();
    return;
  }

  profile.cash -= curBox.price;
  profile.stats.boxesOpened = (profile.stats.boxesOpened || 0) + 1;
  saveProfile(profile);
  refreshMenuProfileUI();

  isSpinningDropbox = true;
  document.getElementById('unbox-result-panel').classList.add('hidden');
  renderCrateCards();

  const { winner, reelItems, winnerIndex } = rollCrateResult(curBox);
  renderReelDOM(reelItems);

  const strip = document.getElementById('roulette-strip');
  const viewport = document.getElementById('roulette-viewport');
  const vpWidth = viewport.clientWidth || 760;

  const cardCenterX = 78 + winnerIndex * 140;
  const suspenseJitter = (Math.random() - 0.5) * 68;
  const targetTranslateX = vpWidth / 2 - cardCenterX + suspenseJitter;

  const durationMs = 4200;
  const startTime = performance.now();
  let lastTickIndex = -1;

  function animateSpin(now) {
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / durationMs);
    const ease = 1 - Math.pow(1 - t, 4.2);
    const curX = targetTranslateX * ease;
    strip.style.transform = `translateX(${curX}px)`;

    const needleRelX = vpWidth / 2 - curX - 12;
    const cardIdx = Math.floor(needleRelX / 140);
    if (cardIdx !== lastTickIndex && cardIdx >= 0) {
      lastTickIndex = cardIdx;
      sfx.playCaseTick(0.85 + t * 0.35);
    }

    if (t < 1) {
      requestAnimationFrame(animateSpin);
    } else {
      finishDropboxSpin(winner);
    }
  }

  requestAnimationFrame(animateSpin);
}

function isItemUnlocked(item) {
  if (item.category === 'killEffect') return profile.unlockedKillEffects.includes(item.id);
  if (item.category === 'trail') return profile.unlockedTrails.includes(item.id);
  if (item.category === 'ability') return profile.unlockedAbilities.includes(item.id);
  if (item.category === 'hat') return profile.unlockedHats.includes(item.id);
  if (item.category === 'gun') return profile.unlockedGuns.includes(item.id) || getGunDef(item.id).free;
  if (item.category === 'wrap') return item.id === 'wrap_none' || profile.unlockedWraps.includes(item.id);
  if (item.category === 'emote') return isEmoteOwned(item.id);
  return profile.unlockedSkins.includes(item.id);
}

function unlockItemInProfile(item) {
  if (item.category === 'killEffect') profile.unlockedKillEffects.push(item.id);
  else if (item.category === 'trail') profile.unlockedTrails.push(item.id);
  else if (item.category === 'ability') {
    if (!profile.unlockedAbilities.includes(item.id)) profile.unlockedAbilities.push(item.id);
    autoSlotAbility(item.id);
  } else if (item.category === 'hat') profile.unlockedHats.push(item.id);
  else if (item.category === 'gun') {
    if (!profile.unlockedGuns.includes(item.id)) profile.unlockedGuns.push(item.id);
  } else if (item.category === 'wrap') {
    if (!profile.unlockedWraps.includes(item.id)) profile.unlockedWraps.push(item.id);
  } else if (item.category === 'emote') {
    if (!profile.unlockedEmotePacks.includes(item.id)) profile.unlockedEmotePacks.push(item.id);
  } else profile.unlockedSkins.push(item.id);
}

function equipAnyItem(item) {
  if (item.category === 'ability') {
    autoSlotAbility(item.id);
    saveProfile(profile);
    refreshMenuProfileUI();
    return;
  }
  if (item.category === 'killEffect') {
    profile.equippedKillEffect = item.id;
  } else if (item.category === 'trail') {
    profile.equippedTrail = item.id;
  } else if (item.category === 'hat') {
    profile.equippedHat = item.id;
    playerChar.setHat(item.id);
  } else if (item.category === 'wrap') {
    profile.equippedWrap = item.id;
    equipPlayerSkin(profile.equippedSkin); // rebuilds the knife with the new wrap
  } else if (item.category === 'emote') {
    profile.settings.victoryEmote = item.emoteKey || `mj:${item.id}`;
    populateEmoteSelects();
  } else if (item.category === 'gun') {
    // Gun items never touch the knife skin: they only set the Gun Mode weapon
    profile.equippedGun = item.id;
    refreshGunSelect();
    syncGunVisuals();
  } else {
    equipPlayerSkin(item.id);
  }
  saveProfile(profile);
  refreshMenuProfileUI();
}

function finishDropboxSpin(winner) {
  isSpinningDropbox = false;
  lastUnboxedItem = winner;

  const rInfo = RARITY_TIERS[winner.rarityKey] || RARITY_TIERS.COMMON;
  sfx.playCaseUnbox(rInfo.tierIndex);

  const alreadyOwned = isItemUnlocked(winner);
  let noteText = '🎉 NEW ITEM UNLOCKED! Added to your collection!';
  if (alreadyOwned) {
    const refund = rInfo.dupeRefund;
    profile.cash += refund;
    noteText = `Already owned → duplicate refund: +$${refund}!`;
  } else {
    unlockItemInProfile(winner);
    if (winner.category === 'gun') {
      noteText = '🎉 NEW WEAPON! Pick it in Gun Mode (Platinum rank).';
    } else if (winner.id === 'rpg_launch') {
      noteText = '🎉 NEW EMOTE! Press P in Gun Mode (or set it as your victory pose).';
    } else if (winner.category === 'ability') {
      noteText = profile.abilityWheel.includes(winner.id)
        ? '🎉 NEW ABILITY! Auto-loaded into the wheel!'
        : '🎉 NEW ABILITY! The wheel is full, swap one in the menu (🎡 Ability Wheel).';
    }
  }
  saveProfile(profile);
  refreshMenuProfileUI();
  renderCrateCards();

  const resPanel = document.getElementById('unbox-result-panel');
  const rBadge = document.getElementById('unbox-rarity');
  rBadge.textContent = winner.rarity;
  rBadge.style.color = winner.rarityColor;
  document.getElementById('unbox-name').textContent = winner.name;
  document.getElementById('unbox-note').textContent = noteText;
  resPanel.style.borderColor = winner.rarityColor;
  resPanel.classList.remove('hidden');
}

document.getElementById('btn-open-dropbox').addEventListener('click', () => {
  sfx.init();
  sfx.playInspectClick();
  openDropboxModal();
});
document.getElementById('btn-end-dropbox').addEventListener('click', () => {
  elMatchEndModal.classList.add('hidden');
  returnToMainMenu();
  openDropboxModal();
});
document.getElementById('btn-armory-to-dropbox').addEventListener('click', () => {
  openDropboxModal();
});
document.getElementById('btn-close-dropbox').addEventListener('click', () => {
  if (isSpinningDropbox) return;
  elDropboxModal.classList.add('hidden');
});
document.getElementById('btn-spin-box').addEventListener('click', () => {
  sfx.init();
  spinSelectedDropbox();
});
document.getElementById('btn-equip-unboxed').addEventListener('click', () => {
  if (!lastUnboxedItem) return;
  equipAnyItem(lastUnboxedItem);
  sfx.playKnifePickup();
  document.getElementById('unbox-note').textContent = '✓ Equipped as active!';
});

// ================= 4-TAB UNIFIED ARMORY / FELSZERELÉS =================
function getItemsForTab(tab) {
  if (tab === 'killEffects') return KILL_EFFECTS;
  if (tab === 'trails') return KNIFE_TRAILS;
  if (tab === 'hats') return CHARACTER_HATS;
  if (tab === 'wraps') return WRAPS;
  if (tab === 'emotes') return getEmoteArmoryItems();
  return KNIFE_SKINS;
}

function getEquippedIdForTab(tab) {
  if (tab === 'killEffects') return profile.equippedKillEffect;
  if (tab === 'trails') return profile.equippedTrail;
  if (tab === 'hats') return profile.equippedHat;
  if (tab === 'wraps') return profile.equippedWrap;
  if (tab === 'emotes') {
    const cur = profile.settings.victoryEmote || '';
    return cur.startsWith('mj:') ? cur.slice(3) : null;
  }
  return profile.equippedSkin;
}

function switchArmoryTab(tab) {
  currentArmoryTab = tab;
  document.querySelectorAll('#armory-tabs .armory-tab').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  const items = getItemsForTab(tab);
  const unlockedCount = items.filter((it) => isItemUnlocked(it)).length;
  document.getElementById('inv-count').textContent = `${unlockedCount}/${items.length}`;
  updateArmorySelection(getEquippedIdForTab(tab));
}

document.querySelectorAll('#armory-tabs .armory-tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    sfx.playInspectClick();
    switchArmoryTab(btn.dataset.tab);
  });
});

function openArmory() {
  elArmoryModal.classList.remove('hidden');
  resizeArmoryCanvas();
  switchArmoryTab(currentArmoryTab);
}

function resizeArmoryCanvas() {
  const rect = armoryCanvas.getBoundingClientRect();
  const w = Math.max(260, rect.width || 360);
  const h = Math.max(180, rect.height || 210);
  armoryRenderer.setSize(w, h, false);
  armoryCam.aspect = w / h;
  armoryCam.updateProjectionMatrix();
}

function buildArmory3DPreview(item) {
  while (armoryTurntable.children.length > 0) {
    armoryTurntable.remove(armoryTurntable.children[0]);
  }
  armorySpinTrickTimer = 0;

  if (currentArmoryTab === 'hats') {
    // 3D Classic Yellow Roblox Head Mannequin wearing the selected Hat!
    const headGroup = new THREE.Group();
    headGroup.position.set(0, -0.14, 0);
    headGroup.scale.setScalar(0.56);

    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xf5cd30, roughness: 0.42 });
    const faceMat = new THREE.MeshStandardMaterial({
      map: createRobloxHeadTexture({ skinColor: '#f5cd30', angry: false }),
      roughness: 0.42
    });
    const headCyl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.29, 0.29, 0.48, 28),
      [faceMat, yellowMat, yellowMat]
    );
    headCyl.position.set(0, 0.29, 0);
    headGroup.add(headCyl);

    const hatMesh = createHatMesh(item.id);
    headGroup.add(hatMesh);
    armoryTurntable.add(headGroup);
    armoryPreviewObj = headGroup;
    return;
  }

  // Knife + optional Trail / Kill FX Halo Ring!
  const wrap = new THREE.Group();
  // On the Wraps tab, show the equipped knife wearing the selected wrap
  const knife = createKnifeMesh(
    currentArmoryTab === 'knives' ? item.id : profile.equippedSkin,
    currentArmoryTab === 'wraps' ? item.id : profile.equippedWrap
  );
  knife.scale.setScalar(1.8);
  knife.rotation.set(0.15, Math.PI * 0.52, -0.15);
  wrap.add(knife);

  if (currentArmoryTab === 'trails' || currentArmoryTab === 'killEffects') {
    const ringCol = item.color || new THREE.Color(item.rarityColor).getHex();
    const aura = new THREE.Mesh(
      new THREE.TorusGeometry(0.27, 0.014, 12, 36),
      new THREE.MeshBasicMaterial({ color: ringCol })
    );
    aura.rotation.x = Math.PI * 0.35;
    wrap.add(aura);
    wrap.userData.rainbowRing = item.rainbow ? aura : null;
  }

  armoryTurntable.add(wrap);
  armoryPreviewObj = knife;
}

function updateArmorySelection(itemId) {
  const items = getItemsForTab(currentArmoryTab);
  const item = items.find((x) => x.id === itemId) || items[0];
  selectedArmoryItemId = item.id;

  buildArmory3DPreview(item);

  const rEl = document.getElementById('armory-sel-rarity');
  rEl.textContent = item.rarity;
  rEl.style.color = item.rarityColor;
  document.getElementById('armory-sel-name').textContent = item.name;
  document.getElementById('armory-sel-desc').textContent = item.category === 'wrap' ? wrapDescText(item) : item.desc;

  const actBtn = document.getElementById('btn-armory-action');
  const unlocked = isItemUnlocked(item);
  const equipped = getEquippedIdForTab(currentArmoryTab) === item.id;

  if (equipped) {
    actBtn.textContent = '✓ EQUIPPED';
    actBtn.className = 'btn-equip-main';
  } else if (unlocked) {
    actBtn.textContent = 'EQUIP';
    actBtn.className = 'btn-equip-main';
  } else if (item.category === 'emote') {
    const canAfford = profile.cash >= item.price;
    actBtn.textContent = canAfford ? `🛒 BUY · $${item.price}` : `🔒 NEED $${item.price} · WIN MATCHES`;
    actBtn.className = canAfford ? 'btn-equip-main' : 'btn-equip-main locked';
  } else if (item.category === 'wrap') {
    const canAfford = profile.cash >= item.price;
    actBtn.textContent = canAfford
      ? `🛒 BUY · $${item.price}`
      : `🔒 $${item.price} · OR OPEN A DROPBOX`;
    actBtn.className = canAfford ? 'btn-equip-main' : 'btn-equip-main locked';
  } else {
    actBtn.textContent = item.category
      ? '🔒 UNLOCK FROM THE EFFECT CRATE ($180)!'
      : '🔒 UNLOCK FROM A KNIFE DROPBOX!';
    actBtn.className = 'btn-equip-main locked';
  }

  renderArmoryGrid();
}

function wrapDescText(item) {
  if (item.pattern === 'none') return item.desc;
  const box = DROPBOXES.find((b) => b.id === item.boxId);
  return `${item.desc} Buy it directly for $${item.price} (1.75× the price of ${box ? box.name : 'its dropbox'}), or get it from that dropbox.`;
}

function renderArmoryGrid() {
  const grid = document.getElementById('skin-grid');
  grid.innerHTML = '';
  // Exclusive items (tutorial rewards) stay hidden until you own them
  const items = getItemsForTab(currentArmoryTab).filter((it) => !it.exclusive || isItemUnlocked(it));
  const eqId = getEquippedIdForTab(currentArmoryTab);

  items.forEach((item) => {
    const unlocked = isItemUnlocked(item);
    const equipped = eqId === item.id;
    const card = document.createElement('div');
    card.className = 'skin-card' + (selectedArmoryItemId === item.id ? ' selected' : '');
    card.innerHTML = `
      <div class="skin-card-top">
        <span style="color:${item.rarityColor}">${item.rarity}</span>
        <span>${equipped ? '✓ ACTIVE' : unlocked ? 'OWNED' : (item.category === 'wrap' || item.category === 'emote') ? `🛒 $${item.price}` : '🔒 DROPBOX'}</span>
      </div>
      <div class="skin-card-name">${item.name}</div>
      <div class="skin-card-status">${unlocked ? 'Click to select' : item.category === 'wrap' ? 'Buy or drop it' : item.category === 'emote' ? 'Buy or import .mj' : 'Spin it from a crate!'}</div>
    `;
    card.addEventListener('click', () => {
      sfx.playInspectClick();
      updateArmorySelection(item.id);
    });
    grid.appendChild(card);
  });
}

document.getElementById('btn-open-armory').addEventListener('click', () => {
  sfx.init();
  sfx.playInspectClick();
  openArmory();
});
document.getElementById('btn-close-armory').addEventListener('click', () => {
  elArmoryModal.classList.add('hidden');
});

// ================= KNIFE MARKET =================
const elMarketModal = document.getElementById('market-modal');
let marketHaggle = null; // active NPC haggle (null when none)

function marketFmt(v) {
  return `$${v}`;
}

function marketSetMsg(id, text) {
  document.getElementById(id).textContent = text;
}

function refreshMarketCash() {
  document.getElementById('market-cash').textContent = profile.cash;
}

function refreshMarketSellInfo() {
  const knifeId = document.getElementById('market-sell-knife').value;
  const wrapId = document.getElementById('market-sell-wrap').value;
  const skin = getSkinById(knifeId);
  const shop = knifeShopValue(knifeId);
  const base = knifeBaseSale(knifeId);
  const bonus = wrapSaleBonus(wrapId);
  const fair = fairValue(knifeId, wrapId);
  document.getElementById('market-sell-value').textContent =
    `${skin.name}: bolti érték ${marketFmt(shop)} • eladási alap ${marketFmt(base)}` +
    (bonus ? ` • wrap-bónusz +${marketFmt(bonus)}` : '') +
    ` • várható ár ${marketFmt(fair)}`;
  const block = blockReason(profile, knifeId);
  document.getElementById('btn-market-ask').disabled = !!block;
  marketSetMsg('market-sell-msg', block || '');
}

function refreshMarket() {
  const owned = [...profile.unlockedSkins];

  const knifeSel = document.getElementById('market-sell-knife');
  const prevKnife = knifeSel.value;
  knifeSel.innerHTML = '';
  for (const id of owned) {
    const s = getSkinById(id);
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = `${s.name} [${s.rarity}]`;
    knifeSel.appendChild(opt);
  }
  if (owned.includes(prevKnife)) knifeSel.value = prevKnife;

  const wrapSel = document.getElementById('market-sell-wrap');
  const prevWrap = wrapSel.value;
  wrapSel.innerHTML = '';
  const none = document.createElement('option');
  none.value = 'wrap_none';
  none.textContent = 'Nincs wrap';
  wrapSel.appendChild(none);
  for (const id of profile.unlockedWraps) {
    if (id === 'wrap_none') continue;
    const w = getWrapById(id);
    if (!w || w.pattern === 'none' || w.exclusive) continue;
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = `${w.name} (+${marketFmt(wrapSaleBonus(id))})`;
    wrapSel.appendChild(opt);
  }
  if ([...wrapSel.options].some((o) => o.value === prevWrap)) wrapSel.value = prevWrap;

  // Trade panel
  const tradeSel = document.getElementById('market-trade-knife');
  const prevTrade = tradeSel.value;
  tradeSel.innerHTML = '';
  for (const id of owned) {
    const s = getSkinById(id);
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = `${s.name} [${s.rarity}]`;
    tradeSel.appendChild(opt);
  }
  if (owned.includes(prevTrade)) tradeSel.value = prevTrade;

  marketHaggle = null;
  document.getElementById('market-haggle').classList.add('market-hidden');
  refreshMarketTradeInfo();
  refreshMarketSellInfo();
  marketSetMsg('market-trade-msg', '');
  refreshMarketCash();
}

function refreshMarketTradeInfo() {
  const id = document.getElementById('market-trade-knife').value;
  const block = blockReason(profile, id);
  const count = tradeCandidates(profile, id).length;
  document.getElementById('market-trade-info').textContent = block
    ? block
    : `Kapsz egy véletlen kést ${getSkinById(id).rarity} ritkaságból. Lehetséges: ${count} db.`;
  document.getElementById('btn-market-trade').disabled = !!block || count === 0;
}

function finishMarketSale(price, wrapUsed, knifeId) {
  const wrapWasEquipped = !!wrapUsed && profile.equippedWrap === wrapUsed;
  const result = sellKnife(profile, knifeId, wrapUsed, price);
  if (!result.ok) {
    marketSetMsg('market-sell-msg', result.reason);
    return;
  }
  saveProfile(profile);
  sfx.playKnifePickup();
  // The sold wrap was the one on the equipped knife: rebuild the knife without it
  if (wrapWasEquipped) equipPlayerSkin(profile.equippedSkin);
  marketHaggle = null;
  document.getElementById('market-haggle').classList.add('market-hidden');
  elHudCashVal.textContent = profile.cash;
  renderArmoryGrid();
  switchArmoryTab(currentArmoryTab);
  refreshMarket();
  marketSetMsg('market-sell-msg', `✅ Eladva ${marketFmt(price)}${wrapUsed ? ' (a wrap-pel együtt)' : ''}.`);
}

function showHaggleLine() {
  const h = marketHaggle;
  document.getElementById('market-npc-line').textContent =
    `NPC-vevő: ${marketFmt(h.offer)} (ellenajánlat ${h.counters}/${HAGGLE_MAX_COUNTERS})`;
  document.getElementById('market-counter-input').value = Math.round(h.offer * 1.1);
  document.getElementById('market-haggle').classList.remove('market-hidden');
}

document.getElementById('market-sell-knife').addEventListener('change', () => {
  marketHaggle = null;
  document.getElementById('market-haggle').classList.add('market-hidden');
  refreshMarketSellInfo();
});
document.getElementById('market-sell-wrap').addEventListener('change', () => {
  marketHaggle = null;
  document.getElementById('market-haggle').classList.add('market-hidden');
  refreshMarketSellInfo();
});
document.getElementById('market-trade-knife').addEventListener('change', refreshMarketTradeInfo);

document.getElementById('btn-armory-market').addEventListener('click', () => {
  sfx.init();
  sfx.playInspectClick();
  refreshMarket();
  elMarketModal.classList.remove('hidden');
});
document.getElementById('btn-close-market').addEventListener('click', () => {
  elMarketModal.classList.add('hidden');
});

document.getElementById('btn-market-ask').addEventListener('click', () => {
  const knifeId = document.getElementById('market-sell-knife').value;
  const wrapId = document.getElementById('market-sell-wrap').value;
  const block = blockReason(profile, knifeId);
  if (block) {
    marketSetMsg('market-sell-msg', block);
    return;
  }
  marketHaggle = startHaggle(fairValue(knifeId, wrapId));
  marketHaggle.knifeId = knifeId;
  marketHaggle.wrapId = wrapId;
  marketSetMsg('market-sell-msg', '');
  showHaggleLine();
});

document.getElementById('btn-market-accept').addEventListener('click', () => {
  if (!marketHaggle) return;
  haggleAccept(marketHaggle);
  finishMarketSale(marketHaggle.deal, marketHaggle.wrapId !== 'wrap_none' ? marketHaggle.wrapId : null, marketHaggle.knifeId);
});

document.getElementById('btn-market-counter').addEventListener('click', () => {
  if (!marketHaggle) return;
  const ask = parseInt(document.getElementById('market-counter-input').value, 10);
  if (!(ask > 0)) {
    marketSetMsg('market-sell-msg', 'Adj meg egy érvényes összeget.');
    return;
  }
  haggleCounter(marketHaggle, ask);
  if (marketHaggle.status === 'accepted') {
    finishMarketSale(marketHaggle.deal, marketHaggle.wrapId !== 'wrap_none' ? marketHaggle.wrapId : null, marketHaggle.knifeId);
  } else if (marketHaggle.status === 'walked') {
    marketHaggle = null;
    document.getElementById('market-haggle').classList.add('market-hidden');
    marketSetMsg('market-sell-msg', '❌ Az NPC elment. Próbáld újra egy másik ajánlattal.');
  } else {
    showHaggleLine();
    marketSetMsg('market-sell-msg', 'Az NPC nem fogadta el, de ajánlott egy újat.');
  }
});

document.getElementById('btn-market-cancel').addEventListener('click', () => {
  marketHaggle = null;
  document.getElementById('market-haggle').classList.add('market-hidden');
  marketSetMsg('market-sell-msg', '');
});

document.getElementById('btn-market-trade').addEventListener('click', () => {
  const knifeId = document.getElementById('market-trade-knife').value;
  const result = tradeKnife(profile, knifeId);
  if (!result.ok) {
    marketSetMsg('market-trade-msg', result.reason);
    return;
  }
  saveProfile(profile);
  sfx.playKnifePickup();
  marketSetMsg('market-trade-msg', `🔁 Cserélve: kaptad ${result.received.name} [${result.received.rarity}] kést. 3 meccsig nem cserélhető.`);
  renderArmoryGrid();
  switchArmoryTab(currentArmoryTab);
  refreshMarket();
  marketSetMsg('market-trade-msg', `🔁 Cserélve: kaptad ${result.received.name} [${result.received.rarity}] kést. 3 meccsig nem cserélhető.`);
});
document.getElementById('btn-armory-spin').addEventListener('click', () => {
  sfx.playInspectClick();
  armorySpinTrickTimer = 1.1;
  if (currentArmoryTab === 'killEffects') {
    sfx.playKillEffect(selectedArmoryItemId);
  }
});
document.getElementById('btn-armory-action').addEventListener('click', () => {
  const items = getItemsForTab(currentArmoryTab);
  const item = items.find((x) => x.id === selectedArmoryItemId) || items[0];
  if (isItemUnlocked(item)) {
    equipAnyItem(item);
    sfx.playKnifePickup();
    updateArmorySelection(item.id);
  } else if (item.category === 'emote') {
    if (profile.cash >= item.price) {
      profile.cash -= item.price;
      unlockItemInProfile(item);
      saveProfile(profile);
      refreshMenuProfileUI();
      sfx.playKnifePickup();
      updateArmorySelection(item.id);
    } else {
      document.getElementById('mj-import-status').textContent =
        `🔒 ${item.name} costs $${item.price}. Win matches to earn cash, or import its .mj file.`;
    }
  } else if (item.category === 'wrap') {
    if (profile.cash >= item.price) {
      profile.cash -= item.price;
      unlockItemInProfile(item);
      saveProfile(profile);
      refreshMenuProfileUI();
      sfx.playKnifePickup();
      updateArmorySelection(item.id);
    } else {
      // Not enough cash: send the player to the dropbox that can roll this wrap
      selectedBoxId = item.boxId;
      openDropboxModal();
    }
  } else {
    selectedBoxId = item.category ? COSMETIC_DROPBOX.id : DROPBOXES[0].id;
    openDropboxModal();
  }
});

// Dance packs in the Armory: shop packs, plus imported packs that are not in the shop
function getEmoteArmoryItems() {
  const shop = BUILTIN_PACKS.map((p) => ({
    id: p.id,
    category: 'emote',
    name: p.name,
    desc: p.desc,
    price: p.price,
    rarityKey: p.rarityKey,
    rarity: RARITY_TIERS[p.rarityKey].label,
    rarityColor: RARITY_TIERS[p.rarityKey].color,
    icon: p.icon
  }));
  const imported = profile.importedPacks
    .filter((p) => !BUILTIN_PACK_IDS.includes(p.id))
    .map((p) => ({
      id: p.id,
      category: 'emote',
      name: `📦 ${p.name}`,
      desc: p.desc || 'Imported .mj dance pack.',
      price: 0,
      rarityKey: 'COMMON',
      rarity: 'IMPORTED',
      rarityColor: '#94a3b8',
      icon: '📦'
    }));
  return [...shop, ...imported];
}

function setImportStatus(text) {
  document.getElementById('mj-import-status').textContent = text;
}

// Imports a validated .mj pack: built-in ids unlock the shop pack, other ids are stored in the profile
function importEmotePack(def) {
  if (BUILTIN_PACK_IDS.includes(def.id)) {
    if (!profile.unlockedEmotePacks.includes(def.id)) profile.unlockedEmotePacks.push(def.id);
  } else {
    const isNew = !profile.importedPacks.some((p) => p.id === def.id);
    if (isNew && profile.importedPacks.length >= MJ_MAX_IMPORTS) {
      throw new Error(`You can import at most ${MJ_MAX_IMPORTS} custom packs.`);
    }
    profile.importedPacks = profile.importedPacks.filter((p) => p.id !== def.id).concat([def]);
    setImportedPacks(profile.importedPacks);
  }
  saveProfile(profile);
  populateEmoteSelects();
  refreshMenuProfileUI();
  switchArmoryTab('emotes');
}

document.getElementById('btn-import-mj').addEventListener('click', () => {
  sfx.init();
  sfx.playInspectClick();
  document.getElementById('input-import-mj').click();
});
document.getElementById('input-import-mj').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    if (file.size > MJ_MAX_BYTES) throw new Error('The file is larger than 64 KB.');
    const def = validatePack(JSON.parse(await file.text()));
    importEmotePack(def);
    setImportStatus(`✓ Imported "${def.name}". Equip it in this tab, then use G in a match to play it.`);
  } catch (err) {
    setImportStatus(`✗ Import failed: ${err.message}`);
  }
});

let armoryDragging = false;
let armoryDragX = 0;
armoryCanvas.addEventListener('pointerdown', (e) => {
  armoryDragging = true;
  armoryDragX = e.clientX;
});
window.addEventListener('pointerup', () => {
  armoryDragging = false;
});
window.addEventListener('pointermove', (e) => {
  if (armoryDragging && !elArmoryModal.classList.contains('hidden')) {
    const dx = e.clientX - armoryDragX;
    armoryDragX = e.clientX;
    armoryTurntable.rotation.y += dx * 0.012;
  }
});

function equipPlayerSkin(skinId) {
  profile.equippedSkin = skinId;
  viewmodel.setSkin(skinId, profile.equippedWrap);
  playerChar.setKnifeSkin(skinId, profile.equippedWrap);
  rebuildMenuKnife();
  populatePauseSkinDropdown();
}

// ================= PAUSE & SETTINGS MODAL =================
const sliderFov = document.getElementById('slider-fov');
const sliderVol = document.getElementById('slider-vol');
const pauseSkinSelect = document.getElementById('pause-skin-select');

const pauseQualitySelect = document.getElementById('pause-quality-select');
Object.entries(QUALITY_PRESETS).forEach(([key, preset]) => {
  const opt = document.createElement('option');
  opt.value = key;
  opt.textContent = preset.label;
  pauseQualitySelect.appendChild(opt);
});
pauseQualitySelect.value = profile.settings.quality in QUALITY_PRESETS ? profile.settings.quality : 'high';
pauseQualitySelect.addEventListener('change', () => {
  profile.settings.quality = pauseQualitySelect.value;
  saveProfile(profile);
  applyGraphicsQuality();
});

const pauseBloodSelect = document.getElementById('pause-blood-select');
pauseBloodSelect.value = profile.settings.blood === false ? 'off' : 'on';
pauseBloodSelect.addEventListener('change', () => {
  profile.settings.blood = pauseBloodSelect.value === 'on';
  saveProfile(profile);
});

sliderFov.value = profile.settings.fov;
document.getElementById('val-fov').textContent = `${profile.settings.fov}°`;
sliderVol.value = Math.round(profile.settings.volume * 100);
document.getElementById('val-vol').textContent = `${Math.round(profile.settings.volume * 100)}%`;

sliderFov.addEventListener('input', () => {
  profile.settings.fov = parseInt(sliderFov.value, 10);
  document.getElementById('val-fov').textContent = `${profile.settings.fov}°`;
  worldCamera.fov = profile.settings.fov;
  worldCamera.updateProjectionMatrix();
  saveProfile(profile);
});

sliderVol.addEventListener('input', () => {
  const v = parseInt(sliderVol.value, 10) / 100;
  profile.settings.volume = v;
  document.getElementById('val-vol').textContent = `${Math.round(v * 100)}%`;
  sfx.setVolume(v);
  saveProfile(profile);
});

function populatePauseSkinDropdown() {
  pauseSkinSelect.innerHTML = '';
  KNIFE_SKINS.forEach((s) => {
    if (profile.unlockedSkins.includes(s.id)) {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.name} (${s.rarity})`;
      if (s.id === profile.equippedSkin) opt.selected = true;
      pauseSkinSelect.appendChild(opt);
    }
  });
}

pauseSkinSelect.addEventListener('change', () => {
  equipPlayerSkin(pauseSkinSelect.value);
  saveProfile(profile);
  refreshMenuProfileUI();
});

document.getElementById('btn-menu-settings').addEventListener('click', () => {
  sfx.init();
  sfx.playInspectClick();
  populatePauseSkinDropdown();
  populateEmoteSelects();
  document.getElementById('pause-modal-title').textContent = '⚙️ SETTINGS & SENSITIVITY';
  document.getElementById('pause-inmatch-btns').classList.add('hidden');
  document.getElementById('pause-menu-btns').classList.remove('hidden');
  elPauseModal.classList.remove('hidden');
});

document.getElementById('btn-close-menu-settings').addEventListener('click', () => {
  sfx.playInspectClick();
  elPauseModal.classList.add('hidden');
});

// ================= POINTER LOCK & PAUSE =================
async function lockMouse() {
  try {
    if (document.pointerLockElement !== canvas && canvas.requestPointerLock) {
      await canvas.requestPointerLock();
    }
  } catch {
    // Fallback stays active
  }
}

document.addEventListener('pointerlockchange', () => {
  isPointerLocked = document.pointerLockElement === canvas;
  if (!isPointerLocked && appMode === 'playing') {
    pauseGame();
  }
});

window.addEventListener('contextmenu', (e) => e.preventDefault());

function clearAllKeys() {
  for (const k of Object.keys(keys)) {
    keys[k] = false;
  }
}
window.addEventListener('blur', clearAllKeys);

function pauseGame() {
  if (appMode !== 'playing' || mpMatch) return;
  appMode = 'paused';
  clearAllKeys();
  closeRadialWheel(false);
  wheel.qPending = false;
  player.chargingThrow = false;
  if (document.pointerLockElement) {
    document.exitPointerLock?.();
  }
  populatePauseSkinDropdown();
  populateEmoteSelects();
  document.getElementById('pause-modal-title').textContent = '⏸️ PAUSED & SETTINGS';
  document.getElementById('pause-inmatch-btns').classList.remove('hidden');
  document.getElementById('pause-menu-btns').classList.add('hidden');
  elPauseModal.classList.remove('hidden');
}

function resumeGame() {
  if (appMode !== 'paused') return;
  elPauseModal.classList.add('hidden');
  appMode = 'playing';
  lockMouse();
}

document.getElementById('btn-resume').addEventListener('click', () => { sfx.init(); resumeGame(); });
document.getElementById('btn-restart-match').addEventListener('click', () => {
  elPauseModal.classList.add('hidden');
  if (tutorialPhase) startTutorialMatch();
  else startNormalMatch();
});
document.getElementById('btn-quit-menu').addEventListener('click', () => { elPauseModal.classList.add('hidden'); returnToMainMenu(); });
document.getElementById('btn-start-match').addEventListener('click', () => {
  sfx.init();
  if (tutorialRequired(profile)) document.getElementById('tutorial-modal').classList.remove('hidden');
  else startNormalMatch();
});
document.getElementById('btn-rematch').addEventListener('click', () => {
  if (mpMatch) {
    netRematch();
    elMatchEndModal.classList.add('hidden');
    showBanner('🔁 ÚJ MECCS', 'Visszaszámlálás...', '#00f0ff');
    return;
  }
  elMatchEndModal.classList.add('hidden');
  if (tutorialRequired(profile)) startTutorialMatch();
  else startNormalMatch();
});
document.getElementById('btn-end-menu').addEventListener('click', () => { elMatchEndModal.classList.add('hidden'); returnToMainMenu(); });

// ================= DYNAMIC BOT SPAWNING & CLEANUP =================
function clearActiveBots() {
  for (const c of combatants) {
    if (c.remote) c.char.dispose();
  }
  for (const b of activeBots) {
    b.char.dispose();
  }
  activeBots.length = 0;
  dojo.stop();
  combatants.length = 0;
  nametagsLayer.innerHTML = '';
}

function createNametagDOM(label, isAlly) {
  const el = document.createElement('div');
  el.className = 'fighter-nametag hidden';
  const color = isAlly ? '#38bdf8' : '#ffffff';
  const fillBg = isAlly
    ? 'linear-gradient(90deg, #0ea5e9, #38bdf8)'
    : 'linear-gradient(90deg, #ff2a55, #fb7185)';
  el.innerHTML = `
    <div class="enemy-name-label" style="color:${color}">${label}</div>
    <div class="enemy-hp-track">
      <div class="enemy-hp-fill" style="background:${fillBg}; width:100%"></div>
    </div>
  `;
  nametagsLayer.appendChild(el);
  return {
    root: el,
    fill: el.querySelector('.enemy-hp-fill')
  };
}

function spawnBotFighter({
  id,
  name,
  team,
  barrierSide,
  torsoColor,
  legsColor = '#1e293b',
  hatId = 'hat_none',
  skinId = 'karambit_crimson',
  trailId = 'trail_skin',
  killEffectId = 'voxel_classic',
  radarColor = '#ff2a55',
  aiMode = selectedAiMode
}) {
  const ai = new RivalAI(aiMode, profile.botMemory, { team, barrierSide, customName: name });
  if (selectedGameMode === 'gun_mode') {
    ai.gunMode = true; // bot fires its gun on the throw cycle
    ai.state.gunMode = true; // third-person model: gun instead of knife
    ai.cfg.throwCooldown = 1.1;
    ai.cfg.throwWindupTime = 0.4;
  }
  const char = new RivalCharacter(worldScene, skinId, {
    torsoColor,
    legsColor,
    angry: team !== 'blue',
    hatId
  });
  const tag = createNametagDOM(ai.cfg.label.toUpperCase(), team === 'blue');

  const botObj = {
    id,
    name: ai.cfg.label.toUpperCase(),
    team,
    barrierSide,
    isPlayer: false,
    radarColor,
    skinId,
    trailId,
    killEffectId,
    ai,
    char,
    state: ai.state,
    tag
  };
  activeBots.push(botObj);
  combatants.push(botObj);
  return botObj;
}

function returnToMainMenu() {
  if (mpMatch) {
    netLeaveMatch();
    mpLeaveLocal();
  }
  closeRadialWheel(false);
  if (document.pointerLockElement) {
    document.exitPointerLock?.();
  }
  appMode = 'menu';
  clearActiveBots();
  rebuildWorldArena(false);
  playerChar.stopEmote();
  playerChar.setWinStreak(0);
  menuRivalChar.root.visible = true;
  elFxStorm.style.opacity = '0';
  elHud.classList.add('hidden');
  elMainMenu.classList.remove('hidden');
  menuKnifeGroup.visible = true;
  refreshMenuProfileUI();
}

// ================= MATCH & ROUND SETUP ACROSS ALL 5 MODES =================
function startNormalMatch() {
  tutorialPhase = null;
  startNewMatch();
}

function startTutorialMatch() {
  tutorialPhase = 'lessons';
  Object.assign(tut, {
    step: 0, moved: 0, lx: null, lz: null, wasGrounded: true, duelIn: 0,
    baseSlash: profile.botMemory.playerSlashes, baseThrow: profile.botMemory.playerThrows
  });
  selectedGameMode = 'duel_1v1';
  matchIsRanked = false;
  startNewMatch();
  elCoachBanner.classList.remove('hidden');
  elCoachText.textContent = TUTORIAL_STEPS[0].text;
}

function advanceTutorial() {
  tut.step += 1;
  tut.baseSlash = profile.botMemory.playerSlashes;
  tut.baseThrow = profile.botMemory.playerThrows;
  tut.duelIn = 2.5;
  const s = TUTORIAL_STEPS[tut.step];
  if (s) {
    elCoachBanner.classList.remove('hidden');
    elCoachText.textContent = s.text;
  }
}

function startTutorialDuel() {
  tutorialPhase = 'duel';
  roundTimer = ROUND_TIME_LIMIT;
  player.hasKnife = true;
  player.hp = player.maxHp;
  spawnBotFighter({
    id: 'bot_mentor',
    name: 'MENTOR',
    team: 'red',
    barrierSide: 'red',
    torsoColor: '#eab308',
    legsColor: '#1c1917',
    hatId: 'hat_none',
    skinId: TUTORIAL_REWARD.knifeId
  });
  showBanner('⚔️ PÁRBAJ: MENTOR', 'Győzd le, hogy megkapd a kését!', '#eab308');
  elCoachText.textContent = '⚔️ Győzd le a MENTORT: az utolsó lecke!';
}

// Lesson checks run every frame while the lessons are active
function updateTutorial(dt) {
  if (tutorialPhase !== 'lessons' || appMode !== 'playing') return;
  roundTimer = ROUND_TIME_LIMIT; // the lessons have no clock
  if (roundPhase !== 'live') return;

  if (tut.lx !== null) {
    const d = Math.hypot(player.pos.x - tut.lx, player.pos.z - tut.lz);
    if (d < 1) tut.moved += d; // ignore spawn teleports
  }
  tut.lx = player.pos.x;
  tut.lz = player.pos.z;

  if (tut.step === 0 && tut.moved >= 3) advanceTutorial();
  if (tut.step === 1 && tut.wasGrounded && !player.grounded && player.vel.y > 1) advanceTutorial();
  tut.wasGrounded = player.grounded;
  if (tut.step === 2 && profile.botMemory.playerSlashes > tut.baseSlash) advanceTutorial();
  if (tut.step === 3 && profile.botMemory.playerThrows > tut.baseThrow) advanceTutorial();
  if (tut.step === 4) {
    tut.duelIn -= dt;
    if (tut.duelIn <= 0) startTutorialDuel();
  }
}

// Ends the tutorial duel: the reward is granted only on a win
function finishTutorial() {
  const won = matchStats.playerScore > matchStats.enemyScore;
  tutorialPhase = null;
  if (document.pointerLockElement) document.exitPointerLock?.();
  appMode = 'matchEnd';

  const badge = document.getElementById('end-badge');
  const title = document.getElementById('end-title');
  let grant = null;
  if (won) {
    grant = completeTutorial(profile);
    saveProfile(profile);
    refreshMenuProfileUI();
    title.textContent = '🎓 TUTORIAL TELJESÍTVE!';
    badge.textContent = `REWARD: +$${TUTORIAL_REWARD.cash} · MENTOR kés · ritka wrap`;
    badge.style.color = '#10f587';
    badge.style.background = 'rgba(16,245,135,0.18)';
  } else {
    title.textContent = '💀 A MENTOR NYERT — PRÓBÁLD ÚJRA!';
    badge.textContent = 'Nincs jutalom, amíg nem nyered meg a párbajt';
    badge.style.color = '#e879f9';
    badge.style.background = 'rgba(192,38,211,0.18)';
  }

  document.getElementById('end-scoreline').textContent = `${matchStats.playerScore} — ${matchStats.enemyScore}`;
  document.getElementById('end-kills').textContent = matchStats.kills;
  document.getElementById('end-headshots').textContent = matchStats.headshots;
  document.getElementById('end-parries').textContent = matchStats.parries;
  document.getElementById('end-cash').textContent = grant ? `+$${grant.cash}` : '+$0';
  document.getElementById('end-bot-adapt').textContent = grant
    ? `🎓 Tutorial kész. Kés, wrap és $${profile.cash} egyenleg a fegyvertárban.`
    : '🎓 Tutorial: a párbaj megnyerése után jár a jutalom.';
  elMatchEndModal.classList.remove('hidden');
}

// Healing knife: only after 2 match wins, and only while no damage has happened for a few seconds
function updateKnifeHeal(dt) {
  if (appMode !== 'playing' || player.dead || roundPhase !== 'live') return;
  if (!getSkinById(profile.equippedSkin).heals) return;
  if (profile.stats.wins < KNIFE_HEAL_MIN_WINS) return;
  if (performance.now() / 1000 - lastCombatAt < KNIFE_HEAL_QUIET) return;
  if (player.hp >= player.maxHp) return;
  player.hp = Math.min(player.maxHp, player.hp + KNIFE_HEAL_RATE * dt);
}

document.getElementById('btn-tutorial-start').addEventListener('click', () => {
  document.getElementById('tutorial-modal').classList.add('hidden');
  startTutorialMatch();
});
document.getElementById('btn-tutorial-skip').addEventListener('click', () => {
  skipTutorial(profile);
  saveProfile(profile);
  document.getElementById('tutorial-modal').classList.add('hidden');
  startNormalMatch();
});

function startNewMatch() {
  clearActiveBots();
  matchIsRanked = !mpMatch && selectedQueue === 'ranked' && selectedGameMode === 'duel_1v1';
  matchGunMode = selectedGameMode === 'gun_mode';
  closeRadialWheel(false);
  menuRivalChar.root.visible = false;

  const isWide = selectedGameMode === 'ffa_storm' || selectedGameMode === 'team_4v4';
  rebuildWorldArena(isWide);

  playerChar.setKnifeSkin(profile.equippedSkin);
  playerChar.setHat(profile.equippedHat);
  playerChar.setWinStreak(0);

  playerCombatant.team = mpMatch ? mpMatch.myTeam : selectedGameMode === 'ffa_storm' ? 'ffa_player' : 'blue';
  combatants.push(playerCombatant);

  // Build Mode-Specific Roster!
  const lvl = profile.botMemory.level;
  const botSkins =
    lvl <= 1
      ? ['blueprint_blade', 'classic_blox_dagger']
      : ['karambit_crimson', 'balisong_neon', 'kunai_shadow', 'dragon_gold', 'karambit_void_mythic'];
  const pickSkin = () => botSkins[Math.floor(Math.random() * botSkins.length)];

  if (mpMatch) {
    for (const p of mpMatch.players) if (p.id !== mpMatch.myId) mpCreateRemoteFighter(p);
  } else if (tutorialPhase === 'lessons') {
    // Lessons: no enemy yet, the MENTOR arrives after the throw lesson
  } else if (selectedGameMode === 'duel_1v1' || selectedGameMode === 'gun_mode') {
    spawnBotFighter({
      id: 'bot_rival_1',
      name: null,
      team: 'red',
      barrierSide: 'red',
      torsoColor: '#e11d48',
      legsColor: '#1e3a8a',
      hatId: lvl >= 4 ? 'hat_samurai' : 'hat_none',
      skinId: pickSkin()
    });
  } else if (selectedGameMode === 'ffa_storm') {
    const ffaSpecs = [
      { id: 'ffa_1', name: 'RED ALERT', color: '#e11d48', hat: 'hat_bandana', trail: 'trail_crimson', kfx: 'lightning_strike' },
      { id: 'ffa_2', name: 'ORANGE PHANTOM', color: '#f97316', hat: 'hat_samurai', trail: 'trail_inferno', kfx: 'voxel_classic' },
      { id: 'ffa_3', name: 'PURPLE DOMINUS', color: '#a855f7', hat: 'hat_dominus', trail: 'trail_lightning', kfx: 'void_vortex' },
      { id: 'ffa_4', name: 'EMERALD NINJA', color: '#10b981', hat: 'hat_halo', trail: 'trail_emerald', kfx: 'ice_shatter' },
      { id: 'ffa_5', name: 'GOLD CHAMPION', color: '#eab308', hat: 'hat_crown', trail: 'trail_rainbow', kfx: 'golden_statue' }
    ];
    ffaSpecs.forEach((sp) => {
      spawnBotFighter({
        id: sp.id,
        name: sp.name,
        team: sp.id,
        barrierSide: 'none',
        torsoColor: sp.color,
        hatId: sp.hat,
        skinId: pickSkin(),
        trailId: sp.trail,
        killEffectId: sp.kfx,
        radarColor: sp.color
      });
    });
  } else if (selectedGameMode === 'team_2v2' || selectedGameMode === 'team_4v4') {
    const teamSize = selectedGameMode === 'team_4v4' ? 4 : 2;
    for (let i = 1; i < teamSize; i++) {
      spawnBotFighter({
        id: `ally_${i}`,
        name: `ALLY #${i}`,
        team: 'blue',
        barrierSide: 'blue',
        torsoColor: '#0284c7',
        legsColor: '#0f172a',
        hatId: i === 1 ? 'hat_bandana' : 'hat_halo',
        skinId: pickSkin(),
        radarColor: '#38bdf8',
        aiMode: selectedAiMode === 'adaptive' ? 'normal' : selectedAiMode
      });
    }
    for (let i = 0; i < teamSize; i++) {
      spawnBotFighter({
        id: `enemy_${i}`,
        name: `RIVAL #${i + 1}`,
        team: 'red',
        barrierSide: 'red',
        torsoColor: '#e11d48',
        legsColor: '#1e3a8a',
        hatId: i === 0 ? 'hat_samurai' : 'hat_none',
        skinId: pickSkin(),
        radarColor: '#ff2a55'
      });
    }
  } else if (selectedGameMode === 'training_dojo') {
    dojo.start(combatants);
    // Create nametags for Dojo targets!
    for (const d of dojo.dummies) {
      d.tag = createNametagDOM(d.name, false);
    }
  }

  matchStats.playerScore = 0;
  matchStats.enemyScore = 0;
  matchStats.roundNumber = 1;
  matchStats.kills = 0;
  matchStats.throwHits = 0;
  matchStats.parries = 0;
  matchStats.headshots = 0;
  matchStats.cashEarned = 0;
  matchStats.winStreak = 0;
  matchStats.ffaPlacement = 1;

  elHudStreakPill.classList.add('hidden');
  elHudCashVal.textContent = profile.cash;
  elHudHsVal.textContent = '0';
  elHudModeSub.textContent = matchIsRanked
    ? '🏆 RANKED 1v1 • 0 S THROW CD • FIRST TO 5 WINS'
    : GAME_MODES[selectedGameMode].hudSub;
  elHudQueuePill.textContent = matchIsRanked
    ? '🏆 Ranked (0 s throw CD • lower damage)'
    : '🎮 Normal (3 s throw CD)';
  syncCameraUI();
  elKillfeed.innerHTML = '';

  menuKnifeGroup.visible = false;
  elMainMenu.classList.add('hidden');
  elDropboxModal.classList.add('hidden');
  elArmoryModal.classList.add('hidden');
  elPauseModal.classList.add('hidden');
  elMatchEndModal.classList.add('hidden');
  elHud.classList.remove('hidden');

  appMode = 'playing';
  setupRound();
  if (mpMatch) mpPlaceLocal();
  updateScoreboardUI();
  lockMouse();
}

function setupRound() {
  projectiles.clear();
  particles.clear();
  storm.stop();
  elFxStorm.style.opacity = '0';
  elStormAlertPill.classList.add('hidden');
  elStormRadarWrap.classList.add('hidden');
  elSpectatorPill.classList.add('hidden');

  const isFFA = selectedGameMode === 'ffa_storm';
  const isDojo = selectedGameMode === 'training_dojo';

  arena.barriers.active = !isFFA && !isDojo;
  arena.barriers.playerMesh.visible = arena.barriers.active;
  arena.barriers.enemyMesh.visible = arena.barriers.active;

  // Position Player & Bots
  if (isFFA) {
    player.pos.copy(arena.ffaSpawns[0]);
    player.yaw = Math.atan2(-player.pos.x, -player.pos.z);
    activeBots.forEach((b, idx) => {
      const sp = arena.ffaSpawns[(idx + 1) % arena.ffaSpawns.length];
      const yawToCenter = Math.atan2(-sp.x, -sp.z);
      b.ai.resetForRound(sp, yawToCenter);
      b.char.stopEmote();
    });
  } else if (isDojo) {
    player.pos.copy(arena.playerSpawn);
    player.yaw = 0;
  } else {
    player.pos.copy(arena.blueTeamSpawns[0]);
    player.yaw = 0;
    let allyIdx = 1;
    let enemyIdx = 0;
    activeBots.forEach((b) => {
      if (b.team === 'blue') {
        b.ai.resetForRound(arena.blueTeamSpawns[allyIdx % arena.blueTeamSpawns.length], 0);
        allyIdx++;
      } else {
        b.ai.resetForRound(arena.redTeamSpawns[enemyIdx % arena.redTeamSpawns.length], Math.PI);
        enemyIdx++;
      }
      b.char.stopEmote();
    });
  }

  player.vel.set(0, 0, 0);
  player.pitch = 0;
  player.hp = 100;
  player.dead = false;
  player.grounded = true;
  player.jumpsLeft = 2;
  player.sliding = false;
  player.slideTimer = 0;
  player.slideCd = 0;
  player.dashing = false;
  player.dashTimer = 0;
  player.dashCd = 0;
  player.knifeMaxCharges = knifeMaxChargesFor(profile.equippedSkin);
  player.knifeCharges = player.knifeMaxCharges;
  player.hasKnife = true;
  player.knifeRecharge = 0;
  // Normal: rarity-scaled cooldown per charge • Ranked: 0 mp • Dojo: gyors újratöltés
  player.knifeMaxRecharge = isDojo ? 0.42 : matchIsRanked ? RANKED_THROW_RECHARGE : knifeRechargeFor(profile.equippedSkin, NORMAL_THROW_RECHARGE);
  if (isBurstKnife()) player.knifeMaxRecharge = Math.max(player.knifeMaxRecharge, 1.0); // one clip knife back at least every 1 s
  player.burstShots = 0;
  player.lastThrowInstant = false;
  player.chargingThrow = false;
  player.chargeDuration = 0;

  // v5 reset: buffs, vault, slam, barrage, ability cooldowns, wheel
  player.rageTimer = 0;
  player.chronoTimer = 0;
  player.speedBoostTimer = 0;
  player.vaultBoostTimer = 0;
  player.vaulting = false;
  player.vaultData = null;
  player.vaultTilt = 0;
  player.vaultCandidate = null;
  player.slamming = false;
  player.slamAir = 0;
  player.barrageLeft = 0;
  player.barrageTimer = 0;
  for (const id of Object.keys(abilityCooldowns)) delete abilityCooldowns[id];
  closeRadialWheel(false);
  resetGunStateForRound();
  elSlotThrowLabel.textContent = isDojo ? 'Throw' : matchIsRanked ? 'Throw (0 s)' : `Throw (${knifeRechargeFor(profile.equippedSkin, NORMAL_THROW_RECHARGE).toFixed(1)} s)`;
  player.slashCd = 0;
  player.comboStep = 0;
  player.parryTimer = 0;
  player.parryCd = 0;

  manualEmoteActive = false;
  roundShowcaseCombatant = null;
  playerChar.stopEmote();
  currentCamDist = profile.settings.cameraMode === 'third' ? profile.settings.tpsDistance : 0;

  viewmodel.playEquip();

  if (isDojo) {
    roundPhase = 'live';
    elDojoHudBar.classList.remove('hidden');
    elDojoBestVal.textContent = profile.stats.dojoBestScore || 0;
    elCoachBanner.classList.remove('hidden');
    elCoachText.textContent = '🎯 DOJO: Hit and throw at the targets! [R] = 30 s record challenge, [T] = toggle parry cannon!';
    showBanner('🎯 TRAINING DOJO', 'TEST KILL EFFECTS, AIM AND PARRY!', '#00f0ff');
    setTimeout(() => { if (appMode === 'playing') hideBanner(); }, 1400);
  } else {
    elDojoHudBar.classList.add('hidden');
    roundPhase = 'countdown';
    roundWinner = null;
    countdownTimer = 3.0;
    lastCountdownInt = 4;
    roundTimer = ROUND_TIME_LIMIT;
    roundStartElapsed = 0;
    laneRecordedThisRound = false;
    slowMoTimer = 0;
    hitstopTimer = 0;

    if (isFFA) {
      elCoachBanner.classList.remove('hidden');
      elCoachText.textContent = '🌪️ FFA STORM ZONE: Stay inside the white circle! Every kill heals +35 HP (Siphon)!';
      showBanner('3', '🌪️ FFA STORM ZONE • 6 FIGHTERS!', '#e879f9');
    } else {
      const isMatchPointTie = matchStats.playerScore === ROUNDS_TO_WIN - 1 && matchStats.enemyScore === ROUNDS_TO_WIN - 1;
      const tip = (selectedAiMode === 'adaptive' && !matchGunMode) ? getCoachTipForRound(profile.botMemory, matchStats.roundNumber) : null;
      if (tip) {
        elCoachBanner.classList.remove('hidden');
        elCoachText.textContent = tip;
      } else {
        elCoachBanner.classList.add('hidden');
      }
      showBanner(
        '3',
        isMatchPointTie ? '⚡ 4—4 GOLDEN BLADE DECIDER!' : `ROUND ${matchStats.roundNumber} • GET READY!`,
        isMatchPointTie ? '#ffc83b' : '#00f0ff'
      );
    }
  }

  updateHealthUI();
  updateScoreboardUI();
}

function updateScoreboardUI() {
  if (selectedGameMode === 'ffa_storm') {
    const aliveCount = combatants.filter((c) => !c.state.dead).length;
    elHudLeftLabel.textContent = 'KILLS';
    elPlayerScore.textContent = matchStats.kills;
    elPlayerPips.innerHTML = '';
    elEnemyPips.innerHTML = '';
    elRoundLabel.textContent = 'STORM ZONE';
    elEnemyScore.textContent = `${aliveCount}/${combatants.length}`;
    elHudRivalName.textContent = 'ALIVE';
    elRadarAliveTxt.textContent = `👤 Alive: ${aliveCount}/${combatants.length}`;
    return;
  }

  if (selectedGameMode === 'training_dojo') {
    elHudLeftLabel.textContent = 'HIT';
    elPlayerScore.textContent = matchStats.kills;
    elPlayerPips.innerHTML = '';
    elEnemyPips.innerHTML = '';
    elRoundLabel.textContent = 'DOJO';
    elRoundTimer.textContent = dojo.challengeActive ? `00:${String(Math.ceil(dojo.challengeTimer)).padStart(2, '0')}` : '∞';
    elEnemyScore.textContent = dojo.challengeActive ? dojo.challengeScore : profile.stats.dojoBestScore || 0;
    elHudRivalName.textContent = dojo.challengeActive ? 'SCORE' : 'RECORD';
    return;
  }

  elHudLeftLabel.textContent = selectedGameMode === 'duel_1v1' ? 'YOU' : 'BLUE TEAM';
  elHudRivalName.textContent =
    selectedGameMode === 'duel_1v1' && activeBots[0]
      ? activeBots[0].ai.cfg.label.toUpperCase()
      : 'RED TEAM';

  elRoundLabel.textContent = `ROUND ${matchStats.roundNumber}`;
  elPlayerScore.textContent = matchStats.playerScore;
  elEnemyScore.textContent = matchStats.enemyScore;

  elPlayerPips.innerHTML = '';
  elEnemyPips.innerHTML = '';
  for (let i = 0; i < ROUNDS_TO_WIN; i++) {
    const pp = document.createElement('div');
    pp.className = 'pip' + (i < matchStats.playerScore ? ' filled' : '');
    elPlayerPips.appendChild(pp);

    const ep = document.createElement('div');
    ep.className = 'pip' + (i < matchStats.enemyScore ? ' filled' : '');
    elEnemyPips.appendChild(ep);
  }
}

function showBanner(mainText, subText = '', color = '#ffffff') {
  elRoundBanner.classList.remove('hidden');
  elRoundBanner.style.animation = 'none';
  void elRoundBanner.offsetWidth;
  elRoundBanner.style.animation = '';
  elBannerMain.textContent = mainText;
  elBannerMain.style.color = color;
  elBannerSub.textContent = subText;
}

function hideBanner() {
  elRoundBanner.classList.add('hidden');
}

function pushKillfeed(killerName, killerColor, victimName, victimColor, badgeText) {
  const div = document.createElement('div');
  div.className = 'kill-item' + (killerName === 'YOU' ? '' : ' enemy-kill');
  div.innerHTML = `<span style="color:${killerColor}">${killerName}</span> <span>[${badgeText}]</span> <span style="color:${victimColor}">${victimName}</span>`;
  elKillfeed.prepend(div);
  while (elKillfeed.children.length > 5) {
    elKillfeed.lastElementChild.remove();
  }
}

function triggerHitmarker(isCrit = false) {
  elHitmarker.classList.toggle('crit', isCrit);
  elHitmarker.classList.add('active');
  clearTimeout(triggerHitmarker._tid);
  triggerHitmarker._tid = setTimeout(() => {
    elHitmarker.classList.remove('active');
  }, 160);
}

function flashScreen(el, durationMs = 180) {
  el.style.opacity = '1';
  clearTimeout(el._tid);
  el._tid = setTimeout(() => {
    el.style.opacity = '0';
  }, durationMs);
}

function updateHealthUI() {
  const hp = Math.max(0, Math.ceil(player.hp));
  elPlayerHpText.textContent = hp;
  const pct = `${(hp / player.maxHp) * 100}%`;
  elPlayerHpFill.style.width = pct;
  elPlayerHpTrail.style.width = pct;
}

// ================= ROUND / FFA END & SMOOTH SHOWCASE =================
function checkMatchProgressAfterDeath() {
  if (mpMatch) return;
  if (roundPhase !== 'live' || selectedGameMode === 'training_dojo' || tutorialPhase === 'lessons') return;

  if (selectedGameMode === 'ffa_storm') {
    const alive = combatants.filter((c) => !c.state.dead);
    updateScoreboardUI();
    if (alive.length <= 1) {
      const champ = alive[0] || playerCombatant;
      endFFAMatch(champ);
    }
    return;
  }

  const blueAlive = combatants.filter((c) => c.team === 'blue' && !c.state.dead);
  const redAlive = combatants.filter((c) => c.team === 'red' && !c.state.dead);

  if (redAlive.length === 0) {
    endTeamOrDuelRound('blue', blueAlive[0] || playerCombatant);
  } else if (blueAlive.length === 0) {
    endTeamOrDuelRound('red', redAlive[0]);
  }
}

function initShowcaseCameraFromCurrent(showcaseTarget) {
  roundShowcaseCombatant = showcaseTarget;
  cineOrbitTime = 0;
  cineCamPos.copy(worldCamera.position);
  const fwdNow = new THREE.Vector3();
  worldCamera.getWorldDirection(fwdNow);
  cineLookTarget.copy(worldCamera.position).addScaledVector(fwdNow, 4);
}

function endFFAMatch(champ) {
  if (roundPhase === 'roundOver') return;
  roundPhase = 'roundOver';
  roundEndTimer = 3.6;
  slowMoTimer = 0.42;
  storm.stop();
  elFxStorm.style.opacity = '0';
  elSpectatorPill.classList.add('hidden');
  player.chargingThrow = false;

  initShowcaseCameraFromCurrent(champ);
  champ.state.vel.set(0, 0, 0);
  champ.state.sliding = false;
  const emoteId = champ.isPlayer
    ? profile.settings.victoryEmote || 'blade_flourish'
    : VICTORY_EMOTES[Math.floor(Math.random() * VICTORY_EMOTES.length)].id;
  champ.char.playEmote(emoteId);

  if (champ.isPlayer) {
    matchStats.ffaPlacement = 1;
    profile.stats.ffaWins = (profile.stats.ffaWins || 0) + 1;
    sfx.playRoundEnd(true);
    showBanner('🏆 #1 STORM ZONE VICTORY!', 'LAST ONE STANDING CHAMPION!', '#10f587');
  } else {
    sfx.playRoundEnd(false);
    showBanner(`${champ.name} WON THE STORM ZONE!`, `Your placement: #${matchStats.ffaPlacement}`, '#e879f9');
  }
}

function endTeamOrDuelRound(winningTeam, mvpCombatant) {
  if (roundPhase === 'roundOver') return;
  roundPhase = 'roundOver';
  roundWinner = winningTeam;
  roundEndTimer = 3.1;
  slowMoTimer = 0.36;
  storm.stop();
  elFxStorm.style.opacity = '0';
  elSpectatorPill.classList.add('hidden');
  player.chargingThrow = false;

  initShowcaseCameraFromCurrent(mvpCombatant);
  if (mvpCombatant && mvpCombatant.char) {
    mvpCombatant.state.vel.set(0, 0, 0);
    mvpCombatant.state.sliding = false;
    const emoteId = mvpCombatant.isPlayer
      ? profile.settings.victoryEmote || 'blade_flourish'
      : VICTORY_EMOTES[matchStats.roundNumber % VICTORY_EMOTES.length].id;
    mvpCombatant.char.playEmote(emoteId);
  }

  if (selectedGameMode === 'duel_1v1' && selectedAiMode === 'adaptive' && (winningTeam === 'blue' || winningTeam === 'red')) {
    updateBotLearningAfterRound(profile.botMemory, {
      playerWon: winningTeam === 'blue',
      roundDuration: roundStartElapsed
    });
    saveProfile(profile);
    if (profile.botMemory.coachTipsEnabled) {
      elCoachBanner.classList.remove('hidden');
      elCoachText.textContent = `🧠 ${profile.botMemory.lastAdaptSummary}`;
    }
  }

  if (winningTeam === 'blue') {
    matchStats.playerScore++;
    matchStats.winStreak++;
    playerChar.setWinStreak(matchStats.winStreak);

    // Money is paid once, at the end of the match (see finishMatch)

    if (matchStats.winStreak >= 2) {
      elHudStreakPill.classList.remove('hidden');
      elHudStreakPill.textContent = `🔥 ${matchStats.winStreak}x STREAK!`;
    }

    sfx.playRoundEnd(true);
    showBanner(
      'ROUND WON!',
      `${matchStats.playerScore} — ${matchStats.enemyScore}`,
      '#10f587'
    );
  } else if (winningTeam === 'red') {
    matchStats.enemyScore++;
    matchStats.winStreak = 0;
    playerChar.setWinStreak(0);
    elHudStreakPill.classList.add('hidden');
    sfx.playRoundEnd(false);
    showBanner('THE RIVAL TOOK THE POINT!', `${matchStats.playerScore} — ${matchStats.enemyScore}`, '#ff2a55');
  } else {
    showBanner('TIME UP — DRAW!', `${matchStats.playerScore} — ${matchStats.enemyScore}`, '#ffc83b');
  }

  updateScoreboardUI();
}

function finishMatch() {
  if (tutorialPhase) {
    finishTutorial();
    return;
  }
  if (document.pointerLockElement) {
    document.exitPointerLock?.();
  }
  appMode = 'matchEnd';

  const isFFA = selectedGameMode === 'ffa_storm';
  const playerWon = isFFA ? matchStats.ffaPlacement === 1 : matchStats.playerScore >= ROUNDS_TO_WIN;
  // The only cash payout: one lump sum when the whole match is over
  const FFA_PAYOUTS = [800, 500, 350, 250, 200, 150];
  const matchBonus = isFFA
    ? FFA_PAYOUTS[matchStats.ffaPlacement - 1] || 150
    : playerWon ? 800 : 300;

  awardCash(matchBonus);
  tickKnifeCooldowns(profile); // traded/received knives count down one match
  if (!isFFA) {
    if (playerWon) profile.stats.wins += 1;
    else profile.stats.losses = (profile.stats.losses || 0) + 1;
  }
  saveProfile(profile);
  refreshMenuProfileUI();

  const badge = document.getElementById('end-badge');
  const title = document.getElementById('end-title');
  if (playerWon) {
    badge.textContent = `VICTORY REWARD: +$${matchBonus}`;
    badge.style.color = '#10f587';
    badge.style.background = 'rgba(16,245,135,0.18)';
    title.textContent = isFFA ? '👑 #1 STORM ZONE ROYALE VICTORY!' : '🏆 YOU WON THE MATCH!';
  } else {
    badge.textContent = `REWARD: +$${matchBonus}`;
    badge.style.color = '#e879f9';
    badge.style.background = 'rgba(192,38,211,0.18)';
    title.textContent = isFFA
      ? `🌪️ STORM ZONE PLACEMENT: #${matchStats.ffaPlacement}`
      : '💀 YOU LOST — TRY AGAIN!';
  }

  document.getElementById('end-scoreline').textContent = isFFA
    ? `#${matchStats.ffaPlacement} PLACE • ${matchStats.kills} KILLS`
    : `${matchStats.playerScore} — ${matchStats.enemyScore}`;
  document.getElementById('end-kills').textContent = matchStats.kills;
  document.getElementById('end-headshots').textContent = matchStats.headshots;
  document.getElementById('end-parries').textContent = matchStats.parries;
  document.getElementById('end-cash').textContent = `+$${matchStats.cashEarned}`;

  let rpLine = '';
  if (matchIsRanked) {
    const rpDelta = playerWon ? RANKED_RP_WIN : -RANKED_RP_LOSS;
    profile.rankedRp = Math.max(0, (profile.rankedRp || 0) + rpDelta);
    if (playerWon) profile.stats.rankedWins = (profile.stats.rankedWins || 0) + 1;
    const rInfo = getRankInfo(profile.rankedRp);
    rpLine = `🏆 RANG: ${rpDelta > 0 ? '+' : ''}${rpDelta} RP → ${rInfo.icon} ${rInfo.name} (${profile.rankedRp} RP) • `;
    saveProfile(profile);
  }
  document.getElementById('end-bot-adapt').textContent = `${rpLine}💵 Balance: $${profile.cash} — open new kill effects, trails or skins from the Dropbox!`;
  elMatchEndModal.classList.remove('hidden');
}

// ================= UNIFIED DAMAGE, HEADSHOTS & KILL EFFECTS =================
// ASCENDANT knife rules
const POISON_DURATION = 5;      // s; 1 HP every 0.25 s = 4 HP/s = 20 HP total, re-hits refresh (no stacking)
const POISON_TICK = 0.25;
const GRAPPLE_MAX_HIT = 45;     // a hook hit can never remove a full bar, and HP floors at 1
const GRAPPLE_PULL_TIME = 0.5;  // s the hook drags the target in
const GRAPPLE_STOP_DIST = 1.5;  // m from the thrower where the pull ends
const GRAPPLE_DISARM_AFTER = 1.5; // s after the pull ends during which the victim still cannot attack
// A hooked bot is disarmed: no melee, no throws, no damage while pulled and for 1.5 s after
function isBotDisarmed(c) {
  return !!c.grappleFx || (c.disarmTimer || 0) > 0;
}

function applyDamageToCombatant({
  attackerId,
  victim,
  damage,
  headshot = false,
  deflected = false,
  method = 'slash',
  hitPos,
  kind: knifeKind = null
}) {
  lastCombatAt = performance.now() / 1000;
  if (!victim || victim.state.dead || roundPhase !== 'live') return;

  const attacker = combatants.find((c) => c.id === attackerId);
  const attackerIsPlayer = attackerId === 'player';
  if (attacker && !attacker.isPlayer && isBotDisarmed(attacker)) return; // hooked bots cannot damage
  // Knife family of the weapon that landed the hit (ASCENDANT rules depend on it)
  const kind = knifeKind ?? (attackerIsPlayer ? getSkinById(profile.equippedSkin).type : null);
  const silent = method === 'poison'; // poison ticks: no hit FX, no hitmarker

  if (victim.remote) {
    // Remote fighter: their HP lives on their own client. We only report our hit; the server relays it.
    if (attackerIsPlayer && !silent && mpMatch) {
      netSendHit(victim.id, { damage, headshot: !!headshot, deflected: !!deflected, method, kind: kind || null });
    }
  } else if (kind === 'grapple' && !silent) {
    damage = Math.min(damage, GRAPPLE_MAX_HIT);
    victim.state.hp = Math.max(1, victim.state.hp - damage);
  } else {
    victim.state.hp = Math.max(0, victim.state.hp - damage);
  }
  if (!silent) victim.char.triggerHitFlash(headshot);

  if (silent) {
    if (victim.isPlayer) updateHealthUI();
  } else if (victim.isPlayer) {
    cancelManualEmote();
    updateHealthUI();
    sfx.playHurt();
    flashScreen(elFxHurt, 230);
    cameraShake = 0.22;
  } else if (attackerIsPlayer) {
    const isKill = victim.state.hp <= 0;
    if (headshot) {
      sfx.playHeadshot();
      flashScreen(elFxHeadshot, 200);
    } else {
      sfx.playHit(deflected, isKill);
    }
    triggerHitmarker(headshot || deflected || isKill);

    const worldHit = hitPos || (headshot ? victim.char.getHeadWorldCenter() : victim.char.getChestWorldCenter());
    particles.spawnSparks(worldHit, headshot ? 0xffd166 : 0xff2a55, headshot || isKill ? 24 : 12, headshot ? 11 : 6);

    if (headshot) {
      matchStats.headshots++;
      profile.stats.headshots++;
      profile.botMemory.playerHeadshots++;
      elHudHsVal.textContent = matchStats.headshots;
      particles.spawnShockwave(worldHit, 0xffd166, 2.3);
      particles.spawnFloatingText(
        worldHit,
        `🎯 -${damage} HEADSHOT!`,
        '#ffd166',
        true
      );
    } else if (deflected) {
      particles.spawnFloatingText(worldHit, `⚡ -${damage} REFLECTED!`, '#ffd166', true);
    } else {
      particles.spawnFloatingText(worldHit, `-${damage}`, '#ffffff', false);
    }

    if (victim.isDojoDummy) {
      dojo.recordHit({ headshot, deflected, killed: isKill });
      updateScoreboardUI();
    }
  }

  // ASCENDANT on-hit effects (bots only; applied while the victim is still alive)
  if (!silent && !victim.isPlayer && !victim.remote && attackerIsPlayer && victim.state.hp > 0 && !deflected) {
    if (kind === 'poison' && (method === 'slash' || method === 'throw' || method === 'jab')) {
      victim.poison = { timer: POISON_DURATION, acc: 0, attackerId };
      particles.spawnFloatingText(victim.char.getChestWorldCenter(), '☠ POISONED', '#22c55e', false);
    }
    if (kind === 'grapple' && (method === 'slash' || method === 'throw')) {
      victim.grappleFx = { timer: GRAPPLE_PULL_TIME, attackerId };
    }
  }

  // Blood: droplets fly along the hit direction and a splat stays on the floor (bots only)
  if (!silent && !deflected && !victim.isPlayer && profile.settings.blood !== false) {
    const big = headshot || victim.state.hp <= 0;
    const at = hitPos ? hitPos.clone() : victim.char.getChestWorldCenter();
    const dir = attacker
      ? new THREE.Vector3(victim.state.pos.x - attacker.state.pos.x, 0.35, victim.state.pos.z - attacker.state.pos.z)
      : new THREE.Vector3(0, 0.5, 0);
    const lowMul = profile.settings.quality === 'low' ? 0.6 : 1;
    particles.spawnBlood(at, dir, Math.round((big ? 22 : 12) * lowMul), big ? 1.3 : 1);
    particles.spawnBloodSplat(new THREE.Vector3(victim.state.pos.x, 0.03, victim.state.pos.z), big);
  }

  // Elimination Handling!
  if (!victim.remote && victim.state.hp <= 0) {
    victim.state.dead = true;
    if (mpMatch && victim.isPlayer) mpOnLocalDeath(attackerId, method, headshot, kind);
    const deathPos = victim.isPlayer
      ? new THREE.Vector3(player.pos.x, player.pos.y + 1.35, player.pos.z)
      : victim.char.getChestWorldCenter();

    // Determine Killer's Equipped Kill Effect!
    const chosenKillFx = attackerIsPlayer
      ? profile.equippedKillEffect
      : (attacker && attacker.killEffectId) || 'voxel_classic';

    const victimPalette = [0xf5cd30, victim.char.torsoColorHex || 0xe11d48, victim.char.legsColorHex || 0x1e3a8a, 0xffffff];
    particles.triggerKillEffect(chosenKillFx, deathPos, victimPalette);
    if (attackerIsPlayer || victim.isPlayer) {
      sfx.playKillEffect(chosenKillFx);
    }

    if (victim.isDojoDummy) {
      victim.respawnTimer = 1.35;
      matchStats.kills++;
      updateScoreboardUI();
      return;
    }

    // Knockback
    if (attacker) {
      const kb = victim.state.pos.clone().sub(attacker.state.pos).setY(0).normalize();
      victim.state.vel.set(kb.x * 13, 6.5, kb.z * 13);
    }

    if (victim.isPlayer && selectedGameMode === 'ffa_storm') {
      // Record exact placement in 6-player FFA!
      const stillAlive = combatants.filter((c) => !c.state.dead).length;
      matchStats.ffaPlacement = stillAlive + 1;
    }

    if (attackerIsPlayer) {
      matchStats.kills++;
      profile.stats.kills++;
      saveProfile(profile);

      // Fortnite Siphon in FFA Storm Mode (+35 HP on Elimination!)
      if (selectedGameMode === 'ffa_storm' && !player.dead) {
        player.hp = Math.min(player.maxHp, player.hp + 35);
        updateHealthUI();
        particles.spawnFloatingText(deathPos, '+35 HP SIPHON!', '#10f587', true);
      }
      hitstopTimer = 0.055;
      cameraShake = 0.2;
    } else if (attacker && !attacker.isPlayer && selectedGameMode === 'ffa_storm' && !attacker.state.dead) {
      attacker.state.hp = Math.min(attacker.state.maxHp, attacker.state.hp + 30);
    }

    let badge = '🗡️ Knife';
    if (method === 'storm') badge = '🌪️ Storm Zone';
    else if (deflected) badge = '⚡ Parry';
    else if (headshot && method === 'throw') badge = '🎯 Headshot (Throw)';
    else if (headshot) badge = '🎯 Headshot';
    else if (method === 'throw') badge = '🎯 Thrown knife';

    const kName = attacker ? attacker.name : '🌪️ STORM ZONE';
    const kCol = attacker ? attacker.radarColor : '#e879f9';
    if (!mpMatch) pushKillfeed(kName, kCol, victim.name, victim.radarColor, badge);

    checkMatchProgressAfterDeath();
  }
}

// ================= PLAYER COMBAT ACTIONS =================
// Plays any emote during a match (G / Z X B N M H). Attacks and jumps still cancel it.
function playEmoteNow(emoteId) {
  manualEmoteActive = true;
  // RPG emote is Gun Mode only: fall back to the default dance elsewhere
  const id = emoteId === 'rpg_launch' && !matchGunMode ? 'rivals_dance' : emoteId;
  playerChar.playEmote(id);
}

function spawnRpgBoom(footPos) {
  const c = new THREE.Vector3(footPos.x, footPos.y + 1.6, footPos.z);
  particles.spawnShockwave(c, 0xff7a18, 4.5);
  particles.spawnSparks(c, 0xffc83b, 40, 12);
  particles.spawnVoxelBurst(c, [0xff7a18, 0xffc83b, 0x374151, 0xffffff], 22);
  sfx.playAbilityCast('ability_rage');
}

const EMOTE_HOTKEYS = {
  KeyZ: 'cinema_freeze',
  KeyX: 'disco_robot',
  KeyB: 'orbit_shuffle',
  KeyN: 'drum_flex',
  KeyM: 'mj:moonwalk',
  KeyH: 'mj:lean_forward',
  KeyP: 'rpg_launch'
};

function cancelManualEmote() {
  if (manualEmoteActive && roundPhase !== 'roundOver') {
    manualEmoteActive = false;
    playerChar.stopEmote();
  }
}

function distanceRayToPoint(rayOrigin, rayDir, point) {
  const v = point.clone().sub(rayOrigin);
  const proj = v.dot(rayDir);
  if (proj < 0) return Infinity;
  const closest = rayOrigin.clone().addScaledVector(rayDir, proj);
  return closest.distanceTo(point);
}

function getPlayerAimOrigin() {
  return new THREE.Vector3(player.pos.x, player.pos.y + currentEyeOffset, player.pos.z);
}

function findClosestSlashTarget(eyeOrigin, lookDir, maxRange, coneDot = 0.34) {
  let best = null;
  let bestDist = Infinity;
  for (const c of combatants) {
    if (c.isPlayer || c.team === playerCombatant.team || c.state.dead) continue;
    const chest = c.char.getChestWorldCenter();
    const toChest = chest.clone().sub(eyeOrigin);
    const d = toChest.length();
    const dot = lookDir.dot(toChest.clone().normalize());
    if (d < maxRange && (dot > coneDot || d < 1.2) && d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

// ================= GUN MODE (fegyvermód) =================
let matchGunMode = false;
let gunHeld = false;
let gunState = { id: 'gun_pistol', cd: 0, reloadT: 0 };
let gunAmmo = {}; // { [gunId]: { mag, reserve } }

// Fejlesztői/tesztelő kapcsoló: a ?dev URL-paraméterrel minden fegyver és a fegyvermód nyitva van (rangkapu nélkül)
const GUN_DEV_UNLOCK = new URLSearchParams(window.location.search).has('dev');

function isGunModeUnlocked() {
  if (GUN_DEV_UNLOCK) return true;
  return getRankInfo(profile.rankedRp || 0).minRp >= GUN_MODE_MIN_RP;
}

function ownedGunIds() {
  if (GUN_DEV_UNLOCK) return [...GUN_ORDER];
  return GUN_ORDER.filter((id) => GUN_DEFS[id].free || (profile.unlockedGuns || []).includes(id));
}

function gunDef() {
  return getGunDef(gunState.id);
}

function gunAmmoNow() {
  if (!gunAmmo[gunState.id]) gunAmmo[gunState.id] = { mag: gunDef().mag, reserve: gunDef().reserve };
  return gunAmmo[gunState.id];
}

function resetGunStateForRound() {
  const owned = ownedGunIds();
  const want = owned.includes(profile.equippedGun) ? profile.equippedGun : 'gun_pistol';
  gunState = { id: want, cd: 0, reloadT: 0 };
  gunAmmo = {};
  syncGunVisuals();
  player.gunMode = matchGunMode; // viewmodel: no knife in gun mode
  for (const id of GUN_ORDER) {
    gunAmmo[id] = { mag: getGunDef(id).mag, reserve: getGunDef(id).reserve };
  }
}

function startGunReload() {
  const a = gunAmmoNow();
  const d = gunDef();
  if (gunState.reloadT > 0 || a.mag >= d.mag || a.reserve <= 0) return;
  gunState.reloadT = d.reloadTime;
}

function finishGunReload() {
  const a = gunAmmoNow();
  const d = gunDef();
  const take = Math.min(d.mag - a.mag, a.reserve);
  a.mag += take;
  a.reserve -= take;
}

function cycleGunInMatch() {
  const owned = ownedGunIds();
  if (owned.length < 2 || gunState.reloadT > 0) return;
  const next = owned[(owned.indexOf(gunState.id) + 1) % owned.length];
  gunState.id = next;
  gunState.cd = 0.25;
  const d = gunDef();
  syncGunVisuals();
  showBanner(d.name, 'WEAPON SWITCHED', '#ffc83b');
  setTimeout(() => { if (appMode === 'playing') hideBanner(); }, 700);
}

function raySphereT(o, d, c, r) {
  const oc = o.clone().sub(c);
  const b = oc.dot(d);
  const cc = oc.lengthSq() - r * r;
  const disc = b * b - cc;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t1 = -b - s;
  if (t1 > 0) return t1;
  const t2 = -b + s;
  return t2 > 0 ? t2 : null;
}

// Legközelebbi fal távolsága (AABB-k), a sugár mentén
function rayWallT(o, d, maxT) {
  let best = Infinity;
  if (!arena || !arena.boxes) return best;
  for (const bx of arena.boxes) {
    let t0 = 0;
    let t1 = maxT;
    let miss = false;
    const axes = [['x', 'minX', 'maxX'], ['y', 'minY', 'maxY'], ['z', 'minZ', 'maxZ']];
    for (const [ax, lo, hi] of axes) {
      const dv = d[ax];
      const ov = o[ax];
      if (Math.abs(dv) < 1e-9) {
        if (ov < bx[lo] || ov > bx[hi]) { miss = true; break; }
        continue;
      }
      let ta = (bx[lo] - ov) / dv;
      let tb = (bx[hi] - ov) / dv;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta);
      t1 = Math.min(t1, tb);
      if (t0 > t1) { miss = true; break; }
    }
    if (!miss && t0 < best) best = t0;
  }
  return best;
}

// Egy lövedék (hitscan) végigvezetése: a legközelebbi ellenfél fej/test találata, a falak blokkolnak
function traceGunRay({ shooter, origin, dir, def, damage }) {
  let target = null;
  let hitT = Infinity;
  let isHead = false;
  for (const c of combatants) {
    if (c === shooter || c.team === shooter.team || c.state.dead) continue;
    const tH = raySphereT(origin, dir, c.char.getHeadWorldCenter(), 0.3);
    const tC = raySphereT(origin, dir, c.char.getChestWorldCenter(), 0.5);
    let t = null;
    let head = false;
    if (tH !== null && (tC === null || tH <= tC)) { t = tH; head = true; }
    else if (tC !== null) { t = tC; }
    if (t === null || t > def.range) continue;
    if (t < hitT) { hitT = t; target = c; isHead = head; }
  }

  // Falak: ugyanaz a látható-mesh raycast, mint a bot hasLineOfSight-ja (így a bot és a lövés egyezik)
  let wallT = Infinity;
  if (arena && arena.worldMeshes) {
    const rc = new THREE.Raycaster(origin, dir, 0.05, def.range);
    const wh = rc.intersectObjects(arena.worldMeshes, false);
    if (wh.length) wallT = wh[0].distance;
  }
  const blocked = target === null || wallT < hitT;
  const endT = Math.min(blocked ? (wallT < Infinity ? wallT : def.range) : hitT, def.range);
  const end = origin.clone().addScaledVector(dir, endT);

  // Nyomvonal (tracer), rövid ideig látszik
  const geo = new THREE.BufferGeometry().setFromPoints([origin.clone().addScaledVector(dir, 0.6), end]);
  const mat = new THREE.LineBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.85 });
  const line = new THREE.Line(geo, mat);
  worldScene.add(line);
  setTimeout(() => { worldScene.remove(line); geo.dispose(); mat.dispose(); }, 70);

  if (!blocked && target) {
    const dmg = Math.max(1, Math.round(damage * (isHead ? def.headMul : 1)));
    applyDamageToCombatant({
      attackerId: shooter.id,
      victim: target,
      damage: dmg,
      headshot: isHead,
      method: 'gun',
      hitPos: end
    });
    particles.spawnSparks(end, isHead ? 0xff3b5c : 0xffe066, isHead ? 16 : 8, 7);
    if (isHead) sfx.playHeadshot();
    else sfx.playHit(false, false);
  } else {
    particles.spawnSparks(end, 0x9ca3af, 4, 4);
  }
}

function syncGunVisuals() {
  viewmodel.setGunModel(gunState.id);
  playerChar.setGunModel(gunState.id);
}

function firePlayerGun() {
  if (!matchGunMode || player.dead || roundPhase !== 'live' || player.parryTimer > 0) return false;
  if (gunState.cd > 0 || gunState.reloadT > 0) return false;
  const a = gunAmmoNow();
  const d = gunDef();
  if (a.mag <= 0) {
    startGunReload();
    return false;
  }
  a.mag--;
  gunState.cd = d.fireInterval;
  cancelManualEmote();
  const origin = getPlayerAimOrigin();
  const dir = getPlayerLookDir();
  sfx.playThrow(false);
  for (let i = 0; i < d.pellets; i++) {
    traceGunRay({ shooter: playerCombatant, origin, dir: spreadDirection(dir, d.spread), def: d, damage: d.damage });
  }
  player.pitch = Math.min(player.pitch + d.kick, 1.45);
  viewmodel.playGunShot(d.kick);
  if (a.mag === 0) startGunReload();
  return true;
}

// A bot a meglévő AI dobás-ciklusában lő (ugyanaz a ritmus, mint a dobás)
function fireBotGun(b, origin, dir) {
  if (!matchGunMode || b.state.dead || roundPhase !== 'live') return;
  const def = getGunDef('gun_pistol');
  const scale = b.ai.getThrowDamage() / 65;
  traceGunRay({
    shooter: b,
    origin,
    dir: spreadDirection(dir, 0.045),
    def,
    damage: Math.max(1, Math.round(def.damage * scale))
  });
}

function updateGunState(dt) {
  if (!matchGunMode) return;
  if (gunState.cd > 0) gunState.cd -= dt;
  if (gunState.reloadT > 0) {
    gunState.reloadT -= dt;
    if (gunState.reloadT <= 0) {
      gunState.reloadT = 0;
      finishGunReload();
    }
  }
  if (gunHeld && gunDef().auto) firePlayerGun();
  updateGunHUD();
}

function updateGunHUD() {
  const el = document.getElementById('gun-hud');
  if (!el) return;
  el.classList.toggle('hidden', !matchGunMode || appMode !== 'playing');
  if (!matchGunMode) return;
  const d = gunDef();
  const a = gunAmmoNow();
  el.textContent = gunState.reloadT > 0
    ? `${d.name} • RELOADING ${gunState.reloadT.toFixed(1)}s`
    : `${d.name} • ${a.mag} / ${a.reserve}`;
  el.style.color = a.mag === 0 ? '#ff3b5c' : '#ffe066';
}

function refreshGunSelect() {
  const row = document.getElementById('gun-select-row');
  const sel = document.getElementById('menu-gun-select');
  if (!row || !sel) return;
  const show = selectedGameMode === 'gun_mode';
  row.classList.toggle('hidden', !show);
  if (!show) return;
  const owned = ownedGunIds();
  sel.innerHTML = owned.map((id) => `<option value="${id}">${GUN_DEFS[id].name}</option>`).join('');
  sel.value = owned.includes(profile.equippedGun) ? profile.equippedGun : 'gun_pistol';
  const stats = document.getElementById('gun-stats');
  if (stats) {
    const d = getGunDef(sel.value);
    const shape = d.pellets > 1 ? `${d.pellets} pellets` : 'single shot';
    stats.textContent = `${d.damage} dmg • ${d.mag} mag • ${shape} • ${d.auto ? 'auto' : 'semi-auto'}`;
  }
}

document.getElementById('menu-gun-select')?.addEventListener('change', (e) => {
  profile.equippedGun = e.target.value;
  saveProfile(profile);
  refreshGunSelect();
});

function showGunModeLocked() {
  const rp = profile.rankedRp || 0;
  document.getElementById('mode-desc-text').innerHTML =
    `🔒 <strong>Gun Mode</strong> unlocks at <strong>Platinum (500 RP)</strong>. You have <strong>${rp} RP</strong>.`;
}

// Dual knife: the blade is tested from three points across the swing (left, centre, right),
// so a near miss on one point can still hit
function findDualSlashTarget(eyeOrigin, lookDir) {
  const rightDir = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  let best = null;
  let bestD = Infinity;
  for (const side of [-0.28, 0, 0.28]) {
    const origin = eyeOrigin.clone().addScaledVector(rightDir, side);
    const t = findClosestSlashTarget(origin, lookDir, STAB_RANGE, STAB_CONE_DOT);
    if (!t) continue;
    const d = t.state.pos.distanceTo(player.pos);
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
}

function performPlayerSlash() {
  if (player.dead || roundPhase === 'roundOver' || player.slashCd > 0 || player.parryTimer > 0) return;
  cancelManualEmote();
  player.chargingThrow = false;

  const eyeOrigin = getPlayerAimOrigin();
  const lookDir = getPlayerLookDir();

  if (!player.hasKnife) {
    player.slashCd = 0.32;
    viewmodel.playQuickJab();
    playerChar.triggerSlashAnim(0);
    if (mpMatch) netSendAct({ kind: 'slash', step: 0 });
    sfx.playSlash(0, true);

    if (roundPhase === 'live') {
      const hitTarget = findClosestSlashTarget(eyeOrigin, lookDir, 2.75);
      if (hitTarget) {
        applyDamageToCombatant({
          attackerId: 'player',
          victim: hitTarget,
          damage: 25,
          method: 'jab'
        });
      }
    }
    return;
  }

  if (roundPhase === 'live' && selectedGameMode === 'duel_1v1') {
    profile.botMemory.playerSlashes++;
  }

  if (player.comboResetTimer <= 0) player.comboStep = 0;
  const step = player.comboStep;
  player.comboStep = (player.comboStep + 1) % 3;
  player.comboResetTimer = 0.95;
  player.slashCd = step === 2 ? 0.42 : 0.32;

  viewmodel.playSlash(step);
  playerChar.triggerSlashAnim(step);
  if (mpMatch) netSendAct({ kind: 'slash', step });
  sfx.playSlash(step, false);

  if (step === 2 && roundPhase === 'live') {
    const flatFwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    player.vel.addScaledVector(flatFwd, 5.2);
  }

  if (roundPhase !== 'live') return;

  const target = isDualKnife() ? findDualSlashTarget(eyeOrigin, lookDir) : findClosestSlashTarget(eyeOrigin, lookDir, STAB_RANGE, STAB_CONE_DOT);
  if (!target) return;

  const headPos = target.char.getHeadWorldCenter();
  const chestPos = target.char.getChestWorldCenter();

  if (target.state.parryTimer > 0) {
    sfx.playParrySuccess(false);
    particles.spawnSparks(chestPos, 0x00f0ff, 20, 8);
    particles.spawnShockwave(chestPos, 0x00f0ff, 2.0);
    particles.spawnFloatingText(chestPos, 'PARRIED!', '#00f0ff', true);
    player.slashCd = 0.7;
    const pushBack = player.pos.clone().sub(target.state.pos).setY(0).normalize();
    player.vel.addScaledVector(pushBack, 9);
    return;
  }

  const camDir = new THREE.Vector3();
  worldCamera.getWorldDirection(camDir);
  const rayHeadDist = distanceRayToPoint(worldCamera.position, camDir, headPos);
  const isMeleeHeadshot = rayHeadDist < 0.45 && eyeOrigin.distanceTo(headPos) < 3.7;

  let dmg = step === 2 ? 65 : 48;
  if (isMeleeHeadshot) dmg = step === 2 ? 100 : 85;
  if (!player.grounded && player.vel.y < -2) dmg += 15;
  if (target.state.stunTimer > 0) dmg += 20;

  applyDamageToCombatant({
    attackerId: 'player',
    victim: target,
    damage: Math.round(dmg * getPlayerDamageMult()),
    headshot: isMeleeHeadshot,
    method: 'slash',
    hitPos: isMeleeHeadshot ? headPos : chestPos
  });
}

function startKnifeCharge() {
  if (matchGunMode) return;
  if (player.dead || roundPhase === 'roundOver' || !player.hasKnife || player.knifeCharges <= 0 || player.parryTimer > 0) return;
  cancelManualEmote();
  player.chargingThrow = true;
  player.chargeDuration = 0;
  viewmodel.startCharge();
  sfx.playChargeStart();
}

// Dual knife: the left knife is always in hand for slashing; only the right knife is thrown
function isDualKnife(skinId = profile.equippedSkin) {
  return getSkinById(skinId).type === 'dual';
}

// Salvo knives (burst_salvo_*): the clip (knifeCharges) is the rarity's magazine. A press fires the whole clip
// (max 10 knives) at 0.5 s intervals. Each knife deals 5 body damage (a full 10-knife clip = 50 = half of 100 HP).
const BURST_SALVO_MAX = 10;
const BURST_SALVO_INTERVAL = 0.5;
const BURST_SALVO_DAMAGE = 5;

function isBurstKnife(skinId = profile.equippedSkin) {
  return getSkinById(skinId).type === 'burst';
}

function releaseBurstSalvo() {
  // Unlimited clip (ASCENDANT): fire-while-held, handled in updateBurstSalvo
  if (!Number.isFinite(player.knifeMaxCharges)) return;
  if (player.burstShots > 0) return;
  const count = Math.min(player.knifeCharges, BURST_SALVO_MAX);
  if (count <= 0) return;

  if (selectedGameMode === 'duel_1v1') profile.botMemory.playerThrows++;

  // The clip is spent in one salvo; one knife comes back every knifeMaxRecharge seconds
  player.knifeCharges = Math.max(0, player.knifeCharges - count);
  if (player.knifeRecharge <= 0) player.knifeRecharge = player.knifeMaxRecharge;
  player.hasKnife = player.knifeCharges > 0;
  player.lastThrowInstant = false;

  viewmodel.playThrowRelease();
  playerChar.triggerSlashAnim(0);
  sfx.playThrow(false);
  spawnPlayerKnife({ speed: 42, rawDamage: BURST_SALVO_DAMAGE, charged: false, jitter: 0.035, burst: true });
  player.burstShots = count - 1;
  player.burstTimer = BURST_SALVO_INTERVAL;
}

function fireSalvoKnife() {
  spawnPlayerKnife({ speed: 42, rawDamage: BURST_SALVO_DAMAGE, charged: false, jitter: 0.035, burst: true });
  sfx.playThrow(false);
}

function updateBurstSalvo(dt) {
  if (!isBurstKnife()) return;

  // ASCENDANT (unlimited clip): hold the button to keep firing, one knife every 0.5 s. No ammo, no cooldown.
  if (!Number.isFinite(player.knifeMaxCharges)) {
    const held = player.chargingThrow && !player.dead && roundPhase === 'live';
    if (!held) {
      player.burstTimer = 0;
      return;
    }
    player.burstTimer -= dt;
    if (player.burstTimer <= 0) {
      player.burstTimer = BURST_SALVO_INTERVAL;
      viewmodel.playThrowRelease();
      fireSalvoKnife();
    }
    return;
  }

  // Finite clips: the salvo that was started on release continues at 0.5 s intervals
  if (!player.burstShots) return;
  if (player.dead || roundPhase !== 'live') {
    player.burstShots = 0;
    return;
  }
  player.burstTimer -= dt;
  if (player.burstTimer <= 0) {
    player.burstShots--;
    player.burstTimer += BURST_SALVO_INTERVAL;
    fireSalvoKnife();
  }
}

function releaseKnifeThrow() {
  if (!player.chargingThrow) return;
  player.chargingThrow = false;
  if (player.dead || !player.hasKnife || player.knifeCharges <= 0) return;

  if (roundPhase !== 'live') {
    viewmodel.playEquip();
    return;
  }

  if (isBurstKnife()) {
    releaseBurstSalvo();
    return;
  }

  if (selectedGameMode === 'duel_1v1') {
    profile.botMemory.playerThrows++;
  }

  const fullyCharged = player.chargeDuration >= 0.35 || player.chronoTimer > 0;
  const speed = fullyCharged ? 48 : 37;
  const rawDamage = fullyCharged ? 100 : 75; // Normal body 75–100 (Ranked scales this to 36–50 inside projectiles.js)

  // One charge is spent; the recharge timer keeps running if a spare charge is still in hand
  player.knifeCharges = Math.max(0, player.knifeCharges - 1);
  player.hasKnife = isDualKnife() || player.knifeCharges > 0;
  // Normál: cooldown • Ranked / Idő-Penge: nincs cooldown (azonnali újradobás)
  const instant = player.knifeMaxRecharge <= 0 || player.chronoTimer > 0;
  if (instant) player.knifeRecharge = 0;
  else if (player.knifeRecharge <= 0) player.knifeRecharge = player.knifeMaxRecharge;
  player.lastThrowInstant = instant;

  viewmodel.playThrowRelease();
  playerChar.triggerSlashAnim(0);
  sfx.playThrow(fullyCharged);

  if (getSkinById(profile.equippedSkin).type === 'fan') {
    // Trident Fan: three blades in a fan, each at 60% damage
    for (const yawOffset of [-0.13, 0, 0.13]) {
      spawnPlayerKnife({ speed, rawDamage: Math.round(rawDamage * 0.6), charged: fullyCharged, yawOffset });
    }
  } else {
    spawnPlayerKnife({ speed, rawDamage, charged: fullyCharged });
  }
}

function triggerPlayerParry() {
  if (player.dead || roundPhase === 'roundOver' || player.parryCd > 0 || player.parryTimer > 0) return;
  cancelManualEmote();
  player.chargingThrow = false;
  player.parryTimer = 0.46;
  player.parryCd = 1.65;
  viewmodel.playParry();
  sfx.playParryStance();
}

function triggerPlayerDash() {
  if (player.dead || roundPhase === 'roundOver' || player.dashCd > 0) return;
  cancelManualEmote();
  if (roundPhase === 'live' && selectedGameMode === 'duel_1v1') profile.botMemory.playerSlidesAndDashes++;
  player.dashCd = 2.0;
  player.dashing = true;
  player.dashTimer = 0.17;
  player.sliding = false;

  const wish = getWishMoveVector();
  if (wish.lengthSq() < 0.01) {
    wish.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  }
  player.dashDir.copy(wish.normalize());
  player.vel.x = player.dashDir.x * 21.5;
  player.vel.z = player.dashDir.z * 21.5;
  player.vel.y = Math.max(player.vel.y, 2.2);

  sfx.playDash();
  flashScreen(elFxSpeed, 200);
}

function triggerPlayerSlide() {
  if (player.dead || roundPhase === 'roundOver' || !player.grounded || player.sliding || player.slideCd > 0) return;
  cancelManualEmote();
  if (roundPhase === 'live' && selectedGameMode === 'duel_1v1') profile.botMemory.playerSlidesAndDashes++;
  const wish = getWishMoveVector();
  if (wish.lengthSq() < 0.01) {
    wish.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  }
  player.sliding = true;
  player.slideTimer = 0.52;
  player.slideCd = 0.75;
  player.slideDir.copy(wish.normalize());
  player.vel.x = player.slideDir.x * 15.8;
  player.vel.z = player.slideDir.z * 15.8;

  sfx.playSlide();
  flashScreen(elFxSpeed, 260);
}

function getPlayerLookDir() {
  const dir = new THREE.Vector3(0, 0, -1);
  dir.applyEuler(new THREE.Euler(player.pitch, player.yaw, 0, 'YXZ'));
  return dir;
}

function getWishMoveVector() {
  let fwd = 0;
  let right = 0;
  if (keys['KeyW'] || keys['ArrowUp']) fwd += 1;
  if (keys['KeyS'] || keys['ArrowDown']) fwd -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) right += 1;
  if (keys['KeyA'] || keys['ArrowLeft']) right -= 1;

  const vec = new THREE.Vector3();
  if (fwd === 0 && right === 0) return vec;

  const sin = Math.sin(player.yaw);
  const cos = Math.cos(player.yaw);
  vec.x = -sin * fwd + cos * right;
  vec.z = -cos * fwd - sin * right;
  return vec.normalize();
}

// ================= v5 THROW HELPERS (Normal 3mp CD vs Ranked 0mp CD) =================
const UP_AXIS = new THREE.Vector3(0, 1, 0);

function getPlayerPowerMult() {
  return (player.rageTimer > 0 ? 1.5 : 1) * (player.chronoTimer > 0 ? 1.25 : 1);
}

function getPlayerDamageMult() {
  return getPlayerPowerMult();
}

function getPlayerMoveMult() {
  let m = 1;
  if (player.speedBoostTimer > 0) m *= 1.35;
  if (player.chronoTimer > 0) m *= 1.25;
  if (player.vaultBoostTimer > 0) m *= 1.3;
  return m;
}

function getFlatForwardDir() {
  return new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
}

// Spawns one player knife aimed at the crosshair. Several can be airborne at once.
function spawnPlayerKnife({ speed, rawDamage, charged = false, yawOffset = 0, jitter = 0, burst = false }) {
  const camOrigin = worldCamera.position.clone();
  const camDir = new THREE.Vector3();
  worldCamera.getWorldDirection(camDir);
  const aimRay = new THREE.Raycaster(camOrigin, camDir, 0.8, 85);
  const worldHits = aimRay.intersectObjects(arena.worldMeshes, false);
  const targetPoint = worldHits.length > 0 ? worldHits[0].point.clone() : camOrigin.clone().addScaledVector(camDir, 55);

  const eyeOrigin = getPlayerAimOrigin();
  const lookDir = getPlayerLookDir();
  const rightVec = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  const spawnOrigin = eyeOrigin
    .clone()
    .addScaledVector(lookDir, 0.55)
    .addScaledVector(rightVec, 0.18)
    .add(new THREE.Vector3(0, -0.06, 0));

  const throwDir = targetPoint.sub(spawnOrigin).normalize();
  if (yawOffset) throwDir.applyAxisAngle(UP_AXIS, yawOffset);
  if (jitter) throwDir.applyAxisAngle(UP_AXIS, (Math.random() - 0.5) * jitter);

  const knife = projectiles.spawnThrownKnife({
    ownerId: 'player',
    team: playerCombatant.team,
    origin: spawnOrigin,
    direction: throwDir,
    speed,
    damage: rawDamage,
    skinId: profile.equippedSkin,
    wrapId: profile.equippedWrap,
    trailId: profile.equippedTrail,
    charged,
    burst,
    rankedThrow: matchIsRanked,
    powerMult: getPlayerPowerMult()
  });
  if (mpMatch) {
    netSendThrow({
      origin: mpVec(spawnOrigin),
      dir: mpVec(throwDir),
      speed,
      skinId: profile.equippedSkin,
      wrapId: profile.equippedWrap,
      trailId: profile.equippedTrail,
      charged,
      burst
    });
  }
  return knife;
}

// ================= v5 ABILITIES =================
function getAbilityCooldown(id) {
  return abilityCooldowns[id] || 0;
}

function floatAbilityText(text, color) {
  particles.spawnFloatingText(new THREE.Vector3(player.pos.x, player.pos.y + 2.3, player.pos.z), text, color, true);
}

function castAbilitySlot(slot) {
  const id = profile.abilityWheel[slot];
  if (!id) {
    if (appMode === 'playing' && roundPhase === 'live') {
      particles.spawnFloatingText(
        new THREE.Vector3(player.pos.x, player.pos.y + 2.3, player.pos.z),
        'EMPTY SLOT! Load an ability into the wheel',
        '#94a3b8',
        false
      );
    }
    return false;
  }
  return castAbility(id);
}

function castAbility(id) {
  const ab = getAbilityById(id);
  if (!ab || appMode !== 'playing') return false;
  if (player.dead || roundPhase !== 'live' || player.vaulting) return false;
  if (!profile.unlockedAbilities.includes(id)) return false;
  if (getAbilityCooldown(id) > 0) return false;

  cancelManualEmote();
  let ok = true;

  switch (id) {
    case 'ability_dash':
      player.dashCd = 0;
      triggerPlayerDash();
      break;
    case 'ability_adrenaline':
      player.hp = Math.min(player.maxHp, player.hp + 35);
      player.speedBoostTimer = 4.5;
      updateHealthUI();
      flashScreen(elFxSpeed, 260);
      floatAbilityText('+35 HP • +35% SPEED', '#10f587');
      break;
    case 'ability_rage':
      player.rageTimer = 5.5;
      floatAbilityText('🔥 BLOODLUST! 1.5x DAMAGE', '#ff2a55');
      break;
    case 'ability_triple_fan':
      spawnPlayerKnife({ speed: 46, rawDamage: 70, yawOffset: -0.14 });
      spawnPlayerKnife({ speed: 46, rawDamage: 70 });
      spawnPlayerKnife({ speed: 46, rawDamage: 70, yawOffset: 0.14 });
      sfx.playThrow(false);
      floatAbilityText('💠 3x FAN THROW!', '#38bdf8');
      break;
    case 'ability_shadowstep':
      ok = performShadowstep();
      break;
    case 'ability_barrage':
      player.barrageLeft = 5;
      player.barrageTimer = 0;
      floatAbilityText('🗡️ RAPID KNIFE VOLLEY!', '#fbbf24');
      break;
    case 'ability_shock_slam':
      startShockSlam();
      break;
    case 'ability_chrono_blade':
      player.chronoTimer = 6.0;
      if (player.knifeCharges < player.knifeMaxCharges) player.knifeRecharge = 0; // azonnali újratöltés
      floatAbilityText('⏳ CHRONO BLADE! ZERO CD', '#00f0ff');
      break;
    default:
      ok = false;
  }

  if (!ok) return false;
  abilityCooldowns[id] = ab.cooldown;
  sfx.playAbilityCast(id);
  return true;
}

function isPositionFree(x, z, y) {
  const r = player.radius;
  const halfW = arena.arenaW / 2 - r;
  const halfL = arena.arenaL / 2 - r;
  if (Math.abs(x) > halfW || Math.abs(z) > halfL) return false;
  for (const b of arena.boxes) {
    if (b.maxY <= 0.05) continue;
    if (y + 0.2 >= b.maxY || y + player.height - 0.1 <= b.minY) continue;
    if (x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ) return false;
  }
  return true;
}

function performShadowstep() {
  const fwd = getFlatForwardDir();
  let landing = null;
  for (let d = 9.5; d >= 1.5; d -= 0.25) {
    const x = player.pos.x + fwd.x * d;
    const z = player.pos.z + fwd.z * d;
    if (isPositionFree(x, z, player.pos.y)) {
      landing = { x, z };
      break;
    }
  }
  if (!landing) return false;

  const fromPos = new THREE.Vector3(player.pos.x, player.pos.y + 1.0, player.pos.z);
  particles.spawnShockwave(fromPos, 0x8b5cf6, 2.4);
  particles.spawnSparks(fromPos, 0xa855f7, 26, 9);

  player.pos.x = landing.x;
  player.pos.z = landing.z;
  player.vel.x = fwd.x * 6;
  player.vel.z = fwd.z * 6;

  const toPos = new THREE.Vector3(player.pos.x, player.pos.y + 1.0, player.pos.z);
  particles.spawnShockwave(toPos, 0x8b5cf6, 2.4);
  particles.spawnSparks(toPos, 0xa855f7, 26, 9);
  flashScreen(elFxSpeed, 220);
  cameraShake = 0.12;
  return true;
}

function startShockSlam() {
  player.slamming = true;
  player.slamAir = 0;
  player.grounded = false;
  player.vel.y = 11.5;
  sfx.playJump(true);
  floatAbilityText('💥 AERIAL SLAM!', '#fbbf24');
}

function updateSlamState(dt) {
  if (!player.slamming) return;
  player.slamAir += dt;
  if (!player.grounded && player.slamAir > 0.18) {
    player.vel.y = Math.min(player.vel.y, -24);
  }
  if (player.grounded && player.slamAir > 0.25) {
    player.slamming = false;
    doShockSlamImpact();
  }
}

function doShockSlamImpact() {
  const mult = getPlayerDamageMult();
  const center = new THREE.Vector3(player.pos.x, player.pos.y + 0.15, player.pos.z);
  particles.spawnShockwave(center, 0xfbbf24, 5.5);
  particles.spawnSparks(center, 0xfde68a, 36, 13);
  sfx.playHit(true, false);
  cameraShake = 0.35;
  flashScreen(elFxSpeed, 200);

  const radius = 5.5;
  for (const c of combatants) {
    if (c.isPlayer || c.state.dead || c.team === playerCombatant.team) continue;
    const d = Math.hypot(c.state.pos.x - player.pos.x, c.state.pos.z - player.pos.z);
    if (d > radius) continue;
    applyDamageToCombatant({
      attackerId: 'player',
      victim: c,
      damage: Math.round(55 * mult),
      method: 'slash'
    });
  }
}

function updateBarrage(dt) {
  if (player.barrageLeft <= 0) return;
  if (player.dead || roundPhase !== 'live') {
    player.barrageLeft = 0;
    return;
  }
  player.barrageTimer -= dt;
  if (player.barrageTimer > 0) return;
  player.barrageTimer = 0.085;
  player.barrageLeft--;
  spawnPlayerKnife({ speed: 52, rawDamage: 68, jitter: 0.05 });
  sfx.playThrow(false);
}

// ================= v5 PARKOUR VAULT =================
function findVaultCandidate() {
  if (!arena || player.dead || !player.grounded || player.vaulting || player.sliding || player.dashing) return null;
  if (roundPhase !== 'live' || appMode !== 'playing') return null;

  const fwd = getFlatForwardDir();
  const r = player.radius;
  const ox = player.pos.x;
  const oy = player.pos.y;
  const oz = player.pos.z;
  let best = null;

  for (const b of arena.boxes) {
    if (b.maxY <= 0.05) continue;
    const h = b.maxY - oy;
    if (h < VAULT_MIN_WALL_H || h > VAULT_MAX_WALL_H) continue;
    if (b.minY > oy + 0.35) continue; // floating ledge, not a ground obstacle

    // Slab test in XZ against the box expanded by the body radius
    const axes = [
      [fwd.x, ox, b.minX - r, b.maxX + r],
      [fwd.z, oz, b.minZ - r, b.maxZ + r]
    ];
    let tEnter = -Infinity;
    let tExit = Infinity;
    let miss = false;
    for (const [d, o, lo, hi] of axes) {
      if (Math.abs(d) < 1e-5) {
        if (o < lo || o > hi) {
          miss = true;
          break;
        }
        continue;
      }
      let t1 = (lo - o) / d;
      let t2 = (hi - o) / d;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tEnter = Math.max(tEnter, t1);
      tExit = Math.min(tExit, t2);
    }
    if (miss || tExit <= tEnter) continue;
    if (tEnter < 0 || tEnter > VAULT_REACH) continue;

    const thick = Math.max(0, tExit - tEnter - 2 * r);
    const mantle = thick > VAULT_MAX_THICK;

    let target;
    if (mantle) {
      // Thick platform: climb onto its top surface
      const landT = tEnter + 0.95;
      target = { x: ox + fwd.x * landT, y: b.maxY, z: oz + fwd.z * landT };
    } else {
      // Thin wall: vault over to the far side
      const landT = tExit + 0.7;
      target = { x: ox + fwd.x * landT, y: oy, z: oz + fwd.z * landT };
    }

    if (!isPositionFree(target.x, target.z, target.y + 0.02)) continue;

    if (!best || tEnter < best.enter) {
      best = {
        enter: tEnter,
        target,
        mantle,
        height: h,
        dir: { x: fwd.x, z: fwd.z }
      };
    }
  }
  return best;
}

function startVault(c) {
  player.vaulting = true;
  player.vaultCandidate = null;
  player.vaultData = {
    from: { x: player.pos.x, y: player.pos.y, z: player.pos.z },
    to: { x: c.target.x, y: c.target.y, z: c.target.z },
    dir: c.dir,
    mantle: c.mantle,
    arc: Math.max(0.55, c.height + 0.4),
    duration: c.mantle ? 0.55 : 0.46,
    elapsed: 0
  };
  player.vel.set(c.dir.x * 6, 0, c.dir.z * 6);
  player.grounded = false;
  cancelManualEmote();
  viewmodel.playVault();
  sfx.playVault();
  flashScreen(elFxSpeed, 180);
}

function tryStartVault() {
  const c = player.vaultCandidate;
  if (!c || player.vaulting || player.dead || !player.grounded || roundPhase !== 'live') return false;
  startVault(c);
  return true;
}

function updateVault(dt) {
  const v = player.vaultData;
  if (!v) {
    player.vaulting = false;
    return;
  }
  v.elapsed += dt;
  const t = Math.min(1, v.elapsed / v.duration);
  const e = t * t * (3 - 2 * t); // smoothstep
  const arcT = Math.sin(Math.PI * t);

  player.pos.x = v.from.x + (v.to.x - v.from.x) * e;
  player.pos.z = v.from.z + (v.to.z - v.from.z) * e;
  if (v.mantle) {
    player.pos.y = v.from.y + (v.to.y - v.from.y) * e + arcT * 0.45;
  } else {
    player.pos.y = v.from.y + (v.to.y - v.from.y) * t + arcT * v.arc;
  }
  player.vaultTilt = arcT * 0.09;
  player.vel.set(v.dir.x * 6, 0, v.dir.z * 6);
  player.grounded = false;

  if (t >= 1) {
    player.pos.set(v.to.x, v.to.y, v.to.z);
    player.vaulting = false;
    player.vaultData = null;
    player.grounded = true;
    player.jumpsLeft = 2;
    // Exit speed boost
    player.vel.set(v.dir.x * 13, 0, v.dir.z * 13);
    player.vaultBoostTimer = 0.7;
    flashScreen(elFxSpeed, 220);
    particles.spawnShockwave(new THREE.Vector3(player.pos.x, player.pos.y + 0.1, player.pos.z), 0x00f0ff, 1.4);
  }
}

// ================= v5 CIRCULAR ABILITY WHEEL (IN-MATCH) =================
function openRadialWheel(source) {
  if (wheel.open || appMode !== 'playing' || player.dead || roundPhase !== 'live') return;
  wheel.open = true;
  wheel.holdSource = source;
  wheel.pointerX = 0;
  wheel.pointerY = 0;
  wheel.hovered = -1;
  player.chargingThrow = false;
  elRadialOverlay.classList.remove('hidden');
  refreshRadialWheel();
}

function closeRadialWheel(commit) {
  if (!wheel.open) return;
  if (commit && wheel.hovered >= 0) setActiveWheelSlot(wheel.hovered);
  wheel.open = false;
  wheel.holdSource = null;
  wheel.hovered = -1;
  elRadialOverlay.classList.add('hidden');
}

function setActiveWheelSlot(slot) {
  profile.activeWheelSlot = slot;
  saveProfile(profile);
  sfx.playInspectClick();
  refreshAbilityHud();
  const ab = getAbilityById(profile.abilityWheel[slot]);
  if (appMode === 'playing' && ab) {
    floatAbilityText(`${ab.icon} ${ab.shortName} ACTIVE`, '#00f0ff');
  }
}

function getWheelHoverSlot() {
  const len = Math.hypot(wheel.pointerX, wheel.pointerY);
  if (len < 40) return -1;
  const angle = (Math.atan2(wheel.pointerY, wheel.pointerX) * 180) / Math.PI; // 0 = right, 90 = down
  const rel = (((angle + 90) % 360) + 360) % 360; // 0 = top
  return Math.round(rel / 90) % 4;
}

function updateWheelPointerFromMouse(e) {
  if (isPointerLocked) {
    wheel.pointerX += e.movementX || 0;
    wheel.pointerY += e.movementY || 0;
  } else {
    const rect = elRadialOverlay.getBoundingClientRect();
    wheel.pointerX = e.clientX - (rect.left + rect.width / 2);
    wheel.pointerY = e.clientY - (rect.top + rect.height / 2);
  }
  const len = Math.hypot(wheel.pointerX, wheel.pointerY);
  const maxLen = 150;
  if (len > maxLen) {
    wheel.pointerX *= maxLen / len;
    wheel.pointerY *= maxLen / len;
  }
  wheel.hovered = getWheelHoverSlot();
}

function refreshRadialWheel() {
  for (let i = 0; i < 4; i++) {
    const ab = getAbilityById(profile.abilityWheel[i]);
    const cd = ab ? getAbilityCooldown(ab.id) : 0;
    document.getElementById(`rn-icon-${i}`).textContent = ab ? ab.icon : '➕';
    document.getElementById(`rn-name-${i}`).textContent = ab ? ab.shortName : 'Empty';
    const cdEl = document.getElementById(`rn-cd-${i}`);
    if (!ab) {
      cdEl.textContent = '—';
      cdEl.classList.remove('on-cd');
    } else if (cd > 0) {
      cdEl.textContent = `${cd.toFixed(1)}s`;
      cdEl.classList.add('on-cd');
    } else {
      cdEl.textContent = 'READY';
      cdEl.classList.remove('on-cd');
    }
    elRadialNodes[i].classList.toggle('hovered', wheel.hovered === i);
    elRadialNodes[i].classList.toggle('equipped-slot', profile.activeWheelSlot === i);
  }

  const hovered = wheel.hovered >= 0 ? getAbilityById(profile.abilityWheel[wheel.hovered]) : null;
  document.getElementById('rc-title').textContent = hovered ? hovered.shortName : 'ABILITY WHEEL';
  elRcSub.textContent = hovered
    ? `${hovered.cooldown}s CD • click / release`
    : 'Move the mouse to choose.';
  elRcPointer.style.transform = `translate(${wheel.pointerX * 0.4}px, ${wheel.pointerY * 0.4}px)`;
}

function refreshAbilityHud() {
  const slot = profile.activeWheelSlot ?? 0;
  const ab = getAbilityById(profile.abilityWheel[slot]);
  elAbIcon.textContent = ab ? ab.icon : '➕';
  elAbTitle.textContent = ab ? ab.shortName : 'Empty';
  const cd = ab ? getAbilityCooldown(ab.id) : 0;
  if (cd > 0) {
    elCdAbility.classList.remove('hidden');
    elCdAbility.textContent = cd.toFixed(1);
  } else {
    elCdAbility.classList.add('hidden');
  }
}

function updateV5HUD() {
  refreshAbilityHud();
  if (wheel.open) refreshRadialWheel();

  const buffs = [];
  if (player.rageTimer > 0) buffs.push(`🔥 1.5x BLOODLUST: ${player.rageTimer.toFixed(1)}s`);
  if (player.chronoTimer > 0) buffs.push(`⏳ CHRONO BLADE: ${player.chronoTimer.toFixed(1)}s`);
  if (player.speedBoostTimer > 0) buffs.push(`💉 +35% SPEED: ${player.speedBoostTimer.toFixed(1)}s`);
  if (buffs.length > 0) {
    elBuffPill.textContent = buffs.join(' • ');
    elBuffPill.classList.remove('hidden');
  } else {
    elBuffPill.classList.add('hidden');
  }

  const rageOn = player.rageTimer > 0 && !player.dead;
  elFxRage.style.opacity = rageOn ? String(0.55 + Math.sin(performance.now() * 0.012) * 0.2) : '0';

  const showVault = !!player.vaultCandidate && !player.vaulting && !player.dead && roundPhase === 'live';
  elVaultPrompt.classList.toggle('hidden', !showVault);
}

// ================= v5 MENU: QUEUE, WHEEL STRIP & WHEEL EDITOR =================
function syncQueueButtons() {
  elQueueNormal.classList.toggle('active', selectedQueue === 'normal');
  elQueueRanked.classList.toggle('active', selectedQueue === 'ranked');
}

function setQueue(queue) {
  selectedQueue = queue;
  if (queue === 'ranked') selectGameMode('duel_1v1'); // Ranked = 1v1 Párbaj only
  syncQueueButtons();
  refreshMenuProfileUI();
}

function renderMenuWheelStrip() {
  if (!elMenuWheelStrip) return;
  elMenuWheelStrip.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const ab = getAbilityById(profile.abilityWheel[i]);
    const d = document.createElement('div');
    d.className = 'mini-wslot';
    d.textContent = `${i + 1}. ${ab ? `${ab.icon} ${ab.shortName}` : '➕ Empty'}`;
    elMenuWheelStrip.appendChild(d);
  }
}

// Places an unlocked ability into the first empty wheel slot (used by Dropboxes)
function autoSlotAbility(id) {
  const w = profile.abilityWheel;
  if (w.includes(id)) return true;
  const empty = w.findIndex((x) => !x);
  if (empty >= 0) {
    w[empty] = id;
    saveProfile(profile);
    return true;
  }
  return false;
}

function rollCrateResult(box) {
  if (box.isAbilityBox) return rollAbilityDropbox();
  if (box.isGunBox) return rollGunDropbox();
  if (box.isCosmeticBox) return rollCosmeticDropbox();
  return rollDropbox(box.id);
}

function openWheelModal() {
  if (isSpinningDropbox) return;
  elArmoryModal.classList.add('hidden');
  elDropboxModal.classList.add('hidden');
  wheelEditorSlot = profile.activeWheelSlot ?? 0;
  elWheelModal.classList.remove('hidden');
  renderWheelEditor();
}

function closeWheelModal() {
  elWheelModal.classList.add('hidden');
  refreshMenuProfileUI();
}

function equipAbilityToSlot(slot, id) {
  const w = profile.abilityWheel;
  const existing = w.indexOf(id);
  if (existing === slot) return;
  if (existing >= 0) w[existing] = w[slot]; // swap: no duplicate abilities on the wheel
  w[slot] = id;
  saveProfile(profile);
  sfx.playKnifePickup();
  renderWheelEditor();
}

function renderWheelEditor() {
  document.getElementById('wheel-cash').textContent = profile.cash;
  for (let i = 0; i < 4; i++) {
    const btn = document.getElementById(`ewedge-${i}`);
    const ab = getAbilityById(profile.abilityWheel[i]);
    btn.innerHTML = `<span style="font-size:1.25rem;line-height:1">${ab ? ab.icon : '➕'}</span><span style="font-size:0.64rem;font-weight:900">${ab ? ab.shortName : 'Empty'}</span>`;
    btn.classList.toggle('active', i === wheelEditorSlot);
  }
  elEditorCenter.innerHTML = `${WHEEL_SLOT_NAMES[wheelEditorSlot]}<br /><small>Selected</small>`;

  elAbilityCatalog.innerHTML = '';
  for (const ab of ABILITIES) {
    const unlocked = profile.unlockedAbilities.includes(ab.id);
    const slotIdx = profile.abilityWheel.indexOf(ab.id);
    const card = document.createElement('div');
    card.className = 'ability-card' + (unlocked ? '' : ' locked');
    if (unlocked) card.style.borderColor = ab.rarityColor;
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
        <strong style="color:${ab.rarityColor};font-size:0.82rem">${ab.icon} ${ab.shortName}</strong>
        <span class="rarity-pill" style="color:${ab.rarityColor}">${ab.rarity}</span>
      </div>
      <div style="font-size:0.7rem;color:#cbd5e1;line-height:1.3">${ab.desc}</div>
      <div style="font-size:0.66rem;color:#94a3b8">⏱ ${ab.cooldown}s CD${slotIdx >= 0 ? ` • Slot: ${slotIdx + 1}` : ''}${unlocked ? '' : ' • 🔒 Locked (Ability Crate)'}</div>
    `;
    card.addEventListener('click', () => {
      if (!unlocked) {
        elEditorCenter.innerHTML = '🔒 Open an Ability Crate first!';
        sfx.playHurt();
        return;
      }
      equipAbilityToSlot(wheelEditorSlot, ab.id);
    });
    elAbilityCatalog.appendChild(card);
  }
}

// ================= v5 WHEEL & QUEUE WIRING =================
elRadialNodes.forEach((node, i) => {
  node.addEventListener('click', (e) => {
    e.stopPropagation();
    wheel.hovered = i;
    closeRadialWheel(true);
  });
});

elMenuWheelStrip.addEventListener('click', () => {
  sfx.init();
  sfx.playInspectClick();
  openWheelModal();
});
document.getElementById('btn-open-wheel').addEventListener('click', () => {
  sfx.init();
  sfx.playInspectClick();
  openWheelModal();
});
document.getElementById('btn-armory-to-wheel').addEventListener('click', () => {
  sfx.playInspectClick();
  openWheelModal();
});
document.getElementById('btn-close-wheel').addEventListener('click', () => {
  sfx.playInspectClick();
  closeWheelModal();
});
document.getElementById('btn-clear-wheel-slot').addEventListener('click', () => {
  profile.abilityWheel[wheelEditorSlot] = null;
  saveProfile(profile);
  sfx.playInspectClick();
  renderWheelEditor();
});
document.getElementById('btn-wheel-to-dropbox').addEventListener('click', () => {
  closeWheelModal();
  selectedBoxId = ABILITY_DROPBOX.id;
  openDropboxModal();
});
for (let i = 0; i < 4; i++) {
  document.getElementById(`ewedge-${i}`).addEventListener('click', () => {
    wheelEditorSlot = i;
    sfx.playInspectClick();
    renderWheelEditor();
  });
}
document.getElementById('btn-queue-normal').addEventListener('click', () => {
  sfx.init();
  sfx.playInspectClick();
  setQueue('normal');
});
document.getElementById('btn-queue-ranked').addEventListener('click', () => {
  sfx.init();
  sfx.playInspectClick();
  setQueue('ranked');
});

// ================= CONTROLS PANEL (J) =================
const elControlsOverlay = document.getElementById('controls-overlay');
function toggleControlsPanel(force) {
  if (!elControlsOverlay) return;
  const show = typeof force === 'boolean' ? force : elControlsOverlay.classList.contains('hidden');
  elControlsOverlay.classList.toggle('hidden', !show);
}
document.getElementById('btn-open-controls')?.addEventListener('click', () => toggleControlsPanel(true));
elControlsOverlay?.addEventListener('click', (e) => {
  if (e.target === elControlsOverlay) toggleControlsPanel(false);
});
window.addEventListener('keydown', (e) => {
  if (e.code !== 'KeyJ' || e.repeat) return;
  if (e.target && e.target.tagName === 'INPUT') return; // don't steal typing in number fields
  toggleControlsPanel();
});

// ================= INPUT LISTENERS =================
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;

  if (e.code === 'F11') {
    e.preventDefault();
    toggleFullscreen();
    return;
  }

  if (e.code === 'F1' || e.code === 'F2') {
    // F1 = first-person (FPS), F2 = third-person (TPS)
    e.preventDefault();
    if (!e.repeat) setCameraMode(e.code === 'F1' ? 'first' : 'third');
    return;
  }

  if (e.code === 'Escape') {
    if (!elWheelModal.classList.contains('hidden')) {
      closeWheelModal();
      return;
    }
    if (wheel.open) {
      closeRadialWheel(false);
      return;
    }
    if (!elDropboxModal.classList.contains('hidden') && !isSpinningDropbox) {
      elDropboxModal.classList.add('hidden');
      return;
    }
    if (!elArmoryModal.classList.contains('hidden')) {
      elArmoryModal.classList.add('hidden');
      return;
    }
    if (appMode === 'menu' && !elPauseModal.classList.contains('hidden')) {
      elPauseModal.classList.add('hidden');
      return;
    }
    if (appMode === 'playing') pauseGame();
    else if (appMode === 'paused') resumeGame();
    return;
  }

  if (appMode !== 'playing') return;

  if (e.code === 'Tab') {
    e.preventDefault();
    if (!e.repeat) {
      if (wheel.open) closeRadialWheel(true);
      else openRadialWheel('tab');
    }
    return;
  }

  if (e.code === 'KeyQ') {
    // Tap = cast active ability • Hold = open circular wheel
    if (!e.repeat && !wheel.open) {
      wheel.qPending = true;
      wheel.qHold = 0;
    }
    return;
  }

  if (/^Digit[1-4]$/.test(e.code)) {
    const idx = Number(e.code.slice(5)) - 1;
    if (wheel.open) {
      wheel.hovered = idx;
      closeRadialWheel(true);
    } else {
      setActiveWheelSlot(idx);
      castAbilitySlot(idx);
    }
    return;
  }

  if (e.code === 'KeyV') {
    toggleCameraMode();
    return;
  }

  // Emote hotkeys during a match
  if (EMOTE_HOTKEYS[e.code] && appMode === 'playing' && !e.repeat && !player.dead && roundPhase !== 'roundOver') {
    const emoteId = EMOTE_HOTKEYS[e.code];
    if (emoteId === 'rpg_launch') {
      if (!isEmoteOwned('rpg_launch')) {
        particles.spawnFloatingText(playerChar.getChestWorldCenter(), '🔒 Win it in the Arsenal Crate', '#ffc83b', true);
        return;
      }
      if (!matchGunMode) {
        particles.spawnFloatingText(playerChar.getChestWorldCenter(), '🚀 RPG: Gun Mode only', '#ffc83b', true);
        return;
      }
    }
    if (emoteId.startsWith('mj:') && !isEmoteOwned(emoteId.slice(3))) {
      particles.spawnFloatingText(playerChar.getChestWorldCenter(), '🔒 Buy it in the Armory', '#ffc83b', true);
      return;
    }
    playEmoteNow(emoteId);
    return;
  }

  if (e.code === 'KeyG' && !player.dead && roundPhase !== 'roundOver') {
    playEmoteNow(profile.settings.victoryEmote || 'blade_flourish');
    return;
  }

  // Dojo Controls: [R] 30s Challenge, [T] Parry Turret Toggle!
  if (matchGunMode && appMode === 'playing') {
    if (e.code === 'KeyR') { startGunReload(); return; }
    if (e.code === 'KeyY') { cycleGunInMatch(); return; }
  }
  if (selectedGameMode === 'training_dojo') {
    if (e.code === 'KeyR' && !dojo.challengeActive) {
      dojo.startChallenge();
      showBanner('⏱️ 30 S RECORD CHALLENGE!', 'AIM AT THE YELLOW ROBLOX HEADS AND PARRY!', '#ffc83b');
      setTimeout(() => { if (appMode === 'playing') hideBanner(); }, 950);
      return;
    }
    if (e.code === 'KeyT') {
      const on = dojo.toggleParryTrainer();
      particles.spawnFloatingText(
        new THREE.Vector3(0, 4.2, -1.2),
        on ? '⚡ PARRY CANNON: ON' : '⏸️ PARRY CANNON: OFF',
        '#00f0ff',
        true
      );
      return;
    }
  }

  if (e.code === 'Space') {
    e.preventDefault();
    if (player.dead && selectedGameMode === 'ffa_storm' && roundPhase === 'live' && !mpMatch) {
      // Allow skipping spectator straight to FFA Summary if desired!
      finishMatch();
      return;
    }
    cancelManualEmote();
    if (tryStartVault()) {
      // Vault replaces the jump when a wall/ledge is in front of you
    } else if (!player.vaulting && !player.dead && roundPhase !== 'roundOver' && player.jumpsLeft > 0) {
      const isDouble = !player.grounded;
      if (player.sliding) {
        player.sliding = false;
        player.vel.x *= 1.12;
        player.vel.z *= 1.12;
      }
      player.vel.y = isDouble ? 10.6 : 10.2;
      player.grounded = false;
      player.jumpsLeft--;
      sfx.playJump(isDouble);
    }
  } else if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
    triggerPlayerSlide();
  } else if (e.code === 'KeyE') {
    triggerPlayerParry();
  } else if (e.code === 'KeyF') {
    if (player.hasKnife) viewmodel.playInspect();
  }
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;

  if (e.code === 'KeyQ') {
    const wasPending = wheel.qPending;
    wheel.qPending = false;
    if (wheel.open && wheel.holdSource === 'q') {
      closeRadialWheel(true);
    } else if (wasPending && appMode === 'playing' && wheel.qHold < 0.2) {
      castAbilitySlot(profile.activeWheelSlot ?? 0);
    }
  }
});

window.addEventListener(
  'wheel',
  (e) => {
    if (appMode !== 'playing' || roundPhase === 'roundOver') return;
    const step = e.deltaY > 0 ? 0.55 : -0.55;
    if (profile.settings.cameraMode === 'first' && step > 0) {
      profile.settings.tpsDistance = 2.4;
      setCameraMode('third');
    } else if (profile.settings.cameraMode === 'third') {
      const nextDist = profile.settings.tpsDistance + step;
      if (nextDist < 1.55) {
        setCameraMode('first');
      } else {
        profile.settings.tpsDistance = Math.min(6.2, nextDist);
        saveProfile(profile);
      }
    }
  },
  { passive: true }
);

canvas.addEventListener('mousedown', (e) => {
  if (appMode !== 'playing') return;
  sfx.init();

  if (wheel.open) {
    if (e.button === 0) closeRadialWheel(true);
    return;
  }

  if (!isPointerLocked) {
    lockMouse();
    fallbackDragActive = true;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
  }

  // Cycle Spectator Target when dead in 2v2 / 4v4 / FFA!
  if (player.dead && roundPhase === 'live' && e.button === 0) {
    spectateIndex++;
    sfx.playInspectClick();
    return;
  }

  if (e.button === 0) {
    if (matchGunMode) { gunHeld = true; firePlayerGun(); } else performPlayerSlash();
  } else if (e.button === 2) {
    startKnifeCharge();
  } else if (e.button === 1) {
    e.preventDefault();
    triggerPlayerParry();
  }
});

window.addEventListener('mouseup', (e) => {
  fallbackDragActive = false;
  if (e.button === 0) gunHeld = false;
  if (appMode !== 'playing') return;
  if (e.button === 2) {
    releaseKnifeThrow();
  }
});

window.addEventListener('mousemove', (e) => {
  if (appMode !== 'playing') return;
  if (wheel.open) {
    updateWheelPointerFromMouse(e);
    return;
  }

  let dx = 0;
  let dy = 0;
  if (isPointerLocked) {
    dx = e.movementX || 0;
    dy = e.movementY || 0;
  } else if (fallbackDragActive) {
    dx = e.clientX - lastPointerX;
    dy = e.clientY - lastPointerY;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
  } else {
    return;
  }

  const sens = 0.0022 * profile.settings.sensitivity;
  player.yaw -= dx * sens;
  player.pitch = THREE.MathUtils.clamp(player.pitch - dy * sens, -Math.PI * 0.46, Math.PI * 0.46);
  viewmodel.addMouseSway(dx, dy);
});

window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  worldCamera.aspect = w / h;
  worldCamera.updateProjectionMatrix();
  viewmodel.setAspect(w / h);
  if (!elArmoryModal.classList.contains('hidden')) {
    resizeArmoryCanvas();
  }
});

// ================= UPDATE SIMULATION =================
let currentEyeOffset = 1.75;

function updatePlayer(dt) {
  if (player.slashCd > 0) player.slashCd -= dt;
  updateTutorial(dt);
  updateKnifeHeal(dt);
  updateBurstSalvo(dt);
  updateGunState(dt);
  if (player.comboResetTimer > 0) player.comboResetTimer -= dt;
  if (player.slideCd > 0) player.slideCd -= dt;
  if (player.dashCd > 0) player.dashCd -= dt;
  if (player.parryTimer > 0) player.parryTimer -= dt;
  if (player.parryCd > 0) player.parryCd -= dt;

  // v5 timers (buffs, ability cooldowns, barrage, vault tilt)
  player.vaultCandidate = null;
  player.rageTimer = Math.max(0, player.rageTimer - dt);
  player.chronoTimer = Math.max(0, player.chronoTimer - dt);
  player.speedBoostTimer = Math.max(0, player.speedBoostTimer - dt);
  player.vaultBoostTimer = Math.max(0, player.vaultBoostTimer - dt);
  if (!player.vaulting) player.vaultTilt = THREE.MathUtils.lerp(player.vaultTilt, 0, Math.min(1, dt * 10));
  for (const id of Object.keys(abilityCooldowns)) {
    if (abilityCooldowns[id] > 0) abilityCooldowns[id] = Math.max(0, abilityCooldowns[id] - dt);
  }
  updateBarrage(dt);

  if (roundPhase === 'live' && selectedGameMode === 'duel_1v1' && !laneRecordedThisRound && player.pos.z < 7.5) {
    laneRecordedThisRound = true;
    if (player.pos.x < -4.5) profile.botMemory.laneLeft++;
    else if (player.pos.x > 4.5) profile.botMemory.laneRight++;
    else profile.botMemory.laneMid++;
  }

  if (player.knifeCharges < player.knifeMaxCharges && !player.burstShots) {
    player.knifeRecharge -= dt;
    if (player.knifeRecharge <= 0) {
      player.knifeCharges++;
      player.hasKnife = true;
      // Next charge starts its own timer while any are still missing
      player.knifeRecharge = player.knifeCharges < player.knifeMaxCharges ? player.knifeMaxRecharge : 0;
      projectiles.removePlayerStuckKnives();
      if (!player.lastThrowInstant) {
        viewmodel.playEquip();
        sfx.playKnifePickup();
      }
    }
  }

  if (player.chargingThrow) {
    player.chargeDuration += dt;
  }

  const barrierSide =
    selectedGameMode === 'ffa_storm' || selectedGameMode === 'training_dojo' ? 'none' : 'blue';

  // Freeze player on spawn pad during FFA 3-2-1 Countdown so nobody gets a head start!
  if (roundPhase === 'countdown' && selectedGameMode === 'ffa_storm') {
    player.vel.set(0, 0, 0);
    return;
  }

  player.vel.y -= 28 * dt;

  if (player.vaulting) {
    if (player.dead) {
      player.vaulting = false;
      player.vaultData = null;
    } else {
      updateVault(dt);
      return;
    }
  }

  if (roundPhase === 'roundOver' && !player.dead) {
    player.vel.x *= Math.max(0, 1 - 10 * dt);
    player.vel.z *= Math.max(0, 1 - 10 * dt);
    resolveArenaPhysics(player, arena, dt, barrierSide);
    return;
  }

  if (player.dead) {
    player.vel.x *= Math.max(0, 1 - 6 * dt);
    player.vel.z *= Math.max(0, 1 - 6 * dt);
    resolveArenaPhysics(player, arena, dt, barrierSide);
    currentEyeOffset = THREE.MathUtils.lerp(currentEyeOffset, 0.45, dt * 8);
    return;
  }

  const wish = getWishMoveVector();
  if (wish.lengthSq() > 0.01) {
    cancelManualEmote();
  }

  if (player.dashing) {
    player.dashTimer -= dt;
    player.vel.x = player.dashDir.x * 21.5;
    player.vel.z = player.dashDir.z * 21.5;
    if (player.dashTimer <= 0) player.dashing = false;
  } else if (player.sliding) {
    player.slideTimer -= dt;
    player.vel.x *= Math.max(0, 1 - 1.2 * dt);
    player.vel.z *= Math.max(0, 1 - 1.2 * dt);
    if (player.slideTimer <= 0) player.sliding = false;
  } else {
    const sprinting = (keys['ShiftLeft'] || keys['ShiftRight']) && !player.chargingThrow && player.grounded;
    const moveSpeed = (player.chargingThrow ? 8.4 : sprinting ? SPRINT_SPEED : 10.4) * getPlayerMoveMult();
    const accel = player.grounded ? 15 : 6.5;
    player.vel.x = THREE.MathUtils.lerp(player.vel.x, wish.x * moveSpeed, Math.min(1, dt * accel));
    player.vel.z = THREE.MathUtils.lerp(player.vel.z, wish.z * moveSpeed, Math.min(1, dt * accel));
  }

  const hitPad = resolveArenaPhysics(player, arena, dt, barrierSide);
  if (player.grounded) player.jumpsLeft = 2;
  if (hitPad) {
    player.jumpsLeft = 1;
    sfx.playJumpPad();
    flashScreen(elFxSpeed, 220);
  }

  updateSlamState(dt);
  player.vaultCandidate = findVaultCandidate();

  const targetEye = player.sliding ? 0.95 : 1.75;
  currentEyeOffset = THREE.MathUtils.lerp(currentEyeOffset, targetEye, Math.min(1, dt * 16));
}

function updateCameraSystem(rawDt, dt) {
  cameraShake = Math.max(0, cameraShake - rawDt * 1.4);
  const shakeX = (Math.random() - 0.5) * cameraShake * 0.25;
  const shakeY = (Math.random() - 0.5) * cameraShake * 0.25;

  // 1) SMOOTH ROUND-POINT / VICTORY SHOWCASE CAMERA
  if (roundPhase === 'roundOver' && roundShowcaseCombatant && !roundShowcaseCombatant.state.dead) {
    playerChar.root.visible = true;
    elCrosshair.classList.add('hidden');
    elSpectatorPill.classList.add('hidden');

    cineOrbitTime += rawDt;
    const wPos = roundShowcaseCombatant.state.pos;
    const wYaw = roundShowcaseCombatant.state.yaw;

    const sweepAngle = wYaw + Math.sin(cineOrbitTime * 0.85) * 0.55 + 0.28;
    const frontDir = new THREE.Vector3(-Math.sin(sweepAngle), 0, -Math.cos(sweepAngle));
    const focusPoint = new THREE.Vector3(wPos.x, wPos.y + 1.45, wPos.z);

    let desiredDist = 3.55;
    const rayDir = frontDir.clone().setY(0.16).normalize();
    camCollisionRay.set(focusPoint, rayDir);
    camCollisionRay.far = desiredDist + 0.35;
    const wallHits = camCollisionRay.intersectObjects(arena.worldMeshes, false);
    if (wallHits.length > 0) {
      desiredDist = Math.max(1.35, wallHits[0].distance - 0.32);
    }

    const desiredPos = focusPoint.clone().addScaledVector(rayDir, desiredDist);
    const smoothAlpha = 1 - Math.exp(-5.8 * rawDt);
    cineCamPos.lerp(desiredPos, smoothAlpha);
    cineLookTarget.lerp(focusPoint, smoothAlpha);

    worldCamera.position.copy(cineCamPos);
    worldCamera.lookAt(cineLookTarget);
    return false;
  }

  // 2) SPECTATOR CAMERA (When Player dies in 2v2, 4v4, or FFA while fighters remain!)
  if (player.dead && roundPhase === 'live') {
    const candidates =
      selectedGameMode === 'ffa_storm'
        ? combatants.filter((c) => !c.isPlayer && !c.state.dead)
        : combatants.filter((c) => !c.isPlayer && c.team === 'blue' && !c.state.dead);

    if (candidates.length > 0) {
      const spec = candidates[spectateIndex % candidates.length];
      elSpectatorPill.classList.remove('hidden');
      elSpecName.textContent =
        selectedGameMode === 'ffa_storm'
          ? `${spec.name} • [SPACE] Scoreboard`
          : spec.name;
      elCrosshair.classList.add('hidden');

      const backDir = new THREE.Vector3(Math.sin(player.yaw), 0.35, Math.cos(player.yaw)).normalize();
      const focus = new THREE.Vector3(spec.state.pos.x, spec.state.pos.y + 1.6, spec.state.pos.z);
      const camTarget = focus.clone().addScaledVector(backDir, 4.2);
      worldCamera.position.lerp(camTarget, 1 - Math.exp(-10 * rawDt));
      worldCamera.lookAt(focus);
      return false;
    }
  }
  elSpectatorPill.classList.add('hidden');
  elCrosshair.classList.remove('hidden');

  // 3) GAMEPLAY CAMERA: SMOOTH FIRST-PERSON <-> THIRD-PERSON
  const wantThird = profile.settings.cameraMode === 'third' || manualEmoteActive;
  const targetDist = wantThird ? profile.settings.tpsDistance : 0;
  currentCamDist = THREE.MathUtils.lerp(currentCamDist, targetDist, 1 - Math.exp(-16 * rawDt));

  if (currentCamDist > 0.32) {
    playerChar.root.visible = true;

    const lookDir = getPlayerLookDir();
    const rightVec = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
    const shoulderScale = Math.min(1, currentCamDist / 3.2);

    const headAnchor = new THREE.Vector3(player.pos.x, player.pos.y + currentEyeOffset + 0.2, player.pos.z);
    const shoulderPivot = headAnchor.clone().addScaledVector(rightVec, 0.58 * shoulderScale);
    const desiredCamPos = shoulderPivot.clone().addScaledVector(lookDir, -currentCamDist);

    const toCam = desiredCamPos.clone().sub(headAnchor);
    const toCamLen = toCam.length();
    if (toCamLen > 0.05) {
      camCollisionRay.set(headAnchor, toCam.clone().normalize());
      camCollisionRay.far = toCamLen + 0.25;
      const hits = camCollisionRay.intersectObjects(arena.worldMeshes, false);
      if (hits.length > 0 && hits[0].distance < toCamLen) {
        desiredCamPos.copy(headAnchor).addScaledVector(toCam.normalize(), Math.max(0.45, hits[0].distance - 0.26));
      }
    }

    worldCamera.position.set(desiredCamPos.x + shakeX, desiredCamPos.y + shakeY, desiredCamPos.z);
    worldCamera.rotation.order = 'YXZ';
    worldCamera.rotation.y = player.yaw;
    worldCamera.rotation.x = player.pitch;
    worldCamera.rotation.z = player.vaultTilt || 0;
    return false;
  } else {
    playerChar.root.visible = false;
    const slideTilt = player.sliding ? -0.065 : 0;

    worldCamera.position.set(
      player.pos.x + shakeX,
      player.pos.y + currentEyeOffset + shakeY,
      player.pos.z
    );
    worldCamera.rotation.order = 'YXZ';
    worldCamera.rotation.y = player.yaw;
    worldCamera.rotation.x = player.pitch;
    worldCamera.rotation.z = THREE.MathUtils.lerp(worldCamera.rotation.z, slideTilt + (player.vaultTilt || 0), Math.min(1, dt * 12));
    return true;
  }
}

function updateHUD() {
  if (player.chargingThrow) {
    elCrosshair.classList.add('charging');
    const pct = Math.min(1, player.chargeDuration / 0.35);
    const circumference = 150.8;
    elChargeBar.style.strokeDashoffset = String(circumference * (1 - pct));
    elChargeBar.style.stroke = pct >= 1 ? '#ffc83b' : '#00f0ff';
  } else {
    elCrosshair.classList.remove('charging');
    elChargeBar.style.strokeDashoffset = '150.8';
  }

  if (roundPhase === 'roundOver' || player.dead) {
    elKnifeReloadPill.classList.add('hidden');
  } else if (player.knifeCharges <= 0) {
    elKnifeReloadPill.classList.remove('hidden');
    elKnifeReloadPill.style.color = '#ffc83b';
    elKnifeReloadPill.textContent = `RELOADING ${player.knifeRecharge.toFixed(1)}s`;
    elSlotSlashLabel.textContent = 'Slash';
    elCdThrow.classList.remove('hidden');
    elCdThrow.textContent = player.knifeRecharge.toFixed(1);
  } else if (player.chargingThrow && player.chargeDuration >= 0.35) {
    elKnifeReloadPill.classList.remove('hidden');
    elKnifeReloadPill.style.color = '#10f587';
    elKnifeReloadPill.textContent = '⚡ MAX POWER — 1-SHOT THROW! (Headshot = 150 DMG!)';
    elSlotSlashLabel.textContent = 'Slash';
    elCdThrow.classList.add('hidden');
  } else if (!isPointerLocked) {
    elKnifeReloadPill.classList.remove('hidden');
    elKnifeReloadPill.style.color = '#00f0ff';
    elKnifeReloadPill.textContent = '🖱️ Click the game to lock the mouse';
    elSlotSlashLabel.textContent = 'Slash';
    elCdThrow.classList.add('hidden');
  } else {
    elKnifeReloadPill.classList.add('hidden');
    elSlotSlashLabel.textContent = 'Slash';
    elCdThrow.classList.add('hidden');
  }

  elSlotParry.classList.toggle('active-glow', player.parryTimer > 0);
  if (player.parryCd > 0 && player.parryTimer <= 0) {
    elCdParry.classList.remove('hidden');
    elCdParry.textContent = player.parryCd.toFixed(1);
  } else {
    elCdParry.classList.add('hidden');
  }

  if (player.dashCd > 0) {
    elCdDash.classList.remove('hidden');
    elCdDash.textContent = player.dashCd.toFixed(1);
  } else {
    elCdDash.classList.add('hidden');
  }

  // Storm HUD + Purple Vignette + Radar Minimap!
  if (storm.active) {
    elStormAlertPill.classList.remove('hidden');
    elStormAlertPill.textContent = storm.getStatusText();
    elStormRadarWrap.classList.remove('hidden');
    storm.renderRadar(elStormRadarCanvas, arena, combatants, player.yaw);

    const playerOutside = !player.dead && storm.isOutside(player.pos);
    elFxStorm.style.opacity = playerOutside ? '0.92' : '0';
  } else {
    elStormAlertPill.classList.add('hidden');
    elStormRadarWrap.classList.add('hidden');
    elFxStorm.style.opacity = '0';
  }

  // Dojo Live Status Bar
  if (selectedGameMode === 'training_dojo') {
    if (dojo.challengeActive) {
      elDojoStatusTxt.textContent = `⏱️ CHALLENGE: ${dojo.challengeTimer.toFixed(1)}s | Score: ${dojo.challengeScore} | Headshots: ${dojo.challengeHeadshots}`;
      updateScoreboardUI();
    } else {
      elDojoStatusTxt.textContent = `🎯 DOJO • [R] 30 s Record Challenge • [T] Parry Cannon: ${dojo.parryTrainerActive ? 'ON' : 'OFF'}`;
    }
  }

  updateV5HUD();

  // Multi-Fighter 3D Projected Nametags!
  const tagProj = new THREE.Vector3();
  for (const c of combatants) {
    if (c.isPlayer || !c.tag) continue;
    if (c.state.dead) {
      c.tag.root.classList.add('hidden');
      continue;
    }
    const dist = worldCamera.position.distanceTo(c.state.pos);
    if (dist > 36) {
      c.tag.root.classList.add('hidden');
      continue;
    }
    c.char.getHeadWorldCenter(tagProj);
    tagProj.y += 0.58;
    tagProj.project(worldCamera);
    if (tagProj.z > 0 && tagProj.z < 1) {
      const sx = (tagProj.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-tagProj.y * 0.5 + 0.5) * window.innerHeight;
      c.tag.root.classList.remove('hidden');
      c.tag.root.style.transform = `translate(-50%, -100%) translate(${sx}px, ${sy}px)`;
      c.tag.fill.style.width = `${(c.state.hp / c.state.maxHp) * 100}%`;
    } else {
      c.tag.root.classList.add('hidden');
    }
  }
}

// ================= MULTIPLAYER MATCH (LAN, phase 2) =================
// Authority (LAN): a victim's client owns its own HP. The attacker's client detects the hit and reports it;
// the server relays it to the victim. The victim reports its own death; the server counts kills and runs the end rule.
// Other players are "remote" combatants: no AI, positioned from their pose stream.
const MP_RESPAWN_SECONDS = 3;
const MP_MODE_TO_GAME = { duel: 'duel_1v1', team: 'team_2v2', ffa: 'ffa_storm' };
const MP_FFA_COLORS = ['#e11d48', '#f97316', '#a855f7', '#10b981', '#eab308', '#06b6d4', '#ec4899', '#84cc16'];
const MP_ORIG_TEXT = {
  rematch: document.getElementById('btn-rematch').textContent,
  menu: document.getElementById('btn-end-menu').textContent
};
let mpMatch = null; // { myId, mode, endRule, players, me, myTeam, ended, hud, lastUnits }
let mpRespawnTimer = 0;
let mpBannerSecond = -1;

const r3 = (v) => Math.round(v * 1000) / 1000;
const mpVec = (v) => [r3(v.x), r3(v.y), r3(v.z)];

function mpRemoteById(netId) {
  return combatants.find((c) => c.remote && c.id === netId) || null;
}

function mpCombatantById(netId) {
  if (!mpMatch) return null;
  if (netId === mpMatch.myId) return playerCombatant;
  return mpRemoteById(netId);
}

function mpSpawnPoint(team, spawnIndex, slot) {
  if (mpMatch.mode === 'ffa') {
    const sp = arena.ffaSpawns[slot % arena.ffaSpawns.length];
    return { pos: sp.clone(), yaw: Math.atan2(-sp.x, -sp.z) };
  }
  const list = team === 'red' ? arena.redTeamSpawns : arena.blueTeamSpawns;
  return { pos: list[spawnIndex % list.length].clone(), yaw: team === 'red' ? Math.PI : 0 };
}

function mpCreateRemoteFighter(p) {
  const isFfa = mpMatch.mode === 'ffa';
  const isAlly = !isFfa && p.team === mpMatch.myTeam;
  const torso = isFfa ? MP_FFA_COLORS[p.slot % MP_FFA_COLORS.length] : p.team === 'red' ? '#e11d48' : '#0284c7';
  const legs = p.team === 'red' ? '#1e3a8a' : '#0f172a';
  const char = new RivalCharacter(worldScene, p.skinId, {
    torsoColor: torso,
    legsColor: legs,
    angry: !isAlly,
    hatId: p.hatId,
    wrapId: p.wrapId
  });
  const name = String(p.name || 'JÁTÉKOS').toUpperCase();
  const tag = createNametagDOM(name, isAlly);
  const sp = mpSpawnPoint(p.team, p.spawnIndex, p.slot);
  const state = {
    pos: sp.pos.clone(),
    vel: new THREE.Vector3(),
    yaw: sp.yaw,
    pitch: 0,
    hp: 100,
    maxHp: 100,
    dead: false,
    radius: 0.5,
    grounded: true,
    sliding: false,
    stunTimer: 0,
    parryTimer: 0,
    chargingThrow: false,
    throwWindup: 0,
    hasKnife: true,
    gunMode: false,
    chronoTimer: 0,
    rageTimer: 0,
    vaulting: false
  };
  const c = {
    id: p.id,
    name,
    team: p.team,
    isPlayer: false,
    remote: true,
    radarColor: isFfa ? torso : isAlly ? '#38bdf8' : '#ff2a55',
    skinId: p.skinId,
    trailId: 'trail_skin',
    killEffectId: 'voxel_classic',
    barrierSide: 'none',
    state,
    char,
    tag,
    poison: null,
    grappleFx: null,
    disarmTimer: 0,
    net: null // latest pose from the network
  };
  combatants.push(c);
  return c;
}

function mpPlaceLocal() {
  const me = mpMatch.me;
  const sp = mpSpawnPoint(me.team, me.spawnIndex, me.slot);
  player.pos.copy(sp.pos);
  player.yaw = sp.yaw;
  player.pitch = 0;
  player.vel.set(0, 0, 0);
}

// Respawn at the spawn point that is farthest from the living enemies
function mpPickRespawn() {
  const isFfa = mpMatch.mode === 'ffa';
  const list = isFfa ? arena.ffaSpawns : mpMatch.myTeam === 'red' ? arena.redTeamSpawns : arena.blueTeamSpawns;
  const enemies = combatants.filter((c) => c.remote && !c.state.dead && (isFfa || c.team !== mpMatch.myTeam));
  let best = list[0];
  let bestD = -1;
  for (const sp of list) {
    let md = Infinity;
    for (const e of enemies) md = Math.min(md, e.state.pos.distanceTo(sp));
    if (enemies.length === 0) md = Math.random();
    if (md > bestD) {
      bestD = md;
      best = sp;
    }
  }
  return best;
}

function mpRespawnLocal() {
  const sp = mpPickRespawn();
  const isFfa = mpMatch.mode === 'ffa';
  player.pos.copy(sp);
  player.yaw = isFfa ? Math.atan2(-sp.x, -sp.z) : mpMatch.myTeam === 'red' ? Math.PI : 0;
  player.pitch = 0;
  player.vel.set(0, 0, 0);
  player.hp = 100;
  player.dead = false;
  player.grounded = true;
  player.jumpsLeft = 2;
  player.sliding = false;
  player.slideTimer = 0;
  player.slideCd = 0;
  player.dashing = false;
  player.dashTimer = 0;
  player.dashCd = 0;
  player.vaulting = false;
  player.vaultData = null;
  player.vaultCandidate = null;
  player.slamming = false;
  player.slamAir = 0;
  player.barrageLeft = 0;
  player.barrageTimer = 0;
  player.rageTimer = 0;
  player.chronoTimer = 0;
  player.speedBoostTimer = 0;
  player.vaultBoostTimer = 0;
  player.knifeMaxCharges = knifeMaxChargesFor(profile.equippedSkin);
  player.knifeCharges = player.knifeMaxCharges;
  player.hasKnife = true;
  player.knifeRecharge = 0;
  player.burstShots = 0;
  player.chargingThrow = false;
  player.chargeDuration = 0;
  player.slashCd = 0;
  player.comboStep = 0;
  player.parryTimer = 0;
  player.parryCd = 0;
  playerChar.stopEmote();
  mpRespawnTimer = 0;
  mpBannerSecond = -1;
  hideBanner();
  updateHealthUI();
  viewmodel.playEquip();
  netSendAlive();
}

// Called from applyDamageToCombatant when our own HP reaches 0
function mpOnLocalDeath(attackerNetId, method, headshot, kind) {
  const killerId = attackerNetId && attackerNetId !== 'storm' && attackerNetId !== 'player' ? attackerNetId : null;
  netSendDied({ killerId, method: method || 'slash', headshot: !!headshot, kind: kind || null });
  mpRespawnTimer = MP_RESPAWN_SECONDS;
  mpBannerSecond = -1;
}

function lerpAngle(a, b, t) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * t;
}

// Per frame: respawn countdown and remote fighter interpolation
function updateMultiplayer(dt) {
  if (!mpMatch) return;
  if (player.dead && !mpMatch.ended && roundPhase === 'live') {
    if (mpRespawnTimer <= 0) mpRespawnTimer = MP_RESPAWN_SECONDS;
    mpRespawnTimer -= dt;
    const s = Math.max(1, Math.ceil(mpRespawnTimer));
    if (s !== mpBannerSecond) {
      mpBannerSecond = s;
      showBanner('💀 ELESTÉL', `Újraéledés ${s} mp múlva`, '#ff2a55');
    }
    if (mpRespawnTimer <= 0) mpRespawnLocal();
  }

  const a = 1 - Math.exp(-dt * 16);
  for (const c of combatants) {
    if (!c.remote) continue;
    const s = c.state;
    const n = c.net;
    if (n) {
      const before = s.pos.clone();
      const target = new THREE.Vector3(n.x, n.y, n.z);
      if (target.distanceTo(s.pos) > 5) s.pos.copy(target);
      else s.pos.lerp(target, a);
      s.vel.copy(s.pos).sub(before).divideScalar(Math.max(dt, 1e-3));
      s.yaw = lerpAngle(s.yaw, n.yaw, a);
      s.pitch = n.pitch;
      s.hp = n.hp;
      s.dead = n.dead;
      s.sliding = n.sliding;
      s.parryTimer = n.parry ? 0.15 : 0;
      s.grounded = Math.abs(s.vel.y) < 1.5;
    }
    c.char.update(s, dt);
  }
}

function mpLocalPose() {
  return {
    pos: mpVec(player.pos),
    yaw: r3(player.yaw),
    pitch: r3(player.pitch),
    hp: Math.max(0, Math.round(player.hp)),
    dead: !!player.dead,
    sliding: !!player.sliding,
    parry: player.parryTimer > 0
  };
}

function mpOnPeerPose(msg) {
  if (!mpMatch || !Array.isArray(msg.pos)) return;
  const c = mpRemoteById(msg.id);
  if (!c) return;
  c.net = {
    x: msg.pos[0],
    y: msg.pos[1],
    z: msg.pos[2],
    yaw: msg.yaw,
    pitch: msg.pitch,
    hp: msg.hp,
    dead: !!msg.dead,
    sliding: !!msg.sliding,
    parry: !!msg.parry
  };
}

function mpOnPeerAct(msg) {
  if (!mpMatch) return;
  const c = mpRemoteById(msg.id);
  if (c && msg.kind === 'slash') c.char.triggerSlashAnim(msg.step | 0);
}

// Another player threw a knife: draw a visual-only copy (ghost), damage is decided by the thrower's client
function mpOnPeerThrow(msg) {
  if (!mpMatch || !Array.isArray(msg.origin) || !Array.isArray(msg.dir)) return;
  const c = mpRemoteById(msg.id);
  if (!c) return;
  const dir = new THREE.Vector3(msg.dir[0], msg.dir[1], msg.dir[2]);
  if (dir.lengthSq() < 1e-6) return;
  projectiles.spawnThrownKnife({
    ownerId: c.id,
    team: c.team,
    origin: new THREE.Vector3(msg.origin[0], msg.origin[1], msg.origin[2]),
    direction: dir.normalize(),
    speed: msg.speed || 40,
    damage: 0,
    skinId: msg.skinId,
    wrapId: msg.wrapId,
    trailId: msg.trailId || 'trail_skin',
    charged: !!msg.charged,
    burst: !!msg.burst,
    ghost: true
  });
  c.char.triggerSlashAnim(0);
}

// The server relayed a hit from another player: apply it to our own HP
function mpOnHit(msg) {
  if (!mpMatch || mpMatch.ended || player.dead || roundPhase !== 'live') return;
  applyDamageToCombatant({
    attackerId: msg.attackerId,
    victim: playerCombatant,
    damage: Number(msg.damage) || 0,
    headshot: !!msg.headshot,
    deflected: false,
    method: msg.method || 'slash',
    kind: msg.kind || null
  });
}

function mpBadge(msg) {
  if (!msg.killerId) return '🌪️ Storm Zone';
  if (msg.headshot && msg.method === 'throw') return '🎯 Headshot (Throw)';
  if (msg.headshot) return '🎯 Headshot';
  if (msg.method === 'throw') return '🎯 Thrown knife';
  return '🗡️ Knife';
}

function mpOnKill(msg) {
  if (!mpMatch) return;
  const killer = msg.killerId ? mpCombatantById(msg.killerId) : null;
  const victim = mpCombatantById(msg.victimId);
  const isMe = msg.victimId === mpMatch.myId;
  const iKilled = msg.killerId === mpMatch.myId;
  if (victim && !isMe) {
    victim.state.dead = true;
    victim.state.hp = 0;
    const fx = (killer && killer.killEffectId) || 'voxel_classic';
    particles.triggerKillEffect(fx, victim.char.getChestWorldCenter(), [
      0xf5cd30,
      victim.char.torsoColorHex || 0xe11d48,
      victim.char.legsColorHex || 0x1e3a8a,
      0xffffff
    ]);
  }
  if (iKilled) {
    matchStats.kills++;
    sfx.playKillEffect((killer && killer.killEffectId) || 'voxel_classic');
    hitstopTimer = 0.055;
    cameraShake = 0.2;
    triggerHitmarker(true);
  }
  pushKillfeed(
    msg.killerId ? msg.killerName || '???' : '🌪️ STORM ZONE',
    killer ? killer.radarColor : '#e879f9',
    msg.victimName || '???',
    victim ? victim.radarColor : '#ffffff',
    mpBadge(msg)
  );
}

function mpRuleText(r) {
  if (r.type === 'points') return `Cél: ${r.pointsTarget} pont`;
  if (r.type === 'timed_kills') return `Cél: ${r.killTarget} kill • ${r.timeLimitMin} perc`;
  return 'Nincs időlimit (csak pontszámolás)';
}

function fmtMmSs(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// Match clock and scoreboard from the server (once per second)
function mpOnClock(msg) {
  if (!mpMatch || mpMatch.ended) return;
  mpMatch.lastUnits = msg.units || [];
  const rule = mpRuleText(mpMatch.endRule);
  let mine = 0;
  let rival = 0;
  let rivalName = 'RIVAL';
  if (mpMatch.mode === 'ffa') {
    const me = msg.players.find((p) => p.id === mpMatch.myId);
    const top = msg.players.filter((p) => p.id !== mpMatch.myId).sort((x, y) => y.kills - x.kills)[0];
    mine = me ? me.kills : 0;
    rival = top ? top.kills : 0;
    rivalName = top ? top.name : '—';
    elHudLeftLabel.textContent = 'KILLS';
  } else {
    const mineU = msg.units.find((u) => u.key === mpMatch.myTeam);
    mine = mineU ? mineU.kills : 0;
    rival = msg.units.filter((u) => u.key !== mpMatch.myTeam).reduce((m, u) => Math.max(m, u.kills), 0);
    if (mpMatch.mode === 'duel') {
      const other = msg.players.find((p) => p.id !== mpMatch.myId);
      rivalName = other ? other.name : 'RIVAL';
      elHudLeftLabel.textContent = 'YOU';
    } else {
      rivalName = 'RIVAL TEAM';
      elHudLeftLabel.textContent = mpMatch.myTeam === 'red' ? 'RED TEAM' : 'BLUE TEAM';
    }
  }
  mpMatch.hud = { mine, rival };
  elRoundTimer.textContent = fmtMmSs(msg.timeLeft != null ? msg.timeLeft : msg.elapsed);
  elPlayerScore.textContent = mine;
  elEnemyScore.textContent = rival;
  elHudRivalName.textContent = rivalName;
  elRoundLabel.textContent = rule;
  elHudModeSub.textContent = `🌐 MULTIPLAYER • ${rule}`;
  elPlayerPips.innerHTML = '';
  elEnemyPips.innerHTML = '';
}

function mpResetEndModal() {
  document.getElementById('btn-rematch').classList.remove('hidden');
  document.getElementById('btn-rematch').textContent = MP_ORIG_TEXT.rematch;
  document.getElementById('btn-end-dropbox').classList.remove('hidden');
  document.getElementById('btn-end-menu').textContent = MP_ORIG_TEXT.menu;
  document.getElementById('end-bot-adapt').style.whiteSpace = '';
}

function mpOnMatchEnd(msg) {
  if (!mpMatch || mpMatch.ended) return;
  mpMatch.ended = true;
  roundPhase = 'roundOver';
  roundEndTimer = Infinity; // the local round timer must never end the match; the server decided
  storm.stop();
  elFxStorm.style.opacity = '0';
  elSpectatorPill.classList.add('hidden');
  player.chargingThrow = false;
  if (document.pointerLockElement) document.exitPointerLock?.();
  appMode = 'matchEnd';

  const iWon = msg.winnerIds.includes(mpMatch.myId);
  let title;
  let sub;
  if (msg.reason === 'abandoned') {
    title = '⚠️ A MECCS VÉGET ÉRT';
    sub = 'Valaki kilépett a szobából.';
  } else if (msg.reason === 'host') {
    title = '🏁 A HOST LEZÁRTA A MECCSET';
    sub = 'Nincs győztes, a pontok megmaradtak.';
  } else if (!msg.winnerIds.length) {
    title = '🤝 DÖNTETLEN';
    sub = 'Nincs egyértelmű győztes.';
  } else if (iWon) {
    title = '🏆 GYŐZELEM!';
    sub = `Győztes: ${msg.winnerLabel}`;
  } else {
    title = '💀 VERESÉG';
    sub = `Győztes: ${msg.winnerLabel}`;
  }

  const me = msg.standings.find((p) => p.id === mpMatch.myId);
  const hud = mpMatch.hud || { mine: 0, rival: 0 };
  const badge = document.getElementById('end-badge');
  badge.textContent = 'MULTIPLAYER';
  badge.style.color = '#38bdf8';
  badge.style.background = 'rgba(56,189,248,0.18)';
  document.getElementById('end-title').textContent = title;
  document.getElementById('end-scoreline').textContent = `${hud.mine} — ${hud.rival}`;
  document.getElementById('end-kills').textContent = me ? me.kills : 0;
  document.getElementById('end-headshots').textContent = matchStats.headshots;
  document.getElementById('end-parries').textContent = matchStats.parries;
  document.getElementById('end-cash').textContent = '—';
  const adapt = document.getElementById('end-bot-adapt');
  adapt.style.whiteSpace = 'pre-line';
  adapt.textContent = `${sub}\n${msg.standings.map((p, i) => `${i + 1}. ${p.name} — ${p.kills} kill / ${p.deaths} halál`).join('\n')}`;

  const rematch = document.getElementById('btn-rematch');
  rematch.classList.toggle('hidden', !(netIsHost() && msg.reason !== 'abandoned'));
  rematch.textContent = '🔁 ÚJ MECCS';
  document.getElementById('btn-end-dropbox').classList.add('hidden');
  document.getElementById('btn-end-menu').textContent = '🏠 MENÜ';
  elMatchEndModal.classList.remove('hidden');
}

function mpOnNotice(text) {
  if (mpMatch && mpMatch.ended) {
    document.getElementById('end-bot-adapt').style.whiteSpace = '';
    document.getElementById('end-bot-adapt').textContent = text;
    elMatchEndModal.classList.remove('hidden');
    return;
  }
  showBanner('ℹ️ ' + text, '', '#ffc83b');
  setTimeout(() => { if (appMode === 'playing') hideBanner(); }, 2200);
}

function mpOnDisconnect() {
  if (mpMatch) returnToMainMenu();
}

function mpLeaveLocal() {
  mpMatch = null;
  mpRespawnTimer = 0;
  mpResetEndModal();
}

function mpStartMatch(msg) {
  const myId = netMyId();
  const me = msg.players.find((p) => p.id === myId);
  if (!me) return;
  mpMatch = {
    myId,
    mode: msg.mode,
    endRule: msg.endRule,
    players: msg.players,
    me,
    myTeam: me.team,
    ended: false,
    hud: null,
    lastUnits: []
  };
  mpRespawnTimer = 0;
  mpBannerSecond = -1;
  mpResetEndModal();
  selectedGameMode = MP_MODE_TO_GAME[msg.mode] || 'duel_1v1';
  selectedQueue = 'normal';
  // Every client must build the same arena (spawn layout), so multiplayer always uses the default map
  selectedMapId = 'blueprint_cad';
  startNewMatch();
}

// ================= MASTER GAME LOOP =================
let lastTime = performance.now();
let menuOrbitAngle = 0;
let renderViewmodelThisFrame = true;

// ================= SOLID BODIES =================
// Fighters are solid: live bodies that overlap on the XZ plane are pushed apart,
// so neither the player nor a bot can walk through another fighter.
const BODY_SOLID_PAD = 0.1;
function clampToArena(state) {
  if (!arena) return;
  const maxW = arena.arenaW / 2 - state.radius;
  const maxL = arena.arenaL / 2 - state.radius;
  state.pos.x = Math.max(-maxW, Math.min(maxW, state.pos.x));
  state.pos.z = Math.max(-maxL, Math.min(maxL, state.pos.z));
}
function resolveBodyCollisions() {
  const live = combatants.filter((c) => c.state && !c.state.dead);
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const A = live[i];
      const B = live[j];
      const a = A.state;
      const b = B.state;
      if (Math.abs(a.pos.y - b.pos.y) > 1.8) continue; // different height (ledge / jump), no contact
      const minD = (a.radius || 0.5) + (b.radius || 0.5) + BODY_SOLID_PAD;
      let dx = b.pos.x - a.pos.x;
      let dz = b.pos.z - a.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 >= minD * minD) continue;
      let d = Math.sqrt(d2);
      if (d < 1e-4) {
        const ang = Math.random() * Math.PI * 2;
        dx = Math.cos(ang);
        dz = Math.sin(ang);
        d = 0;
      } else {
        dx /= d;
        dz /= d;
      }
      // A remote body is placed by its owner's client, so only the local side gets pushed
      const wa = A.remote ? 0 : 1;
      const wb = B.remote ? 0 : 1;
      if (wa + wb === 0) continue;
      const sep = minD - d;
      const fa = wa / (wa + wb);
      const fb = wb / (wa + wb);
      a.pos.x -= dx * sep * fa;
      a.pos.z -= dz * sep * fa;
      b.pos.x += dx * sep * fb;
      b.pos.z += dz * sep * fb;
      if (wa) clampToArena(a);
      if (wb) clampToArena(b);
    }
  }
}

// Per-frame ASCENDANT status effects: poison ticks and the grappling-hook pull
function updateKnifeStatuses(dt) {
  for (const c of combatants) {
    if (c.isPlayer) continue;
    if (c.state.dead || roundPhase !== 'live') {
      c.poison = null;
      c.grappleFx = null;
      c.disarmTimer = 0;
      continue;
    }

    if (c.poison) {
      c.poison.timer -= dt;
      c.poison.acc += dt;
      c.poisonVfx = (c.poisonVfx || 0) + dt;
      if (c.poisonVfx >= 0.4) {
        c.poisonVfx = 0;
        particles.spawnSparks(c.char.getChestWorldCenter(), 0x22c55e, 4, 2.5);
      }
      while (c.poison && c.poison.acc >= POISON_TICK && !c.state.dead) {
        c.poison.acc -= POISON_TICK;
        applyDamageToCombatant({ attackerId: c.poison.attackerId, victim: c, damage: 1, method: 'poison' });
      }
      if (c.poison && c.poison.timer <= 0) c.poison = null;
    }

    if (c.grappleFx) {
      const fx = c.grappleFx;
      fx.timer -= dt;
      const thrower = combatants.find((x) => x.id === fx.attackerId);
      if (!thrower || thrower.state.dead || fx.timer <= 0) {
        c.grappleFx = null;
      } else {
        const dx = thrower.state.pos.x - c.state.pos.x;
        const dz = thrower.state.pos.z - c.state.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist <= GRAPPLE_STOP_DIST) {
          c.grappleFx = null;
        } else {
          const step = Math.min(dist - GRAPPLE_STOP_DIST, (dist / Math.max(fx.timer, 0.05)) * dt);
          c.state.pos.x += (dx / dist) * step;
          c.state.pos.z += (dz / dist) * step;
          c.state.vel.x = 0;
          c.state.vel.z = 0;
          resolveArenaPhysics(c.state, arena, dt, c.barrierSide);
        }
      }
    }

    // Disarm: active while pulled, then counts down 1.5 s
    if (c.grappleFx) c.disarmTimer = GRAPPLE_DISARM_AFTER;
    else if (c.disarmTimer > 0) c.disarmTimer = Math.max(0, c.disarmTimer - dt);
  }
}

function gameLoop(now) {
  requestAnimationFrame(gameLoop);

  const rawDt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  // Animated wraps run in every view (Armory preview, menu showcase, match), not only during play
  updateWrapTime(now / 1000);

  // FPS Calculation
  fpsFrames++;
  fpsAccum += rawDt;
  if (fpsAccum >= 0.5) {
    currentFps = Math.round(fpsFrames / fpsAccum);
    elHudFpsPill.textContent = `${currentFps} FPS`;
    fpsFrames = 0;
    fpsAccum = 0;
  }

  // Armory 3D Preview Loop
  if (!elArmoryModal.classList.contains('hidden')) {
    if (!armoryDragging) armoryTurntable.rotation.y += rawDt * 0.9;
    const firstChild = armoryTurntable.children[0];
    if (firstChild && firstChild.userData.rainbowRing) {
      firstChild.userData.rainbowRing.material.color.setHSL((now * 0.0008) % 1, 1.0, 0.58);
    }
    if (armorySpinTrickTimer > 0 && armoryPreviewObj) {
      armorySpinTrickTimer = Math.max(0, armorySpinTrickTimer - rawDt);
      const p = 1 - armorySpinTrickTimer / 1.1;
      const sp = armoryPreviewObj.userData?.spinPivot;
      if (sp) sp.rotation.x = p * Math.PI * 4;
      if (armorySpinTrickTimer === 0 && sp) sp.rotation.set(0, 0, 0);
    }
    armoryRenderer.render(armoryScene, armoryCam);
  }

  // Main Menu Live 3D Showcase
  if (appMode === 'menu') {
    playerChar.root.visible = true;
    menuRivalChar.root.visible = true;

    player.pos.set(-1.55, 2.2, 0);
    player.vel.set(0, 0, 0);
    player.dead = false;
    player.sliding = false;
    player.yaw = -Math.PI * 0.42;
    playerChar.update(player, rawDt);

    menuRivalChar.update(menuDummyState, rawDt);

    menuKnifeGroup.visible = true;
    menuOrbitAngle += rawDt * 0.14;

    worldCamera.position.set(
      Math.sin(menuOrbitAngle) * 14.5,
      6.2 + Math.sin(menuOrbitAngle * 2) * 0.7,
      Math.cos(menuOrbitAngle) * 14.5
    );
    worldCamera.lookAt(0, 3.1, 0);

    const camFwd = new THREE.Vector3();
    worldCamera.getWorldDirection(camFwd);
    const camRight = new THREE.Vector3().crossVectors(camFwd, worldCamera.up).normalize();
    const camUp = new THREE.Vector3().crossVectors(camRight, camFwd).normalize();

    menuKnifeGroup.position
      .copy(worldCamera.position)
      .addScaledVector(camFwd, 2.35)
      .addScaledVector(camRight, 0.72)
      .addScaledVector(camUp, 0.22);
    menuKnifeGroup.quaternion.copy(worldCamera.quaternion);
    if (menuKnifeMesh) {
      menuKnifeMesh.rotation.set(0.35 + Math.sin(now * 0.002) * 0.15, now * 0.0014, -0.25);
    }

    renderer.clear();
    renderer.render(worldScene, worldCamera);
    return;
  }

  if (appMode === 'playing') {
    if (hitstopTimer > 0) {
      hitstopTimer -= rawDt;
      renderer.clear();
      renderer.render(worldScene, worldCamera);
      if (renderViewmodelThisFrame) viewmodel.render(renderer);
      return;
    }

    let dt = rawDt;
    if (slowMoTimer > 0) {
      slowMoTimer -= rawDt;
      dt *= 0.32;
    }
    if (wheel.open) dt *= 0.3; // circular wheel = tactical slow-mo
    if (wheel.qPending && !wheel.open) {
      wheel.qHold += rawDt;
      if (wheel.qHold >= 0.2) openRadialWheel('q');
    }

    // Round Phase State Machine
    if (roundPhase === 'countdown') {
      countdownTimer -= rawDt;
      const ceilSec = Math.ceil(countdownTimer);
      if (ceilSec !== lastCountdownInt && ceilSec >= 1) {
        lastCountdownInt = ceilSec;
        sfx.playCountdown(false);
        showBanner(
          String(ceilSec),
          selectedGameMode === 'ffa_storm' ? '🌪️ STORM ZONE INCOMING!' : `ROUND ${matchStats.roundNumber} • GET READY!`,
          selectedGameMode === 'ffa_storm' ? '#e879f9' : '#00f0ff'
        );
      }
      if (countdownTimer <= 0) {
        roundPhase = 'live';
        cancelManualEmote();
        arena.barriers.active = false;
        arena.barriers.playerMesh.visible = false;
        arena.barriers.enemyMesh.visible = false;
        sfx.playCountdown(true);

        if (selectedGameMode === 'ffa_storm') {
          storm.startFFAStorm();
          showBanner('🌪️ STORM ZONE FIGHT!', 'STAY IN THE ZONE AND BE THE LAST SURVIVOR!', '#e879f9');
        } else {
          const isMatchPointTie = matchStats.playerScore === ROUNDS_TO_WIN - 1 && matchStats.enemyScore === ROUNDS_TO_WIN - 1;
          if (isMatchPointTie) {
            storm.startSuddenDeathStorm();
          }
          showBanner('⚔️ DUEL!', 'AIM FOR THE YELLOW HEAD FOR A HEADSHOT!', '#ffc83b');
        }

        setTimeout(() => {
          if (roundPhase === 'live') hideBanner();
        }, 900);
      }
    } else if (roundPhase === 'live' && selectedGameMode !== 'training_dojo' && !mpMatch) {
      roundStartElapsed += dt;

      if (selectedGameMode === 'ffa_storm') {
        const elapsedSec = Math.floor(roundStartElapsed);
        const mins = Math.floor(elapsedSec / 60);
        const secs = elapsedSec % 60;
        elRoundTimer.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      } else {
        roundTimer = Math.max(0, roundTimer - dt);
        const mins = Math.floor(roundTimer / 60);
        const secs = Math.floor(roundTimer % 60);
        elRoundTimer.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

        // Activate Sudden Death Storm in the final 20s of 1v1/2v2/4v4 so nobody camps!
        if (roundTimer <= 20 && !storm.active) {
          storm.startSuddenDeathStorm();
          showBanner('⚠️ THE ZONE IS SHRINKING!', 'HEAD FOR THE CENTER BRIDGE!', '#e879f9');
          setTimeout(() => { if (roundPhase === 'live') hideBanner(); }, 1000);
        }

        if (roundTimer <= 0) {
          const blueHp = combatants.filter((c) => c.team === 'blue' && !c.state.dead).reduce((s, c) => s + c.state.hp, 0);
          const redHp = combatants.filter((c) => c.team === 'red' && !c.state.dead).reduce((s, c) => s + c.state.hp, 0);
          if (blueHp > redHp) endTeamOrDuelRound('blue', playerCombatant);
          else if (redHp > blueHp) endTeamOrDuelRound('red', activeBots.find((b) => b.team === 'red'));
          else endTeamOrDuelRound('draw', null);
        }
      }
    } else if (roundPhase === 'roundOver') {
      roundEndTimer -= rawDt;
      if (roundEndTimer <= 0) {
        if (
          selectedGameMode === 'ffa_storm' ||
          tutorialPhase === 'duel' ||
          matchStats.playerScore >= ROUNDS_TO_WIN ||
          matchStats.enemyScore >= ROUNDS_TO_WIN
        ) {
          finishMatch();
          return;
        } else {
          matchStats.roundNumber++;
          setupRound();
        }
      }
    }

    for (const pad of arena.jumpPads) {
      pad.ringMesh.position.y = 0.28 + ((now * 0.0015) % 0.7);
    }

    if (mpMatch) updateMultiplayer(dt);
    updatePlayer(dt);

    // Update Fortnite Storm Zone!
    if (storm.active && roundPhase === 'live') {
      storm.update(dt, combatants, (victim, tickDmg) => {
        if (victim.remote) return; // that player's own client applies their storm damage
        if (victim.isPlayer) {
          sfx.playStormTick();
        }
        applyDamageToCombatant({
          attackerId: 'storm',
          victim,
          damage: tickDmg,
          method: 'storm'
        });
      });
    }

    // Update Dojo Targets & Challenge!
    if (selectedGameMode === 'training_dojo') {
      dojo.update(
        dt,
        player,
        (botId, origin, dir, speed) => {
          projectiles.spawnThrownKnife({
            ownerId: botId,
            team: 'dojo_targets',
            origin,
            direction: dir,
            speed,
            damage: 35,
            skinId: 'karambit_crimson',
            trailId: 'trail_crimson'
          });
        },
        ({ score, headshots }) => {
          const prevBest = profile.stats.dojoBestScore || 0;
          const isNewRecord = score > prevBest;
          if (isNewRecord) {
            profile.stats.dojoBestScore = score;
            elDojoBestVal.textContent = score;
          }
          const reward = Math.min(140, Math.max(25, Math.round(score / 18)));
          awardCash(reward);
          saveProfile(profile);
          sfx.playRoundEnd(true);
          showBanner(
            isNewRecord ? `🏆 NEW DOJO RECORD: ${score} PTS!` : `⏱️ CHALLENGE OVER: ${score} PTS`,
            `Headshots: ${headshots} • Reward: +$${reward}`,
            '#10f587'
          );
          setTimeout(() => { if (appMode === 'playing') hideBanner(); }, 2500);
          updateScoreboardUI();
        }
      );
    }

    // Update All Active AI Bots!
    const charAnimDt = roundPhase === 'roundOver' ? rawDt : dt;
    for (const b of activeBots) {
      if (roundPhase === 'roundOver') {
        b.state.vel.y -= 28 * dt;
        b.state.vel.x *= Math.max(0, 1 - 6 * dt);
        b.state.vel.z *= Math.max(0, 1 - 6 * dt);
        resolveArenaPhysics(b.state, arena, dt, b.barrierSide);
      } else if (roundPhase === 'countdown' && selectedGameMode === 'ffa_storm') {
        b.state.vel.set(0, 0, 0);
      } else {
        b.ai.update(dt, {
          arena,
          combatants,
          storm,
          roundLive: roundPhase === 'live',
          callbacks: {
            onBotMelee: (targetCombatant) => {
              if (matchGunMode || isBotDisarmed(b)) return; // gun mode: no knife melee for bots
              b.char.triggerSlashAnim(0);
              sfx.playSlash(1, false);

              // Did the target parry?
              if (targetCombatant.isPlayer && player.parryTimer > 0) {
                b.state.stunTimer = 1.15;
                player.parryCd = 0.2;
                player.parryTimer = 0;
                viewmodel.playParrySuccess();
                sfx.playParrySuccess(false);
                flashScreen(elFxParry, 220);

                matchStats.parries++;
                profile.stats.parries++;
                profile.botMemory.playerParries++;
                const chest = b.char.getChestWorldCenter();
                particles.spawnSparks(chest, 0xffd166, 26, 9);
                particles.spawnShockwave(chest, 0xffd166, 2.5);
                particles.spawnFloatingText(chest, '⚡ PARRIED!', '#ffd166', true);
                hitstopTimer = 0.055;
                return;
              }

              const dist = Math.hypot(
                targetCombatant.state.pos.x - b.state.pos.x,
                targetCombatant.state.pos.z - b.state.pos.z
              );
              if (dist < 3.1) {
                applyDamageToCombatant({
                  attackerId: b.id,
                  victim: targetCombatant,
                  damage: b.ai.getMeleeDamage(),
                  method: 'slash'
                });
              }
            },
            onBotThrow: (origin, dir, speed) => {
              if (isBotDisarmed(b)) return;
              if (matchGunMode) { fireBotGun(b, origin, dir); b.ai.cfg.throwCooldown = 1.1; return; }
              projectiles.spawnThrownKnife({
                ownerId: b.id,
                team: b.team,
                origin,
                direction: dir,
                speed,
                damage: b.ai.getThrowDamage(),
                skinId: b.skinId,
                trailId: b.trailId,
                charged: false
              });
            }
          }
        });
      }

      b.char.update(b.state, charAnimDt);
    }

    // Solid fighters: nobody walks through another body
    resolveBodyCollisions();

    playerChar.update(player, charAnimDt);
    for (const ev of playerChar.drainEmoteEvents()) {
      if (ev.type === 'rpg_boom') spawnRpgBoom(player.pos);
    }

    updateKnifeStatuses(dt);
    projectiles.update(dt, {
      arena,
      player,
      playerTeam: playerCombatant.team,
      rankedMode: matchIsRanked,
      combatants,
      callbacks: {
        onHitCombatant: (info) => applyDamageToCombatant(info),
        onPlayerPickupKnife: (pos) => {
          player.knifeCharges = Math.min(player.knifeMaxCharges, player.knifeCharges + 1);
          player.hasKnife = true;
          if (player.knifeCharges >= player.knifeMaxCharges) player.knifeRecharge = 0;
          viewmodel.playEquip();
          sfx.playKnifePickup();
          particles.spawnFloatingText(pos, '+KNIFE PICKED UP!', '#00f0ff', false);
        },
        onPlayerDeflect: (pos) => {
          player.parryTimer = 0;
          player.parryCd = 0;
          viewmodel.playParrySuccess();
          sfx.playParrySuccess(true);
          flashScreen(elFxParry, 260);
          hitstopTimer = 0.065;
          cameraShake = 0.2;

          matchStats.parries++;
          profile.stats.parries++;
          profile.botMemory.playerParries++;

          particles.spawnSparks(pos, 0xffd166, 30, 11);
          particles.spawnShockwave(pos, 0xffd166, 3.0);
          particles.spawnFloatingText(
            pos,
            '⚡ REFLECTED!',
            '#ffd166',
            true
          );
        }
      }
    });

    renderViewmodelThisFrame = updateCameraSystem(rawDt, dt);
    viewmodel.update(dt, player);
    particles.update(rawDt, worldCamera);
    updateHUD();
  }

  renderer.clear();
  renderer.render(worldScene, worldCamera);
  if ((appMode === 'playing' || appMode === 'paused' || appMode === 'matchEnd') && renderViewmodelThisFrame) {
    viewmodel.render(renderer);
  }
}

renderMapCards();
refreshMenuProfileUI();
initMultiplayer({
  getProfile: () => ({ skinId: profile.equippedSkin, hatId: profile.equippedHat, wrapId: profile.equippedWrap }),
  game: {
    getLocalPose: mpLocalPose,
    onMatchStart: mpStartMatch,
    onPeerPose: mpOnPeerPose,
    onPeerAct: mpOnPeerAct,
    onPeerThrow: mpOnPeerThrow,
    onHit: mpOnHit,
    onKill: mpOnKill,
    onClock: mpOnClock,
    onMatchEnd: mpOnMatchEnd,
    onNotice: mpOnNotice,
    onDisconnect: mpOnDisconnect
  }
});

// Test hook for the dev page only (?dev)
if (GUN_DEV_UNLOCK) {
  window.__mpDebug = {
    player,
    playerCombatant,
    projectiles,
    combatants: () => combatants,
    matchStats: () => matchStats,
    mpMatch: () => mpMatch,
    get appMode() {
      return appMode;
    },
    get roundPhase() {
      return roundPhase;
    },
    hitRemote: (id, dmg) => applyDamageToCombatant({ attackerId: 'player', victim: mpRemoteById(id), damage: dmg, method: 'slash' }),
    throwKnife: () => spawnPlayerKnife({ speed: 37, rawDamage: 75 }),
    skipCountdown: () => {
      if (roundPhase === 'countdown') countdownTimer = 0;
    }
  };
}
requestAnimationFrame(gameLoop);
