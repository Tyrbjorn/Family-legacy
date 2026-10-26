// R77 intro cards, Orrin's tours, Ledger of Firsts, Ground Ledger and Orrin's chime-ins. UI-only: the only state it writes is fl_ui_v1 (UI)
// and runtime U.* fields. It never writes `s`. (Existing engine calls made by navGo, e.g. tutNote / introView, are the player's own clicks.)
import * as E from "../engine.js";
import { D, s, slot, entered, getLegacyRec, navGo } from "../main.js";
import { U } from "./state.js";
import { UI, uiOk, uiSave } from "./ui-live.js";
import { render, tabVisible } from "./render.js";
import { VIEWS } from "./nav-data.js";
import { sect } from "./sect.js";
import { INTRO_CARDS, CHAPTERS, chapterOf, OFFER, EXPLAINERS, LEDGER_TITLE, GROUND_NOTE, GROUND_TITLE, MASTERS, masterOf, INTRO_PLAYED, CREATION_HEAD, CREATION_HINT, allChimes } from "./coach-data.js";
import { coachHelpers, ledgerRows, ledgerNext, ledgerDone, groundRows, groundDone, todayCoach, ledgerRec, firstLook, noteList, seenNotes, pendingNotes, markSeen, isSeen, noteFirst, FIRST_OF, chapterStops, stopText, tutActive, tutComplete, isMature } from "./coach-logic.js";

const esc = x => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
let _H = null;
export const H = () => (_H ||= coachHelpers(E, D));
const T0 = Date.now();
const gameOn = () => entered && slot >= 1;
const questName = id => { const q = E.findId(D.quests, id); return q ? q.name : id; };
const viewName = v => (VIEWS[v] ? `${VIEWS[v][0]} ${VIEWS[v][1]}` : v);

// ---------------------------------------------------------------- creation: "Apprenticed to" (flavor only)
export function masterRow(c) {
  const cur = masterOf(c.master || "orrin");
  return `<div class="card"><b>${esc(CREATION_HEAD)}</b><div class="muted">${esc(CREATION_HINT)}</div><div class="row" style="flex-wrap:wrap;gap:4px" role="group" aria-label="Apprenticed to">${MASTERS.map(m => `<button class="b${m.id === cur.id ? " sel" : ""}" data-a="cre" data-v="master:${m.id}" aria-pressed="${m.id === cur.id}">${esc(m.name)}<span class="muted"> · ${esc(m.trade)}</span></button>`).join("")}</div></div>`;
}
export const setMaster = (c, id) => { if (MASTERS.some(m => m.id === id)) c.master = id; };
// called when creation is confirmed (crestart / crequick): remembers the master in the UI profile and opens the intro on a new save
export function coachCreated(master) {
  if (!uiOk() || !(slot >= 1)) return;
  const r = ledgerRec(UI, slot);
  r.master = MASTERS.some(m => m.id === master) ? master : "orrin";
  uiSave();
  if (introWanted()) startIntro(true);
}

// ---------------------------------------------------------------- intro cards (menu layer screens "intro")
export const introWanted = () => uiOk() && slot >= 1 && !UI.intro.played && !UI.coach.off && !UI.intro.done[String(slot)];
export function startIntro(first) { U.introI = 0; U.introFirst = !!first; U.introBack = first ? null : U.screen || "title"; U.screen = "intro"; }
export function introScreen() {
  const i = Math.max(0, Math.min(INTRO_CARDS.length - 1, U.introI | 0)), c = INTRO_CARDS[i], first = !!U.introFirst, last = i === INTRO_CARDS.length - 1;
  const lg = getLegacyRec().unlocks.length > 0;
  return `<div class="mhead">${first ? "" : `<button class="b" data-a="m_back">← Back</button>`}<h2 id="mtitle">${c.icon} ${esc(c.title)}</h2></div>
<div class="card introcard" aria-live="polite"><p>${esc(c.text)}</p></div>
<div class="idots" aria-label="Card ${i + 1} of ${INTRO_CARDS.length}">${INTRO_CARDS.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("")}</div>
<div class="row introrow">${i > 0 ? `<button class="b" data-a="intro_back">‹ Back</button>` : ""}<span style="flex:1"></span>${first ? `<button class="b" data-a="intro_skip">Skip</button>` : ""}<button class="b sel big" data-a="intro_next" data-autofocus>${last ? (first ? "Begin" : "Done") : "Next ›"}</button></div>
${first && i === 0 ? `<div class="row"><button class="b${lg ? " sel" : ""}" data-a="intro_played" aria-pressed="false">${esc(INTRO_PLAYED)}</button></div>` : ""}`;
}
function introEnd() {
  if (U.introFirst && uiOk() && slot >= 1) { UI.intro.done[String(slot)] = 1; uiSave(); }
  U.screen = U.introFirst ? null : U.introBack || "title";
  U.introFirst = false;
}

// ---------------------------------------------------------------- How to play (chapter picker) and replay
const stat = id => UI.coach.chapters[id];
export function howScreen() {
  const on = gameOn(), off = UI.coach.off;
  const rows = CHAPTERS.map(c => {
    const st = stat(c.id), vis = c.menu || chapterStops(c, tabVisible, H()).length > 0;
    const dis = c.menu ? false : !on || !vis;
    return `<div class="card row hrow"><span><b>${c.icon} ${esc(c.id.toUpperCase())} · ${esc(c.name)}</b>${st === "seen" ? ` <span class="ok">✓ seen</span>` : st === "skipped" ? ` <span class="muted">skipped</span>` : ""}${dis && !c.menu ? `<br><span class="muted">${on ? "Not open yet." : "Open a game to walk this one."}</span>` : ""}</span><button class="b${st ? "" : " sel"}" data-a="${c.menu ? "m_go" : "ch_start"}" data-v="${c.menu ? "tour8" : c.id}" ${dis ? "disabled" : ""}>${st ? "Replay" : "Start"}</button></div>`;
  }).join("");
  const m = UI.orrin.mute;
  return `<div class="mhead"><button class="b" data-a="m_back" data-autofocus>← Back</button><h2 id="mtitle">How to play</h2></div>
<div class="card muted">Master Orrin's short walks. Each one can be skipped or replayed any time.${UI.coach.off ? " Tours and Ledger are switched off." : ""}</div>
<h3 class="mh3">Tours</h3>${rows}
<h3 class="mh3">More</h3>
<div class="card row"><span><b>🎞️ Intro cards</b><br><span class="muted">The story so far, in four cards.</span></span><button class="b" data-a="intro_replay">Replay</button></div>
<div class="card row"><span><b>📜 Orrin's notes</b><br><span class="muted">Everything Orrin has told you, with where to go.</span></span><button class="b" data-a="m_go" data-v="notes">Open</button></div>
<div class="card"><b>🧔 Orrin's voice</b><div class="row" style="flex-wrap:wrap;gap:4px" role="group" aria-label="Mute Orrin">${muteBtns()}</div><div class="muted">${m === "all" ? "Orrin speaks up when something new opens." : m === "quiet" ? "Quiet: dots only, no speech bar." : "Off: nothing appears. Notes stay listed."}</div></div>
<div class="card row"><span><b>${off ? "🔕 Tours and Ledger are off" : "🔔 Tours and Ledger are on"}</b><br><span class="muted">${off ? "Turn them back on to see the Ledger of Firsts and Orrin's offers." : "Hides the Ledger of Firsts, Ground Ledger and Orrin's offers."}</span></span><button class="b" data-a="coach_toggle">${off ? "Turn on" : "Turn off"}</button></div>`;
}
export const muteBtns = () => [["all", "All"], ["quiet", "Quiet (dots only)"], ["off", "Off"]].map(([k, n]) => `<button class="b${UI.orrin.mute === k ? " sel" : ""}" data-a="orrin_mute" data-v="${k}" aria-pressed="${UI.orrin.mute === k}">${n}</button>`).join("");
// Settings card row (also used by the Encyclopedia link)
export const orrinSettings = () => `<div class="row" style="flex-wrap:wrap;gap:4px" role="group" aria-label="Mute Orrin"><span class="muted">🧔 Mute Orrin:</span>${muteBtns()}</div><div class="row"><button class="b" data-a="m_go" data-v="how">🧭 Tour</button><button class="b" data-a="m_go" data-v="notes">📜 Orrin's notes</button></div>`;

// ---------------------------------------------------------------- Orrin's notes (menu screen)
const noteBody = n => {
  const dn = id => (s.doneQuests || []).includes(id);
  const sl = n.steps && n.steps.length ? `<ol class="nsteps">${n.steps.map(x => `<li>${esc(x)}</li>`).join("")}</ol>` : "";
  const ql = n.quests && n.quests.length ? `<ul class="nq">${n.quests.map(id => `<li>${dn(id) ? "✅" : "⬜"} ${esc(questName(id))}</li>`).join("")}</ul>` : "";
  const go = gameOn() && n.go && n.go !== "@menu" ? `<button class="b sel" data-a="note_go" data-v="${n.id}">Go: ${esc(viewName(n.go).replace(/^\S+\s/, ""))}</button>` : "";
  const sh = gameOn() && n.ch ? `<button class="b" data-a="ch_start" data-v="${n.ch}">Show me</button>` : "";
  return `<div class="card note"><b>${n.icon} ${esc(n.title)}</b><div>${esc(n.line)}</div>${n.quote ? `<div class="muted">“${esc(n.quote)}”</div>` : ""}${sl}${ql}<div class="row">${go}${sh}</div></div>`;
};
export function notesScreen() {
  const list = slot >= 1 ? seenNotes(s, H(), UI, slot) : [];
  return `<div class="mhead"><button class="b" data-a="m_back" data-autofocus>← Back</button><h2 id="mtitle">Orrin's notes</h2></div>
${list.length ? list.map(noteBody).join("") : `<div class="card muted">Nothing yet. Orrin adds a note when a new part of the estate opens.</div>`}
<div class="card muted">Orrin: <span role="group">${muteBtns()}</span></div>`;
}

// ---------------------------------------------------------------- T8: the book (menu) as stepped cards
export function tour8Screen() {
  const ch = chapterOf("t8"), i = Math.max(0, Math.min(ch.stops.length - 1, U.t8i | 0)), c = ch.stops[i], last = i === ch.stops.length - 1;
  return `<div class="mhead"><button class="b" data-a="m_back">← Back</button><h2 id="mtitle">${c.icon} ${esc(c.title)}</h2></div>
<div class="card introcard" aria-live="polite"><p>${esc(c.text)}</p></div>
<div class="idots" aria-label="Step ${i + 1} of ${ch.stops.length}">${ch.stops.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("")}</div>
<div class="row introrow">${i > 0 ? `<button class="b" data-a="t8_back">‹ Back</button>` : ""}<span style="flex:1"></span><button class="b sel big" data-a="t8_next" data-autofocus>${last ? "Done" : "Next ›"}</button></div>`;
}

// ---------------------------------------------------------------- Today cards: Orrin's offer, Ledger of Firsts, Ground Ledger
const masterLine = () => { const m = masterOf(ledgerRec(UI, slot).master || "orrin"); return m.add ? `<div class="muted">“${esc(m.add)}” — ${esc(m.name)}</div>` : ""; };
export function offerCard() {
  const t = todayCoach(s, UI, slot, H(), uiOk() && slot >= 1);
  if (!t.offer || U.tourCh) return "";
  return `<div class="card tut orrinoffer"><b>🧔 ${esc(OFFER.title)}</b> <span class="muted">${esc(OFFER.text)}</span><div class="row"><button class="b sel" data-a="offer_walk">${esc(OFFER.yes)}</button><button class="b" data-a="offer_skip">${esc(OFFER.no)}</button></div></div>`;
}
const rowBtns = (r, tab) => `${r.go && r.go !== "@menu" ? `<button class="b" data-a="coach_go" data-v="${r.go}">Go</button>` : r.go === "@menu" ? `<button class="b" data-a="m_open">Open menu</button>` : ""}${r.ch ? `<button class="b" data-a="ch_start" data-v="${r.ch}">Show me</button>` : ""}`;
export function ledgerCard() {
  const t = todayCoach(s, UI, slot, H(), uiOk() && slot >= 1);
  if (!t.ledger) return "";
  const rows = t.rows, nxt = ledgerNext(rows), nDone = rows.filter(r => r.done).length;
  const body = `<h3>${LEDGER_TITLE}</h3>${masterLine()}<div class="lrows">${rows.map(r => `<div class="lrow${r.done ? " dn" : ""}${nxt && nxt.id === r.id ? " nx" : ""}"><span>${r.done ? "✅" : "⬜"} ${esc(r.label)}${!r.done && E.firstReward(r.id) ? ` <span class="muted">· ${E.firstReward(r.id)}</span>` : ""}</span>${nxt && nxt.id === r.id ? `<div class="muted">${esc(r.line)}</div><div class="row">${rowBtns(r)}</div>` : ""}</div>`).join("")}</div><div class="row"><button class="b" data-a="ledger_hide">Hide this</button></div>`;
  return sect("main.ledger", body, { chip: `${nDone}/${rows.length}` });
}
export function groundBody(full) {
  const rows = groundRows(s, H()), n = rows.filter(r => r.status === "done").length, tot = rows.filter(r => !r.later).length;
  const note = tutComplete(s, H()) ? `<div class="orrinq">🧔 “${esc(GROUND_NOTE)}”</div>` : "";
  return { n, tot, html: `<h3>${GROUND_TITLE}</h3>${note}${E.firstReward("ground_all") ? `<div class="muted">Finish every row for ${E.firstReward("ground_all")}.</div>` : ""}<div class="lrows">${rows.map(r => `<div class="lrow ${r.status}"><span>${r.status === "done" ? "✅" : r.status === "later" ? "⏳" : r.lock ? "🔒" : "⬜"} ${esc(r.label)}${r.status !== "done" && E.firstReward(r.id) ? ` <span class="muted">· ${E.firstReward(r.id)}</span>` : ""}</span>${r.status !== "done" ? `<div class="muted">${esc(r.note)}${r.lock ? ` · ${esc(r.lock)}` : ""}</div><div class="row">${r.status === "open" && !r.lock ? rowBtns(r) : ""}</div>` : ""}</div>`).join("")}</div>` };
}
export function groundCard() {
  const t = todayCoach(s, UI, slot, H(), uiOk() && slot >= 1);
  if (!t.ground) return "";
  const g = groundBody();
  return sect("main.ground", g.html + `<div class="row"><button class="b" data-a="ledger_hide">Hide this</button></div>`, { chip: `${g.n}/${g.tot}` });
}
// Quests tab: always available after the prologue (or on a mature save), unless tours/Ledger are switched off
export function questGround() {
  if (!uiOk() || slot < 1 || UI.coach.off) return "";
  if (!(tutComplete(s, H()) || (s.tut && s.tut.skipped) || isMature(s))) return "";
  const g = groundBody();
  return sect("quests.ground", g.html, { chip: `${g.n}/${g.tot}`, open: g.n < g.tot });
}
export const todayCoachHtml = () => offerCard() + ledgerCard() + groundCard();

// ---------------------------------------------------------------- tutorial card extras (Orrin's line per step + Show me)
import { STEP_LINES } from "./coach-data.js";
export function stepExtra(stepId) {
  const x = STEP_LINES[stepId];
  if (!x || UI.coach.off || !uiOk()) return "";
  return `<div class="tip">🧔 ${esc(x[0])}${x[1] ? ` <button class="b" data-a="ch_start" data-v="${x[1]}">Show me</button>` : ""}</div>`;
}

// ---------------------------------------------------------------- tours: chapter overlay
const visEl = sel => { if (!sel) return null; for (const el of document.querySelectorAll(sel)) { const r = el.getBoundingClientRect(); if (r.width > 0 && r.height > 0 && !el.closest("[hidden]")) return el; } return null; };
const tourList = () => { const ch = chapterOf(U.tourCh); return ch ? chapterStops(ch, tabVisible, H()) : []; };
export function tourStop() { const l = tourList(); return l[Math.max(0, Math.min(l.length - 1, U.tourI | 0))] || null; }
function tourSet(i, dir) {
  const l = tourList();
  if (i >= l.length) return tourFinish("seen");
  U.tourI = Math.max(0, i); U.tourDir = dir || 1; U.tourAsk = false; U.tourTry = 0;
  const st = l[U.tourI];
  if (st && st.tab && U.tab !== st.tab) navGo(st.tab);
}
function tourStart(id) {
  const ch = chapterOf(id);
  if (!ch || !gameOn()) return;
  if (ch.menu) { U.t8i = 0; U.screen = "tour8"; return; }
  U.screen = null; U.tourCh = id;
  if (!tourList().length) { U.tourCh = null; return; }
  tourSet(0, 1);
}
function tourFinish(how) {
  const id = U.tourCh;
  U.tourCh = null; U.tourI = 0; U.tourAsk = false;
  if (id && uiOk()) { UI.coach.chapters[id] = how; uiSave(); }
  const nx = (U.tourQueue || []).shift();
  if (nx && how === "seen") tourStart(nx);
}
export function tourOverlay() {
  if (!U.tourCh) return "";
  const l = tourList(), st = tourStop(), ch = chapterOf(U.tourCh);
  if (!st) return "";
  const el = visEl(st.sel), r = el ? el.getBoundingClientRect() : null;
  const hole = r ? `<div class="tourhole" style="left:${Math.round(r.left - 4)}px;top:${Math.round(r.top - 4)}px;width:${Math.round(r.width + 8)}px;height:${Math.round(r.height + 8)}px"></div>` : "";
  const low = r && r.top + r.height / 2 > innerHeight * 0.5;
  const pos = !r ? "top:50%;transform:translateY(-50%)" : low ? "top:calc(env(safe-area-inset-top) + 8px)" : "bottom:calc(env(safe-area-inset-bottom) + 84px)";
  const i = Math.min(l.length - 1, U.tourI | 0), last = i === l.length - 1;
  const dots = `<span class="tdots" aria-hidden="true">${l.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("")}</span>`;
  const body = U.tourAsk
    ? `<div><b>Leave this tour?</b></div><div class="row"><button class="b sel" data-a="ch_keep" data-autofocus>Keep going</button><button class="b" data-a="ch_skip">Leave tour</button></div>`
    : `<div class="muted">🧔 ${esc(ch.name)} · ${i + 1}/${l.length}</div><div class="ttx" aria-live="polite">${esc(stopText(st, H()) || "")}</div>${dots}<div class="row"><button class="b" data-a="ch_back" ${i === 0 ? "disabled" : ""}>‹ Back</button><button class="b" data-a="ch_next" data-autofocus>${last ? "Done" : "Next ›"}</button><span style="flex:1"></span><button class="b" data-a="ch_skip">Skip chapter</button><button class="b" data-a="ch_all">Skip all tours</button></div>`;
  return `<div class="tourwrap" role="dialog" aria-modal="true" aria-label="Orrin's tour"><button class="tourmask" data-a="ch_ask" aria-label="Leave the tour?" tabindex="-1"></button>${hole}<div class="tourtip card" style="${pos}">${body}</div></div>`;
}
let _tick = 0;
function tourTick() {
  if (!U.tourCh) return;
  const st = tourStop(), ov = document.getElementById("overlay");
  if (!st) return void setTimeout(() => { tourFinish("seen"); render(); }, 0);
  const el = visEl(st.sel);
  if (st.sel && !el && !st.soft) {
    if ((U.tourTry = (U.tourTry | 0) + 1) > 2) { // target not on screen: skip it silently, in the direction of travel
      const d = U.tourDir || 1;
      setTimeout(() => { if (d < 0 && (U.tourI | 0) <= 0) U.tourI = 0; else tourSet((U.tourI | 0) + d, d); U.lastHTML = ""; render(); }, 0);
    } else setTimeout(() => { U.lastHTML = ""; render(); }, 60);
    return;
  }
  if (el) {
    const r = el.getBoundingClientRect();
    if ((r.top < 56 || r.bottom > innerHeight - 70) && U.tourScrolled !== U.tourCh + ":" + U.tourI) {
      U.tourScrolled = U.tourCh + ":" + U.tourI;
      el.scrollIntoView({ block: "center", behavior: "instant" });
      return void setTimeout(() => render(), 0);
    }
  }
  if (ov && !ov.contains(document.activeElement)) { const b = ov.querySelector("[data-autofocus]") || ov.querySelector("button:not([disabled]):not(.tourmask)"); if (b) b.focus({ preventScroll: true }); }
}
let _raf = 0;
const rerender = () => { if (!U.tourCh || _raf) return; _raf = requestAnimationFrame(() => { _raf = 0; render(); }); };
addEventListener("resize", rerender);
addEventListener("scroll", rerender, { passive: true });
document.addEventListener("keydown", e => {
  if (!U.tourCh || U.screen) return;
  const k = e.key, ov = document.getElementById("overlay");
  if (k === "Escape") { e.preventDefault(); e.stopPropagation(); U.tourAsk = !U.tourAsk; render(); }
  else if (!U.tourAsk && (k === "ArrowRight" || k === "ArrowLeft")) { const b = ov && ov.querySelector(`[data-a="ch_${k === "ArrowRight" ? "next" : "back"}"]:not([disabled])`); if (b) { e.preventDefault(); b.click(); } }
}, true);

// ---------------------------------------------------------------- Orrin chime-ins (strip above the dock)
const blocked = () => {
  if (U.screen || U.create || U.tourCh || U.noteCard) return true;
  if (document.getElementById("sheet") && !document.getElementById("sheet").hidden) return true;
  if (document.getElementById("goto") && !document.getElementById("goto").hidden) return true;
  const md = document.getElementById("modal");
  if (md && !md.hidden) return true;
  const fo = document.activeElement;
  if (fo && /^(INPUT|TEXTAREA|SELECT)$/.test(fo.tagName)) return true;
  if (window._mapDrag || s.gameOver || (s.pendingClass && s.pendingClass[0]) || s.needSuccession) return true;
  return false;
};
const dotTo = n => { if (n.go && n.go !== "@menu" && VIEWS[n.go]) (U.orrinDots ||= {})[n.go] = 1; };
const later = id => { const n = noteList(s, H()).find(x => x.id === id); if (n) dotTo(n); U.orrinCur = null; U.orrinMenu = false; };
export function coachTick() {
  tourTick();
  if (!gameOn() || !uiOk()) return;
  const now = Date.now();
  if (U.coachSlot !== slot) { U.coachSlot = slot; if (firstLook(s, UI, slot, H())) uiSave(); U.orrinCur = null; }
  if (U.orrinCur && now - (U.orrinAt || 0) > 25000 && !U.orrinMenu) { later(U.orrinCur); render(); return; }
  if (now - _tick < 2000) return;
  _tick = now;
  if (UI.coach.off) return;
  if (U.orrinCur || blocked() || now - T0 < 20000) return;
  const pend = pendingNotes(s, H(), UI, slot), mode = UI.orrin.mute, act = tutActive(s, H());
  if (!pend.length) return;
  if (mode === "off") { for (const n of pend) markSeen(UI, slot, n.id); return void uiSave(); }
  if (mode === "quiet") { for (const n of pend) { markSeen(UI, slot, n.id); dotTo(n); } uiSave(); return void render(); }
  const ok = pend.filter(n => !(act && n.kind !== "explain")); // chimes wait for the prologue; explainers belong to it
  if (!ok.length) return;
  const gap = ok[0].kind === "explain" ? 15000 : 60000;
  if (now - (U.orrinLast || 0) < gap) return;
  if (ok.length > 2) { ok.forEach(n => markSeen(UI, slot, n.id)); U.orrinCur = "_many"; U.orrinMany = ok.length; }
  else { markSeen(UI, slot, ok[0].id); U.orrinCur = ok[0].id; }
  U.orrinAt = now; U.orrinLast = now; U.orrinMenu = false;
  uiSave(); render();
}
export function orrinStrip() {
  const id = U.orrinCur;
  if (!id || U.screen || U.tourCh || U.noteCard) return "";
  const menu = U.orrinMenu ? `<div class="row" role="group" aria-label="Mute Orrin">${muteBtns()}</div>` : "";
  const more = `<button class="b sel" data-a="orrin_more" data-v="${id}">${id === "_many" ? "Open notes" : "Tell me more"}</button>`;
  if (id === "_many") return `<div class="card ostrip" role="status"><span class="oic">🧔</span><div class="otx"><b>Orrin has ${U.orrinMany | 0} notes</b></div><div class="row">${more}<button class="b" data-a="orrin_later">Later</button><button class="b" data-a="orrin_menu" aria-label="Mute Orrin">⋯</button></div>${menu}</div>`;
  const n = noteList(s, H()).find(x => x.id === id);
  if (!n) return "";
  return `<div class="card ostrip" role="status"><span class="oic">${n.icon}</span><div class="otx"><b>${n.kind === "explain" ? "Orrin explains: " : ""}${esc(n.title)}</b> ${esc(n.line)}</div><div class="row">${more}<button class="b" data-a="orrin_later">Later</button><button class="b" data-a="orrin_menu" aria-label="Mute Orrin">⋯</button></div>${menu}</div>`;
}
export function noteDialog() {
  const id = U.noteCard;
  if (!id) return "";
  const n = noteList(s, H()).find(x => x.id === id);
  if (!n) return "";
  return `<div class="tourwrap" role="dialog" aria-modal="true" aria-label="${esc(n.title)}"><button class="tourmask" data-a="note_close" aria-label="Close" tabindex="-1"></button><div class="tourtip card notecard" style="top:50%;transform:translateY(-50%)">${noteBody(n).replace('class="card note"', 'class="note"')}<div class="row"><button class="b" data-a="note_close" data-autofocus>Got it</button><button class="b" data-a="m_go" data-v="notes">More in Orrin's notes</button></div></div></div>`;
}
export const orrinOverlay = () => (U.noteCard ? noteDialog() : tourOverlay());

// ---------------------------------------------------------------- click actions (merged into main.js `local`)
const toGo = v => { U.screen = null; if (VIEWS[v]) navGo(v); };
export const coachLocal = {
  intro_next: () => { const i = (U.introI | 0) + 1; if (i >= INTRO_CARDS.length) introEnd(); else U.introI = i; },
  intro_back: () => { U.introI = Math.max(0, (U.introI | 0) - 1); },
  intro_skip: () => introEnd(),
  intro_replay: () => startIntro(false),
  intro_played: () => { if (uiOk()) { UI.intro.played = true; UI.coach.off = true; if (UI.orrin.mute === "all") UI.orrin.mute = "quiet"; uiSave(); } U.introFirst = true; introEnd(); },
  coach_toggle: () => { UI.coach.off = !UI.coach.off; if (!UI.coach.off) UI.intro.played = false; uiSave(); },
  orrin_mute: v => { if (["all", "quiet", "off"].includes(v)) { UI.orrin.mute = v; uiSave(); } },
  t8_next: () => { const ch = chapterOf("t8"), i = (U.t8i | 0) + 1; if (i >= ch.stops.length) { if (uiOk()) { UI.coach.chapters.t8 = "seen"; uiSave(); } U.screen = "how"; } else U.t8i = i; },
  t8_back: () => { U.t8i = Math.max(0, (U.t8i | 0) - 1); },
  offer_walk: () => { if (slot >= 1 && uiOk()) { ledgerRec(UI, slot).firsts.offer = 1; uiSave(); } U.tourQueue = ["t2"]; tourStart("t1"); },
  offer_skip: () => { if (slot >= 1 && uiOk()) { ledgerRec(UI, slot).firsts.offer = 1; uiSave(); } },
  ledger_hide: () => { if (slot >= 1 && uiOk()) { ledgerRec(UI, slot).hidden = true; uiSave(); } },
  ch_start: v => { U.tourQueue = []; tourStart(v); },
  ch_next: () => tourSet((U.tourI | 0) + 1, 1),
  ch_back: () => tourSet(Math.max(0, (U.tourI | 0) - 1), -1),
  ch_ask: () => { U.tourAsk = true; },
  ch_keep: () => { U.tourAsk = false; },
  ch_skip: () => { U.tourQueue = []; tourFinish("skipped"); },
  ch_all: () => { U.tourQueue = []; U.tourCh = null; U.tourAsk = false; if (uiOk()) { UI.coach.off = true; uiSave(); } },
  coach_go: v => toGo(v),
  note_go: v => { const n = noteList(s, H()).find(x => x.id === v); U.noteCard = null; if (n) toGo(n.go); },
  note_close: () => { U.noteCard = null; },
  orrin_more: v => { const id = v; U.orrinCur = null; if (id === "_many") { U.screen = "notes"; } else U.noteCard = id; },
  orrin_later: () => later(U.orrinCur),
  orrin_menu: () => { U.orrinMenu = !U.orrinMenu; U.orrinAt = Date.now(); },
};
// run before the normal action table: returns true when handled
export function coachAct(a, v) { const f = coachLocal[a]; if (!f) return false; f(v); return true; }
// "firsts" the UI records from the player's own clicks (never read from, or written to, the save)
export function coachNote(a) {
  const k = FIRST_OF[a];
  if (k && uiOk() && slot >= 1 && noteFirst(UI, slot, k)) uiSave();
}
// view hooks for menu.js
export const COACH_SCREENS = { intro: introScreen, how: howScreen, notes: notesScreen, tour8: tour8Screen };
