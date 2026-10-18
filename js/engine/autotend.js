// Auto Tend (Legacy upgrades at_<cat>): a skill keeps working with nobody assigned, at 50% (tier 1) / 75% (tier 2)
// of a hand-worked day. It repeats the last activity / recipe / gathering spot the family used in that skill.
import { quotaAtTarget, quotaCredit } from "./quotas.js";
import { taskYields } from "./requests.js";
import { landFish } from "./fish.js";
import { LG, legacyTier, legacyValue, resGain } from "./legacy.js";
import { craftItem, recipeDef, recipeIssue } from "./inventory.js";
import { gatherInto, newTrip } from "./map.js";
import { seasonGather } from "./seasons.js";
import { gatherMult } from "./worldevents.js";
import { D, isAdult, living } from "./state.js";

export const AT = () => LG().autoTend || {};
export const atCats = () => Object.keys(AT()).filter(k => k[0] !== "_");
export const atOwned = (s, k) => legacyTier(s, "at_" + k) > 0;
export const atOn = (s, k) => atOwned(s, k) && !(s.autoOff || {})["at_" + k];
export const atRate = (s, k) => (atOn(s, k) ? legacyValue(s, "at_" + k) : 0);

// flip an automation switch (at_<cat> or eq_<gear|tools>); everything is on by default once owned
export function toggleAuto(s, key) {
  s.autoOff = s.autoOff || {};
  if (s.autoOff[key]) delete s.autoOff[key];
  else s.autoOff[key] = true;
}

// what the category repeats: { kind, id, name } or null
export function atTarget(s, k) {
  const c = AT()[k],
    L = s.atLast || {};
  const qt = quotaAtTarget(s, c); // R34: an open quota this category can make comes first
  if (qt) return qt;
  if (c.kind === "gather") {
    const n = L.gather && D.nodes.find(x => x.id === L.gather);
    return n ? { kind: "gather", id: n.id, name: n.name } : null;
  }
  if (c.kind === "activity") {
    const id = c.skills.map(sk => L["ac:" + sk]).find(Boolean) || c.default;
    const ac = D.activities.find(x => x.id === id);
    return ac ? { kind: "activity", id, name: ac.name } : null;
  }
  const id = c.skills.map(sk => L["rc:" + sk]).find(Boolean);
  const rc = id && recipeDef(id);
  return rc ? { kind: "craft", id, name: rc.name } : null;
}

// Extraction pays only the gathering share of a hand trip: gathering days / (gathering + round-trip days)
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
    if (c.kind === "activity") return a.type === "activity" && (D.activities.find(x => x.id === a.target)?.skills || []).some(sk => c.skills.includes(sk));
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
      const ac = D.activities.find(x => x.id === t.id);
      for (const [res, v] of Object.entries(taskYields(s, ac))) { res === "fish" && ac.id === "fishing" ? landFish(s, v * r) : (s.res[res] = (s.res[res] || 0) + v * r); quotaCredit(s, res, v * r); }
    } else if (t.kind === "gather") {
      const n = D.nodes.find(x => x.id === t.id),
        trip = { load: {}, cap: Infinity };
      gatherInto(s, trip, n, r * gatherShare(s, n) * resGain(s) * gatherMult(s, n.region) * seasonGather(s), () => 0);
      for (const [res, v] of Object.entries(trip.load)) (s.res[res] = (s.res[res] || 0) + v), quotaCredit(s, res, v);
    } else {
      const rc = recipeDef(t.id),
        m = bestHand(s, rc.skill);
      if (!m || recipeIssue(s, m, rc)) continue;
      s.atProg[k] = (s.atProg[k] || 0) + r;
      if (s.atProg[k] >= rc.days) {
        s.atProg[k] = 0;
        craftItem(s, m, rc, null);
      }
    }
  }
}
