// Follower milestone upgrades (data/minions.json milestones): every N levels and on evolution a follower
// gains one upgrade (extra gear slot, pack space, job/stat boosts, a job perk). Auto mode picks by class
// preference; Manual mode offers a few choices that wait (badge) and never block play.
import { D, log, rng } from "./state.js";

const MS = () => D.minions.milestones;
export const upDef = id => MS().pool.find(u => u.id === id);
const ups = mi => (mi.ups = mi.ups || []);
export const upMode = mi => mi.upMode || "auto";
export function setUpMode(s, uid, mode) {
  const mi = (s.minions || []).find(x => x.uid === uid);
  if (!mi || !["auto", "manual"].includes(mode)) return false;
  mi.upMode = mode;
  if (mode === "auto") while ((mi.pending || []).length) pickUp(s, mi, 0, autoChoice(mi, mi.pending[0].offer));
  return true;
}
const branch = mi => ((D.minions.npcClasses || []).find(c => c.id === mi.cls) || { branch: "base" }).branch;
export const prefsOf = mi => [...((MS().classPrefs || {})[mi.cls] || []), ...(MS().prefs[branch(mi)] || MS().prefs.base)];
// what can still be offered: slots once each (and only at their minLvl), repeatables always
export function available(mi) {
  const have = ups(mi).map(u => u.id);
  return MS().pool.filter(u => (u.repeat || !have.includes(u.id)) && (mi.lvl || 1) >= (u.minLvl || 0) && !(u.kind === "slot" && (mi.special || false) && false));
}
export function makeOffer(mi) {
  const av = available(mi),
    pr = prefsOf(mi),
    out = [];
  // the class's top available preference is always on the table; the rest are random
  const top = pr.find(id => av.some(u => u.id === id));
  if (top) out.push(top);
  const rest = av.map(u => u.id).filter(id => !out.includes(id));
  while (out.length < MS().offer && rest.length) out.push(rest.splice(Math.floor(rng() * rest.length), 1)[0]);
  return out;
}
export const autoChoice = (mi, offer) => prefsOf(mi).find(id => offer.includes(id)) || offer[0];
// grant a milestone: auto picks now; manual queues the offer
export function grantMilestone(s, mi, why, big = false) {
  const offer = makeOffer(mi);
  if (!offer.length) return null;
  if (upMode(mi) === "manual" && (mi.pending || []).length < MS().maxPending) {
    (mi.pending = mi.pending || []).push({ offer, big, why });
    log(s, `🔓 ${mi.name} earned an upgrade (${why}): choose in the Minions tab.`);
    return "pending";
  }
  return pickUp(s, mi, -1, autoChoice(mi, offer), big, why);
}
// pick from pending[i] (or a direct grant when i = -1)
export function pickUp(s, mi, i, id, big, why) {
  if (i >= 0) {
    const p = (mi.pending || [])[i];
    if (!p || !p.offer.includes(id)) return null;
    big = p.big;
    why = p.why;
    mi.pending.splice(i, 1);
  }
  const u = upDef(id);
  if (!u) return null;
  ups(mi).push({ id, mult: big ? MS().bigMult : 1, job: u.kind === "jobperk" ? mi.job || "idle" : undefined, lvl: mi.lvl || 1 });
  log(s, `🔓 ${mi.name} gained ${u.icon} ${u.name}${big ? " (evolution: double)" : ""}${why ? " — " + why : ""}.`);
  return id;
}
export function choosePending(s, uid, i, id) {
  const mi = (s.minions || []).find(x => x.uid === uid);
  return mi ? pickUp(s, mi, i, id) : null;
}
// called on level-up / evolution
export function onMinionLevel(s, mi) {
  if ((mi.lvl || 1) % MS().every === 0) grantMilestone(s, mi, "level " + mi.lvl);
}
export const onMinionEvolve = (s, mi, cname) => grantMilestone(s, mi, "became a " + cname, true);
// ---- effects
export const extraSlots = mi => ups(mi).map(u => upDef(u.id)).filter(u => u && u.kind === "slot").map(u => u.slot);
export function upJobMult(mi, job) {
  let m = 0;
  for (const u of ups(mi)) {
    const d = upDef(u.id);
    if (!d) continue;
    if (d.kind === "jobs") m += ((d.jobs || {})[job] || 0) * u.mult;
    if (d.kind === "jobperk" && u.job === job) m += d.n * u.mult;
  }
  return m;
}
export const upVigor = mi => ups(mi).reduce((a, u) => a + (upDef(u.id)?.kind === "vigor" ? upDef(u.id).n * u.mult : 0), 0);
export const upPacks = s => (s.minions || []).reduce((a, mi) => a + ups(mi).reduce((b, u) => b + (upDef(u.id)?.kind === "pack" ? upDef(u.id).n * u.mult : 0), 0), 0);
export const upEnchant = mi => ups(mi).reduce((a, u) => a + (upDef(u.id)?.enchant || 0) * u.mult, 0);
export const pendingCount = s => (s.minions || []).reduce((a, mi) => a + (mi.pending || []).length, 0);
// migration: followers already past milestones get them now (auto-picked quietly, no log spam)
export function backfillMilestones(s) {
  for (const mi of s.minions || []) {
    if (mi.ups) continue;
    mi.ups = [];
    mi.upMode = mi.upMode || "auto";
    const lv = mi.lvl || 1,
      save = mi.lvl;
    for (let l = MS().every; l <= lv; l += MS().every) {
      mi.lvl = l;
      const o = makeOffer(mi);
      if (o.length) mi.ups.push({ id: autoChoice(mi, o), mult: 1, lvl: l, job: upDef(autoChoice(mi, o)).kind === "jobperk" ? mi.job || "idle" : undefined });
    }
    mi.lvl = save;
    if (mi.cls && mi.cls !== "n_peasant") {
      const o = makeOffer(mi);
      if (o.length) mi.ups.push({ id: autoChoice(mi, o), mult: MS().bigMult, lvl: lv });
    }
  }
}
