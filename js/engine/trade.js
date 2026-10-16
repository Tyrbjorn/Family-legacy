import { gameFx, gameLvl } from "./difficulty.js";
import { pathLen } from "./world-route.js";
import { tutNote } from "./tutorial.js";
import { fight, fighter } from "./combat.js";
// Trade round: trade buildings (Warehouse > Trading Post > Counting House), route slots, carts with crew
// (driver + guard + Horseman escorts), estate-town and town-town routes, auto-trade rules, bandit fights,
// road patrols, and per-town supply drift (prices: inventory.js).
import { baseSupply, marketOf, shiftSupply, townBuyPrice, townSellPrice } from "./inventory.js";
import { distTo, ptOf, townKnown, travelDays } from "./map.js";
import { minionGearMult, minionLvlMult, mtype } from "./minions.js";
import { famFx } from "./paths.js";
import { eff, structDef, wagonSpeed } from "./estate.js";
import { registerDayHook } from "./time.js";
import { D, T, living, log, rng } from "./state.js";
import { LG, addRenown } from "./legacy.js";
import { haulTier } from "./world.js";
import { nightShare } from "./daynight.js";

export const TC = () => T.trade;
export const TRADE_BUILDINGS = ["warehouse", "tradingpost", "countinghouse"];
export const HOME = "estate";

export function tradeInit(s) {
  s.trade = s.trade || {};
  s.trade.supply = s.trade.supply || {};
  s.trade.routes = s.trade.routes || [];
  s.trade.patrols = s.trade.patrols || [];
  s.trade.nextId = s.trade.nextId || 1;
  return s.trade;
}

export const tradeTier = s => Math.max(0, ...(s.structures || []).map(st => TRADE_BUILDINGS.indexOf(st.type) + 1));

const bestHaggle = s => Math.max(0, ...living(s).map(m => (m.skills && m.skills.haggling ? m.skills.haggling.lvl : 0)));
const stewards = s =>
  living(s).filter(m => (m.paths || []).some(p => p.id === "scribe" && (TC().stewardSpecs || []).includes(p.spec))).length;
const factors = s => (s.minions || []).filter(mi => (TC().slotClasses || []).includes(mi.cls)).length;

export function routeSlotParts(s) {
  const tier = tradeTier(s);
  if (!tier) return { building: 0, manor: 0, upgrades: 0, haggling: 0, steward: 0, merchants: 0, total: 0 };
  const parts = {
    building: TC().slotsByTier[tier - 1],
    upgrades: (s.structures || [])
      .filter(st => TRADE_BUILDINGS.includes(st.type))
      .reduce((a, st) => a + (structDef(st.type).upgrades || []).slice(0, st.up || 0).reduce((b, u) => b + (u.routes || 0), 0), 0),
    haggling: Math.min(TC().haggleSlotMax, Math.floor(bestHaggle(s) / TC().haggleLvlPerSlot)),
    steward: Math.min(TC().stewardSlotMax, stewards(s)),
    merchants: Math.min(TC().merchantSlotMax, factors(s)),
    manor: Math.floor(eff(s, "routeSlots")),
  };
  parts.total = parts.building + parts.manor + parts.upgrades + parts.haggling + parts.steward + parts.merchants;
  return parts;
}
export const routeSlots = s => routeSlotParts(s).total;

export const tradeTowns = s => D.towns.filter(t => townKnown(s, t));
export const tradePlace = id => (id === HOME ? "Estate" : (D.towns.find(t => t.id === id) || { name: id }).name);
const minion = (s, uid) => (s.minions || []).find(x => x.uid === uid);

// ---- roads: estate legs use the map's road time; town-to-town legs scale straight distance by the
// average road-time-per-distance of the known towns.
const daysPerDist = () => {
  const ts = D.towns.map(t => travelDays(t.id) / Math.max(1, distTo(t.id)));
  return ts.reduce((a, b) => a + b, 0) / ts.length;
};
export function legDays(a, b) {
  if (a === b) return 0;
  if (a === HOME) return travelDays(b);
  if (b === HOME) return travelDays(a);
  // town to town: length of the detoured path (around mountains, and lakes without a boat)
  return Math.round(Math.max(D.map.minTravel, pathLen(ptOf(a), ptOf(b)) * daysPerDist()) * 10) / 10;
}
export const segKey = (a, b) => [a, b].sort().join("~");

// ---- crew, patrols and bandits
export const driverEdge = mi => (mi ? TC().driverEdge[mi.cls] || 0 : 0);
export const guardPow = mi => (mi ? (mtype(mi.type).apt.guard || 1) * minionGearMult(mi, "guard") * minionLvlMult(mi, "guard") : 0);
export const isEscort = mi => !!mi && (TC().escortClasses || []).includes(mi.cls);
export const crewPower = (s, r) => guardPow(minion(s, r.guard)) + (r.escorts || []).reduce((a, u) => a + guardPow(minion(s, u)), 0);
export const patrolPower = (s, key) =>
  (s.trade.patrols || []).filter(p => p.seg === key).reduce((a, p) => a + p.members.reduce((b, u) => b + guardPow(minion(s, u)), 0), 0);
// risk of a bandit attack on one road segment: guards and escorts deter, patrols on that road deter
export const segRisk = (s, r, a, b) =>
  (TC().banditBase * gameFx(s, "bandit") * Math.max(0, 1 - eff(s, "banditCut"))) / (1 + crewPower(s, r) * TC().guardDeter + patrolPower(s, segKey(a, b)) * TC().patrolDeter);
// roads a loaded cart travels (where bandits can strike)
export const cargoLegs = r => (r.from && r.from !== HOME ? [[r.from, r.town], [r.town, HOME]] : [[HOME, r.town]]);
export const banditChance = (s, r) => 1 - cargoLegs(r).reduce((a, [x, y]) => a * (1 - segRisk(s, r, x, y)), 1);
// chance the crew beats the bandits once attacked
// rough chance the crew wins a bandit fight (the combat calibration: r − 0.5 with r = (crew+20)/(bandits+20))
export const winChance = (s, r) => {
  const p = crewPower(s, r);
  return p ? Math.max(0.05, Math.min(0.95, (p * TC().fightScale + 20) / (TC().banditStrength * TC().fightScale + 20) - 0.5)) : 0;
};

export function routeIssue(s, r) {
  if (!tradeTier(s)) return "needs a Warehouse";
  const known = id => id === HOME || D.towns.some(t => t.id === id && townKnown(s, t));
  if (!known(r.town) || !known(r.from || HOME)) return "unknown town";
  if (r.from && r.from !== HOME) {
    if (r.from === r.town) return "same town";
    if (!marketOf(r.from).includes(r.res)) return "start town doesn't sell that";
    if (!(D.towns.find(t => t.id === r.town).prices || {})[r.res]) return "town doesn't buy that";
    return null;
  }
  if (!["sell", "buy"].includes(r.mode)) return "bad mode";
  if (r.mode === "buy" && !marketOf(r.town).includes(r.res)) return "town doesn't sell that";
  if (r.mode === "sell" && !(D.towns.find(t => t.id === r.town).prices || {})[r.res]) return "town doesn't buy that";
  return null;
}

// mode: "sell" | "buy" (estate ↔ town) or "haul" (buy at `from`, sell at `town`)
export function addRoute(s, town, mode, res, from = HOME) {
  tradeInit(s);
  if (s.trade.routes.length >= routeSlots(s)) return null;
  const r = {
    id: "r" + s.trade.nextId++,
    from: mode === "haul" ? from : HOME,
    town,
    mode,
    res,
    qty: TC().defaultQty,
    keep: mode === "sell" ? TC().defaultKeep : 0,
    below: mode === "buy" ? TC().defaultBelow : 0,
    margin: mode === "haul" ? TC().defaultMargin : 0,
    maxPrice: 0,
    auto: true,
    driver: null,
    guard: null,
    escorts: [],
    trip: null,
  };
  if (routeIssue(s, r)) return null;
  s.trade.routes.push(r);
  log(s, `🧾 New trade route: ${routeLabel(r)}.`);
  return r;
}
export const routeLabel = r =>
  r.mode === "haul" ? `${r.res} ${tradePlace(r.from)} → ${tradePlace(r.town)}` : `${r.mode} ${r.res} at ${tradePlace(r.town)}`;

// pull a follower off every trade/patrol duty
function release(s, uid, job = "idle") {
  for (const x of s.trade.routes) {
    if (x.driver === uid) x.driver = null;
    if (x.guard === uid) x.guard = null;
    x.escorts = (x.escorts || []).filter(u => u !== uid);
  }
  for (const p of s.trade.patrols) p.members = p.members.filter(u => u !== uid);
  const mi = minion(s, uid);
  if (mi && (mi.job === "trade" || mi.job === "patrol")) mi.job = job;
}

export function removeRoute(s, id) {
  const r = s.trade.routes.find(x => x.id === id);
  if (!r) return false;
  for (const u of [r.driver, r.guard, ...(r.escorts || [])]) if (u) release(s, u);
  s.trade.routes = s.trade.routes.filter(x => x !== r);
  return true;
}

// role: driver | guard | escort. Assigning pulls the follower off their old job.
export function setCrew(s, id, role, uid) {
  const r = s.trade.routes.find(x => x.id === id);
  const mi = uid ? minion(s, uid) : null;
  if (!r || (uid && !mi)) return false;
  if (role === "escort" && (!mi || !isEscort(mi) || (r.escorts || []).length >= TC().maxEscorts)) return false;
  if (uid) release(s, uid);
  if (role === "driver" || role === "guard") {
    if (r[role]) release(s, r[role]);
    r[role] = uid || null;
  } else if (role === "escort") r.escorts = [...(r.escorts || []), uid];
  if (mi) mi.job = "trade";
  return true;
}

// ---- patrols: followers guarding one road (estate–town or town–town)
export function addPatrol(s, a, b) {
  tradeInit(s);
  const seg = segKey(a, b);
  if (a === b || s.trade.patrols.some(p => p.seg === seg)) return null;
  const p = { id: "p" + s.trade.nextId++, seg, a, b, members: [] };
  s.trade.patrols.push(p);
  return p;
}
export function setPatrol(s, pid, uid) {
  const p = s.trade.patrols.find(x => x.id === pid),
    mi = minion(s, uid);
  if (!p || !mi || p.members.length >= TC().maxPatrol) return false;
  release(s, uid);
  p.members.push(uid);
  mi.job = "patrol";
  return true;
}
export function removePatrol(s, pid) {
  const p = s.trade.patrols.find(x => x.id === pid);
  if (!p) return false;
  for (const u of [...p.members]) release(s, u);
  s.trade.patrols = s.trade.patrols.filter(x => x !== p);
  return true;
}

export const cartCarry = s => haulTier(s).carry;

// auto-trade rule check: does this route want to run now?
export function routeWants(s, r) {
  if (!r.driver || !r.auto || routeIssue(s, r) || driverIssue(minion(s, r.driver))) return false;
  if (r.mode === "haul") {
    const buy = townBuyPrice(s, r.from, r.res);
    return townSellPrice(s, r.town, r.res) >= buy * (1 + r.margin) && s.res.coin >= buy;
  }
  if (r.mode === "sell") return (s.res[r.res] || 0) - r.keep >= 1;
  const p = townBuyPrice(s, r.town, r.res);
  return (s.res[r.res] || 0) < r.below && (!r.maxPrice || p <= r.maxPrice) && s.res.coin >= p;
}

// A trip is a list of stops; each stop has the day it is reached and what happens there.
function startTrip(s, r) {
  const n = Math.min(r.qty, cartCarry(s));
  let load = 0;
  if (r.mode === "sell") {
    load = Math.floor(Math.min(n, (s.res[r.res] || 0) - r.keep));
    if (load <= 0) return;
    s.res[r.res] -= load;
  }
  const path = r.mode === "haul" ? [HOME, r.from, r.town, HOME] : [HOME, r.town, HOME];
  let d = 0;
  const stops = [];
  for (let i = 1; i < path.length; i++) {
    d += legDays(path[i - 1], path[i]) / wagonSpeed(s);
    stops.push({ at: path[i], day: Math.round(d * 10) / 10, from: path[i - 1] });
  }
  r.trip = { t: 0, stops, step: 0, load, coin: 0, total: stops[stops.length - 1].day };
}

// follower convoy leader: class edge plus a little per level (capped); low loyalty refuses or skims
export const driverLvlEdge = mi => (mi ? Math.min(TC().driverLvlEdgeMax || 0, ((mi.lvl || 1) - 1) * (TC().driverLvlEdge || 0)) : 0);
export const driverIssue = mi => (mi && (mi.loyalty ?? 100) < (TC().driverMinLoyalty || 0) ? `loyalty under ${TC().driverMinLoyalty}: won't lead` : null);
export const driverSkim = mi => (mi && (mi.loyalty ?? 100) < (TC().skimBelow || 0) ? TC().skimCut || 0 : 0);
const edgeOf = (s, r) => 1 + driverEdge(minion(s, r.driver)) + driverLvlEdge(minion(s, r.driver)) + famFx(s, "trade");

// bandits may strike a cart that is carrying goods or coin on this road
function banditCheck(s, r, a, b) {
  if (!r.trip.load && !r.trip.coin) return;
  // the ambush hour is random; at night Lanterns cut the risk
  const night = rng() < nightShare();
  if (rng() >= segRisk(s, r, a, b) * (night ? 1 - Math.min(0.9, eff(s, "nightBanditCut")) : 1)) return;
  const road = `${tradePlace(a)}–${tradePlace(b)}`;
  // turn-based fight: the guard leads, escorts follow; the driver stays with the cart
  const crew = [r.guard, ...(r.escorts || [])].map(u => minion(s, u)).filter(Boolean);
  const A = crew.map((mi, i) => Object.assign(fighter(mi.name, guardPow(mi) * TC().fightScale, { leader: !i }), { mi })),
    B = Array.from({ length: TC().banditCount }, (_, i) => fighter("bandit " + (i + 1), (TC().banditStrength * TC().fightScale) / TC().banditCount));
  const res = A.length ? fight(s, A, B, { lvl: gameLvl(s) }) : { result: "defeat", rounds: 1 };
  if (res.result === "win") {
    r.won = (r.won || 0) + 1;
    addRenown(s, null, LG().renown.convoyWin || 0);
    log(s, `⚔️ Bandits hit the ${routeLabel(r)} cart on the ${road} road; the guards drove them off after round ${res.rounds}.`);
    return;
  }
  r.robbed = (r.robbed || 0) + 1;
  r.trip.load = 0;
  r.trip.coin = 0;
  const lost = [];
  for (const f of A) {
    const mi = f.mi;
    release(s, mi.uid);
    if (f.out === "down" && rng() < TC().guardDieChance) {
      s.minions = s.minions.filter(x => x !== mi);
      lost.push(`${mi.name} was killed`);
    } else {
      mi.loyalty = Math.max(1, (mi.loyalty || 100) - TC().fleeLoyaltyLoss);
      lost.push(`${mi.name} ${f.out === "down" ? "was beaten" : "fled"}`);
    }
  }
  lost.push(`${res.result === "withdraw" ? "gave up" : "fight ended"} after round ${res.rounds}`);
  log(s, `🏴‍☠️ Bandits robbed the ${routeLabel(r)} cart on the ${road} road${lost.length ? " (" + lost.join(", ") + ")" : ""}.`);
}

function atStop(s, r, st) {
  const tr = r.trip;
  banditCheck(s, r, st.from, st.at);
  const edge = edgeOf(s, r);
  if (st.at === HOME) return;
  if (r.mode === "haul" && st.at === r.from) {
    const p = townBuyPrice(s, r.from, r.res) / edge;
    const n = Math.floor(Math.min(r.qty, cartCarry(s), s.res.coin / p));
    if (n > 0) {
      s.res.coin -= Math.round(n * p);
      shiftSupply(s, r.from, r.res, -n);
    }
    tr.load = n;
    tr.spent = Math.round(n * p);
  } else if (st.at === r.town && (r.mode === "sell" || r.mode === "haul")) {
    tr.coin = Math.round(tr.load * townSellPrice(s, r.town, r.res) * edge);
    shiftSupply(s, r.town, r.res, tr.load);
    tr.sold = tr.load;
    tr.load = 0;
  } else if (st.at === r.town && r.mode === "buy") {
    const p = townBuyPrice(s, r.town, r.res) / edge;
    const want = Math.max(0, r.below - (s.res[r.res] || 0)) || r.qty;
    const n = Math.floor(Math.min(r.qty, cartCarry(s), s.res.coin / p, want));
    if (n > 0) {
      s.res.coin -= Math.round(n * p);
      shiftSupply(s, r.town, r.res, -n);
    }
    tr.load = n;
  }
}

function finish(s, r) {
  const tr = r.trip;
  const dv = minion(s, r.driver);
  if (tr.coin && driverSkim(dv)) {
    const cut = Math.round(tr.coin * driverSkim(dv));
    tr.coin -= cut;
    log(s, `🫳 ${dv.name} pocketed ${cut}🪙 of the takings (loyalty ${Math.round(dv.loyalty)}).`);
  }
  if (dv) dv.loyalty = Math.min(100, (dv.loyalty ?? 100) + (TC().runLoyalty || 0));
  tutNote(s, "traded");
  if (tr.coin) {
    s.res.coin += tr.coin;
    log(s, `🛒 Cart home (${routeLabel(r)}): sold ${tr.sold} for ${tr.coin}🪙${tr.spent ? ` (paid ${tr.spent}🪙)` : ""}.`);
  } else if (r.mode === "buy" && tr.load) {
    s.res[r.res] = (s.res[r.res] || 0) + tr.load;
    log(s, `🛒 Cart home from ${tradePlace(r.town)} with ${tr.load} ${r.res}.`);
  }
  r.trips = (r.trips || 0) + 1;
  r.trip = null;
}

// Supply drifts back to each town's resting level: towns consume gluts and restock shortages.
function supplyDay(s) {
  for (const [tid, sp] of Object.entries(s.trade.supply))
    for (const k of Object.keys(sp)) {
      const b = baseSupply(tid, k);
      sp[k] += (b - sp[k]) * TC().recovery;
      if (Math.abs(sp[k] - b) < 0.005) delete sp[k];
    }
}

export function tradeDay(s) {
  tradeInit(s);
  supplyDay(s);
  const on = (u, job) => (minion(s, u) || {}).job === job;
  for (const p of s.trade.patrols) p.members = p.members.filter(u => on(u, "patrol"));
  for (const r of s.trade.routes) {
    for (const k of ["driver", "guard"]) if (r[k] && !on(r[k], "trade")) r[k] = null;
    r.escorts = (r.escorts || []).filter(u => on(u, "trade"));
    if (!r.trip) {
      if (routeWants(s, r)) startTrip(s, r);
      continue;
    }
    if (!r.driver) continue; // stalled until a driver is assigned
    r.trip.t += 1;
    while (r.trip && r.trip.step < r.trip.stops.length && r.trip.t >= r.trip.stops[r.trip.step].day) {
      atStop(s, r, r.trip.stops[r.trip.step]);
      r.trip.step++;
    }
    if (r.trip.step >= r.trip.stops.length) finish(s, r);
  }
}

registerDayHook("trade", tradeDay);
