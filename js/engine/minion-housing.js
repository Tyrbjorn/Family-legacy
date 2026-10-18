import { fishFoodMult } from "./fish.js";
import { fittingFx } from "./estate-pieces.js";
import { ES, boughtUps, scaledPiece, specDef, structDef } from "./estate.js";
import { hasService } from "./guilds.js";
import { D, bl } from "./state.js";

// ---- minions (followers, hired help, retainers)
export const minionCap = s =>
  D.minions.baseCap + (s.structures || []).length * D.minions.capPerHouse + (hasService(s, "storage") ? 2 : 0);

// other foods (meat, fish, eggs, honey) top up the food pool when it runs short
export function pantry(s, need) {
  const fv = ES().foodValue || {};
  const fq = s.foodQ || {};
  for (const [k, v] of Object.entries(fv)) {
    if (s.res.food >= need) break;
    const have = s.res[k] || 0;
    if (have <= 0) continue;
    const val = v * (fq[k] || 1) * (k === "fish" ? fishFoodMult(s) : 1); // R31.3: better fish feed more
    const use = Math.min(have, (need - s.res.food) / val);
    s.res[k] -= use;
    s.res.food += use * val;
  }
}

export const foodTypes = s => ["food", ...Object.keys(ES().foodValue || {})].filter(k => (s.res[k] || 0) >= 1).length;

// class housing: special buildings house followers of matching NPC classes (like a Bunkhouse)
export function classHomeCap(st) {
  const d = structDef(st.type);
  if (!d.houses) return 0;
  return (
    d.houses.cap + (specDef(st) ? 2 : 0) + boughtUps(st).reduce((a, u) => a + (u.cap || 0), 0)
  );
}

export function homeMap(s) {
  const out = {};
  const pool = (s.minions || []).filter(x => !x.special);
  for (const st of s.structures || []) {
    const d = structDef(st.type);
    if (!d.houses) continue;
    let n = classHomeCap(st);
    for (const mi of pool)
      if (
        n > 0 &&
        !out[mi.uid] &&
        (d.houses.classes.includes(mi.cls) ||
          (specDef(st)?.houses || []).includes(mi.cls) ||
          (d.houses.jobs || []).includes(mi.job))
      ) {
        out[mi.uid] = st.uid;
        n--;
      }
  }
  return out;
}

export const classResidents = (s, st) =>
  Object.entries(homeMap(s))
    .filter(([, u]) => u === st.uid)
    .map(([id]) => s.minions.find(x => x.uid === id));

export function housingCap(s, kind) {
  if (kind === "none") return Infinity;
  if (kind === "garden") return bl(s, "garden") > 0 ? Infinity : 0;
  return (s.structures || []).reduce(
    (a, st) =>
      a +
      (((structDef(st.type).builtin || {}).housing || {})[kind] || 0) +
      [...st.pieces.map(id => scaledPiece(st, id)), ...fittingFx(st)].reduce((b, p) => b + (((p && p.bonus.housing) || {})[kind] || 0), 0),
    0,
  );
}

export const housingKind = mi => (D.minions.types.find(t => t.id === (mi.type || mi.id)) || {}).housing || "bunk";

export function isHoused(s, mi) {
  const hm = homeMap(s);
  if (hm[mi.uid]) return true;
  const k = housingKind(mi);
  const same = s.minions.filter(x => housingKind(x) === k && !hm[x.uid]);
  return same.indexOf(mi) < housingCap(s, k);
}

export const housingUsed = (s, kind) => {
  const hm = homeMap(s);
  return Math.min(s.minions.filter(x => housingKind(x) === kind && !hm[x.uid]).length, housingCap(s, kind));
};

export const freeHousing = (s, kind = "bunk") => {
  const hm = homeMap(s);
  return housingCap(s, kind) - s.minions.filter(x => housingKind(x) === kind && !hm[x.uid]).length;
};

export const minionFood = s => s.minions.length * ES().minionFoodPerDay;

export const minionRoom = s => s.minions.filter(x => !x.special).length < minionCap(s) && freeHousing(s, "bunk") > 0;
