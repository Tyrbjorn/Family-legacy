// R76 menu layer: title / New game / Load / Settings / Encyclopedia / Unlocks / Credits, drawn into #menu on top of the game.
// U.screen is the open screen (null = playing). Actions are data-a="m_*" buttons handled in main.js; this file only draws and manages focus.
import * as E from "../engine.js";
import { BUILD } from "../config.js";
import { D, s, slot, entered, prefs, bootSkipped } from "../main.js";
import { U } from "./state.js";
import { loadv, newv, ago, slotSummary, storageBar } from "./menu-load.js";
import { savesExtras } from "./playpass-ui.js";
import { tipLink } from "./tip.js";
import { encv, encAfter } from "./menu-enc.js";
import { unlv } from "./menu-unl.js";
import { settingsCard } from "./guide.js";
import { saveCard } from "./main-tab.js";
import { COACH_SCREENS } from "./coach-ui.js";

const esc = x => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
export const NAME = "Heirs of the Hold";
const INERT = ["top", "subtabs", "view", "tabs", "dock", "toasts", "overlay", "modal"];

function titlev() {
  const L = E.Slots.listSlots(localStorage), cur = slot > 0 ? L[slot - 1] : null, canGo = entered || (cur && !cur.empty);
  const warn = bootSkipped.filter(x => !U.warnDismissed);
  const last = E.Slots.lastSlot(localStorage);
  const sub = entered ? `Playing: ${esc(cur ? cur.name : "this game")}` : cur && !cur.empty ? `${esc(cur.name)} · slot ${slot}${cur.card ? " · Gen " + cur.card.gen + ", Year " + cur.card.year : ""} · ${ago(cur.played)}` : "No saved game yet";
  const fb = !entered && cur && bootSkipped.length && bootSkipped.some(x => x.n === last) ? `<div class="muted">Slot ${last} couldn't be opened, so Continue uses slot ${slot}.</div>` : "";
  return `<div class="mtitle"><img src="art/icons/crest.webp" alt="" width="72" height="72"><h1 id="mtitle">${NAME}</h1><div class="muted">A family-dynasty idle game</div></div>
${warn.length ? `<div class="card mwarn" role="alert">⚠️ ${warn.map(x => `Slot ${x.n} ${x.reason === "version" ? "comes from a different save version" : "has damaged data"}`).join("; ")}. ${warn.length > 1 ? "They were" : "It was"} kept exactly as stored, not replaced. <button class="b" data-a="m_go" data-v="load">Open Load</button></div>` : ""}
<div class="mlist" data-nav role="menu" aria-label="Main menu">
<button class="b mbig ${canGo ? "sel" : ""}" role="menuitem" data-a="m_continue" ${canGo ? "data-autofocus" : "disabled"}><b>${entered ? "Resume" : "Continue"}</b><span class="muted">${sub}</span></button>${fb}
<button class="b mbig" role="menuitem" data-a="m_new" ${canGo ? "" : "data-autofocus"}><b>New game</b></button>
<button class="b mbig" role="menuitem" data-a="m_go" data-v="load"><b>Load game</b></button>
<button class="b mbig" role="menuitem" data-a="m_go" data-v="set"><b>Settings</b></button>
<button class="b mbig" role="menuitem" data-a="m_go" data-v="enc"><b>Encyclopedia</b></button>
<button class="b mbig" role="menuitem" data-a="m_go" data-v="unl"><b>Unlocks</b></button>
<button class="b mbig" role="menuitem" data-a="m_go" data-v="how"><b>How to play</b><span class="muted">Orrin's tours and the intro</span></button>
<button class="b mbig" role="menuitem" data-a="m_go" data-v="notes"><b>Orrin's notes</b></button>
<button class="b mbig" role="menuitem" data-a="m_go" data-v="cred"><b>Credits</b></button></div>
<div class="mfoot muted">${NAME} · ${BUILD}${tipLink(D.build) ? " · " + tipLink(D.build) : ""}</div>`;
}

function setv() {
  const m = prefs.motion;
  return `<div class="mhead"><button class="b" data-a="m_back" data-autofocus>← Back</button><h2 id="mtitle">Settings</h2></div>
<div class="card muted">These apply to every save on this device.</div>
<div class="card"><label class="row"><span>😀 <b>Classic emoji</b><br><span class="muted">Show emoji instead of the icon art.</span></span><input type="checkbox" data-a="set_classic" ${prefs.classic ? "checked" : ""}></label></div>
<div class="card"><label class="row"><span>🌀 <b>Reduced motion</b><br><span class="muted">Stops walking figures and animated panels. Auto follows your device's setting.</span></span><select data-a="set_motion" aria-label="Reduced motion">${[["auto", "Auto"], ["on", "On"], ["off", "Off"]].map(([v, l]) => `<option value="${v}" ${m === v ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
<div class="card"><label class="row"><span>⏭ <b>Skip title</b><br><span class="muted">Open straight into your last save when the game starts.</span></span><input type="checkbox" data-a="set_skip" ${prefs.skipTitle ? "checked" : ""}></label></div>
${entered ? gameSettings() : `<div class="card muted">Game settings (difficulty, notifications, save export / import) appear here once a game is open.</div>`}
${savesExtras()}${storageBar()}<div class="muted" style="margin-top:6px">${NAME} · ${BUILD}</div>`;
}
// R77: the Settings card and the save tools left the Today tab; they live here with New Lineage (this save only)
function gameSettings() {
  return `<h3 class="mh3">This game</h3><div class="card" id="gamesettings">${settingsCard()}</div>${saveCard()}<div class="row"><button class="b" data-a="reset">New Lineage</button></div>`;
}

// DRAFT credits text: Jeremy to edit before release
function credv() {
  return `<div class="mhead"><button class="b" data-a="m_back" data-autofocus>← Back</button><h2 id="mtitle">Credits</h2></div>
<div class="card" style="border-color:#f0b35a"><b>⚠️ DRAFT for Jeremy to edit.</b> <span class="muted">This text is a placeholder written by an assistant. Check every line before release.</span></div>
<div class="card"><h3>${NAME}</h3><div>Created by Jeremy Daniel.</div></div>
<div class="card" id="aidisclosure"><h3>How this game was made</h3><div>The artwork in this game (icons, portraits, scenes) was made with AI image tools. Parts of the game text and code were written with the help of AI tools. The design, selection and editing were done by the developer.</div></div>
${tipLink(D.build) ? `<div class="card"><h3>Support</h3><div>If you enjoy the demo, you can leave a tip: ${tipLink(D.build)}</div></div>` : ""}
<div class="muted">${NAME} · ${BUILD}</div>`;
}

const SCREENS = { new: newv, load: loadv, set: setv, enc: encv, unl: unlv, cred: credv, ...COACH_SCREENS };
const screenHtml = () => (SCREENS[U.screen] || titlev)();
const $m = () => document.getElementById("menu");
const fkey = el => el && el.dataset ? (el.dataset.a || el.id || "") + "|" + (el.dataset.v || "") : "";
let shown = null, openedFrom = null, lastHtml = "";

export function menuActive() { return !!U.screen; }
// called at the top of render(): true while a menu screen owns the page
export function menuSync() {
  const el = $m();
  if (!el) return false;
  if (!U.screen) {
    if (!el.hidden) {
      el.hidden = true; el.innerHTML = ""; lastHtml = ""; shown = null;
      for (const id of INERT) { const n = document.getElementById(id); if (n) n.inert = false; }
      document.body.classList.remove("menuopen");
      if (openedFrom && document.contains(openedFrom)) try { openedFrom.focus(); } catch (e) { /* ignore */ }
      openedFrom = null;
    }
    return false;
  }
  if (el.hidden) {
    openedFrom = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
    el.hidden = false;
    for (const id of INERT) { const n = document.getElementById(id); if (n) n.inert = true; }
    document.body.classList.add("menuopen");
  }
  const h = `<div class="mshell mscreen-${U.screen}" role="dialog" aria-modal="true" aria-labelledby="mtitle"><div class="mbody">${screenHtml()}</div></div>`;
  if (h !== lastHtml) {
    const ae = document.activeElement, inMenu = ae && el.contains(ae), key = inMenu ? fkey(ae) : "", scr = el.firstElementChild && el.firstElementChild.scrollTop;
    const same = shown === U.screen;
    // never rebuild under a focused text field / select (typing, open dropdowns)
    if (same && inMenu && /^(TEXTAREA|INPUT|SELECT)$/.test(ae.tagName)) return true;
    el.innerHTML = h; lastHtml = h;
    const body = el.firstElementChild;
    if (same && key !== "|") {
      const back = [...el.querySelectorAll("button,input,select,textarea,a[href]")].find(n => fkey(n) === key);
      if (back) back.focus({ preventScroll: true });
      if (body) body.scrollTop = scr;
    } else {
      const first = el.querySelector("[data-autofocus]:not([disabled])") || el.querySelector("button:not([disabled])");
      if (first) first.focus({ preventScroll: true });
      if (body) body.scrollTop = 0;
    }
    shown = U.screen;
    if (U.screen === "enc") encAfter();
  }
  return true;
}

// keyboard: Esc = back, Tab stays inside the menu, arrows move through a list of buttons
document.addEventListener("keydown", e => {
  if (!U.screen) return;
  const el = $m();
  if (e.key === "Escape") {
    const b = el.querySelector('[data-a="m_back"],[data-a="intro_skip"]');
    if (b) { e.preventDefault(); b.click(); } else if (U.screen === "title" && entered) { e.preventDefault(); el.querySelector('[data-a="m_continue"]').click(); }
    return;
  }
  if (e.key === "Tab") {
    const f = [...el.querySelectorAll("button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]")].filter(n => n.offsetParent !== null);
    if (!f.length) return;
    const a = document.activeElement, i = f.indexOf(a);
    if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && (i === f.length - 1 || i < 0)) { e.preventDefault(); f[0].focus(); }
    return;
  }
  if (/^Arrow(Up|Down)$/.test(e.key)) {
    const a = document.activeElement, c = a && a.closest && a.closest("[data-nav]");
    if (!c || a.tagName === "SELECT" || a.tagName === "TEXTAREA") return;
    const f = [...c.querySelectorAll("button:not([disabled]),a[href]")];
    if (f.length < 2) return;
    e.preventDefault();
    f[(f.indexOf(a) + (e.key === "ArrowDown" ? 1 : -1) + f.length) % f.length].focus();
  }
});
