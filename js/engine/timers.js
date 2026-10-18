import { findId } from "./lookup.js";
import { FEUD, houseList, houseState } from "./houses.js";
import { warTimer } from "./war.js";
// Every running timer in one list (for progress bars and the Timers dock).
// Each entry: { key, icon, who, what, p (0..1), left (in-game days, null = ongoing), tab }
import { activeBuffs } from "./encounters.js";
import { itemDef, recipeDef } from "./inventory.js";
import { enchDef, enchTimer } from "./gear.js";
import { MLV, minionXpNeed } from "./minions.js";
import { tripLeft, tripPhase, tripTotal } from "./map.js";
import { dungeonRun } from "./quests.js";
import { D, T, living, xpNeed } from "./state.js";
import { activeEvents, eventText, eventType } from "./worldevents.js";

const clamp = x => Math.max(0, Math.min(1, x || 0));
const PHASE = { out: "travelling", task: "on site", back: "returning" };

// Activity/job: progress to the next level of the slowest-to-level skill it trains.
function skillTimer(m, skills, rate) {
  const ks = (skills || []).map(k => [k, m.skills[k]]).filter(([, k]) => k);
  if (!ks.length) return { p: 0, left: null, label: "" };
  const [id, k] = ks[0];
  const need = xpNeed(k.lvl);
  const sk = findId(D.skills, id);
  return {
    p: clamp(k.xp / need),
    left: rate > 0 ? Math.max(0, need - k.xp) / rate : null,
    label: `${sk ? sk.name : id} ${k.lvl}→${k.lvl + 1}`,
  };
}

export function memberTimer(s, m) {
  const a = m.action;
  if (!(m.injured > 0)) m.injMax = 0;
  else m.injMax = Math.max(m.injMax || 0, m.injured);
  if (m.injured > 0) {
    const max = m.injMax;
    return {
      key: "inj" + m.id,
      icon: "🤕",
      who: m.name,
      what: "recovering",
      p: clamp(1 - m.injured / max),
      left: m.injured,
      tab: "main",
    };
  }
  if (!a) return null;
  const base = { key: "m" + m.id, who: m.name, tab: "main" };
  if (a.trip) {
    const tot = tripTotal(a),
      ph = tripPhase(a);
    let what = `${a.type} ${a.target} · ${PHASE[ph] || "done"}`;
    if (a.type === "dungeon" && ph === "task") {
      const dg = dungeonRun(s, a.target); // R49 boat floors
      if (dg) {
        let t = a.trip.t - a.trip.out,
          f = 0;
        while (f < dg.floors.length - 1 && t >= dg.floors[f].days) t -= dg.floors[f++].days;
        what = `${dg.name} · floor ${f + 1}/${dg.floors.length}`;
      }
    }
    const icon = { quest: "📜", gather: "⛏️", explore: "🧭", dungeon: "🏰" }[a.type] || "🚶";
    return { ...base, icon, what, p: clamp(a.trip.t / tot), left: tripLeft(a), tab: "map" };
  }
  if (a.type === "craft") {
    const rc = recipeDef(a.target);
    if (rc)
      return {
        ...base,
        icon: "🔨",
        what: rc.name + (m.craftQueue.length ? ` (+${m.craftQueue.length} queued)` : ""),
        p: clamp((a.progress || 0) / rc.days),
        left: Math.max(0, rc.days - (a.progress || 0)),
        tab: "craft",
      };
  }
  if (a.type === "activity" || a.type === "job") {
    const def = (a.type === "job" ? D.jobs : D.activities).find(x => x.id === a.target);
    if (def) {
      const t = skillTimer(m, def.skills, T.xpPerDay * (a.type === "job" ? 0.5 : 0.6));
      return {
        ...base,
        icon: def.icon || "🏃",
        what: `${def.name}${t.label ? " · " + t.label : ""}`,
        p: t.p,
        left: t.left,
        tab: "jobs",
      };
    }
  }
  if (a.type === "court") {
    const su = findId(s.suitors, a.target);
    if (su)
      return { ...base, icon: "💌", what: `courting ${su.name}`, p: clamp(su.affinity / 100), left: null, tab: "main" };
  }
  if (a.type === "rest") return { ...base, icon: "💤", what: "resting", p: 0, left: null, tab: "jobs" };
  return null;
}

export function minionTimer(s, mi) {
  if (!mi.job) return null;
  const need = minionXpNeed(mi.lvl || 1);
  const rate = (MLV().xpPerDay || 1) * 1;
  return {
    key: "mi" + mi.uid,
    icon: "🧑‍🔧",
    who: mi.name,
    what: `${mi.job} · Lv ${mi.lvl || 1}→${(mi.lvl || 1) + 1}`,
    p: clamp((mi.xp || 0) / need),
    left: Math.max(0, need - (mi.xp || 0)) / rate,
    tab: "minions",
  };
}

export function timers(s) {
  const out = [];
  for (const m of living(s)) {
    const t = memberTimer(s, m);
    if (t) out.push(t);
  }
  for (const mi of s.minions || []) {
    if (mi.job === "idle") continue; // dock lists busy minions only
    const t = minionTimer(s, mi);
    if (t) out.push(t);
  }
  // estate production runs once per in-game day
  if ((s.structures || []).length)
    out.push({
      key: "prod",
      icon: "🏭",
      who: "Estate",
      what: "production cycle",
      p: clamp(s.acc),
      left: 1 - clamp(s.acc),
      tab: "estate",
    });
  for (const e of activeEvents(s)) {
    const len = Math.max(1, e.until - (e.from ?? e.until - 30));
    out.push({
      key: "ev" + e.type + e.place,
      icon: eventType(e.type).icon,
      who: "World",
      what: eventText(e),
      p: clamp((s.day - (e.from ?? e.until - len)) / len),
      left: e.until - s.day,
      tab: "map",
    });
  }
  for (const b of activeBuffs(s))
    out.push({
      key: "bf" + b.id,
      icon: b.icon || "✨",
      who: "Family",
      what: b.name || b.id,
      p: clamp(1 - (b.until - s.day) / (b.days || 1)),
      left: b.until - s.day,
      tab: "main",
    });
  for (const h of houseList()) {
    const st = houseState(s, h.id);
    if (st.state === "war") {
      const w = warTimer(s, h.id);
      out.push({ key: "war" + h.id, icon: "🏴", who: h.name, what: `war · next battle · score ${w.score}`, p: w.p, left: w.left, tab: "houses" });
    } else if (st.state === "feud" && st.warned != null) {
      const n = FEUD().warnDays;
      out.push({ key: "feud" + h.id, icon: "🔥", who: h.name, what: "mustering for war", p: clamp((s.day - st.warned) / n), left: Math.max(0, n - (s.day - st.warned)), tab: "houses" });
    }
  }
  for (const j of s.enchants || []) {
    const t = enchTimer(s, j);
    out.push({ key: j.uid, icon: "✨", who: (itemDef(j.item) || {}).name || j.item, what: `enchanting: ${(enchDef(j.ench) || {}).name}`, p: t.p, left: t.left, tab: "inv" });
  }
  return out;
}

// Turbo is measured in real seconds, not days.
export const turboTimer = s =>
  s.turbo.charge >= 1
    ? {
        key: "turbo",
        icon: "⚡",
        who: "Turbo",
        what: s.turbo.on ? "burning (3×)" : `charged · ${Math.floor(s.turbo.charge / 60)}m banked`,
        p: clamp(s.turbo.charge / ((T.turboCapMin || 60) * 60)),
        leftSec: s.turbo.on ? s.turbo.charge : null,
        tab: "main",
      }
    : null;
