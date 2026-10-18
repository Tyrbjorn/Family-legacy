// R42: 🆕 New chore popup (own overlay #chorepanel, outside the per-frame render) + the Chores-on-auto line on Main.
import * as E from "../engine.js";
import { s } from "../main.js";

let el = null;
export function choreNewsCheck() {
  if (!s || !s.chores || !s.chores.news || !s.chores.news.length || (el && !el.hidden)) return;
  const ids = E.takeChoreNews(s), L = ids.map(E.choreDef).filter(Boolean);
  if (!L.length) return;
  if (!el) { el = document.createElement("div"); el.id = "chorepanel"; document.body.appendChild(el); }
  el.hidden = false;
  el.innerHTML = `<div class="card wncard" role="dialog" aria-label="New chore"><div class="row"><h3>🆕 New chore${L.length > 1 ? "s" : ""}</h3><button class="b" data-ch="close" aria-label="Close">✕</button></div>${L.map(ac => `<div class="wnentry"><b>${ac.icon} ${ac.name}</b> <span class="muted">· ${E.opensText(ac.chore.opens)}</span><div>${ac.desc}</div></div>`).join("")}<div class="muted">It runs on Auto from now on (Main → Tasks). Work it by hand for the full amount.</div><div class="row" style="justify-content:flex-end"><button class="b sel" data-ch="close">Got it</button></div></div>`;
}
document.addEventListener("click", e => { const b = e.target.closest("[data-ch]"); if (b && el) el.hidden = true; });

// compact line on Main: which chores the free auto runs, each with a pause toggle
export function choresLine() {
  const L = E.openChores(s);
  if (!L.length) return "";
  return `<div class="muted" id="choresline" style="font-size:12px">🧹 Chores on auto (${Math.round(E.CH().autoRate * 100)}%): ${L.map(ac => { const p = E.chorePaused(s, ac.id); return `<button class="b ${p ? "" : "sel"}" style="font-size:11px;padding:1px 5px" data-a="choretoggle" data-v="${ac.id}" title="${p ? "Paused" : "On auto"}">${p ? "⏸️" : ac.icon} ${ac.name}</button>`; }).join(" ")}</div>`;
}
