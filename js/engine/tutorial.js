// Apprentice prologue (rewarded, skippable tutorial) + tab-tour state. Progress lives in s.tut.
import { chron } from "./chronicle.js";
import { addToVault, craftItem, equip, recipeDef } from "./inventory.js";
import { D, active, living, log } from "./state.js";

const TD = () => D.tutorial || { steps: [], tour: [] };
export const tutSteps = () => TD().steps;
export const tutMentor = () => TD().mentor || { name: "Mentor", icon: "🧔" };

export function tutState(s) {
  if (!s.tut) s.tut = { step: 0, done: [], skipped: false, flags: {}, tourSeen: false, started: false };
  if (!s.tut.flags) s.tut.flags = {};
  return s.tut;
}
export const tutActive = s => {
  const t = tutState(s);
  return !t.skipped && t.step < tutSteps().length;
};
export const tutCurrent = s => (tutActive(s) ? tutSteps()[tutState(s).step] : null);
export const tutComplete = s => tutState(s).step >= tutSteps().length && !tutState(s).skipped;

function grant(s, g) {
  if (!g) return [];
  const out = [];
  for (const [k, v] of Object.entries(g)) {
    if (k === "items") for (const id of v) addToVault(s, id) && out.push(id);
    else if (k === "unlock") !s.unlocks.includes(v) && s.unlocks.push(v) && out.push(v);
    else ((s.res[k] = (s.res[k] || 0) + v), out.push(`+${v} ${k}`));
  }
  return out;
}

// Called when a new game starts (and lazily for older saves that never saw the prologue).
export function startTutorial(s) {
  const t = tutState(s);
  if (t.started) return;
  t.started = true;
  giveStartGear(s);
  chron(s, "story", `🎓 ${active(s)?.name || "The founder"} began an apprenticeship under ${tutMentor().name}.`);
  beginStep(s);
}
// R30: Orrin's blade, granted and equipped on the founder at the start (no tutorial step needed)
export function giveStartGear(s) {
  const m = active(s);
  for (const id of (TD().start || {}).equip || []) {
    const it = D.items.find(x => x.id === id);
    if (!m || !it || (m.equip && m.equip[it.slot])) continue;
    if (addToVault(s, id)) equip(s, m, id);
  }
  // R31: starter tools (Orrin's hatchet) go to the vault, not equipped
  for (const id of (TD().start || {}).items || []) if (!(s.vault || []).includes(id)) addToVault(s, id);
}
function beginStep(s) {
  const st = tutCurrent(s);
  if (st) grant(s, st.start);
}

// Events the UI/engine report that aren't visible in state (tab visits, crafting, activity days).
export function tutNote(s, flag) {
  if (!s.tut) return;
  s.tut.flags[flag] = true;
  tutCheck(s);
}

const CHECKS = {
  equipped: s => living(s).some(m => Object.values(m.equip || {}).some(Boolean)),
  crafted: s => !!s.tut.flags.crafted,
  activity: s => !!s.tut.flags.activity,
  fed: s => (s.tut.flags.t_fishing || 0) + (s.tut.flags.t_forage || 0) >= 2 || (s.tut.flags.fed || 0) >= 3,
  chopped: s => (s.tut.flags.t_chop || 0) >= 2,
  hunted: s => (s.tut.flags.t_hunt || 0) >= 1,
  cooked: s => (s.tut.flags.t_cook || 0) >= 1,
  estate: s => !!s.tut.flags.estate || (s.land || []).length > 0,
  scouted: s => !!s.tut.flags.scouted || (s.explored || []).length > 0 || (s.tut.flags.t_roam || 0) >= 1,
  traded: s => !!s.tut.flags.traded,
  path: s => living(s).some(m => m.cls || m.guild || m.craft || m.prof),
};
export function stepDone(s, st) {
  // a quest step also counts once the family has outgrown it (3+ other quests done or an estate founded),
  // or if the quest no longer exists, so older saves never get stuck on it
  if (st.check.startsWith("quest:")) {
    const id = st.check.slice(6);
    return s.doneQuests.includes(id) || !D.quests.some(q => q.id === id) || s.doneQuests.length >= 3 || (s.land || []).length > 0;
  }
  return !!(CHECKS[st.check] && CHECKS[st.check](s));
}

export function tutCheck(s) {
  let n = 0;
  while (tutActive(s) && s.tut.started) {
    const st = tutCurrent(s);
    if (!stepDone(s, st)) break;
    const got = grant(s, st.reward);
    s.tut.done.push(st.id);
    s.tut.step++;
    n++;
    log(s, `📘 Apprentice task done: ${st.title} (${got.join(", ")})`);
    if (tutActive(s)) beginStep(s);
    else chron(s, "story", `🎓 ${TD().finale || "The apprenticeship is over."}`);
  }
  return n;
}

// The mentor's bench: lets a landless apprentice make the tutorial craft.
export function mentorCraft(s) {
  const rc = recipeDef("r_whittle");
  const id = rc && craftItem(s, active(s), rc);
  if (id) tutNote(s, "crafted");
  return id;
}

export function skipTutorial(s) {
  const t = tutState(s);
  if (!tutActive(s)) return false;
  t.skipped = true;
  if (!s.unlocks.includes("recipe:r_whittle")) s.unlocks.push("recipe:r_whittle");
  chron(s, "story", `🎓 ${active(s)?.name || "The founder"} left the apprenticeship early.`);
  return true;
}

// Dev helper: grant every remaining step's rewards in order.
export function completeTutorial(s) {
  const t = tutState(s);
  if (!t.started) startTutorial(s);
  t.skipped = false;
  while (t.step < tutSteps().length) {
    const st = tutSteps()[t.step];
    grant(s, st.reward);
    t.done.push(st.id);
    t.step++;
  }
  chron(s, "story", `🎓 ${TD().finale || "The apprenticeship is over."}`);
}

export const tourSteps = () => TD().tour || [];
export const markTourSeen = s => (tutState(s).tourSeen = true);
