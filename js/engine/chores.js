// R42 chores phase 2 (part 1): chore tiers that open as the estate and your village grow.
// Chores are ordinary basic tasks in activities.json carrying `chore: { tier, opens, fx }`; every entry in
// `opens` must hold (stage / structure / village). The free basic auto runs each open chore at
// estate.chores.autoRate when nobody works it by hand. Each chore is a plain {inputs → outputs} recipe
// (choreRecipe), so the upcoming full-auto planner can treat chores like any other producer.
import { D, living, log } from "./state.js";
import { estateStage } from "./estate.js";
import { taskYields, refineDay, refineSrc } from "./requests.js";
import { quotaCredit } from "./quotas.js";
import { registerDayHook } from "./time.js";

export const CH = () => (D.estate && D.estate.chores) || { autoRate: 0.35, fxDays: 1, tiers: {} };
export const chores = () => (D.activities || []).filter(a => a.chore);
export const choreDef = id => chores().find(a => a.id === id);
const stageIdx = name => ((D.estate && D.estate.stages) || []).findIndex(([, n]) => n === name);
// shared growth check (chores, villager sets, village villagers): all keys must hold
export function opensOk(s, o) {
  if (!o) return true;
  if (o.stage && stageIdx(estateStage(s)) < stageIdx(o.stage)) return false;
  if (o.structure && !(s.structures || []).some(st => st.type === o.structure && !st.unpaid)) return false;
  if (o.village && !s.village) return false;
  return true;
}
export function opensText(o) {
  if (!o) return "";
  const p = [];
  if (o.stage) p.push(`estate reaches ${o.stage}`);
  if (o.structure) p.push(`a ${((D.estate.structures || []).find(x => x.id === o.structure) || {}).name || o.structure}`);
  if (o.village) p.push("your own village");
  return p.join(" + ");
}
export const choreOpen = (s, ac) => !!(ac && ac.chore) && opensOk(s, ac.chore.opens);
export const openChores = s => chores().filter(a => choreOpen(s, a));
// planner-friendly view: what a chore eats and makes per worker-day
export const choreRecipe = ac => ({
  id: ac.id,
  in: ac.refine ? { [ac.refine.from[0]]: ac.refine.per } : {},
  out: ac.refine ? { ...ac.refine.to } : { ...(ac.yields || {}) },
  fx: ac.chore.fx || null,
  skill: (ac.skills || [])[0],
});
const cs = s => (s.chores ||= { seen: null, news: [], off: [], fx: {} });
// a chore's day effect is on while it was worked (by hand or auto) today/yesterday
export const choreActive = (s, id) => (cs(s).fx[id] ?? -99) >= (s.day || 0) - (CH().fxDays ?? 1);
export const markChore = (s, ac) => ac && ac.chore && (cs(s).fx[ac.id] = s.day || 0);
export const choreFx = (s, key) => openChores(s).reduce((a, ac) => a + (ac.chore.fx && typeof ac.chore.fx[key] === "number" && choreActive(s, ac.id) ? ac.chore.fx[key] : 0), 0);
export const chorePaused = (s, id) => cs(s).off.includes(id);
export function toggleChore(s, id) {
  const c = cs(s), i = c.off.indexOf(id);
  i >= 0 ? c.off.splice(i, 1) : c.off.push(id);
  return i < 0;
}
const byHand = (s, id) => living(s).some(m => m.action && m.action.type === "activity" && m.action.target === id);
const anyoneCan = (s, ac) => living(s).some(m => (m.ageDays || 0) / (D.tuning.daysPerYear || 360) >= (ac.minAge || 0));

// day hook: popups for newly opened chores + free basic auto
export function choresDay(s) {
  if (!chores().length) return;
  const c = cs(s), open = openChores(s);
  if (c.seen == null) c.seen = open.map(a => a.id); // first run on an older save: no popup flood
  for (const ac of open)
    if (!c.seen.includes(ac.id)) {
      c.seen.push(ac.id);
      c.news.push(ac.id);
      log(s, `🆕 New chore: ${ac.icon} ${ac.name} (${opensText(ac.chore.opens)}).`);
    }
  const r = CH().autoRate || 0;
  if (!r) return;
  for (const ac of open) {
    if (chorePaused(s, ac.id) || !anyoneCan(s, ac)) continue;
    if (byHand(s, ac.id)) { markChore(s, ac); continue; }
    if (ac.refine) { if (!refineSrc(s, ac) || !refineDay(s, ac, r)) continue; }
    else for (const [k, v] of Object.entries(taskYields(s, ac))) { s.res[k] = (s.res[k] || 0) + v * r; quotaCredit(s, k, v * r); }
    markChore(s, ac);
  }
}
// R43 Auto rotation: workers' spare hours go to each open chore in turn (skipping paused, no input, full storage)
export function rotationChores(s, W, last, cap, R) {
  last.chores = {};
  const per = R.choreHours || 2, rate = R.choreHourRate || 0.125; // 8 h = one full hand-worked day
  for (const ac of openChores(s)) {
    const r = choreRecipe(ac);
    let why = chorePaused(s, ac.id) ? "paused" : Object.keys(r.out).length && Object.keys(r.out).every(k => (s.res[k] || 0) >= cap(k)) ? "full" : ac.refine && !refineSrc(s, ac) ? "no input" : null;
    if (why) { last.chores[ac.id] = why; continue; }
    let got = 0;
    for (const w of W) { if (got >= per - 1e-9) break; const t = Math.min(w.left, per - got); w.left -= t; got += t; last.used += t; }
    if (got <= 1e-9) { last.chores[ac.id] = "no hands"; continue; }
    const k = got * rate;
    if (ac.refine) refineDay(s, ac, k);
    else for (const [res, v] of Object.entries(taskYields(s, ac))) { s.res[res] = Math.min(cap(res), (s.res[res] || 0) + v * k); quotaCredit(s, res, v * k); }
    markChore(s, ac);
    last.chores[ac.id] = "worked";
  }
}
export const takeChoreNews = s => { const c = cs(s), n = c.news.slice(); c.news = []; return n; };
registerDayHook("chores", choresDay);
