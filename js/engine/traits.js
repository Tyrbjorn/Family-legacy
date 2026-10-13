// Trait rarity tiers, weighted rolls (Legacy-adjusted), inheritance and the Bloodline slot.
import { conflicts, traitDef } from "./family.js";
import { LG, legacyValue } from "./legacy.js";
import { D, rng } from "./state.js";

const CFG = () =>
  LG().traits || { order: ["bad", "common", "good", "rare", "epic"], weights: {}, colors: {}, fromParent: 0.5 };

export const rarityRank = id => CFG().order.indexOf((traitDef(id) || {}).rarity || "common");
export const rarityColor = id => CFG().colors[(traitDef(id) || {}).rarity || "common"] || "#bbb";

export function traitWeights(s) {
  const w = { ...CFG().weights };
  const shift = s ? Math.min(w.bad || 0, legacyValue(s, "goodblood")) : 0;
  w.bad = (w.bad || 0) - shift;
  w.good = (w.good || 0) + shift;
  const rm = s ? legacyValue(s, "rareblood") || 1 : 1;
  w.rare = (w.rare || 0) * rm;
  w.epic = (w.epic || 0) * rm;
  return w;
}

export function rollTrait(s, have) {
  const w = traitWeights(s);
  const pool = D.traits.filter(t => !have.some(o => conflicts(o, t.id)));
  const tot = pool.reduce((a, t) => a + (w[t.rarity || "common"] || 0), 0);
  let x = rng() * tot;
  for (const t of pool) {
    x -= w[t.rarity || "common"] || 0;
    if (x <= 0) return t.id;
  }
  return pool.length ? pool[pool.length - 1].id : null;
}

export function rollTraits(s, n, have = []) {
  const out = [...have];
  for (let i = 0; out.length < n && i < 50; i++) {
    const t = rollTrait(s, out);
    if (!t) break;
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

export function bestTrait(traits) {
  if (!traits.length) return null;
  const top = Math.max(...traits.map(rarityRank));
  const tied = traits.filter(t => rarityRank(t) === top);
  return tied[Math.floor(rng() * tied.length)];
}

export const traitStat = (m, k) =>
  (m.traits || []).reduce((a, t) => a + (((traitDef(t) || {}).stats || {})[k] || 0), 0);
export const traitSkillXp = (m, sk) =>
  (m.traits || []).reduce((a, t) => a + (((traitDef(t) || {}).skillXp || {})[sk] || 0), 0);
const lifeOf = traits => traits.reduce((a, t) => a + ((traitDef(t) || {}).life || 0), 0);

// Child gets exactly one guaranteed best trait (highest rarity across both parents; ties random),
// other slots from parents' pools or fresh rolls, plus the Bloodline trait when unlocked.
export function inheritTraits(s, child, parents) {
  const before = lifeOf(child.traits);
  const pool = [...new Set(parents.flatMap(p => p.traits || []))];
  const best = bestTrait(pool);
  const out = best ? [best] : [];
  if (
    legacyValue(s, "bloodline") &&
    s.bloodline &&
    !out.includes(s.bloodline) &&
    !out.some(o => conflicts(o, s.bloodline))
  )
    out.push(s.bloodline);
  const n = 2 + (out.includes(s.bloodline) && s.bloodline !== best ? 1 : 0);
  const tiedTop = pool.filter(t => t !== best && rarityRank(t) === rarityRank(best));
  const rest = pool.filter(t => rarityRank(t) < rarityRank(best));
  while (out.length < n) {
    let t = null;
    if (rest.length && rng() < CFG().fromParent) t = rest.splice(Math.floor(rng() * rest.length), 1)[0];
    else t = rollTrait(s, out);
    if (!t) break;
    // the guaranteed best stays the unique top-rarity trait from the parents
    if (out.includes(t) || tiedTop.includes(t) || out.some(o => conflicts(o, t))) continue;
    out.push(t);
  }
  child.traits = out;
  child.lifespan += lifeOf(out) - before;
  noteBloodline(s, child);
  return out;
}

export function noteBloodline(s, m) {
  for (const t of m.traits || []) if (!s.bloodline || rarityRank(t) > rarityRank(s.bloodline)) s.bloodline = t;
}
