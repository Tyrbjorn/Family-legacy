import { findId } from "./lookup.js";
// Metals in play: recipe metal + quality step (boosted by Forge Hall/Foundry/Jeweler upgrades) and mines
// that dig the ore of every vein the family owns (rare veins need a deeper mine tier).
import { D } from "./state.js";
import { boughtUps, pieceMult } from "./estate.js";
import { featureDef, ownedFeatures } from "./world.js";

const MD = () => D.metals || { metals: {}, templates: [] };
export const metalDef = id => MD().metals[id];
const byRes = () => Object.fromEntries(Object.entries(MD().metals).map(([k, m]) => [m.res, k]));
// the recipe's metal: explicit, else the metal resource it uses most
export function recipeMetal(rc) {
  if (!rc) return null;
  if (rc.metal) return rc.metal;
  const R = byRes();
  let best = null,
    n = 0;
  for (const [k, v] of Object.entries(rc.mats || {})) if (R[k] && v > n) (best = R[k]), (n = v);
  return best;
}
// building upgrades with metalQ (optionally limited to some metals) raise that metal's step
export const metalUpgradeQ = (s, mid) =>
  (s.structures || []).reduce((a, st) => a + boughtUps(st).reduce((b, u) => b + (u.metalQ && (!u.metals || u.metals.includes(mid)) ? u.metalQ : 0), 0), 0);
export const metalQuality = (s, rc) => {
  const mid = recipeMetal(rc);
  return mid ? (metalDef(mid).q || 0) + metalUpgradeQ(s, mid) : 0;
};

// mines: one mine per vein type. st.vein is the vein it was built on (old saves: the iron vein).
// Rare veins only yield once the mine reaches their tier (Deep Mine = 1, Ore Gallery = 2).
export const veinOf = st => st.vein || "ore_vein";
const isVein = f => !!(featureDef(f) || {}).mine;
export const freeVeins = s => ownedFeatures(s).filter(f => isVein(f) && !(s.structures || []).some(st => structMine(st) && veinOf(st) === f));
const structMine = st => !!(findId(D.estate.structures, st.type) || {}).mine;
export const veinsFor = (s, st) => {
  const f = { id: veinOf(st), ...featureDef(veinOf(st)) };
  return f.mine && ownedFeatures(s).includes(f.id) && (st.tier || 0) >= (f.mine.tier || 0) ? [f] : [];
};
// a piece with bonus.veins (the Shaft Lift) raises its listed processes plus every reachable vein's ore
export const veinProcesses = (s, st, p) => [...(p.bonus.processes || []), ...veinsFor(s, st).map(v => ({ in: {}, out: v.mine.res, rate: v.mine.rate * pieceMult(st, p.id) }))];
