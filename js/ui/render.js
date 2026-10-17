import { introCards } from "./guide.js";
import { glideMarkers } from "./map-glide.js";
import * as E from "../engine.js";
import { U } from "./state.js";
import { $, fmt, hm, memberLine, sk, top, yr } from "./common.js";
import { estatev } from "./estate-tab.js";
import { guildsv } from "./guilds-tab.js";
import { invv } from "./inventory-tab.js";
import { D, report, s } from "../main.js";
import { jobsv, mainv } from "./main-tab.js";
import { mapv } from "./map-tab.js";
import { automationv } from "./automation-tab.js";
import { minionsv } from "./minions-tab.js";
import { craftingv } from "./crafting-tab.js";
import { chroniclev } from "./chronicle-tab.js";
import { familyv } from "./family-tab.js";
import { questBadge, questsv } from "./quests-tab.js";
import { characterv } from "./character-tab.js";
import { housesv, suitorCard } from "./houses-tab.js";
import { bellPanel, dockv, toastsv } from "./progress.js";
import { tourOverlay } from "./guide.js";

export const TABS = {
  main: ["🧝", "Main", mainv],
  family: ["🌳", "Family", familyv],
  quests: ["📜", "Quests", questsv],
  char: ["🧑", "Character", characterv],
  jobs: ["💼", "Jobs", jobsv],
  inv: ["🎒", "Inventory", invv],
  estate: ["🏰", "Estate", estatev],
  map: ["🗺️", "Map", mapv],
  minions: ["🧑‍🤝‍🧑", "Minions", minionsv],
  guilds: ["🏛️", "Guilds", guildsv],
  craft: ["🔨", "Crafting", craftingv],
  auto: ["⚙️", "Automation", automationv],
  chron: ["📜", "Chronicle", chroniclev],
  houses: ["🏰", "Houses", housesv],
};

// Phone nav: 6 group buttons; groups with several tabs get a sub-tab strip under the header.
// A group button opens its last-used visible tab. Unlock rules still come from tabVisible().
export const GROUPS = [
  ["main", "🧝", "Main", ["main"]],
  ["work", "💼", "Work", ["quests", "jobs", "guilds"]],
  ["map", "🗺️", "Map", ["map"]],
  ["inv", "🎒", "Bag", ["inv"]],
  ["home", "🏰", "Estate", ["estate", "minions", "craft", "auto"]],
  ["kin", "🌳", "Family", ["char", "family", "houses", "chron"]],
];
export const groupOf = t => (GROUPS.find(g => g[3].includes(t)) || GROUPS[0])[0];
window.__tabGroup = groupOf;
const groupTabs = g => GROUPS.find(x => x[0] === g)[3].filter(tabVisible);
export function groupTarget(g) {
  const ts = groupTabs(g);
  if (ts.includes(U.tab)) return U.tab;
  const last = (U.groupLast || {})[g];
  return ts.includes(last) ? last : ts[0];
}
function navv() {
  const cur = groupOf(U.tab);
  return GROUPS.filter(([g]) => groupTabs(g).length)
    .map(
      ([g, i, n]) =>
        `<button class="${g === cur ? "on" : ""}" data-group="${g}" data-tab="${groupTarget(g)}">${i}${g === "home" && E.pendingCount(s) ? '<sup class="nbadge">🎯</sup>' : ""}${g === "work" && questBadge() ? `<sup class="nbadge qbadge">${questBadge()}</sup>` : ""}<br>${n}</button>`,
    )
    .join("");
}
function subtabsv() {
  const ts = groupTabs(groupOf(U.tab));
  if (ts.length < 2) return "";
  return ts
    .map(k => `<button class="${k === U.tab ? "on" : ""}" data-tab="${k}">${TABS[k][0]} ${TABS[k][1]}${k === "minions" && E.pendingCount(s) ? " 🎯" + E.pendingCount(s) : ""}</button>`)
    .join("");
}

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
  const h = introCards(U.tab) + TABS[U.tab][2]();
  if (h !== U.lastHTML) {
    const y = scrollY;
    const tw = $("#treewrap"),
      tl = tw && [tw.scrollLeft, tw.scrollTop];
    $("#view").innerHTML = h;
    if (tl && $("#treewrap")) [$("#treewrap").scrollLeft, $("#treewrap").scrollTop] = tl;
    U.lastHTML = h;
    scrollTo(0, y);
  }
  if (U.tab === "map") glideMarkers(!!(s.turbo && s.turbo.on));
  setIf("#tabs", navv());
  setIf("#subtabs", subtabsv());
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
