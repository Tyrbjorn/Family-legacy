// Quest loot: drop chance and rarity curve from battle difficulty (cp) and enemy class (quest risk/type).
// The quest's own loot list are favorites (half of drops); otherwise any droppable item by rarity.
// Tunables live in data/tuning.json "loot".
import { D, rng } from "./state.js";

const LT = () => D.tuning.loot;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const RANKS = ["Common", "Fine", "Rare", "Epic", "Legendary"];
const classOf = q => ({ ...(LT().risk[q.risk] || {}), ...(LT().type[q.type] || {}) });
// d: 0 (trivial) .. 3 (far above the reference fight)
export const lootDiff = q => clamp((q.cp || 0) / LT().cpRef, 0, 3);
export function dropChance(q, lootBonus = 0) {
  const c = classOf(q);
  return clamp(LT().base + LT().perDiff * lootDiff(q) + (c.drop || 0) + lootBonus, LT().min, LT().max);
}
// rarity probabilities: base weights tilted by exp(shift × rank); shift clamped so Legendary stays rare
export function rarityOdds(q) {
  const shift = clamp(LT().shiftPerDiff * (lootDiff(q) - 1) + (classOf(q).shift || 0), LT().shiftMin, LT().shiftMax);
  const w = RANKS.map((r, i) => LT().weights[r] * Math.exp(shift * i)),
    t = w.reduce((a, b) => a + b, 0);
  return Object.fromEntries(RANKS.map((r, i) => [r, w[i] / t]));
}
const pool = () => (D._lootPool ||= D.items.filter(i => RANKS.includes(i.rarity) && !i.noDrop && i.value > 0));
function pickRarity(odds) {
  let x = rng();
  for (const r of RANKS) if ((x -= odds[r]) < 0) return r;
  return "Common";
}
// returns an item id or null
export function rollLoot(q, lootBonus = 0) {
  if (rng() >= dropChance(q, lootBonus)) return null;
  const fav = (q.loot || []).filter(id => D.items.some(i => i.id === id));
  if (fav.length && rng() < LT().favorite) return fav[Math.floor(rng() * fav.length)];
  const want = pickRarity(rarityOdds(q));
  // nearest rarity that has items
  for (let k = 0; k < RANKS.length; k++)
    for (const r of [RANKS[RANKS.indexOf(want) - k], RANKS[RANKS.indexOf(want) + k]]) {
      const c = pool().filter(i => i.rarity === r);
      if (c.length) return c[Math.floor(rng() * c.length)].id;
    }
  return null;
}
// a rare-ore find on fights: { res, n } or null
export function rollOre(q) {
  const c = classOf(q);
  if (!c.ore || rng() >= c.ore * (1 + lootDiff(q))) return null;
  const o = LT().ores;
  return { res: o[Math.floor(rng() * o.length)], n: 1 + Math.floor(rng() * 3) };
}
