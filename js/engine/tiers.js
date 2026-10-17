// Building tiers: upgrade options (House → manor branches), branch unlocks, respec, demolish (half refund, bed check).
import { D, afford, isAdult, living, log, pay } from "./state.js";
import { inLine } from "./skills.js";
import { isHoused } from "./minions.js";
import { era } from "./family.js";
import { ES, estateStage, baseId, bedrooms, className, curUpgrades, isFixed, landSlots, landUsed, rankSlots, structDef, prodTier } from "./estate.js";

// Next tiers: a building can have several (House → Mansion / Fort / Tower Keep / Abbey).
export const upgradeOptions = type => ES().structures.filter(x => x.upgradeFrom === type);
export const isBranch = d => !!(d && d.branch);
// Branch unlock: every member requirement on ONE member; building requirement on the estate.
export function branchReqIssue(s, d) {
  const q = d.req || {};
  const stages = ES().stages.map(x => x[1]);
  if (q.stage && stages.indexOf(estateStage(s)) < stages.indexOf(q.stage)) return `needs a ${q.stage} estate`;
  if (q.phase && era(s).n < q.phase) return `needs the ${(D.phases.list.find(p => p.n === q.phase) || {}).name} phase`;
  if (q.building && !(s.structures || []).some(st => q.building.types.includes(st.type) && (st.up || 0) >= q.building.up))
    return `needs ${q.building.types.map(id => structDef(id).name).join(" or ")}${q.building.up ? ` (upgrade ${q.building.up})` : ""}`;
  const okM = m =>
    isAdult(m) &&
    Object.entries(q.skill || {}).every(([k, v]) => ((m.skills || {})[k] || { lvl: 0 }).lvl >= v) &&
    (!q.line || inLine(m, q.line));
  if ((q.skill || q.line) && !living(s).some(okM))
    return "needs one member with " + [...Object.entries(q.skill || {}).map(([k, v]) => `${k} ${v}`), ...(q.line ? [`a ${className(q.line)}-line class`] : [])].join(" + ");
  return null;
}
const pickNext = (st, to) => (to ? upgradeOptions(st.type).find(x => x.id === to) : upgradeOptions(st.type)[0]);
// Would changing this building's type leave the family short of beds (a Fort's beds house followers)?
export function typeBedIssue(s, st, to) {
  const before = bedrooms(s),
    was = st.type;
  st.type = to;
  const after = bedrooms(s);
  st.type = was;
  const need = living(s).length;
  return after < need && after < before ? `${structDef(to).name} beds house followers; family would be short ${need - after} bed${need - after > 1 ? "s" : ""}` : null;
}
export function upgradeIssue(s, uid, to) {
  const st = s.structures.find(x => x.uid === uid);
  if (!st) return "missing";
  const nx = pickNext(st, to);
  if (!nx) return "max";
  if (landUsed(s) - structDef(st.type).land + nx.land > landSlots(s)) return "no free land slot";
  if (isBranch(nx)) {
    const bi = branchReqIssue(s, nx) || typeBedIssue(s, st, nx.id);
    if (bi) return bi;
  }
  if (!afford(s, nx.cost)) return "cannot afford";
  return null;
}

function setType(st, id) {
  const fx = structDef(st.type).fixed || [];
  st.pieces = st.pieces.filter(p => !fx.includes(baseId(p)));
  st.type = id;
  st.pieces = [...(structDef(id).fixed || []), ...st.pieces];
}

export function upgradeStructure(s, uid, to) {
  if (upgradeIssue(s, uid, to)) return false;
  const st = s.structures.find(x => x.uid === uid);
  const nx = pickNext(st, to);
  pay(s, nx.cost);
  log(s, `🏗️ ${structDef(st.type).name} upgraded to ${nx.name}.`);
  setType(st, nx.id);
  return true;
}

const refundOf = c => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Math.floor(v * (D.tuning.demolishRefund ?? 0.5))]));
const give = (s, c) => {
  for (const [k, v] of Object.entries(c)) s.res[k] = (s.res[k] || 0) + v;
};
const costText = c => Object.entries(c).map(([k, v]) => `${v} ${k}`).join(", ");

// Respec a manor branch: rebuild as another branch, refund half the old branch's cost, pay the new one in full.
export function respecIssue(s, uid, to) {
  const st = s.structures.find(x => x.uid === uid);
  const cur = st && structDef(st.type),
    nx = structDef(to);
  if (!st || !isBranch(cur) || !isBranch(nx) || nx.upgradeFrom !== cur.upgradeFrom) return "not possible";
  if (nx.id === cur.id) return "already this";
  const bi = branchReqIssue(s, nx) || typeBedIssue(s, st, nx.id);
  if (bi) return bi;
  const r = refundOf(cur.cost);
  if (!Object.entries(nx.cost).every(([k, v]) => (s.res[k] || 0) + (r[k] || 0) >= v)) return "cannot afford";
  return null;
}
export function respecStructure(s, uid, to) {
  if (respecIssue(s, uid, to)) return false;
  const st = s.structures.find(x => x.uid === uid),
    cur = structDef(st.type),
    nx = structDef(to);
  give(s, refundOf(cur.cost));
  pay(s, nx.cost);
  setType(st, nx.id);
  log(s, `🔁 ${cur.name} rebuilt as a ${nx.name} (half the old cost refunded).`);
  return true;
}

// Demolish: refund half of everything paid for this building (its whole tier chain), furniture goes to storage.
export function paidChain(type) {
  const out = {};
  for (let d = structDef(type); d; d = d.upgradeFrom ? structDef(d.upgradeFrom) : null)
    for (const [k, v] of Object.entries(d.cost || {})) out[k] = (out[k] || 0) + v;
  return out;
}
export const demolishRefund = st => refundOf(paidChain(st.type));
// Blocked if it would leave the family short of beds or put housed followers out on the street.
const bedsState = s => ({ fam: bedrooms(s), housed: (s.minions || []).filter(mi => isHoused(s, mi)).length });
export function demolishIssue(s, uid) {
  const st = s.structures.find(x => x.uid === uid);
  if (!st) return "missing";
  const before = bedsState(s),
    all = s.structures;
  s.structures = all.filter(x => x !== st);
  const after = bedsState(s);
  s.structures = all;
  const need = living(s).length;
  if (after.fam < need && after.fam < before.fam) return `family needs ${need} beds (would have ${after.fam})`;
  if (after.housed < before.housed) return `${before.housed - after.housed} follower(s) would lose their beds`;
  return null;
}
export function demolishStructure(s, uid) {
  const st = s.structures.find(x => x.uid === uid);
  if (!st || demolishIssue(s, uid)) return false;
  const r = demolishRefund(st);
  for (const p of st.pieces) if (!isFixed(st, p)) s.pieceStore.push(p);
  s.structures = s.structures.filter(x => x !== st);
  give(s, r);
  log(s, `🧨 Demolished the ${structDef(st.type).name}: refunded ${costText(r)}.`);
  return true;
}


// ---- production tiers (3 total): same building type, st.tier 0→1→2; needs the current upgrade line finished
export const nextTier = st => (structDef(st.type).tiers || [])[st.tier || 0];
export function tierUpIssue(s, uid) {
  const st = s.structures.find(x => x.uid === uid),
    nx = st && nextTier(st);
  if (!nx) return "max";
  if ((st.up || 0) < curUpgrades(st).length) return "finish the upgrade line";
  if (st.site !== "village" && landUsed(s) + (nx.land || 0) - ((prodTier(st) || {}).land || 0) > landSlots(s)) return "no free land slot";
  if (!afford(s, nx.cost)) return "cannot afford";
  return null;
}
export function tierUp(s, uid) {
  if (tierUpIssue(s, uid)) return false;
  const st = s.structures.find(x => x.uid === uid),
    nx = nextTier(st);
  pay(s, nx.cost);
  // bank what was bought: this line's upgrades (+ the base line's level-slot bonus) stay in effect
  const base = st.tier ? 0 : rankSlots(st);
  st.keptUps = [...(st.keptUps || []), ...curUpgrades(st).slice(0, st.up || 0), ...(base ? [{ name: "base line slots", slots: base }] : [])];
  st.tier = (st.tier || 0) + 1;
  st.pieces = [...(nx.fixed || []), ...st.pieces];
  st.up = 0;
  log(s, `🏗️ ${structDef(st.type).name} raised to ${nx.name}.`);
  return true;
}
