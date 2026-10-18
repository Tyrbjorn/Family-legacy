import { findId } from "./lookup.js";
// R39: base-game supply & demand made visible. Read-only helpers: price tags, town Short/Flooded tags
// and the Market Board. No state of its own (shortage/glut events live in s.wevents, see worldevents.js).
import { D, T } from "./state.js";
import { marketOf, sellDemand, buyDemand, townSellPrice, townBuyPrice, baseSupply, townSupply } from "./inventory.js";
import { priceMult, eventsAtTown, eventType } from "./worldevents.js";
import { townKnown, regionOpen, travelDays } from "./map.js";

const MK = () => T.market || {};
const town = id => findId(D.towns, id) || {};

// How a town's price compares to normal (supply 1, no events). Player bonuses (house, patron, talents) don't count.
export const marketRatio = (s, townId, res, side = "sell") =>
  (side === "buy" ? buyDemand(s, townId, res) * Math.max(1, priceMult(s, townId, res)) : sellDemand(s, townId, res) * priceMult(s, townId, res));

export function priceTag(s, townId, res, side = "sell") {
  const r = marketRatio(s, townId, res, side);
  const level = r >= (MK().highAt || 1.15) ? "high" : r <= (MK().lowAt || 0.85) ? "low" : "normal";
  return { level, ratio: r, arrow: level === "high" ? "▲" : level === "low" ? "▼" : "", tip: priceTip(s, townId, res, level) };
}

// plain-language reason for the tag
export function priceTip(s, townId, res, level) {
  const t = town(townId),
    ev = eventsAtTown(s, townId).find(e => e.res === res);
  if (level === "normal") return `${t.name}: normal price for ${res}`;
  if (ev) return `${t.name} ${eventType(ev.type).id === "shortage" ? "is short of" : "is flooded with"} ${res} (${ev.until - s.day}d left)`;
  const sup = townSupply(s, townId, res),
    base = baseSupply(townId, res);
  if (level === "high") {
    if (sup < base - 0.05) return `${t.name} is running low on ${res} (people bought it up); recovers in ~${recoverDays(sup, base)} days`;
    if ((t.wants || []).includes(res)) return `${t.name} pays well for ${res} (they want it)`;
    return `${t.name} pays well for ${res} right now`;
  }
  if (sup > base + 0.05) return `Flooded: lots of ${res} sold here; recovers in ~${recoverDays(sup, base)} days`;
  if ((t.produces || []).includes(res)) return `${t.name} makes ${res}, so it's cheap here`;
  return `${t.name} pays little for ${res} right now`;
}
// days until supply drifts back to within 0.1 of its resting level (daily recovery closes a % of the gap)
export const recoverDays = (sup, base) => {
  const rec = (T.trade || {}).recovery || 0.05, gap = Math.abs(sup - base);
  return gap <= 0.1 ? 1 : Math.ceil(Math.log(0.1 / gap) / Math.log(1 - rec));
};

export const knownTowns = s => D.towns.filter(t => regionOpen(s, t.region) && townKnown(s, t));

// "Short of" / "Flooded with" tags for one town: goods it trades whose price is high / low now
export function townTags(s, townId) {
  const t = town(townId),
    goods = [...new Set([...Object.keys(t.prices || {}), ...marketOf(townId)])],
    max = MK().tagMax || 3;
  const rows = goods.map(res => ({ res, ...priceTag(s, townId, res) })).filter(x => (t.prices || {})[x.res]);
  return {
    short: rows.filter(x => x.level === "high").sort((a, b) => b.ratio - a.ratio).slice(0, max),
    flooded: rows.filter(x => x.level === "low").sort((a, b) => a.ratio - b.ratio).slice(0, max),
  };
}

// Market Board: best known town to sell each good you hold, and the cheapest known town to buy each market good
export function marketBoard(s) {
  const towns = knownTowns(s);
  const sell = [],
    buy = [];
  const held = Object.keys(s.res || {}).filter(k => k !== "coin" && k !== "food" && (s.res[k] || 0) >= 1);
  for (const res of held) {
    const opts = towns.filter(t => (t.prices || {})[res]).map(t => ({ town: t.id, price: townSellPrice(s, t.id, res) }));
    if (!opts.length) continue;
    const best = opts.sort((a, b) => b.price - a.price)[0];
    sell.push({ res, have: s.res[res], ...best, value: best.price * s.res[res], days: travelDays(best.town), tag: priceTag(s, best.town, res) });
  }
  const goods = [...new Set(towns.flatMap(t => marketOf(t.id)))];
  for (const res of goods) {
    const opts = towns.filter(t => marketOf(t.id).includes(res) && (t.prices || {})[res]).map(t => ({ town: t.id, price: townBuyPrice(s, t.id, res) }));
    if (!opts.length) continue;
    const best = opts.sort((a, b) => a.price - b.price)[0];
    buy.push({ res, ...best, days: travelDays(best.town), tag: priceTag(s, best.town, res, "buy") });
  }
  sell.sort((a, b) => b.value - a.value);
  buy.sort((a, b) => a.tag.ratio - b.tag.ratio || a.price - b.price);
  return { sell, buy, rows: MK().boardRows || 8 };
}
