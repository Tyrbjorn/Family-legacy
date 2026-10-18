import { findId } from "./lookup.js";
// R45 Town quest boards, multi-stop quest lines and phase bands (data/boards.json).
// Boards: each discovered town shows `show` jobs, a new set every `rotateDays` days: `fromBand` from your band
// (phase: Beginning / Established / Dynasty) and the rest one band up (a stretch). Coin rewards × band mult.
// A job or a line stop is a normal trip (action type "bjob": home → place → home). Deliver jobs take the goods
// along (missing goods can be ordered through the Work Orders planner). Quest lines are 2–4 stops in a row with
// a reward per stop and a bigger one at the end; Auto-Adventure follows a line its person has started.
import { D, T, afford, isAdult, log, pay, rng } from "./state.js";
import { gainXp } from "./skills.js";
import { era, cp } from "./family.js";
import { isBusy, newTrip, townKnown, travelDays } from "./map.js";
import { opensOk, opensText } from "./chores.js";
import { addRenown } from "./legacy.js";
import { addOrder, orderList, orderDone, queueSize } from "./orders.js";
import { producible } from "./quotas.js";
import { registerDayHook } from "./time.js";

export const BD = () => D.boards || { pools: {}, lines: [], bands: [{ n: 1, mult: 1 }], rotateDays: 7, show: 3, fromBand: 2 };
export const bands = () => BD().bands;
export const bandOf = s => Math.min(bands().length, Math.max(1, era(s).n)); // R45: phase → band (phase 4 counts as Dynasty)
export const bandDef = n => bands().find(b => b.n === n) || bands()[0];
export const bandMult = n => bandDef(n).mult || 1;
const townDef = id => (D.towns || []).find(t => t.id === id);
export const boardPlace = id => (id === "home" ? "Home (the Dock)" : (townDef(id) || {}).name || (findId(D.quests, id) || {}).name || id);
const B = s => (s.boards ||= { towns: {}, seq: 0 });
export const townFavour = (s, id) => ((s.townFav || {})[id] || 0);
const addFav = (s, id, n) => { (s.townFav ||= {})[id] = Math.min(100, townFavour(s, id) + n); };
export const boardTowns = s => (D.towns || []).filter(t => BD().pools[t.id] && townKnown(s, t));

// ---- boards
function pick(pool, n, k, rnd) {
  const out = [], P = [...pool];
  while (out.length < k && P.length) out.push(P.splice(Math.floor(rnd() * P.length), 1)[0]);
  return out;
}
export function rollBoard(s, tid, rnd = rng) {
  const pool = BD().pools[tid] || [], b = bandOf(s), up = Math.min(bands().length, b + 1);
  const inBand = n => { for (let x = n; x >= 1; x--) { const p = pool.filter(j => j.band === x); if (p.length) return p; } return pool; };
  const kept = ((B(s).towns[tid] || {}).jobs || []).filter(j => j.taken); // jobs under way stay until finished
  const mine = pick(inBand(b), b, BD().fromBand, rnd), used = new Set([...kept, ...mine].map(j => j.id));
  let stretch = pick(inBand(up).filter(j => !used.has(j.id)), up, BD().show - BD().fromBand, rnd);
  if (!stretch.length) stretch = pick(pool.filter(j => !used.has(j.id)), up, BD().show - BD().fromBand, rnd);
  const fresh = [...mine, ...stretch].filter(j => !kept.some(k => k.id === j.id)).map(j => ({ ...j, uid: "j" + ++B(s).seq, coin: Math.round(j.coin * bandMult(j.band)), stretch: j.band > b }));
  B(s).towns[tid] = { jobs: [...kept, ...fresh].slice(0, Math.max(BD().show, kept.length)), next: (s.day || 0) + BD().rotateDays };
  return B(s).towns[tid];
}
export function boardOf(s, tid) {
  const t = B(s).towns[tid];
  return t ? t.jobs : [];
}
export const boardNext = (s, tid) => (B(s).towns[tid] || {}).next || 0;
export function boardsDay(s, rnd = rng) {
  for (const t of boardTowns(s)) { const x = B(s).towns[t.id]; if (!x || (s.day || 0) >= x.next) rollBoard(s, t.id, rnd); }
}
const findJob = (s, uid) => { for (const [tid, x] of Object.entries(B(s).towns)) { const j = x.jobs.find(j => j.uid === uid); if (j) return [tid, j]; } return [null, null]; };
export const jobDest = (tid, j) => (j.kind === "escort" ? j.to : tid);
export function jobIssue(s, m, uid) {
  const [tid, j] = findJob(s, uid);
  if (!j) return "job gone";
  if (j.taken) return "already taken";
  if (!m || !m.alive || !isAdult(m)) return "needs an adult";
  if (isBusy(m) || (m.action && m.action.type === "bjob")) return `${m.name} is away`;
  if (j.kind === "clear" && cp(s, m) < j.cp) return `needs CP ${j.cp}`;
  if (j.kind === "escort" && !townKnown(s, townDef(j.to) || {})) return `find ${boardPlace(j.to)} first`;
  if (j.kind === "deliver" && (s.res[j.res] || 0) < j.n) return `needs ${j.n} ${j.res} (have ${Math.floor(s.res[j.res] || 0)})`;
  return null;
}
export function takeJob(s, m, uid) {
  if (jobIssue(s, m, uid)) return false;
  const [tid, j] = findJob(s, uid);
  if (j.kind === "deliver") pay(s, { [j.res]: j.n }); // the goods travel with them
  j.taken = m.id;
  m.standing = m.standing || null;
  m.action = { type: "bjob", target: jobDest(tid, j), job: uid, days: j.days, progress: 0 };
  m.action.trip = newTrip(m.action, s);
  log(s, `📋 ${m.name} took a board job: ${j.name}.`);
  return true;
}
// Work Orders planner for deliver jobs: order what's missing
export function orderForJob(s, uid, auto = false) {
  const [, j] = findJob(s, uid);
  if (!j || j.kind !== "deliver" || !producible(j.res)) return null;
  if (auto && orderList(s).filter(o => !o.auto && !orderDone(s, o)).length >= queueSize(s)) return null; // auto never crowds your Work Orders queue
  const short = Math.ceil(j.n - (s.res[j.res] || 0));
  if (short <= 0 || orderList(s).some(o => o.item === j.res && !orderDone(s, o))) return null;
  j.ordered = true;
  return addOrder(s, j.res, short);
}
// same for a quest line's next delivery stop
export function orderForStop(s, id) {
  const L = lineDef(id), st = lineState(s, id), stop = L && L.stops[st ? st.stop : 0];
  if (!stop || !stop.deliver || (st && st.done)) return [];
  const out = [];
  for (const [k, v] of Object.entries(stop.deliver)) {
    const short = Math.ceil(v - (s.res[k] || 0));
    if (short > 0 && producible(k) && !orderList(s).some(o => o.item === k && !orderDone(s, o))) { const o = addOrder(s, k, short); if (o) out.push(o); }
  }
  return out;
}
function finishJob(s, m, uid, a) {
  const [tid, j] = findJob(s, uid);
  if (!j) return;
  const days = a && a.trip ? a.trip.out + a.trip.task + a.trip.back : 0;
  s.res.coin += j.coin;
  addFav(s, tid, j.favour || 0);
  addRenown(s, m, j.band || 1);
  const sk = j.kind === "clear" ? ["brawling", "swordsmanship", "archery", "fire", "frost"].filter(k => m.skills[k]).sort((a, b) => m.skills[b].lvl - m.skills[a].lvl)[0] : "haggling";
  if (sk && m.skills[sk]) gainXp(s, m, sk, T.xpPerDay * 2);
  (s.boardStats ||= { done: 0, coin: 0, byBand: {} }).done++;
  s.boardStats.coin += j.coin;
  s.boardStats.byBand[j.band] = (s.boardStats.byBand[j.band] || 0) + j.coin;
  (s.boardStats.daysByBand ||= {})[j.band] = Math.round(((s.boardStats.daysByBand[j.band] || 0) + days) * 10) / 10;
  B(s).towns[tid].jobs = B(s).towns[tid].jobs.filter(x => x !== j);
  log(s, `✅ ${m.name} finished "${j.name}": +${j.coin} coin, +${j.favour || 0} favour with ${boardPlace(tid)}.`);
}

// ---- quest lines
export const lineDefs = () => BD().lines || [];
export const lineDef = id => lineDefs().find(l => l.id === id);
const LS = s => (s.lines ||= {});
export const lineState = (s, id) => LS(s)[id] || null;
export function lineIssue(s, L) {
  if (!opensOk(s, L.opens)) return "opens: " + opensText(L.opens);
  const miss = L.stops.map(x => x.at).find(a => townDef(a) && !townKnown(s, townDef(a)));
  if (miss) return `find ${boardPlace(miss)} first`;
  return null;
}
export const lineOpen = (s, L) => !lineIssue(s, L);
export function stopIssue(s, m, id) {
  const L = lineDef(id), st = lineState(s, id);
  if (!L) return "unknown line";
  if (st && st.done) return "finished";
  const iss = lineIssue(s, L);
  if (iss) return iss;
  if (st && st.who != null && st.who !== m.id && (s.members || []).some(x => x.id === st.who && x.alive)) return "another member is on it";
  if (!m || !m.alive || !isAdult(m)) return "needs an adult";
  if (isBusy(m) || (m.action && m.action.type === "bjob")) return `${m.name} is away`;
  const stop = L.stops[st ? st.stop : 0];
  if (stop.cp && cp(s, m) < stop.cp) return `needs CP ${stop.cp}`;
  if (stop.deliver && !afford(s, stop.deliver)) return "needs " + Object.entries(stop.deliver).map(([k, v]) => `${v} ${k}`).join(", ");
  return null;
}
export function goStop(s, m, id) {
  if (stopIssue(s, m, id)) return false;
  const L = lineDef(id), st = (LS(s)[id] ||= { stop: 0, who: m.id, started: s.day || 0 });
  st.who = m.id;
  const stop = L.stops[st.stop];
  if (stop.deliver) pay(s, stop.deliver);
  m.action = { type: "bjob", target: stop.at, line: id, stop: st.stop, days: stop.days, progress: 0 };
  m.action.trip = newTrip(m.action, s);
  log(s, `${L.icon} ${m.name} set out: ${L.name}, stop ${st.stop + 1}/${L.stops.length} (${stop.name}).`);
  return true;
}
function finishStop(s, m, id, i) {
  const L = lineDef(id), st = lineState(s, id);
  if (!L || !st || st.stop !== i) return;
  const mult = bandMult(L.band), stop = L.stops[i], gain = [];
  const give = (r, mm) => { for (const [k, v] of Object.entries(r || {})) { if (k === "renown") { addRenown(s, m, v); gain.push(`+${v} renown`); } else { const n = Math.round(v * (k === "coin" ? mm : 1)); s.res[k] = (s.res[k] || 0) + n; gain.push(`+${n} ${k}`); } } };
  give(stop.reward, mult);
  st.stop++;
  if (st.stop >= L.stops.length) {
    st.done = true;
    st.doneDay = s.day || 0;
    give(L.reward, mult);
    for (const [t, f] of Object.entries(L.favour || {})) addFav(s, t, f);
    log(s, `🏁 ${m.name} completed ${L.name}: ${gain.join(", ")}.`);
  } else log(s, `${L.icon} ${L.name}: stop ${i + 1} done (${gain.join(", ")}). Next: ${L.stops[st.stop].name} at ${boardPlace(L.stops[st.stop].at)}.`);
}
// map route: home → each stop
export const lineRoute = id => ["home", ...(lineDef(id) || { stops: [] }).stops.map(x => x.at)];

// ---- trip hooks (map.js travelTick)
export const bjobOk = (s, a) => (a.line ? !!lineDef(a.line) : !!findJob(s, a.job)[1]);
export const bjobDays = a => a.days || 1;
export function bjobResolve(s, m, a) {
  if (a.line) finishStop(s, m, a.line, a.stop);
  else finishJob(s, m, a.job, a);
}

// ---- Auto-Adventure: follow a started line, else a board job from your band (deliver jobs ask the planner for missing goods)
export function boardsPick(s, m, bar = 0) {
  for (const L of lineDefs()) {
    const st = lineState(s, L.id);
    if (!st || st.done || st.who !== m.id) continue;
    const stop = L.stops[st.stop];
    if (stop.deliver && !afford(s, stop.deliver)) { orderForStop(s, L.id); continue; }
    if (goStop(s, m, L.id)) return m.action;
  }
  const b = bandOf(s);
  const cand = boardTowns(s).flatMap(t => boardOf(s, t.id).map(j => [t.id, j])).filter(([, j]) => j.band === b && !j.taken);
  for (const [, j] of cand) if (j.kind === "deliver" && !j.ordered && (s.res[j.res] || 0) < j.n) orderForJob(s, j.uid, true);
  if (bar === Infinity) return null; // lines only
  const need = bar * (BD().autoBar || 1);
  const ok = cand.filter(([, j]) => !jobIssue(s, m, j.uid)).map(([t, j]) => [j, jobRate(s, t, j)]).filter(([, r]) => r >= need).sort((x, y) => y[1] - x[1])[0];
  if (ok && takeJob(s, m, ok[0].uid)) return m.action;
  return null;
}
// coin per trip-day of a job (deliver jobs count the goods at their Millbrook price)
export function jobRate(s, tid, j) {
  const out = travelDays(jobDest(tid, j)), d = out * 2 + j.days;
  const goods = j.kind === "deliver" ? j.n * (((townDef("millbrook") || {}).prices || {})[j.res] || 1) : 0;
  return (j.coin - goods) / Math.max(1, d);
}

registerDayHook("boards", s => boardsDay(s));
