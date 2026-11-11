import { RARITY_TIERS } from './skins.js';

export const ABILITIES = [
  {
    id: 'ability_dash',
    category: 'ability',
    name: '💨 Lightning Dash',
    shortName: 'Dash',
    icon: '💨',
    cooldown: 3.5,
    rarityKey: 'COMMON',
    rarity: RARITY_TIERS.COMMON.label,
    rarityColor: RARITY_TIERS.COMMON.color,
    desc: 'Quick directional dodge in your movement direction (unlocked by default).'
  },
  {
    id: 'ability_adrenaline',
    category: 'ability',
    name: '💉 Adrenaline Surge',
    shortName: 'Adrenalin',
    icon: '💉',
    cooldown: 13.0,
    rarityKey: 'RARE',
    rarity: RARITY_TIERS.RARE.label,
    rarityColor: RARITY_TIERS.RARE.color,
    desc: 'Instant +35 HP heal and +35% run speed for 4.5 seconds!'
  },
  {
    id: 'ability_rage',
    category: 'ability',
    name: '🔥 1.5x Bloodlust',
    shortName: '1.5x Damage',
    icon: '🔥',
    cooldown: 14.0,
    rarityKey: 'EPIC',
    rarity: RARITY_TIERS.EPIC.label,
    rarityColor: RARITY_TIERS.EPIC.color,
    desc: 'Red battle aura for 5.5 seconds. All your slashes and throws deal 1.5x damage!'
  },
  {
    id: 'ability_triple_fan',
    category: 'ability',
    name: '💠 Triple Fan Throw',
    shortName: '3x Fan',
    icon: '💠',
    cooldown: 8.5,
    rarityKey: 'EPIC',
    rarity: RARITY_TIERS.EPIC.label,
    rarityColor: RARITY_TIERS.EPIC.color,
    desc: 'Throws 3 knives at once in a horizontal fan. Your main knife stays in your hand!'
  },
  {
    id: 'ability_shadowstep',
    category: 'ability',
    name: '🌑 Shadowstep',
    shortName: 'Teleport',
    icon: '🌑',
    cooldown: 9.5,
    rarityKey: 'EPIC',
    rarity: RARITY_TIERS.EPIC.label,
    rarityColor: RARITY_TIERS.EPIC.color,
    desc: 'Teleports 9.5 m forward through dark purple shadow smoke, slipping past the enemy!'
  },
  {
    id: 'ability_barrage',
    category: 'ability',
    name: '🗡️ Rapid Knife Volley',
    shortName: 'Knife Volley',
    icon: '🗡️',
    cooldown: 12.5,
    rarityKey: 'LEGENDARY',
    rarity: RARITY_TIERS.LEGENDARY.label,
    rarityColor: RARITY_TIERS.LEGENDARY.color,
    desc: 'Rapid blade barrage: throws 5 knives in quick succession at your crosshair!'
  },
  {
    id: 'ability_shock_slam',
    category: 'ability',
    name: '💥 Aerial Blade Slam',
    shortName: 'Air Slam',
    icon: '💥',
    cooldown: 11.0,
    rarityKey: 'LEGENDARY',
    rarity: RARITY_TIERS.LEGENDARY.label,
    rarityColor: RARITY_TIERS.LEGENDARY.color,
    desc: 'Leap and slam down: a 5.5 m shockwave with 55 damage and knockback!'
  },
  {
    id: 'ability_chrono_blade',
    category: 'ability',
    name: '⏳ Chrono Blade',
    shortName: 'Chrono Blade',
    icon: '⏳',
    cooldown: 17.0,
    rarityKey: 'MYTHIC',
    rarity: RARITY_TIERS.MYTHIC.label,
    rarityColor: RARITY_TIERS.MYTHIC.color,
    desc: 'Zeroes your throw cooldown for 6 seconds, gives an instant full-power throw, +25% damage and a speed boost!'
  }
];

export const ABILITY_DROPBOX = {
  id: 'box_abilities',
  isAbilityBox: true,
  name: '⚡ Ability Crate',
  price: 200,
  color: '#10f587',
  desc: 'Open active abilities (1.5x Damage, Rapid Knife Volley, Shadowstep, Chrono Blade) for your wheel!',
  weights: {
    RARE: 22,
    EPIC: 44,
    LEGENDARY: 26,
    MYTHIC: 8
  }
};

export function getAbilityById(id) {
  return ABILITIES.find((a) => a.id === id) || null;
}

export function rollAbilityDropbox() {
  const pool = ABILITIES.filter((a) => a.rarityKey !== 'COMMON');
  const weights = ABILITY_DROPBOX.weights;

  const pickOne = () => {
    const r = Math.random() * 100;
    let acc = 0;
    let chosen = 'EPIC';
    for (const [rKey, w] of Object.entries(weights)) {
      acc += w;
      if (r <= acc) {
        chosen = rKey;
        break;
      }
    }
    const candidates = pool.filter((x) => x.rarityKey === chosen);
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

export const RANK_TIERS = [
  { minRp: 0, name: 'Bronze', icon: '🥉', color: '#d97706' },
  { minRp: 150, name: 'Silver', icon: '🥈', color: '#cbd5e1' },
  { minRp: 300, name: 'Arany', icon: '🥇', color: '#facc15' },
  { minRp: 500, name: 'Platina', icon: '💠', color: '#38bdf8' },
  { minRp: 750, name: 'Diamond', icon: '💎', color: '#a855f7' },
  { minRp: 1050, name: 'Rivals Champion', icon: '👑', color: '#ff2a55' }
];

export function getRankInfo(rp = 100) {
  let current = RANK_TIERS[0];
  for (const tier of RANK_TIERS) {
    if (rp >= tier.minRp) current = tier;
  }
  return current;
}
