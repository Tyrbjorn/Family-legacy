// Routes (data/world.json routing): home → point travel time over roads and terrain.
// Mountains and lakes are impassable: a blocked stretch gets a detour point past the zone's edge
// (shorter side), up to routing.maxDetours. A small boat kept at a Dock lets routes cross lakes.
import { D } from "./state.js";
import { WD, inZone, nearestRoad, roadDef, terrainAt, terrainDef } from "./world.js";

const RT = () => WD().routing || { samples: 8, step: 25, margin: 18, maxDetours: 2 };
let _boat = false,
  _rc = {},
  _rcSrc = null;
// boat access changes which routes are open; the route cache is rebuilt when it flips
export function setBoatAccess(on) {
  if (!!on !== _boat) (_boat = !!on), (_rc = {});
}
export const boatAccess = () => _boat;

export const blockedAt = (x, y, boat = _boat) => {
  const t = terrainDef(terrainAt(x, y));
  return !!t.impassable && !(t.boat && boat);
};
const nSamp = (a, b) => Math.max(RT().samples, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / RT().step));
const lerp = (a, b, f) => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
// points along a polyline, about one per step (endpoints excluded)
function samplesOf(pts) {
  const out = [];
  for (let i = 1; i < pts.length; i++) {
    const n = nSamp(pts[i - 1], pts[i]);
    for (let k = 1; k < n; k++) out.push(lerp(pts[i - 1], pts[i], k / n));
  }
  return out;
}
const zoneAt = (x, y) => [...WD().zones].reverse().find(z => inZone(z, x, y) && z.t === terrainAt(x, y));
const center = z => (z.shape === "rect" ? { x: z.x + z.w / 2, y: z.y + z.h / 2 } : { x: z.x, y: z.y });
// half-width of the zone measured along unit vector (nx, ny)
const extent = (z, nx, ny) => (z.shape === "rect" ? (Math.abs(nx) * z.w + Math.abs(ny) * z.h) / 2 : 1 / Math.hypot(nx / z.rx, ny / z.ry));
const plen = pts => pts.slice(1).reduce((d, p, i) => d + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0);
const inMap = p => p.x >= 0 && p.y >= 0 && p.x <= D.map.size.w && p.y <= D.map.size.h;

function detourPoint(a, b, z, boat) {
  const L = Math.hypot(b.x - a.x, b.y - a.y) || 1,
    nx = -(b.y - a.y) / L,
    ny = (b.x - a.x) / L,
    c = center(z);
  let best = null;
  for (const sd of [1, -1])
    for (const extra of [1, 2, 3]) {
      const r = extent(z, nx, ny) + RT().margin * extra,
        w = { x: c.x + sd * nx * r, y: c.y + sd * ny * r };
      if (!inMap(w) || blockedAt(w.x, w.y, boat)) continue;
      const d = Math.hypot(w.x - a.x, w.y - a.y) + Math.hypot(b.x - w.x, b.y - w.y);
      if (!best || d < best.d) best = { w, d };
      break;
    }
  return best && best.w;
}

// polyline from a to b around impassable zones (lakes count as open water when boat is true)
export function pathBetween(a, b, boat = _boat) {
  const pts = [a, b];
  let detours = 0;
  for (; detours < RT().maxDetours; detours++) {
    let hit = null;
    for (let i = 1; i < pts.length && !hit; i++) {
      const n = nSamp(pts[i - 1], pts[i]);
      for (let k = 1; k < n && !hit; k++) {
        const p = lerp(pts[i - 1], pts[i], k / n),
          z = blockedAt(p.x, p.y, boat) && zoneAt(p.x, p.y);
        if (z) hit = { i, z };
      }
    }
    if (!hit) break;
    const w = detourPoint(pts[hit.i - 1], pts[hit.i], hit.z, boat);
    if (!w) break;
    pts.splice(hit.i, 0, w);
  }
  const ss = samplesOf(pts);
  return { pts, detours: pts.length - 2, len: plen(pts), samples: ss, blocked: ss.some(p => blockedAt(p.x, p.y, boat)), boat: boat && ss.some(p => terrainDef(terrainAt(p.x, p.y)).boat) };
}
// with a boat, the shorter of the lake crossing and the walk around
export const pathLen = (a, b) => Math.min(pathBetween(a, b, false).len, _boat ? pathBetween(a, b, true).len : Infinity);

// with a boat both ways are tried and the quicker one kept; on the water a boat moves at routing.boat.speed
export function routeTo(p) {
  const a = routeVia(p, false);
  if (!_boat) return a;
  const b = routeVia(p, true);
  return b.days < a.days ? b : a;
}
function routeVia(p, boat) {
  const h = D.map.home,
    path = pathBetween(h, p, boat),
    dist = path.len;
  const tr = terrainDef(terrainAt(p.x, p.y)),
    wet = t => (boat && t.boat ? { ...t, speed: (RT().boat || {}).speed || t.speed } : t),
    ts = path.samples.length ? path.samples.map(q => wet(terrainDef(terrainAt(q.x, q.y)))) : [tr];
  const avg = k => ts.reduce((a, t) => a + t[k], 0) / ts.length;
  const nr = nearestRoad(p.x, p.y);
  const onRoad = nr && nr.d <= WD().roadSnap ? nr : null;
  const off = onRoad ? Math.min(dist, onRoad.d) : dist,
    on = dist - off;
  const rd = onRoad ? roadDef(onRoad.road.type) : null,
    O = WD().offroad;
  const days = (on ? on / (WD().baseSpeed * rd.speed) : 0) + off / (WD().baseSpeed * O.speed * avg("speed"));
  const f = dist ? on / dist : 1;
  return {
    dist,
    days,
    pts: path.pts,
    detours: path.detours,
    boat: path.boat,
    road: onRoad ? onRoad.road : null,
    roadFrac: f,
    terrain: terrainAt(p.x, p.y),
    risk: (rd ? rd.risk * f : 0) + O.risk * (1 - f) * avg("risk"),
    discover: (rd ? rd.discover * f : 0) + O.discover * (1 - f) * tr.discover,
  };
}
export function routeOf(id, ptOf) {
  if (_rcSrc !== WD()) (_rc = {}), (_rcSrc = WD());
  return _rc[id] || (_rc[id] = routeTo(ptOf(id)));
}
