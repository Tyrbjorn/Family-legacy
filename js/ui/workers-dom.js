// R74: moves the .rmwk room workers (display only). paintWorkers(t) is called from actors-dom.js's paint (one loop for all the room sprites).
// Each worker is a span over the room scene; its sheet is the same tinted walker sheet the map uses (walker-tint.js tintSheet), turned into a
// data URL once per (sheet, tabard, hair) and cached. Until it is ready the worker stays invisible; if the sheet never loads it shows untinted.
import { workerPositions, SHEET } from "./workers.js";
import { tintSheet } from "./walker-tint.js";
import { reduced } from "./motion.js"; // R76: profile setting (Auto follows the device)
const P = (v, d) => +((v / d) * 100).toFixed(2) + "%";
const urls = new Map();   // key -> data URL | "bad" | "wait"
function sheetUrl(el) {
  const d = el.dataset, k = d.sheet + "|" + d.house + "|" + d.hair, got = urls.get(k);
  if (got) return got === "wait" ? null : got;
  urls.set(k, "wait");
  const im = new Image();
  im.onload = () => { try { urls.set(k, tintSheet(im, d.house, d.hair).toDataURL()); } catch (e) { urls.set(k, im.src); } refresh(); };
  im.onerror = () => { urls.set(k, "bad"); refresh(); };
  im.src = "art/estate/" + d.sheet + ".webp";
  return null;
}
let last = 0;
const refresh = () => { if (typeof document !== "undefined" && document.querySelector(".rmwk")) paintWorkers(last); };
// -> the workers' positions in room px (for the pen animals to steer around), or null when no room workers are on screen
export function paintWorkers(t) {
  last = t;
  const carrier = document.querySelector(".rmwg"), els = [...document.querySelectorAll(".rmwk[data-wk]")];
  if (!carrier || !els.length) return null;
  let geo = carrier._geo; if (!geo) { try { geo = carrier._geo = JSON.parse(carrier.dataset.geo); } catch (e) { return null; } }
  const still = reduced(), pos = workerPositions(geo, els.length, t, { still });
  for (const el of els) {
    const i = +el.dataset.wk, p = pos[i]; if (!p) continue;
    const sc = +el.dataset.sc || 1, fw = SHEET.fw * sc, fh = SHEET.fh * sc, u = sheetUrl(el);
    el.style.left = P(p.x - fw / 2, geo.W); el.style.top = P(p.y - fh, geo.H);
    el.style.backgroundPosition = p.frame * 100 + "% " + p.row * (100 / (SHEET.rows - 1)) + "%";
    el.style.transform = p.mir ? "scaleX(-1)" : "";
    if (u && el._u !== u) { el._u = u; el.style.backgroundImage = `url(${u === "bad" ? "art/estate/" + el.dataset.sheet + ".webp" : u})`; el.style.opacity = "1"; }
  }
  return pos;
}
