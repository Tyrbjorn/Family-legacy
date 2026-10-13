// Reusable progress bar + Timers dock + notification toasts/bell.
import * as E from "../engine.js";
import { D, s } from "../main.js";
import { U } from "./state.js";

const esc = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// real seconds for one in-game day at current speed/turbo
export const secPerDay = () => D.tuning.secPerDayActive / (E.globalTick(s) * (s.turbo.on ? D.tuning.turboMult : 1));

export function fmtLeft(sec) {
  if (sec == null || !isFinite(sec)) return "";
  sec = Math.max(0, Math.round(sec));
  if (sec < 60) return sec + "s";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, "0")}s`;
  return `${Math.floor(sec / 3600)}h ${String(Math.floor((sec % 3600) / 60)).padStart(2, "0")}m`;
}
export const leftOf = t => (t.leftSec != null ? t.leftSec : t.left == null ? null : t.left * secPerDay());

// One component everywhere: <div class="pb"><i></i><span>label · time left</span></div>
// Width animates via CSS transition matching the 500 ms tick, so it moves smoothly without JS animation.
export function pbar(p, label = "", left = null, cls = "") {
  const w = Math.round(Math.max(0, Math.min(1, p || 0)) * 1000) / 10;
  const tl = left == null ? "" : `<b>${fmtLeft(left)}</b>`;
  return `<div class="pb ${cls}" role="progressbar" aria-valuenow="${w}" aria-valuemin="0" aria-valuemax="100"><i style="width:${w}%"></i><span>${esc(label)}</span>${tl}</div>`;
}
export const timerBar = (t, cls = "") => (t ? pbar(t.p, t.what, leftOf(t), cls) : "");

// ---- Timers dock (collapsed by default, state saved in localStorage)
const DOCK_KEY = "fl-dock";
export const dockOpen = () => localStorage.getItem(DOCK_KEY) === "1";
export const toggleDock = () => localStorage.setItem(DOCK_KEY, dockOpen() ? "0" : "1");

export function allTimers() {
  const list = E.timers(s);
  const tb = E.turboTimer(s);
  if (tb) list.push(tb);
  return list;
}

export function dockv() {
  const list = allTimers();
  const timed = list.filter(t => leftOf(t) != null).sort((a, b) => leftOf(a) - leftOf(b));
  const soon = timed[0] || list[0];
  const head = `<button class="dockhead" data-a="dock" aria-expanded="${dockOpen()}">⏳ <b>${list.length}</b> timer${list.length === 1 ? "" : "s"}${
    soon
      ? ` · <span class="muted">${soon.icon} ${esc(soon.who)}: ${esc(soon.what)} ${leftOf(soon) != null ? "· " + fmtLeft(leftOf(soon)) : ""}</span>`
      : ""
  }<span class="caret">${dockOpen() ? "▾" : "▴"}</span></button>`;
  if (!dockOpen()) return head;
  const rows = [...timed, ...list.filter(t => leftOf(t) == null)]
    .map(
      t =>
        `<button class="trow" data-a="gotab" data-v="${t.tab}"><span class="ti">${t.icon}</span><span class="tw"><b>${esc(t.who)}</b>${pbar(t.p, t.what, leftOf(t))}</span></button>`,
    )
    .join("");
  return head + `<div class="docklist">${rows || '<div class="muted">Nothing running.</div>'}</div>`;
}

// ---- notifications
let lastSeq = null;
const shown = [];
export function toastsv() {
  if (lastSeq == null) lastSeq = s.noteSeq || 0; // don't toast history on load
  const now = Date.now();
  for (const n of E.notesSince(s, lastSeq).reverse()) shown.push({ n, until: now + 4000 });
  lastSeq = s.noteSeq || 0;
  while (shown.length && shown[0].until < now) shown.shift();
  while (shown.length > (D.notify?.toastMax || 3)) shown.shift();
  const cats = E.noteCats();
  return shown
    .map(({ n }) => `<div class="toast" data-a="bell">${esc(n.t)}${n.n > 1 ? ` <b>×${n.n}</b>` : ""}</div>`)
    .join("");
}
export const bellv = () => {
  const u = E.unreadNotes(s).length;
  return `<button class="bell" data-a="bell" title="Notifications">🔔${u ? `<b>${u > 99 ? "99+" : u}</b>` : ""}</button>`;
};
export function bellPanel() {
  if (!U.bell) return "";
  const cats = E.noteCats();
  const ns = (s.notes || []).filter(n => !(s.noteOff || {})[n.c]);
  return `<div class="card bellpanel"><div class="row"><b>🔔 Notifications</b><span style="flex:1"></span><button class="b" data-a="bellread">Mark read</button><button class="b" data-a="bell">✕</button></div>${
    ns
      .map(
        n =>
          `<div class="${n.read ? "muted" : ""}">${cats[n.c]?.icon || ""} ${esc(n.t)}${n.n > 1 ? ` ×${n.n}` : ""} <span class="muted">· D${n.d}</span></div>`,
      )
      .join("") || '<div class="muted">No notifications yet.</div>'
  }</div>`;
}
