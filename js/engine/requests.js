// R31 villager requests (data/requests.json) + task yields.
// Each NPC has one open request at a time; delivering hands over goods (instant in the home village), pays the reward,
// raises that NPC's favour, then the next request posts after a cooldown. Some requests carry a one-time `extra`:
// a permanent shop discount, a small task bonus, or a quest-line unlock. Expansions add npcs/requests with no engine change.
import { spendFish } from "./cooking.js";
import { addToVault, itemDef } from "./inventory.js";
import { revealAt } from "./map.js";
import { srcOk, srcText } from "./skills.js";
import { D, log, rng } from "./state.js";

const RQ = () => D.requests || { npcs: [], cooldown: [3, 7], favourPerDelivery: 10 };
export const npcDef = id => RQ().npcs.find(n => n.id === id);
const st = (s, id) => ((s.req = s.req || {})[id] = s.req[id] || { i: 0, at: 0, n: 0, fav: 0 });
const HOME = "millbrook";

// R31: what a task yields today for this family (data yields x boosts from quests/pieces x request bonuses)
const RANGED = ["bow", "crossbow", "sling"];
const owned = s => [...(s.vault || []), ...(s.members || []).flatMap(m => [...(m.bag || []), ...Object.values(m.equip || {})])].filter(Boolean).map(x => itemDef(x)).filter(Boolean);
const fits = (it, kind) => (kind === "ranged" ? it.slot === "weapon" && RANGED.includes(it.type) : it.taskTool === kind);
// R31 tool gate: Hunt needs a ranged weapon, Chop an axe/hatchet, Dig a pick (owned anywhere in the family)
export const taskTools = (s, ac) => (ac.tool ? owned(s).filter(it => fits(it, ac.tool.kind)) : []);
export const toolIssue = (s, ac) => (ac.tool && !taskTools(s, ac).length ? "needs " + ac.tool.text : null);
// better tools raise yield a little: axes by taskYield, bows by cp (Hunting Bow +5%, Elven Bow +25%, cap 25%)
export const toolBonus = (s, ac) =>
  Math.max(0, ...taskTools(s, ac).map(it => (ac.tool.kind === "ranged" ? Math.min(0.25, Math.max(0, (it.cp - 5) / 100)) : it.taskYield || 0)));
export function taskMult(s, ac) {
  let m = 1 + toolBonus(s, ac);
  for (const b of ac.boosts || []) if (srcOk(s, null, b, ac)) m += b.mult;
  for (const p of s.reqPerks || []) if (p.type === "bonus" && p.task === ac.id) m += p.mult;
  return m;
}
export const taskYields = (s, ac) => Object.fromEntries(Object.entries(ac.yields || {}).map(([k, v]) => [k, v * taskMult(s, ac)]));

// R31 refining task (Cook a Meal): uses up raw goods (first of `from` in stock) and yields the refined good
export const refineSrc = (s, ac) => ac.refine && ac.refine.from.find(k => (s.res[k] || 0) >= ac.refine.per * 0.5);
export function refineDay(s, ac, eff) {
  const k = refineSrc(s, ac);
  if (!k) return false;
  const n = Math.min(s.res[k], ac.refine.per * eff), f = n / ac.refine.per;
  if (k === "fish") spendFish(s, "fish", n); // R33: any-fish recipes use the cheapest fish first
  else s.res[k] -= n;
  for (const [o, v] of Object.entries(ac.refine.to)) s.res[o] = (s.res[o] || 0) + v * f * taskMult(s, ac);
  return true;
}

// the request an NPC currently has open (null while cooling down or finished with non-repeating list)
export function openRequest(s, npcId) {
  const n = npcDef(npcId);
  if (!n || !n.requests.length) return null;
  const x = st(s, npcId);
  if ((s.day || 0) < x.at) return null;
  return n.requests[x.i % n.requests.length];
}
// later cycles ask for a little more and pay a little more (+25% per full cycle, capped x2)
export const cycleMult = (s, npcId) => Math.min(2, 1 + 0.25 * Math.floor(st(s, npcId).i / npcDef(npcId).requests.length));
export function wantsOf(s, npcId) {
  const r = openRequest(s, npcId);
  if (!r) return null;
  const k = cycleMult(s, npcId);
  return Object.fromEntries(Object.entries(r.wants).map(([a, v]) => [a, Math.ceil(v * k)]));
}
export function deliverIssue(s, npcId) {
  const n = npcDef(npcId);
  if (!n) return "no such villager";
  if (n.town !== HOME && !(s.townsVisited || []).includes(n.town)) return "travel to " + n.town;
  const w = wantsOf(s, npcId);
  if (!w) return "no open request";
  const short = Object.entries(w).filter(([k, v]) => (s.res[k] || 0) < v);
  return short.length ? "need " + short.map(([k, v]) => `${v - Math.floor(s.res[k] || 0)} more ${k}`).join(", ") : null;
}
export const deliverable = s => RQ().npcs.filter(n => !deliverIssue(s, n.id)).length;

export function deliverRequest(s, npcId) {
  if (deliverIssue(s, npcId)) return null;
  const n = npcDef(npcId), r = openRequest(s, npcId), w = wantsOf(s, npcId), k = cycleMult(s, npcId), x = st(s, npcId);
  for (const [a, v] of Object.entries(w)) s.res[a] -= v;
  const rw = r.reward || {}, got = [];
  if (rw.coin) (s.res.coin += Math.round(rw.coin * k)), got.push(Math.round(rw.coin * k) + " coin");
  if (rw.food) (s.res.food += Math.round(rw.food * k)), got.push(Math.round(rw.food * k) + " food");
  for (const [a, v] of Object.entries(rw.res || {})) (s.res[a] = (s.res[a] || 0) + v), got.push(v + " " + a);
  if (rw.renown) (s.renown = (s.renown || 0) + rw.renown), got.push(rw.renown + " renown");
  for (const id of rw.items || []) if (addToVault(s, id)) got.push((D.items.find(i => i.id === id) || {}).name || id);
  x.fav = Math.min(100, x.fav + (RQ().favourPerDelivery || 10));
  x.n++;
  const e = r.extra;
  let extra = null;
  if (e && !(s.reqPerks || []).some(p => p.from === r.id)) {
    (s.reqPerks = s.reqPerks || []).push({ ...e, from: r.id, npc: n.id });
    if (e.type === "questline") {
      const q0 = D.quests.find(q => q.id === e.quests[0]);
      if (q0 && !s.revealed.includes(q0.id)) s.revealed.push(q0.id), revealAt(s, q0.id);
    }
    extra = e.text;
  }
  x.i++;
  const [a, b] = RQ().cooldown || [3, 7];
  x.at = (s.day || 0) + a + Math.floor(rng() * (b - a + 1));
  log(s, `📮 ${n.icon} ${n.name}: delivered ${Object.entries(w).map(([a, v]) => v + " " + a).join(", ")} → ${got.join(", ")}.${extra ? " ✨ " + extra : ""}`);
  return { got, extra };
}

// R31: permanent discount from request extras on a shop item in a town (0..0.5)
export const reqDiscount = (s, townId, it) =>
  Math.min(0.5, (s && s.reqPerks ? s.reqPerks : []).filter(p => p.type === "discount" && p.town === townId && (!p.mat || (it && it.mat === p.mat))).reduce((a, p) => a + p.pct, 0));

// quest-line stubs: finishing one reveals any quest whose `after` is it
export function questLineNext(s, q) {
  for (const n of D.quests.filter(x => x.after === q.id && x.hidden && !s.revealed.includes(x.id))) s.revealed.push(n.id), revealAt(s, n.id);
}

// R31: the lock reason shown on a task (age, tool, unlock, missing raw goods); "" when it can be done
export function taskLock(s, m, ac) {
  const a = (m.ageDays || 0) / (D.tuning.daysPerYear || 360);
  if (a < ac.minAge) return `age ${ac.minAge}+`;
  if (ac.maxAge && a > ac.maxAge) return "too old";
  const t = toolIssue(s, ac);
  if (t) return t;
  if (ac.unlock && !srcOkAny(s, m, ac)) return activityReqText(ac);
  if (ac.refine && !refineSrc(s, ac)) return "needs " + ac.refine.from.join(" or ");
  return "";
}
const srcOkAny = (s, m, ac) => [].concat(ac.unlock).some(u => srcOk(s, m, u, ac));
const activityReqText = ac => "needs " + [].concat(ac.unlock).map(u => srcText(u)).join(" or ");
