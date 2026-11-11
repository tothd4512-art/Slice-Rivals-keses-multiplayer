// Knife market: NPC sales (with haggling), same-rarity trades and the 3-match cooldown.
// Pure logic only (no DOM), so it can be tested on its own.
import { KNIFE_SKINS, getSkinById } from './skins.js';
import { getWrapById } from './wraps.js';

export const KNIFE_SHOP_MULT = 1.75;      // bolti érték = 1.75 × a ritkasághoz tartozó doboz ára (mint a wrap-eknél)
export const SALE_RATE = 0.5;             // eladási alap = a bolti érték fele
export const WRAP_SALE_RATE = 0.5;        // wrap-bónusz = a wrap bolti árának fele
export const TRADE_COOLDOWN_MATCHES = 3;  // cserélt kés: 3 meccsig nem adható el / cserélhető
export const HAGGLE_OPENING = 0.7;        // az NPC a várható ár 70%-ával indul
export const HAGGLE_MAX_COUNTERS = 3;     // 3 ellenajánlat után az NPC elmegy
export const MAX_PRICE_MULT = 1.1;        // a rejtett NPC-minimum felső széle: a várható ár 110%-a

// Dropbox price behind each rarity (ASCENDANT has no dropbox of its own: priced like a top box)
const KNIFE_BOX_PRICE = { COMMON: 100, RARE: 100, EPIC: 250, LEGENDARY: 500, MYTHIC: 500, ASCENDANT: 1000 };

export function knifeShopValue(skinId) {
  const skin = getSkinById(skinId);
  return Math.round((KNIFE_BOX_PRICE[skin.rarityKey] || 100) * KNIFE_SHOP_MULT);
}

export function knifeBaseSale(skinId) {
  return Math.floor(knifeShopValue(skinId) * SALE_RATE);
}

export function wrapSaleBonus(wrapId) {
  if (!wrapId || wrapId === 'wrap_none') return 0;
  const w = getWrapById(wrapId);
  if (!w || w.pattern === 'none') return 0;
  return Math.floor((w.price || 0) * WRAP_SALE_RATE);
}

/** Expected price of a knife (with an optional wrap). */
export function fairValue(skinId, wrapId = null) {
  return knifeBaseSale(skinId) + wrapSaleBonus(wrapId);
}

function cooldownMap(profile) {
  if (!profile.knifeCooldowns) profile.knifeCooldowns = {};
  return profile.knifeCooldowns;
}

export function knifeCooldownLeft(profile, skinId) {
  return cooldownMap(profile)[skinId] || 0;
}

/** Returns a reason string when the knife cannot be sold or traded, otherwise null. */
export function blockReason(profile, skinId) {
  if (!profile.unlockedSkins.includes(skinId)) return 'You do not own this knife.';
  if (getSkinById(skinId).exclusive) return 'This knife can only be earned from the tutorial. It cannot be sold or traded.';
  if (skinId === 'tactical_starter') return 'The starter knife cannot be sold.';
  if (profile.equippedSkin === skinId) return 'You cannot sell your equipped knife. Equip a different knife first.';
  const left = knifeCooldownLeft(profile, skinId);
  if (left > 0) return `This knife cannot be sold or traded for ${left} more matches.`;
  return null;
}

/**
 * Sells a knife to an NPC for `price` (the negotiated deal).
 * The optional wrap is consumed with the knife. Price must be between 1 and MAX_PRICE_MULT × fair value.
 */
export function sellKnife(profile, skinId, wrapId, price) {
  const block = blockReason(profile, skinId);
  if (block) return { ok: false, reason: block };
  const fair = fairValue(skinId, wrapId);
  if (!(price > 0) || price > Math.ceil(fair * MAX_PRICE_MULT)) {
    return { ok: false, reason: 'This price is not acceptable.' };
  }

  const useWrap = !!wrapId && wrapId !== 'wrap_none' && profile.unlockedWraps.includes(wrapId);
  profile.unlockedSkins = profile.unlockedSkins.filter((id) => id !== skinId);
  delete cooldownMap(profile)[skinId];
  let wrapUsed = null;
  if (useWrap) {
    profile.unlockedWraps = profile.unlockedWraps.filter((id) => id !== wrapId);
    wrapUsed = wrapId;
    if (profile.equippedWrap === wrapId) profile.equippedWrap = 'wrap_none';
  }
  profile.cash += price;
  return { ok: true, price, wrapUsed };
}

/** Starts an NPC haggle for a knife with an expected price `fair`. */
export function startHaggle(fair, rng = Math.random) {
  // Hidden NPC maximum: between 85% and 110% of the expected price
  const reserve = Math.round(fair * (0.85 + rng() * (MAX_PRICE_MULT - 0.85)));
  return {
    fair,
    reserve,
    offer: Math.round(fair * HAGGLE_OPENING),
    counters: 0,
    status: 'open', // 'open' | 'accepted' | 'walked'
    deal: 0
  };
}

/** The player counter-offers `ask`. Mutates and returns the haggle state. */
export function haggleCounter(h, ask) {
  if (h.status !== 'open') return h;
  const a = Math.max(h.offer, Math.round(ask));
  if (a <= h.reserve) {
    h.status = 'accepted';
    h.deal = a;
    return h;
  }
  h.counters += 1;
  if (h.counters >= HAGGLE_MAX_COUNTERS) {
    h.status = 'walked';
    return h;
  }
  // The NPC moves halfway from its offer toward its hidden maximum
  h.offer = Math.round(h.offer + (h.reserve - h.offer) * 0.5);
  return h;
}

/** The player accepts the NPC's current offer. */
export function haggleAccept(h) {
  if (h.status === 'open') {
    h.status = 'accepted';
    h.deal = h.offer;
  }
  return h;
}

/** Knives of the same rarity that the player does not own yet. */
export function tradeCandidates(profile, skinId) {
  const skin = getSkinById(skinId);
  return KNIFE_SKINS.filter((k) => k.rarityKey === skin.rarityKey && !k.exclusive && !profile.unlockedSkins.includes(k.id));
}

/** Trades a knife for a random not-yet-owned knife of the same rarity (no fee). */
export function tradeKnife(profile, skinId, rng = Math.random) {
  const block = blockReason(profile, skinId);
  if (block) return { ok: false, reason: block };
  const candidates = tradeCandidates(profile, skinId);
  if (candidates.length === 0) {
    return { ok: false, reason: 'You have no knife of this rarity that you do not already own.' };
  }
  const received = candidates[Math.floor(rng() * candidates.length)];
  profile.unlockedSkins = profile.unlockedSkins.filter((id) => id !== skinId).concat(received.id);
  delete cooldownMap(profile)[skinId];
  cooldownMap(profile)[received.id] = TRADE_COOLDOWN_MATCHES;
  return { ok: true, received };
}

/** Called once per finished match: counts the cooldowns down. */
export function tickKnifeCooldowns(profile) {
  const cd = cooldownMap(profile);
  for (const id of Object.keys(cd)) {
    cd[id] -= 1;
    if (cd[id] <= 0) delete cd[id];
  }
}
