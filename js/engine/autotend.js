import { findId } from "./lookup.js";
// Auto Tend (Legacy upgrades at_<cat>): a skill keeps working with nobody assigned, at 50% (tier 1) / 75% (tier 2)
// of a hand-worked day. It repeats the last activity / recipe / gathering spot the family used in that skill.
import { quotaAtTarget, quotaCredit } from "./quotas.js";
import { taskYields } from "./requests.js";
import { landFish } from "./fish.js";
import { LG, legacyTier, legacyValue, resGain } from "./legacy.js";
import { CR, craftItem, itemDef, recipeDef, recipeIssue } from "./inventory.js";
import { activityOk } from "./skills.js";
import { gatherInto, newTrip } from "./map.js";
import { seasonGather } from "./seasons.js";
import { gatherMult } from "./worldevents.js";
import { D, isAdult, living, log } from "./state.js";

export const AT = () => LG().autoTend || {};
export const atCats = () => Object.keys(AT()).filter(k => k[0] !== "_");
// R37: free once unlocked (a family adult has the skill and the task/building is available); Tireless Hands (at_tend) tiers raise the rate
export const atTier = s => legacyTier(s, "at_tend");
export function atIssue(s, k) {
  const c = AT()[k];
  if (!c) return "unknown";
  const ad = living(s).filter(isAdult);
  const ks = c.skills || [];
  if (ks.length && !ks.some(x => ad.some(m => ((m.skills[x] || {}).lvl || 0) >= 1))) return `needs ${c.skills.map(x => (findId(D.skills, x) || { name: x }).name).join("/")} 1`;
  const t = atTargetRaw(s, k);
  if (!t && c.kind === "craft" && c.default && recipeDef(c.default)) { const d = recipeDef(c.default), m = bestHand(s, d.skill); let r = "no crafter"; try { r = m ? recipeIssue(s, m, d) : r; } catch {} if (r && r !== "missing materials") return r; } // R44: e.g. "needs Larder"
  if (!t) return c.kind === "gather" ? "gather somewhere by hand once" : `do a ${(findId(D.skills, ks[0]) || { name: k }).name} task by hand once`;
  if (t.kind === "activity") { const ac = findId(D.activities, t.id); if (!ad.some(m => activityOk(s, m, ac))) return `${ac.name} is locked`; }
  if (t.kind === "craft") { const rc = recipeDef(t.id), m = bestHand(s, rc.skill), r = m ? recipeIssue(s, m, rc) : "no crafter"; if (r && !/need|have|missing|\d/.test(r)) return r; }
  return null;
}
export const atOwned = (s, k) => !atIssue(s, k);
export const atOn = (s, k) => !(s.autoOff || {})["at_" + k] && atOwned(s, k);
export const atRate = (s, k) => (atOn(s, k) ? legacyValue(s, "at_tend") : 0);

// flip an automation switch (at_<cat> or eq_<gear|tools>); everything is on by default once owned
export function toggleAuto(s, key) {
  s.autoOff = s.autoOff || {};
  if (s.autoPwd) delete s.autoPwd[key];
  if (s.autoOff[key]) delete s.autoOff[key];
  else s.autoOff[key] = true;
}

// what the category repeats: { kind, id, name } or null
export function atTarget(s, k) {
  const c = AT()[k],
    L = s.atLast || {};
  const qt = atTier(s) >= 1 ? quotaAtTarget(s, c) : quotaAtTarget(s, c, true); // R34 (R43: work orders steer free auto too): an open quota comes first (R37: Tireless Hands tier 1+)
  if (qt) return qt;
  return atTargetRaw(s, k);
}
// last-used target (R37 tier 2: best-paying craftable recipe when there's nothing to repeat)
function atTargetRaw(s, k) {
  const c = AT()[k],
    L = s.atLast || {};
  if (c.kind === "gather") {
    const n = (L.gather && findId(D.nodes, L.gather)) || D.nodes.find(x => x.res && !x.skill && (s.revealed || []).includes(x.id)); // R43: full auto from day 1 (first known spot)
    return n ? { kind: "gather", id: n.id, name: n.name } : null;
  }
  if (c.kind === "activity") {
    const id = c.skills.map(sk => L["ac:" + sk]).find(Boolean) || c.default;
    const ac = findId(D.activities, id);
    return ac ? { kind: "activity", id, name: ac.name } : null;
  }
  const id = c.skills.map(sk => L["rc:" + sk]).find(Boolean);
  const rc = id && recipeDef(id);
  if (rc) return { kind: "craft", id, name: rc.name };
  if (c.kind === "craft" && atTier(s) < 2) return atDefault(s, c); // R44: full auto from day 1 (default recipe)
  if (c.kind === "craft" && atTier(s) >= 2) {
    const best = CR().recipes.filter(r => c.skills.includes(r.skill)).map(r => [r, bestHand(s, r.skill)]).filter(([r, m]) => m && !recipeIssue(s, m, r)).sort((a, b) => (recipeValue(b[0]) - recipeValue(a[0])))[0];
    if (best) return { kind: "craft", id: best[0].id, name: best[0].name };
  }
  return atDefault(s, c);
}
// R44: a craft category's default recipe (data autoTend.<cat>.default), else its quickest recipe someone can make now
function atDefault(s, c) {
  const ok = r => { if (r.hidden || r.forClass || r.requiresClass || r.legacy) return false; const m = bestHand(s, r.skill); let i; try { i = m ? recipeIssue(s, m, r) : "no crafter"; } catch { return false; } return !i || i === "missing materials"; };
  const d = c.default && recipeDef(c.default);
  if (d && ok(d)) return { kind: "craft", id: d.id, name: d.name, dflt: true };
  const r = CR().recipes.filter(r => (c.skills || []).includes(r.skill) && ok(r)).sort((a, b) => a.days - b.days)[0];
  return r ? { kind: "craft", id: r.id, name: r.name, dflt: true } : null;
}

// R44 pause when done for automation lines (at_<cat>, ac): the line switches itself off after its current task
export const autoPwd = (s, key) => !!(s.autoPwd || {})[key];
export function setAutoPwd(s, key, on = true) { s.autoPwd = s.autoPwd || {}; if (on) s.autoPwd[key] = true; else delete s.autoPwd[key]; }
export function autoPwdFire(s, key, label) {
  if (!autoPwd(s, key)) return false;
  delete s.autoPwd[key];
  (s.autoOff = s.autoOff || {})[key] = true;
  log(s, `⏸️ ${label} paused when done.`);
  return true;
}

// Extraction pays only the gathering share of a hand trip: gathering days / (gathering + round-trip days)
const recipeValue = r => (itemDef(r.base || r.out) || {}).value || 0;
export function gatherShare(s, n) {
  const t = newTrip({ type: "gather", target: n.id }, s);
  return t.task / Math.max(t.task, t.out + t.task + t.back);
}

// someone already doing it by hand?
function manned(s, k) {
  const c = AT()[k];
  return living(s).some(m => {
    const a = m.action;
    if (!a) return false;
    if (c.kind === "gather") return a.type === "gather";
    if (c.kind === "activity") return a.type === "activity" && (findId(D.activities, a.target)?.skills || []).some(sk => c.skills.includes(sk));
    return a.type === "craft" && c.skills.includes((recipeDef(a.rc || a.target) || {}).skill);
  });
}

const bestHand = (s, skill) =>
  living(s).filter(isAdult).sort((a, b) => ((b.skills[skill] || {}).lvl || 0) - ((a.skills[skill] || {}).lvl || 0))[0];

export function autoTendDay(s) {
  if (!LG().autoTend) return;
  s.atProg = s.atProg || {};
  for (const k of atCats()) {
    const r = atRate(s, k);
    if (!r || manned(s, k)) continue;
    const t = atTarget(s, k);
    if (!t) continue;
    if (t.kind === "activity") {
      const ac = findId(D.activities, t.id);
      for (const [res, v] of Object.entries(taskYields(s, ac))) { res === "fish" && ac.id === "fishing" ? landFish(s, v * r) : (s.res[res] = (s.res[res] || 0) + v * r); quotaCredit(s, res, v * r); }
      autoPwdFire(s, "at_" + k, `Auto ${ac.name}`);
    } else if (t.kind === "gather") {
      const n = findId(D.nodes, t.id),
        trip = { load: {}, cap: Infinity };
      gatherInto(s, trip, n, r * gatherShare(s, n) * resGain(s) * gatherMult(s, n.region) * seasonGather(s), () => 0);
      for (const [res, v] of Object.entries(trip.load)) (s.res[res] = (s.res[res] || 0) + v), quotaCredit(s, res, v);
      autoPwdFire(s, "at_" + k, `Auto gathering (${n.name})`);
    } else {
      const rc = recipeDef(t.id),
        m = bestHand(s, rc.skill);
      if (!m || recipeIssue(s, m, rc)) continue;
      s.atProg[k] = (s.atProg[k] || 0) + r * (1 + legacyValue(s, "craftspd")); // R43
      if (s.atProg[k] >= rc.days) {
        s.atProg[k] = 0;
        craftItem(s, m, rc, null);
        autoPwdFire(s, "at_" + k, `Auto ${rc.name}`);
      }
    }
  }
}

// R37: Auto Tend categories a building serves (its pieces are stations for that skill's recipes, or unlock its activity)
export function atCatsFor(s, st) {
  const P = st.pieces || [];
  return atCats().filter(k => {
    const c = AT()[k], ks = c.skills || [];
    if (c.kind === "activity") { const t = atTargetRaw(s, k), ids = [c.default, t && t.id]; return D.activities.some(a => ids.includes(a.id) && [].concat(a.unlock || []).some(u => u && P.includes(u.piece))); } // the default or current task only
    if (c.kind === "craft") return CR().recipes.some(r => ks.includes(r.skill) && P.includes(r.station));
    return false;
  });
}
// R37 status line for the Automation page: { on, why, rate, target }
export function atStatus(s, k) {
  const iss = atIssue(s, k), t = !iss && atTarget(s, k);
  return { k, locked: !!iss, why: iss, on: atOn(s, k), rate: legacyValue(s, "at_tend"), pwd: autoPwd(s, "at_" + k), dflt: !!(t && t.dflt), manned: !iss && manned(s, k), target: t ? t.name : null };
}
