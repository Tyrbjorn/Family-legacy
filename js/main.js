import { runAction } from "./ui/handlers/index.js";
import "./ui/feedback.js";
import { startWhatsNew } from "./ui/playpass-ui.js";
import * as E from "./engine.js";
import { U } from "./ui/state.js";
import { groupOf, render, introTabOf } from "./ui/render.js";
import { uiResetSlot } from "./ui/ui-live.js";
import { secToggle } from "./ui/sect.js";
import { openSheet, closeSheet, openGoto, closeGoto, gotoPick, revealSection } from "./ui/nav-ui.js";
import { choreNewsCheck } from "./ui/chores-ui.js";
import { BUILD } from "./config.js";
import { setMotion } from "./ui/motion.js";
import { coachAct, coachNote, coachCreated, setMaster } from "./ui/coach-ui.js";

const KEY = "familyLegacy.save.v1";

const names = [
  "fields",
  "factions",
  "r60",
  "boards",
  "build",
  "testers",
  "changelog",
  "skills",
  "classes",
  "traits",
  "buildings",
  "furniture",
  "items",
  "quests",
  "regions",
  "tuning",
  "nodes",
  "towns",
  "minions",
  "guilds",
  "jobs",
  "activities",
  "estate",
  "crafting",
  "map",
  "dungeons",
  "legacy",
  "chronicle",
  "achievements",
  "events",
  "encounters",
  "seasons",
  "tutorial",
  "notify",
  "marriage",
  "families",
  "phases",
  "intros",
  "firsts",
  "gear",
  "paths",
  "world",
  "metals",
  "endgame",
  "requests",
  "apprenticeships",
  "talents",
  "fish",
  "cooking",
  "art",
  "estatemap",
  "creation",
  "doll",
  "resnames",
  "estaterooms",
];

export const D = {};

await Promise.all(names.map(async n => (D[n] = await (await fetch(`data/${n}.json`)).json())));
await Promise.all(D.estate.structureFiles.map(async f => (D["structures/" + f] = await (await fetch(`data/structures/${f}.json`)).json())));

E.setData(D);

// Dev Mode lives in its own localStorage key (never in saves/exports). ?dev=1 reveals + enables, ?dev=0 disables.
const DEV_KEY = E.DEV_KEY;
{
  const r = E.resolveDevMode(localStorage, new URLSearchParams(location.search).get("dev")); // R39.1: locked off in release builds
  if (r.reveal) U.devRevealed = true;
}
// R39.1 tester play pass: ?tester=<token> (tokens in data/testers.json). Own key, never in saves; not Dev Mode.
U.passInit = E.initPlayPass(localStorage, new URLSearchParams(location.search).get("tester"));

export let s,
  sheetOpen = false,
  invF = { type: "all", q: "all", sort: "value" },
  report = null;

// R38 save slots: copy the old single save into slot 1 once (original kept), then open the last played slot.
// R76: the game opens on a title screen. Nothing is written and no time passes until the player presses Continue / picks a slot / starts
// a new game (`entered`). An unreadable slot is quarantined, never replaced by a fresh game; `slot` is 0 while no save is open.
const SL = E.Slots;
export let slot = 0,
  entered = false,
  bootSkipped = [];
let persistOff = false;
const mig = SL.migrateSlots(localStorage);
let legacyKeyMode = !!(mig.error && mig.fallback); // copy failed: keep playing the old save in place
try {
  if (legacyKeyMode) {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      try { s = E.deserialize(raw); slot = 1; } catch (e) { persistOff = true; } // unreadable old save: never written over
    }
  } else {
    const b = SL.bootPick(localStorage);
    bootSkipped = b.skipped;
    for (const h of SL.scanAll(localStorage)) if (!bootSkipped.some(x => x.n === h.n)) bootSkipped = [...bootSkipped, h]; // other unreadable slots are flagged too
    if (b.s) { s = b.s; slot = b.n; }
  }
} catch (e) {
  console.warn(e);
}

export const freshPlayer = !s && !persistOff && SL.listSlots(localStorage).every(x => x.empty);
const hadSave = !!s;
if (!s) { s = E.newGame(); slot = 0; } // in memory only; it takes a slot when the player starts a New Game
E.normalize(s);

// R76 profile settings (per device): classic emoji, reduced motion, skip title. s.classicEmoji mirrors the profile into the save.
export let prefs = E.loadSettings(localStorage, hadSave && s.classicEmoji).settings;
export function syncPrefs() {
  if (!!s.classicEmoji !== prefs.classic) s.classicEmoji = prefs.classic;
}
function setPref(k, v) { prefs = { ...prefs, [k]: v }; E.saveSettings(localStorage, prefs); if (k === "motion") setMotion(v); syncPrefs(); }
setMotion(prefs.motion);
syncPrefs();
U.screen = "title";

// R59 per-device legacy record (fl_legacy_v1): back-filled once from every slot, then updated on each save
export let legacyRec = E.loadLegacyRec(localStorage);
// R76 encyclopedia memory (fl_enc_v1): a profile-wide set of ids ever encountered + one set per slot ("this save"). Read-only on the game state.
export let enc = E.encLoad(localStorage);
export function encScan() {
  if (slot < 1 || !s || !s.members) return;
  try { if (E.encRecord(enc, slot, E.encObserve(D, s))) E.encSave(localStorage, enc); } catch (e) { /* never let the book break the game */ }
}
const encReset = n => { if (E.encResetSlot(enc, n)) E.encSave(localStorage, enc); uiResetSlot(n); }; // R77: fl_ui_v1 per-slot entries (seen / intro / ledger / Orrin) go with the save
let legacyRecStr = JSON.stringify(legacyRec);
E.setR60Rec(legacyRec); // R60 earned class keys
function noteLegacy(sv) {
  if (!sv || E.devOn()) return;
  const r = E.recordSave(legacyRec, sv);
  legacyRec = r.rec;
  E.setR60Rec(legacyRec);
  const j = JSON.stringify(legacyRec);
  if (j !== legacyRecStr) { legacyRecStr = j; E.saveLegacyRec(localStorage, legacyRec); if (r.fresh.length) U.legacyNew = r.fresh; }
}
if (localStorage.getItem(E.CR_KEY) == null) {
  for (const x of SL.listSlots(localStorage)) if (!x.empty) { try { noteLegacy(SL.readSlot(localStorage, x.n || x.slot)); } catch (e) {} }
  if (legacyKeyMode) noteLegacy(s);
  E.saveLegacyRec(localStorage, legacyRec); legacyRecStr = JSON.stringify(legacyRec);
  U.legacyNew = null;
}
export function getLegacyRec() { return legacyRec; }
export function resetLegacy() { legacyRec = E.resetLegacyRec(localStorage); E.setR60Rec(legacyRec); E.saveLegacyRec(localStorage, legacyRec); legacyRecStr = JSON.stringify(legacyRec); }
// creation draft for the founder of a brand-new dynasty (Quick start = close it, founder stays as rolled)
function openCreation() {
  const f = s.members.find(x => x.id === s.activeId) || s.members[0];
  U.create = { name: f.name, gender: f.gender, race: "human", blood: "", traits: [], cls: "", look: Object.assign({}, E.lookOf(s, f)), house: "navy", frame: "open", forSlot: slot };
}
export { openCreation };

let backing = false,
  playAcc = 0; // play seconds since the last successful save (slot meta)
const save = () => {
  if (window.__noSave) return;
  if (!entered || persistOff) return; // title screen: nothing is written (a stale write would also eat the offline time)
  syncPrefs();
  noteLegacy(s);
  if (legacyKeyMode) {
    try { localStorage.setItem(KEY, E.serialize(s)); } catch (e) { U.saveErr = "Couldn't save: storage full. Export this game or delete a slot."; }
    return;
  }
  if (slot < 1) return;
  const add = Math.floor(playAcc);
  const r = SL.saveSlot(localStorage, slot, s, Date.now(), { build: BUILD, addSec: add });
  U.saveErr = r.ok ? "" : r.err === "storage full" ? "Couldn't save: storage full. Export this slot or delete another. Retrying at the next autosave." : "Couldn't save: " + r.err;
  if (r.ok) {
    encScan();
    playAcc -= add;
    if (r.prev && !backing) { // rolling gzip backup of the save this one replaced (one per slot, dropped first when storage is short)
      backing = true;
      SL.makeBackup(localStorage, slot, r.prev).then(() => (backing = false), () => (backing = false));
    }
  }
};
// the player has opened a game: time passes from here. Offline progress since the last save is credited now (not at page load).
function enter(offline = true) {
  const first = !entered;
  entered = true;
  U.screen = null;
  U.tab = "main";
  if (offline && (slot > 0 || legacyKeyMode)) {
    report = E.applyOffline(s);
    if (report && report.elapsed < 60) report = null;
  } else report = null;
  last = performance.now();
  U.lastHTML = "";
  render.force = true;
  encScan();
  if (first) startWhatsNew(freshPlayer); // R39.1
}
function continueGame() {
  if (entered) return void (U.screen = null);
  if (slot > 0 || legacyKeyMode) enter(true);
}
// the ☰ button / title: Esc or Back from a sub screen goes to the title; the title itself closes only when a game is running
function menuBack() {
  if (U.screen && U.screen !== "title") U.screen = "title";
  else if (U.screen === "title" && entered) U.screen = null;
}
function openMenu() {
  if (entered) save();
  U.screen = "title";
}
// switch to a saved slot (the open one is saved first). An unreadable slot stays untouched and says why.
function playSlot(n) {
  if (n === slot) return void (entered ? ((U.screen = null), (U.tab = "main")) : continueGame());
  if (entered) save();
  let next;
  try { next = SL.loadSlot(localStorage, n); } catch (e) {
    U.slotMsg = `❌ Slot ${n} can't be opened (${e.slotBad === "version" ? "it comes from a different save version" : "its data is damaged"}). It is kept as it is; restore its backup, export the raw data or delete it below.`;
    return;
  }
  if (!next) return;
  s = next;
  E.normalize(s);
  slot = n;
  entered = false;
  enter(true);
}
function creSet(v) {
  const c = U.create; if (!c) return;
  const [k, x] = String(v).split(":"), O = E.creationOptions(legacyRec);
  const nm = document.querySelector("#crename"); if (nm) c.name = nm.value;
  if (k === "gender") { c.gender = x; const st = D.creation.hairStyles[x]; c.look.hair = st[0][0]; if (x === "m") delete c.look.beard; else delete c.look.bun; }
  else if (k === "race") { c.race = x; if (x !== "dwarf") delete c.look.beard; }
  else if (k === "blood") c.blood = x;
  else if (k === "cls") c.cls = c.cls === x ? "" : x;
  else if (k === "trait") { const tr = c.traits.includes(x) ? c.traits.filter(t => t !== x) : [...c.traits, x]; const e = E.creationIssue({ traits: tr }, legacyRec); if (e) U.createErr = e; else (c.traits = tr), (U.createErr = ""); }
  else if (k === "hair") c.look.hair = x;
  else if (k === "hairCol" || k === "skin") c.look[k] = +x;
  else if (k === "beard") x ? (c.look.beard = x) : delete c.look.beard;
  else if (k === "bun") c.look.bun = !c.look.bun;
  else if (k === "house") c.house = x;
  else if (k === "frame") c.frame = x;
  else if (k === "master") setMaster(c, x); // R77 flavor only: stored in fl_ui_v1, never in the save
  void O;
}
function newInSlot(n) {
  if (!SL.listSlots(localStorage)[n - 1].empty) return;
  if (entered) save();
  s = E.newGame();
  E.normalize(s);
  slot = n;
  encReset(n);
  entered = false;
  enter(false);
  save();
  U.tab = "main";
  openCreation(); // R59
}
// the player chose to put a save into this slot (import / restore): an unreadable slot may be replaced, after the confirm
function importIntoSlot(n, text) {
  let next;
  const sp = E.splitLegacyRec(text); // R59
  if (sp.rec) { legacyRec = E.mergeLegacyRecs(legacyRec, sp.rec); E.setR60Rec(legacyRec); E.saveLegacyRec(localStorage, legacyRec); legacyRecStr = JSON.stringify(legacyRec); }
  text = sp.save;
  try { next = E.importSave(text); } catch (err) { U.slotMsg = "❌ " + err.message; return; }
  const cur = SL.listSlots(localStorage)[n - 1];
  if (!cur.empty && !confirm(`Replace "${cur.name}" in slot ${n} with this save?`)) return;
  encReset(n);
  if (n === slot && entered) { s = next; report = null; save(); }
  else {
    if (n === slot) { s = next; E.normalize(s); } // title screen: the loaded slot is replaced before Continue
    const r = SL.saveSlot(localStorage, n, next, Date.now(), { force: true, build: BUILD });
    if (!r.ok) return void (U.slotMsg = "❌ " + r.err);
    SL.undo[n] && delete SL.undo[n];
    if (slot > 0 && slot !== n) SL.setLast(localStorage, slot);
  }
  U.slotMsg = `✅ Imported into slot ${n}.`;
}
function download(name, text) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function exportSlot(n) {
  const raw = n === slot && entered ? null : localStorage.getItem(SL.slotKey(n)), info = SL.listSlots(localStorage)[n - 1];
  let sv;
  try { sv = raw ? E.deserialize(raw) : s; } catch (e) { return void exportRaw(n); } // unreadable: hand over the raw data instead
  const code = E.withLegacyRec(E.exportCode(sv), legacyRec); // R59: legacy record rides along
  U.slotCode = code;
  download(`heirs-of-the-hold-${(info.name || "slot" + n).replace(/[^a-z0-9]+/gi, "-")}-Y${Math.floor(sv.day / D.tuning.daysPerYear) + 1}.txt`, code);
}
// an unreadable slot: the stored text exactly as it is, for support / manual repair
function exportRaw(n) {
  const raw = localStorage.getItem(SL.corruptKey(n)) || localStorage.getItem(SL.slotKey(n));
  if (!raw) return void (U.slotMsg = "Nothing stored in that slot.");
  download(`heirs-of-the-hold-slot${n}-raw.txt`, raw);
  U.slotMsg = `Raw data of slot ${n} downloaded as it is stored.`;
}
async function restoreSlot(n) {
  const cur = SL.listSlots(localStorage)[n - 1];
  if (!cur.bak) return void (U.slotMsg = "No backup for that slot yet.");
  if (!cur.bad && !confirm(`Replace slot ${n} (${cur.name}) with its backup from ${new Date(cur.bakAt).toLocaleString()}? The current save is kept as a raw copy.`)) return;
  const r = await SL.restoreBackup(localStorage, n);
  if (r.ok) encReset(n);
  U.slotMsg = r.ok ? `✅ Slot ${n} restored from its backup.` : "❌ " + r.err;
  if (r.ok && n === slot) { const b = SL.readSlot(localStorage, n); if (b) { s = b; E.normalize(s); } }
  if (r.ok && !entered && slot === 0) { const b = SL.readSlot(localStorage, n); if (b) { s = b; E.normalize(s); slot = n; } }
  U.lastHTML = "";
  render.force = true;
  render();
}

window.__game = {
  get s() {
    return s;
  },
  E,
  save,
  D,
};

// R77: the one way to move to a sub-tab (bar, strip, sheet, Go to…, buttons inside cards). `sec` = a card to open and scroll to.
export function navGo(tab, sec) {
  U.tab = tab;
  if (U.tab !== "legacy") (U.groupLast ||= {})[groupOf(U.tab)] = U.tab; // R37: Legacy panel is outside the nav groups
  if (groupOf(U.tab) === "home") E.tutNote(s, "estate");
  E.introView(s, introTabOf(U.tab));
  closeSheet(true);
  closeGoto(true);
  U.lastHTML = "";
  document.activeElement && document.activeElement.blur && document.activeElement.blur();
  render.force = true;
  render();
  if (sec) revealSection(sec); else scrollTo(0, 0);
}
window.__navGo = navGo;

document.addEventListener("click", e => {
  if (window._mapSuppress) {
    window._mapSuppress = false;
    if (e.target.closest("#worldmap")) return;
  }
  if (window._treeDragged) {
    window._treeDragged = false;
    if (e.target.closest("#treewrap")) return;
  }
  const sm = e.target.closest("summary");
  if (sm && sm.parentElement.matches("details[data-sec]")) secToggle(sm.parentElement); // R77: remember the open / closed state
  const t = e.target.closest("[data-tab]");
  if (t) return void navGo(t.dataset.tab);
  const b = e.target.closest("button[data-a],a[data-a],g[data-a]");
  if (!b) return;
  const a = b.dataset.a,
    v = b.dataset.v,
    m = E.active(s);
  const local = {
    sheet: () => {
      sheetOpen = !sheetOpen;
    },
    close: () => {
      report = null;
    },
    export: () => exportSave(),
    exportsave: () => exportSave(),
    import: () =>
      importText(
        document.querySelector("#savecode") ? document.querySelector("#savecode").value : prompt("Paste save code:"),
      ),
    importsave: () => importText(document.querySelector("#savecode") && document.querySelector("#savecode").value),
    slotplay: () => playSlot(+v),
    slotnew: () => newInSlot(+v),
    slotdel: () => {
      if (+v === slot && entered) return void (U.slotMsg = "Switch to another slot before deleting this one.");
      if (U.delArm !== +v) return void (U.delArm = +v); // first press arms (button turns red: "Press again to delete")
      U.delArm = 0;
      if (SL.deleteSlot(localStorage, +v)) {
        encReset(+v);
        U.slotMsg = `Deleted slot ${v}.`; U.undoSlot = +v;
        if (+v === slot) { s = E.newGame(); E.normalize(s); slot = 0; syncPrefs(); } // title screen: the loaded slot is gone, Continue goes away
      }
    },
    slotundo: () => {
      if (SL.undoDelete(localStorage, +v)) {
        U.slotMsg = `Restored slot ${v}.`; U.undoSlot = 0;
        if (!entered && slot === 0) { const b = SL.readSlot(localStorage, +v); if (b) { s = b; E.normalize(s); slot = +v; SL.setLast(localStorage, slot); } }
      }
    },
    slotrestore: () => { restoreSlot(+v); },
    slotraw: () => exportRaw(+v),
    m_open: () => { closeSheet(true); closeGoto(true); openMenu(); },
    sheet_open: () => openSheet(),
    sheet_close: () => closeSheet(),
    goto_open: () => openGoto(),
    goto_close: () => closeGoto(),
    goto_pick: () => gotoPick(v, navGo, id => { U.screen = id === "encyclopedia" ? "enc" : "set"; U.slotMsg = ""; U.delArm = 0; if (id === "encyclopedia") encScan(); }),
    m_back: () => menuBack(),
    m_continue: () => continueGame(),
    m_go: () => { U.screen = v; U.slotMsg = ""; U.delArm = 0; if (v === "enc") encScan(); },
    enc_sec: () => { U.encSec = v; U.encQ = ""; },
    enc_scope: () => { U.encScope = v; },
    unl_scope: () => { U.unlScope = v; },
    m_new: () => {
      const L = SL.listSlots(localStorage);
      if (L.every(x => x.empty)) newInSlot(1); // nothing saved yet: straight to the first slot
      else { U.screen = "new"; U.slotMsg = ""; }
    },
    m_newat: () => newInSlot(+v),
    slotrename: () => {
      const cur = SL.listSlots(localStorage)[+v - 1];
      const nm = prompt("Name for this dynasty", cur.name || "");
      if (nm === null) return;
      const note = prompt("Note (optional, e.g. 'trade route run')", cur.note || "");
      SL.renameSlot(localStorage, +v, nm, note === null ? undefined : note);
    },
    slotexport: () => exportSlot(+v),
    creopen: () => openCreation(),
    r60branch: () => { const [id, side] = String(v).split(":"); const e = E.chooseBranch(s, id, side); if (e) E.log(s, "⚠️ " + e); },
    r60special: () => { const e = E.adoptSpecial(s, s.members.find(x => x.id === s.activeId), v); if (e) E.log(s, "⚠️ " + e); },
    credismiss: () => { U.creDismiss = 1; },
    crequick: () => { const cm = U.create && U.create.master; U.create = null; coachCreated(cm); if (!s.created) E.applyMaster(s, cm || "orrin"); /* R84 */ if (!s.lbDone && !s.created) { s.lbDone = 1; const got = E.applyLegacyBonuses(s, legacyRec); if (got.length) E.log(s, `🌳 ${got.length} legacy bonus${got.length > 1 ? "es" : ""} carried over from your family's past.`); } }, // R60
    crerandom: () => { const nm = U.create && U.create.name, ms = U.create && U.create.master; U.create = Object.assign(E.randomCreation(legacyRec), { name: nm || "", master: ms || "orrin" }); },
    cre: () => creSet(v),
    crestart: () => {
      const c = U.create; if (!c) return;
      const nm = document.querySelector("#crename"); if (nm) c.name = nm.value;
      const err = E.applyCreation(s, c, legacyRec);
      if (err) return void (U.createErr = err);
      U.create = null; U.createErr = "";
      coachCreated(c.master);
      if (!s.lbDone) { s.lbDone = 1; const got = E.applyLegacyBonuses(s, legacyRec); if (got.length) E.log(s, `🌳 ${got.length} legacy bonus${got.length > 1 ? "es" : ""} carried over from your family's past.`); } // R60
      s.created = 1;
      E.log(s, `🛡️ ${(s.members.find(x => x.id === s.activeId) || s.members[0]).name} takes up the house colours.`);
    },
    legacyreset: () => { if (confirm("Reset the legacy unlocks on this device? Your saves are not touched.")) resetLegacy(), (U.saveMsg = "Legacy unlocks reset."); },
    slotimport: () => importIntoSlot(+v, document.querySelector("#slotcode") && document.querySelector("#slotcode").value),
    reset: () => {
      if (s.gameOver || confirm(`Abandon this lineage and start over in slot ${slot}?`)) {
        s = E.newLineage(s);
        U.screen = null; // R77: New Lineage can now be pressed from the ☰ Settings screen
        encReset(slot);
        report = null;
        openCreation(); // R59
      }
    },
  };
  coachNote(a); // R77: UI-only "firsts" for the Ledger
  if (coachAct(a, v)) void 0;
  else if (local[a]) local[a]();
  else runAction(a, { v, b, m });
  save();
  U.lastHTML = "";
  render();
});

document.addEventListener("change", e => {
  render.force = true;
  const el = e.target;
  const id = +el.dataset.v;
  const m = s.members.find(x => x.id === id);
  if (el.dataset.a === "reserve") {
    E.setReserve(s, el.dataset.v, el.value);
  }
  if (el.dataset.a === "importfile" && el.files && el.files[0]) {
    el.files[0].text().then(t => {
      importText(t);
      U.lastHTML = "";
      render();
    });
  }
  if (el.dataset.a === "chronf") U.chronF = el.value;
  if (el.dataset.a === "enchsel") (U.ench ||= {})[el.dataset.v] = el.value;
  if (el.dataset.a === "mosel") (U.moSel ||= {})[el.dataset.v] = el.value;
  if (el.dataset.a === "encpolicy") s.encPolicy = el.value;
  if (el.dataset.a === "recruitres") s.recruitReserve = Math.max(0, +el.value || 0);
  if (el.dataset.a === "refinemin") E.setRefine(s, el.dataset.v, { min: +el.value });
  if (el.dataset.a === "craftf") U.craftF[el.dataset.v] = el.value;
  if (el.dataset.a === "crafter") U.crafter = el.value;
  if (el.dataset.a === "speed") E.setSpeed(s, +el.value);
  if (el.dataset.a === "classicemoji" || el.dataset.a === "set_classic") setPref("classic", el.checked); // R58 -> R76 profile-wide
  if (el.dataset.a === "set_motion") setPref("motion", el.value);
  if (el.dataset.a === "set_skip") setPref("skipTitle", el.checked);
  if (el.dataset.a === "r60bonus") { (legacyRec.bonuses ||= {}).off = !el.checked; E.saveLegacyRec(localStorage, legacyRec); legacyRecStr = JSON.stringify(legacyRec); render(); } // R60 clean-run toggle
  if (el.dataset.a === "notecat") E.setNoteCat(s, el.dataset.v, el.checked);
  if (el.dataset.a === "fieldcrop") E.setCrop(s, el.dataset.v, el.value); // R40
  if (el.dataset.a === "devmode") {
    if (el.checked && !confirm("Enable Dev Mode? This run will be marked as a dev run and stop earning achievements."))
      el.checked = false;
    E.setDevMode(el.checked);
    if (el.checked && !E.devLocked()) localStorage.setItem(DEV_KEY, "1");
    else {
      localStorage.removeItem(DEV_KEY);
      if (!E.speedOptions(s).includes(s.speed)) s.speed = 1;
    }
  }
  if (el.dataset.a === "invf") {
    invF[el.dataset.v] = el.value;
  }
  if (el.dataset.a === "mequipsel" && el.value) {
    E.equipMinion(s, el.dataset.v, el.value);
  }
  if (el.dataset.a === "pickpiece" && el.value) {
    const st = el.value.startsWith("store:");
    E.placePiece(s, el.dataset.v, el.value.replace("store:", ""), st);
  }
  if (el.dataset.a === "setnode" && el.value) {
    E.setMinionNode(s, el.dataset.v, el.value);
  }
  if (el.dataset.a === "mjob") {
    E.assignMinion(s, el.dataset.v, el.value);
  }
  if (el.dataset.a === "pick") {
    E.switchTo(s, +el.value);
  }
  if (el.dataset.a === "order") {
    const t = el.value;
    E.setOrder(s, id, {
      type: t,
      target: t === "train" ? "swordsmanship" : t === "quest" ? "outskirts" : t === "gather" ? "scrub" : undefined,
    });
  }
  if (el.dataset.a === "qitem") U.qItem = el.value; // R34 quotas
  if (el.dataset.a === "oitem") U.oItem = el.value; // R43 orders
  if (el.dataset.a === "onum") U.oNum = +el.value;
  if (el.dataset.a === "qnum") U.qNum = +el.value;
  if (el.dataset.a === "qtarget") E.setQuotaTarget(s, el.dataset.v, el.value);
  if (el.dataset.a === "pslot") E.setPathSlot(s, E.findId(s.members, +el.dataset.w), el.dataset.v, el.value); // R46 crafter slots
  if (el.dataset.a === "fatrack") E.setTrack(s, +el.dataset.v, el.value || null);
  if (el.dataset.a === "fapref") E.setPref(s, +el.dataset.v, el.value || null);
  if (el.dataset.a === "ordt") {
    E.setOrder(s, id, { ...m.order, target: el.value });
  }
  save();
  U.lastHTML = "";
  render();
});

let last = performance.now(),
  saveT = 0;

function loop() {
  const now = performance.now();
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 5) dt = 5; // big gaps handled by offline calc
  if (!entered || U.screen) return void render(); // title / menu screens: the world waits (R76)
  playAcc += dt;
  if (!report) E.advanceReal(s, dt);
  choreNewsCheck(); // R42
  saveT += dt;
  if (saveT >= D.tuning.autosaveSec) {
    saveT = 0;
    save();
  }
  render();
}

setInterval(loop, 500);

document.addEventListener("visibilitychange", () => {
  if (document.hidden) save();
  else if (entered && !U.screen) {
    const r = E.applyOffline(s);
    if (r && r.elapsed > 60) report = r;
    last = performance.now();
  }
});

addEventListener("pagehide", save);

// Skip title (profile setting, off by default): open the game straight away, unless a slot had to be quarantined (the title explains)
if (prefs.skipTitle && !window.__noSave && (slot > 0 || legacyKeyMode) && !bootSkipped.length) enter(true);
render();

// map pan / zoom (pointer + wheel); rendering pauses while dragging
{
  let drag = null;
  const pts = new Map();
  const svgPt = (svg, e) => {
    const r = svg.getBoundingClientRect();
    return {
      x: U.mv.x + ((e.clientX - r.left) / r.width) * U.mv.w,
      y: U.mv.y + ((e.clientY - r.top) / r.height) * U.mv.h,
      r,
    };
  };
  document.addEventListener("pointerdown", e => {
    const svg = e.target.closest && e.target.closest("#worldmap");
    if (!svg) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    drag = { x: e.clientX, y: e.clientY, moved: 0, svg };
    window._mapDrag = true;
  });
  document.addEventListener("pointermove", e => {
    if (!drag || !pts.has(e.pointerId)) return;
    const r = drag.svg.getBoundingClientRect();
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      const d0 = Math.hypot(a.x - b.x, a.y - b.y);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [c, d] = [...pts.values()];
      const d1 = Math.hypot(c.x - d.x, c.y - d.y);
      if (d0 > 0) {
        const f = d0 / d1,
          cx = U.mv.x + U.mv.w / 2,
          cy = U.mv.y + U.mv.h / 2;
        U.mv.w = Math.min(D.map.size.w * 1.2, Math.max(180, U.mv.w * f));
        U.mv.h = (U.mv.w * D.map.size.h) / D.map.size.w;
        U.mv.x = cx - U.mv.w / 2;
        U.mv.y = cy - U.mv.h / 2;
      }
    } else {
      const dx = ((e.clientX - drag.x) / r.width) * U.mv.w,
        dy = ((e.clientY - drag.y) / r.height) * U.mv.h;
      U.mv.x -= dx;
      U.mv.y -= dy;
      drag.moved += Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y);
      drag.x = e.clientX;
      drag.y = e.clientY;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    drag.svg.setAttribute("viewBox", `${U.mv.x} ${U.mv.y} ${U.mv.w} ${U.mv.h}`);
    drag.svg.style.setProperty("--k", Math.max(0.45, Math.min(1.7, U.mv.w / 800))); // R31.1 counter-scale pins
  });
  const up = e => {
    pts.delete(e.pointerId);
    if (!pts.size) {
      if (drag && drag.moved > 8) window._mapSuppress = true;
      drag = null;
      window._mapDrag = false;
      U.lastHTML = "";
    }
  };
  document.addEventListener("pointerup", up);
  document.addEventListener("pointercancel", up);
  document.addEventListener(
    "wheel",
    e => {
      const svg = e.target.closest && e.target.closest("#worldmap");
      if (!svg) return;
      e.preventDefault();
      const p = svgPt(svg, e),
        f = e.deltaY > 0 ? 1.15 : 0.87;
      const nw = Math.min(D.map.size.w * 1.2, Math.max(180, U.mv.w * f));
      const k = nw / U.mv.w;
      U.mv.x = p.x - (p.x - U.mv.x) * k;
      U.mv.y = p.y - (p.y - U.mv.y) * k;
      U.mv.w = nw;
      U.mv.h = (nw * D.map.size.h) / D.map.size.w;
      svg.setAttribute("viewBox", `${U.mv.x} ${U.mv.y} ${U.mv.w} ${U.mv.h}`);
      svg.style.setProperty("--k", Math.max(0.45, Math.min(1.7, U.mv.w / 800)));
      U.lastHTML = "";
    },
    { passive: false },
  );
}

function exportSave() {
  const code = E.withLegacyRec(E.exportCode(s), legacyRec); // R59
  U.exportText = code;
  U.saveMsg = "Code shown below; a .txt file was downloaded too.";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([code], { type: "text/plain" }));
  a.download = `heirs-of-the-hold-Y${Math.floor(s.day / D.tuning.daysPerYear) + 1}.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function importText(text) {
  if (!text || !String(text).trim()) {
    U.saveMsg = "Paste a code or choose a file first.";
    return;
  }
  let next;
  const sp = E.splitLegacyRec(text); // R59
  if (sp.rec) { legacyRec = E.mergeLegacyRecs(legacyRec, sp.rec); E.setR60Rec(legacyRec); E.saveLegacyRec(localStorage, legacyRec); legacyRecStr = JSON.stringify(legacyRec); }
  text = sp.save;
  try {
    next = E.importSave(text);
  } catch (err) {
    U.saveMsg = "❌ " + err.message;
    return;
  }
  const who = (next.members.find(m => m.id === next.activeId) || next.members[0] || {}).name;
  if (
    !confirm(
      `Overwrite the current game with this save (${who}, year ${Math.floor(next.day / D.tuning.daysPerYear) + 1})?`,
    )
  )
    return;
  s = next;
  report = null;
  U.exportText = "";
  U.saveMsg = "✅ Save imported.";
  save();
}

// family tree: drag to pan (touch uses native scrolling)
{
  let d = null;
  document.addEventListener("pointerdown", e => {
    const w = e.target.closest("#treewrap");
    if (w && e.pointerType === "mouse")
      d = { w, x: e.clientX, y: e.clientY, l: w.scrollLeft, t: w.scrollTop, moved: false };
  });
  addEventListener("pointermove", e => {
    if (!d) return;
    const dx = e.clientX - d.x,
      dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    d.w.scrollLeft = d.l - dx;
    d.w.scrollTop = d.t - dy;
  });
  addEventListener("pointerup", () => {
    if (d && d.moved) window._treeDragged = true;
    d = null;
  });
}
