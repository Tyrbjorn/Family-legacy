import { famFx } from "./paths.js";
// R43 Work Orders: one estate-wide queue. Add an item with a count; workers plan the chain (gather → refine →
// craft) with the shared quota planner and work the orders top to bottom. Each order keeps one quota chain in
// s.quotas (tagged `order`), which never uses quota slots. Followers with the craft job take crafted orders
// first; family crafters help when no follower can. Every order shows one plain "why it's stuck" line.
// Queue size = Workshop → Order Queue (free 2). Pause when done: an order pauses after its next item is made.
import { D, log } from "./state.js";
import { itemDef, recipeDef, recipeIssue } from "./inventory.js";
import { legacyTier, legacyValue } from "./legacy.js";
import { producible, quotaBlock, quotaMet, removeQuota, pullInputs, quotaStock, quotaRecipeFor, bestCrafter, setOrdersDayHook } from "./quotas.js";
import { capOf } from "./fields.js";

export const OC = () => (D.legacy && D.legacy.orders) || { pullDepth: 3, pullAmountMin: 5 };
export const queueSize = s => (legacyValue(s, "orders") || 2) + Math.floor(famFx(s, "orderSlot")); // R46 Steward
const OS = s => (s.orders ||= { list: [], seq: 0 });
export const orderList = s => OS(s).list;
const isRes = item => !itemDef(item);
export const orderName = item => (itemDef(item) || {}).name || item;
const root = (s, o) => (s.quotas || []).find(q => q.order === o.id && !(s.quotas || []).some(p => p.id === q.parent));
const chain = (s, o) => (s.quotas || []).filter(q => q.order === o.id);

export function orderIssue(s, item, n) {
  if (!item) return "pick something";
  if (!(+n >= 1)) return "count must be 1+";
  if (!producible(item)) return "nothing can make that";
  return null;
}
export function addOrder(s, item, n, opt = {}) {
  if (orderIssue(s, item, n)) return null;
  const o = { id: "o" + ++OS(s).seq, item, target: Math.floor(+n), made: 0, paused: false, pwd: null };
  if (opt.auto) o.auto = opt.auto; // R44 Auto-craft: why it was placed; uses Auto-craft slots, not the Order Queue
  OS(s).list.push(o);
  log(s, o.auto ? `🤖 Auto-craft: ${o.target} × ${orderName(item)} (${o.auto}).` : `📋 Order placed: ${o.target} × ${orderName(item)}.`);
  return o;
}
const dropChain = (s, o) => { const r = root(s, o); if (r) { o.made += r.made || 0; removeQuota(s, r.id); } for (const q of chain(s, o)) removeQuota(s, q.id); clearCrafters(s, o); };
export function removeOrder(s, id) {
  const o = OS(s).list.find(x => x.id === id);
  if (!o) return false;
  dropChain(s, o);
  if (o.auto && !orderDone(s, o)) (s.acSkip ||= {})[o.item] = (s.day || 0) + (OC().autoSkipDays || 30); // a cancelled auto order is not re-placed for a while
  OS(s).list = OS(s).list.filter(x => x.id !== id);
  return true;
}
export function moveOrder(s, id, dir) {
  const L = OS(s).list, i = L.findIndex(o => o.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= L.length) return false;
  [L[i], L[j]] = [L[j], L[i]];
  return true;
}
export function toggleOrderPause(s, id) { const o = OS(s).list.find(x => x.id === id); if (!o) return false; o.paused = !o.paused; o.pwd = null; return true; }
export function setOrderPauseWhenDone(s, id, on = true) { const o = OS(s).list.find(x => x.id === id); if (!o) return false; o.pwd = on ? { mark: orderMade(s, o) } : null; return true; }
export const orderMade = (s, o) => Math.min(o.target, o.made + ((root(s, o) || {}).made || 0));
export const orderDone = (s, o) => orderMade(s, o) >= o.target;
// the orders that work right now: the first `queueSize` that are not paused or done
// R44: auto-craft orders run in their own slots (Workshop → Auto-craft), so they never crowd out your orders
export const autoSlots = s => { const m = ((D.legacy || {}).autoCraft || {}).maxOpen || [0, 2, 3, 4]; return m[legacyTier(s, "autocraft")] || 0; };
export const activeOrders = s => {
  const L = OS(s).list.filter(o => !o.paused && !orderDone(s, o));
  const a = new Set([...L.filter(o => !o.auto).slice(0, queueSize(s)), ...L.filter(o => o.auto).slice(0, autoSlots(s))]);
  return L.filter(o => a.has(o));
};

function clearCrafters(s, o) { for (const mi of s.minions || []) if (mi.orderFor === o.id) { mi.orderFor = null; mi.craftOrder = null; } }
// followers with the craft job first; family crafters only when no follower can make it
function assignCrafters(s, o, q) {
  const rc = !isRes(o.item) && quotaRecipeFor(o.item);
  if (!rc) return;
  const can = (s.minions || []).filter(mi => mi.job === "craft" && !mi.unhoused && !mi.paused && (!mi.orderFor || mi.orderFor === o.id));
  const ok = can.filter(mi => !recipeIssue(s, null, rc) || recipeIssue(s, null, rc) === "missing materials");
  if (ok.length) { for (const mi of ok.slice(0, 1)) { mi.orderFor = o.id; mi.craftOrder = rc.id; } q.queued = true; } // family queueing skipped while a follower works it
}

export function ordersDay(s) {
  const L = OS(s).list;
  if (!L.length) return;
  const act = new Set(activeOrders(s).map(o => o.id));
  for (const o of L) {
    const r0 = root(s, o);
    if (r0 && !isRes(o.item)) r0.made = Math.max(r0.made, quotaStock(s, o.item) - (r0.from || 0));
    if (o.pwd && orderMade(s, o) > o.pwd.mark) { o.paused = true; o.pwd = null; log(s, `⏸️ Order paused when done: ${orderName(o.item)} (${orderMade(s, o)}/${o.target}).`); }
    if (orderDone(s, o) && !o.doneDay) { o.doneDay = s.day || 0; dropChain(s, o); o.made = o.target; log(s, `✅ Order done: ${o.target} × ${orderName(o.item)}.`); continue; }
    if (!act.has(o.id) || o.paused) { if (chain(s, o).length) dropChain(s, o); continue; }
    let r = root(s, o);
    if (!r) {
      r = { id: "q" + (s.quotaSeq = (s.quotaSeq || 0) + 1), item: o.item, target: o.target - o.made, mode: "once", made: 0, from: quotaStock(s, o.item), parent: "order:" + o.id, order: o.id, depth: 0 };
      (s.quotas ||= []).push(r);
    }
    assignCrafters(s, o, r);
    for (const q of [...chain(s, o)]) pullInputs(s, q, OC().pullDepth, Math.max(OC().pullAmountMin || 5, Math.ceil((recipeNeed(q) || 0))));
  }
  // finished orders leave the list after a few days
  OS(s).list = L.filter(o => !(o.doneDay != null && (s.day || 0) - o.doneDay > 3));
}
const recipeNeed = q => { const rc = quotaRecipeFor(q.item); return rc ? Object.values(rc.mats || {}).reduce((a, b) => Math.max(a, b), 0) * (q.target - q.made) : 0; };

// one plain line per order
export function orderStatus(s, o) {
  if (orderDone(s, o)) return { k: "done", text: "done" };
  if (o.paused) return { k: "paused", text: "paused" };
  if (!activeOrders(s).includes(o)) return { k: "wait", text: o.auto ? `waiting for an Auto-craft slot (${autoSlots(s)} at a time)` : `waiting for a queue slot (${queueSize(s)} at a time)` };
  if (isRes(o.item) && (s.res[o.item] || 0) >= capOf(s, o.item)) return { k: "blocked", text: `storage full: ${o.item}` };
  const rc = !isRes(o.item) && quotaRecipeFor(o.item);
  if (rc) {
    const m = bestCrafter(s, rc), fol = (s.minions || []).some(mi => mi.orderFor === o.id);
    const iss = recipeIssue(s, fol ? null : m, rc);
    if (!fol && !m) return { k: "blocked", text: "no crafter (a follower on the craft job, or an adult in the family)" };
    if (iss && iss !== "missing materials") return { k: "blocked", text: /^[A-Z][a-z]+ \d+$/.test(iss) ? `no one has ${iss}` : iss };
  }
  for (const q of chain(s, o).slice().reverse()) {
    if (quotaMet(s, q)) continue;
    const b = quotaBlock(s, q);
    if (b && !b.input) return { k: "blocked", text: b.why };
  }
  const r = root(s, o), b = r && quotaBlock(s, r);
  if (b) { const kid = chain(s, o).find(q => q.item === b.input); return { k: "on", text: kid ? `${b.why}: gathering/refining it now` : b.why }; }
  return { k: "on", text: "working on it" };
}
setOrdersDayHook(ordersDay);

// save step 40: old per-person craft queues become orders (consecutive repeats grouped)
export function migrateOrders(s) {
  for (const m of s.members || []) {
    const Q = m.craftQueue || [];
    let last = null;
    for (const id of Q) {
      const rc = recipeDef(id);
      if (!rc) continue;
      const item = rc.base || rc.id;
      if (last && last.item === item) last.target++;
      else { last = { id: "o" + ++OS(s).seq, item, target: 1, made: 0, paused: false, pwd: null }; OS(s).list.push(last); }
    }
    m.craftQueue = [];
  }
}
