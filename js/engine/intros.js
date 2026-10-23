import { resName } from "./resname.js";
import { findId } from "./lookup.js";
// Unlock intros (data/intros.json): when a system first opens (Crafting, Food, Minions, Guilds, Houses, Dynasty…)
// a 1-3 step "do it" quest line starts with small rewards. Lines never block play and are skippable.
// Also announces phase changes once (data/phases.json). State: s.intros = { lines: {id: {step, state}}, flags }.
import { chron } from "./chronicle.js";
import { craftingUnlocked } from "./crafting.js";
import { enchanters, stationFx } from "./gear.js";
import { era } from "./family.js";
import { houseList, tierOf } from "./houses.js";
import { tutActive } from "./tutorial.js";
import { D, isAdult, living, log } from "./state.js";

const IL = () => (D.intros && D.intros.lines) || [];
export const introDef = id => IL().find(l => l.id === id);
export function introState(s) {
  if (!s.intros) s.intros = { lines: {}, flags: {} };
  return s.intros;
}
const ls = (s, id) => introState(s).lines[id];

// named predicates used by `when` and step checks (view:<tab> and flag:<x> are generic)
const PRED = {
  craft: s => craftingUnlocked(s),
  land: s => (s.land || []).length > 0,
  adultFree: s => living(s).some(isAdult),
  suitor: s => (s.suitors || []).length > 0,
  phase2: s => era(s).n >= 2,
  phase3: s => era(s).n >= 3,
  minion: s => (s.minions || []).length > 0,
  enchantReady: s => enchanters(s).length > 0 && (s.land || []).length > 0,
  enchStation: s => stationFx(s).jobs > 0,
  guild: s => living(s).some(m => m.guild),
  crafterGuild: s => living(s).some(m => m.craft),
  pathOpen: s => living(s).some(m => (m.paths || []).length > 0),
  pathRank: s => living(s).some(m => (m.paths || []).some(e => e.rank >= 1)),
  courted: s => (s.suitors || []).some(x => x.affinity > 0) || living(s).some(m => m.spouse),
  friendly: s => houseList().some(h => ["friendly", "allied"].includes(tierOf(s, h.id))),
  houseQuest: s => (s.doneQuests || []).some(id => (findId(D.quests, id) || {}).house),
};
export const INTRO_PREDS = Object.keys(PRED);
export function introTest(s, c) {
  const f = introState(s).flags;
  if (c.startsWith("view:") || c.startsWith("flag:")) return !!f[c];
  return !!(PRED[c] && PRED[c](s));
}
export const introsActive = s => IL().filter(l => ls(s, l.id)?.state === "active");
export const introCurrent = (s, id) => introDef(id).steps[ls(s, id).step];

function reward(s, r) {
  const got = [];
  for (const [k, v] of Object.entries(r || {})) {
    if (k === "renown") s.renown = (s.renown || 0) + v;
    else s.res[k] = (s.res[k] || 0) + v;
    got.push(`+${v} ${resName(k)}`);
  }
  return got.join(", ");
}
export function introCheck(s) {
  let n = 0;
  for (const l of introsActive(s)) {
    const st = ls(s, l.id);
    while (st.state === "active") {
      const step = l.steps[st.step];
      if (!introTest(s, step.check)) break;
      log(s, `📘 ${l.name}: ${step.title} (${reward(s, step.reward)})`);
      st.step++;
      n++;
      if (st.step >= l.steps.length) {
        st.state = "done";
        if (l.finale) chron(s, "story", `${l.icon} ${l.finale}`);
      }
    }
  }
  return n;
}
// UI/engine events that are not visible in state
export function introNote(s, flag) {
  introState(s).flags["flag:" + flag] = true;
  return introCheck(s);
}
export function introView(s, tab) {
  introState(s).flags["view:" + tab] = true;
  return introCheck(s);
}
export function introSkip(s, id) {
  const st = ls(s, id);
  if (!st || st.state !== "active") return false;
  st.state = "skipped";
  return true;
}
function introStart(s, l) {
  introState(s).lines[l.id] = { step: 0, state: "active", since: s.day };
  log(s, `📘 New: ${l.icon} ${l.name}. ${l.intro} (${l.steps.length} quick step${l.steps.length > 1 ? "s" : ""}, skippable)`);
}
// Old saves: anything already unlocked is marked done quietly so loading never floods the log.
export function introsMigrate(s) {
  for (const l of IL()) if (!ls(s, l.id) && introTest(s, l.when)) introState(s).lines[l.id] = { step: 0, state: "done", quiet: true };
}

export function introsDay(s) {
  const n = era(s).n;
  if (s.phaseSeen == null) s.phaseSeen = n;
  if (n > s.phaseSeen) {
    s.phaseSeen = n;
    chron(s, "story", `${era(s).icon} The family enters a new phase: ${era(s).name}. ${era(s).desc}`);
  }
  if (tutActive(s)) return; // the apprentice prologue comes first
  for (const l of introsActive(s)) {
    const st = ls(s, l.id);
    if (s.day - (st.since ?? s.day) > (D.intros.expireDays || 90)) Object.assign(st, { state: "skipped", expired: true });
  }
  introCheck(s);
  // one line at a time (data order = priority) so unlocks never pile up on screen
  if (!introsActive(s).length) {
    const l = IL().find(l => !ls(s, l.id) && introTest(s, l.when));
    if (l) introStart(s, l), introCheck(s);
  }
}
