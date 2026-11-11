import * as THREE from 'three';
import { RARITY_TIERS } from './skins.js';

export const KILL_EFFECTS = [
  {
    id: 'voxel_classic',
    category: 'killEffect',
    name: '🧱 Classic Roblox Cubes',
    rarityKey: 'COMMON',
    rarity: RARITY_TIERS.COMMON.label,
    rarityColor: RARITY_TIERS.COMMON.color,
    icon: '🧱',
    desc: 'The enemy breaks apart into bouncy classic Roblox bricks!'
  },
  {
    id: 'confetti_party',
    category: 'killEffect',
    name: '🎉 Champion Confetti Cannon',
    rarityKey: 'RARE',
    rarity: RARITY_TIERS.RARE.label,
    rarityColor: RARITY_TIERS.RARE.color,
    icon: '🎉',
    desc: 'A colorful confetti burst and victory fanfare on every kill!'
  },
  {
    id: 'ice_shatter',
    category: 'killEffect',
    name: '❄️ Freeze & Ice Shards',
    rarityKey: 'EPIC',
    rarity: RARITY_TIERS.EPIC.label,
    rarityColor: RARITY_TIERS.EPIC.color,
    icon: '❄️',
    desc: 'Freezes the victim in giant cyan ice crystals, then shatters them with a chime!'
  },
  {
    id: 'lightning_strike',
    category: 'killEffect',
    name: '⚡ Heavenly Lightning Strike',
    rarityKey: 'LEGENDARY',
    rarity: RARITY_TIERS.LEGENDARY.label,
    rarityColor: RARITY_TIERS.LEGENDARY.color,
    icon: '⚡',
    desc: 'A blinding 3D lightning bolt strikes from the sky with thunder and electric sparks!'
  },
  {
    id: 'golden_statue',
    category: 'killEffect',
    name: '👑 Midas Gold Burst',
    rarityKey: 'LEGENDARY',
    rarity: RARITY_TIERS.LEGENDARY.label,
    rarityColor: RARITY_TIERS.LEGENDARY.color,
    icon: '👑',
    desc: 'Turns the target into solid gold and scatters glittering gold blocks!'
  },
  {
    id: 'void_vortex',
    category: 'killEffect',
    name: '🌀 Black Hole Singularity',
    rarityKey: 'MYTHIC',
    rarity: RARITY_TIERS.MYTHIC.label,
    rarityColor: RARITY_TIERS.MYTHIC.color,
    icon: '🌀',
    desc: 'A dark purple spacetime vortex opens, sucks in particles, then explodes!'
  }
];

export const KNIFE_TRAILS = [
  {
    id: 'trail_skin',
    category: 'trail',
    name: '🗡️ Signature Knife Trail',
    rarityKey: 'COMMON',
    rarity: RARITY_TIERS.COMMON.label,
    rarityColor: RARITY_TIERS.COMMON.color,
    icon: '🗡️',
    color: null, // Uses equipped knife's trailColor
    sparkColor: null,
    rainbow: false,
    widthScale: 1.0,
    desc: 'Your equipped knife draws a clean light trail with its own energy.'
  },
  {
    id: 'trail_crimson',
    category: 'trail',
    name: '🩸 Blood Moon Plasma Trail',
    rarityKey: 'RARE',
    rarity: RARITY_TIERS.RARE.label,
    rarityColor: RARITY_TIERS.RARE.color,
    icon: '🩸',
    color: 0xff1e4d,
    sparkColor: 0xff4d6d,
    rainbow: false,
    widthScale: 1.28,
    desc: 'A wide, glowing crimson trail behind every thrown blade.'
  },
  {
    id: 'trail_emerald',
    category: 'trail',
    name: '🧪 Toxic Emerald Trail',
    rarityKey: 'RARE',
    rarity: RARITY_TIERS.RARE.label,
    rarityColor: RARITY_TIERS.RARE.color,
    icon: '🧪',
    color: 0x10f587,
    sparkColor: 0x34d399,
    rainbow: false,
    widthScale: 1.28,
    desc: 'A bright neon-emerald acid trail in flight.'
  },
  {
    id: 'trail_inferno',
    category: 'trail',
    name: '🔥 Hellfire Trail',
    rarityKey: 'EPIC',
    rarity: RARITY_TIERS.EPIC.label,
    rarityColor: RARITY_TIERS.EPIC.color,
    icon: '🔥',
    color: 0xff6b00,
    sparkColor: 0xffc83b,
    rainbow: false,
    widthScale: 1.48,
    desc: 'A flickering fire streak with live drifting embers!'
  },
  {
    id: 'trail_lightning',
    category: 'trail',
    name: '⚡ Electric Lightning Arc',
    rarityKey: 'LEGENDARY',
    rarity: RARITY_TIERS.LEGENDARY.label,
    rarityColor: RARITY_TIERS.LEGENDARY.color,
    icon: '⚡',
    color: 0x00f0ff,
    sparkColor: 0xc084fc,
    rainbow: false,
    widthScale: 1.55,
    desc: 'A high-voltage cyan-violet plasma arc with sparking discharges!'
  },
  {
    id: 'trail_rainbow',
    category: 'trail',
    name: '🌈 RGB Rainbow Trail',
    rarityKey: 'MYTHIC',
    rarity: RARITY_TIERS.MYTHIC.label,
    rarityColor: RARITY_TIERS.MYTHIC.color,
    icon: '🌈',
    color: 0xffffff,
    sparkColor: 0xf472b6,
    rainbow: true,
    widthScale: 1.65,
    desc: 'A constantly shifting RGB rainbow trail with mythic glow!'
  }
];

export const CHARACTER_HATS = [
  {
    id: 'hat_none',
    category: 'hat',
    name: '🙂 No Hat (Classic)',
    rarityKey: 'COMMON',
    rarity: RARITY_TIERS.COMMON.label,
    rarityColor: RARITY_TIERS.COMMON.color,
    icon: '🙂',
    desc: 'The classic yellow Roblox head with a stud on top.'
  },
  {
    id: 'hat_bandana',
    category: 'hat',
    name: '🥷 Ninja Headband',
    rarityKey: 'RARE',
    rarity: RARITY_TIERS.RARE.label,
    rarityColor: RARITY_TIERS.RARE.color,
    icon: '🥷',
    desc: 'A red battle headband with a metal plate and streamers flowing back!'
  },
  {
    id: 'hat_halo',
    category: 'hat',
    name: '😇 Neon Champion Halo',
    rarityKey: 'EPIC',
    rarity: RARITY_TIERS.EPIC.label,
    rarityColor: RARITY_TIERS.EPIC.color,
    icon: '😇',
    desc: 'A glowing cyan energy halo floating above your head!'
  },
  {
    id: 'hat_samurai',
    category: 'hat',
    name: '⛩️ Samurai Kasa Hat',
    rarityKey: 'EPIC',
    rarity: RARITY_TIERS.EPIC.label,
    rarityColor: RARITY_TIERS.EPIC.color,
    icon: '⛩️',
    desc: 'A wide obsidian-red ronin battle cone hat, visible in third-person!'
  },
  {
    id: 'hat_crown',
    category: 'hat',
    name: '👑 Royal Gold Crown',
    rarityKey: 'LEGENDARY',
    rarity: RARITY_TIERS.LEGENDARY.label,
    rarityColor: RARITY_TIERS.LEGENDARY.color,
    icon: '👑',
    desc: 'A shiny 3D gold crown with ruby and emerald gems!'
  },
  {
    id: 'hat_dominus',
    category: 'hat',
    name: '😈 Rivals Dominus Csuklya',
    rarityKey: 'MYTHIC',
    rarity: RARITY_TIERS.MYTHIC.label,
    rarityColor: RARITY_TIERS.MYTHIC.color,
    icon: '😈',
    desc: 'Legendary Roblox Dominus armored hood with glowing purple wing ornaments!'
  },
  {
    id: 'hat_headphones',
    category: 'hat',
    name: '🎧 Neon Headphones',
    rarityKey: 'RARE',
    rarity: RARITY_TIERS.RARE.label,
    rarityColor: RARITY_TIERS.RARE.color,
    icon: '🎧',
    desc: 'Chunky DJ headphones with glowing cyan ear cups.'
  },
  {
    id: 'hat_tricorn',
    category: 'hat',
    name: '🏴‍☠️ Pirate Tricorn',
    rarityKey: 'RARE',
    rarity: RARITY_TIERS.RARE.label,
    rarityColor: RARITY_TIERS.RARE.color,
    icon: '🏴‍☠️',
    desc: 'A black three-cornered captain hat with a gold trim and a skull emblem.'
  },
  {
    id: 'hat_tophat',
    category: 'hat',
    name: '🎩 Velvet Top Hat',
    rarityKey: 'EPIC',
    rarity: RARITY_TIERS.EPIC.label,
    rarityColor: RARITY_TIERS.EPIC.color,
    icon: '🎩',
    desc: 'A tall violet velvet top hat with a gold ribbon.'
  },
  {
    id: 'hat_antenna',
    category: 'hat',
    name: '📡 Neon Antenna',
    rarityKey: 'LEGENDARY',
    rarity: RARITY_TIERS.LEGENDARY.label,
    rarityColor: RARITY_TIERS.LEGENDARY.color,
    icon: '📡',
    desc: 'A glowing antenna that pulses above your head like a signal beacon.'
  }
];

export const COSMETIC_DROPBOX = {
  id: 'box_cosmetics',
  isCosmeticBox: true,
  name: 'Effect & Hat Crate',
  price: 180,
  color: '#c084fc',
  desc: 'Kill effects (Kill FX), throwing knife trails and 3D Roblox hats!',
  weights: {
    RARE: 46,
    EPIC: 32,
    LEGENDARY: 16,
    MYTHIC: 6
  }
};

export function getAllUnlockableCosmetics() {
  return [
    ...KILL_EFFECTS.filter((x) => x.rarityKey !== 'COMMON'),
    ...KNIFE_TRAILS.filter((x) => x.rarityKey !== 'COMMON'),
    ...CHARACTER_HATS.filter((x) => x.rarityKey !== 'COMMON')
  ];
}

export function rollCosmeticDropbox() {
  const pool = getAllUnlockableCosmetics();
  const weights = COSMETIC_DROPBOX.weights;

  const pickOne = () => {
    const r = Math.random() * 100;
    let acc = 0;
    let chosenRarity = 'RARE';
    for (const [rKey, w] of Object.entries(weights)) {
      acc += w;
      if (r <= acc) {
        chosenRarity = rKey;
        break;
      }
    }
    const candidates = pool.filter((c) => c.rarityKey === chosenRarity);
    const list = candidates.length > 0 ? candidates : pool;
    return list[Math.floor(Math.random() * list.length)];
  };

  const winner = pickOne();
  const reelItems = [];
  const winnerIndex = 34;
  for (let i = 0; i < 42; i++) {
    reelItems.push(i === winnerIndex ? winner : pickOne());
  }
  return { winner, reelItems, winnerIndex };
}

export function getKillEffectById(id) {
  return KILL_EFFECTS.find((e) => e.id === id) || KILL_EFFECTS[0];
}

export function getKnifeTrailById(id) {
  return KNIFE_TRAILS.find((t) => t.id === id) || KNIFE_TRAILS[0];
}

export function getHatById(id) {
  return CHARACTER_HATS.find((h) => h.id === id) || CHARACTER_HATS[0];
}

/**
 * Builds a crisp 3D Roblox Hat / Head Accessory Mesh attached to RivalCharacter.headPivot
 */
export function createHatMesh(hatId) {
  const g = new THREE.Group();
  if (!hatId || hatId === 'hat_none') return g;

  if (hatId === 'hat_bandana') {
    const bandMat = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.5 });
    const plateMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.2 });
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.308, 0.308, 0.13, 24), bandMat);
    band.position.set(0, 0.42, 0);
    g.add(band);

    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.09, 0.04), plateMat);
    plate.position.set(0, 0.42, -0.30);
    g.add(plate);

    // Knot + twin tails at the back (+Z)
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 10), bandMat);
    knot.position.set(0, 0.41, 0.31);
    g.add(knot);

    const tailGeo = new THREE.BoxGeometry(0.06, 0.28, 0.03);
    const t1 = new THREE.Mesh(tailGeo, bandMat);
    t1.position.set(-0.06, 0.29, 0.36);
    t1.rotation.set(0.35, 0, -0.25);
    const t2 = new THREE.Mesh(tailGeo, bandMat);
    t2.position.set(0.06, 0.29, 0.36);
    t2.rotation.set(0.35, 0, 0.25);
    g.add(t1, t2);
  } else if (hatId === 'hat_halo') {
    const haloMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.9,
      roughness: 0.15
    });
    const torus = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.038, 12, 32), haloMat);
    torus.rotation.x = Math.PI / 2;
    torus.position.set(0, 0.78, 0);
    g.add(torus);
    g.userData.floatingHalo = torus;
  } else if (hatId === 'hat_samurai') {
    const kasaMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.3 });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xff2a55,
      emissive: 0xff2a55,
      emissiveIntensity: 0.45
    });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.66, 0.26, 24), kasaMat);
    cone.position.set(0, 0.64, 0);
    g.add(cone);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.022, 8, 28), trimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, 0.52, 0);
    g.add(rim);
  } else if (hatId === 'hat_crown') {
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffc83b,
      emissive: 0xb45309,
      emissiveIntensity: 0.25,
      metalness: 0.9,
      roughness: 0.18
    });
    const gemMat = new THREE.MeshStandardMaterial({
      color: 0xff2a55,
      emissive: 0xff2a55,
      emissiveIntensity: 0.75
    });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.26, 0.14, 16), goldMat);
    base.position.set(0, 0.63, 0);
    g.add(base);

    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.16, 4), goldMat);
      spike.position.set(Math.cos(ang) * 0.24, 0.76, Math.sin(ang) * 0.24);
      g.add(spike);

      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.038), gemMat);
      gem.position.set(Math.cos(ang) * 0.275, 0.63, Math.sin(ang) * 0.275);
      g.add(gem);
    }
  } else if (hatId === 'hat_dominus') {
    const hoodMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.6 });
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0xc084fc,
      emissive: 0xa855f7,
      emissiveIntensity: 0.85
    });
    const hood = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.64, 0.66), hoodMat);
    hood.position.set(0, 0.34, 0.02);
    g.add(hood);

    // Side wing fins
    const wingGeo = new THREE.BoxGeometry(0.08, 0.44, 0.32);
    const lw = new THREE.Mesh(wingGeo, glowMat);
    lw.position.set(-0.38, 0.44, 0.08);
    lw.rotation.z = 0.32;
    const rw = new THREE.Mesh(wingGeo, glowMat);
    rw.position.set(0.38, 0.44, 0.08);
    rw.rotation.z = -0.32;
    g.add(lw, rw);
  } else if (hatId === 'hat_headphones') {
    const padMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.4 });
    const glowMat = new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 0.9 });
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.03, 10, 24, Math.PI), padMat);
    band.position.set(0, 0.29, 0);
    g.add(band);
    for (const side of [-1, 1]) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 16), padMat);
      cup.rotation.z = Math.PI / 2;
      cup.position.set(side * 0.33, 0.29, 0);
      g.add(cup);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 8, 20), glowMat);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(side * 0.385, 0.29, 0);
      g.add(ring);
    }
  } else if (hatId === 'hat_tricorn') {
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.6 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffc83b, metalness: 0.8, roughness: 0.25 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.035, 3), blackMat);
    brim.rotation.y = Math.PI / 2;
    brim.position.set(0, 0.56, 0);
    g.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.2, 3), blackMat);
    crown.rotation.y = Math.PI / 2;
    crown.position.set(0, 0.64, 0);
    g.add(crown);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), new THREE.MeshStandardMaterial({ color: 0xf8fafc }));
    skull.position.set(0, 0.68, -0.27);
    g.add(skull);
  } else if (hatId === 'hat_tophat') {
    const velvetMat = new THREE.MeshStandardMaterial({ color: 0x3b1d6e, roughness: 0.7 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffc83b, metalness: 0.85, roughness: 0.2 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.035, 28), velvetMat);
    brim.position.set(0, 0.57, 0);
    g.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.34, 24), velvetMat);
    crown.position.set(0, 0.75, 0);
    g.add(crown);
    const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(0.278, 0.278, 0.07, 24), goldMat);
    ribbon.position.set(0, 0.6, 0);
    g.add(ribbon);
  } else if (hatId === 'hat_antenna') {
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
    const glowMat = new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 1.0 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 14), metalMat);
    base.position.set(0, 0.575, 0);
    g.add(base);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.4, 8), metalMat);
    pole.position.set(0, 0.77, 0);
    g.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 12), glowMat);
    bulb.position.set(0, 0.98, 0);
    g.add(bulb);
    g.userData.pulseBulb = bulb;
  }

  return g;
}
