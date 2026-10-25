// R73: pure helpers for the animals, mounts and wagons art (display only, nothing here is saved, no DOM, only a seeded generator).
// Everything is computed from what the player already owns (herd head, draft animals, vehicles, teamsters, mount tier),
// so a re-render or a reload draws the same picture. See fl-animals-wiring-proposal.md (R73).

// ---------- seeded, time-based wander (stateless: position = f(seed, t))
export const hash = str => { let h = 2166136261; for (const c of String(str)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
export const prng = a => () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
export const WANDER = { speed: 10, pauseMin: 3, pauseMax: 8, wanderChance: 0.3, moveFps: 3, idleSec: 2, legs: 10, stopChance: 0 };
// per-kind overrides (bees dart about, pen animals roam the whole open floor: shorter stays, and about every other animal makes one visit
// to a trough/feeder stop per cycle, so the fixtures are one stop among many and never every animal at once)
export const KIND_OPTS = { bees: { speed: 14, pauseMin: 0.4, pauseMax: 1.6, wanderChance: 0.6, moveFps: 4, idleSec: 0.5, stopChance: 0.6 }, pen: { pauseMin: 2, pauseMax: 6, stopChance: 0.5, keepFree: true } };
const plans = new Map();
// A cycle of legs inside box [x0,y0,x1,y1] (the FEET box: x = centre of the sprite, y = its feet). The last leg walks back to the
// start so the cycle repeats seamlessly; a seeded phase gives every animal its own point in the cycle.
// R73b: the long legs go to jittered cells of a shuffled grid over the box (a cycle visits cells all over the floor, never the same
// corner twice), a short hop stays near where the animal is, and o.stops ([[x,y],...], e.g. in front of a trough) gives at most ONE
// visit per cycle, taken with chance o.stopChance, with its own jitter so two animals never aim at the same pixel.
function plan(seed, box, o) {
  const stops = o.stops || [], key = seed + "|" + box.join(",") + "|" + o.speed + "|" + o.pauseMin + "|" + o.pauseMax + "|" + o.wanderChance + "|" + o.legs + "|" + o.stopChance + "|" + stops.join(";");
  if (plans.has(key)) return plans.get(key);
  const r = prng(hash(seed)), [x0, y0, x1, y1] = box, w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0), cl = (v, a, b) => Math.max(a, Math.min(b, v));
  const need = Math.max(2, o.legs - 1), cols = cl(Math.round(Math.sqrt(need * w / h)), 1, 6), rows = Math.max(1, Math.ceil(need / cols)), cells = [];
  for (let i = 0; i < cols * rows; i++) cells.push(i);
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  let ci = 0;
  const cell = () => { const c = cells[ci++ % cells.length]; return { x: x0 + ((c % cols) + 0.15 + 0.7 * r()) * w / cols, y: y0 + ((Math.floor(c / cols)) + 0.15 + 0.7 * r()) * h / rows }; };
  const start = cell(), legs = [], stopLeg = stops.length && r() < o.stopChance ? 1 + Math.floor(r() * Math.max(1, o.legs - 2)) : -1;
  let cur = start, T = 0;
  for (let i = 0; i < o.legs; i++) {
    const last = i === o.legs - 1, atStop = i === stopLeg, short = !last && !atStop && r() < o.wanderChance;
    let to;
    if (last) to = start;
    else if (atStop) { const s = stops[Math.floor(r() * stops.length)]; to = { x: cl(s[0] + (r() * 2 - 1) * 8, x0, x1), y: cl(s[1] + (r() * 2 - 1) * 4, y0, y1) }; }
    else if (short) to = { x: cl(cur.x + (r() * 2 - 1) * 18, x0, x1), y: cl(cur.y + (r() * 2 - 1) * 10, y0, y1) };
    else to = cell();
    const d = Math.hypot(to.x - cur.x, to.y - cur.y), mv = d / o.speed, pause = short ? 0.8 + r() * 1.7 : atStop ? 2 + r() * 3 : o.pauseMin + r() * (o.pauseMax - o.pauseMin);
    legs.push({ from: cur, to, t0: T, mv, pause, stop: atStop, dir: to.x < cur.x - 0.01 ? -1 : to.x > cur.x + 0.01 ? 1 : i ? legs[i - 1].dir : 1 });
    T += mv + pause; cur = to;
  }
  const P = { start, legs, T, phase: r() * T };
  plans.set(key, P);
  return P;
}
// -> { x, y, dir (1 right / -1 left = mirror), frame (0/1), moving }
export function wander(seed, t, box, o = {}) {
  o = { ...WANDER, ...o };
  const P = plan(seed, box, o);
  if (o.still) return { x: P.start.x, y: P.start.y, dir: 1, frame: 0, moving: false };
  const tt = (((t + P.phase) % P.T) + P.T) % P.T;
  let L = P.legs[P.legs.length - 1];
  for (const l of P.legs) if (tt >= l.t0) L = l; else break;
  const u = tt - L.t0, moving = u < L.mv, k = moving ? u / L.mv : 1;
  const frame = moving ? Math.floor(t * o.moveFps) & 1 : Math.floor(t / o.idleSec) & 1;
  return { x: L.from.x + (L.to.x - L.from.x) * k, y: L.from.y + (L.to.y - L.from.y) * k - (moving && frame && o.bob !== false ? 1 : 0), dir: L.dir, frame, moving };
}
// R73b: keep a group of animals (one pen) at least minD apart. Pure and continuous: each close pair is pushed apart symmetrically along
// the line between them (a few passes, clamped to the feet box), so an animal walking up to another one steers around it instead of
// standing on it, and a seeded wander position stays the same function of (seed, time).
export function spread(ps, minD, box, passes = 24) {
  const out = ps.map(p => ({ ...p })), [x0, y0, x1, y1] = box, cl = (v, a, b) => Math.max(a, Math.min(b, v));
  for (let it = 0; it < passes; it++) {
    let moved = false;
    for (let i = 1; i < out.length; i++) for (let j = 0; j < i; j++) {
      let dx = out[i].x - out[j].x, dy = out[i].y - out[j].y, d = Math.hypot(dx, dy);
      if (d >= minD) continue;
      if (d < 1e-6) { dx = i % 2 ? 1 : -1; dy = 0.3 * (j - i); d = Math.hypot(dx, dy); }
      const k = (minD - d) / 2 / d + 0.01;
      out[i].x = cl(out[i].x + dx * k, x0, x1); out[i].y = cl(out[i].y + dy * k, y0, y1);
      out[j].x = cl(out[j].x - dx * k, x0, x1); out[j].y = cl(out[j].y - dy * k, y0, y1);
      moved = true;
    }
    if (!moved) break;
  }
  return out;
}
// R74: nudge units (pen animals) off fixed points (the room workers): each point inside minD pushes the unit straight out to minD, clamped to the box
export function avoidPoints(ps, pts, minD, box) {
  if (!pts || !pts.length) return ps;
  const [x0, y0, x1, y1] = box, cl = (v, a, b) => Math.max(a, Math.min(b, v));
  return ps.map(p => { let { x, y } = p;
    for (let it = 0; it < 3; it++) for (const q of pts) { let dx = x - q.x, dy = y - q.y, d = Math.hypot(dx, dy); if (d >= minD) continue; if (d < 1e-6) { dx = 1; dy = 0; d = 1; } x = cl(q.x + dx / d * minD, x0, x1); y = cl(q.y + dy / d * minD, y0, y1); }
    return { ...p, x, y }; });
}
// all the animals of one pen: seeds[i] = the wander seed of unit i; box = shared feet box; minD = centre distance to keep
// o.keepFree (pens): the last unit of a pen of 2+ never plans a trough visit, so the troughs are never visited by every animal on purpose
export function penPositions(seeds, t, box, o, minD) { return spread(seeds.map((s, i) => wander(s, t, box, o.keepFree && seeds.length > 1 && i === seeds.length - 1 ? { ...o, stops: [] } : o)), minD, box); }

// ---------- pens
export const MAX_PEN = 3;
// sprites in one pen: min(3, share of the herd head); the head is split evenly over the pens of one type (extra to the first pens);
// unit = animals one sprite stands for (a pair of hens = 2)
export function penCount(head, pens, k = 0, unit = 1) {
  head = Math.max(0, head | 0); pens = Math.max(1, pens | 0);
  const share = Math.floor(head / pens) + (k < head % pens ? 1 : 0);
  return Math.min(MAX_PEN, Math.ceil(share / Math.max(1, unit)));
}
// pen building type -> the idle sheet (art.sheets) and how many animals one sprite stands for
// sheet = standing frames (null = stand on walk frame 0), walk = 4 walk frames, unit = animals one sprite stands for,
// per = how many single-animal sprites draw one unit (a "pair of hens" = two hen-walk hens that walk together)
export const PEN_SHEET = { cowpen: { sheet: "cow-idle", walk: "cow-walk", unit: 1, per: 1 }, chickencoop: { sheet: null, walk: "hen-walk", unit: 2, per: 2 } };
export const BEES = { sheet: "bees-swarm", n: 2 };

// stall animals: the draft animals (s.animals) in the order of world.json haul.animals, handed to the rooms that hold stalls in
// building order, up to MAX_PEN per room and up to that room's stall count
export function stallCap(HL, st) {
  const n = (st.pieces || []).filter(p => String(p).split("@")[0] === HL.stall).length * HL.stallsPer + (st.spec === "stable" ? HL.stableSpecStalls : 0);
  return n;
}
export function draftList(HL, s) {
  const out = [];
  for (const id of Object.keys(HL.animals || {})) for (let i = 0; i < ((s.animals || {})[id] | 0); i++) out.push(id);
  return out;
}
export function stallDraft(HL, s, st) {
  let rest = draftList(HL, s);
  for (const x of s.structures || []) {
    const take = Math.min(MAX_PEN, stallCap(HL, x), rest.length), mine = rest.slice(0, take);
    if (x === st || (x.uid != null && x.uid === st.uid)) return mine;
    rest = rest.slice(take);
  }
  return [];
}
// what one room shows: { seed, stable, pen: {sheet, walk, per, n, still} | null, draft: [{id, file, sheet, name}], bees: n, sheets: {name: {file,fw,fh,cols}} }
// art = data/art.json (sheets, an, sprites). Classic mode never calls this.
export function roomActors(E, s, st, HL, art) {
  const out = { seed: String(st && st.uid), stable: !!(st && st.spec === "stable"), pen: null, draft: [], bees: 0, sheets: (art && art.sheets) || {} };
  if (!st || !art) return out;
  const ps = PEN_SHEET[st.type];
  if (ps && E.animalDef && E.animalDef(st.type)) {
    const same = (s.structures || []).filter(x => x.type === st.type), k = Math.max(0, same.findIndex(x => x.uid === st.uid));
    out.pen = { type: st.type, sheet: ps.sheet, walk: ps.walk, per: ps.per, n: penCount(E.herdHead(s, st.type), same.length, k, ps.unit), still: ((s.unfed || {})[st.type] | 0) > 0 };
  }
  if (st.type === "apiary") out.bees = BEES.n;
  if (HL && stallCap(HL, st) > 0)
    out.draft = stallDraft(HL, s, st).map(id => { const ic = (art.an || {})[id], f = ic && art.sprites && art.sprites[ic] && art.sprites[ic].file; return f ? { id, file: f, sheet: ((art.draftSheet || {})[id] && art.sheets && art.sheets[art.draftSheet[id]]) ? art.draftSheet[id] : null, name: ((HL.animals || {})[id] || {}).name || id } : null; }).filter(Boolean);
  return out;
}

// ---------- vehicles on the estate map
export const MAX_VEH = 3;
// game id -> walk sheet (art.sheets). The sea boat's "sheet" is the 2-frame moored sprite. All of these have art since batch c.
export const VEH_SHEET = { handcart: "handcart-walk", wagoncart: "handcart-walk", mule: "mule-pack", oxwagon: "oxwagon-walk", horsewagon: "horsewagon-walk", ramcart: "ramcart-walk", warchariot: "chariot-walk",
  "rider:pony": "rider-noble-pony", "rider:courser": "rider-courser", "rider:warhorse": "rider-warhorse", "rider:horseman": "rider-horseman", seaboat: "seaboat-moored" };
const RIDERS = ["", "rider:pony", "rider:courser", "rider:warhorse"];
// every haul tier the player could use right now (own the item, the animal works), best first. Pure read of the engine's own rules.
export function ownedTiers(E, HL, s) {
  const out = [];
  for (const t of HL.tiers || []) {
    if (t.coast) continue;
    if (t.item && !E.ownsVehicle(s, t.item).length) continue;
    if (t.animal && !E.animalWorks(s, t.animal)) continue;
    out.push(t);
  }
  const nw = HL.wagonNoAnimal;
  if (nw && E.ownsVehicle(s, nw.item).length) out.push({ id: nw.id || "wagoncart", name: nw.name || "Wagon", carry: 0, haulSpeed: nw.haulSpeed || 1 });
  const best = E.haulTier(s);
  out.sort((a, b) => (b.id === best.id) - (a.id === best.id) || b.carry * b.haulSpeed - a.carry * a.haulSpeed);
  return out;
}
// up to 3 { id, sheet, n, kind } in this order: sea boat (owned and a Dock/Slipway exists), teamster wagons, a noble rider
// (mount tier 1+), a horseman escort (a Horseman minion on a trade route). n = teamsters riding on that wagon.
export function vehicleSlots(E, s, HL, cap = MAX_VEH) {
  const out = [], push = v => { if (out.length < cap) out.push(v); };
  const hasDock = !!E.hasStructType && (E.hasStructType(s, "dock") || E.hasStructType(s, "slipway"));
  if (E.hasSeaBoat && E.hasSeaBoat(s) && hasDock) push({ id: "seaboat", sheet: VEH_SHEET.seaboat, n: 0, kind: "boat", name: "Sea boat" });
  const tm = (s.minions || []).filter(x => x.job === "teamster").length;
  const tiers = HL ? ownedTiers(E, HL, s) : [];
  if (tiers.length) {
    const count = Math.max(1, Math.min(MAX_VEH, tm)), parked = tm === 0;
    for (let i = 0; i < count; i++) {
      const t = tiers[i] || tiers[0];
      push({ id: t.id, sheet: VEH_SHEET[t.id] || "handcart-walk", n: parked ? 0 : Math.floor(tm / count) + (i < tm % count ? 1 : 0), kind: "wagon", parked, name: t.name, carry: t.carry });
    }
  }
  const mt = E.mountTier ? E.mountTier(s) : 0;
  if (mt >= 1) { const id = RIDERS[Math.min(3, mt)]; push({ id, sheet: VEH_SHEET[id], n: 0, kind: "rider", name: "Noble rider", tier: mt }); }
  if ((s.minions || []).some(x => x.job === "trade" && E.isEscort && E.isEscort(x))) push({ id: "rider:horseman", sheet: VEH_SHEET["rider:horseman"], n: 0, kind: "escort", name: "Horseman escort" });
  return out;
}
