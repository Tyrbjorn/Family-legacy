// World map SVG: parchment terrain, roads, fog, markers, rumor hints and travellers (split from map-tab.js).
import * as E from "../engine.js";
import { U } from "./state.js";
import { D, s } from "../main.js";
import { qKind } from "./map-tab.js";

// Parchment base: terrain zones (data/world.json), roads, then fog of war on top.
let _parch = null;
function parchment(MP, WD) {
  if (_parch && _parch.src === WD) return _parch.svg;
  const T = WD.terrain;
  let d = `<defs><filter id="rough"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="7"/><feDisplacementMap in="SourceGraphic" scale="9"/></filter>`;
  for (const [id, te] of Object.entries(T))
    d += `<pattern id="tp-${id}" width="26" height="26" patternUnits="userSpaceOnUse"><rect width="26" height="26" fill="${te.fill}"/>${TPAT[id] ? TPAT[id](te.ink) : ""}</pattern>`;
  d += "</defs>";
  let g = d + `<rect x="0" y="0" width="${MP.size.w}" height="${MP.size.h}" fill="#e9d8ae"/>`;
  for (const z of WD.zones) {
    const f = `fill="url(#tp-${z.t})" stroke="${T[z.t].ink}" stroke-opacity=".5" filter="url(#rough)"`;
    if (z.shape === "rect") g += `<rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" ${f}/>`;
    else if (z.shape === "ellipse") g += `<ellipse cx="${z.x}" cy="${z.y}" rx="${z.rx}" ry="${z.ry}" ${f}/>`;
    else if (z.shape === "line") g += `<polyline points="${z.pts.map(p => p.join(",")).join(" ")}" fill="none" stroke="${T[z.t].ink}" stroke-width="${z.width || 10}" stroke-linecap="round" stroke-linejoin="round" filter="url(#rough)"/>`;
  }
  const RS = { highway: ["#5a3a1a", 6, ""], road: ["#7a5530", 4, ""], track: ["#8a6a40", 2.5, "6 6"] };
  for (const r of WD.roads) {
    const [c, w, da] = RS[r.type] || RS.track;
    g += `<polyline points="${r.pts.map(p => p.join(",")).join(" ")}" fill="none" stroke="${c}" stroke-width="${w}" stroke-dasharray="${da}" stroke-linecap="round" stroke-linejoin="round" opacity=".85"><title>${r.name} (${WD.roadTypes[r.type].name || r.type})</title></polyline>`;
  }
  _parch = { src: WD, svg: g };
  return g;
}
const TPAT = {
  forest: c => `<path d="M6 18l4-9 4 9zM17 10l3-7 3 7z" fill="${c}" opacity=".7"/>`,
  hills: c => `<path d="M2 18q6-8 12 0M14 10q5-6 10 0" fill="none" stroke="${c}" stroke-width="1.4"/>`,
  mountains: c => `<path d="M2 22l8-15 8 15M12 22l7-12 6 12" fill="none" stroke="${c}" stroke-width="1.6"/>`,
  highlands: c => `<path d="M3 20l6-9 6 9M14 14l5-7 5 7" fill="none" stroke="${c}" stroke-width="1.2" opacity=".8"/>`,
  river: c => `<path d="M0 13q6-4 13 0t13 0" fill="none" stroke="${c}" stroke-width="1"/>`,
  lake: c => `<path d="M3 9q4-3 8 0M14 19q4-3 8 0" fill="none" stroke="${c}" stroke-width="1"/>`,
  swamp: c => `<path d="M4 18h8M7 18v-5M16 9h7M19 9v-5" stroke="${c}" stroke-width="1.2"/>`,
  plains: c => `<circle cx="7" cy="8" r="1" fill="${c}"/><circle cx="19" cy="18" r="1" fill="${c}"/>`,
  coast: c => `<path d="M0 6q6 4 13 0t13 0M0 18q6 4 13 0t13 0" fill="none" stroke="${c}" stroke-width="1"/>`,
};
// Fog: unseen cells merged into row runs so the overlay stays light on mobile.
function fogLayer(MP, WD) {
  if (!s.fog) return "";
  const k = WD.fog.cell,
    c = Math.ceil(MP.size.w / k),
    r = Math.ceil(MP.size.h / k);
  let g = `<g fill="#d8c79c" opacity="1" pointer-events="none">`;
  for (let j = 0; j < r; j++)
    for (let i = 0; i < c; i++) {
      if (s.fog[j * c + i] !== "0") continue;
      let e = i;
      while (e + 1 < c && s.fog[j * c + e + 1] === "0") e++;
      g += `<rect x="${i * k - 1}" y="${j * k - 1}" width="${(e - i + 1) * k + 2}" height="${k + 2}"/>`;
      i = e;
    }
  return g + "</g>";
}

export function mapSvg(m) {
  const MP = D.map,
    W = MP.size.w,
    H = MP.size.h;
  if (!U.mv) U.mv = { x: 0, y: 0, w: W, h: H };
  const WD = D.world;
  let g = parchment(MP, WD) + fogLayer(MP, WD);
  for (const r of MP.regions) {
    const rg = D.regions.find(x => x.id === r.id),
      kn = E.regionKnown(s, r.id),
      op = E.regionOpen(s, r.id);
    g += `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="14" fill="none" stroke="#6b4a26" stroke-width="2" stroke-dasharray="10 6" stroke-opacity=".6"/>`;
    g += `<text x="${r.x + 12}" y="${r.y + 26}" font-size="20" fill="#4a3018" font-family="serif" font-style="italic">${kn ? rg.icon + " " + rg.name : "❔ Uncharted"}${kn && !op ? " 🔒 CP " + rg.cp : ""}</text>`;
    if (!op) g += `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="14" fill="#8a7a5a" opacity="${kn ? 0.3 : 0.55}"/>`;
  }
  for (const l of WD.locations)
    if (E.locKnown(s, l) && E.regionKnown(s, l.region) && !l.town) {
      const ty = WD.locTypes[l.type];
      g += `<g data-a="mapsel" data-v="l:${l.id}" style="cursor:pointer"><rect x="${l.x - 16}" y="${l.y - 16}" width="32" height="32" rx="6" fill="#efe0b8" stroke="${l.locked ? "#8a2a1a" : "#6b4a26"}" stroke-width="${U.mapSel === "l:" + l.id ? 4 : 2}"/><text x="${l.x}" y="${l.y + 7}" font-size="19" text-anchor="middle">${l.locked ? "🔒" : ty.icon}</text><text x="${l.x}" y="${l.y + 32}" font-size="12" text-anchor="middle" fill="#3a2410" font-family="serif">${l.name}</text></g>`;
    }
  for (const a of MP.areas.filter(a => E.regionKnown(s, a.region))) {
    const ex = E.explored(s, a.id),
      sel = U.mapSel === "a:" + a.id;
    g += `<g data-a="mapsel" data-v="a:${a.id}" style="cursor:pointer"><circle cx="${a.x}" cy="${a.y}" r="${a.r}" fill="${ex ? "none" : "#cfd6d6"}" fill-opacity="${ex ? 0 : 0.75}" stroke="${sel ? "#ffd34d" : "#fff"}" stroke-width="${sel ? 5 : 2}" stroke-dasharray="${ex ? "8 6" : "0"}"/><text x="${a.x}" y="${a.y + 8}" font-size="${ex ? 20 : 34}" text-anchor="middle">${ex ? "🧭" : "❓"}</text><text x="${a.x}" y="${a.y + a.r - 10}" font-size="15" text-anchor="middle" fill="#fff">${ex ? a.name : "Unexplored"}</text></g>`;
  }
  const pin = (id, x, y, ic, col, lab, kind) =>
    `<g data-a="mapsel" data-v="${kind}:${id}" style="cursor:pointer"><circle cx="${x}" cy="${y}" r="${U.mapSel === kind + ":" + id ? 24 : 19}" fill="#141824" stroke="${col}" stroke-width="3"/><text x="${x}" y="${y + 7}" font-size="20" text-anchor="middle">${ic}</text>${lab ? `<text x="${x}" y="${y + 38}" font-size="13" text-anchor="middle" fill="#fff">${lab}</text>` : ""}</g>`;
  for (const t of D.towns)
    if (E.townKnown(s, t) && E.regionKnown(s, t.region)) {
      const p = MP.towns[t.id];
      g += pin(t.id, p.x, p.y, t.icon, "#fff", t.name, "t");
      const ev = E.eventsAtTown(s, t.id);
      if (ev.length)
        g += `<text x="${p.x + 20}" y="${p.y - 14}" font-size="18">${ev.map(e => E.eventType(e.type).icon).join("")}</text>`;
    }
  for (const n of D.nodes)
    if (E.known(s, n) && E.regionKnown(s, n.region)) {
      const p = MP.points[n.id];
      const fr = E.nodeStock(s, n) / E.nodeMax(n);
      g += pin(n.id, p.x, p.y, n.icon, E.nodeStock(s, n) > 0 ? "#3f7a2f" : "#a33", "", "n");
      if (fr < 1) g += `<rect x="${p.x - 16}" y="${p.y + 22}" width="32" height="5" fill="#3a2a10" opacity=".6"/><rect x="${p.x - 16}" y="${p.y + 22}" width="${32 * fr}" height="5" fill="${fr > 0 ? "#6fbf4a" : "#a33"}"/>`;
    }
  for (const q of D.quests)
    if (
      E.known(s, q) &&
      E.regionKnown(s, q.region) &&
      !(q.story && E.questIssue(s, m, q) && E.questIssue(s, m, q).startsWith("finish"))
    ) {
      const p = MP.points[q.id],
        k = qKind(q);
      g += pin(q.id, p.x, p.y, k[0], k[1], "", "q");
    }
  for (const d of D.dungeons)
    if (E.known(s, d) && E.regionKnown(s, d.region)) {
      const p = MP.points[d.id];
      g += pin(d.id, p.x, p.y, d.icon, (s.cleared || []).includes(d.id) ? "#888" : "#ff7a5c", "", "d");
    }
  g += hintLayer();
  const hm = MP.home;
  g += `<g><circle cx="${hm.x}" cy="${hm.y}" r="26" fill="#3a2a10" stroke="#ffd34d" stroke-width="3"/><text x="${hm.x}" y="${hm.y + 9}" font-size="26" text-anchor="middle">🏡</text></g>`;
  const mins = s.minions.filter(x => ["gather", "herbs", "mine", "farm"].includes(x.job));
  mins.forEach((x, i) => {
    const an = (i / Math.max(1, mins.length)) * 6.283;
    g += `<circle cx="${hm.x + Math.cos(an) * 42}" cy="${hm.y + Math.sin(an) * 42}" r="6" fill="#9ad"><title>${x.name} (${x.job})</title></circle>`;
  });
  for (const x of E.living(s))
    if (x.action && x.action.trip) {
      const pts = E.routeOf(x.action.target, E.ptOf).pts,
        d = E.tripPos(x.action),
        act = x.id === m.id;
      g += `<polyline points="${pts.map(q => q.x + "," + q.y).join(" ")}" fill="none" stroke="${act ? "#b8860b" : "#5a6a7a"}" stroke-width="${act ? 4 : 2.5}" stroke-dasharray="3 9" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${d.x}" cy="${d.y}" r="${act ? 11 : 8}" fill="${act ? "#ffd34d" : "#bcd"}" stroke="#000"><title>${x.name}</title></circle>`;
    }
  return `<div class="card" style="padding:4px"><div class="row" style="justify-content:flex-end;gap:4px"><span class="muted" style="margin-right:auto">🌫️ ${Math.round(E.fogPct(s) * 100)}% charted</span><button class="b" data-a="zoom" data-v="0.7">＋</button><button class="b" data-a="zoom" data-v="1.4">－</button><button class="b" data-a="zoom" data-v="0">⟲</button></div>
 <svg id="worldmap" viewBox="${U.mv.x} ${U.mv.y} ${U.mv.w} ${U.mv.h}" style="width:100%;height:58vh;touch-action:none;background:#e9d8ae;border-radius:10px;user-select:none">${g}</svg>
 <div class="muted" style="font-size:11px">Drag to pan, pinch/scroll or ＋/－ to zoom, tap a marker. 📖 story · ⭐ one-time · ? rumored place (tavern rumors pin it down) · 🔁 repeatable · 🌫️ unexplored · ━ highway, ─ road, ┄ track · off-road is slower but finds more.</div></div>`;
}

// Rumor hints: places not yet found, still in the fog of a known region, show a faint '?' near (not on) the spot.
const jit = id => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
export function hintSpots() {
  const MP = D.map,
    out = [];
  const add = (id, p, region) => {
    const rg = (p && E.regionAt(p.x, p.y)) || region;
    if (!p || !E.regionKnown(s, rg) || !E.regionOpen(s, rg) || !E.regionOpen(s, region) || E.fogSeen(s, p.x, p.y)) return;
    const h = jit(id),
      a = ((h % 360) * Math.PI) / 180,
      r = 15 + (h % 26);
    out.push({ id, x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, terrain: E.terrainAt(p.x, p.y) });
  };
  for (const x of [...D.nodes, ...D.quests.filter(q => !q.story), ...(D.dungeons || [])]) if (!E.known(s, x)) add(x.id, MP.points[x.id], x.region);
  for (const l of D.world.locations) if (l.hidden && !E.locKnown(s, l)) add("loc:" + l.id, l, l.region);
  return out;
}
function hintLayer() {
  return hintSpots()
    .map(h => `<g data-a="mapsel" data-v="h:${h.id}" style="cursor:pointer" opacity="${U.mapSel === "h:" + h.id ? 0.9 : 0.45}"><circle cx="${h.x}" cy="${h.y}" r="13" fill="#efe0b8" stroke="#6b4a26" stroke-dasharray="3 3"/><text x="${h.x}" y="${h.y + 6}" font-size="17" text-anchor="middle" fill="#6b4a26" font-family="serif">?</text></g>`)
    .join("");
}
