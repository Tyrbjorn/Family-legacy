// R38 save slots: 5 dynasties side by side. Pure functions over a Storage-like object (localStorage in the game, a Map
// shim in tests). Each slot holds a whole save, so Legacy renown is per slot. Keys:
//   familyLegacy.slots.v1  -> meta { last, slots: { "1": { name, note, played, card } }, migrated }
//   familyLegacy.slot.<n>  -> the save JSON
// The pre-R38 single save (familyLegacy.save.v1) is copied into slot 1 once and kept untouched as a backup.
// R76: a slot that cannot be opened (bad JSON / wrong version) is quarantined, never overwritten: the raw text is also copied to
//   familyLegacy.slot.<n>.corrupt and the meta marks it bad. One rolling gzip backup per slot lives in familyLegacy.slot.<n>.bak
//   (the stored save as it was before a new session first overwrote it); backups are the first thing dropped when storage is short.
// None of this changes the save format (SAVE_VERSION / schema) or the storage keys of the saves themselves.
import { serialize, deserialize } from "./save.js";
import { D, SAVE_VERSION, ageY, living } from "./state.js";
import { season } from "./seasons.js";
import { estateStage } from "./estate.js";
import { legacyState } from "./legacy.js";
import { generationOf } from "./tree.js";

export const SLOTS = 5;
export const OLD_KEY = "familyLegacy.save.v1";
export const META_KEY = "familyLegacy.slots.v1";
export const slotKey = n => "familyLegacy.slot." + n;
export const bakKey = n => "familyLegacy.slot." + n + ".bak";
export const corruptKey = n => "familyLegacy.slot." + n + ".corrupt";
export const BACKUP_REFRESH_MS = 6 * 3600 * 1000; // a session that never closes still refreshes its backup this often
export const BACKUP_AFTER_MS = 10 * 60 * 1000; // back up the stored save before overwriting it when it is at least this old
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

// one-time copy of the old single save into slot 1 (never deletes the original; on a storage failure keeps using the old key).
// R76: an old save that cannot be read is kept in slot 1 as a quarantined slot (never replaced by a fresh game).
export function migrateSlots(st) {
  const m = readMeta(st);
  if (m.migrated) return { moved: false };
  const old = st.getItem(OLD_KEY);
  let s = null;
  try {
    if (old && !st.getItem(slotKey(1))) {
      let bad = null;
      try { s = deserialize(old); } catch (e) { bad = reasonOf(old); }
      st.setItem(slotKey(1), old);
      if (bad) m.slots["1"] = { name: "Old single save", note: "", played: 0, card: null, bad: { reason: bad, at: Date.now() } };
      else m.slots["1"] = { name: defaultName(s), note: "", played: s.lastSave || Date.now(), card: slotCard(s) };
      m.last = 1;
      if (bad) { try { st.setItem(corruptKey(1), old); } catch (e) { /* the slot itself still holds it */ } }
    }
    m.migrated = true;
    writeMeta(st, m);
    return { moved: !!old, bad: !!(m.slots["1"] && m.slots["1"].bad) };
  } catch (e) {
    return { moved: false, error: String(e.message || e), fallback: !!old };
  }
}

// why a stored string cannot be opened: "version" (valid JSON with another v) or "corrupt" (anything else)
export function reasonOf(raw) {
  try { const o = JSON.parse(raw); if (o && typeof o === "object" && !Array.isArray(o) && Array.isArray(o.members) && o.v !== undefined && o.v !== SAVE_VERSION) return "version"; } catch (e) { /* corrupt */ }
  return "corrupt";
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
    house: (s.house && s.house.name) || "", schema: s.schema || 0,
  };
}

export function listSlots(st) {
  const m = readMeta(st);
  return Array.from({ length: SLOTS }, (_, i) => {
    const n = i + 1, info = m.slots[n], raw = st.getItem(slotKey(n)), has = !!raw;
    return {
      n, empty: !has, name: info?.name || "", note: info?.note || "", played: info?.played || 0, card: info?.card || null, last: m.last === n,
      bad: has && info?.bad ? info.bad : null, sec: info?.sec || 0, build: info?.build || "", bak: !!st.getItem(bakKey(n)), bakAt: info?.bakAt || 0,
    };
  });
}
export const lastSlot = st => readMeta(st).last || 1;
export function setLast(st, n) { const m = readMeta(st); m.last = n; try { writeMeta(st, m); } catch (e) { /* ignore */ } }

// What is in a slot, without changing anything: { state: "empty" | "ok" | "bad", raw, s?, reason? }
export function peek(st, n) {
  const raw = st.getItem(slotKey(n));
  if (!raw) return { state: "empty", raw: null };
  try { return { state: "ok", raw, s: deserialize(raw) }; } catch (e) { return { state: "bad", raw, reason: reasonOf(raw) }; }
}
// Flag a slot as unreadable and keep a second copy of its text. Never changes the slot's own key.
export function quarantine(st, n, reason, raw) {
  raw = raw ?? st.getItem(slotKey(n));
  if (raw && st.getItem(corruptKey(n)) !== raw) { try { st.setItem(corruptKey(n), raw); } catch (e) { /* storage short: the slot still has it */ } }
  const m = readMeta(st);
  const prev = m.slots[n] || { name: "", note: "", played: 0, card: null };
  if (!(prev.bad && prev.bad.reason === reason)) { m.slots[n] = { ...prev, bad: { reason, at: Date.now() } }; try { writeMeta(st, m); } catch (e) { /* ignore */ } }
}

// Boot-time sweep: flag every unreadable slot (not just the last played one) so the Load screen warns before anyone presses Load.
// Reads only; quarantine copies the text aside and marks the slot, it never rewrites the slot itself. Returns the slots newly flagged.
export function scanAll(st) {
  const hit = [];
  for (let n = 1; n <= SLOTS; n++) {
    const pk = peek(st, n);
    if (pk.state === "bad") { const info = readMeta(st).slots[n]; if (!(info && info.bad && info.bad.reason === pk.reason)) { quarantine(st, n, pk.reason, pk.raw); hit.push({ n, reason: pk.reason }); } }
  }
  return hit;
}

// read a slot without touching the "last played" marker; null when empty or unreadable (unreadable ones get quarantined)
export function readSlot(st, n) {
  const p = peek(st, n);
  if (p.state === "bad") quarantine(st, n, p.reason, p.raw);
  return p.state === "ok" ? p.s : null;
}

// save: returns { ok, err, prev, droppedBackups }. A failed write (storage full) never touches the save already stored.
//   prev = the previously stored text when it is worth backing up (healthy and at least BACKUP_AFTER_MS old); the caller backs it up with makeBackup().
//   opts: { force } overwrite a quarantined slot (restore / import / new game after the player chose to); { build }; { addSec } play seconds since the last save.
export function saveSlot(st, n, s, now = Date.now(), opts = {}) {
  const m = readMeta(st);
  if (m.slots[n] && m.slots[n].bad && !opts.force) return { ok: false, err: "slot could not be opened; it is kept untouched" };
  let json;
  try { json = serialize(s, now); } catch (e) { return { ok: false, err: "could not prepare the save" }; }
  const before = st.getItem(slotKey(n));
  let dropped = false;
  try {
    st.setItem(slotKey(n), json);
  } catch (e) {
    // storage short: backups go first, then one retry
    if (dropBackups(st).length) {
      try { st.setItem(slotKey(n), json); dropped = true; } catch (e2) { return { ok: false, err: "storage full", droppedBackups: true }; }
    } else return { ok: false, err: "storage full" };
  }
  const prevInfo = m.slots[n] || {};
  let prev = null;
  if (before && before !== json && !dropped && (now - (prevInfo.played || 0) >= BACKUP_AFTER_MS || (prevInfo.bakAt && now - prevInfo.bakAt >= BACKUP_REFRESH_MS)) && peek(st, n).state !== "bad") prev = before;
  const { bad, ...keep } = prevInfo; void bad;
  m.slots[n] = { ...keep, name: prevInfo.name || defaultName(s), note: prevInfo.note || "", played: now, card: slotCard(s), build: opts.build || prevInfo.build || "", sec: Math.round((prevInfo.sec || 0) + (opts.addSec || 0)) };
  m.last = n;
  const out = { ok: true, prev, droppedBackups: dropped };
  if (dropped) { for (const k in m.slots) delete m.slots[k].bakAt; }
  try { writeMeta(st, m); } catch (e) { out.err = "meta not saved"; }
  return out;
}
// open a slot. Throws when it cannot be read (and quarantines it first, so nothing is lost).
export function loadSlot(st, n) {
  const p = peek(st, n);
  if (p.state === "empty") return null;
  if (p.state === "bad") { quarantine(st, n, p.reason, p.raw); const e = new Error(p.reason === "version" ? "bad save version" : "corrupt save"); e.slotBad = p.reason; throw e; }
  const m = readMeta(st);
  m.last = n;
  writeMeta(st, m);
  return p.s;
}
// Which slot to open at launch. Tries the last played slot first; an unreadable one is quarantined (never overwritten) and the
// most recently played readable slot is offered instead. Returns { n, s, skipped: [{ n, reason }] } (n/s null when nothing opens).
export function bootPick(st) {
  const L = listSlots(st), last = lastSlot(st), skipped = [];
  const order = [last, ...L.filter(x => !x.empty && x.n !== last).sort((a, b) => b.played - a.played).map(x => x.n)].filter(n => n >= 1 && n <= SLOTS);
  for (const n of order) {
    const p = peek(st, n);
    if (p.state === "empty") continue;
    if (p.state === "bad") { quarantine(st, n, p.reason, p.raw); skipped.push({ n, reason: p.reason }); continue; }
    const m = readMeta(st); m.last = n; try { writeMeta(st, m); } catch (e) { /* ignore */ }
    return { n, s: p.s, skipped };
  }
  return { n: null, s: null, skipped };
}
export function renameSlot(st, n, name, note) {
  const m = readMeta(st);
  if (!m.slots[n]) m.slots[n] = { name: "", note: "", played: 0, card: null };
  if (name !== undefined) m.slots[n].name = String(name).trim().slice(0, 40) || m.slots[n].name;
  if (note !== undefined) m.slots[n].note = String(note).trim().slice(0, 60);
  writeMeta(st, m);
  return m.slots[n];
}
// delete keeps an in-memory undo (until the page is closed); the slot's backup and quarantine copy go with it
export const undo = {};
export function deleteSlot(st, n) {
  const raw = st.getItem(slotKey(n));
  if (!raw) return false;
  const m = readMeta(st);
  undo[n] = { raw, info: m.slots[n], bak: st.getItem(bakKey(n)), corrupt: st.getItem(corruptKey(n)) };
  st.removeItem(slotKey(n)); st.removeItem(bakKey(n)); st.removeItem(corruptKey(n));
  delete m.slots[n];
  writeMeta(st, m);
  return true;
}
export function undoDelete(st, n) {
  const u = undo[n];
  if (!u || st.getItem(slotKey(n))) return false;
  try { st.setItem(slotKey(n), u.raw); } catch (e) { return false; }
  try { if (u.bak) st.setItem(bakKey(n), u.bak); if (u.corrupt) st.setItem(corruptKey(n), u.corrupt); } catch (e) { /* the save itself is back */ }
  const m = readMeta(st);
  m.slots[n] = u.info;
  writeMeta(st, m);
  delete undo[n];
  return true;
}

// ---- rolling gzip backup (one per slot). CompressionStream is async, so these return promises.
const toB64 = u8 => { let b = ""; for (let i = 0; i < u8.length; i += 8192) b += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(b); };
const fromB64 = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
async function pipe(u8, stream) { return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(stream)).arrayBuffer()); }
export const gzipSupported = () => typeof CompressionStream === "function" && typeof DecompressionStream === "function" && typeof btoa === "function";
export async function gzipText(text) { return toB64(await pipe(new TextEncoder().encode(text), new CompressionStream("gzip"))); }
export async function gunzipText(b64) { return new TextDecoder().decode(await pipe(fromB64(b64), new DecompressionStream("gzip"))); }
// store `raw` (a readable save) as slot n's backup, replacing the previous one. Returns { ok, bytes? , err? }.
export async function makeBackup(st, n, raw, now = Date.now()) {
  if (!raw || !gzipSupported()) return { ok: false, err: "no gzip" };
  try { deserialize(raw); } catch (e) { return { ok: false, err: "not a readable save" }; }
  let z;
  try { z = await gzipText(raw); } catch (e) { return { ok: false, err: "gzip failed" }; }
  try { st.setItem(bakKey(n), z); } catch (e) { return { ok: false, err: "storage full" }; } // never evicts a save to make room
  const m = readMeta(st);
  if (m.slots[n]) { m.slots[n].bakAt = now; try { writeMeta(st, m); } catch (e) { /* ignore */ } }
  return { ok: true, bytes: z.length };
}
// read the backup back as a save text ("" when none / unreadable)
export async function readBackup(st, n) {
  const z = st.getItem(bakKey(n));
  if (!z || !gzipSupported()) return "";
  try { const raw = await gunzipText(z); deserialize(raw); return raw; } catch (e) { return ""; }
}
// put the backup back into the slot. The text that was there is kept as the slot's quarantine copy. Returns { ok, err }.
export async function restoreBackup(st, n) {
  const raw = await readBackup(st, n);
  if (!raw) return { ok: false, err: "no usable backup" };
  const cur = st.getItem(slotKey(n));
  if (cur && cur !== raw) { try { st.setItem(corruptKey(n), cur); } catch (e) { /* ignore */ } }
  try { st.setItem(slotKey(n), raw); } catch (e) { return { ok: false, err: "storage full" }; }
  const s = deserialize(raw), m = readMeta(st), prev = m.slots[n] || {};
  const { bad, ...keep } = prev; void bad;
  m.slots[n] = { ...keep, name: prev.name || defaultName(s), note: prev.note || "", played: s.lastSave || Date.now(), card: slotCard(s) };
  m.last = n;
  writeMeta(st, m);
  return { ok: true };
}
// drop every backup (first thing to go when storage is short). Returns the slot numbers that lost one.
export function dropBackups(st) {
  const gone = [];
  for (let n = 1; n <= SLOTS; n++) if (st.getItem(bakKey(n)) != null) { st.removeItem(bakKey(n)); gone.push(n); }
  return gone;
}
// storage use across every key (chars x 2 bytes); bak = the part taken by backups
export function storageUsed(st) {
  let b = 0, bak = 0;
  for (let i = 0; i < st.length; i++) { const k = st.key(i), v = (k.length + (st.getItem(k) || "").length) * 2; b += v; if (/\.bak$/.test(k)) bak += v; }
  return { bytes: b, quota: QUOTA, frac: b / QUOTA, warn: b / QUOTA > WARN, bak };
}
export const firstEmpty = st => listSlots(st).find(x => x.empty)?.n || null;
// a slot's quarantined slot can be started over / replaced by the player (explicit action): clears the bad mark
export function clearBadMark(st, n) {
  const m = readMeta(st);
  if (m.slots[n] && m.slots[n].bad) { delete m.slots[n].bad; writeMeta(st, m); }
}
