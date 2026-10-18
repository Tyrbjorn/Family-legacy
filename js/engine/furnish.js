// Furniture redo: slot-free fittings and the save migration that folds merged items and trims building lists.
import { D, afford, log, pay } from "./state.js";
import { bcost } from "./builders.js";
import { ES, baseId, pieceDef, pieceLock, structDef } from "./estate.js";

export const fittingOptions = st => (structDef(st.type).fittings || []).map(pieceDef).filter(Boolean);
export function fittingIssue(s, uid, id) {
  const st = (s.structures || []).find(x => x.uid === uid),
    p = pieceDef(id);
  if (!st || !p || !(structDef(st.type).fittings || []).includes(p.id)) return "not here";
  if ((st.fittings || []).includes(p.id)) return "owned";
  const lk = pieceLock(s, p);
  if (lk) return lk;
  if (!afford(s, bcost(s, p.cost, "piece"))) return "cannot afford";
  return null;
}
export function buyFitting(s, uid, id) {
  if (fittingIssue(s, uid, id)) return false;
  const st = s.structures.find(x => x.uid === uid),
    p = pieceDef(id);
  pay(s, bcost(s, p.cost, "piece"));
  (st.fittings = st.fittings || []).push(p.id);
  log(s, `🔩 Fitted ${p.name} in the ${structDef(st.type).name}.`);
  return true;
}

const raw = id => ES().pieces.find(p => p.id === baseId(id)) || D.furniture.find(p => p.id === baseId(id));
// merged id → its new item, keeping the quality tier suffix
const remap = id => {
  const r = raw(id);
  return r && r.mergedInto ? r.mergedInto + (String(id).includes("@") ? "@" + String(id).split("@")[1] : "") : id;
};

// Save migration: merged items are replaced by their new item; stat-bump items become slot-free fittings
// (on this building if it takes them, else on the home); items a building no longer allows go to storage.
// old items whose bonus now lives on a home fitting (owners keep the effect)
const GRANT = { cradle: "nursery", coldcellar: "rootcellar" };
export function migrateFurniture(s) {
  const sts = s.structures || [];
  const home = sts.find(st => (structDef(st.type).fittings || []).includes("hourglass") && structDef(st.type).allowed?.includes("bunk"));
  const had = [...(s.pieceStore || []), ...sts.flatMap(st => st.pieces)].map(baseId);
  if (home)
    for (const [o, f] of Object.entries(GRANT))
      if (had.includes(o) && (structDef(home.type).fittings || []).includes(f)) {
        home.fittings = home.fittings || [];
        if (!home.fittings.includes(f)) home.fittings.push(f);
      }
  s.pieceStore = (s.pieceStore || []).map(remap);
  const toStore = [];
  for (const st of sts) {
    const d = structDef(st.type);
    if (!d) continue;
    const fixed = d.fixed || [];
    const keep = [];
    for (const id0 of st.pieces) {
      const id = remap(id0),
        p = pieceDef(id);
      if (!p || fixed.includes(baseId(id))) {
        keep.push(id);
        continue;
      }
      if (p.fitting) {
        const tgt = (d.fittings || []).includes(p.id) ? st : home && (structDef(home.type).fittings || []).includes(p.id) ? home : null;
        if (tgt) {
          tgt.fittings = tgt.fittings || [];
          if (!tgt.fittings.includes(p.id)) tgt.fittings.push(p.id);
        } else toStore.push(id);
        continue;
      }
      if ((d.allowed && !d.allowed.includes(p.id)) || (!p.stack && keep.some(k => baseId(k) === p.id))) toStore.push(id);
      else keep.push(id);
    }
    st.pieces = keep;
  }
  // fitting-type items sitting in storage become fittings on the home when possible
  s.pieceStore = [...s.pieceStore, ...toStore].filter(id => {
    const p = pieceDef(id);
    if (p && p.fitting && home && (structDef(home.type).fittings || []).includes(p.id)) {
      home.fittings = home.fittings || [];
      if (!home.fittings.includes(p.id)) home.fittings.push(p.id);
      return false;
    }
    return true;
  });
}
