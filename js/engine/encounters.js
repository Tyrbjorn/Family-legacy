import { injure } from "./injuries.js";
import { gameFx } from "./difficulty.js";
import { notify } from "./notify.js";
// Choice encounters while travelling: queued decision for the active member (live play),
// default policy for automated orders. Outcomes: coin, items, recipes, buffs/curses, injuries, Hedge Witch.
import { checkAchievements, inc } from "./achievements.js";
import { chron } from "./chronicle.js";
import { addToVault, itemDef } from "./inventory.js";
import { addRenown } from "./legacy.js";
import { addMinion } from "./minions.js";
import { D, afford, log, pay, rng } from "./state.js";
import { season } from "./seasons.js";

const CFG = () => D.encounters || { chancePerTravelDay: 0, list: [], policies: {} };

export const encDef = id => CFG().list.find(e => e.id === id);

// ---- temporary buffs / curses
export const activeBuffs = s => (s.buffs || []).filter(b => b.until > s.day);

export const buffSum = (s, key) => activeBuffs(s).reduce((a, b) => a + (b[key] || 0), 0);

export function addBuff(s, b) {
  if (!s.buffs) s.buffs = [];
  s.buffs = s.buffs.filter(x => x.id !== b.id && x.until > s.day);
  s.buffs.push({ ...b, until: s.day + b.days });
}

export const expireBuffs = s => {
  s.buffs = activeBuffs(s);
};

// ---- checks
function checkChance(m, c) {
  if (!c) return 1;
  const one = x => {
    const v = x.stat ? m.stats[x.stat] || 0 : (m.skills[x.skill] || { lvl: 0 }).lvl;
    return Math.max(0.1, Math.min(0.95, 0.5 + (v - x.dc) * 0.08));
  };
  return Math.max(one(c), c.alt ? one(c.alt) : 0);
}

export const optionChance = (s, m, o) => checkChance(m, o.check);

export const optionOk = (s, o) => !o.cost || afford(s, o.cost);

// ---- trigger
// ctx: { terrain, road: "on"|"off" } from the route; season from the calendar. `when` filters, `weight` biases.
export function encounterPool(s, ctx) {
  const sid = D.seasons ? season(s).id : null;
  return CFG().list.filter(e => {
    const w = e.when;
    if (!w) return true;
    if (w.season && sid && !w.season.includes(sid)) return false;
    if (!ctx) return !w.road && !w.terrain;
    if (w.road && w.road !== ctx.road) return false;
    if (w.terrain && !w.terrain.includes(ctx.terrain)) return false;
    return true;
  });
}
export function maybeEncounter(s, m, eff, ctx) {
  if (m.minion || s.pendingEnc || !CFG().list.length) return null;
  if (rng() >= CFG().chancePerTravelDay * eff * gameFx(s, "events")) return null;
  const pool = encounterPool(s, ctx);
  const tot = pool.reduce((a, e) => a + (e.weight || 1), 0);
  let x = rng() * tot,
    e = pool[0];
  for (const c of pool) if ((x -= c.weight || 1) < 0) { e = c; break; }
  if (!e) return null;
  if (m.id === s.activeId && !m.standing) {
    s.pendingEnc = { id: e.id, mid: m.id, day: s.day };
    notify(s, "encounter", `❗ ${m.name}: ${e.name || "an encounter"} needs your choice.`);
    return s.pendingEnc;
  }
  return autoResolve(s, m, e);
}

export function policyOption(s, e) {
  const pol = s.encPolicy || "kind";
  return (
    e.options.find(o => o.tag === pol && optionOk(s, o)) || e.options.find(o => o.tag === "cautious") || e.options[0]
  );
}

export function autoResolve(s, m, e) {
  return applyOption(s, m, e, policyOption(s, e), true);
}

export function resolvePending(s, optId) {
  const p = s.pendingEnc;
  if (!p) return null;
  const e = encDef(p.id);
  const m = s.members.find(x => x.id === p.mid);
  const o = e && e.options.find(x => x.id === optId);
  if (!o || !m || !optionOk(s, o)) return null;
  s.pendingEnc = null;
  return applyOption(s, m, e, o, false);
}

function applyOutcome(s, m, out) {
  const bits = [];
  if (out.coin) {
    s.res.coin = Math.max(0, s.res.coin + out.coin);
    bits.push(`${out.coin > 0 ? "+" : ""}${out.coin}🪙`);
  }
  for (const [k, v] of Object.entries(out.res || {})) {
    s.res[k] = (s.res[k] || 0) + v;
    bits.push(`+${v} ${k}`);
  }
  if (out.item && addToVault(s, out.item)) bits.push(itemDef(out.item).name);
  if (out.recipe && !s.unlocks.includes("recipe:" + out.recipe)) {
    s.unlocks.push("recipe:" + out.recipe);
    bits.push("recipe: " + ((D.crafting.recipes.find(r => r.id === out.recipe) || {}).name || out.recipe));
  }
  if (out.buff) {
    addBuff(s, out.buff);
    bits.push("✨ " + out.buff.name);
  }
  if (out.curse) {
    addBuff(s, { ...out.curse, curse: true });
    bits.push("🪬 " + out.curse.name);
  }
  if (out.injure) {
    injure(s, m, out.injure <= 2 ? 1 : 2, "in an encounter");
    bits.push("🤕 injured");
  }
  if (out.renown) {
    addRenown(s, m, out.renown);
    bits.push(`+${out.renown} renown`);
  }
  if (out.special && !s.specialGranted.includes(out.special)) {
    s.specialGranted.push(out.special);
    if (addMinion(s, out.special, "met on the road")) bits.push("🧙‍♀️ a new follower");
  }
  if (out.reveal) {
    const pool = D.nodes.filter(n => n.hidden && !s.revealed.includes(n.id));
    if (pool.length) {
      const n = pool[Math.floor(rng() * pool.length)];
      s.revealed.push(n.id);
      bits.push("🔍 " + n.name);
    }
  }
  if (out.delay && m.action && m.action.trip) {
    m.action.trip.out += out.delay;
    bits.push(`⏳ +${out.delay}d`);
  }
  if (out.count) inc(s, out.count);
  return bits;
}

export function applyOption(s, m, e, o, auto) {
  if (o.cost) pay(s, o.cost);
  const win = rng() < optionChance(s, m, o);
  const out = (win ? o.success : o.fail) || o.success;
  const bits = applyOutcome(s, m, out);
  inc(s, "encounters");
  const msg = `${e.icon} ${e.name}: ${m.name} chose “${o.label}”${auto ? " (auto)" : ""}. ${out.text}${bits.length ? " " + bits.join(", ") : ""}`;
  log(s, msg);
  chron(s, "encounter", msg, m.name);
  checkAchievements(s);
  return { win, text: out.text, bits };
}
