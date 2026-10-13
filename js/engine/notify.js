// In-game notifications (no push): log() lines are matched to categories by emoji prefix,
// batched when the same message repeats, capped, and filtered by per-category toggles (s.noteOff).
import { D } from "./state.js";

const CFG = () => D.notify || { cap: 40, categories: {} };
export const noteCats = () => CFG().categories;
let _evIcons = null;
const evIcons = () =>
  (_evIcons ??= new Set(((D.events && (D.events.types || D.events)) || []).map(e => e.icon).filter(Boolean)));

export function noteCategory(msg) {
  for (const [k, c] of Object.entries(noteCats())) if (c.prefixes.some(p => msg.startsWith(p))) return k;
  const first = [...msg][0];
  if (first && evIcons().has(first) && /\(\d+ days\)/.test(msg)) return "event";
  return null;
}

const keyOf = msg => msg.replace(/\d+/g, "#");

export function notify(s, cat, msg) {
  if (!cat || !noteCats()[cat]) return null;
  if (!s.notes) s.notes = [];
  if (!s.noteSeq) s.noteSeq = 0;
  const muted = !!(s.noteOff && s.noteOff[cat]);
  const k = keyOf(msg);
  const last = s.notes.find(n => n.c === cat && n.k === k && s.day - n.d <= 3);
  if (last) {
    last.n++;
    last.d = s.day;
    last.t = msg;
    last.id = ++s.noteSeq; // re-surface as new
    last.read = false;
    s.notes.splice(s.notes.indexOf(last), 1);
    s.notes.unshift(last);
  } else {
    s.notes.unshift({ id: ++s.noteSeq, c: cat, k, t: msg, d: s.day, n: 1, read: muted, m: muted });
    if (s.notes.length > CFG().cap) s.notes.length = CFG().cap;
  }
  return s.notes[0];
}

export const noteFromLog = (s, msg) => notify(s, noteCategory(msg), msg);
export const unreadNotes = s => (s.notes || []).filter(n => !n.read && !n.m && !(s.noteOff || {})[n.c]);
export function markNotesRead(s) {
  for (const n of s.notes || []) n.read = true;
}
export function setNoteCat(s, cat, on) {
  if (!s.noteOff) s.noteOff = {};
  if (on) delete s.noteOff[cat];
  else s.noteOff[cat] = true;
}
// Notes newer than seq, for toasts (batched entries re-surface with a fresh id).
export const notesSince = (s, seq) => (s.notes || []).filter(n => n.id > seq && !n.m && !(s.noteOff || {})[n.c]);
