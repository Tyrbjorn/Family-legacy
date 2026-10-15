// Map round (data/world.json): terrain, roads, routes, fog of war, locations, node stock, hauling, land features.
import { D, T, isAdult, living, log, rng } from "./state.js";
import { chron } from "./chronicle.js";
import { addBuff } from "./encounters.js";
import { famFx } from "./paths.js";
import { wagonSpeed } from "./estate.js";

export const WD = () => D.world;
const MPD = () => D.map;

// ---- geometry
const segD = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax,
    dy = by - ay,
    L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};
const lineD = (x, y, pts) => {
  let d = Infinity;
  for (let i = 1; i < pts.length; i++) d = Math.min(d, segD(x, y, ...pts[i - 1], ...pts[i]));
  return d;
};
function inZone(z, x, y) {
  if (z.shape === "rect") return x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h;
  if (z.shape === "ellipse") return ((x - z.x) / z.rx) ** 2 + ((y - z.y) / z.ry) ** 2 <= 1;
  if (z.shape === "line") return lineD(x, y, z.pts) <= z.w;
  return false;
}
export function regionAt(x, y) {
  const r = MPD().regions.find(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  return r ? r.id : null;
}
export function terrainAt(x, y) {
  const zs = WD().zones;
  for (let i = zs.length - 1; i >= 0; i--) if (inZone(zs[i], x, y)) return zs[i].t;
  return WD().regionTerrain[regionAt(x, y)] || "plains";
}
export const terrainDef = id => WD().terrain[id] || WD().terrain.plains;
export const roadDef = t => WD().roadTypes[t];

export function nearestRoad(x, y) {
  let best = null;
  for (const r of WD().roads) {
    const d = lineD(x, y, r.pts);
    if (!best || d < best.d || (d === best.d && roadDef(r.type).speed > roadDef(best.road.type).speed)) best = { road: r, d };
  }
  return best;
}

// ---- routes (home → point): road leg + off-road leg, terrain-weighted
let _rc = {}, _rcSrc = null;
export function routeTo(p) {
  const h = MPD().home,
    dist = Math.hypot(p.x - h.x, p.y - h.y);
  const tr = terrainDef(terrainAt(p.x, p.y)),
    mid = terrainDef(terrainAt((p.x + h.x) / 2, (p.y + h.y) / 2));
  const nr = nearestRoad(p.x, p.y);
  const onRoad = nr && nr.d <= WD().roadSnap ? nr : null;
  const off = onRoad ? Math.min(dist, onRoad.d) : dist,
    on = dist - off;
  const rd = onRoad ? roadDef(onRoad.road.type) : null,
    O = WD().offroad;
  const tSpeed = (tr.speed + mid.speed) / 2;
  const days = (on ? on / (WD().baseSpeed * rd.speed) : 0) + off / (WD().baseSpeed * O.speed * tSpeed);
  const f = dist ? on / dist : 1;
  return {
    dist,
    days,
    road: onRoad ? onRoad.road : null,
    roadFrac: f,
    terrain: terrainAt(p.x, p.y),
    risk: (rd ? rd.risk * f : 0) + O.risk * (1 - f) * ((tr.risk + mid.risk) / 2),
    discover: (rd ? rd.discover * f : 0) + O.discover * (1 - f) * tr.discover,
  };
}
export function routeOf(id, ptOf) {
  if (_rcSrc !== WD()) (_rc = {}), (_rcSrc = WD());
  return _rc[id] || (_rc[id] = routeTo(ptOf(id)));
}

// ---- fog of war: one char per cell ('1' seen)
const FG = () => WD().fog;
const dims = () => [Math.ceil(MPD().size.w / FG().cell), Math.ceil(MPD().size.h / FG().cell)];
export function fogInit(s) {
  const [c, r] = dims();
  if (!s.fog || s.fog.length !== c * r) s.fog = "0".repeat(c * r);
}
export function reveal(s, x, y, rad) {
  fogInit(s);
  const [c, r] = dims(),
    k = FG().cell;
  const a = s.fog.split("");
  let n = 0;
  for (let j = Math.max(0, Math.floor((y - rad) / k)); j <= Math.min(r - 1, Math.floor((y + rad) / k)); j++)
    for (let i = Math.max(0, Math.floor((x - rad) / k)); i <= Math.min(c - 1, Math.floor((x + rad) / k)); i++)
      if (a[j * c + i] === "0" && Math.hypot((i + 0.5) * k - x, (j + 0.5) * k - y) <= rad + k * 0.71) (a[j * c + i] = "1"), n++;
  if (n) s.fog = a.join("");
  return n;
}
export function fogSeen(s, x, y) {
  if (!s.fog) return true;
  const [c] = dims(),
    k = FG().cell;
  return s.fog[Math.floor(y / k) * c + Math.floor(x / k)] === "1";
}
export const fogPct = s => (s.fog ? s.fog.split("").filter(x => x === "1").length / s.fog.length : 1);
export function fogBase(s, ptOf) {
  const h = MPD().home;
  reveal(s, h.x, h.y, FG().home);
  for (const t of D.towns) if (!t.hidden || (s.discovered || []).includes(t.id)) { const p = MPD().towns[t.id]; if (p) reveal(s, p.x, p.y, FG().town); }
  for (const id of s.explored || []) { const a = (MPD().areas || []).find(x => x.id === id); if (a) reveal(s, a.x, a.y, a.r * FG().explore); }
}

// ---- locations
export const locDef = id => WD().locations.find(l => l.id === id);
export const locKnown = (s, l) => (l.hidden ? (s.discovered || []).includes("loc:" + l.id) : fogSeen(s, l.x, l.y));
export function discoverLoc(s, l, who) {
  if (!(s.locSeen || (s.locSeen = [])).includes(l.id)) {
    s.locSeen.push(l.id);
    const ty = WD().locTypes[l.type];
    const bits = [];
    for (const [k, v] of Object.entries(l.reward || {}))
      if (k === "renown") s.renown = (s.renown || 0) + v, bits.push(`+${v} renown`);
      else (s.res[k] = (s.res[k] || 0) + v), bits.push(`+${v} ${k}`);
    if (l.buff) addBuff(s, l.buff), bits.push("✨ " + l.buff.name);
    const msg = `🗺️ Discovered ${ty.icon} ${l.name} (${ty.name})${who ? " — " + who : ""}${bits.length ? ": " + bits.join(", ") : ""}.`;
    log(s, msg);
    chron(s, "discovery", msg, who);
  }
}
export function locationsDay(s, who) {
  for (const l of WD().locations) if (!(s.locSeen || []).includes(l.id) && locKnown(s, l)) discoverLoc(s, l, who);
}

// fog-gated nodes (terrain nodes): visible once their cell is seen (and revealed if hidden)
export const nodeFogOk = (s, n) => !n.fog || fogSeen(s, MPD().points[n.id].x, MPD().points[n.id].y);

// ---- node stock: deplete while gathered, regrow each season
const ND = () => WD().nodeDefaults;
export const nodeMax = n => n.stock || ND().stock;
export const nodeStock = (s, n) => ((s.nodeStock || {})[n.id] ?? nodeMax(n));
export const nodeYieldMult = (s, n) => (nodeStock(s, n) > 0 ? 1 : ND().depleted);
export function drawNode(s, n, amt) {
  if (!s.nodeStock) s.nodeStock = {};
  const was = nodeStock(s, n);
  s.nodeStock[n.id] = Math.max(0, was - amt);
  if (was > 0 && s.nodeStock[n.id] <= 0) log(s, `🪫 ${n.name} is worked out until it regrows next season.`);
}
export function regrowNodes(s, seasonId) {
  const f = (WD().regrowBySeason || {})[seasonId] ?? 1;
  for (const n of D.nodes) {
    if (!s.nodeStock || s.nodeStock[n.id] == null) continue;
    s.nodeStock[n.id] = Math.min(nodeMax(n), s.nodeStock[n.id] + nodeMax(n) * (n.regrow ?? ND().regrow) * f);
    if (s.nodeStock[n.id] >= nodeMax(n)) delete s.nodeStock[n.id];
  }
}

// ---- hauling: carry per trip and haul speed (vehicle item + fed, stabled animal)
const HL = () => WD().haul;
export const QIDX = id => {
  const q = String(id).split("|")[2];
  return Math.max(0, D.crafting.qualities.findIndex(x => x.id === q));
};
export const ownsVehicle = (s, base) => (s.vault || []).filter(v => v === base || String(v).split("#")[0].split("|")[1] === base || v === base);
export const stalls = s => {
  let n = 0;
  for (const st of s.structures || []) {
    n += st.pieces.filter(p => String(p).split("@")[0] === HL().stall).length * HL().stallsPer;
    if (st.spec === "stable") n += HL().stableSpecStalls;
  }
  return n;
};
export const animalCount = s => Object.values(s.animals || {}).reduce((a, b) => a + b, 0);
export function haulTier(s) {
  let best = { ...HL().base, q: 0 };
  for (const t of HL().tiers) {
    const veh = t.item ? ownsVehicle(s, t.item) : [true];
    if (!veh.length) continue;
    if (t.animal && !((s.animals || {})[t.animal] > 0 && s.animalsFed !== false && animalCount(s) <= stalls(s))) continue;
    const q = t.item ? Math.max(...veh.map(QIDX)) : 0;
    const carry = t.carry * (1 + HL().qualityCarry * q);
    if (carry * t.haulSpeed > best.carry * best.haulSpeed) best = { ...t, carry, q };
  }
  best.carry = Math.round(best.carry * (1 + famFx(s, "haul")));
  best.haulSpeed *= wagonSpeed(s);
  return best;
}
export function buyAnimalIssue(s, id, town) {
  const a = HL().animals[id];
  if (!a) return "unknown animal";
  if (town && !a.towns.includes(town)) return "not sold here";
  if (animalCount(s) + 1 > stalls(s)) return "needs a free stable stall";
  if ((s.res.coin || 0) < a.cost.coin) return `${a.cost.coin} coin`;
  return null;
}
export function buyAnimal(s, id, town) {
  if (buyAnimalIssue(s, id, town)) return false;
  const a = HL().animals[id];
  s.res.coin -= a.cost.coin;
  (s.animals = s.animals || {})[id] = ((s.animals || {})[id] || 0) + 1;
  log(s, `${a.icon} Bought a ${a.name} for hauling.`);
  return true;
}
export function feedAnimals(s) {
  if (!animalCount(s)) return;
  let ok = true;
  for (const [id, n] of Object.entries(s.animals))
    for (const [k, v] of Object.entries(HL().animals[id].feed)) {
      if ((s.res[k] || 0) >= v * n) s.res[k] -= v * n;
      else ok = false;
    }
  if (ok !== (s.animalsFed !== false)) log(s, ok ? "🐴 The draft animals are fed again." : "🐴 No feed: draft animals won't haul until fed.");
  s.animalsFed = ok;
}

// ---- land features (parcels): work with no travel, bonus; job and structure bonuses
export const featureDef = id => WD().features[id];
export const ownedFeatures = s => [...new Set((s.land || []).flatMap(id => (WD().landFeatures || {})[id] || []))];
export const hasFeature = (s, f) => (Array.isArray(f) ? f : [f]).some(x => ownedFeatures(s).includes(x));
export const parcelJobMult = (s, job) => 1 + ownedFeatures(s).reduce((a, f) => a + ((featureDef(f).jobs || {})[job] || 0), 0);
export function structFeatureIssue(s, type) {
  const need = (WD().structureFeature || {})[type];
  if (!need || hasFeature(s, need)) return null;
  return `needs land with ${(Array.isArray(need) ? need : [need]).map(f => featureDef(f).name.toLowerCase()).join(" or ")}`;
}
export function structFeatureMult(s, type) {
  const need = (WD().structureFeature || {})[type];
  if (!need) return 1;
  return 1 + Math.max(0, ...ownedFeatures(s).filter(f => (Array.isArray(need) ? need : [need]).includes(f)).map(f => featureDef(f).structMult || 0));
}
export function parcelDay(s, m, a, eff, gainXp, skillMult) {
  const f = featureDef(a.target);
  if (!f || !hasFeature(s, a.target)) return (m.action = null);
  const mul = (1 + ((m.skills[f.skill] || { lvl: 0 }).lvl || 0) * 0.03) * eff * (1 + WD().parcelBonus) * (skillMult || 1);
  for (const [k, v] of Object.entries(f.res)) s.res[k] = (s.res[k] || 0) + v * mul;
  gainXp(s, m, f.skill, T.xpPerDay * 0.6 * eff);
}

// ---- world day: fog/locations, animals, seasonal regrowth
export function worldDay(s, seasonStart, seasonId) {
  if (!WD()) return;
  feedAnimals(s);
  if (seasonStart) regrowNodes(s, seasonId);
  locationsDay(s);
}
