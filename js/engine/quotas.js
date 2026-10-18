// R34 Quotas (Legacy "Steward's Ledger"): estate-wide production targets. A quota is {id,item,target,mode}:
// "once" = make `target` more then finish; "standing" = keep stock topped up to `target`.
// Tier 1: 5 quotas. Tier 2: unlimited, blocked quotas pull their missing input (child quotas, 2 steps deep),
// standing targets are sell floors for routes/shopfronts, and 1 follower a month moves into a job that feeds a quota.
// Automation follows quotas first (stations incl. Auto Cook, Auto Tend, the craft queue); list order = priority;
// reserves are never broken; food rows never idle while food stock is under the safety days.
import { D, log } from "./state.js";
import { itemDef, recipeDef } from "./inventory.js";
import { hasLegacy, legacyTier, legacyValue } from "./legacy.js";
import { scaledPiece } from "./estate-pieces.js";
import { reserveOf } from "./production.js";
import { daysOfStock } from "./food.js";
import { dishDef, dishIssue, isFishKey, fishAvail } from "./cooking.js";
import { jobCap } from "./estate.js";

export const QC = () => (D.legacy && D.legacy.quotas) || { pullDepth: 2, foodSafetyDays: 20, pullAmount: 20 };
export const quotaTier = s => legacyTier(s, "quotas");
export const quotaSlots = s => legacyValue(s, "quotas"); // R37: 2 free, 5, unlimited
const Qs = s => (s.quotas = s.quotas || []);
export const quotaList = s => Qs(s);
const isRes = item => !itemDef(item);
const stock = (s, item) => (isRes(item) ? s.res[item] || 0 : (s.vault || []).filter(x => x === item || String(x).split("|")[1] === item).length);
// ---- what makes an item (station rows on owned buildings, task yields, nodes, recipes, minion jobs)
const JOB_RES = { farm: ["food"], gather: ["wood", "stone"], mine: ["ore", "copperore", "stone"], hunt: ["meat", "hides"], fish: ["fish"], herbs: ["thyme", "sage"] };
export function stationRows(s, item) {
  const out = [];
  for (const st of s.structures || [])
    for (const pid of st.pieces || []) {
      const p = scaledPiece(st, pid);
      for (const pr of (p && p.bonus && p.bonus.processes) || []) if (pr.out === item) out.push({ st, pid, pr });
    }
  return out;
}
const pieceRows = p => [...((p.bonus || {}).processes || []), ...[].concat((p.bonus || {}).process || [])];
const pieceMakes = item => (D.estate.pieces || []).filter(p => pieceRows(p).some(pr => pr.out === item));
const recipeFor = item => (D.crafting.recipes || []).find(r => r.base === item);
const taskFor = item => D.activities.find(a => a.yields && a.yields[item]);
const nodeFor = item => D.nodes.find(n => n.res && n.res[item]);
export const producible = item => !!(pieceMakes(item).length || recipeFor(item) || taskFor(item) || nodeFor(item) || Object.values(JOB_RES).some(r => r.includes(item)));

// ---- adding / editing
export function quotaIssue(s, item, mode) {
  if (!quotaSlots(s)) return "no quota slots";
  if (Qs(s).filter(q => !q.parent).length >= quotaSlots(s)) return "all " + quotaSlots(s) + " quota slots used";
  if (!producible(item)) return "nothing can make that";
  if (!isRes(item) && mode === "standing") return "crafted items are one-time only";
  if (Qs(s).some(q => q.item === item && !q.parent)) return "already has a quota";
  return null;
}
export function addQuota(s, item, target, mode = "standing") {
  if (quotaIssue(s, item, mode)) return null;
  const q = { id: "q" + (s.quotaSeq = (s.quotaSeq || 0) + 1), item, target: Math.max(1, Math.floor(+target || 1)), mode: mode === "once" ? "once" : "standing", made: 0, from: stock(s, item) };
  Qs(s).push(q);
  return q;
}
export function removeQuota(s, id) {
  const L = Qs(s), drop = new Set([id]);
  for (let ch = true; ch; ) { ch = false; for (const q of L) if (q.parent && drop.has(q.parent) && !drop.has(q.id)) drop.add(q.id), (ch = true); }
  s.quotas = L.filter(q => !drop.has(q.id));
  return true;
}
export function moveQuota(s, id, dir) {
  const L = Qs(s), i = L.findIndex(q => q.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= L.length) return false;
  [L[i], L[j]] = [L[j], L[i]];
  return true;
}
export const setQuotaTarget = (s, id, n) => { const q = Qs(s).find(x => x.id === id); if (q) q.target = Math.max(1, Math.floor(+n || 1)); return !!q; };
export const setQuotaMode = (s, id, mode) => { const q = Qs(s).find(x => x.id === id); if (!q || (!isRes(q.item) && mode === "standing")) return false; q.mode = mode === "once" ? "once" : "standing"; q.made = 0; q.from = stock(s, q.item); return true; };

// ---- progress
export const quotaHave = (s, q) => (q.mode === "once" ? q.made : stock(s, q.item));
export const quotaMet = (s, q) => quotaHave(s, q) >= q.target;
// R37: top-level quotas beyond the slot count (e.g. after the v37 refund) stay listed but pause, with their sub-quotas
export function quotaPaused(s, q) {
  if ((s.autoOff || {}).quotas) return true; // ⚙ Auto off
  const top = Qs(s).filter(x => !x.parent), root = q.parent ? Qs(s).find(x => x.id === q.parent) || q : q;
  return top.indexOf(root) >= quotaSlots(s);
}
export const openQuotas = s => Qs(s).filter(q => !quotaPaused(s, q) && !quotaMet(s, q));
export function quotaCredit(s, item, n) {
  if (!(n > 0) || !s.quotas || !s.quotas.length) return;
  for (const q of s.quotas) if (q.mode === "once" && q.item === item) q.made += n;
}
// rank of an output among open quotas (lower = first), Infinity when no open quota wants it
export function quotaRank(s, item) {
  const L = s.quotas || [];
  for (let i = 0; i < L.length; i++) if (L[i].item === item && !quotaPaused(s, L[i]) && !quotaMet(s, L[i])) return i;
  return Infinity;
}
// a standing quota at or over target idles its producers (never a food row while food is short)
export function quotaIdle(s, pr) {
  if (!s.quotas || !s.quotas.length) return false;
  const q = s.quotas.find(x => x.item === pr.out && x.mode === "standing");
  if (!q || quotaPaused(s, q) || !quotaMet(s, q)) return false;
  if (pr.food && daysOfStock(s) < QC().foodSafetyDays) return false;
  return true;
}
// inputs: a row never takes an input below the standing target of a higher-priority quota (or any quota, for rows with none)
export function quotaFloor(s, k, outItem) {
  if (!s.quotas || !s.quotas.length) return 0;
  const mine = quotaRank(s, outItem);
  let f = 0;
  s.quotas.forEach((q, i) => { if (q.item === k && q.mode === "standing" && i < mine && !quotaPaused(s, q)) f = Math.max(f, q.target); });
  return f;
}
// tier 2: automated selling stops at the standing target
export function sellFloor(s, res) {
  if (quotaTier(s) < 2 || !s.quotas) return 0;
  return Math.max(0, ...s.quotas.filter(q => q.item === res && q.mode === "standing").map(q => q.target));
}

// ---- why a quota is not moving (null = on track / met)
export function quotaBlock(s, q) {
  if (quotaMet(s, q)) return null;
  const item = q.item, rows = stationRows(s, item);
  if (rows.length) {
    let first = null;
    for (const { pr } of rows) {
      if (pr.dish) { const iss = dishIssue(s, dishDef(pr.dish) || {}); if (iss && iss !== "enough in store") { first = first || { why: iss }; continue; } }
      const miss = Object.entries(pr.in || {}).find(([k, v]) => (isFishKey(k) ? fishAvail(s, k) : (s.res[k] || 0) - reserveOf(s, k)) < v);
      if (!miss) return null;
      first = first || { why: `needs ${miss[0].replace("fish:", "")} (${Math.floor(s.res[miss[0].startsWith("fish:") ? "fish" : miss[0]] || 0)})`, input: miss[0].startsWith("fish:") ? "fish" : miss[0] };
    }
    return first;
  }
  const rc = recipeFor(item);
  if (rc) {
    const crafter = bestCrafter(s, rc);
    if (!crafter) return { why: "no crafter for " + rc.name };
    const miss = Object.entries(rc.mats || {}).find(([k, v]) => (s.res[k] || 0) < v);
    return miss ? { why: `needs ${miss[0]} (${Math.floor(s.res[miss[0]] || 0)})`, input: miss[0] } : null;
  }
  const job = Object.entries(JOB_RES).find(([, r]) => r.includes(item));
  if (taskFor(item) || nodeFor(item) || (job && (s.minions || []).some(mi => mi.job === job[0]))) return null; // a task, gathering spot or follower job makes it
  const pm = pieceMakes(item);
  if (pm.length) return { why: "no " + pm[0].name };
  return { why: job ? "no follower on " + job[0] : "nothing makes it here" };
}
export const quotaStatus = (s, q) => {
  if (quotaPaused(s, q)) return { k: "blocked", text: "paused: needs Steward's Ledger tier 1 for more slots" };
  if (quotaMet(s, q)) return { k: "met", text: q.mode === "once" ? "done" : "met" };
  const b = quotaBlock(s, q);
  return b ? { k: "blocked", text: b.why } : { k: "on", text: "on track" };
};

// ---- craft queue + Auto Tend
function bestCrafter(s, rc) {
  return (s.members || []).filter(m => m.alive !== false && (m.ageDays || 0) >= 16 * 360).sort((a, b) => ((b.skills[rc.skill] || {}).lvl || 0) - ((a.skills[rc.skill] || {}).lvl || 0))[0];
}
// Auto Tend target for a category: the first open quota this category can make
export function quotaAtTarget(s, c) {
  for (const q of openQuotas(s)) {
    // any category can switch to a task of its skills that yields the item (e.g. Hunting -> Hunt for meat)
    const ac = D.activities.find(a => a.yields && a.yields[q.item] && a.skills.some(k => c.skills.includes(k)));
    if (ac) return { kind: "activity", id: ac.id, name: ac.name, quota: q.id };
    if (c.kind === "gather") {
      const n = D.nodes.find(x => x.res && x.res[q.item] && (!x.skill || c.skills.includes(x.skill)) && (s.revealed || []).includes(x.id));
      if (n) return { kind: "gather", id: n.id, name: n.name, quota: q.id };
    } else if (c.kind === "craft") {
      const rc = recipeFor(q.item);
      if (rc && c.skills.includes(rc.skill)) return { kind: "craft", id: rc.id, name: rc.name, quota: q.id };
    }
  }
  return null;
}

// ---- daily upkeep: finish one-time quotas, queue crafts, pull inputs (tier 2), monthly follower move (tier 2)
export function quotaDay(s) {
  const L = s.quotas;
  if (!L || !L.length) return;
  if (!quotaSlots(s)) return;
  for (const q of [...L]) {
    if (q.mode === "once" && !isRes(q.item)) q.made = Math.max(q.made, stock(s, q.item) - (q.from || 0));
    if (quotaPaused(s, q)) continue;
    if (q.mode === "once" && quotaMet(s, q)) {
      log(s, `📋 Quota done: ${q.target} ${nm(q.item)}${q.parent ? " (for another quota)" : ""}.`);
      removeQuota(s, q.id);
      continue;
    }
    if (q.mode === "once" && !isRes(q.item) && !q.queued) {
      const rc = recipeFor(q.item), m = rc && bestCrafter(s, rc);
      if (m) { for (let i = 0; i < Math.min(q.target, 10); i++) (m.craftQueue = m.craftQueue || []).push(rc.id); q.queued = true; }
    }
  }
  if (quotaTier(s) >= 2) {
    for (const q of [...s.quotas]) {
      const depth = q.depth || 0;
      if (depth >= QC().pullDepth || quotaMet(s, q)) continue;
      const b = quotaBlock(s, q);
      if (b && b.input && producible(b.input) && !s.quotas.some(x => x.item === b.input)) {
        const c = { id: "q" + (s.quotaSeq = (s.quotaSeq || 0) + 1), item: b.input, target: QC().pullAmount || 20, mode: "once", made: 0, from: stock(s, b.input), parent: q.id, depth: depth + 1 };
        s.quotas.splice(s.quotas.indexOf(q) + 1, 0, c);
        log(s, `📋 Pulling inputs: ${c.target} ${nm(c.item)} for the ${nm(q.item)} quota.`);
      }
    }
    if ((s.day || 0) % 30 === 0) moveFollower(s);
  }
}
const nm = item => (itemDef(item) || {}).name || (dishDef(item) || {}).name || item;
function moveFollower(s) {
  const fed = new Set(openQuotas(s).flatMap(q => Object.entries(JOB_RES).filter(([, r]) => r.includes(q.item)).map(([j]) => j)));
  if (!fed.size) return;
  const want = [...fed].find(j => (s.minions || []).filter(mi => mi.job === j).length < jobCap(s, j));
  if (!want) return;
  const mi = (s.minions || []).find(x => !x.special && (x.job === "idle" || !x.job)) || (s.minions || []).find(x => !x.special && JOB_RES[x.job] && !fed.has(x.job));
  if (!mi) return;
  log(s, `📋 Steward's Ledger: ${mi.name || "a follower"} moves from ${mi.job || "idle"} to ${want} for a quota.`);
  mi.job = want;
}
