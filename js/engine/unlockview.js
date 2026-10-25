// R76 Unlocks screen data: a pure function of (D, legacy record, save). Reads only; nothing here changes a save or the record.
//   scope "all"  = across every lineage on this device (the legacy record kept outside the saves)
//   scope "save" = what the loaded dynasty has done, plus its own eras and estate stages (those are not kept device-wide)
import { saveMilestones, unlockMet } from "./creation.js";
import { phaseReached } from "./family.js";
import { estateScore } from "./estate.js";
const arr = x => (Array.isArray(x) ? x : []);
const rw = r => [r && r.renown ? `+${r.renown} renown` : "", r && r.coin ? `+${r.coin} coin` : "", r && r.legacy ? `+${r.legacy} Legacy` : ""].filter(Boolean).join(", ");

export function unlockRows(D, rec, s, scope = "all") {
  const save = scope === "save" && s && s.members;
  const mine = save ? saveMilestones(s) : null;
  const proof = save ? { flags: mine.flags, ach: mine.ach } : rec;
  const out = [];
  out.push({ id: "start", title: "Starting options", note: "Choices that open up when a new dynasty is created.", rows: arr((D.creation || {}).unlocks).map(u => ({
    id: u.id, name: u.name, how: u.how || "", done: save ? unlockMet(u, proof) : arr(rec.unlocks).includes(u.id) })) });
  const ach = save ? mine.ach : rec.ach || {};
  out.push({ id: "ach", title: "Achievements", note: "", rows: arr(D.achievements).map(a => ({
    id: a.id, name: a.name, icon: a.icon || "", how: a.desc || "", reward: rw(a.reward), done: ach[a.id] != null })) });
  const cu = save ? mine.classUnlocks : rec.classUnlocks || {};
  const sp = arr(D.classes).filter(c => c.special);
  if (sp.length) out.push({ id: "cls", title: "Story classes", note: "Earned once, then open to every later dynasty.", rows: sp.map(c => ({
    id: c.id, name: c.name, icon: c.icon || "", how: c.desc || "", done: !!cu[c.id] })) });
  if (save) {
    out.push({ id: "era", title: "Eras (this save)", note: "", rows: arr((D.phases || {}).list).filter(p => !p.planned).map(p => ({
      id: p.id, name: p.name, icon: p.icon || "", how: p.n === 1 ? p.desc : p.hint || p.desc, done: !!(p.n === 1 || (!p.planned && phaseReached(s, p))) })) });
    const sc = estateScore(s);
    out.push({ id: "estate", title: "Estate stages (this save)", note: "", rows: arr((D.estate || {}).stages).map(([k, name]) => ({
      id: "stage" + k, name, how: k ? `Estate level ${k}` : "Where every estate begins", done: sc >= k })) });
  }
  for (const g of out) { g.done = g.rows.filter(r => r.done).length; g.total = g.rows.length; }
  return out;
}
