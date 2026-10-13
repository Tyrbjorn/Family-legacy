import * as E from "../engine.js";
import { U } from "./state.js";
import { $, fmt, hm, memberLine, sk, top, yr } from "./common.js";
import { estatev } from "./estate-tab.js";
import { guildsv } from "./guilds-tab.js";
import { invv } from "./inventory-tab.js";
import { D, report, s } from "../main.js";
import { jobsv, mainv } from "./main-tab.js";
import { mapv } from "./map-tab.js";
import { minionsv } from "./minions-tab.js";
import { craftingv } from "./crafting-tab.js";
import { chroniclev } from "./chronicle-tab.js";
import { familyv } from "./family-tab.js";
import { bellPanel, dockv, toastsv } from "./progress.js";
import { tourOverlay } from "./guide.js";

export const TABS = {
  main: ["🧝", "Main", mainv],
  family: ["🌳", "Family", familyv],
  jobs: ["💼", "Jobs", jobsv],
  inv: ["🎒", "Inventory", invv],
  estate: ["🏰", "Estate", estatev],
  map: ["🗺️", "Map", mapv],
  minions: ["🧑‍🤝‍🧑", "Minions", minionsv],
  guilds: ["🏛️", "Guilds", guildsv],
  craft: ["🔨", "Crafting", craftingv],
  chron: ["📜", "Chronicle", chroniclev],
};

export function modal() {
  const el = $("#modal");
  if (s.gameOver) {
    el.hidden = false;
    el.innerHTML = `<div class="card"><h3>⚰️ The ${s.members[0].name} line has ended</h3><p>Renown: <b>${fmt(s.renown)}</b> · Generations of members: ${s.members.length} · Years: ${yr(s.day)}</p><h3>Family tree</h3>${s.members.map(m => `<div>${m.name} (${E.ageY(m)}y)${m.parents ? " – child of " + m.parents.map(p => s.members.find(x => x.id === p).name).join(" & ") : ""}</div>`).join("")}<h3>Deeds</h3>${s.deeds
      .slice(-15)
      .map(d => `<div class="muted">${d}</div>`)
      .join("")}<p><button class="b" data-a="reset">Start a New Lineage</button></p></div>`;
    return;
  }
  if (report) {
    el.hidden = false;
    el.innerHTML = `<div class="card"><h3>While you were away</h3><p>You were away ${hm(report.elapsed)}: ⚡ +${Math.round(report.turboAdded / 60)} min turbo${report.turboFull ? " (bar full)" : ""}.</p><p class="muted">The world waits for you: no aging, production or travel happens while away.</p><p><button class="b" data-a="close">Continue</button></p></div>`;
    return;
  }
  if (s.pendingEnc) {
    const p = s.pendingEnc;
    const e = E.encDef(p.id);
    const m = s.members.find(x => x.id === p.mid);
    el.hidden = false;
    el.innerHTML = `<div class="card"><h3>${e.icon} ${e.name}</h3><p>${e.text.replace("{who}", m.name)}</p>${e.options
      .map(
        o =>
          `<p><button class="b" data-a="enc" data-v="${o.id}" ${E.optionOk(s, o) ? "" : "disabled"}>${o.label}</button> <span class="muted">${o.check ? Math.round(E.optionChance(s, m, o) * 100) + "% success" : ""}</span></p>`,
      )
      .join("")}</div>`;
    return;
  }
  const pc = s.pendingClass[0];
  if (pc) {
    const m = s.members.find(x => x.id === pc);
    el.hidden = false;
    el.innerHTML = `<div class="card"><h3>${m.name} came of age! Choose a class</h3>${D.classes
      .filter(c => c.tier === 0)
      .map(
        c =>
          `<div class="card row"><span>${c.icon} ${c.name}<br><span class="muted">${c.stats.join("/")} · ${c.cpSkills.map(k => sk(k).name).join(", ")}</span></span><button class="b" data-a="class" data-v="${c.id}">Pick</button></div>`,
      )
      .join("")}</div>`;
    return;
  }
  if (s.needSuccession) {
    el.hidden = false;
    el.innerHTML = `<div class="card"><h3>🕯️ Succession</h3><p>Your active character has died. Choose who to play next:</p>${E.living(
      s,
    )
      .map(
        m =>
          `<div class="card row"><span>${memberLine(m)}</span><button class="b" data-a="switch" data-v="${m.id}">Play</button></div>`,
      )
      .join("")}</div>`;
    return;
  }
  el.hidden = true;
  el.innerHTML = "";
}

export const tabVisible = k => !!TABS[k] && (k !== "craft" || E.craftingUnlocked(s));

// every tab always visible; age only gates actions inside them
export function render() {
  if (!tabVisible(U.tab)) U.tab = "main";
  if (window._mapDrag) {
    $("#top").innerHTML = top();
    return;
  }
  const fo = document.activeElement;
  if (fo && /^(SELECT|INPUT)$/.test(fo.tagName) && $("#view").contains(fo) && !render.force) {
    $("#top").innerHTML = top();
    return;
  }
  render.force = false;
  $("#top").innerHTML = top();
  const h = TABS[U.tab][2]();
  if (h !== U.lastHTML) {
    const y = scrollY;
    const tw = $("#treewrap"),
      tl = tw && [tw.scrollLeft, tw.scrollTop];
    $("#view").innerHTML = h;
    if (tl && $("#treewrap")) [$("#treewrap").scrollLeft, $("#treewrap").scrollTop] = tl;
    U.lastHTML = h;
    scrollTo(0, y);
  }
  const tb = Object.entries(TABS)
    .filter(([k]) => tabVisible(k))
    .map(([k, [i, n]]) => `<button class="${k === U.tab ? "on" : ""}" data-tab="${k}">${i}<br>${n}</button>`)
    .join("");
  if (tb !== window._tb) {
    $("#tabs").innerHTML = tb;
    window._tb = tb;
  }
  setIf("#dock", dockv());
  setIf("#toasts", toastsv());
  setIf("#overlay", tourOverlay() + bellPanel());
  modal();
}

const _html = {};
function setIf(sel, h) {
  if (_html[sel] === h) return;
  _html[sel] = h;
  $(sel).innerHTML = h;
}
