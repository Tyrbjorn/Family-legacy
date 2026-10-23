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
  return { fam, room, title: E.structName ? E.structName(st) : d.name, icon: d.icon || "🏠", floor, free, wall, tier: tier ? tier.name : "", tierN: st.tier || 0, art: R.art || {} };
}

const esc = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const tok = (A, key, icon, cls) => (A && A[key] ? `<img class="rmart${cls ? " " + cls : ""}" src="art/rooms/${A[key]}.webp" alt="">` : `<span class="rmemo${cls ? " " + cls : ""}">${icon}</span>`);

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
  const r = M.room, bg = A.rooms && A.rooms[M.fam] ? `;background-image:url(art/rooms/${A.rooms[M.fam]}.webp)` : "";
  return `<div class="estroom rm-${M.fam}${M.tierN ? " tier" + M.tierN : ""}" data-uid="${st.uid}" style="--fl:${r.floor};--fl2:${r.floor2};--wl:${r.wall};--rf:${r.roof}${bg}">` +
    `<div class="rmhead"><b>${M.icon} ${esc(M.title)}</b><span class="muted">${esc(r.name)}${M.tier ? " · " + R.tierIcon + " " + esc(M.tier) : ""} · ${M.floor.reduce((a, c) => a + c.n, 0)} placed${M.wall.length ? " · " + M.wall.length + " upgrades/fittings" : ""}</span><button class="b" data-a="estroom" data-v="${st.uid}" title="Close the interior">✕</button></div>` +
    `<div class="rmwall">${wall || '<span class="muted rmnone">No upgrades yet</span>'}</div>` +
    `<div class="rmfloor" style="grid-template-columns:repeat(${cols},1fr)">${h}</div>` +
    (age < 900 ? `<div class="rmroof"${anim}></div>` : "") + `</div>`;
}
