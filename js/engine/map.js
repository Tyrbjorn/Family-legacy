import { addRenown } from "./legacy.js";
import { defaultAction } from "./actions.js";
import { eff } from "./estate.js";
import { cp } from "./family.js";
import { lineBonus } from "./guilds.js";
import { addToVault, itemDef } from "./inventory.js";
import { addMinion, minionRoom } from "./minions.js";
import { dungeonClear, dungeonDef, dungeonFloor, questIssue, resolveQuest, rollRare } from "./quests.js";
import { gainXp } from "./skills.js";
import { D, T, active, isAdult, living, log, r, rng } from "./state.js";

export function travelTick(s, m, a, eff) {
  if (a.type === "quest" && !D.quests.find(x => x.id === a.target)) {
    m.action = null;
    return;
  }
  if (a.type === "gather" && !D.nodes.find(x => x.id === a.target)) {
    m.action = null;
    return;
  }
  if (a.type === "explore" && !areaDef(a.target)) {
    m.action = null;
    return;
  }
  if (a.type === "dungeon" && !dungeonDef(a.target)) {
    m.action = null;
    return;
  }
  if (!a.trip) a.trip = newTrip(a);
  const t = a.trip;
  const ph = tripPhase(a);
  t.t += eff;
  a.progress = t.t;
  if (ph === "task") {
    if (a.type === "quest") {
      const q = D.quests.find(x => x.id === a.target);
      gainXp(s, m, q.skill, T.xpPerDay * 0.6 * eff);
    }
    if (a.type === "dungeon") {
      const dg = dungeonDef(a.target);
      gainXp(s, m, dg.skill, T.xpPerDay * 0.7 * eff);
      let cum = t.out;
      t.floor = t.floor || 0;
      for (let i = 0; i < dg.floors.length; i++) {
        cum += dg.floors[i].days;
        if (i === t.floor && t.t >= cum && !t.resolved) {
          if (!dungeonFloor(s, m, dg, i)) {
            t.resolved = true;
            t.t = t.out + t.task;
            break;
          }
          t.floor++;
          if (t.floor >= dg.floors.length) {
            t.resolved = true;
            dungeonClear(s, m, dg);
          }
        }
      }
    }
    if (a.type === "gather") {
      const n = D.nodes.find(x => x.id === a.target);
      const mul = (1 + m.skills[n.skill].lvl * 0.03) * eff;
      const gb = lineBonus(m);
      for (const [k, v] of Object.entries(n.res)) s.res[k] = (s.res[k] || 0) + v * mul * (1 + (gb[k] || 0));
      gainXp(s, m, n.skill, T.xpPerDay * 0.6 * eff);
      rollRare(s, n, m);
    }
  }
  if (!t.resolved && t.t >= t.out + t.task) {
    t.resolved = true;
    if (a.type === "quest")
      resolveQuest(
        s,
        m,
        D.quests.find(x => x.id === a.target),
        eff,
      );
    if (a.type === "explore") exploreArea(s, m, areaDef(a.target));
  }
  if (m.alive && m.action === a && tripPhase(a) === "done") {
    if (m.standing) {
      m.action = null;
      return;
    }
    const q = a.type === "quest" && D.quests.find(x => x.id === a.target);
    const stop =
      a.type === "explore" ||
      a.type === "dungeon" ||
      (q && (q.once || q.story) && s.doneQuests.includes(q.id)) ||
      (q && questIssue(s, m, q));
    if (stop) m.action = m.id === s.activeId ? defaultAction(s, m) : null;
    else {
      a.trip = null;
      a.progress = 0;
    }
  }
}

export function regionOpen(s, id) {
  const rg = D.regions.find(x => x.id === id);
  if (!rg) return false;
  if (rg.hidden && !(s.discovered || []).includes(id)) return false;
  return living(s).some(m => cp(s, m) >= rg.cp) || id === "outskirts";
}

export const regionKnown = (s, id) => {
  const rg = D.regions.find(x => x.id === id);
  return !!rg && (!rg.hidden || (s.discovered || []).includes(id));
};

export const townKnown = (s, t) => !t.hidden || (s.discovered || []).includes(t.id);

// ---- map, travel, exploration
export const MP = () => D.map;

export const areaDef = id => (MP().areas || []).find(a => a.id === id);

export const ptOf = id => MP().points[id] || MP().towns[id] || areaDef(id) || MP().home;

export const distTo = id => {
  const p = ptOf(id),
    h = MP().home;
  return Math.hypot(p.x - h.x, p.y - h.y);
};

export const travelDays = id => Math.round(Math.max(MP().minTravel, distTo(id) / MP().speed) * 10) / 10;

export const TRAVEL_TYPES = ["quest", "gather", "explore", "dungeon"];

export function taskDays(a) {
  if (a.type === "dungeon") return dungeonDef(a.target).floors.reduce((x, f) => x + f.days, 0);
  if (a.type === "quest") return D.quests.find(q => q.id === a.target).days;
  if (a.type === "explore") return areaDef(a.target).days;
  return MP().gatherTripDays;
}

export function newTrip(a) {
  const out = travelDays(a.target);
  return { out, task: taskDays(a), back: out, t: 0, resolved: false };
}

export function tripPhase(a) {
  const t = a && a.trip;
  if (!t) return null;
  return t.t < t.out
    ? "out"
    : t.t < t.out + t.task
      ? "task"
      : t.t < t.out + t.task + t.back
        ? "back"
        : "done";
}

export const tripTotal = a => (a.trip ? a.trip.out + a.trip.task + a.trip.back : 0);

export const tripLeft = a => (a && a.trip ? Math.max(0, tripTotal(a) - a.trip.t) : 0);

export const isBusy = m => !!(m && m.action && m.action.trip && tripPhase(m.action) !== "done");

// where on the map a traveller is (0..1 along home→target)
export function tripPos(a) {
  const t = a.trip,
    h = MP().home,
    p = ptOf(a.target);
  let f =
    t.t < t.out ? t.t / t.out : t.t < t.out + t.task ? 1 : Math.max(0, 1 - (t.t - t.out - t.task) / t.back);
  return { x: h.x + (p.x - h.x) * f, y: h.y + (p.y - h.y) * f, f };
}

export function exploreIssue(s, m, id) {
  const ar = areaDef(id);
  if (!ar) return "missing";
  if (!isAdult(m)) return "adults only";
  if (!regionOpen(s, ar.region)) return "region locked";
  return null;
}

export const explored = (s, id) => (s.explored || []).includes(id);

export function exploreArea(s, m, ar) {
  const first = !explored(s, ar.id);
  if (first) s.explored.push(ar.id);
  const found = [];
  for (const sc of ar.secrets) {
    const key = sc.type + ":" + sc.id;
    const once = sc.type !== "encounter";
    if (once && s.discovered.includes(key)) continue;
    if (rng() >= sc.chance * (1 + ((m.skills.tracking || {}).lvl || 0) * 0.01)) continue;
    if (sc.type === "town" || sc.type === "region") {
      if (!s.discovered.includes(sc.id)) s.discovered.push(sc.id);
      const nm = (sc.type === "town" ? D.towns : D.regions).find(x => x.id === sc.id).name;
      found.push((sc.type === "town" ? "🏘️ town " : "🗺️ new region ") + nm);
    } else if (sc.type === "reveal") {
      const x = [...D.quests, ...D.nodes].find(y => y.id === sc.id);
      if (x && !s.revealed.includes(x.id)) {
        s.revealed.push(x.id);
        found.push("🔍 " + x.name);
      } else continue;
    } else if (sc.type === "dungeon") {
      const x = dungeonDef(sc.id);
      if (x && !s.revealed.includes(x.id)) {
        s.revealed.push(x.id);
        found.push("🕳️ dungeon: " + x.name);
      } else continue;
    } else if (sc.type === "cache") {
      for (const [k, v] of Object.entries(sc.reward)) s.res[k] = (s.res[k] || 0) + v;
      found.push(
        "💰 cache (" +
          Object.entries(sc.reward)
            .map(([k, v]) => v + " " + k)
            .join(", ") +
          ")",
      );
    } else if (sc.type === "encounter") {
      for (const [k, v] of Object.entries(sc.reward || {})) s.res[k] = (s.res[k] || 0) + v;
      let t = "⚡ encounter: " + ((MP().encounterNames || {})[sc.id] || sc.id);
      if (sc.drop && rng() < sc.drop.chance && addToVault(s, sc.drop.id)) {
        if (!s.found.includes(sc.drop.id)) s.found.push(sc.drop.id);
        t += " → 🌟 " + itemDef(sc.drop.id).name;
      }
      found.push(t);
      if (!m.minion) gainXp(s, m, "monsterlore", T.xpPerDay);
    }
    if (once) s.discovered.push(key);
  }
  addRenown(s, m, first ? 3 : 1);
  if (!m.minion) gainXp(s, m, "tracking", T.xpPerDay * 2);
  log(
    s,
    `🧭 ${m.name} explored ${ar.name}${first ? " (fog cleared)" : ""}: ${found.length ? found.join(" · ") : "nothing new"}.`,
  );
  return found;
}

export const areaSecretsLeft = (s, ar) =>
  ar.secrets.filter(sc => sc.type !== "encounter" && !s.discovered.includes(sc.type + ":" + sc.id)).length;

export const rumorCost = s => Math.round(T.rumorCost * (1 - Math.min(0.5, eff(s, "rumorDiscount"))));

export function rumor(s, regionId) {
  if (s.res.coin < rumorCost(s)) return null;
  const pool = [...D.quests, ...D.nodes].filter(
    x => x.region === regionId && x.hidden && !s.revealed.includes(x.id),
  );
  s.res.coin -= rumorCost(s);
  gainXp(s, active(s), "etiquette", T.xpPerDay);
  if (rng() < D.minions.rumorRecruitChance && minionRoom(s)) {
    addMinion(
      s,
      r(D.minions.types.filter(t => !t.special && t.id !== "refugee")).id,
      "found through a rumor",
    );
    return { recruit: true };
  }
  if (!pool.length || rng() < 0.3) {
    log(s, "🗣️ The tavern talk was idle gossip.");
    return false;
  }
  const x = r(pool);
  s.revealed.push(x.id);
  log(s, `🗣️ Rumor: ${x.name} discovered!`);
  return x;
}
