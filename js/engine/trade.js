// Trade round: trade buildings (Warehouse > Trading Post > Counting House), route slots, carts with crew
// (driver + guard + optional Horseman escorts), auto-trade rules, bandits, and per-town supply drift.
import { marketOf, shiftSupply, townBuyPrice, townSellPrice } from "./inventory.js";
import { townKnown, travelDays } from "./map.js";
import { minionGearMult, minionLvlMult, mtype } from "./minions.js";
import { famFx } from "./paths.js";
import { structDef } from "./estate.js";
import { registerDayHook } from "./time.js";
import { D, T, living, log, rng } from "./state.js";
import { haulTier } from "./world.js";

export const TC = () => T.trade;
export const TRADE_BUILDINGS = ["warehouse", "tradingpost", "countinghouse"];

export function tradeInit(s) {
  s.trade = s.trade || {};
  s.trade.supply = s.trade.supply || {};
  s.trade.routes = s.trade.routes || [];
  s.trade.nextId = s.trade.nextId || 1;
  return s.trade;
}

// highest trade building tier built (0 = none)
export const tradeTier = s =>
  Math.max(0, ...(s.structures || []).map(st => TRADE_BUILDINGS.indexOf(st.type) + 1));

const bestHaggle = s => Math.max(0, ...living(s).map(m => (m.skills && m.skills.haggling ? m.skills.haggling.lvl : 0)));
const stewards = s =>
  living(s).filter(m => (m.paths || []).some(p => p.id === "scribe" && (TC().stewardSpecs || []).includes(p.spec))).length;
const factors = s => (s.minions || []).filter(mi => (TC().slotClasses || []).includes(mi.cls)).length;

export function routeSlotParts(s) {
  const tier = tradeTier(s);
  if (!tier) return { building: 0, haggling: 0, steward: 0, merchants: 0, upgrades: 0, total: 0 };
  const parts = {
    building: TC().slotsByTier[tier - 1],
    haggling: Math.min(TC().haggleSlotMax, Math.floor(bestHaggle(s) / TC().haggleLvlPerSlot)),
    steward: Math.min(TC().stewardSlotMax, stewards(s)),
    merchants: Math.min(TC().merchantSlotMax, factors(s)),
    upgrades: (s.structures || [])
      .filter(st => TRADE_BUILDINGS.includes(st.type))
      .reduce((a, st) => a + (structDef(st.type).upgrades || []).slice(0, st.up || 0).reduce((b, u) => b + (u.routes || 0), 0), 0),
  };
  parts.total = parts.building + parts.haggling + parts.steward + parts.merchants + parts.upgrades;
  return parts;
}
export const routeSlots = s => routeSlotParts(s).total;

export const tradeTowns = s => D.towns.filter(t => townKnown(s, t));
const minion = (s, uid) => (s.minions || []).find(x => x.uid === uid);

// driver: merchant-line class sets the price edge; guard/escorts: guard power deters bandits
export const driverEdge = mi => (mi ? (TC().driverEdge[mi.cls] || 0) : 0);
const guardPow = mi => (mi ? (mtype(mi.type).apt.guard || 1) * minionGearMult(mi, "guard") * minionLvlMult(mi, "guard") : 0);
export const isEscort = mi => !!mi && (TC().escortClasses || []).includes(mi.cls);
export function crewPower(s, r) {
  return guardPow(minion(s, r.guard)) + (r.escorts || []).reduce((a, u) => a + guardPow(minion(s, u)), 0);
}
export const banditChance = (s, r) => TC().banditBase / (1 + crewPower(s, r) * TC().guardDeter);

export function routeIssue(s, r) {
  if (!tradeTier(s)) return "needs a Warehouse";
  if (!D.towns.find(t => t.id === r.town && townKnown(s, t))) return "unknown town";
  if (!["sell", "buy"].includes(r.mode)) return "bad mode";
  if (r.mode === "buy" && !marketOf(r.town).includes(r.res)) return "town doesn't sell that";
  if (r.mode === "sell" && !(D.towns.find(t => t.id === r.town).prices || {})[r.res]) return "town doesn't buy that";
  return null;
}

export function addRoute(s, town, mode, res) {
  tradeInit(s);
  if (s.trade.routes.length >= routeSlots(s)) return null;
  const r = { id: "r" + s.trade.nextId++, town, mode, res, qty: TC().defaultQty, keep: mode === "sell" ? TC().defaultKeep : 0, below: mode === "buy" ? TC().defaultBelow : 0, maxPrice: 0, auto: true, driver: null, guard: null, escorts: [], trip: null };
  if (routeIssue(s, r)) return null;
  s.trade.routes.push(r);
  log(s, `🧾 New trade route: ${mode} ${res} at ${D.towns.find(t => t.id === town).name}.`);
  return r;
}

const freeCrew = (s, r, uid) => {
  for (const x of s.trade.routes) {
    if (x.driver === uid) x.driver = null;
    if (x.guard === uid) x.guard = null;
    x.escorts = (x.escorts || []).filter(u => u !== uid);
  }
  const mi = minion(s, uid);
  if (mi && mi.job === "trade") mi.job = "idle";
};

export function removeRoute(s, id) {
  const r = s.trade.routes.find(x => x.id === id);
  if (!r) return false;
  for (const u of [r.driver, r.guard, ...(r.escorts || [])]) if (u) freeCrew(s, r, u);
  s.trade.routes = s.trade.routes.filter(x => x !== r);
  return true;
}

// role: driver | guard | escort. Assigning pulls the follower off their old job.
export function setCrew(s, id, role, uid) {
  const r = s.trade.routes.find(x => x.id === id);
  if (!r) return false;
  const mi = uid ? minion(s, uid) : null;
  if (uid && !mi) return false;
  if (role === "escort" && mi && !isEscort(mi)) return false;
  if (role === "escort" && mi && (r.escorts || []).length >= TC().maxEscorts) return false;
  if (uid) freeCrew(s, r, uid);
  if (role === "driver") {
    if (r.driver) freeCrew(s, r, r.driver);
    r.driver = uid || null;
  } else if (role === "guard") {
    if (r.guard) freeCrew(s, r, r.guard);
    r.guard = uid || null;
  } else if (role === "escort" && uid) r.escorts = [...(r.escorts || []), uid];
  if (mi) mi.job = "trade";
  return true;
}

export const cartCarry = s => haulTier(s).carry;

// auto-trade rule check: does this route want to run now?
export function routeWants(s, r) {
  if (!r.driver || !r.auto || routeIssue(s, r)) return false;
  if (r.mode === "sell") return (s.res[r.res] || 0) - r.keep >= Math.min(r.qty, 1);
  const p = townBuyPrice(s, r.town, r.res);
  return (s.res[r.res] || 0) < r.below && (!r.maxPrice || p <= r.maxPrice) && s.res.coin >= p;
}

function startTrip(s, r) {
  const n = Math.min(r.qty, cartCarry(s));
  let load = 0;
  if (r.mode === "sell") {
    load = Math.floor(Math.min(n, (s.res[r.res] || 0) - r.keep));
    if (load <= 0) return;
    s.res[r.res] -= load;
  }
  const days = travelDays(r.town);
  r.trip = { t: 0, out: days, back: days, load, sold: false };
}

function arrive(s, r) {
  const tn = D.towns.find(t => t.id === r.town).name;
  const edge = 1 + driverEdge(minion(s, r.driver)) + famFx(s, "trade");
  if (r.mode === "sell") {
    const coin = Math.round(r.trip.load * townSellPrice(s, r.town, r.res) * edge);
    shiftSupply(s, r.town, r.res, r.trip.load);
    r.trip.coin = coin;
  } else {
    const p = townBuyPrice(s, r.town, r.res) / edge;
    const n = Math.floor(Math.min(r.qty, cartCarry(s), s.res.coin / p, Math.max(0, r.below - (s.res[r.res] || 0)) || r.qty));
    if (n > 0) {
      s.res.coin -= Math.round(n * p);
      shiftSupply(s, r.town, r.res, -n);
    }
    r.trip.load = n;
  }
  if (rng() < banditChance(s, r)) {
    const lost = r.mode === "sell" ? "the coin" : "the goods";
    log(s, `🏴‍☠️ Bandits robbed the ${tn} cart and took ${lost}.`);
    r.trip.coin = 0;
    r.trip.load = 0;
    r.robbed = (r.robbed || 0) + 1;
  } else if (crewPower(s, r) > 0 && rng() < TC().banditBase) r.scared = (r.scared || 0) + 1;
}

function finish(s, r) {
  const tn = D.towns.find(t => t.id === r.town).name;
  if (r.mode === "sell" && r.trip.coin) {
    s.res.coin += r.trip.coin;
    log(s, `🛒 Cart back from ${tn}: sold ${r.trip.load} ${r.res} for ${r.trip.coin}🪙.`);
  } else if (r.mode === "buy" && r.trip.load) {
    s.res[r.res] = (s.res[r.res] || 0) + r.trip.load;
    log(s, `🛒 Cart back from ${tn} with ${r.trip.load} ${r.res}.`);
  }
  r.trips = (r.trips || 0) + 1;
  r.trip = null;
}

// Supply drifts back to normal: towns consume gluts and restock shortages.
function supplyDay(s) {
  for (const sp of Object.values(s.trade.supply))
    for (const k of Object.keys(sp)) {
      sp[k] += (1 - sp[k]) * TC().recovery;
      if (Math.abs(sp[k] - 1) < 0.005) delete sp[k];
    }
}

export function tradeDay(s) {
  tradeInit(s);
  supplyDay(s);
  for (const r of s.trade.routes) {
    for (const k of ["driver", "guard"]) if (r[k] && (minion(s, r[k]) || {}).job !== "trade") r[k] = null;
    r.escorts = (r.escorts || []).filter(u => (minion(s, u) || {}).job === "trade");
    if (!r.trip) {
      if (routeWants(s, r)) startTrip(s, r);
      continue;
    }
    if (!r.driver) continue; // stalled until a driver is assigned
    r.trip.t += 1;
    if (!r.trip.sold && r.trip.t >= r.trip.out) {
      r.trip.sold = true;
      arrive(s, r);
    }
    if (r.trip.t >= r.trip.out + r.trip.back) finish(s, r);
  }
}

registerDayHook("trade", tradeDay);
