// R62 ART-3: pure estate-map layout (no DOM). Positions come from data/estatemap.json plus structure order (uid),
// stages from existing structure state. Nothing here is saved. Used by estate-map.js and test/r62.test.mjs.
export function artStage(E, M, st) {
  const d = E.structDef(st.type) || {}, A = M.art, ru = (A.reuse || {})[st.type];
  if (ru && ru.look != null) return ru.look;
  if (ru && ru.renameLook != null) { // Guardhouse: looks 1-2 by upgrades, look 3 once renamed Barracks
    if (E.structStage(st) >= 2) return ru.renameLook;
    return (st.up || 0) > 0 ? 1 : 0;
  }
  if (ru) return Math.min((ru.looks || 3) - 1, artStageOwn(E, d, st));
  if (A.chain[st.type]) return A.chain[st.type][1];
  return artStageOwn(E, d, st, A.named[st.type]);
}
function artStageOwn(E, d, st, named) {
  if (named || d.stages) return Math.max(0, Math.min(2, E.structStage(st) - 1));
  const n = st.up || 0, full = (E.curUpgrades(st) || d.upgrades || []).length || 3;
  const byUp = n <= 0 ? 0 : n >= full ? 2 : 1;
  return Math.min(2, Math.max(byUp, st.tier || 0));
}
export function artKey(E, M, st) {
  const A = M.art, stg = artStage(E, M, st);
  const ru = (A.reuse || {})[st.type];
  if (ru) return `${ru.sprite}-${stg + 1}`;
  if (A.chain[st.type]) return `${A.chain[st.type][0]}-${stg + 1}`;
  if (A.named[st.type]) return `${A.named[st.type]}-${stg + 1}`;
  if (A.ups.includes(st.type)) return `${st.type}-${stg + 1}`;
  return null; // no art yet: emoji pad
}
// R67 ART-3b: tint (multiply hex) + emoji door sign for a reused exterior; "vein" tints a mine by its vein's metal
export function artTouch(E, M, st, artData) {
  const ru = (M.art.reuse || {})[st.type];
  if (!ru) return null;
  let tint = ru.tint || null;
  if (tint === "vein") { const v = String(E.veinOf ? E.veinOf(st) : "").replace(/_vein$/, ""); tint = ((artData || {}).veinPal || {})[v === "ore" ? "iron" : v] || null; }
  return { tint, emblem: ru.emblem || "", k: M.art.tintK || 0.45 };
}
export const isBig = key => !!key && key.startsWith("manor");

// Path cells: lanes plus a short spur from each parcel... kept to the lane grid.
export function pathCells(M) {
  const set = new Set(), k = (x, y) => x + "," + y;
  for (const y of M.lanesH) for (let x = 0; x < M.cols; x++) set.add(k(x, y));
  for (const x of M.lanesV) for (let y = 0; y <= M.lanesVTo; y++) set.add(k(x, y));
  return set;
}
// tile + quarter turns (clockwise) for a path cell from its N/E/S/W neighbours (batch3/3b orientations)
export function pathTile(set, x, y) {
  const h = (a, b) => set.has(a + "," + b);
  const n = h(x, y - 1), e = h(x + 1, y), s = h(x, y + 1), w = h(x - 1, y), c = n + e + s + w;
  if (c === 4) return ["path-cross", 0];
  if (c === 3) return ["path-tee", !n ? 0 : !e ? 1 : !s ? 2 : 3];
  if (c === 2) {
    if (n && s) return ["tile-dirt-path", 0];
    if (e && w) return ["tile-dirt-path", 1];
    return ["path-corner", n && e ? 0 : e && s ? 1 : s && w ? 2 : 3];
  }
  if (c === 1) return ["path-end", s ? 0 : w ? 1 : n ? 2 : 3];
  return ["path-cross", 0];
}

export function estateLayout(s, D, E) {
  const M = D.estatemap, T = M.tile, owned = s.land || [];
  const parcels = Object.entries(M.parcels).map(([id, [px, py]]) => {
    const l = D.estate.lands.find(x => x.id === id) || { id, name: id, icon: "🟫", slots: 0 };
    return { id, name: l.name, icon: l.icon, slots: l.slots, owned: owned.includes(id), x: px * T, y: py * T, w: 4 * T, h: 4 * T };
  });
  // anchors of owned parcels, in purchase order
  const free = [];
  for (const id of owned) {
    const p = parcels.find(x => x.id === id);
    if (p) M.anchors.forEach(([ax, ay], i) => free.push({ p: id, i, x: p.x + ax * T, y: p.y + ay * T, used: false }));
  }
  const shore = M.shoreAnchors.map(([x, y]) => ({ x: x * T, y: y * T, used: false }));
  const items = [];
  let overflow = 0;
  const rectOf = list => ({ x: Math.min(...list.map(a => a.x)), y: Math.min(...list.map(a => a.y)), w: Math.max(...list.map(a => a.x)) + 2 * T - Math.min(...list.map(a => a.x)), h: Math.max(...list.map(a => a.y)) + 2 * T - Math.min(...list.map(a => a.y)) });
  const take = n => {
    if (n >= 2) {
      // a horizontal pair in one parcel (anchor 0+1 or 2+3), then any extra
      for (const a of free) if (!a.used && a.i % 2 === 0) {
        const b = free.find(z => z.p === a.p && z.i === a.i + 1 && !z.used);
        if (b) {
          a.used = b.used = true; const got = [a, b];
          for (let k = 2; k < n; k++) { const c = free.find(z => z.p === a.p && !z.used) || free.find(z => !z.used); if (c) (c.used = true), got.push(c); }
          return { main: [a, b], all: got };
        }
      }
    }
    const got = [];
    for (let k = 0; k < Math.max(1, n); k++) { const c = free.find(z => !z.used); if (c) (c.used = true), got.push(c); }
    return got.length ? { main: [got[0]], all: got } : null;
  };
  (s.structures || []).forEach((st, k) => {
    if (st.site === "village") return;
    const d = E.structDef(st.type) || {}, land = (d.land || 1) + ((E.prodTier(st) || {}).land || 0);
    const key = artKey(E, M, st);
    let rect;
    if (M.shoreTypes.includes(st.type)) {
      const a = shore.find(z => !z.used);
      if (a) (a.used = true), (rect = { x: a.x, y: a.y, w: 2 * T, h: 2 * T });
      else { const t = take(land); if (t) rect = rectOf(t.main); }
    } else { const t = take(land); if (t) rect = rectOf(t.main); }
    if (!rect) return void overflow++;
    const shoreItem = M.shoreTypes.includes(st.type) && rect.y >= M.shoreRow * T;
    items.push({ key: "b:" + st.uid, k, uid: st.uid, type: st.type, name: E.structName ? E.structName(st) : d.name, icon: d.icon || "🏠", img: key, touch: artTouch(E, M, st, D.art), stage: artStage(E, M, st), rect,
      door: { x: rect.x + rect.w / 2, y: shoreItem ? rect.y + 10 : rect.y + rect.h - 2 } });
  });
  for (const b of D.buildings || []) {
    const lv = (s.buildings || {})[b.id] || 0;
    if (lv <= 0 || !b.land) continue;
    const t = take(b.land);
    if (!t) { overflow++; continue; }
    const rect = rectOf(t.main);
    items.push({ key: "o:" + b.id, type: b.id, name: `${b.name} Lv${lv}`, icon: b.icon, img: null, stage: 0, rect, door: { x: rect.x + rect.w / 2, y: rect.y + rect.h - 2 } });
  }
  const nFree = Math.max(0, E.landSlots(s) - E.landUsed(s));
  const empties = free.filter(a => !a.used).slice(0, nFree).map(a => ({ x: a.x, y: a.y, w: 2 * T, h: 2 * T }));
  return { M, T, W: M.cols * T, H: M.rows * T, parcels, items, empties, overflow, paths: pathCells(M) };
}

// Waypoints between two doors along the lane grid (cosmetic only).
export function route(M, a, b) {
  const T = M.tile, hy = M.lanesH.map(r => r * T + T / 2), vx = M.lanesV.map(c => c * T + T / 2);
  const near = (arr, v) => arr.reduce((p, q) => (Math.abs(q - v) < Math.abs(p - v) ? q : p));
  const ha = near(hy, a.y), hb = near(hy, b.y);
  if (ha === hb) return [{ x: a.x, y: ha }, { x: b.x, y: ha }, { x: b.x, y: b.y }];
  const v = near(vx, (a.x + b.x) / 2);
  return [{ x: a.x, y: ha }, { x: v, y: ha }, { x: v, y: hb }, { x: b.x, y: hb }, { x: b.x, y: b.y }];
}

// Who walks: family with a job on the estate (away ones are off the map), then up to maxWorkers followers.
export function walkerList(s, D, E, L) {
  const M = D.estatemap, W = M.walk, out = [];
  const home = L.items.find(i => M.homeTypes.includes(i.type)) || L.items[0];
  if (!home) return out;
  const pick = (types, seed) => { const c = L.items.filter(i => (types || []).includes(i.type)); return c.length ? c[seed % c.length] : home; };
  const C = D.creation || {};
  for (const m of E.living(s)) {
    if (out.length >= W.maxWalkers) break;
    const a = m.action && m.action.type;
    if (a && M.away.includes(a)) continue;
    const band = E.ageBand(m), base = E.dollBase(m), look = E.lookOf(s, m) || {};
    const job = a ? pick(M.jobSpots[a], m.id | 0) : home;
    out.push({ id: "m" + m.id, mid: m.id, name: m.name, sheet: `walker-${base.startsWith("dwarf") ? "dwarf" : "human"}-${m.gender === "f" ? "female" : "male"}${base.startsWith("human") && m.gender !== "f" ? "-hairkey" : ""}`,
      hair: band === "elder" ? C.elderHair || "#c9c5bf" : ((C.hairCols || [])[look.hairCol | 0] || {}).col || "#5a3a24", house: E.houseColOf(s), scale: band === "child" ? W.childScale : 1,
      emoji: m.gender === "f" ? "👩" : "👨", job: job.key, home: home.key });
  }
  const prod = L.items.filter(i => i.img && !M.homeTypes.includes(i.type));
  const nw = Math.min(W.maxWorkers, (s.minions || []).length, Math.max(0, W.maxWalkers - out.length));
  for (let i = 0; i < nw; i++) {
    const job = prod.length ? prod[i % prod.length] : home;
    out.push({ id: "w" + i, name: "Follower", sheet: "walker-human-male-hairkey", hair: W.workerHair, house: W.workerTabard, scale: 1, emoji: "🧑", job: job.key, home: home.key, worker: true });
  }
  return out;
}
