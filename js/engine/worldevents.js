import { findId } from "./lookup.js";
import { gameFx } from "./difficulty.js";
import { season, seasonEvents } from "./seasons.js";
const seasonId = s => season(s).id;
// Random world events: timed town/regional effects on prices, travel risk and gathering.
import { chron } from "./chronicle.js";
import { D, log, rng } from "./state.js";

const CFG = () => D.events || { chancePerDay: 0, maxActive: 0, types: [] };

export const eventType = id => CFG().types.find(t => t.id === id);

export const activeEvents = s => (s.wevents || []).filter(e => e.until > s.day);

export const placeName = e =>
  ((e.scope === "town" ? D.towns : D.regions).find(x => x.id === e.place) || {}).name || e.place;

export const eventText = e => eventType(e.type).text.replace("{place}", placeName(e)).replace("{res}", e.res || "goods");
// R39: shortage/glut events pick one good: "wants" = what the town wants (falls back to anything it buys), "produces" = what it makes
export function pickRes(t, place) {
  const town = findId(D.towns, place) || {};
  let pool = town[t.pick] || [];
  if (!pool.length) pool = Object.keys(town.prices || {});
  return pool.length ? pool[Math.floor(rng() * pool.length)] : null;
}

export const townRegion = townId => (findId(D.towns, townId) || {}).region;

export const eventsAtTown = (s, townId) =>
  activeEvents(s).filter(
    e => (e.scope === "town" && e.place === townId) || (e.scope === "region" && e.place === townRegion(townId)),
  );

export const eventsInRegion = (s, region) =>
  activeEvents(s).filter(e => (e.scope === "region" ? e.place === region : townRegion(e.place) === region));

export function startEvent(s, typeId, place, days, res) {
  const t = eventType(typeId);
  if (!s.wevents) s.wevents = [];
  const len = days || t.days[0] + Math.floor(rng() * (t.days[1] - t.days[0] + 1));
  const e = { type: typeId, scope: t.scope, place, from: s.day, until: s.day + len };
  if (t.pick) e.res = res || pickRes(t, place); // R39: optional field, old saves load unchanged
  s.wevents.push(e);
  const msg = `${t.icon} ${eventText(e)} (${len} days).`;
  log(s, msg);
  chron(s, "event", msg);
  return e;
}

export function eventsDay(s) {
  if (!s.wevents) s.wevents = [];
  for (const e of s.wevents.filter(x => x.until <= s.day))
    log(s, `${eventType(e.type).icon} ${eventType(e.type).name} in ${placeName(e)} has ended.`);
  s.wevents = s.wevents.filter(x => x.until > s.day);
  if (s.wevents.length >= CFG().maxActive || rng() >= CFG().chancePerDay * seasonEvents(s)) return;
  const sid = (D.seasons ? seasonId(s) : null);
  const types = CFG().types.filter(t => !t.season || !sid || t.season.includes(sid));
  const w = types.map(t => (t.bad ? gameFx(s, "events") : 1) * (t.weight ?? 1)); // bad events weighted by difficulty; R49 rare ones carry `weight`
  let x = rng() * w.reduce((a, b) => a + b, 0);
  const t = types.find((_, i) => (x -= w[i]) < 0) || types[types.length - 1];
  if (!t) return;
  const pool = (t.scope === "town" ? D.towns : D.regions.filter(r => !r.future)).filter(
    x => (!t.regions || t.regions.includes(t.scope === "town" ? x.region : x.id)) && (!t.towns || t.towns.includes(x.id)),
  ); // R49: `towns` pins a town event to these towns (the Lodge procession: Saltmere)
  if (!pool.length) return;
  const place = pool[Math.floor(rng() * pool.length)].id;
  if (s.wevents.some(x => x.place === place && (x.type === t.id || (t.group && (eventType(x.type) || {}).group === t.group)))) return; // R39: one shortage/glut per town
  startEvent(s, t.id, place);
}

const prod = (list, f) => list.reduce((a, e) => a * f(eventType(e.type).effects), 1);
const sum = (list, f) => list.reduce((a, e) => a + f(eventType(e.type).effects), 0);

export const priceMult = (s, townId, res) =>
  eventsAtTown(s, townId).reduce((a, e) => a * ((eventType(e.type).effects.price || {})[res] || 1) * (e.res === res ? eventType(e.type).effects.resPrice || 1 : 1), 1);
export const buyMult = (s, townId) => prod(eventsAtTown(s, townId), x => x.buyMult || 1);
export const sellMult = (s, townId) => prod(eventsAtTown(s, townId), x => x.sellMult || 1);
export const travelRisk = (s, region) => sum(eventsInRegion(s, region), x => x.travelRisk || 0);
export const gatherMult = (s, region) => prod(eventsInRegion(s, region), x => x.gather || 1);
export const eventMult = (s, region, key) => prod(eventsInRegion(s, region), x => x[key] || 1);

// R49 (Saltmere) a closed market (Lodge procession), reef fog on the coast fishing spots (+ an odd catch)
export const marketClosed = (s, townId) => !!s && eventsAtTown(s, townId).some(e => (eventType(e.type).effects || {}).closed);
export const coastFishMult = s => activeEvents(s).reduce((a, e) => a * ((eventType(e.type).effects || {}).coastFish || 1), 1);
export function oddCatch(s, amt) {
  const p = activeEvents(s).reduce((a, e) => a + ((eventType(e.type).effects || {}).oddCatch || 0), 0);
  if (p > 0 && rng() < p * Math.min(3, amt)) {
    s.res.pearls = (s.res.pearls || 0) + 1;
    log(s, "🌫️ Something odd came up in the fog-net: a pale fish with too-round eyes, and a pearl in its throat.");
    return true;
  }
  return false;
}

