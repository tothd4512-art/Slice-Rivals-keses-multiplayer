import { RARITY_TIERS } from './skins.js';
import * as THREE from 'three';

// Fegyvermód: a fegyverek csak ebben a módban használhatók.
// Platina (500 RP) rang szükséges a módhoz.
export const GUN_MODE_MIN_RP = 500;

export const GUN_DEFS = {
  gun_pistol: {
    id: 'gun_pistol', name: '🔫 Pistol', free: true,
    damage: 34, headMul: 1.5, fireInterval: 0.3,
    mag: 12, reserve: 60, reloadTime: 1.3,
    range: 70, spread: 0.012, pellets: 1, auto: false, kick: 0.02
  },
  gun_shotgun: {
    id: 'gun_shotgun', name: '💥 Shotgun', free: false,
    damage: 9, headMul: 1.5, fireInterval: 0.85,
    mag: 6, reserve: 30, reloadTime: 2.4,
    range: 22, spread: 0.1, pellets: 7, auto: false, kick: 0.05
  },
  gun_ar: {
    id: 'gun_ar', name: '🔹 AR', free: false,
    damage: 12, headMul: 1.5, fireInterval: 0.13,
    mag: 30, reserve: 120, reloadTime: 2.0,
    range: 80, spread: 0.035, pellets: 1, auto: true, kick: 0.012
  }
};

export const GUN_ORDER = ['gun_pistol', 'gun_shotgun', 'gun_ar'];

export function getGunDef(id) {
  return GUN_DEFS[id] || GUN_DEFS.gun_pistol;
}

// Véletlenszerű szórás a célirány körül (kör alakú folt, `spread` rad sugárral)
export function spreadDirection(dir, spread, rand = Math.random) {
  const up = Math.abs(dir.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(dir, up).normalize();
  const upV = new THREE.Vector3().crossVectors(right, dir).normalize();
  const r = spread * Math.sqrt(rand());
  const a = rand() * Math.PI * 2;
  return dir.clone()
    .addScaledVector(right, Math.cos(a) * r)
    .addScaledVector(upV, Math.sin(a) * r)
    .normalize();
}

// ================= ARSENAL DROPBOX (fegyverek dobozból) =================
// A pisztoly alapból mindenkinél van, ezért nem esik ki a dobozból
const GUN_RARITY = { gun_pistol: 'COMMON', gun_shotgun: 'RARE', gun_ar: 'EPIC' };

export const GUN_DROPBOX = {
  id: 'box_arsenal',
  isGunBox: true,
  name: '🔫 Arsenal Crate',
  price: 220,
  color: '#f97316',
  desc: 'Shotguns and AR rifles for Gun Mode (needs Platinum rank). Duplicates refund cash.',
  weights: { RARE: 50, EPIC: 35, LEGENDARY: 15 }
};

// Dropbox-ból jövő emote (Gun Mode only, csak látvány)
export function rpgEmoteAsItem() {
  const tier = RARITY_TIERS.LEGENDARY;
  return {
    id: 'rpg_launch',
    category: 'emote',
    emoteKey: 'rpg_launch',
    name: '🚀 RPG Launch',
    icon: '🚀',
    rarityKey: 'LEGENDARY',
    rarity: tier.label,
    rarityColor: tier.color,
    desc: 'Gun Mode only. Fires a rocket straight up, it hovers, then falls back on you and explodes (visual only).'
  };
}

export function gunAsItem(id) {
  const d = getGunDef(id);
  const rk = GUN_RARITY[d.id] || 'COMMON';
  const tier = RARITY_TIERS[rk] || RARITY_TIERS.COMMON;
  return {
    id: d.id,
    category: 'gun',
    name: d.name,
    icon: d.name.split(' ')[0],
    rarityKey: rk,
    rarity: tier.label,
    rarityColor: tier.color,
    desc: `Gun Mode weapon (${d.pellets > 1 ? d.pellets + ' pellets' : 'single shot'}, ${d.auto ? 'automatic' : 'semi-auto'}).`
  };
}

export function rollGunDropbox() {
  const pool = [...['gun_shotgun', 'gun_ar'].map(gunAsItem), rpgEmoteAsItem()];
  const weights = GUN_DROPBOX.weights;
  const pickOne = () => {
    const r = Math.random() * 100;
    let acc = 0;
    let chosen = 'RARE';
    for (const [rKey, w] of Object.entries(weights)) {
      acc += w;
      if (r <= acc) { chosen = rKey; break; }
    }
    const candidates = pool.filter((x) => x.rarityKey === chosen);
    const list = candidates.length > 0 ? candidates : pool;
    return list[Math.floor(Math.random() * list.length)];
  };
  const winner = pickOne();
  const reelItems = [];
  const winnerIndex = 34;
  for (let i = 0; i < 42; i++) reelItems.push(i === winnerIndex ? winner : pickOne());
  return { winner, reelItems, winnerIndex };
}
