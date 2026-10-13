// Chronicle: persistent, compacted family history of major events.
import { D } from "./state.js";

const CFG = () => D.chronicle || { cap: 300, minor: [], fromLog: [], cats: {} };

function whoIn(s, msg) {
  const m = (s.members || []).find(x => msg.includes(x.name + " ") || msg.includes(x.name + "'"));
  return m ? m.name : "";
}

export function chron(s, cat, text, who = "") {
  if (!s.chronicle) s.chronicle = [];
  s.chronicle.push({ d: s.day, c: cat, t: text, w: who });
  compact(s);
}

// Keep saves small: drop the oldest minor entries first, then the oldest of any kind.
export function compact(s) {
  const cap = CFG().cap;
  while (s.chronicle.length > cap) {
    const i = s.chronicle.findIndex(e => CFG().minor.includes(e.c));
    s.chronicle.splice(i >= 0 && i < s.chronicle.length - 20 ? i : 0, 1);
  }
}

export function categorize(msg) {
  if (msg.startsWith("🏅 Achievement")) return "achievement";
  if (msg.startsWith("🧭") && msg.includes(" explored ")) return null;
  if (msg.startsWith("🔨") && msg.includes("Masterwork")) return "craft";
  if (/ joined the .*(Guild|Vanguard|Lodge|Collegium|Church|Rogues|Hearth)/i.test(msg)) return "guild";
  for (const [prefix, cat] of CFG().fromLog) if (msg.startsWith(prefix)) return cat;
  return null;
}

export function chronFromLog(s, msg) {
  const c = categorize(msg);
  if (c) chron(s, c, msg, whoIn(s, msg));
}

export const chronicleYear = d => Math.floor(d / D.tuning.daysPerYear) + 1;

export function chronicleView(s, cat = "all") {
  return (s.chronicle || [])
    .filter(e => cat === "all" || e.c === cat)
    .slice()
    .reverse();
}
