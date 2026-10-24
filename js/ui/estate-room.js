// R66: building interiors. Tap a building on the estate map (or "Inside" in the List view) and the roof lifts off
// to show every placed furnishing, fitting, bought upgrade and production tier. Pure model (roomModel, no DOM, used by
// test/r66.test.mjs) + HTML. Display only: everything is derived from the structure's existing state, nothing is saved.
// Placeholders are the existing emoji; data/estaterooms.json `art` maps ids to webp files as room art arrives.
export function roomModel(E, R, st, s) {
  const d = E.structDef(st.type) || {}, fam = R.typeRoom[st.type] || "home", room = R.rooms[fam] || R.rooms.home;
  const upIcon = n => (R.upKeys.find(([k]) => new RegExp(k).test(n)) || [0, R.upIcon])[1];
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
    for (let y = F[1] + 1; y + 32 <= F[3] + 1; y += 8) for (let x = F[0] + 1; x + 32 <= F[2] + 1; x += 8) {
      const b = [x + 2, y + 4, x + 30, y + 31];
      if (!block.some(k => hit(b, k)) && !taken.some(k => hit(b, k))) { spots.push([x, y]); taken.push(b); } } }
  const fixed = [...fl.filter(c => c.fixed && !c.starter), ...st.filter(c => !c.at)], rest = fl.filter(c => !c.fixed);
  // R68 wall layer: built-ins, then bought upgrades (art.upPieces), then furnishings; one sprite + xN per id; 7 slots
  const wallC = [];
  const addW = c => { const m = wallC.find(w => w.id === c.id); if (m) m.n += c.n; else wallC.push({ ...c }); };
  if (rc.backwall) {
    for (const c of fixed) if (onWall.has(c.id) && c.id !== "finecornice") addW(c);
    for (const u of M.wall || []) if (u.kind === "up" && upP[u.id]) { const p = upP[u.id]; addW({ id: p, icon: u.icon, name: u.name, n: 1, fixed: false }); }
    for (const c of rest) if (onWall.has(c.id) && c.id !== "finecornice") addW(c);
  }
  // R68.2: rooms with painted fixtures: wall slots are the 32px positions that miss every painted box
  let pSlots = null;
  if (rc.backwall && (Object.keys(PF).length || rc.wall_strip)) { const W = rc.wall_strip || rc.backwall, [x0, x1] = rc.wall_strip ? [W[0], W[2] + 1] : PT.wallX || A.wallX || [16, 240], y = Math.max(0, W[3] + 1 - 25);
    pSlots = []; for (let x = x0; x + 32 <= x1; x += 32) if (!Object.values(PF).some(b => hit([x, y, x + 32, y + 25], b))) pSlots.push([x, y]); }
  const N = pSlots ? pSlots.length : A.wallSlots || 7, onW = wallC.slice(0, N), over = wallC.slice(N);
  const isW = c => rc.backwall && onWall.has(c.id) && c.id !== "finecornice";
  if (onW.length && pSlots) onW.forEach((c, k) => out.push({ at: "wall", slot: k, x: pSlots[k][0], y: pSlots[k][1], s: 1, id: c.id, icon: c.icon, name: c.name, n: c.n, fixed: c.fixed }));
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
  for (const c of items) {
    const sp = special(c) || (spots[i] ? { at: "floor", x: spots[i][0], y: spots[i++][1] } : null);
    if (sp) out.push({ ...sp, id: c.id, icon: c.icon, name: c.name, n: c.n, fixed: c.fixed, over: over.includes(c) || undefined });
  }
  for (let k = 0; k < M.free && spots[i]; k++, i++) out.push({ at: "free", x: spots[i][0], y: spots[i][1] });
  // R68.1: upgrades tied to a fixture are drawn onto it (bellows on the forge side), not as loose pieces
  const AT = A.attach || {}, used = {};
  const put = (host, side0, u, key) => { const h = out.find(o => o.id === host && o.at !== "free" && o.at !== "attach"); if (!h) return;
    let side = side0; if (used[host + side]) side = ["t", "r", "l", "b"].find(q => !used[host + q]) || side0; used[host + side] = 1;
    // painted hosts: offsets from the painted box (INVENTED); sprites: the R68.1 offsets on a 32px piece
    const d = h.box ? { l: [-6, h.h / 2 - 8], r: [h.w - 10, h.h / 2 - 8], t: [h.w / 2 - 8, -6], b: [h.w / 2 - 8, h.h - 10] }[side] : { l: [-6, 14], r: [22, 14], t: [8, -6], b: [8, 22] }[side];
    // R69: a room rect can pin an add-on's art to an exact anchor box (rc.anchors[art id]), size included
    // R70: rc.upAnchors = {upgrade name: anchor name} pins an add-on that has no art yet at the same kind of box (emoji placeholder)
    const art = (A.attachArt || {})[key], an = (art && (rc.anchors || {})[art]) || (rc.anchors || {})[(rc.upAnchors || {})[key]];
    out.push(an ? { at: "attach", host, side, up: key, x: an[0], y: an[1], w: an[2] - an[0] + 1, h: an[3] - an[1] + 1, icon: u.icon, name: u.name, art }
      : { at: "attach", host, side, up: key, x: Math.round(h.x + d[0]), y: Math.round(h.y + d[1]), icon: u.icon, name: u.name, art }); };
  for (const u of M.wall || []) { const a = u.kind === "up" && AT[u.id]; if (a) put(a.host, a.side, u, u.id); }
  for (const c of addOn) { put(c.host, c.side, c, c.id); const o = out.at(-1); if (o && o.up === c.id) o.id = c.id; }
  return out;
}
const P = (v, d) => +((v / d) * 100).toFixed(2) + "%";
function sceneHtml(R, M, A) {
  const L = sceneLayout(R, M);
  if (!L || !A.rooms || !A.rooms[L.fam]) return "";
  const img = (c, dx = 0, dy = 0) => {
    const sz = c.s && c.s !== 1 ? `;width:${P(32 * c.s, 256)};height:${P(32 * c.s, 192)}` : "", tn = (A.tints || {})[c.id];
    const st = `left:${P(c.x + dx, 256)};top:${P(c.y + dy, 192)}${sz}`;
    return A.pieces && A.pieces[c.id] ? `<img class="rmsp${c.at === "wall" ? " rmwl" : ""}${tn ? " rmt-" + tn : ""}" style="${st}" src="art/rooms/${A.pieces[c.id]}.webp" alt="">` : `<span class="rmsp rmemo" style="${st}">${c.icon}</span>`;
  };
  let h = "";
  for (const c of L) {
    if (c.at === "attach") { const st = `left:${P(c.x, 256)};top:${P(c.y, 192)}${c.w ? `;width:${P(c.w, 256)};height:${P(c.h, 192)}` : ""}`; h += c.art ? `<img class="rmsp rmatt" style="${st}" src="art/rooms/${c.art}.webp" alt="" title="${esc(c.name)}">` : `<span class="rmsp rmatt rmemo" style="${st}${c.w ? `;display:flex;align-items:center;justify-content:center;line-height:1;font-size:${+(Math.min(c.w, c.h) * 0.8 / 2.56).toFixed(2)}cqw` : ""}" title="${esc(c.name + " (on " + c.host + ")")}">${c.icon}</span>`; continue; }
    if (c.at === "painted") { h += `<span class="rmsp rmhit" data-fix="${c.id}" style="left:${P(c.x, 256)};top:${P(c.y, 192)};width:${P(c.w, 256)};height:${P(c.h, 192)}" title="${esc(c.name + (c.n > 1 ? " ×" + c.n : "") + " · built-in")}"></span>`; continue; }
    if (c.at === "free") { h += `<span class="rmsp rmfree" style="left:${P(c.x, 256)};top:${P(c.y, 192)}" title="Free slot"></span>`; continue; }
    const n = c.at === "wall" ? 1 : Math.min(c.n || 1, 4);
    h += `<span class="rmgrp" title="${esc(c.name + (c.n > 1 ? " ×" + c.n : "") + (c.fixed ? " · built-in" : ""))}">`;
    for (let k = n - 1; k >= 0; k--) h += img(c, k * 5, -k * 3);
    if (c.n > 1) h += `<b class="rmn rmsn" style="left:${P(c.x + (c.at === "wall" ? 32 * (c.s || 1) - 10 : 22), 256)};top:${P(c.y, 192)}">×${c.n}</b>`;
    h += `</span>`;
  }
  return `<div class="rmscene" style="background-image:url(art/rooms/${A.rooms[L.fam]}.webp)">${h}</div>`;
}

// opened: ms timestamp the room was opened (so re-renders keep the roof animation where it was, not restart it)
export function roomHtml(E, R, s, st, opened, classic) {
  const M = roomModel(E, R, st, s), cols = R.cols || 6, A = classic ? {} : M.art;
  const used = M.floor.reduce((a, c) => a + c.w, 0), cells = Math.max(cols * (R.minRows || 2), Math.ceil((used + M.free) / cols) * cols);
  let h = "";
  for (const c of M.floor)
    h += `<div class="rmcell${c.fixed ? " fixed" : ""}${c.w > 1 ? " w2" : ""}" title="${esc(c.name + (c.n > 1 ? " ×" + c.n : "") + (c.tier ? " · " + c.tier : "") + (c.fixed ? " · built-in" : ""))}">` +
      (c.n > 1 ? `<span class="rmstack">${Array.from({ length: Math.min(c.n, 4) }, (_, i) => `<span style="--i:${i}">${tok(A.pieces, c.id, c.icon)}</span>`).join("")}</span><b class="rmn">×${c.n}</b>` : tok(A.pieces, c.id, c.icon)) +
      `<small>${esc(c.name)}</small></div>`;
  for (let i = 0; i < M.free; i++) h += `<div class="rmcell empty" title="Free slot"><small>free</small></div>`;
  for (let i = used + M.free; i < cells; i++) h += `<div class="rmcell pad"></div>`;
  const wall = M.wall.map(w => `<span class="rmfix ${w.kind}" title="${esc((w.kind === "up" ? "Upgrade: " : "Fitting: ") + w.name)}">${tok(w.kind === "up" ? A.ups : A.pieces, w.id, w.icon)}<small>${esc(w.name)}</small></span>`).join("");
  const age = Math.max(0, Date.now() - (opened || 0)), anim = age < 900 ? ` style="animation-delay:-${age}ms"` : "";
  const r = M.room, bg = "";
  return `<div class="estroom rm-${M.fam}${M.tierN ? " tier" + M.tierN : ""}" data-uid="${st.uid}" style="--fl:${r.floor};--fl2:${r.floor2};--wl:${r.wall};--rf:${r.roof}${bg}">` +
    `<div class="rmhead"><b>${M.icon} ${esc(M.title)}</b><span class="muted">${esc(r.name)}${M.tier ? " · " + R.tierIcon + " " + esc(M.tier) : ""} · ${M.floor.reduce((a, c) => a + c.n, 0)} placed${M.wall.length ? " · " + M.wall.length + " upgrades/fittings" : ""}</span><button class="b" data-a="estroom" data-v="${st.uid}" title="Close the interior">✕</button></div>` +
    `<div class="rmwall">${wall || '<span class="muted rmnone">No upgrades yet</span>'}</div>` +
    sceneHtml(R, M, A) +
    `<div class="rmfloor${A.rooms && A.rooms[M.fam] ? " legend" : ""}" style="grid-template-columns:repeat(${cols},1fr)">${h}</div>` +
    (age < 900 ? `<div class="rmroof"${anim}></div>` : "") + `</div>`;
}
