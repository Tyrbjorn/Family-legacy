// R44 Pause when done for people. A family member or follower set to "pause when done" finishes the task
// in hand (the item being crafted, the trip under way, or today's shift for daily work) and then rests until resumed.
import { log } from "./state.js";

const DAILY = ["activity", "job", "rest", "court", "work", "train", "chores"];
const who = (s, id) => (s.members || []).find(m => String(m.id) === String(id)) || (s.minions || []).find(mi => mi.uid === id);
export function setPauseWhenDone(s, id, on = true) {
  const p = who(s, id);
  if (!p) return false;
  if (on) { p.pwd = true; p.paused = false; } else delete p.pwd;
  return true;
}
export function resumePerson(s, id) {
  const p = who(s, id);
  if (!p) return false;
  p.paused = false;
  delete p.pwd;
  return true;
}
export const personPaused = p => !!(p && p.paused);
// snapshot before a member's day
export const memberSnap = m => ({ a: m.action, type: m.action && m.action.type, prog: (m.action && m.action.progress) || 0 });
export function memberPwdCheck(s, m, b, orderType) {
  if (!m.pwd) return false;
  const t = b.type || orderType;
  const done =
    m.action !== b.a ? !!b.a || DAILY.includes(t) :
    t === "craft" ? ((m.action && m.action.progress) || 0) < b.prog :
    DAILY.includes(t) || !t;
  if (!done) return false;
  delete m.pwd;
  m.paused = true;
  m.standing = null;
  m.action = { type: "rest", progress: 0 };
  log(s, `⏸️ ${m.name} paused when done (resting until you resume).`);
  return true;
}
export function followerPwdCheck(s, mi, prog0) {
  if (!mi.pwd) return false;
  if (mi.job === "craft" && (mi.prog || 0) >= prog0) return false; // still on the same item
  delete mi.pwd;
  mi.paused = true;
  log(s, `⏸️ ${mi.name} paused when done.`);
  return true;
}
