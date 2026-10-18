// R38 save slots: 5 dynasties side by side. Pure functions over a Storage-like object (localStorage in the game, a Map
// shim in tests). Each slot holds a whole save, so Legacy renown is per slot. Keys:
//   familyLegacy.slots.v1  -> meta { last, slots: { "1": { name, note, played, card } }, migrated }
//   familyLegacy.slot.<n>  -> the save JSON
// The pre-R38 single save (familyLegacy.save.v1) is copied into slot 1 once and kept untouched as a backup.
import { serialize, deserialize } from "./save.js";
import { D, ageY, living } from "./state.js";
import { season } from "./seasons.js";
import { estateStage } from "./estate.js";
import { legacyState } from "./legacy.js";
import { generationOf } from "./tree.js";

export const SLOTS = 5;
export const OLD_KEY = "familyLegacy.save.v1";
export const META_KEY = "familyLegacy.slots.v1";
export const slotKey = n => "familyLegacy.slot." + n;
export const QUOTA = 5 * 1024 * 1024; // browsers allow ~5 MB per site (UTF-16: 2 bytes per char)
export const WARN = 0.8;

export function readMeta(st) {
  let m = null;
  try { m = JSON.parse(st.getItem(META_KEY) || "null"); } catch (e) { m = null; }
  if (!m || typeof m !== "object") m = { last: 1, slots: {} };
  m.slots = m.slots || {};
  return m;
}
const writeMeta = (st, m) => st.setItem(META_KEY, JSON.stringify(m));

// one-time copy of the old single save into slot 1 (never deletes the original; on failure keeps using the old key)
export function migrateSlots(st) {
  const m = readMeta(st);
  if (m.migrated) return { moved: false };
  const old = st.getItem(OLD_KEY);
  try {
    if (old && !st.getItem(slotKey(1))) {
      const s = deserialize(old);
      st.setItem(slotKey(1), old);
      m.slots["1"] = { name: defaultName(s), note: "", played: s.lastSave || Date.now(), card: slotCard(s) };
      m.last = 1;
    }
    m.migrated = true;
    writeMeta(st, m);
    return { moved: !!old };
  } catch (e) {
    return { moved: false, error: String(e.message || e), fallback: !!old };
  }
}

export const defaultName = s => `The ${((s.members || [])[0] || {}).name || "Unnamed"} line`;
// what a slot card shows (stored in meta so the picker never parses 5 big saves)
export function slotCard(s) {
  const head = (s.members || []).find(x => x.id === s.head && x.alive) || living(s)[0] || (s.members || [])[0] || {};
  let gen = 1;
  try { gen = Math.max(1, ...living(s).map(m => generationOf(s, m) + 1)); } catch (e) { gen = 1; }
  let se = "", stage = "";
  try { se = season(s).name || ""; } catch (e) {}
  try { stage = estateStage(s); } catch (e) {}
  return {
    head: head.name || "?", age: head.ageDays !== undefined ? ageY(head) : 0, gen,
    year: Math.floor((s.day || 0) / D.tuning.daysPerYear) + 1, season: se,
    renown: Math.round(s.renown || 0), legacy: Math.round((legacyState(s).renown) || 0),
    coin: Math.round((s.res || {}).coin || 0), stage, alive: living(s).length, over: !!s.gameOver,
  };
}

export function listSlots(st) {
  const m = readMeta(st);
  return Array.from({ length: SLOTS }, (_, i) => {
    const n = i + 1, info = m.slots[n], has = !!st.getItem(slotKey(n));
    return { n, empty: !has, name: info?.name || "", note: info?.note || "", played: info?.played || 0, card: info?.card || null, last: m.last === n };
  });
}
export const lastSlot = st => readMeta(st).last || 1;

// save: returns { ok, err }. A failed write (storage full) never touches the save already stored.
export function saveSlot(st, n, s, now = Date.now()) {
  const m = readMeta(st);
  let json;
  try { json = serialize(s, now); } catch (e) { return { ok: false, err: "could not prepare the save" }; }
  try {
    st.setItem(slotKey(n), json);
  } catch (e) {
    return { ok: false, err: "storage full" };
  }
  const prev = m.slots[n] || {};
  m.slots[n] = { name: prev.name || defaultName(s), note: prev.note || "", played: now, card: slotCard(s) };
  m.last = n;
  try { writeMeta(st, m); } catch (e) { return { ok: true, err: "meta not saved" }; }
  return { ok: true };
}
export function loadSlot(st, n) {
  const raw = st.getItem(slotKey(n));
  if (!raw) return null;
  const s = deserialize(raw);
  const m = readMeta(st);
  m.last = n;
  writeMeta(st, m);
  return s;
}
export function renameSlot(st, n, name, note) {
  const m = readMeta(st);
  if (!m.slots[n]) m.slots[n] = { name: "", note: "", played: 0, card: null };
  if (name !== undefined) m.slots[n].name = String(name).trim().slice(0, 40) || m.slots[n].name;
  if (note !== undefined) m.slots[n].note = String(note).trim().slice(0, 60);
  writeMeta(st, m);
  return m.slots[n];
}
// delete keeps an in-memory undo (until the page is closed)
export const undo = {};
export function deleteSlot(st, n) {
  const raw = st.getItem(slotKey(n));
  if (!raw) return false;
  const m = readMeta(st);
  undo[n] = { raw, info: m.slots[n] };
  st.removeItem(slotKey(n));
  delete m.slots[n];
  writeMeta(st, m);
  return true;
}
export function undoDelete(st, n) {
  const u = undo[n];
  if (!u || st.getItem(slotKey(n))) return false;
  try { st.setItem(slotKey(n), u.raw); } catch (e) { return false; }
  const m = readMeta(st);
  m.slots[n] = u.info;
  writeMeta(st, m);
  delete undo[n];
  return true;
}
// storage use across every key (chars x 2 bytes)
export function storageUsed(st) {
  let b = 0;
  for (let i = 0; i < st.length; i++) { const k = st.key(i); b += (k.length + (st.getItem(k) || "").length) * 2; }
  return { bytes: b, quota: QUOTA, frac: b / QUOTA, warn: b / QUOTA > WARN };
}
export const firstEmpty = st => listSlots(st).find(x => x.empty)?.n || null;
