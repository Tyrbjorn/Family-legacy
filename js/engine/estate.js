import { fittingFx } from "./estate-pieces.js";
import { ES, baseId, pieceDef, scaledPiece } from "./estate-pieces.js";
import { prodTier } from "./estate-place.js";
import { freeVeins } from "./metals.js";

import { hasLegacy } from "./legacy.js";
import { regionKnown } from "./map.js";
import { D, afford, bl, cost, living, log, pay } from "./state.js";
import { famFx } from "./paths.js";
import { stalls, structFeatureIssue } from "./world.js";
export * from "./production.js";
export * from "./tiers.js";
export * from "./furnish.js";
export * from "./estate-pieces.js"; // items: perks, tiers, scaling, locks, upgrades
export * from "./estate-place.js"; // slots, upgrade lines, placement gating

export const structDef = id => ES().structures.find(x => x.id === id);

export const specDef = st => (st && st.spec ? (structDef(st.type).specs || []).find(x => x.id === st.spec) : null);

export const structStage = st =>
  specDef(st) ? 3 : Object.keys(structDef(st.type).upName || {}).some(k => (st.up || 0) >= +k) ? 2 : 1;

export function specIssue(s, uid, id) {
  const st = s.structures.find(x => x.uid === uid);
  const d = st && structDef(st.type);
  const sp = d && (d.specs || []).find(x => x.id === id);
  if (!sp) return "missing";
  if (st.spec) return "already specialised";
  if (!st.tier && (st.up || 0) < (d.upgrades || []).length) return "finish the upgrade line";
  if (!afford(s, sp.cost)) return "cannot afford";
  return null;
}

export function specialize(s, uid, id) {
  if (specIssue(s, uid, id)) return false;
  const st = s.structures.find(x => x.uid === uid);
  const sp = structDef(st.type).specs.find(x => x.id === id);
  pay(s, sp.cost);
  st.spec = id;
  log(s, `🏅 ${structDef(st.type).name} specialised: ${sp.name}.`);
  return true;
}

export const structName = st => {
  const sp = specDef(st);
  if (sp) return sp.name;
  if (prodTier(st)) return prodTier(st).name;
  const d = structDef(st.type);
  const u = Object.entries(d.upName || {})
    .filter(([k]) => (st.up || 0) >= +k)
    .pop();
  return u ? u[1] : d.name;
};

export const placed = s =>
  (s.structures || []).flatMap(st => [
    ...st.pieces.map(id => scaledPiece(st, id)).filter(Boolean),
    ...fittingFx(st),
    ...(prodTier(st) && prodTier(st).bonus ? [{ id: "tier", bonus: prodTier(st).bonus }] : []),
  ]);

export function activeSynergies(st) {
  const ids = [...st.pieces, ...(st.fittings || [])].map(x => (pieceDef(x) || { id: baseId(x) }).id);
  // y.only / y.except limit a combo to (or keep it out of) certain building types
  return ES().synergies.filter(
    y => y.pieces.every(p => ids.includes(p)) && (!y.only || y.only.includes(st.type)) && !(y.except || []).includes(st.type),
  );
}

export const allSynergies = s =>
  (s.structures || []).flatMap(st => activeSynergies(st).map(y => ({ ...y, where: st.uid })));

// every placed piece + every active synergy, as {bonus} objects (old furniture code reads f.bonus)
// Cached per save object: rebuilt only when the structures change (it was ~80% of tick time).
const _fx = new WeakMap();
export function effects(s) {
  let key = "";
  for (const st of s.structures || [])
    key += `${st.uid}:${st.site || ""}:${st.type}:${st.up || 0}:${st.spec || ""}:${st.pieces.join(",")}:${(st.fittings || []).join(",")}|`;
  const c = _fx.get(s);
  if (c && c.key === key) return c.list;
  const list = [
    ...placed(s),
    ...allSynergies(s),
    ...(s.structures || []).map(specDef).filter(Boolean),
    ...(s.structures || []).map(st => structDef(st.type).builtin).filter(b => b && b.bonus),
  ];
  _fx.set(s, { key, list });
  return list;
}

export const estEff = (s, k) => eff(s, k);

export const eff = (s, k) => effects(s).reduce((a, f) => a + (typeof f.bonus[k] === "number" ? f.bonus[k] : 0), 0);

export const hasPiece = (s, id) =>
  (s.structures || []).some(st => [...st.pieces, ...(st.fittings || [])].map(x => baseId(pieceDef(x) ? pieceDef(x).id : x)).includes(baseId(pieceDef(id) ? pieceDef(id).id : id)));

export const bedrooms = s => 1 + eff(s, "beds");

export const hasLand = s => (s.land || []).length > 0;

export const established = s => hasLand(s) && (s.structures || []).length > 0;

export const landSlots = s =>
  (s.land || []).reduce((a, id) => a + ES().lands.find(l => l.id === id).slots, 0) + ((s.land || []).length ? Math.floor(famFx(s, "land")) : 0);

export const landUsed = s =>
  D.buildings.reduce((a, b) => a + (bl(s, b.id) > 0 ? b.land : 0), 0) +
  (s.structures || []).filter(st => st.site !== "village").reduce((a, st) => a + structDef(st.type).land + ((prodTier(st) || {}).land || 0), 0);

export const foodCap = s => ES().caps.foodBase + eff(s, "foodCap") + bl(s, "farm") * 100;

export const matCap = s => ES().caps.matBase + eff(s, "matCap");

export const craftQuality = s => eff(s, "craftQuality");

export const buildingLevelName = (b, lv) => b.name;

export function canBuyLand(s, id) {
  const l = ES().lands.find(x => x.id === id);
  return (
    !!l &&
    (!l.region || regionKnown(s, l.region)) &&
    !(s.land || []).includes(id) &&
    (!l.requires || s.land.includes(l.requires)) &&
    afford(s, l.cost)
  );
}

export function buyLand(s, id) {
  if (!canBuyLand(s, id)) return false;
  const l = ES().lands.find(x => x.id === id);
  pay(s, l.cost);
  s.land.push(id);
  log(s, `📜 Bought ${l.name} (+${l.slots} land slots).`);
  s.deeds.push(`Bought ${l.name}.`);
  return true;
}

export function structIssue(s, type) {
  const d = structDef(type);
  if (!hasLand(s)) return "buy land first";
  if (d.villageOnly) return "village only";
  if (landUsed(s) + d.land > landSlots(s)) return "no free land slot";
  if (d.requires && !(s.structures || []).some(x => x.type === d.requires || structDef(x.type).upgradeFrom === d.requires))
    return `needs a ${structDef(d.requires).name}`;
  if (d.legacy && !hasLegacy(s, d.legacy)) return "needs Legacy upgrade";
  const fi = D.world ? structFeatureIssue(s, type) : null;
  if (fi) return fi;
  if (d.mine && D.world && !freeVeins(s).length) return "every vein on your land already has a mine";
  if (!afford(s, d.cost)) return "cannot afford";
  return null;
}

export function buildStructure(s, type, vein) {
  if (structIssue(s, type)) return null;
  const d = structDef(type);
  pay(s, d.cost);
  const st = { uid: "st" + s.nextId++, type, pieces: [...(d.fixed || [])], up: 0 };
  if (d.mine) st.vein = vein && freeVeins(s).includes(vein) ? vein : freeVeins(s)[0];
  s.structures.push(st);
  log(s, `🛖 Built a ${d.name} (${d.slots} slots).`);
  return st;
}

export const ADVENTURE_BASE_CAP = 2;

export function jobCap(s, job) {
  if (["idle", "guard", "scout"].includes(job)) return Infinity;
  if (job === "noderun") return D.world ? D.world.noderun.cap + Math.floor(stalls(s) / 2) : 0;
  // Balance: adventuring was uncapped and out-earned the whole family ~3:1 in long sims.
  // Now 2 parties, +cap of every building that houses adventurers (Adventurers' Lodge: +2).
  if (job === "adventure")
    return (
      ADVENTURE_BASE_CAP +
      (s.structures || []).reduce((a, st) => {
        const h = structDef(st.type).houses;
        return a + (h && (h.jobs || []).includes("adventure") ? h.cap || 0 : 0);
      }, 0)
    );
  let c = placed(s).reduce((a, p) => a + ((p.bonus.jobs || {})[job] || 0), 0);
  if (job === "farm") c += bl(s, "farm") * 2 + bl(s, "garden");
  if (job === "gather") c += bl(s, "lumber") * 2;
  if (job === "tutor") c += bl(s, "library");
  return c;
}

export const estateScore = s =>
  Object.values(s.buildings || {}).reduce((a, b) => a + b, 0) +
  (s.structures || []).reduce((a, st) => a + structDef(st.type).slots / 2 + st.pieces.length, 0);
export function estateStage(s) {
  if (!hasLand(s)) return "Landless";
  const t = estateScore(s);
  const STAGES = ES().stages;
  let n = STAGES[0][1];
  for (const [k, v] of STAGES) if (t >= k) n = v;
  return n;
}

export const classSynMult = (s, st) => {
  const cs = structDef(st.type).classSynergy;
  return cs && living(s).some(m => cs.classes.includes(m.cls)) ? 1 + cs.mult : 1;
};

export function buildIssue(s, b) {
  if (!hasLand(s)) return "buy land first";
  if (s.buildings[b.id] >= b.max) return "max level";
  if (!established(s)) return "build a Shack first";
  if (!s.buildings[b.id] && landUsed(s) + b.land > landSlots(s)) return "no free land slot";
  if (!afford(s, cost(s, b))) return "cannot afford";
  return null;
}

export function build(s, id) {
  const b = D.buildings.find(x => x.id === id);
  if (buildIssue(s, b)) return false;
  const c = cost(s, b);
  if (!afford(s, c)) return false;
  pay(s, c);
  s.buildings[id]++;
  log(s, `🏗️ ${b.name} ${s.buildings[id] > 1 ? "upgraded to Lv" + s.buildings[id] : "built"}.`);
  return true;
}

// data-driven: buildings = list of groups; every group needs one of its structures (AND of ORs)
export const hasStruct = (s, id) => (s.structures || []).some(st => st.type === id);

export const buildingReqMet = (s, groups) => groups.every(g => g.some(id => hasStruct(s, id)));

export const buildingReqStatus = (s, groups) =>
  groups.map(g => ({ names: g.map(id => structDef(id).name), ok: g.some(id => hasStruct(s, id)) }));

// one-line effect for the UI: the building's tradeoff line (specialty picks) or the item desc, plus its combos
export function pieceLine(id, type) {
  const p = pieceDef(id);
  if (!p) return "";
  const d = type ? structDef(type) : null;
  const base = (d && d.picks && d.picks[p.id]) || p.desc || "";
  const combos = ES()
    .synergies.filter(y => y.pieces.includes(p.id) && (!d || ((!y.only || y.only.includes(d.id)) && !(y.except || []).includes(d.id))))
    // in a building, only combos it can actually hold (1-slot buildings pair with built-ins/fittings)
    .filter(y => !d || y.pieces.filter(x => x !== p.id).every(x => [...(d.fixed || []), ...(d.fittings || []), ...((d.slots || 0) > 1 ? d.allowed || [] : [])].includes(x)))
    .map(y => `${y.icon} +${y.pieces.filter(x => x !== p.id).map(x => pieceDef(x).name).join(" + ")}: ${y.desc}`);
  return combos.length ? `${base} · Combo ${combos.join("; ")}` : base;
}
