// R31.3 fishing spots (data/fish.json). The Fish task fishes one spot: Shore (anyone), Deep water (needs a Small Boat;
// no Dock needed), Sea shore (Gull's Landing found). Every species counts as `fish`: s.res.fish is the total and
// s.fishBag records the species share, so all existing fish uses keep working; the mix sets fish sell price and food value.
// Fishing skill (best in the family) unlocks species (minLvl) and raises uncommon+ odds. Fishing-hut workers add plain shore fish.
import { addToVault, itemDef } from "./inventory.js";
import { D, log, rng } from "./state.js";
import { locDef, locKnown } from "./world.js";
import { openRequest } from "./requests.js";

export const FD = () => D.fish || { spots: [], species: [], rare: {} };
export const spotDef = id => FD().spots.find(x => x.id === id);
export const fishDef = id => FD().species.find(x => x.id === id);
const BASE = () => fishDef("fish") || { value: 2, food: 1.5 };
const ownsAny = (s, id) =>
  [...(s.vault || []), ...(s.members || []).flatMap(m => [...(m.bag || []), ...Object.values(m.equip || {})])].some(x => x === id || String(x).endsWith(id));
export const famFishLvl = s => Math.max(0, ...(s.members || []).filter(m => m.alive !== false && !m.dead).map(m => ((m.skills || {}).fishing || {}).lvl || 0));

export function spotIssue(s, sp) {
  if (!sp) return "unknown spot";
  if (sp.future) return "coming later";
  const n = sp.needs || {};
  if (n.item && !ownsAny(s, n.item)) return "needs " + (n.text || itemDef(n.item)?.name || n.item);
  if (n.location) {
    const l = D.world && locDef(n.location);
    if (l && !locKnown(s, l)) return "needs " + (n.text || l.name);
  }
  return null;
}
export const spotOpen = (s, sp) => !spotIssue(s, sp);
// species weights at a spot for a skill level (locked species dropped; uncommon+ scaled by skill)
export function catchTable(s, spotId, lvl = famFishLvl(s)) {
  const k = 1 + FD().skillPerLvl * Math.min(lvl, FD().skillCap);
  const rows = FD().species.filter(f => f.spots && f.spots[spotId] && lvl >= (f.minLvl || 0)).map(f => [f, f.spots[spotId] * (f.tier === "common" ? 1 : k)]);
  const tot = rows.reduce((a, [, w]) => a + w, 0) || 1;
  return rows.map(([f, w]) => ({ f, p: w / tot }));
}
export const spotValue = (s, id) => catchTable(s, id).reduce((a, r) => a + r.p * r.f.value, 0);
// Auto picks the open spot whose catch is worth the most
export function fishSpot(s) {
  const open = FD().spots.filter(sp => spotOpen(s, sp));
  const pin = s.fishSpot && s.fishSpot !== "auto" && open.find(sp => sp.id === s.fishSpot);
  if (pin) return pin;
  // an open villager request for a particular species wins (Auto Tend/Orders use this too)
  const want = new Set(((D.requests || {}).npcs || []).flatMap(n => Object.keys((openRequest(s, n.id) || {}).wants || {})).filter(k => k !== "fish" && fishDef(k)));
  const forReq = open.filter(sp => catchTable(s, sp.id).some(r => want.has(r.f.id)));
  if (forReq.length) return forReq.sort((a, b) => spotValue(s, b.id) - spotValue(s, a.id))[0];
  return open.sort((a, b) => spotValue(s, b.id) - spotValue(s, a.id))[0] || FD().spots[0] || { id: "shore" };
}
export function setFishSpot(s, id) {
  if (id !== "auto" && !spotOpen(s, spotDef(id))) return false;
  s.fishSpot = id;
  return true;
}
// keep the species record no larger than the fish actually in store (fish spent anywhere = an even mix spent)
export function fishBagFix(s) {
  const b = (s.fishBag = s.fishBag || {}), have = Math.max(0, s.res.fish || 0);
  const tot = Object.values(b).reduce((a, v) => a + v, 0);
  if (tot > have && tot > 0) for (const k in b) b[k] *= have / tot;
  return b;
}
// average value / food of one fish in store, relative to a plain Creek Fish
function mixMult(s, key) {
  const have = s.res.fish || 0;
  if (have <= 0) return 1;
  const b = fishBagFix(s);
  let sum = 0, n = 0;
  for (const [k, v] of Object.entries(b)) {
    const f = fishDef(k);
    if (f) (sum += v * f[key]), (n += v);
  }
  return (sum + (have - n) * BASE()[key]) / have / BASE()[key];
}
export const fishPriceMult = s => mixMult(s, "value");
export const fishFoodMult = s => mixMult(s, "food");

// land `amt` fish from the Fish task at the current spot (expected split, so totals match the old yield exactly)
export function landFish(s, amt, who) {
  if (!(amt > 0)) return;
  const sp = fishSpot(s), b = fishBagFix(s), lvl = famFishLvl(s);
  s.res.fish = (s.res.fish || 0) + amt;
  for (const { f, p } of catchTable(s, sp.id, lvl)) {
    if (f.id === "fish") continue;
    const before = b[f.id] || 0;
    b[f.id] = before + amt * p;
    if ((f.tier === "rare" || f.tier === "veryrare") && Math.floor(b[f.id]) > Math.floor(before))
      log(s, `🎣 ${who ? who.name + " landed" : "Landed"} a ${f.name} ${f.icon} in ${sp.name.toLowerCase()} (worth ${f.value}, vs ${BASE().value} for a creek fish).`);
  }
  s.fishLast = sp.id;
  const k = 1 + FD().skillPerLvl * Math.min(lvl, FD().skillCap);
  for (const r of (FD().rare || {})[sp.id] || [])
    if (rng() < r.chance * k * amt) {
      addToVault(s, r.id);
      log(s, `🦪 Out in ${sp.name.toLowerCase()} the net brought up a ${itemDef(r.id)?.name || r.id}!`);
    }
}
// species in store, best first (for the Fish task card)
export const fishMix = s => {
  const b = fishBagFix(s), have = s.res.fish || 0, rest = have - Object.values(b).reduce((a, v) => a + v, 0);
  return [["fish", rest], ...Object.entries(b)].filter(([, v]) => v >= 1).map(([k, v]) => ({ f: fishDef(k) || BASE(), n: Math.floor(v) })).sort((a, b) => b.f.value - a.f.value);
};
