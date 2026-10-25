// R39.1: 🧪 Tester badge actions + "What's new" popup (own overlay #wnpanel, outside the per-frame render).
import * as E from "../engine.js";
import { BUILD } from "../config.js";
import { U } from "./state.js";

let el = null;
const esc = x => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;");

export function testerBadge() {
  if (!E.badgeShown(localStorage)) return "";
  const p = E.playPass();
  return `<span class="testerbadge" id="testerbadge" title="Play pass active (${esc(p.name)}): all content unlocked">🧪 Tester</span><button class="b" data-fb="open" title="Send feedback">💬</button><button class="b" data-pp="hidebadge" title="Hide the tester badge (show it again from ☰ Menu › Settings)">✕</button>`;
}

// Settings-screen card (was the Saves tab): What's new link (everyone) + play pass status (testers)
export function savesExtras() {
  const p = E.playPass();
  return `<div class="card" id="savesextras"><div class="row"><span>📰 <b>What's new</b> <span class="muted">· ${BUILD}</span></span><button class="b" data-pp="whatsnew">Show</button></div>${
    p ? `<div class="row" style="margin-top:4px"><span>🧪 Play pass active: <b>${esc(p.name)}</b> <span class="muted">· all content unlocked</span></span>${E.badgeShown(localStorage) ? "" : '<button class="b" data-pp="showbadge">Show badge</button>'}</div>` : ""
  }${U.passInit && U.passInit.changed === "off" ? '<div class="muted">This tester link has been retired, so the play pass is off.</div>' : ""}${U.passInit && U.passInit.changed === "bad" ? '<div class="muted">That tester link isn\'t valid.</div>' : ""}</div>`;
}

export function openWhatsNew(all = false) {
  const L = E.whatsNewEntries(localStorage, all);
  E.markWhatsNewSeen(localStorage, BUILD);
  if (!el) {
    el = document.createElement("div");
    el.id = "wnpanel";
    document.body.appendChild(el);
  }
  el.hidden = false;
  el.innerHTML = `<div class="card wncard" role="dialog" aria-label="What's new"><div class="row"><h3>📰 What's new</h3><button class="b" data-pp="closewn" aria-label="Close">✕</button></div>${L.map(
    e => `<div class="wnentry"><b>${esc(e.build)} · ${esc(e.title)}</b><ul>${e.items.map(i => `<li>${esc(i)}</li>`).join("")}</ul></div>`,
  ).join("")}${all ? "" : '<div class="muted">Reopen this any time from ☰ Menu › Settings.</div>'}<div class="row" style="justify-content:flex-end"><button class="b sel" data-pp="closewn">Got it</button></div></div>`;
}
export const closeWhatsNew = () => el && (el.hidden = true);

document.addEventListener("click", e => {
  const b = e.target.closest("[data-pp]");
  if (!b) return;
  const k = b.dataset.pp;
  if (k === "whatsnew") openWhatsNew(true);
  else if (k === "closewn") closeWhatsNew();
  else if (k === "hidebadge") E.setBadge(localStorage, false);
  else if (k === "showbadge") E.setBadge(localStorage, true);
});

// once per update; main.js calls this after the game has loaded
export function startWhatsNew(freshPlayer) {
  if (E.whatsNewDue(localStorage, BUILD, freshPlayer)) openWhatsNew(false);
}
