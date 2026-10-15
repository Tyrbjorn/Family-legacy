// Difficulty: A) game level (global, s.difficulty, 1..5) and B) personal challenge (family member, m.challenge).
// Level 3 = the base game. The game level is snapshotted on an action when it starts (a.diff) and that copy is
// used for the action's roll, loot, renown and XP, so switching mid-quest changes nothing. Numbers: tuning.difficulty.
import { T } from "./state.js";

const DF = () => T.difficulty;
const at = (arr, lvl) => arr[Math.min(5, Math.max(1, lvl || 3)) - 1];
export const gameLvl = s => s.difficulty || DF().default;
export const actLvl = (s, m) => (m && m.action && m.action.diff) || gameLvl(s);
export const chalLvl = m => (m && !m.minion && m.challenge) || DF().default;
export const gameFx = (s, k, lvl) => at(DF().game[k], lvl || gameLvl(s));
export const chalFx = (m, k) => (m && !m.minion ? at(DF().challenge[k], chalLvl(m)) : k === "roll" ? 0 : 1);
export const diffName = lvl => at(DF().game.names, lvl);
export const chalName = lvl => at(DF().challenge.names, lvl);
export const stampDiff = (s, a) => a && a.diff == null && (a.diff = gameLvl(s));
// hooks
export const enemyCp = (s, m, cp) => cp * gameFx(s, "enemy", actLvl(s, m));
export const diffRenown = (s, m) => Math.min(DF().renownCap, gameFx(s, "renown", actLvl(s, m)) * chalFx(m, "renown"));
export const diffXp = (s, m) => gameFx(s, "xp", actLvl(s, m)) * chalFx(m, "xp");
// actions
export function setDifficulty(s, lvl) {
  if (!(lvl >= 1 && lvl <= 5)) return false;
  s.difficulty = lvl;
  return true;
}
export const chalOpen = m => m && !m.minion && m.alive !== false && m.chUntil != null && m.ageDays < m.chUntil;
export function setChallenge(s, id, lvl) {
  const m = s.members.find(x => x.id === id);
  if (!chalOpen(m) || !(lvl >= 1 && lvl <= 5)) return false;
  m.challenge = lvl;
  return true;
}
