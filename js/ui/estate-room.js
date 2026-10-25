// R66: building interiors. Tap a building on the estate map (or "Inside" in the List view) and the roof lifts off
// to show every placed furnishing, fitting, bought upgrade and production tier. Pure model (roomModel, no DOM, used by
// test/r66.test.mjs) + HTML. Display only: everything is derived from the structure's existing state, nothing is saved.
// Placeholders are the existing emoji; data/estaterooms.json `art` maps ids to webp files as room art arrives.
import { wander, penPositions, KIND_OPTS } from "./actors.js";
export function roomModel(E, R, st, s, classic) {
  const d = E.structDef(st.type) || {}, fam = R.typeRoom[st.type] || "home", room = R.rooms[fam] || R.rooms.home;
  // R72: art.chipIcons = exact upgrade name -> its own emoji, looked up ahead of the old regexes (R.upKeys: first match wins, so many upgrades shared an icon;
  // "Runed Circle" showed a chicken). Classic emoji mode (classic=true) keeps the old regex icons untouched.
  const CI = classic ? {} : (R.art || {}).chipIcons || {};
  const upIcon = n => CI[n] || (R.upKeys.find(([k]) => new RegExp(k).test(n)) || [0, R.upIcon])[1];
  // floor: placed pieces in order; stacking pieces (beds) are grouped into one cell with a ×N stack
  const floor = [];
  for (const pid of st.pieces || []) {
    const p = E.pieceDef(pid);
    if (!p) continue;
    const id = E.baseId(pid), prev = floor.find(c => c.id === id && p.stack);
    if (prev) { prev.n++; continue; }
    floor.push({ id, pid, icon: p.icon, name: p.name, n: 1, w: Math.min(2, Math.max(1, E.pieceSlots(pid) || 1)), fixed: E.isFixed(st, pid), tier: E.tierName(pid) });
  }
  const free = Math.max(0, s ? E.freeSlots(s, st) : 0);
  const wall = [
    ...(st.fittings || []).map(id => { const p = E.pieceDef(id) || {}; return { kind: "fit", id, icon: p.icon || "🔩", name: p.name || id }; }),
    ...E.boughtUps(st).map(u => ({ kind: "up", id: u.name, icon: upIcon(u.name), name: u.name })),
  ];
  const tier = E.prodTier(st);
  // R68: display-only starter kit (art.starters, no stats, not in the save) -> drawn as built-ins in the scene only
  const A0 = R.art || {}, SN = A0.starterNames || {};
  const starters = ((A0.starters || {})[st.type] || []).map(([id, n]) => { const p = E.pieceDef(id) || {}, nm = SN[id] || [];
    return { id, pid: id, icon: p.icon || nm[0] || "🪑", name: p.name || nm[1] || id, n, w: 1, fixed: true, starter: true }; });
  return { fam, type: st.type, starters, room, title: E.structName ? E.structName(st) : d.name, icon: d.icon || "🏠", floor, free, wall, tier: tier ? tier.name : "", tierN: st.tier || 0, art: R.art || {} };
}

const esc = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const tok = (A, key, icon, cls) => (A && A[key] ? `<img class="rmart${cls ? " " + cls : ""}" src="art/rooms/${A[key]}.webp" alt="">` : `<span class="rmemo${cls ? " " + cls : ""}">${icon}</span>`);

// R67: the roof-off picture. Pure layout in the room art's own 256x192 pixels: built-ins first, then placed pieces, then
// dashed free slots, on a 34x30 grid inside the floor rect, skipping the door and any blocked area (mill millstone,
// workshop forge front, dock water/jetty). Forge-height pieces go in the workshop forge front; finecornice on the back
// wall; boat slips on the dock jetty. Items that do not fit are left to the list below (n/a for current slot counts).
const hit = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
export function sceneLayout(R, M) {
  const A = R.art || {}, PT0 = (A.painted || {})[M.type] || {}, PT = PT0.room ? PT0 : { ...((A.paintedFam || {})[M.fam] || {}), ...PT0 }, fam = PT.room || M.fam, rc = (A.rects || {})[fam];
  if (!rc) return null;
  // R69: optional zone fields on a room rect (painted rooms): floor_large = the only area for floor furniture and storage upgrades,
  // wall_strip = the only area for wall pieces, paths = walk areas kept clear, workspots = where workers stand (data only)
  const F = rc.floor_large || rc.floor, out = [], block = [rc.door, rc.millstone, rc.forge_piece_front, rc.water, rc.jetty, ...Object.values(rc.paths || {})].filter(Boolean);
  out.fam = fam; out.work = rc.workspots || {};
  // R72: rooms may be bigger than 256x192 (manor rooms 320x224): rc.w / rc.h
  out.w = rc.w || 256; out.h = rc.h || 192;
  // R73: rc.pen = the aisle where pen animals walk, rc.bees = the box the swarm flies in, F = the floor box (stall animals); display only
  // R73b: rc.pen is now the whole open floor (not just the aisle), rc.penStops / rc.beeStops = optional trough / hive visits, out.floor + out.hard = what stall animals must stand clear of
  out.pen = rc.pen || null; out.bees = rc.bees || null; out.F = F; out.penStops = rc.penStops || []; out.beeStops = rc.beeStops || []; out.floor = rc.floor || F;
  // R72: rc.pins = {piece id: slot box}: tier-fixed pieces (brewery winepress/stillpot, quarry limecut/granitecut) sit in their painted 34x34 slot, which no other piece may use
  const pins = rc.pins || {}; for (const k in pins) block.push(pins[k]);
  // R68.2: fixtures painted into the background ARE the built-ins: no sprite, a hit area at the painted box; owned
  // copies merge into it; `onto` pieces/fittings become add-ons on it; layout avoids every painted/decor box
  const PF = PT.fix || {}, onto = PT.onto || {}, PN = A.paintedNames || {}, paint = {}, addOn = [];
  for (const id in PF) { block.push(PF[id]); paint[id] = { id, icon: (A.starterNames || {})[id]?.[0] || "", name: PN[id] || id, n: 0, fixed: true }; }
  for (const b of PT.decor || []) block.push(b);
  // R70: PT.as = {piece id: painted fixture id}: that piece IS the painted fixture (kitchen hearth piece -> the painted hearth), no second sprite
  const take = c => { const al = (PT.as || {})[c.id]; if (al && paint[al]) { paint[al].n += c.n || 1; return false; }
    if (paint[c.id]) { const p = paint[c.id]; p.n += c.n || 1; p.name = c.name || p.name; p.icon = c.icon || p.icon; return false; }
    if (onto[c.id] && paint[onto[c.id][0]]) { addOn.push({ ...c, host: onto[c.id][0], side: onto[c.id][1] }); return false; } return true; };
  const onWall = new Set(A.onWall || []), upP = A.upPieces || {}, beside = A.beside || {};
  // R71: PT.attach = {upgrade name: {host, side}} for this painted type only (overrides art.attach, and the upgrade is then NOT also a wall piece)
  const AT = { ...(A.attach || {}), ...(PT.attach || {}) }, ownAt = PT.attach || {};
  // starters merge into the matching placed entry (bought bunks stack onto the starting bunks)
  const fl = M.floor.map(c => ({ ...c })), st = [];
  for (const s of M.starters || []) { const sa = (PT.starterAs || {})[s.id]; if (sa && sa.every(id => PF[id])) { sa.forEach(id => paint[id].n++); continue; } /* R70: starters that ARE painted fixtures (bunkhouse bunks) */ const m = fl.find(c => c.id === s.id); if (m) { m.n += s.n; m.fixed = true; } else st.push({ ...s }); }
  if (Object.keys(PF).length) { const k1 = fl.filter(take), k2 = st.filter(take); fl.length = 0; fl.push(...k1); st.length = 0; st.push(...k2);
    for (const w of M.wall || []) if (w.kind === "fit" && onto[w.id] && paint[onto[w.id][0]]) addOn.push({ ...w, n: 1, host: onto[w.id][0], side: onto[w.id][1] });
    for (const id in paint) { const b = PF[id], p = paint[id]; out.push({ at: "painted", id, x: b[0], y: b[1], w: b[2] - b[0], h: b[3] - b[1], box: b, name: p.name, n: Math.max(1, p.n), fixed: true }); } }
  // pieces placed beside a rect (smithy anvil right of the forge front)
  for (const c of st) { const k = beside[c.id] && rc[beside[c.id]]; if (k) { c.at = "beside"; const b = [k[2] + 5, k[1] + 7, k[2] + 37, k[1] + 39]; out.push({ at: "floor", x: b[0], y: b[1], id: c.id, icon: c.icon, name: c.name, n: c.n, fixed: true }); block.push(b); } }
  const spots = [];
  for (let y = F[1] + 1; y + 32 <= F[3] + 1; y += 30) for (let x = F[0] + 1; x + 32 <= F[2] + 1; x += 34) {
    const b = [x + 2, y + 4, x + 30, y + 31];
    if (!block.some(k => hit(b, k))) spots.push([x, y]);
  }
  // R68.2: painted rooms are crowded, so search the open floor on an 8px grid instead of the 34x30 grid (INVENTED)
  if (Object.keys(PF).length) { spots.length = 0; const taken = [];
    // R71: rc.spotFlush starts the search ON the zone's top-left (x0,y0) instead of 1px in, so a 96px-wide floor_large holds 3 columns, not 2 (INVENTED)
    const o = rc.spotFlush ? 0 : 1;
    for (let y = F[1] + o; y + 32 <= F[3] + 1; y += 8) for (let x = F[0] + o; x + 32 <= F[2] + 1; x += 8) {
      const b = [x + 2, y + 4, x + 30, y + 31];
      if (!block.some(k => hit(b, k)) && !taken.some(k => hit(b, k))) { spots.push([x, y]); taken.push(b); } } }
  const fixed = [...fl.filter(c => c.fixed && !c.starter), ...st.filter(c => !c.at)], rest = fl.filter(c => !c.fixed);
  // R68 wall layer: built-ins, then bought upgrades (art.upPieces), then furnishings; one sprite + xN per id; 7 slots
  const wallC = [];
  const addW = c => { const m = wallC.find(w => w.id === c.id); if (m) m.n += c.n; else wallC.push({ ...c }); };
  if (rc.backwall) {
    for (const c of fixed) if (onWall.has(c.id) && c.id !== "finecornice") addW(c);
    for (const u of M.wall || []) if (u.kind === "up" && upP[u.id] && !ownAt[u.id]) { const p = upP[u.id]; addW({ id: p, icon: u.icon, name: u.name, n: 1, fixed: false }); }
    for (const c of rest) if (onWall.has(c.id) && c.id !== "finecornice") addW(c);
  }
  // R68.2: rooms with painted fixtures: wall slots are the 32px positions that miss every painted box
  let pSlots = null;
  if (rc.backwall && (Object.keys(PF).length || rc.wall_strip)) { const W = rc.wall_strip || rc.backwall, [x0, x1] = rc.wall_strip ? [W[0], W[2] + 1] : PT.wallX || A.wallX || [16, 240], y = Math.max(0, W[3] + 1 - 25);
    // R71: rc.wallPx = smaller wall-piece size for a narrow strip (kitchen 47px wide: 2 x 23px instead of 1 x 32px); the art's own piece size is 24px (INVENTED 23)
    const wpx = rc.wallPx || 32, wy = rc.wallPx ? Math.max(0, W[3] - wpx) : y, wh = rc.wallPx ? wpx : 25;
    pSlots = []; for (let x = x0; x + wpx <= x1; x += wpx) if (!Object.values(PF).some(b => hit([x, wy, x + wpx, wy + wh], b))) pSlots.push([x, wy]); }
  const N = pSlots ? pSlots.length : A.wallSlots || 7, onW = wallC.slice(0, N), over = wallC.slice(N);
  const isW = c => rc.backwall && onWall.has(c.id) && c.id !== "finecornice";
  if (onW.length && pSlots) onW.forEach((c, k) => out.push({ at: "wall", slot: k, x: pSlots[k][0], y: pSlots[k][1], s: rc.wallPx ? rc.wallPx / 32 : 1, id: c.id, icon: c.icon, name: c.name, n: c.n, fixed: c.fixed }));
  else if (onW.length) {
    const W = rc.backwall, [x0, x1] = A.wallX || [16, 240], big = A.bigWall && W[3] - W[1] + 1 >= A.bigWall.minH;
    const sc = big ? A.bigWall.scale : 1, sz = Math.round(32 * sc);
    const y = Math.max(0, W[3] + 1 - Math.round(25 * sc));
    // normal walls: 7 fixed 32px slots, the group centred on the wall; big walls: spread evenly (INVENTED)
    const pitch = big ? (x1 - x0) / onW.length : 32, gx = big ? x0 + pitch / 2 - sz / 2 : Math.round((x0 + x1) / 2 - (onW.length * 32) / 2);
    onW.forEach((c, k) => out.push({ at: "wall", slot: k, x: Math.round(big ? gx + k * pitch : gx + k * 32), y, s: sc, id: c.id, icon: c.icon, name: c.name, n: c.n, fixed: c.fixed }));
  }
  const special = c => {
    if ((A.forgeFront || []).includes(c.id) && rc.forge_piece_front && !out.some(o => o.at === "forge")) return { at: "forge", x: rc.forge_piece_front[0] + 4, y: rc.forge_piece_front[1] };
    if (c.id === "finecornice" && rc.backwall) { const z = rc.wall_strip || rc.backwall; return { at: "cornice", x: Math.round((z[0] + z[2]) / 2) - 16, y: z[1] }; }
    if ((A.onJetty || []).includes(c.id) && rc.jetty && !out.some(o => o.at === "jetty")) return { at: "jetty", x: rc.jetty[0], y: Math.max(rc.jetty[1], rc.jetty[3] - 32) };
    return null;
  };
  // overflow (past 7 distinct wall ids) falls back to the floor; upgrade pieces too
  const items = [...fixed.filter(c => !isW(c)), ...rest.filter(c => !isW(c)), ...over];
  let i = 0;
  // R72: rc.bedFar (homes, manor rooms): beds fill floor spots from the FAR end of floor_large, everything else from the near end, so a bed never lands beside a hearth
  const bedSet = new Set(rc.bedFar ? A.beds || [] : []), nb = items.filter(c => bedSet.has(c.id) && !pins[c.id] && !special(c)).length;
  let jb = 0;
  for (const c of items) {
    const pin = pins[c.id];
    let sp = special(c);
    if (!sp && pin) sp = { at: "floor", x: pin[0] + 1, y: pin[1] + 1 };
    else if (!sp && bedSet.has(c.id)) { const q = spots.length - 1 - jb; if (q >= i) { sp = { at: "floor", x: spots[q][0], y: spots[q][1] }; jb++; } }
    else if (!sp && i < spots.length - nb) sp = { at: "floor", x: spots[i][0], y: spots[i++][1] };
    if (sp) out.push({ ...sp, id: c.id, icon: c.icon, name: c.name, n: c.n, fixed: c.fixed, over: over.includes(c) || undefined });
  }
  for (let k = 0; k < M.free && i < spots.length - nb; k++, i++) out.push({ at: "free", x: spots[i][0], y: spots[i][1] });
  // R68.1: upgrades tied to a fixture are drawn onto it (bellows on the forge side), not as loose pieces
  const used = {};
  const put = (host, side0, u, key) => { const h = out.find(o => o.id === host && o.at !== "free" && o.at !== "attach"); if (!h) return;
    let side = side0; if (used[host + side]) side = ["t", "r", "l", "b"].find(q => !used[host + q]) || side0; used[host + side] = 1;
    // painted hosts: offsets from the painted box (INVENTED); sprites: the R68.1 offsets on a 32px piece
    const d = h.box ? { l: [-6, h.h / 2 - 8], r: [h.w - 10, h.h / 2 - 8], t: [h.w / 2 - 8, -6], b: [h.w / 2 - 8, h.h - 10] }[side] : { l: [-6, 14], r: [22, 14], t: [8, -6], b: [8, 22] }[side];
    // R69: a room rect can pin an add-on's art to an exact anchor box (rc.anchors[art id]), size included
    // R70: rc.upAnchors = {upgrade name: anchor name} pins an add-on that has no art yet at the same kind of box (emoji placeholder)
    const art = (A.attachArt || {})[key], an = (art && (rc.anchors || {})[art]) || (rc.anchors || {})[(rc.upAnchors || {})[key]];
    out.push(an ? { at: "attach", host, side, up: key, x: an[0], y: an[1], w: an[2] - an[0] + 1, h: an[3] - an[1] + 1, icon: (A.upPlaceholder || {})[key] || u.icon, name: u.name, art }
      : { at: "attach", host, side, up: key, x: Math.round(h.x + d[0]), y: Math.round(h.y + d[1]), icon: (A.upPlaceholder || {})[key] || u.icon, name: u.name, art }); };
  for (const u of M.wall || []) { const a = u.kind === "up" && AT[u.id]; if (a) put(a.host, a.side, u, u.id); }
  for (const c of addOn) { put(c.host, c.side, c, c.id); const o = out.at(-1); if (o && o.up === c.id) o.id = c.id; }
  const walk = Object.values(rc.paths || {});
  out.hard = block.filter(b => !walk.includes(b));   // R73b: everything solid (door, fixtures, pins...), the walk paths excluded
  return out;
}
// R72: the manor suite. Mansion / Fort / Tower Keep / Abbey show a tab strip and one painted room at a time (320x224 art, keys "manor:<room>").
// Pure view over the building's existing state: every owned piece / fitting / starter is routed to a room by art.manor.route (+ over[type]); a room
// that is still locked, or an id the table does not name, falls back to the Great Hall, so nothing can disappear. Nothing is saved or granted.
// Open from the start: Great Hall, Bedchamber (not the Fort), Kitchen and the branch wing. Study / Workshop / Nursery / Cellar open while the family
// owns one of their listed pieces or fittings (computed on every render).
export function manorInfo(R, M, sel) {
  const MA = (R.art || {}).manor, T = MA && MA.types && MA.types[M.type];
  if (!T || !MA.rooms) return null;
  const ov = ((MA.route.over || {})[M.type]) || {}, route = (kind, id) => (ov[kind] || {})[id] || (MA.route[kind] || {})[id] || "hall";
  const drop = T.drop || [], base = ["hall", "bedchamber", "kitchen", T.wing].filter(r => !drop.includes(r)), open = new Set(base);
  const owned = { piece: M.floor.map(c => c.id), fit: M.wall.filter(w => w.kind === "fit").map(w => w.id) };
  for (const r in MA.unlock || {}) if (!drop.includes(r) && ["piece", "fit"].some(k => owned[k].some(id => ((MA.unlock[r] || {})[k] || []).includes(id) && route(k, id) === r))) open.add(r);
  const where = (kind, id) => { const r = route(kind, id); return open.has(r) ? r : "hall"; };
  const order = [...base, ...Object.keys(MA.unlock || {}).filter(r => !drop.includes(r))];
  const cur = open.has(sel) ? sel : "hall";
  const count = r => M.floor.filter(c => where("piece", c.id) === r).reduce((a, c) => a + c.n, 0) + M.wall.filter(w => w.kind === "fit" && where("fit", w.id) === r).length;
  const tabs = order.map(r => ({ id: r, name: MA.rooms[r].name, icon: MA.rooms[r].icon, open: open.has(r), on: r === cur, n: open.has(r) ? count(r) : 0, hint: (MA.hint || {})[r] || "", short: (MA.short || {})[r] || "" }));
  const key = "manor:" + cur;
  // the view model for the selected room: only its pieces, starters and fittings (free-slot markers live in the Great Hall)
  const V = { ...M, type: key, fam: key, floor: M.floor.filter(c => where("piece", c.id) === cur), starters: (M.starters || []).filter(c => where("piece", c.id) === cur),
    wall: M.wall.filter(w => w.kind === "fit" && where("fit", w.id) === cur), free: cur === "hall" ? M.free : 0 };
  return { tabs, cur, V, where, open };
}
const P = (v, d) => +((v / d) * 100).toFixed(2) + "%";
// R73: animals in the roof-off picture, computed from what the player owns (act = actors.js roomActors). The sprites sit at their
// time-0 spot in the HTML (so the markup is static and a re-render never replaces it); actors-dom.js moves them with wander(seed, t).
function actorsHtml(L, W, H, A, act) {
  if (!act) return "";
  let h = "";
  // one animated sprite: idle sheet (name) and/or walk strip (walk); ox = px offset from the shared path (a pair of hens), fo = frame offset;
  // p = its time-0 spot, grp/gi/md = the pen it belongs to, its place in it and the distance the pen keeps between its animals
  const sp = (k, name, seed, fb, o, walk, ox, fo, p, grp, gi, md, stops) => {
    const I = name && act.sheets[name], Wk = walk && act.sheets[walk], S = I || Wk; if (!S) return "";
    return `<span class="rmact rm-${k}" data-sp="${name || walk}" data-k="${k}" data-seed="${seed}" data-grp="${grp}" data-gi="${gi}" data-md="${md}" data-box="${fb.map(v => +v.toFixed(2)).join(",")}" data-fw="${S.fw}" data-fh="${S.fh}" data-cols="${S.cols}" data-w="${W}" data-h="${H}"` +
      (stops && stops.length ? ` data-stops="${stops.map(s => s.join(",")).join(";")}"` : "") +
      (I ? ` data-iu="${I.file}" data-ic="${I.cols}"` : "") + (Wk ? ` data-wu="${Wk.file}" data-wc="${Wk.cols}"` : "") + (ox ? ` data-ox="${ox}"` : "") + (fo ? ` data-fo="${fo}"` : "") +
      `${o.still ? ' data-still="1"' : ""} style="left:${P(p.x + ox - S.fw / 2, W)};top:${P(p.y - S.fh, H)};width:${P(S.fw, W)};height:${P(S.fh, H)};background-image:url(${S.file});background-size:${S.cols * 100}% 100%"></span>`;
  };
  // a pen group: n units (a unit = one animal, or a pair of hens side by side), all in the same feet box, kept >= a unit width + 8px apart (bees 4)
  const group = (k, name, walk, n, per, box, o, stops) => {
    const S = (name && act.sheets[name]) || (walk && act.sheets[walk]); if (!S || !n) return "";
    const gap = S.fw + 2, m = (per - 1) / 2 * gap, fb = [box[0] + S.fw / 2 + m, Math.min(box[1] + S.fh, box[3]), box[2] - S.fw / 2 - m, box[3]], md = +(S.fw + (per - 1) * gap + (k === "bees" ? 4 : 8)).toFixed(2);
    const seeds = Array.from({ length: n }, (_, i) => `${act.seed}:${k}:${i}`), ps = penPositions(seeds, 0, fb, { ...(KIND_OPTS[k] || {}), still: true, stops }, md);
    let s = "";
    for (let i = 0; i < n; i++) for (let j = 0; j < per; j++) s += sp(k, name, seeds[i], fb, o, walk, per > 1 ? +((j - (per - 1) / 2) * gap).toFixed(2) : 0, j, ps[i], `${act.seed}:${k}`, i, md, stops);
    return s;
  };
  if (act.pen && L.pen) h += group("pen", act.pen.sheet, act.pen.walk, act.pen.n, act.pen.per || 1, [L.pen[0], L.pen[1], L.pen[2], Math.min(L.pen[3], 150)], act.pen, L.penStops);
  if (act.bees && L.bees) h += group("bees", "bees-swarm", null, act.bees, 1, L.bees, {}, L.beeStops);
  if (act.draft && act.draft.length) {
    // R73b: stall animals stand on clear floor: the first spot next to the stall piece that misses the stall, every other fixture / piece /
    // free slot and the animals already placed (2px gap), searched on a 4px grid inside the room floor, nearest to the stall first
    const c = L.find(o => o.id === "stablestall" && o.at === "floor"), Fl = L.floor || L.F || [16, 46, 240, 157], dims = act.draft.map(a => { const S = a.sheet && act.sheets[a.sheet]; return S ? [S.fw, S.fh] : [24, 24]; });
    const solid = [...(L.hard || [])], soft = [];
    for (const o of L) {
      if (o.at === "painted") solid.push([o.x, o.y, o.x + o.w, o.y + o.h]);
      else if (o.at === "attach") solid.push([o.x, o.y, o.x + (o.w || 16), o.y + (o.h || 16)]);
      else if (o.at === "free") soft.push([o.x, o.y + 4, o.x + 32, o.y + 31]);
      else if (o.at === "floor" || o.at === "forge" || o.at === "jetty") for (let q = 0, n = Math.min(o.n || 1, 4); q < n; q++) solid.push([o.x + 2 + q * 5, o.y + 4 - q * 3, o.x + 30 + q * 5, o.y + 31 - q * 3]);
    }
    const ax = c ? c.x + 34 : Fl[0] + 4, ay = c ? c.y + 31 : Fl[3] - 2, placed = [];
    const spot = (w, hh, useSoft) => {
      let best = null, bd = 1e9;
      for (let y = Fl[1] + hh; y <= Fl[3] - 1; y += 2) for (let x = Fl[0] + 1; x + w <= Fl[2]; x += 2) {
        const b = [x, y - hh, x + w, y], g = [x - 2, y - hh - 2, x + w + 2, y + 2];
        if (solid.some(k => hit(b, k)) || placed.some(k => hit(g, k)) || (useSoft && soft.some(k => hit(b, k)))) continue;
        const d = Math.abs(x - ax) + 1.5 * Math.abs(y - ay);
        if (d < bd) { bd = d; best = [x, y]; }
      }
      return best;
    };
    act.draft.forEach((a, k) => {
      const S = a.sheet && act.sheets[a.sheet], [w, hh] = dims[k], q = spot(w, hh, true) || spot(w, hh, false) || [ax, ay];
      placed.push([q[0], q[1] - hh, q[0] + w, q[1]]);
      const px = q[0], py = q[1] - 24, mir = c && px + w / 2 < c.x + 16;
      if (S) h += `<span class="rmact rmdraft" data-stand="1" data-sp="${a.sheet}" data-seed="${act.seed}:draft:${k}" data-ph="${k * 0.37}" data-cols="${S.cols}" data-iu="${S.file}" data-ic="${S.cols}" title="${esc(a.name)}" style="left:${P(px, W)};top:${P(py + 24 - S.fh, H)};width:${P(S.fw, W)};height:${P(S.fh, H)};background-image:url(${S.file});background-size:${S.cols * 100}% 100%${mir ? ";transform:scaleX(-1)" : ""}"></span>`;
      else h += `<img class="rmact rmdraft" src="${a.file}" alt="" title="${esc(a.name)}" style="left:${P(px, W)};top:${P(py, H)};width:${P(24, W)};height:${P(24, H)}">`;
    });
  }
  return h;
}
function sceneHtml(R, M, A, act) {
  const L = sceneLayout(R, M);
  if (!L || !A.rooms || !A.rooms[L.fam]) return "";
  const W = L.w, H = L.h;   // R72: room size (256x192 unless the rect says w/h, e.g. manor rooms 320x224)
  const img = (c, dx = 0, dy = 0) => {
    const sz = c.s && c.s !== 1 ? `;width:${P(32 * c.s, W)};height:${P(32 * c.s, H)}` : "", tn = (A.tints || {})[c.id];
    const st = `left:${P(c.x + dx, W)};top:${P(c.y + dy, H)}${sz}`;
    return A.pieces && A.pieces[c.id] ? `<img class="rmsp${c.at === "wall" ? " rmwl" : ""}${tn ? " rmt-" + tn : ""}" style="${st}" src="art/rooms/${A.pieces[c.id]}.webp" alt="">` : `<span class="rmsp rmemo" style="${st}">${c.icon}</span>`;
  };
  let h = "";
  for (const c of L) {
    if (c.at === "attach") { const st = `left:${P(c.x, W)};top:${P(c.y, H)}${c.w ? `;width:${P(c.w, W)};height:${P(c.h, H)}` : ""}`; h += c.art ? `<img class="rmsp rmatt" style="${st}" src="art/rooms/${c.art}.webp" alt="" title="${esc(c.name)}">` : `<span class="rmsp rmatt rmemo" style="${st}${c.w ? `;display:flex;align-items:center;justify-content:center;line-height:1;font-size:${+(Math.min(c.w, c.h) * 0.8 / (W / 100)).toFixed(2)}cqw` : ""}" title="${esc(c.name + " (on " + c.host + ")")}">${c.icon}</span>`; continue; }
    if (c.at === "painted") { h += `<span class="rmsp rmhit" data-fix="${c.id}" style="left:${P(c.x, W)};top:${P(c.y, H)};width:${P(c.w, W)};height:${P(c.h, H)}" title="${esc(c.name + (c.n > 1 ? " ×" + c.n : "") + " · built-in")}"></span>`; continue; }
    if (c.at === "free") { h += `<span class="rmsp rmfree" style="left:${P(c.x, W)};top:${P(c.y, H)}" title="Free slot"></span>`; continue; }
    const n = c.at === "wall" ? 1 : Math.min(c.n || 1, 4);
    h += `<span class="rmgrp" title="${esc(c.name + (c.n > 1 ? " ×" + c.n : "") + (c.fixed ? " · built-in" : ""))}">`;
    for (let k = n - 1; k >= 0; k--) h += img(c, k * 5, -k * 3);
    if (c.n > 1) h += `<b class="rmn rmsn" style="left:${P(c.x + (c.at === "wall" ? 32 * (c.s || 1) - 10 : 22), W)};top:${P(c.y, H)}">×${c.n}</b>`;
    h += `</span>`;
  }
  h += actorsHtml(L, W, H, A, act);
  return `<div class="rmscene" style="background-image:url(art/rooms/${A.rooms[L.fam]}.webp)${W === 256 && H === 192 ? "" : `;--rw:${W};--rh:${H}`}">${h}</div>`;
}

// opened: ms timestamp the room was opened (so re-renders keep the roof animation where it was, not restart it)
export function roomHtml(E, R, s, st, opened, classic, manorSel, act) {
  const M = roomModel(E, R, st, s, classic), cols = R.cols || 6, A = classic ? {} : M.art;
  const used = M.floor.reduce((a, c) => a + c.w, 0), cells = Math.max(cols * (R.minRows || 2), Math.ceil((used + M.free) / cols) * cols);
  const MI = classic ? null : manorInfo(R, M, manorSel);
  let h = "";
  for (const c of M.floor)
    h += `<div class="rmcell${c.fixed ? " fixed" : ""}${c.w > 1 ? " w2" : ""}" title="${esc(c.name + (c.n > 1 ? " ×" + c.n : "") + (c.tier ? " · " + c.tier : "") + (c.fixed ? " · built-in" : ""))}">` +
      (c.n > 1 ? `<span class="rmstack">${Array.from({ length: Math.min(c.n, 4) }, (_, i) => `<span style="--i:${i}">${tok(A.pieces, c.id, c.icon)}</span>`).join("")}</span><b class="rmn">×${c.n}</b>` : tok(A.pieces, c.id, c.icon)) +
      `<small>${esc(c.name)}</small></div>`;
  for (let i = 0; i < M.free; i++) h += `<div class="rmcell empty" title="Free slot"><small>free</small></div>`;
  for (let i = used + M.free; i < cells; i++) h += `<div class="rmcell pad"></div>`;
  const wall = M.wall.map(w => `<span class="rmfix ${w.kind}" title="${esc((w.kind === "up" ? "Upgrade: " : "Fitting: ") + w.name)}">${tok(w.kind === "up" ? A.ups : A.pieces, w.id, (w.kind === "up" && (A.upPlaceholder || {})[w.id]) || w.icon)}<small>${esc(w.name)}</small></span>`).join("");
  const age = Math.max(0, Date.now() - (opened || 0)), anim = age < 900 ? ` style="animation-delay:-${age}ms"` : "";
  const r = M.room, bg = "";
  return `<div class="estroom rm-${M.fam}${M.tierN ? " tier" + M.tierN : ""}" data-uid="${st.uid}" style="--fl:${r.floor};--fl2:${r.floor2};--wl:${r.wall};--rf:${r.roof}${bg}">` +
    `<div class="rmhead"><b>${M.icon} ${esc(M.title)}</b><span class="muted">${esc(r.name)}${M.tier ? " · " + R.tierIcon + " " + esc(M.tier) : ""} · ${M.floor.reduce((a, c) => a + c.n, 0)} placed${M.wall.length ? " · " + M.wall.length + " upgrades/fittings" : ""}</span><button class="b" data-a="estroom" data-v="${st.uid}" title="Close the interior">✕</button></div>` +
    `<div class="rmwall">${wall || '<span class="muted rmnone">No upgrades yet</span>'}</div>` +
    (MI ? `<div class="rmtabs" role="tablist">${MI.tabs.map(t => t.open
      ? `<button class="b rmtab${t.on ? " on" : ""}" role="tab" aria-selected="${t.on}" data-a="manorroom" data-v="${st.uid}" data-w="${t.id}" title="${esc(t.name)}">${t.icon} ${esc(t.name)}${t.n ? `<i>${t.n}</i>` : ""}</button>`
      : `<button class="b rmtab lock" role="tab" aria-disabled="true" disabled title="${esc("Locked: " + t.hint)}">🔒 ${esc(t.name)}${t.short ? `<small>${esc(t.short)}</small>` : ""}</button>`).join("")}</div>` : "") +
    sceneHtml(R, MI ? MI.V : M, A, classic || !act ? null : MI ? { ...act, stable: false, pen: null, bees: 0 } : act) +
    `<div class="rmfloor${A.rooms && A.rooms[M.fam] ? " legend" : ""}" style="grid-template-columns:repeat(${cols},1fr)">${h}</div>` +
    (age < 900 ? `<div class="rmroof"${anim}></div>` : "") + `</div>`;
}
