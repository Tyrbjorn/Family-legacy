// R77 collapsible section card. sect(id, html, opts) wraps a block of cards in <details>; its open state is remembered per section id
// in fl_ui_v1 (explicit user choice only; otherwise the registry default, or opts.open). If `html` starts with an <h3> its inner HTML
// becomes the summary title (so the old headings and counts stay as they were); otherwise the registry title is used.
import { SECTIONS } from "./nav-data.js";
import { UI, uiSave } from "./ui-live.js";

const esc = x => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;");
export const secOpen = (id, def) => (typeof UI.sections[id] === "boolean" ? UI.sections[id] : def);
export function sect(id, html, o = {}) {
  if (!html) return "";
  const reg = SECTIONS[id] || [];
  let title = o.title || null, body = html;
  const m = /^\s*<h3[^>]*>([\s\S]*?)<\/h3>/.exec(html);
  if (!title && m) { title = m[1]; body = html.slice(m[0].length); }
  if (!title) title = `${reg[1] || ""} ${esc(reg[2] || id)}`;
  const open = secOpen(id, o.open != null ? o.open : reg[4] !== false);
  return `<details class="sec${o.cls ? " " + o.cls : ""}" data-sec="${id}"${open ? " open" : ""}><summary><span class="sect">${title}</span>${o.chip ? `<span class="chip secchip">${o.chip}</span>` : ""}</summary><div class="secb">${body}</div></details>`;
}
// remember a user's toggle (click on the summary, before the browser flips it)
export function secToggle(det) {
  const id = det && det.dataset.sec;
  if (!id) return;
  UI.sections[id] = !det.open;
  uiSave();
}
// open a section (Go to…) and remember it
export function secReveal(id) {
  if (UI.sections[id] !== true) { UI.sections[id] = true; uiSave(); }
}
