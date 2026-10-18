import { allRequests } from "./requests.js";
// R33 dishes (data/cooking.json): merged at load into station process rows, the menu, food values and town prices.
// Fish inputs: `fish:<species>` spends that species from the R32 fish record; plain `fish` spends the cheapest fish first.
// Auto Cook (station rows each day): dishes an open villager request wants first, then dishes that add a new food
// to the menu, then the rest by food value. 10 raw fish are always kept for requests; luxury dishes need s.cookLuxury.
import { quotaRank } from "./quotas.js";
import { D, log } from "./state.js";
import { fishBagFix, fishDef, famFishLvl } from "./fish.js";
import { openRequest } from "./requests.js";
import { locDef, locKnown } from "./world.js";

export const CK = () => D.cooking || { dishes: [], rawFishKeep: 10 };
export const dishDef = id => CK().dishes.find(d => d.id === id);
export function applyCooking(d) {
  if (!d.cooking || !d.estate || d.cooking._merged === d.estate) return;
  d.cooking._merged = d.estate;
  const E = d.estate, pieces = Object.fromEntries((E.pieces || []).map(p => [p.id, p]));
  for (const x of d.cooking.dishes) {
    for (const [pid, rate] of Object.entries(x.stations || {})) {
      const p = pieces[pid];
      if (!p) continue;
      p.bonus = p.bonus || {};
      p.bonus.processes = (p.bonus.processes || []).filter(r => r.dish !== x.id);
      p.bonus.processes.push({ in: x.in, out: x.id, rate, food: true, dish: x.id, per: x.per || 1, side: x.side });
    }
    (E.foodValue = E.foodValue || {})[x.id] = x.food;
    if (E.meals) E.meals.menu[x.id] = x.food;
  }
  for (const x of [...d.cooking.dishes, ...(d.cooking.extras || [])]) for (const t of d.towns || []) if (t.prices && !t.prices[x.id]) t.prices[x.id] = x.value;
}

export const famCookLvl = s => Math.max(0, ...(s.members || []).filter(m => m.alive !== false).map(m => ((m.skills || {}).cooking || {}).lvl || 0));
export const knowsDish = (s, id) => (s.dishes || []).includes(id);
export function dishIssue(s, x) {
  if (!knowsDish(s, x.id)) return "not learned";
  if (famCookLvl(s) < (x.cook || 0)) return "Cooking " + x.cook;
  if (x.luxury && !s.cookLuxury) return "luxury fish off";
  if (x.keep && (s.res[x.id] || 0) >= x.keep) return "enough in store";
  return null;
}
// ---- fish spending
const plainFish = s => Math.max(0, (s.res.fish || 0) - Object.values(fishBagFix(s)).reduce((a, v) => a + v, 0));
export const fishKeep = s => CK().rawFishKeep ?? 10;
// how much of an input key may be spent (fish keeps rawFishKeep in store for requests)
export function fishAvail(s, k) {
  const free = Math.max(0, (s.res.fish || 0) - fishKeep(s));
  if (k === "fish") return free;
  const sp = k.slice(5);
  return Math.min(free, sp === "fish" ? plainFish(s) : fishBagFix(s)[sp] || 0);
}
export function spendFish(s, k, n) {
  const b = fishBagFix(s);
  if (k !== "fish") {
    const sp = k.slice(5);
    if (sp !== "fish") b[sp] = Math.max(0, (b[sp] || 0) - n);
  } else {
    // any fish: Creek Fish first, then the cheapest species
    let left = n - Math.min(n, plainFish(s));
    for (const [id] of Object.entries(b).sort((x, y) => (fishDef(x[0])?.value || 0) - (fishDef(y[0])?.value || 0))) {
      if (left <= 0) break;
      const u = Math.min(left, b[id]);
      b[id] -= u;
      left -= u;
    }
  }
  s.res.fish = Math.max(0, (s.res.fish || 0) - n);
}
export const isFishKey = k => k === "fish" || k.startsWith("fish:");

// ---- Auto Cook order for one piece's rows (non-dish rows keep their place between wanted/variety dishes and the rest)
const wantedRes = s => new Set(((D.requests || {}).npcs || []).flatMap(n => Object.keys((openRequest(s, n.id) || {}).wants || {})));
export function cookOrder(s, rows) {
  if (s.quotas && s.quotas.length && rows.some(r => quotaRank(s, r.out) < Infinity)) {
    // R34: rows making an open quota's item go first, in quota order
    const rest = cookOrder({ ...s, quotas: [] }, rows.filter(r => quotaRank(s, r.out) === Infinity));
    return [...rows.filter(r => quotaRank(s, r.out) < Infinity).sort((a, b) => quotaRank(s, a.out) - quotaRank(s, b.out)), ...rest];
  }
  if (!rows.some(r => r.dish)) return rows;
  const want = wantedRes(s), menu = new Set((s.meal || {}).menu || []);
  const tier = r => (!r.dish ? 2 : want.has(r.out) ? 0 : !menu.has(r.out) && (s.res[r.out] || 0) < 1 ? 1 : 3);
  return rows.map((r, i) => [r, i]).sort((a, b) => tier(a[0]) - tier(b[0]) || (a[0].dish && b[0].dish ? (dishDef(b[0].dish)?.food || 0) - (dishDef(a[0].dish)?.food || 0) : a[1] - b[1])).map(x => x[0]);
}

// ---- learning
function learnOk(s, l) {
  if (!l) return false;
  if (l.start) return true;
  if (l.request) {
    // delivered: that NPC's request pointer has moved past it
    const n = ((D.requests || {}).npcs || []).find(x => allRequests(x).some(r => r.id === l.request));
    return !!n && ((s.req || {})[n.id] || {}).i > n.requests.findIndex(r => r.id === l.request);
  }
  if (l.quest) return (s.doneQuests || []).includes(l.quest);
  if (l.location) {
    const ld = D.world && locDef(l.location);
    return !!ld && locKnown(s, ld);
  }
  if (l.caught) return ((s.fishEver || {})[l.caught] || 0) >= 1 || (fishBagFix(s)[l.caught] || 0) >= 1;
  if (l.anyOf) return l.anyOf.some(x => learnOk(s, x));
  if (l.built) return (s.structures || []).some(st => st.type === l.built);
  if (l.piece) return (s.structures || []).some(st => (st.pieces || []).includes(l.piece));
  if (l.married) return (s.members || []).some(m => m.spouse);
  if (l.have) return Object.entries(l.have).every(([k, n]) => (s.res[k] || 0) >= n);
  if (l.made) return Object.entries(l.made).every(([k, n]) => ((s.cooked || {})[k] || 0) >= n);
  return false;
}
export function learnDishes(s, quiet) {
  s.dishes = s.dishes || [];
  for (const x of CK().dishes)
    if (!s.dishes.includes(x.id) && learnOk(s, x.learn)) {
      s.dishes.push(x.id);
      if (!quiet && !x.learn.start) log(s, `📖 New recipe: ${x.icon} ${x.name}! ${x.how || ""} (${Object.entries(x.in).map(([k, v]) => v + " " + (k.startsWith("fish:") ? fishDef(k.slice(5))?.name || k : k)).join(", ")})`);
    }
}
// ---- buffs: contentment from dishes eaten today (+ an active feast)
export function dishMorale(s, menu) {
  let m = 0;
  for (const k of menu || []) {
    const x = dishDef(k);
    if (!x || !x.buff) continue;
    m += x.buff.menuMorale || 0;
    if (x.buff.celebrate && s.celebrate != null && (s.day || 0) - s.celebrate < (x.buff.days || 3)) m += x.buff.celebrate;
    if (x.buff.feastMorale) s.feast = { until: (s.day || 0) + (x.buff.feastDays || 3), v: x.buff.feastMorale };
  }
  if (s.feast && s.feast.until > (s.day || 0)) m += s.feast.v;
  return m;
}
export const setCookLuxury = (s, on) => (s.cookLuxury = !!on);
// list for the Food card: every dish with its state
export const dishList = s => CK().dishes.map(x => ({ x, known: knowsDish(s, x.id), issue: dishIssue(s, x), have: s.res[x.id] || 0 }));

// Auto Cook reserve: a dish never uses the last `reserve` of a (non-fish) ingredient another learned dish also needs
export function dishReserve(s, dishId, k) {
  const R = CK().reserve || 0;
  if (!R || !dishId) return 0;
  return CK().dishes.some(x => x.id !== dishId && knowsDish(s, x.id) && k in x.in) ? R : 0;
}
