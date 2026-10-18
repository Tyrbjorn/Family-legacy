// Map round (data/world.json): terrain, roads, routes, fog of war, locations, node stock, hauling, land features.
import { D, T, isAdult, living, log, rng } from "./state.js";
import { chron } from "./chronicle.js";
import { addBuff } from "./encounters.js";
import { famFx } from "./paths.js";
import { wagonSpeed } from "./estate.js";
import { tutNote } from "./tutorial.js";
export * from "./world-route.js";
import { setBoatAccess } from "./world-route.js";
import { spotsBonus, animalsExplicit, tendShare, animalDef, AN } from "./animals.js";

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
export function inZone(z, x, y) {
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

// ---- fog of war: one char per cell ('1' seen)
const FG = () => WD().fog;
const dims = () => [Math.ceil(MPD().size.w / FG().cell), Math.ceil(MPD().size.h / FG().cell)];
// R30 map x1.5: a fog string from the old 1000x900 map (20x18 cells of 50) is re-projected, never wiped:
// a new cell is seen when its centre, scaled back by 1/1.5, falls in a seen old cell.
export const OLD_FOG = { c: 20, r: 18, scale: 1.5 };
export function reprojectFog(old, c, r, k) {
  const a = new Array(c * r).fill("0");
  for (let j = 0; j < r; j++)
    for (let i = 0; i < c; i++) {
      const oi = Math.floor(((i + 0.5) * k) / OLD_FOG.scale / k), oj = Math.floor(((j + 0.5) * k) / OLD_FOG.scale / k);
      if (oi < OLD_FOG.c && oj < OLD_FOG.r && old[oj * OLD_FOG.c + oi] === "1") a[j * c + i] = "1";
    }
  return a.join("");
}
export function fogInit(s) {
  const [c, r] = dims();
  if (s.fog && s.fog.length === OLD_FOG.c * OLD_FOG.r && c * r !== s.fog.length) s.fog = reprojectFog(s.fog, c, r, FG().cell);
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
      if (a[j * c + i] !== "1" && Math.hypot((i + 0.5) * k - x, (j + 0.5) * k - y) <= rad + k * 0.71) (a[j * c + i] = "1"), n++;
  if (n) s.fog = a.join("");
  return n;
}
export function fogSeen(s, x, y) {
  if (!s.fog) return true;
  const [c] = dims(),
    k = FG().cell;
  return s.fog[Math.floor(y / k) * c + Math.floor(x / k)] === "1";
}
// '1' = seen, '2' = charted from a bought map (terrain drawn, but quests/nodes there still need a visit), '0' = fog
export const fogPct = s => (s.fog ? s.fog.split("").filter(x => x !== "0").length / s.fog.length : 1);
export function fogBase(s, ptOf) {
  // R30: start = home + the village (map.json startReveal); other towns only once discovered (hidden) or walked to
  const h = MPD().home, sr = MPD().startReveal || { home: FG().home, towns: {} };
  reveal(s, h.x, h.y, sr.home);
  for (const [id, r] of Object.entries(sr.towns || {})) { const p = MPD().towns[id]; if (p) reveal(s, p.x, p.y, r); }
  for (const t of D.towns) if (t.hidden && (s.discovered || []).includes(t.id)) { const p = MPD().towns[t.id]; if (p) reveal(s, p.x, p.y, FG().town); }
  for (const id of s.explored || []) { const a = (MPD().areas || []).find(x => x.id === id); if (a) reveal(s, a.x, a.y, a.r * FG().explore); }
}

// ---- locations
export const locDef = id => WD().locations.find(l => l.id === id);
export const locKnown = (s, l) => (s.discovered || []).includes("loc:" + l.id) || (!l.hidden && fogSeen(s, l.x, l.y));
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
  // a visit (spot seen) pays the find; a spot only charted from a bought map waits for that visit
  for (const l of WD().locations) if (!(s.locSeen || []).includes(l.id) && locKnown(s, l) && (l.hidden || fogSeen(s, l.x, l.y))) discoverLoc(s, l, who);
}

// fog-gated nodes (terrain nodes): visible once their cell is seen (and revealed if hidden)
export const nodeFogOk = (s, n) => !n.fog || fogSeen(s, MPD().points[n.id].x, MPD().points[n.id].y);

// ---- node stock: deplete while gathered, regrow a little each day (same total per season as before)
const ND = () => WD().nodeDefaults;
export const nodeMax = n => n.stock || ND().stock;
export const nodeStock = (s, n) => ((s.nodeStock || {})[n.id] ?? nodeMax(n));
export const nodeYieldMult = (s, n) => (nodeStock(s, n) > 0 ? 1 : ND().depleted);
export function drawNode(s, n, amt) {
  if (!s.nodeStock) s.nodeStock = {};
  const was = nodeStock(s, n);
  s.nodeStock[n.id] = Math.max(0, was - amt);
  tutNote(s, "scouted");
  if (was > 0 && s.nodeStock[n.id] <= 0) log(s, `🪫 ${n.name} is worked out; it regrows day by day.`);
}
// frac: share of a season's regrowth to apply (1 = a whole season, 1/seasonDays = one day)
export function regrowNodes(s, seasonId, frac = 1) {
  const f = ((WD().regrowBySeason || {})[seasonId] ?? 1) * frac;
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
    if (t.animal && !animalWorks(s, t.animal)) continue;
    const q = t.item ? Math.max(...veh.map(QIDX)) : 0;
    const carry = t.carry * (1 + HL().qualityCarry * q);
    if (carry * t.haulSpeed > best.carry * best.haulSpeed) best = { ...t, carry, q };
  }
  // a wagon with no working animal is pulled by hand: slow, less cargo
  const nw = HL().wagonNoAnimal;
  if (nw && ownsVehicle(s, nw.item).length) {
    const q = Math.max(...ownsVehicle(s, nw.item).map(QIDX)),
      big = Math.max(...HL().tiers.filter(t => t.item === nw.item).map(t => t.carry));
    const carry = big * nw.carryMult * (1 + HL().qualityCarry * q);
    if (carry * nw.haulSpeed > best.carry * best.haulSpeed) best = { ...nw, carry, q };
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
// ---- livestock feed (world.feed): draft animals (s.animals) and herds kept by buildings (cowpen, coop).
// Each group eats per×head a day from the first food in its diet list that covers it.
const FD = () => WD().feed;
export const animalWorks = (s, id) => (s.animals || {})[id] > 0 && !((s.unfed || {})[id] > 0) && animalCount(s) <= stalls(s);
export const herdMax = (s, type) => ((FD().herds || {})[type] ? FD().herds[type].head * (s.structures || []).filter(st => st.type === type).length + spotsBonus(s, type) : 0);
// R41: after save step 39 herds are bought (missing = 0); older saves meant 'full'
export const herdHead = (s, type) => Math.min(herdMax(s, type), (s.herds || {})[type] ?? (animalsExplicit(s) ? 0 : herdMax(s, type)));
// production share of a herd building: 0 while unfed, else heads left / full herd
export const herdMult = (s, type) => {
  const max = herdMax(s, type);
  if (!max) return 1;
  return (s.unfed || {})[type] > 0 ? 0 : (herdHead(s, type) / max) * (animalDef(type) ? tendShare(s, type) : 1); // R41: tending
};
export function feedGroups(s) {
  const g = Object.entries(s.animals || {})
    .filter(([, n]) => n > 0)
    .map(([id, n]) => ({ key: id, kind: id, n, herd: false }));
  for (const type of Object.keys(FD().herds || {})) {
    const n = herdHead(s, type);
    if (herdMax(s, type)) g.push({ key: type, kind: FD().herds[type].kind, n, herd: true });
  }
  return g;
}
export const feedNeed = (s, g) => FD().kinds[g.kind].per * g.n;
export function feedAnimals(s) {
  if (!FD()) return;
  s.unfed = s.unfed || {};
  for (const g of feedGroups(s)) {
    const k = FD().kinds[g.kind],
      need = feedNeed(s, g);
    const food = need > 0 && FD().diets[k.diet].find(r => (s.res[r] || 0) >= need);
    if (food || !need) {
      if (food) s.res[food] -= need;
      if (s.unfed[g.key] > 0) log(s, `🌾 The ${g.herd ? (k.name || g.kind).toLowerCase() : HL().animals[g.key].name.toLowerCase() + "s"} are fed again.`);
      delete s.unfed[g.key];
      if (g.herd && herdHead(s, g.key) < herdMax(s, g.key) && !(AN().noRegrow && animalDef(g.key))) { // R41: bought animals don't breed
        s.herdFed = s.herdFed || {};
        s.herdFed[g.key] = (s.herdFed[g.key] || 0) + 1;
        if (s.herdFed[g.key] >= FD().regrowDays) {
          s.herdFed[g.key] = 0;
          s.herds[g.key] = herdHead(s, g.key) + 1;
          if (s.herds[g.key] >= herdMax(s, g.key)) delete s.herds[g.key];
        }
      }
      continue;
    }
    const d = (s.unfed[g.key] = (s.unfed[g.key] || 0) + 1);
    const nm = g.herd ? (k.name || g.kind).toLowerCase() : HL().animals[g.key].name.toLowerCase();
    if (d === 1) log(s, `🌾 No ${FD().diets[k.diet].join("/")} for the ${nm}: they stop working until fed.`);
    if (d % FD().runOffDays === 0) {
      if (g.herd) (s.herds = s.herds || {})[g.key] = herdHead(s, g.key) - 1;
      else s.animals[g.key]--;
      log(s, `🏃 Unfed for ${FD().runOffDays} days, one of the ${nm} ran off.`);
    }
  }
  s.animalsFed = !Object.keys(s.animals || {}).some(id => (s.unfed || {})[id] > 0);
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
  setBoatAccess(hasBoat(s));
  if (WD().regrowDaily) regrowNodes(s, seasonId, 1 / Math.ceil(T.daysPerYear / 4));
  else if (seasonStart) regrowNodes(s, seasonId);
  locationsDay(s);
}

// ---- boats: R32 a Small Boat alone lets routes cross lakes (routing.boat); the Dock is for building boats and later ships
export function hasBoat(s) {
  const b = (WD().routing || {}).boat;
  return !!b && (!b.structure || (s.structures || []).some(st => st.type === b.structure)) && ownsVehicle(s, b.item).length > 0;
}

// ---- R30 quadrant maps (data/map.json quadrantMaps): sold by each town for its own quarter of the world
const QM = () => MPD().quadrantMaps;
export const quadOf = (x, y) => (y < QM().split.y ? "n" : "s") + (x < QM().split.x ? "w" : "e");
export const townQuad = id => { const p = MPD().towns[id]; return p ? quadOf(p.x, p.y) : null; };
export const quadOwned = (s, q) => (s.quadMaps || []).includes(q);
export const quadPrice = q => QM().quads[q].price;
export function quadMapIssue(s, townId) {
  const q = townQuad(townId);
  if (!QM() || !q) return "no map sold here";
  if (quadOwned(s, q)) return "already owned";
  if (s.res.coin < quadPrice(q)) return quadPrice(q) + " coin";
  return null;
}
export function buyQuadMap(s, townId) {
  if (quadMapIssue(s, townId)) return false;
  const q = townQuad(townId), [c, r] = dims(), k = FG().cell;
  s.res.coin -= quadPrice(q);
  (s.quadMaps = s.quadMaps || []).push(q);
  fogInit(s);
  const a = s.fog.split("");
  for (let j = 0; j < r; j++) for (let i = 0; i < c; i++) if (a[j * c + i] === "0" && quadOf((i + 0.5) * k, (j + 0.5) * k) === q) a[j * c + i] = "2";
  s.fog = a.join("");
  const disc = s.discovered || (s.discovered = []), rev = s.revealed || (s.revealed = []), got = [];
  const inQ = p => p && quadOf(p.x, p.y) === q;
  for (const t of D.towns) if (inQ(MPD().towns[t.id]) && !disc.includes(t.id)) disc.push(t.id), got.push(t.name);
  for (const d of D.dungeons || []) if (inQ(MPD().points[d.id]) && !rev.includes(d.id)) rev.push(d.id), got.push(d.name);
  for (const l of WD().locations) if (!l.hidden && !l.town && inQ(l) && !disc.includes("loc:" + l.id)) disc.push("loc:" + l.id), got.push(l.name);
  log(s, `🗺️ Bought the ${QM().quads[q].name} map: terrain charted${got.length ? "; marked " + got.join(", ") : ""}. Quests and resources there still need exploring.`);
  return got;
}
