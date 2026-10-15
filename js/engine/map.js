import { injure } from "./injuries.js";
import { tutNote } from "./tutorial.js";
import { seasonGather, seasonTravel } from "./seasons.js";
import { chron } from "./chronicle.js";
import { buffSum, maybeEncounter } from "./encounters.js";
import { resGain } from "./legacy.js";
import { eventMult, gatherMult, travelRisk } from "./worldevents.js";
import { WD, drawNode, haulTier, locationsDay, nodeYieldMult, reveal, routeOf, terrainAt, terrainDef } from "./world.js";

const targetRegion = a =>
  ([...D.quests, ...D.nodes, ...(D.dungeons || []), ...(D.map.areas || [])].find(x => x.id === a.target) || {}).region;

// One day on the road: world-event travel risk, then a chance of a choice encounter.
function roadDay(s, m, a, eff) {
  const rt = D.world ? routeOf(a.target, ptOf) : null;
  const rmul = rt ? rt.risk * (rt.roadFrac < 0.5 ? eventMult(s, targetRegion(a), "offroadRisk") : 1) : 1;
  const risk = travelRisk(s, targetRegion(a)) * rmul;
  if (rt) {
    // fog clears around the traveller; off-road walking clears more and turns up discoveries
    const p = tripPos(a);
    reveal(s, p.x, p.y, WD().fog.travel + WD().fog.offroadBonus * (1 - rt.roadFrac));
    if (rng() < WD().discoverPerOffroadDay * (1 - rt.roadFrac) * rt.discover * eventMult(s, targetRegion(a), "discover") * eff) offroadFind(s, m, p);
    locationsDay(s, m.name);
  }
  if (risk && !m.minion && rng() < risk * eff) {
    log(s, `🗡️ ${m.name} was waylaid on the road.`);
    injure(s, m, 2, "on the road", { guards: true });
  }
  if (a.type !== "auto")
    maybeEncounter(s, m, eff * (rt ? rt.risk : 1), rt ? { terrain: rt.terrain, road: rt.roadFrac >= 0.5 ? "on" : "off" } : null);
}

// off-road discovery: clears a patch of fog nearby, sometimes reveals a remote node in that region
function offroadFind(s, m, p) {
  const an = rng() * 6.283,
    x = p.x + Math.cos(an) * 90,
    y = p.y + Math.sin(an) * 90;
  reveal(s, x, y, 80);
  const rm = D.nodes.filter(n => n.remote && n.hidden && !s.revealed.includes(n.id));
  let msg = `🧭 ${m.name} strayed off the road and charted new ground`;
  if (rm.length && rng() < 0.25) {
    const n = rm[Math.floor(rng() * rm.length)];
    s.revealed.push(n.id);
    msg += `, and found ${n.icon} ${n.name}`;
    chron(s, "discovery", `🔍 ${m.name} found ${n.name} off the beaten track.`, m.name);
  }
  log(s, msg + ".");
}
import { addRenown } from "./legacy.js";
import { defaultAction } from "./actions.js";
import { eff } from "./estate.js";
import { cp } from "./family.js";
import { lineBonus } from "./guilds.js";
import { memberFx, pathFinds } from "./paths.js";
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
  if (!a.trip) a.trip = newTrip(a, s);
  const t = a.trip;
  const ph = tripPhase(a);
  t.t += ph === "out" || ph === "back" ? eff * seasonTravel(s) : eff;
  a.progress = t.t;
  if (ph === "out" || ph === "back") roadDay(s, m, a, eff);
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
          if (!dungeonFloor(s, m, dg, i, t)) {
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
      const mul =
        (1 + m.skills[n.skill].lvl * 0.03) *
        eff *
        resGain(s) *
        gatherMult(s, n.region) *
        Math.max(0.2, 1 + buffSum(s, "gather")) *
        seasonGather(s);
      const gb = lineBonus(m);
      gatherInto(s, t, n, mul, k => (gb[k] || 0) + memberFx(m, "gather", k), pathFinds(m, n.skill));
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
  if (t.load && tripPhase(a) === "done") deliverLoad(s, m.name, t);
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

export const travelDays = id =>
  Math.round(Math.max(MP().minTravel, D.world ? routeOf(id, ptOf).days : distTo(id) / MP().speed) * 10) / 10;

// gathering fills a load (capped by the hauling tier's carry per trip); it reaches the larder when hauled home
export function gatherInto(s, t, n, mul, bonusOf, finds = {}) {
  const tr = D.world ? terrainDef(n.terrain || terrainAt(ptOf(n.id).x, ptOf(n.id).y)) : null;
  const ym = D.world ? nodeYieldMult(s, n) : 1;
  if (!t.load) t.load = {};
  const cap = t.cap || (D.world ? haulTier(s).carry : Infinity);
  t.cap = cap;
  let have = Object.values(t.load).reduce((x, y) => x + y, 0),
    took = 0;
  const add = (k, v) => {
    const q = Math.min(v, Math.max(0, cap - have));
    if (q <= 0) return;
    t.load[k] = (t.load[k] || 0) + q;
    have += q;
    took += q;
  };
  for (const [k, v] of Object.entries(n.res)) add(k, v * mul * ym * (tr ? tr.gather[k] || 1 : 1) * (1 + bonusOf(k)));
  for (const [k, v] of Object.entries(finds)) add(k, v * mul);
  if (D.world && took) drawNode(s, n, took);
  return took;
}
export function deliverLoad(s, who, t) {
  const bits = [];
  for (const [k, v] of Object.entries(t.load)) if (v > 0) (s.res[k] = (s.res[k] || 0) + v), bits.push(`${Math.round(v * 10) / 10} ${k}`);
  if (bits.length) log(s, `🛒 ${who} hauled home ${bits.join(", ")}.`);
  t.load = null;
  t.cap = 0;
}

export const TRAVEL_TYPES = ["quest", "gather", "explore", "dungeon"];

export function taskDays(a) {
  if (a.type === "dungeon") return dungeonDef(a.target).floors.reduce((x, f) => x + f.days, 0);
  if (a.type === "quest") return D.quests.find(q => q.id === a.target).days;
  if (a.type === "explore") return areaDef(a.target).days;
  return MP().gatherTripDays;
}

export function newTrip(a, s) {
  const out = travelDays(a.target);
  const hs = a.type === "gather" && s && D.world ? haulTier(s).haulSpeed : 1;
  return { out, task: taskDays(a), back: Math.round((out / hs) * 10) / 10, t: 0, resolved: false };
}

export function tripPhase(a) {
  const t = a && a.trip;
  if (!t) return null;
  return t.t < t.out ? "out" : t.t < t.out + t.task ? "task" : t.t < t.out + t.task + t.back ? "back" : "done";
}

export const tripTotal = a => (a.trip ? a.trip.out + a.trip.task + a.trip.back : 0);

export const tripLeft = a => (a && a.trip ? Math.max(0, tripTotal(a) - a.trip.t) : 0);

export const isBusy = m => !!(m && m.action && m.action.trip && tripPhase(m.action) !== "done");

// where on the map a traveller is (f: 0..1 along home→target)
export function tripPos(a) {
  const t = a.trip,
    h = MP().home,
    p = ptOf(a.target);
  let f = t.t < t.out ? t.t / t.out : t.t < t.out + t.task ? 1 : Math.max(0, 1 - (t.t - t.out - t.task) / t.back);
  // follow the route's detour points (around mountains and lakes)
  const pts = D.world ? routeOf(a.target, ptOf).pts : [h, p];
  const legs = pts.slice(1).map((q, i) => Math.hypot(q.x - pts[i].x, q.y - pts[i].y)),
    L = legs.reduce((x, y) => x + y, 0);
  let d = f * L;
  for (let i = 0; i < legs.length; i++) {
    if (d <= legs[i] || i === legs.length - 1) {
      const g = legs[i] ? Math.min(1, d / legs[i]) : 1;
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * g, y: pts[i].y + (pts[i + 1].y - pts[i].y) * g, f };
    }
    d -= legs[i];
  }
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
  tutNote(s, "scouted");
  if (first) s.explored.push(ar.id);
  if (D.world) reveal(s, ar.x, ar.y, ar.r * WD().fog.explore);
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
    } else if (sc.type === "location") {
      const l = D.world && WD().locations.find(x => x.id === sc.id);
      if (!l || s.discovered.includes("loc:" + l.id)) continue;
      s.discovered.push("loc:" + l.id);
      found.push(`${WD().locTypes[l.type].icon} ${l.name}`);
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
  if (D.world) locationsDay(s, m.name);
  addRenown(s, m, first ? 3 : 1);
  if (!m.minion) gainXp(s, m, "tracking", T.xpPerDay * 2);
  log(
    s,
    `🧭 ${m.name} explored ${ar.name}${first ? " (fog cleared)" : ""}: ${found.length ? found.join(" · ") : "nothing new"}.`,
  );
  if (found.length && !m.minion)
    chron(s, "discovery", `🔍 ${m.name} explored ${ar.name}: ${found.join(" · ")}`, m.name);
  return found;
}

export const areaSecretsLeft = (s, ar) =>
  ar.secrets.filter(sc => sc.type !== "encounter" && !s.discovered.includes(sc.type + ":" + sc.id)).length;

export const rumorCost = s => Math.round(T.rumorCost * (1 - Math.min(0.5, eff(s, "rumorDiscount"))));

export function rumor(s, regionId) {
  if (s.res.coin < rumorCost(s)) return null;
  const pool = [...D.quests, ...D.nodes].filter(x => x.region === regionId && x.hidden && !s.revealed.includes(x.id));
  s.res.coin -= rumorCost(s);
  gainXp(s, active(s), "etiquette", T.xpPerDay);
  if (rng() < D.minions.rumorRecruitChance && minionRoom(s)) {
    addMinion(s, r(D.minions.types.filter(t => !t.special && t.id !== "refugee")).id, "found through a rumor");
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
