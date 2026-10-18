// R48 the coast: Gull's Landing as a port town, town visits, the Sea Boat (Dock → Slipway) and the harbour ferry.
// Data: world.json routing.sea (port, sea speed, ferry fare and routes), haul tier `coast`, towns.json coast/port,
// quests `coastal`. A Sea Boat (or the ferry, paid per trip) sails from the port to a coastal destination instead of
// walking the coast; R49: the Saltmere route serves the Saltmere Coast once it is found (ferryRouteFor).
import { D, log } from "./state.js";
import { findId } from "./lookup.js";
import { townKnown, ptOf, travelDays, regionKnown } from "./map.js";
import { WD, ownsVehicle, regionAt, terrainAt, terrainDef } from "./world.js";
import { perkCargo, perkFerry } from "./families.js";

// ---- towns: known (found + seen) and visited (someone traded or worked there: villagers there take deliveries)
export const townKnownId = (s, id) => {
  const t = findId(D.towns, id);
  return !!t && townKnown(s, t);
};
export function markVisited(s, townId) {
  if (!townId || !findId(D.towns, townId)) return;
  const v = (s.townsVisited = s.townsVisited || []);
  if (!v.includes(townId)) v.push(townId);
}
export const visited = (s, townId) => (s.townsVisited || []).includes(townId);
// a building of this type or anything upgraded from it (a Slipway is still a Dock)
export function hasStructType(s, type) {
  const S = (D.estate && D.estate.structures) || [];
  const isA = (t, n = 0) => !!t && n < 12 && (t === type || isA((S.find(x => x.id === t) || {}).upgradeFrom, n + 1));
  return (s.structures || []).some(st => isA(st.type));
}

// ---- sea
export const SEA = () => (D.world && WD().routing && WD().routing.sea) || null;
export const hasSeaBoat = s => !!SEA() && ownsVehicle(s, SEA().item).length > 0;
export const portTown = () => SEA() && findId(D.towns, SEA().port);
// coastal: flagged in data (quest/node `coastal`, town `coast`) or standing on sea-going terrain (coast)
export function isCoastal(id) {
  const x = [...D.quests, ...D.nodes].find(q => q.id === id) || findId(D.towns, id);
  if (x && (x.coastal || x.coast)) return true;
  const p = D.world && ptOf(id);
  return !!p && !!terrainDef(terrainAt(p.x, p.y)).sea;
}
const portPt = () => (SEA() ? D.map.towns[SEA().port] : null);
export const seaDist = id => {
  const a = portPt(), b = ptOf(id);
  return a && b ? Math.hypot(b.x - a.x, b.y - a.y) : Infinity;
};
// land to the port, then sail along the coast
export function seaDays(id) {
  const p = portPt();
  if (!p) return { land: Infinity, sea: Infinity };
  return { land: travelDays(SEA().port), sea: Math.round((seaDist(id) / (WD().baseSpeed * SEA().speed)) * 10) / 10 };
}
// the harbour ferry: opened by the Act 1 beat; fare per trip, cheaper with Odile's pass and House Corwen
const FERRY = () => (SEA() || {}).ferry || null;
export const ferryOpen = s => !!FERRY() && (s.unlocks || []).includes(FERRY().unlock);
export const ferryDisc = s => Math.min(0.6, (s.reqPerks || []).filter(p => p.type === "ferry").reduce((a, p) => a + p.pct, 0) + perkFerry(s));
export const ferryFare = (s, seaLeg = 0) => (FERRY() ? Math.max(1, Math.round((FERRY().fare + FERRY().farePerDay * seaLeg) * (1 - ferryDisc(s)))) : 0);
// R49: a route with a region sails once that region is found (the Saltmere route: the Saltmere Coast)
export const ferryRoutes = s => ((FERRY() || {}).routes || []).map(r => ({ ...r, open: !r.region || (!!findId(D.regions, r.region) && !findId(D.regions, r.region).future && regionKnown(s, r.region)) }));
// the region a destination lies in (data region, else the map)
export function destRegion(id) {
  const x = [...D.quests, ...D.nodes, ...(D.dungeons || [])].find(q => q.id === id) || findId(D.towns, id);
  if (x && x.region) return x.region;
  const p = D.world && ptOf(id);
  return p ? regionAt(p.x, p.y) : null;
}
// the ferry route that serves a destination: its region's own route, else the general coast run
export function ferryRouteFor(s, id) {
  const R = ferryRoutes(s), reg = destRegion(id);
  return R.find(r => r.region && r.region === reg) || R.find(r => !r.region) || null;
}
// the quickest way to a coastal destination: null when walking is as quick or the sea isn't open to you
export function seaOption(s, id, walk = travelDays(id)) {
  if (!s || !SEA() || !isCoastal(id) || id === SEA().port || !townKnownId(s, SEA().port)) return null;
  const d = seaDays(id);
  if (!isFinite(d.sea) || d.land + d.sea >= walk) return null;
  const days = Math.round((d.land + d.sea) * 10) / 10;
  if (hasSeaBoat(s)) return { mode: "boat", days, land: d.land, sea: d.sea, fare: 0, saved: Math.round((walk - days) * 10) / 10 };
  const fr = ferryRouteFor(s, id);
  if (ferryOpen(s) && s.ferryAuto !== false && fr && fr.open) return { mode: "ferry", route: fr.id, days, land: d.land, sea: d.sea, fare: ferryFare(s, d.sea), saved: Math.round((walk - days) * 10) / 10 };
  return null;
}
// called on a trip's first day: the ferry fare is paid then, or the traveller walks after all
export function payFerry(s, m, a) {
  const t = a.trip;
  if (!t || !t.ferry || t.ferryPaid) return true;
  if ((s.res.coin || 0) < t.ferry) {
    t.out = t.walkOut;
    t.back = t.walkBack;
    t.sea = null;
    t.ferry = 0;
    return false;
  }
  s.res.coin -= t.ferry;
  t.ferryPaid = true;
  s.ferryTrips = (s.ferryTrips || 0) + 1;
  if (t.route && t.route !== "coast") (s.ferryRoutesUsed ||= {})[t.route] = (s.ferryRoutesUsed[t.route] || 0) + 1; // R49
  log(s, `${FERRY().icon} ${m.name} took the ${FERRY().name} ${t.route && t.route !== "coast" ? "to " + ((ferryRoutes(s).find(r => r.id === t.route) || {}).name || t.route) : "along the coast"} (${t.ferry} coin).`);
  return true;
}
// coast hauls: the Sea Boat counts as a haul tier when the haul goes to a coast town or a coastal node
export const coastHaul = id => isCoastal(id);
export const seaCargo = (s, tier) => (tier.cargoTier || 0) * perkCargo(s, tier.id); // House Corwen allied: +1 cargo tier
