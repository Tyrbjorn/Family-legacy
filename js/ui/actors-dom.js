// R73: moves the .rmact pen animals and bees in the room scene (display only). One rAF loop at ~10 fps, only while such sprites are on
// screen; stops when the tab is hidden or prefers-reduced-motion is on (then they stand still on frame 0).
import { penPositions, KIND_OPTS } from "./actors.js";
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const R = { raf: 0, last: 0 };
const P = (v, d) => +((v / d) * 100).toFixed(2) + "%";
const WALK_FPS = 5; // walk-strip frames per second (4 frames)
const num = s => s.split(",").map(Number);
export function paintActors(t) {
  const groups = new Map(), els = [];
  for (const el of document.querySelectorAll(".rmact[data-seed]")) {
    const d = el.dataset;
    if (d.stand) { // a stall animal: stands in place, breathes (2 idle frames, one change every ~1.4 s)
      const f = reduced() ? 0 : Math.floor(t / 1.4 + +d.ph) & 1;
      el.style.backgroundPosition = ((+d.ic > 1 ? f * 100 / (+d.ic - 1) : 0)) + "% 0";
      continue;
    }
    const key = d.grp || d.seed;
    let g = groups.get(key);
    if (!g) groups.set(key, g = { box: num(d.box), md: +d.md || 0, k: d.k, bob: !d.wu, still: !!d.still || reduced(), stops: d.stops ? d.stops.split(";").map(num) : [], seeds: new Map() });
    g.seeds.set(d.seed, +d.gi || 0);
    els.push(el);
  }
  // R73b: one pen at a time: every unit wanders on its own seeded path over the whole open floor, then the pen keeps its units a unit width apart
  for (const g of groups.values()) {
    const seeds = [...g.seeds.keys()].sort((a, b) => g.seeds.get(a) - g.seeds.get(b));
    g.pos = new Map(penPositions(seeds, t, g.box, { ...(KIND_OPTS[g.k] || {}), still: g.still, bob: g.bob, stops: g.stops }, g.md).map((p, i) => [seeds[i], p]));
  }
  for (const el of els) {
    const d = el.dataset, W = +d.w, H = +d.h, fw = +d.fw, fh = +d.fh, ox = +d.ox || 0, p = groups.get(d.grp || d.seed).pos.get(d.seed);
    // walking = the walk strip (if the sprite has one), standing = the idle sheet (or walk frame 0 when there is none)
    const walk = p.moving && d.wu, url = walk ? d.wu : d.iu || d.wu, cols = +(walk ? d.wc : d.iu ? d.ic : d.wc);
    const f = walk ? (Math.floor(t * WALK_FPS) + (+d.fo || 0)) % cols : d.iu ? p.frame % cols : 0;
    if (el._u !== url) { el._u = url; el.style.backgroundImage = `url(${url})`; el.style.backgroundSize = cols * 100 + "% 100%"; }
    el.style.left = P(p.x + ox - fw / 2, W); el.style.top = P(p.y - fh, H);
    el.style.backgroundPosition = (cols > 1 ? f * 100 / (cols - 1) : 0) + "% 0";
    el.style.transform = p.dir < 0 ? "scaleX(-1)" : "";
  }
}
function frame(now) {
  R.raf = 0;
  if (document.hidden || reduced() || !document.querySelector(".rmact[data-seed]")) return;
  if (now - R.last >= 100) { R.last = now; paintActors(Date.now() / 1000); }
  R.raf = requestAnimationFrame(frame);
}
// call after every render of the Estate tab: re-applies the current positions (a re-render resets them to the HTML's time-0 spot) and starts the loop
export function actorsAfter() {
  if (!document.querySelector(".rmact[data-seed]")) return;
  paintActors(reduced() ? 0 : Date.now() / 1000);
  if (!R.raf && !document.hidden && !reduced()) { R.last = 0; R.raf = requestAnimationFrame(frame); }
}
if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => { if (!document.hidden) actorsAfter(); });
