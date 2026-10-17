// R31.1: travellers glide along the map instead of jumping once per game day.
// Each render, a marker's new spot becomes the end of a short tween that starts where it is drawn right now;
// the tween lasts as long as the gap between its last two moves (so it matches the tick at any speed).
// Snaps (no tween) when turbo is on, the trip/member changes, or the jump is large. One rAF loop, only while moving.
const M = new Map();
let raf = 0;
const ease = t => t; // linear: steady walking pace
const cur = (r, now) => {
  const f = r.dur > 0 ? Math.min(1, (now - r.t0) / r.dur) : 1;
  return { x: r.fx + (r.tx - r.fx) * ease(f), y: r.fy + (r.ty - r.fy) * ease(f), done: f >= 1 };
};
function paint() {
  const now = performance.now();
  let moving = false;
  for (const el of document.querySelectorAll("#worldmap .tv")) {
    const r = M.get(el.dataset.tv);
    if (!r) continue;
    const p = cur(r, now);
    if (!p.done) moving = true;
    el.style.transform = `translate(${p.x - r.tx}px,${p.y - r.ty}px) scale(var(--k,1))`;
  }
  raf = moving ? requestAnimationFrame(paint) : 0;
}
export function glideMarkers(snapAll) {
  const els = document.querySelectorAll("#worldmap .tv");
  if (!els.length) return void M.clear();
  const now = performance.now(), seen = new Set();
  for (const el of els) {
    const key = el.dataset.tv, x = +el.getAttribute("cx"), y = +el.getAttribute("cy");
    seen.add(key);
    el.style.transformOrigin = `${x}px ${y}px`;
    const r = M.get(key);
    if (!r || snapAll) {
      M.set(key, { fx: x, fy: y, tx: x, ty: y, t0: now, dur: 0, ch: now });
      continue;
    }
    if (r.tx === x && r.ty === y) continue;
    const p = cur(r, now), gap = now - r.ch;
    const snap = Math.hypot(x - p.x, y - p.y) > 450 || gap > 30000; // teleports, reloads, long pauses
    M.set(key, snap ? { fx: x, fy: y, tx: x, ty: y, t0: now, dur: 0, ch: now } : { fx: p.x, fy: p.y, tx: x, ty: y, t0: now, dur: Math.max(250, Math.min(20000, r.avg ? (r.avg + gap) / 2 : gap)), avg: r.avg ? (r.avg + gap) / 2 : gap, ch: now });
  }
  for (const k of [...M.keys()]) if (!seen.has(k)) M.delete(k);
  if (!raf) raf = requestAnimationFrame(paint);
}
