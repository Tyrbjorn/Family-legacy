// Building slots and upgrade lines, production-tier helpers, and item placement gating (re-exported by estate.js).
import { afford, log, pay } from "./state.js";
import { ES, baseId, classLock, famHasClass, markPerk, pieceDef, pieceLock, pieceSlots, upgradePerk } from "./estate-pieces.js";
import { activeSynergies, structDef } from "./estate.js";

// non-manor (special) buildings gain slots with their upgrade level and unlock better items per level
const baseRank = st => (st.tier ? 0 : (ES().rankSlots || [])[Math.min(st.up || 0, (ES().rankSlots || [0]).length - 1)] || 0);
export const rankSlots = st =>
  structDef(st.type).special ? baseRank(st) + ((prodTier(st) || {}).slots || 0) + boughtUps(st).reduce((a, u) => a + (u.slots || 0), 0) : 0;
export const itemUnlockUp = (st, pid) => ((prodTier(st) || structDef(st.type)).unlockUp || {})[baseId(pid)] || 0;
export const freeSlots = (s, st) =>
  structDef(st.type).slots + fixedOf(st).length + (st.bonusSlots || 0) + rankSlots(st) - st.pieces.reduce((a, p) => a + pieceSlots(p), 0);

export const isFixed = (st, pid) => fixedOf(st).includes(baseId(pid));

// Production tiers (structure.tiers): st.tier 0 = base. Each tier has its own upgrade line; tiering up restarts
// st.up at 0 but keeps every upgrade already bought (st.keptUps), so their output and slot bonuses stay.
export const prodTier = st => (st.tier ? (structDef(st.type).tiers || [])[st.tier - 1] : null);
export const curUpgrades = st => (prodTier(st) || structDef(st.type)).upgrades || [];
export const boughtUps = st => [...(st.keptUps || []), ...curUpgrades(st).slice(0, st.up || 0)];
// built-ins: the type's own plus each reached tier's (e.g. Vintners' Wine Press)
export const fixedOf = st => [...(structDef(st.type).fixed || []), ...(structDef(st.type).tiers || []).slice(0, st.tier || 0).flatMap(t => t.fixed || [])];
export const allowedOf = st => (prodTier(st) || {}).allowed || structDef(st.type).allowed;
export const upgMult = st => boughtUps(st).reduce((a, u) => a + (u.mult || 0), 0) + (st.upPerk || 0);

export function specialUpIssue(s, uid) {
  const st = s.structures.find(x => x.uid === uid);
  const ups = st && curUpgrades(st);
  if (!ups) return "missing";
  const nx = ups[st.up || 0];
  if (!nx) return "max";
  if (nx.requiresClass && !famHasClass(s, nx.requiresClass)) return classLock(s, nx.requiresClass);
  if (!afford(s, nx.cost)) return "cannot afford";
  return null;
}

export function upgradeSpecial(s, uid) {
  if (specialUpIssue(s, uid)) return false;
  const st = s.structures.find(x => x.uid === uid);
  const nx = curUpgrades(st)[st.up || 0];
  pay(s, nx.cost);
  st.up = (st.up || 0) + 1;
  const pk = upgradePerk(s, st.type);
  if (pk) st.upPerk = (st.upPerk || 0) + nx.mult * pk;
  log(s, `🔧 ${structDef(st.type).name}: ${nx.name} installed (${nx.routes ? "+" + nx.routes + " trade route slot" : "+" + nx.mult * 100 + "% output"}).`);
  return true;
}

export function placeIssue(s, uid, pid, fromStore) {
  const st = s.structures.find(x => x.uid === uid),
    p = pieceDef(pid);
  if (!st || !p) return "missing";
  if (freeSlots(s, st) <= 0) return "building full";
  const sd = structDef(st.type);
  if (p.fixedOnly || p.mergedInto) return "built-in only";
  if (p.fitting) return "slot-free fitting (buy it under Fittings)";
  if (allowedOf(st) && !allowedOf(st).includes(baseId(pid))) return "not allowed here";
  if (!p.stack && st.pieces.map(baseId).includes(baseId(pid))) return "already here";
  if ((st.up || 0) < itemUnlockUp(st, pid)) return `needs upgrade ${itemUnlockUp(st, pid)} (${curUpgrades(st)[itemUnlockUp(st, pid) - 1]?.name || "upgrade"})`;
  if (!fromStore && pieceLock(s, p)) return "🔒 " + pieceLock(s, p);
  if (!fromStore && !afford(s, p.cost)) return "cannot afford";
  if (fromStore && !s.pieceStore.includes(pid)) return "not in storage";
  return null;
}

export function placePiece(s, uid, pid, fromStore = false) {
  if (placeIssue(s, uid, pid, fromStore)) return false;
  const st = s.structures.find(x => x.uid === uid),
    p = pieceDef(pid);
  if (fromStore) s.pieceStore.splice(s.pieceStore.indexOf(pid), 1);
  else pay(s, p.cost);
  st.pieces.push(pid);
  markPerk(s, st, pid);
  const before = new Set();
  log(s, `🪑 Placed ${p.name} in the ${structDef(st.type).name}.`);
  for (const y of activeSynergies(st)) if (y.pieces.includes(pid)) log(s, `✨ Synergy: ${y.name} (${y.desc}).`);
  return true;
}

export function removePiece(s, uid, pid) {
  const st = s.structures.find(x => x.uid === uid);
  if (!st || !st.pieces.includes(pid) || isFixed(st, pid)) return false;
  st.pieces.splice(st.pieces.indexOf(pid), 1);
  s.pieceStore.push(pid);
  return true;
}
