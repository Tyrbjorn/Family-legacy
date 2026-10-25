// R74: room workers. In the roof-off room picture the people who work in that building walk to its painted stations and work there.
// Display only: nothing here is saved or touches the sim. Who works where comes from walkerList (the same people you see walking to
// the building on the map: job === "b:" + uid), where they stand from the room's boxes data (rc.workspots = feet points, rc.paths =
// the clear aisle; the guildhall has rc.workpaths), and what they do from a seeded, stateless cycle (position = f(seed, t)).
import { estateLayout, walkerList } from "./estate-layout.js";
import { spread, hash, prng } from "./actors.js";

export const SHEET = { fw: 16, fh: 24, cols: 2, rows: 4 };   // walker sheets: 2 frames x 4 rows: 0 down, 1 left, 2 right, 3 up (the same rows the map walkers use)
// defaults; data/estaterooms.json art.workers overrides any of these (cap, speed, sep, reach, merge, post, styles, style)
export const DEF = {
  cap: 3,            // most workers shown in one room (small rooms)
  capLarge: 4,       // R74b: ... in a large room (aisle area >= largeArea)
  largeArea: 6000,   // total aisle area (px^2 of the 256x192 art) that makes a room large
  staffPer: 3,       // R74b: building staffing = 1 + floor(score / staffPer), score = placed pieces + fittings + bought upgrades + production tier (0 = nobody works there)
  aisleSpots: [0.25, 0.5, 0.75, 0.92],   // R74b: a room with few painted stations gets standing spots along its aisle (fractions of the long aisle) so a bigger crew still has somewhere to be
  speed: 14,         // px/s along the aisle
  sep: 20,           // min distance between two worker centres (sprite is 16 wide)
  reach: 60,         // a station further than this from the aisle is skipped (shack bunkbed): nobody cuts across the furniture to it
  merge: 14,         // two stations closer than this are one (cowpen milkstalls + stool)
  post: [1.4, 3],    // seconds standing at an aisle post between stations
  postChance: 0.5,
  styles: { hammer: { fps: 3.5, dip: 1, work: [6, 9] }, haul: { fps: 2.5, dip: 1, work: [5, 8] }, tend: { fps: 1.2, dip: 0, work: [6, 10] }, rest: { fps: 0.6, dip: 0, work: [7, 11] } },
  style: {
    hammer: ["anvil", "anvil_block", "workbench", "sawtable", "masontable", "quarryface", "enchtable", "dummy", "weaponrack", "weaponrack2", "forge", "toolrack"],
    haul: ["sacks", "hopper", "logpile", "plankrack", "storagecrates", "storage_crates", "barrel_row", "barrel_stack", "sack_pile", "barkpile", "salt_sacks", "salt_barrels", "firewood", "fish_barrel", "grainbin", "shaftlift", "mooring_gear", "boatslip", "slipwayways", "hayrack", "gate"],
    rest: ["bunkbed", "bunklow", "bunkup", "cot", "hearth", "hearthfix", "fireplace", "trestletable"]
  }
};
const ROW = [0, 2, 3, 1];   // face (0 down, 1 right, 2 up, 3 left) -> sheet row
export const cfgOf = A => { const w = (A && A.workers) || {}; return { ...DEF, ...w, styles: { ...DEF.styles, ...(w.styles || {}) }, style: { ...DEF.style, ...(w.style || {}) } }; };
const styleOf = (cfg, name) => { for (const k in cfg.style) if (cfg.style[k].includes(name)) return k; return "tend"; };
const cl = (v, a, b) => Math.max(a, Math.min(b, v));
const r1 = v => +v.toFixed(1);

// ---------- who works here
// R74b: building staffing, display only, computed from what the player owns in that building: placed pieces + fittings + bought upgrades + production tier.
// 0 = an empty building with nobody working; otherwise 1 + floor(score / staffPer), at most capLarge. Never saved, never read by the sim.
export function staffScore(E, st) {
  if (!st) return 0;
  let ups = 0; try { ups = (E.boughtUps ? E.boughtUps(st) : []).length; } catch (e) { ups = 0; }
  return (st.pieces || []).length + (st.fittings || []).length + ups + (st.tier | 0);
}
export const staffing = (E, st, cfg = DEF) => { const sc = staffScore(E, st); return sc <= 0 ? 0 : Math.min(cfg.capLarge, 1 + Math.floor(sc / Math.max(1, cfg.staffPer))); };
const AMB = ["walker-human-male-hairkey", "walker-human-female", "walker-dwarf-male", "walker-dwarf-female"];
// extra hired hands for a room whose staffing is higher than the people the map walks there -> same walker sheets and tinting (follower tabard, a seeded hair colour)
export function ambientWorkers(D, st, k, from = 0) {
  const W = (D && D.estatemap && D.estatemap.walk) || {}, hc = ((D && D.creation && D.creation.hairCols) || []).map(h => h.col).filter(Boolean), out = [];
  for (let i = 0; i < k; i++) {
    const h = hash(String(st.uid) + ":amb" + (from + i));
    out.push({ id: "a" + (from + i), name: "Hired hand", sheet: AMB[(h >>> 0) % AMB.length], hair: hc.length ? hc[(h >>> 3) % hc.length] : W.workerHair || "#5a3a24", house: W.workerTabard || "#8a8f98", scale: 1, worker: true, ambient: true });
  }
  return out;
}
// -> [{ id, mid, name, sheet, hair, house, scale, worker, ambient? }]: the walkers the map shows for this building (unchanged: the map's own list), then ambient
// hired hands up to the building's staffing; at most capLarge (workerCount trims to the room's own cap). Manor rooms: only the Hall tab (L.fam "manor:hall") shows the family at home.
export function roomWorkers(E, s, D, st, cap = cfgOf(D && D.estaterooms && D.estaterooms.art).capLarge) {
  if (!st || !D || !D.estatemap || !E || !E.living) return [];
  try {
    const L = estateLayout(s, D, E), key = "b:" + st.uid, cfg = cfgOf(D.estaterooms && D.estaterooms.art);
    const real = walkerList(s, D, E, L).filter(w => w.job === key && !w.veh).slice(0, Math.max(0, cap));
    const want = Math.min(Math.max(0, cap), staffing(E, st, cfg)), more = Math.max(0, want - real.length);
    return real.concat(ambientWorkers(D, st, more));
  } catch (e) { return []; }
}
// the people the map itself walks to this building (no ambient): what the map's own walker list gives
export const mapWorkers = (E, s, D, st) => roomWorkers(E, s, D, st).filter(w => !w.ambient);

// ---------- the room geometry the workers use (pure data, JSON-able)
// L = sceneLayout output (L.work = workspots, L.paths = aisle rects, L.fix = painted fixture boxes). -> null when the room has no stations or no aisle.
const distTo = (paths, p) => Math.min(...paths.map(b => Math.hypot(Math.max(b[0] - p[0], 0, p[0] - b[2]), Math.max(b[1] - p[1], 0, p[1] - b[3]))));
export function workGeo(L, A, seed) {
  if (!L || !L.work || !L.paths) return null;
  const cfg = cfgOf(A), paths = Object.values(L.paths).filter(Boolean);
  if (!paths.length) return null;
  const names = Object.keys(L.work), keep = [];
  for (const n of names) { const p = L.work[n]; if (distTo(paths, p) > cfg.reach) continue; if (!keep.some(k => Math.hypot(k.x - p[0], k.y - p[1]) < cfg.merge)) keep.push({ n, x: p[0], y: p[1] }); }
  if (!keep.length) return null;
  const boxes = Object.entries(L.fix || {});
  // face the painted fixture: this station's own box, else the nearest box. 0 = down, 1 = right, 2 = up, 3 = left
  const faceOf = s => {
    let best = null, bd = 1e9; const own = (L.fix || {})[s.n];
    for (const [id, b] of own ? [[s.n, own]] : boxes) { const cx = cl(s.x, b[0], b[2]), cy = cl(s.y, b[1], b[3]), d = Math.hypot(cx - s.x, cy - s.y); if (d < bd) { bd = d; best = [cx - s.x, cy - s.y]; } }
    if (!best || (!best[0] && !best[1])) return 2;
    return Math.abs(best[0]) > Math.abs(best[1]) ? (best[0] > 0 ? 1 : 3) : best[1] > 0 ? 0 : 2;
  };
  const stations = keep.map(s => ({ n: s.n, x: r1(s.x), y: r1(s.y), face: faceOf(s), style: styleOf(cfg, s.n) }));
  // R74b: room size -> cap; a room with fewer painted stations than its cap gets standing spots down its long aisle (>= sep from every other spot)
  const area = paths.reduce((a, b) => a + (b[2] - b[0]) * (b[3] - b[1]), 0), roomCap = area >= cfg.largeArea ? cfg.capLarge : cfg.cap;
  const lb = paths.slice().sort((a, b) => (b[2] - b[0]) * (b[3] - b[1]) - (a[2] - a[0]) * (a[3] - a[1]))[0], horiz = (lb[2] - lb[0]) > (lb[3] - lb[1]);
  for (const f of cfg.aisleSpots || []) {
    if (stations.length >= roomCap) break;
    const x = horiz ? lb[0] + (lb[2] - lb[0]) * f : (lb[0] + lb[2]) / 2, y = horiz ? (lb[1] + lb[3]) / 2 : lb[1] + (lb[3] - lb[1]) * f;
    if (stations.some(q => Math.hypot(q.x - x, q.y - y) < cfg.sep * 1.25)) continue;
    const q = { n: "aisle" + stations.length, x: r1(x), y: r1(y), face: 0, style: "tend", aisle: true }; q.face = faceOf(q); stations.push(q);
  }
  // seeded, per-room order of the stations
  const r = prng(hash(seed + ":wk")), order = stations.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  // aisle posts: three standing points down the middle of the biggest aisle rect
  const big = paths.slice().sort((a, b) => (b[2] - b[0]) * (b[3] - b[1]) - (a[2] - a[0]) * (a[3] - a[1]))[0];
  const posts = [0.3, 0.6, 0.88].map(f => [r1((big[0] + big[2]) / 2), r1(big[1] + (big[3] - big[1]) * f)]);
  return { seed: String(seed), W: L.w || 256, H: L.h || 192, paths: paths.map(b => b.map(r1)), stations, order, posts, cfg: { reach: cfg.reach, cap: roomCap, speed: cfg.speed, sep: cfg.sep, post: cfg.post, postChance: cfg.postChance, styles: cfg.styles } };
}
export const workerCount = (geo, have) => geo ? Math.max(0, Math.min(geo.cfg.cap || DEF.cap, geo.stations.length, have)) : 0;

// ---------- walkable area: aisle rects grown by `reach` (a station spot may sit a little outside its aisle: the last few px of its walk)
const grow = (b, m) => [b[0] - m, b[1] - m, b[2] + m, b[3] + m];
export const onFloor = (geo, x, y, extra = 0) => geo.paths.some(b => { const g = grow(b, geo.cfg.reach + extra); return x >= g[0] && x <= g[2] && y >= g[1] && y <= g[3]; });
const inter = (a, b) => { const x0 = Math.max(a[0], b[0]), y0 = Math.max(a[1], b[1]), x1 = Math.min(a[2], b[2]), y1 = Math.min(a[3], b[3]); return x1 >= x0 && y1 >= y0 ? [x0, y0, x1, y1] : null; };
const near = (b, p) => ({ x: cl(p.x, b[0], b[2]), y: cl(p.y, b[1], b[3]) });
const rectOf = (geo, p) => { let best = geo.paths[0], bd = 1e9; for (const b of geo.paths) { const q = near(b, p), d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; best = b; } } return best; };
// a route from a to b that never leaves the aisle: a -> aisle -> (shared corner of the two rects) -> aisle -> b
export function route(geo, a, b) {
  const ra = rectOf(geo, a), rb = rectOf(geo, b), ea = near(ra, a), eb = near(rb, b), pts = [a, ea];
  if (ra !== rb) { const i = inter(ra, rb), w = i ? { x: (i[0] + i[2]) / 2, y: (i[1] + i[3]) / 2 } : null; if (w) pts.push(w); else { pts.push({ x: (ra[0] + ra[2]) / 2, y: (ra[1] + ra[3]) / 2 }, { x: (rb[0] + rb[2]) / 2, y: (rb[1] + rb[3]) / 2 }); } }
  pts.push(eb, b);
  return pts.filter((p, i) => !i || Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) > 0.01);
}

// ---------- the cycle: one shared timeline (station, maybe a post, next station, ...); worker i of n starts i*floor(S/n) stations in,
// so workers are at different stations at the same time. Durations depend on the station / room only (never on the worker).
const cycles = new Map();
function cycle(geo) {
  const key = geo.seed + "|" + geo.order.join("") + "|" + JSON.stringify(geo.stations) + "|" + JSON.stringify(geo.paths) + "|" + geo.cfg.speed;
  if (cycles.has(key)) return cycles.get(key);
  const sp = geo.cfg.speed, nodes = [];
  geo.order.forEach((si, k) => {
    const S = geo.stations[si], r = prng(hash(geo.seed + ":" + S.n)), sty = geo.cfg.styles[S.style] || geo.cfg.styles.tend, [a, b] = sty.work;
    nodes.push({ x: S.x, y: S.y, face: S.face, style: S.style, dwell: a + r() * (b - a), work: true, st: si, k });
    const rp = prng(hash(geo.seed + ":post" + k));
    if (geo.stations.length > 1 && rp() < geo.cfg.postChance) { const P = geo.posts[Math.floor(rp() * geo.posts.length)], [p0, p1] = geo.cfg.post; nodes.push({ x: P[0], y: P[1], face: 0, style: "idle", dwell: p0 + rp() * (p1 - p0), work: false, st: -1, k }); }
  });
  let T = 0; const legs = [];
  nodes.forEach((n, i) => {
    const prev = nodes[(i + nodes.length - 1) % nodes.length], pts = route(geo, prev, n);
    let len = 0; const seg = [];
    for (let j = 1; j < pts.length; j++) { const d = Math.hypot(pts[j].x - pts[j - 1].x, pts[j].y - pts[j - 1].y); seg.push({ a: pts[j - 1], b: pts[j], d, s0: len }); len += d; }
    const mv = len / sp;
    legs.push({ node: n, seg, len, t0: T, mv, dwell: n.dwell });   // leg = walk to this node, then dwell at it
    T += mv + n.dwell;
  });
  const C = { legs, T, nodes };
  cycles.set(key, C);
  return C;
}
// state of one timeline at time tt -> { x, y, face, moving, style, work, dir }
function at(C, tt) {
  tt = ((tt % C.T) + C.T) % C.T;
  let L = C.legs[C.legs.length - 1]; for (const l of C.legs) if (tt >= l.t0) L = l; else break;
  const u = tt - L.t0;
  if (u >= L.mv || !L.seg.length) return { x: L.node.x, y: L.node.y, face: L.node.face, moving: false, style: L.node.style, work: L.node.work, dir: 0, node: L.node };
  const d = L.len * (u / L.mv); let g = L.seg[L.seg.length - 1]; for (const q of L.seg) if (d >= q.s0) g = q; else break;
  const k = g.d ? Math.min(1, (d - g.s0) / g.d) : 1, dx = g.b.x - g.a.x, dy = g.b.y - g.a.y;
  return { x: g.a.x + dx * k, y: g.a.y + dy * k, face: Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 1 : 3) : dy > 0 ? 0 : 2, moving: true, style: "walk", work: false, dir: dx, node: L.node };
}
// first work node (index into C.nodes) of worker i of n: spaced evenly over the work nodes
const startIdx = (C, i, n) => { const works = C.nodes.map((nd, k) => nd.work ? k : -1).filter(k => k >= 0); return works[(i * Math.floor(works.length / Math.max(1, n))) % works.length]; };
const startOffset = (C, i, n) => { const l = C.legs[startIdx(C, i, n)]; return l.t0 + l.mv; };  // the moment that worker arrives at its first station
export const clockPhase = geo => (hash(geo.seed + ":clk") % 1000) / 10;

// -> [{ x, y, row (sheet row: 0 down / 1 left / 2 right / 3 up), mir (always false, kept for callers), frame, moving, work, style }], n workers, at time t.
// o.still (reduced motion): each worker stands at its own station, frame 0.
export function workerPositions(geo, n, t, o = {}) {
  const C = cycle(geo), raw = [];
  for (let i = 0; i < n; i++) {
    let p;
    if (o.still) { const nd = C.nodes[startIdx(C, i, n)]; p = { x: nd.x, y: nd.y, face: nd.face, moving: false, style: nd.style, work: true }; }
    else p = at(C, startOffset(C, i, n) + t + clockPhase(geo));
    raw.push(p);
  }
  const ex = geo.cfg.reach + 4, xs = geo.paths.flatMap(b => [b[0], b[2]]), ys = geo.paths.flatMap(b => [b[1], b[3]]);
  const box = [Math.min(...xs) - ex, Math.min(...ys) - ex, Math.max(...xs) + ex, Math.max(...ys) + ex];
  const sp = o.still ? raw.map(p => ({ x: p.x, y: p.y })) : spread(raw.map(p => ({ x: p.x, y: p.y })), geo.cfg.sep, box);
  return raw.map((p, i) => {
    const st = geo.cfg.styles[p.style], ph = i * 0.37, f = o.still ? 0 : p.moving ? Math.floor(t * 4 + i) & 1 : st ? Math.floor(t * st.fps + ph) & 1 : 0;
    return { x: r1(sp[i].x), y: r1(sp[i].y + (st && f && !p.moving ? st.dip : 0)), row: ROW[p.face], mir: false, frame: f, moving: p.moving, work: p.work && !p.moving, style: p.style, raw: { x: p.x, y: p.y } };
  });
}
