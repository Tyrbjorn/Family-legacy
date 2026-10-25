// R77 navigation shell: 5-group bottom bar + ☰, sub-tab strip, "▾ All" bottom sheet, and the "Go to…" jump list.
import * as E from "../engine.js";
import { s, slot } from "../main.js";
import { U } from "./state.js";
import { VIEWS, GROUPS, SHEET_MIN, groupOfView, jumpIndex, jumpSearch } from "./nav-data.js";
import { UI, uiSave, uiOk } from "./ui-live.js";
import { secReveal } from "./sect.js";
import { newKeys, syncDots } from "./dots.js";
import { questBadge } from "./quests-tab.js";

const esc = x => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
export const tabVisible = k => !!VIEWS[k] && (k !== "craft" || E.craftingUnlocked(s));
export const groupOf = groupOfView;
const groupTabs = g => GROUPS.find(x => x[0] === g)[3].filter(tabVisible);
export function groupTarget(g) {
  const ts = groupTabs(g);
  if (ts.includes(U.tab)) return U.tab;
  const last = (U.groupLast || {})[g];
  return ts.includes(last) ? last : ts[0];
}

// ---- dots: "needs you" counts (always live) and "new" dots (remembered per save)
const storyNext = () => {
  const m = E.active(s);
  if (!m) return null;
  const q = E.storyQuests().find(x => !s.doneQuests.includes(x.id));
  return q && !(E.questIssue(s, m, q) || "").startsWith("finish") ? q.id : null;
};
let dotsNow = {};
export function syncNav(visit) {
  if (!uiOk() || !(slot >= 1)) return (dotsNow = {});
  const r = syncDots(UI, slot, newKeys(s, { craft: tabVisible("craft"), storyNext: storyNext() }), visit);
  if (r.changed) uiSave();
  const od = U.orrinDots || {}; // R77: "Later" notes from Orrin merge into the same dots and clear when that page opens
  if (visit) delete od[visit];
  for (const v of Object.keys(od)) r.dots[v] = true;
  return (dotsNow = r.dots);
}
export const needs = () => ({ quests: questBadge(), minions: E.pendingCount(s) });
const dotOf = v => (dotsNow[v] ? `<i class="ndot" aria-label="new"></i>` : "");

// ---- bottom bar (#tabs) and sub-tab strip (#subtabs)
export function navv() {
  const cur = groupOf(U.tab), n = needs();
  const bar = GROUPS.filter(([g]) => groupTabs(g).length).map(([g, i, name, ids]) => {
    const dot = ids.some(v => tabVisible(v) && dotsNow[v]);
    const badge = g === "world" && n.quests ? `<sup class="nbadge qbadge">${n.quests}</sup>` : g === "home" && n.minions ? '<sup class="nbadge">🎯</sup>' : "";
    return `<button class="${g === cur ? "on" : ""}" data-group="${g}" data-tab="${groupTarget(g)}" aria-label="${name}"${g === cur ? ' aria-current="page"' : ""}>${i}${badge}${dot ? '<i class="ndot"></i>' : ""}<br>${name}</button>`;
  }).join("");
  return bar + `<button class="menubtn" data-a="m_open" id="menubtn" title="Menu: Continue, Load, Settings, Encyclopedia, Unlocks" aria-label="Menu" aria-haspopup="dialog">☰<br>Menu</button>`;
}
export function subtabsv() {
  const g = groupOf(U.tab), ts = groupTabs(g);
  if (ts.length < 2) return "";
  const n = needs();
  const strip = ts.map(k => `<button role="tab" class="${k === U.tab ? "on" : ""}" data-tab="${k}" aria-selected="${k === U.tab}" tabindex="${k === U.tab ? 0 : -1}">${VIEWS[k][0]} ${VIEWS[k][1]}${k === "minions" && n.minions ? " 🎯" + n.minions : ""}${k === "quests" && n.quests ? `<sup class="nbadge qbadge">${n.quests}</sup>` : ""}${dotOf(k)}</button>`).join("");
  const all = ts.length >= SHEET_MIN ? `<button class="allbtn" id="allbtn" data-a="sheet_open" aria-haspopup="dialog" aria-label="All ${GROUPS.find(x => x[0] === g)[2]} pages">▾ All</button>` : "";
  return `<div class="strip" role="tablist" aria-label="${GROUPS.find(x => x[0] === g)[2]} pages">${strip}</div>${all}`;
}

// ---- modal helpers (sheet and Go to… share them): the page behind is inert while one is open
const INERT = ["top", "subtabs", "view", "tabs", "dock", "toasts", "overlay"];
let openFrom = null;
const lock = on => { for (const id of INERT) { const n = document.getElementById(id); if (n) n.inert = on; } document.body.classList.toggle("navmodal", on); };
export const sheetOpen = () => !document.getElementById("sheet").hidden;
export const gotoOpen = () => !document.getElementById("goto").hidden;
export const navModalOpen = () => sheetOpen() || gotoOpen();

export function sheetHtml() {
  const g = groupOf(U.tab), G = GROUPS.find(x => x[0] === g), n = needs();
  const rows = groupTabs(g).map(k => `<button class="srow${k === U.tab ? " on" : ""}" role="menuitem" data-tab="${k}"${k === U.tab ? ' aria-current="page"' : ""}><span class="sico">${VIEWS[k][0]}</span><span class="stx"><b>${VIEWS[k][1]}</b><span class="muted">${VIEWS[k][3]}</span></span>${k === "quests" && n.quests ? `<span class="chip">${n.quests}</span>` : ""}${k === "minions" && n.minions ? `<span class="chip">🎯 ${n.minions}</span>` : ""}${dotOf(k)}</button>`).join("");
  return `<div class="sbackdrop" data-a="sheet_close"></div><div class="sbox" role="dialog" aria-modal="true" aria-labelledby="sheettitle"><div class="shead"><b id="sheettitle">${G[1]} ${G[2]}</b><span class="muted"> · ${groupTabs(g).length} pages</span><span style="flex:1"></span><button class="b" data-a="goto_open" aria-label="Go to…">🔎</button><button class="b" data-a="sheet_close" aria-label="Close" data-autofocus>✕</button></div><div class="slist" data-nav role="menu">${rows}</div></div>`;
}
export function openSheet() {
  const el = document.getElementById("sheet");
  if (!el || !el.hidden || groupTabs(groupOf(U.tab)).length < 2) return;
  closeGoto(true);
  openFrom = document.activeElement;
  el.innerHTML = sheetHtml(); el.hidden = false; lock(true);
  const f = el.querySelector(".srow.on") || el.querySelector("[data-autofocus]");
  if (f) f.focus({ preventScroll: true });
}
export function closeSheet(quiet) {
  const el = document.getElementById("sheet");
  if (!el || el.hidden) return;
  el.hidden = true; el.innerHTML = "";
  if (!gotoOpen()) lock(false);
  if (!quiet) { const b = document.getElementById("allbtn") || openFrom; if (b && document.contains(b)) try { b.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
}

// ---- Go to…
let jidx = null, picks = [];
const recentEntries = () => {
  jidx ||= jumpIndex();
  return UI.recent.map(k => { const [kind, id] = k.split(":"); return jidx.find(e => e.kind === kind && e.id === id); }).filter(Boolean).filter(e => e.kind !== "view" || tabVisible(e.view)).slice(0, 5);
};
const rowHtml = (e, i) => `<button class="grow" role="option" data-a="goto_pick" data-v="${e.kind}:${e.id}" id="gopt${i}"><span class="sico">${esc(e.icon || "➜")}</span><span class="stx"><b>${esc(e.label)}</b><span class="muted">${esc(e.path)}</span></span></button>`;
export function gotoResults(q) {
  jidx ||= jumpIndex();
  const vis = jidx.filter(e => e.kind === "menu" || tabVisible(e.view));
  const r = String(q || "").trim() ? jumpSearch(q, vis, 12) : recentEntries();
  picks = r;
  const head = String(q || "").trim() ? "" : r.length ? `<div class="muted gh">Recent</div>` : `<div class="muted gh">Type a place, a card or a setting, like “quota”, “save” or “suitors”.</div>`;
  return head + (r.length || !String(q || "").trim() ? r.map(rowHtml).join("") : `<div class="muted gh">Nothing matches “${esc(q)}”.</div>`);
}
export function openGoto() {
  const el = document.getElementById("goto");
  if (!el || !el.hidden) return;
  closeSheet(true);
  openFrom = document.activeElement;
  el.innerHTML = `<div class="sbackdrop" data-a="goto_close"></div><div class="sbox gbox" role="dialog" aria-modal="true" aria-label="Go to"><div class="shead"><input id="gotoq" type="search" autocomplete="off" placeholder="Go to…  (a place, card or setting)" role="combobox" aria-expanded="true" aria-controls="gotores" aria-label="Go to"><button class="b" data-a="goto_close" aria-label="Close">✕</button></div><div id="gotores" class="slist" role="listbox" data-nav>${gotoResults("")}</div></div>`;
  el.hidden = false; lock(true);
  document.getElementById("gotoq").focus();
}
export function closeGoto(quiet) {
  const el = document.getElementById("goto");
  if (!el || el.hidden) return;
  el.hidden = true; el.innerHTML = "";
  if (!sheetOpen()) lock(false);
  if (!quiet && openFrom && document.contains(openFrom)) try { openFrom.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
}
export function gotoPick(key, go, menu) {
  const [kind, id] = key.split(":");
  jidx ||= jumpIndex();
  const e = jidx.find(x => x.kind === kind && x.id === id);
  if (!e) return;
  UI.recent = [key, ...UI.recent.filter(x => x !== key)].slice(0, 6); uiSave();
  closeGoto(true); lock(false);
  if (e.kind === "menu") return menu(e.id);
  if (e.kind === "sec") secReveal(e.id);
  go(e.view, e.kind === "sec" ? e.id : null);
}
// scroll to a section after the render that follows a jump
export function revealSection(id) {
  const d = document.querySelector(`#view [data-sec="${id}"]`);
  if (!d) return;
  d.open = true;
  d.scrollIntoView({ block: "start" });
  d.classList.add("flash");
  const sm = d.querySelector("summary"); if (sm) sm.focus({ preventScroll: true });
  setTimeout(() => d.classList.remove("flash"), 1600);
}

// ---- keyboard
document.addEventListener("input", e => { if (e.target && e.target.id === "gotoq") document.getElementById("gotores").innerHTML = gotoResults(e.target.value); });
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && navModalOpen()) { e.preventDefault(); e.stopPropagation(); gotoOpen() ? closeGoto() : closeSheet(); return; }
  if (U.screen) return;
  const a = document.activeElement, typing = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
  if (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey && !navModalOpen()) { e.preventDefault(); openGoto(); return; }
  if (navModalOpen()) {
    const root = document.getElementById(gotoOpen() ? "goto" : "sheet");
    if (e.key === "Tab") { // keep focus inside the open sheet / jump list
      const f = [...root.querySelectorAll("button,input")].filter(n => !n.disabled && n.offsetParent !== null);
      if (!f.length) return;
      const i = f.indexOf(a);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && (i === f.length - 1 || i < 0)) { e.preventDefault(); f[0].focus(); }
      return;
    }
    if (/^Arrow(Up|Down)$/.test(e.key)) {
      const f = [...root.querySelectorAll(".srow,.grow,#gotoq")];
      if (f.length < 2) return;
      e.preventDefault();
      const i = f.indexOf(a), d = e.key === "ArrowDown" ? 1 : -1;
      f[i < 0 ? (d > 0 ? 0 : f.length - 1) : (i + d + f.length) % f.length].focus();
      return;
    }
    if (e.key === "Enter" && a && a.id === "gotoq" && picks[0]) { e.preventDefault(); document.querySelector("#gotores .grow")?.click(); }
    return;
  }
  // roving focus inside the sub-tab strip (focus moves; Enter / Space activates)
  if (a && a.getAttribute && a.getAttribute("role") === "tab" && /^(ArrowLeft|ArrowRight|Home|End)$/.test(e.key)) {
    const f = [...a.parentElement.querySelectorAll('[role="tab"]')];
    const i = f.indexOf(a);
    const j = e.key === "Home" ? 0 : e.key === "End" ? f.length - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + f.length) % f.length;
    e.preventDefault();
    f.forEach((n, k) => (n.tabIndex = k === j ? 0 : -1));
    f[j].focus();
  }
});
