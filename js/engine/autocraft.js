// R44 Auto-craft (Workshop line): crafters make gear for your own people in their spare time.
// Tier 1: basic tools for followers with a job and no tool. Tier 2: refits family and followers to the best
// gear they can make. Tier 3: keeps 1 spare of each gear type in use in the vault.
// Every want becomes a Work Order tagged `auto` (the shared planner gathers and refines the inputs); auto orders
// use their own slots (data legacy.autoCraft.maxOpen by tier). Switch: s.autoOff.ac; pause when done: s.autoPwd.ac.
import { D, isAdult, living } from "./state.js";
import { CR, itemDef, recipeIssue } from "./inventory.js";
import { legacyTier } from "./legacy.js";
import { addOrder, orderDone, orderList, autoSlots } from "./orders.js";
import { bestCrafter, quotaBlock, quotaStock } from "./quotas.js";
import { isHeld } from "./holds.js";
import { itemScore } from "./geartypes.js";
import { cp } from "./family.js";
import { refitPass, toolPass } from "./autoequip.js";
import { autoPwd, autoPwdFire } from "./autotend.js";
import { registerDayHook } from "./time.js";

export const ACC = () => (D.legacy && D.legacy.autoCraft) || {};
export const acTier = s => legacyTier(s, "autocraft");
export const acOn = s => acTier(s) >= 1 && !(s.autoOff || {}).ac;
const base = id => { const p = String(id || "").split("#")[0].split("|"); return p[0] === "c" ? p[1] : p[0]; }; // c|iron_sword|fine#ench -> iron_sword
export const recipeOfItem = item => CR().recipes.find(r => (r.base || r.out || r.id) === item);
const outOf = r => r.base || r.out || r.id;
const crafterFollower = s => (s.minions || []).some(mi => mi.job === "craft" && !mi.unhoused && !mi.paused);
export function makeable(s, rc) {
  if (!rc) return false;
  const m = bestCrafter(s, rc);
  if (!m && !crafterFollower(s)) return false;
  const i = recipeIssue(s, m || null, rc);
  if (i && i !== "missing materials") return false;
  return Object.entries(rc.mats || {}).every(([k, v]) => (s.res[k] || 0) >= v || inputOk(s, k, 3)); // the planner must be able to supply missing inputs
}
// can the estate make this input (following missing inputs a few steps)? e.g. steel needs a Steel Furnace
function inputOk(s, item, depth) {
  const b = quotaBlock(s, { item, target: (s.res[item] || 0) + 1, mode: "once", made: 0, from: 0 });
  if (!b) return true;
  if (!b.input || depth <= 0) return false;
  return inputOk(s, b.input, depth - 1);
}
const vaultItems = (s, ok) => (s.vault || []).filter(id => { const it = itemDef(id); return it && !isHeld(s, id) && ok(it, id); });
const cpOf = id => (id && (itemDef(id) || {}).cp) || 0;

// what Auto-craft wants made now: [{ item, n, why }]
export function acWants(s) {
  const C = ACC(), T = acTier(s), W = [], max = C.perItemMax || 3;
  const add = (item, n, why) => { const w = W.find(x => x.item === item); if (w) w.n = Math.min(max, w.n + n); else W.push({ item, n: Math.min(max, n), why }); };
  const mins = (s.minions || []).filter(mi => mi.job && !mi.special && !mi.paused);
  if (T >= 1) {
    const lack = {};
    for (const mi of mins) { const t = (C.basicTools || {})[mi.job]; if (t && !(mi.equip || {}).tool) (lack[t] ||= []).push(mi); }
    for (const [t, L] of Object.entries(lack)) {
      const job = L[0].job, have = vaultItems(s, it => it.toolFor === job).length, n = L.length - have;
      if (n > 0 && makeable(s, recipeOfItem(t))) add(t, n, `tool for ${n} follower${n > 1 ? "s" : ""} (${job})`);
    }
  }
  if (T >= 2) {
    const mg = C.refitMargin || 1.1, starter = C.starterGear || [];
    for (const m of living(s).filter(m => isAdult(m) && !m.noAutoEq)) {
      const mcp = cp(s, m), sc = id => (id ? itemScore(m, id, mcp) : 0);
      for (const sl of C.refitSlots || ["weapon", "armor", "offhand"]) {
        const cur = (m.equip || {})[sl];
        if (cur && !(m.autoEq || {})[sl] && !starter.includes(cur)) continue; // hand-picked gear stays
        if (sl === "offhand" && cur == null && (itemDef((m.equip || {}).weapon) || {}).hands === 2) continue;
        const now = Math.max(sc(cur), ...vaultItems(s, it => it.slot === sl).map(sc), 0);
        const best = CR().recipes.filter(r => (itemDef(outOf(r)) || {}).slot === sl && makeable(s, r)).map(r => [outOf(r), sc(outOf(r))]).sort((a, b) => b[1] - a[1])[0];
        if (best && best[1] > now * mg + 0.5) add(best[0], 1, `refit ${m.name.split(" ")[0]} (${sl})`);
      }
    }
    for (const mi of mins) {
      const cur = (mi.equip || {}).tool, now = Math.max(cpOf(cur), ...vaultItems(s, it => it.toolFor === mi.job).map(cpOf), 0);
      const best = CR().recipes.filter(r => (itemDef(outOf(r)) || {}).toolFor === mi.job && makeable(s, r)).map(r => [outOf(r), cpOf(outOf(r))]).sort((a, b) => b[1] - a[1])[0];
      if (best && best[1] > now * mg + 0.5 && cur) add(best[0], 1, `better tool (${mi.job})`);
    }
  }
  if (T >= 3) {
    const used = new Set();
    for (const m of living(s).filter(isAdult)) for (const sl of C.spareSlots || []) (m.equip || {})[sl] && used.add(base(m.equip[sl]));
    for (const mi of s.minions || []) for (const sl of C.spareSlots || []) (mi.equip || {})[sl] && used.add(base(mi.equip[sl]));
    for (const id of used) { const rc = recipeOfItem(id); if (rc && makeable(s, rc) && quotaStock(s, id) < 1) add(id, 1, "spare"); }
  }
  const skip = s.acSkip || {};
  return W.filter(w => !(skip[w.item] > (s.day || 0)));
}

export const acOpen = s => orderList(s).filter(o => o.auto && !orderDone(s, o));
export function acStatus(s) {
  const T = acTier(s);
  if (T < 1) return { on: false, text: "locked (Workshop → Auto-craft in 🏛️ Legacy)" };
  if ((s.autoOff || {}).ac) return { on: false, text: "off" };
  const o = acOpen(s);
  return { on: true, pwd: autoPwd(s, "ac"), open: o.length, slots: autoSlots(s), text: o.length ? `making ${o.map(x => x.item && (itemDef(x.item) || {}).name || x.item).join(", ")}` : "nothing needed right now" };
}

export function autoCraftDay(s) {
  if (!acOn(s)) return;
  const T = acTier(s);
  toolPass(s);
  if (T >= 2) refitPass(s, ACC().starterGear || []);
  const open = acOpen(s);
  if (autoPwd(s, "ac")) { if (!open.length) autoPwdFire(s, "ac", "Auto-craft"); return; } // finish what's open, place nothing new
  let room = autoSlots(s) - open.length;
  for (const w of acWants(s)) {
    if (room <= 0) break;
    if (open.some(o => o.item === w.item)) continue;
    if (addOrder(s, w.item, w.n, { auto: w.why })) room--;
  }
}
registerDayHook("autocraft", autoCraftDay);
