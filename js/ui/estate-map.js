// R62 ART-3 estate map: one pixelated canvas (static layer cached offscreen, redrawn only when the layout changes)
// plus a walker layer at 10 fps. Tap targets are plain buttons over the canvas. Classic emoji / missing art: the
// same plots drawn as emoji tiles. Reduce-motion or a hidden page: walkers stand still / the loop stops.
// Nothing here touches the save.
import * as E from "../engine.js";
import { D, s } from "../main.js";
import { U } from "./state.js";
import { tintSheet } from "./walker-tint.js";
import { estateLayout, pathTile, route, walkerList, vehicleList, isBig } from "./estate-layout.js";
import { render } from "./render.js";
import { costStr } from "./common.js";

const ART = "art/estate/";
const IMG = new Map();
const img = k => {
  if (!IMG.has(k)) { const i = new Image(); i.onload = () => { R.dirty = true; kick(); }; i.onerror = () => (i.bad = true); i.src = k.startsWith("art/") ? k : ART + k + ".webp"; /* R73: animal sheets live under art/animals/ */ IMG.set(k, i); }
  return IMG.get(k);
};
const ok = i => i && i.complete && i.naturalWidth > 0;
const R = { sig: "", bg: null, dirty: true, walkers: new Map(), raf: 0, last: 0, frames: 0, running: false, layout: null };
if (typeof window !== "undefined") window.__estmap = R;
import { reduced } from "./motion.js"; // R76: profile setting (Auto follows the device)
const pct = (v, t) => ((v / t) * 100).toFixed(3) + "%";

export function mapHtml() {
  const L = estateLayout(s, D, E), classic = !!s.classicEmoji;
  R.layout = L;
  const box = r => `left:${pct(r.x, L.W)};top:${pct(r.y, L.H)};width:${pct(r.w, L.W)};height:${pct(r.h, L.H)}`;
  let h = `<div id="estmap" class="estmap${classic ? " classic" : ""}" style="aspect-ratio:${L.W}/${L.H}">`;
  if (classic) {
    h += `<div class="emwater" style="${box({ x: 0, y: L.M.shoreRow * L.T + L.T / 2, w: L.W, h: L.H })}"></div>`;
    for (const p of L.parcels) h += `<div class="emparcel${p.owned ? "" : " locked"}" style="${box(p)}"></div>`;
  } else h += `<canvas id="estcanvas" width="${L.W}" height="${L.H}"></canvas>`;
  for (const p of L.parcels)
    if (!p.owned) {
      const l = D.estate.lands.find(x => x.id === p.id), can = l && E.canBuyLand(s, p.id), rn = l && E.landRenown(s, p.id);
      h += `<button class="emlock" style="${box({ x: p.x + 8, y: p.y + p.h / 2 - 14, w: p.w - 16, h: 28 })}" data-a="land" data-v="${p.id}" ${can ? "" : "disabled"} title="${p.name}: +${p.slots} land slots${rn && !rn.ok ? ` · Needs renown ${rn.need} (you have ${rn.have})` : ""}">🔒 ${p.icon} ${l ? costStr(E.bcost(s, l.cost, "land")) : ""}${rn && !rn.ok ? ` · renown ${rn.need}` : ""}</button>`;
    }
  for (const it of L.items)
    h += `<button class="embld${classic || !it.img ? " emoji" : ""}${U.estSel === it.key ? " sel" : ""}" style="${box(it.rect)}" data-a="estsel" data-v="${it.key}" title="${it.name}">${classic || !it.img ? `<span>${it.icon}</span>` : ""}</button>`;
  for (const e of L.empties) h += `<button class="emslot${U.estSel === "slot" ? " sel" : ""}" style="${box(e)}" data-a="estsel" data-v="slot" title="Free land slot: build here">＋</button>`;
  if (classic)
    walkerList(s, D, E, L).forEach((w, n) => {
      const it = L.items.find(i => i.key === w.job) || L.items[0];
      h += `<button class="emwalk" style="left:${pct(it.door.x - 8 + ((n % 3) - 1) * 10, L.W)};top:${pct(it.door.y - 20, L.H)}" data-a="estsel" data-v="${w.mid != null ? "m:" + w.mid : "w"}" title="${w.name}">${w.emoji}</button>`;
    });
  if (L.overflow) h += `<button class="emmore" data-a="estview" data-v="list" title="Show every building in the List view">+${L.overflow} more · List</button>`;
  return h + `</div>`;
}

// ---------- canvas
const tinted = new Map();
function sheetFor(w) {
  const k = w.sheet + "|" + w.house + "|" + w.hair;
  if (tinted.has(k)) return tinted.get(k);
  const src = img(w.sheet);
  if (!ok(src)) return null;
  const c = tintSheet(src, w.house, w.hair);
  tinted.set(k, c);
  return c;
}
// R67: multiply-tinted copy of a reused exterior (cached per sprite+tint)
function tintedImg(i, key, tint, k) {
  const ck = key + "|" + tint;
  if (tinted.has(ck)) return tinted.get(ck);
  const c = document.createElement("canvas"); c.width = i.naturalWidth; c.height = i.naturalHeight;
  const g = c.getContext("2d"); g.drawImage(i, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), p = d.data, T = [1, 3, 5].map(j => parseInt(tint.slice(j, j + 2), 16) / 255);
  for (let j = 0; j < p.length; j += 4) if (p[j + 3]) for (let q = 0; q < 3; q++) p[j + q] = Math.round(p[j + q] * (1 - k + k * T[q]));
  g.putImageData(d, 0, 0); tinted.set(ck, c);
  return c;
}
function tile(g, k, x, y, rot = 0) {
  const i = img(k);
  if (!ok(i)) return false;
  if (!rot) g.drawImage(i, x, y);
  else { g.save(); g.translate(x + 16, y + 16); g.rotate((rot * Math.PI) / 2); g.drawImage(i, -16, -16); g.restore(); }
  return true;
}
function drawStatic(L) {
  const c = R.bg || document.createElement("canvas");
  c.width = L.W; c.height = L.H; R.bg = c;
  const g = c.getContext("2d"), T = L.T, M = L.M;
  g.imageSmoothingEnabled = false;
  g.fillStyle = "#4f6b2f"; g.fillRect(0, 0, L.W, L.H);
  for (let y = 0; y < M.rows; y++) for (let x = 0; x < M.cols; x++) {
    if (y < M.shoreRow) tile(g, "tile-grass", x * T, y * T);
    else if (y === M.shoreRow) tile(g, "water-edge", x * T, y * T);
    else tile(g, "tile-water", x * T, y * T);
  }
  for (const p of L.parcels) if (!p.owned) for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) tile(g, "plot-locked", p.x + x * T, p.y + y * T);
  for (const key of L.paths) { const [x, y] = key.split(",").map(Number); const [t, r] = pathTile(L.paths, x, y); tile(g, t, x * T, y * T, r); }
  g.strokeStyle = "rgba(255,255,255,.35)"; g.setLineDash([4, 4]);
  for (const e of L.empties) g.strokeRect(e.x + 4.5, e.y + 4.5, e.w - 9, e.h - 9);
  g.setLineDash([]);
  for (const it of [...L.items].sort((a, b) => a.rect.y + a.rect.h - (b.rect.y + b.rect.h))) {
    const i = it.img && img(it.img), r = it.rect;
    if (ok(i)) {
      let w = i.naturalWidth, h = i.naturalHeight;
      if (isBig(it.img) && r.w < 96) { const f = r.w / w; w *= f; h *= f; } // a big home squeezed onto one anchor
      const tc = it.touch || {}, src = tc.tint ? tintedImg(i, it.img, tc.tint, tc.k) : i, x0 = Math.round(r.x + (r.w - w) / 2), y0 = Math.round(r.y + r.h - h);
      g.drawImage(src, x0, y0, Math.round(w), Math.round(h));
      if (tc.emblem) { // door sign: a small plaque with the emoji, bottom-right of the sprite
        const ex = x0 + Math.round(w) - 13, ey = y0 + Math.round(h) - 15;
        g.fillStyle = "rgba(40,28,16,.85)"; g.fillRect(ex - 1, ey - 1, 14, 14); g.fillStyle = "#e8d6a8"; g.fillRect(ex, ey, 12, 12);
        g.font = "10px serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(tc.emblem, ex + 6, ey + 7);
      }
    } else {
      g.fillStyle = "rgba(120,90,50,.55)"; g.fillRect(r.x + 8, r.y + 8, r.w - 16, r.h - 16);
      g.font = "28px serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(it.icon, r.x + r.w / 2, r.y + r.h / 2 + 2);
    }
  }
  R.dirty = false;
}

// ---------- walkers (cosmetic state, rebuilt on load)
const rnd = (a, b) => a + Math.random() * (b - a);
function syncWalkers(L, now) {
  const want = [...walkerList(s, D, E, L), ...(s.classicEmoji ? [] : vehicleList(s, D, E, L))], seen = new Set(), W = D.estatemap.walk;
  for (const w of want) {
    seen.add(w.id);
    const it = L.items.find(i => i.key === w.job) || L.items[0];
    let st = R.walkers.get(w.id);
    if (!st) {
      st = { x: it.door.x + ((R.walkers.size % 3) - 1) * 10, y: it.door.y, path: [], wait: now + rnd(0, 2000), dir: 0, goal: w.job };
      if (w.veh) st.dir = 0;
      R.walkers.set(w.id, st);
    }
    st.w = w;
    if (w.dock) { // R73: the sea boat is moored beside the Dock, on the right if it fits, else the left; it never walks
      const dk = L.items.find(i => i.key === w.dock) || it, r = dk.rect, bx = r.x + r.w + 18 + 16 <= L.W ? r.x + r.w + 18 : r.x - 18;
      st.x = bx; st.y = r.y + r.h - 2; st.path = []; st.moving = false; st.wait = Infinity; st.goal = w.job; continue;
    }
    if (w.still) { st.path = []; st.moving = false; st.wait = Infinity; st.goal = w.job; continue; }
    if (st.goal !== w.job && !st.away) { st.goal = w.job; st.path = route(L.M, st, it.door); }
  }
  for (const k of [...R.walkers.keys()]) if (!seen.has(k)) R.walkers.delete(k);
}
function step(L, dt, now) {
  const W = D.estatemap.walk;
  for (const st of R.walkers.values()) {
    if (st.w.still) continue;
    if (st.path.length) {
      const t = st.path[0], dx = t.x - st.x, dy = t.y - st.y, d = Math.hypot(dx, dy), mv = W.speed * dt;
      st.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0;
      st.moving = true;
      if (d <= mv) { st.x = t.x; st.y = t.y; st.path.shift(); if (!st.path.length) (st.wait = now + rnd(W.pauseMin, W.pauseMax) * 1000), (st.dir = 0); }
      else { st.x += (dx / d) * mv; st.y += (dy / d) * mv; }
    } else {
      st.moving = false;
      if (now > st.wait) {
        const items = L.items;
        const job = items.find(i => i.key === st.w.job) || items[0], home = items.find(i => i.key === st.w.home) || job;
        const atJob = Math.hypot(st.x - job.door.x, st.y - job.door.y) < 2;
        let to = job;
        if (atJob) to = Math.random() < W.wanderChance ? items[(Math.random() * items.length) | 0] : job === home ? job : home;
        if (to !== job && !atJob) to = job;
        if (Math.hypot(st.x - to.door.x, st.y - to.door.y) < 2) st.wait = now + rnd(W.pauseMin, W.pauseMax) * 1000;
        else st.path = route(L.M, st, to.door);
      }
    }
  }
}
// R73: vehicles. Walk sheets are 4 columns x 3 rows (down, right, up; left = right mirrored); the moored boat is a 2-frame sheet (32x24, the hull
// drops 1px and the pennant flutters, one frame per 0.7 s; frame 0 only with reduced motion). Sizes are the sheet's own frame size.
// Vehicles are never tinted: #194261 is the rider tabard key, but also baked into the chariot car and the boat pennant.
const VSHEET = (k) => ((D.art || {}).sheets || {})[k];
export const vehSize = w => { const v = w.veh; const S = VSHEET(v.sheet); return S ? { fw: S.fw, fh: S.fh } : { fw: 32, fh: 32 }; };
function drawVeh(g, st, now) {
  const v = st.w.veh;
  if (v.kind === "boat") {
    const S = VSHEET(v.sheet), i = S && img(S.file);
    if (!ok(i)) return;
    const f = reduced() ? 0 : Math.floor(now / 700) % S.cols;
    g.drawImage(i, f * S.fw, 0, S.fw, S.fh, Math.round(st.x - S.fw / 2), Math.round(st.y - S.fh), S.fw, S.fh);
    return;
  }
  const S = VSHEET(v.sheet), i = S && img(S.file);
  if (!ok(i)) return;
  const row = st.dir === 3 ? 2 : st.dir === 0 ? 0 : 1, f = st.moving ? Math.floor(now / 200) % S.cols : 0, flip = st.dir === 1;
  const x = Math.round(st.x - S.fw / 2), y = Math.round(st.y - S.fh);
  if (flip) { g.save(); g.translate(x + S.fw, y); g.scale(-1, 1); g.drawImage(i, f * S.fw, row * S.fh, S.fw, S.fh, 0, 0, S.fw, S.fh); g.restore(); }
  else g.drawImage(i, f * S.fw, row * S.fh, S.fw, S.fh, x, y, S.fw, S.fh);
}
function paint(now) {
  const cv = document.getElementById("estcanvas"), L = R.layout;
  if (!cv || !L) return false;
  const sig = JSON.stringify([L.items.map(i => [i.key, i.img, i.touch && i.touch.tint, i.touch && i.touch.emblem, i.rect.x, i.rect.y]), L.parcels.map(p => p.owned), L.empties.length]);
  if (sig !== R.sig || R.dirty || !R.bg) { R.sig = sig; drawStatic(L); }
  const g = cv.getContext("2d");
  g.imageSmoothingEnabled = false;
  g.drawImage(R.bg, 0, 0);
  const sorted = [...R.walkers.values()].sort((a, b) => a.y - b.y);
  for (const st of sorted) {
    if (st.w.veh) { drawVeh(g, st, now); continue; }
    const sh = sheetFor(st.w);
    if (!sh) continue;
    const f = st.moving ? Math.floor(now / 250) % 2 : 0, sc = st.w.scale || 1, w = 16 * sc, h = 24 * sc;
    g.drawImage(sh, f * 16, st.dir * 24, 16, 24, Math.round(st.x - w / 2), Math.round(st.y - h), Math.round(w), Math.round(h));
  }
  return true;
}
function frame(now) {
  R.raf = 0;
  if (document.hidden || reduced() || U.tab !== "land") return void (R.running = false);
  const dt = Math.min(0.5, (now - (R.last || now)) / 1000);
  if (now - R.last >= 1000 / D.estatemap.walk.fps || !R.last) {
    R.last = now;
    step(R.layout, dt, now);
    if (!paint(now)) return void (R.running = false);
    R.frames++; // animation frames only (tests watch this)
  }
  R.running = true;
  R.raf = requestAnimationFrame(frame);
}
function kick() {
  if (!R.raf && !document.hidden && !reduced() && document.getElementById("estcanvas")) { R.last = 0; R.raf = requestAnimationFrame(frame); }
}
// called after every render on the Estate tab: draw the (possibly new) canvas right away so there is no blank frame
export function estateMapAfter() {
  const cv = document.getElementById("estcanvas");
  if (!cv || !R.layout) return;
  if (!cv._wired) {
    cv._wired = true;
    cv.addEventListener("click", e => {
      const r = cv.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * R.layout.W, y = ((e.clientY - r.top) / r.height) * R.layout.H;
      for (const st of R.walkers.values()) if (st.w.veh) { // R73: tap a wagon / rider / boat
        const z = vehSize(st.w);
        if (Math.abs(st.x - x) < z.fw / 2 && y > st.y - z.fh && y < st.y + 2) { U.estSel = "v:" + st.w.id; render.force = true; U.lastHTML = ""; return void render(); }
      }
      for (const st of R.walkers.values()) if (!st.w.veh && Math.abs(st.x - x) < 10 && y > st.y - 26 && y < st.y + 2) {
        U.estSel = st.w.mid != null ? "m:" + st.w.mid : "w";
        render.force = true; U.lastHTML = ""; return void render();
      }
    });
  }
  const now = performance.now();
  syncWalkers(R.layout, now);
  if (reduced()) for (const st of R.walkers.values()) (st.path = []), (st.moving = false);
  paint(now);
  kick();
}
if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => { if (document.hidden) { if (R.raf) cancelAnimationFrame(R.raf); R.raf = 0; R.running = false; } else kick(); });
