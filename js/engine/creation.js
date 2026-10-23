// R59: character creation, looks (doll appearance) and the per-device legacy record (fl-r59-character-creation-proposal.md).
// Pure functions: no rng is used anywhere here, so Quick start and the sim are unchanged. Looks for members without one
// are derived from the member id (and a parent's colours for children).
import { D, T, ageY, isAdult } from "./state.js";
const traitDef = id => (D.traits || []).find(t => t.id === id);

export const CR_KEY = "fl_legacy_v1";
const CRD = () => D.creation || { skins: [], hairCols: [], houseCols: [], hairStyles: { m: [], f: [] }, unlocks: [], openTraits: [] };
// small integer hash (no rng)
export function lookHash(n, salt = 0) {
  let h = (Math.imul((n | 0) + 0x9e37 + salt * 0x85eb, 0x27d4eb2d) ^ 0x165667b1) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return (h ^ (h >>> 13)) >>> 0;
}
export const houseColOf = s => {
  const H = CRD().houseCols, c = s && s.house && s.house.col;
  return typeof c === "string" ? c : c === 22 || c == null ? (H[0] || {}).col || "#194261" : (H[c] || H[0] || {}).col;
};
// a member's look; old saves / children get a deterministic one (seeded by id, colours from one parent)
export function seededLook(m, parentLooks = []) {
  const C = CRD(), id = m.id || 0, sty = C.hairStyles[m.gender === "f" ? "f" : "m"] || [];
  const p = parentLooks.filter(Boolean), src = p.length ? p[lookHash(id, 7) % p.length] : null;
  const L = {
    hair: (sty[lookHash(id, 1) % Math.max(1, sty.length)] || [""])[0],
    hairCol: src ? src.hairCol : lookHash(id, 2) % Math.max(1, C.hairCols.length),
    skin: src ? src.skin : lookHash(id, 3) % Math.max(1, C.skins.length),
  };
  if (m.gender === "f") L.bun = lookHash(id, 4) % 4 === 0;
  if (m.race === "dwarf" && m.gender !== "f") L.beard = ["forked", "ringed-plait", "forked"][lookHash(id, 5) % 3];
  return L;
}
export function lookOf(s, m) {
  if (m.look) return m.look;
  const par = (m.parents || []).map(pid => (s.members || []).find(x => x.id === pid)).filter(Boolean);
  return (m.look = seededLook(m, par.map(p => lookOf(s, p))));
}
export const ageBand = m => (!isAdult(m) ? "child" : ageY(m) >= (CRD().elderAge || 55) ? "elder" : "adult");
export const dollBase = m => `${m.race === "dwarf" ? "dwarf" : "human"}-${m.gender === "f" ? "female" : "male"}${{ adult: "", elder: "-elder", child: "-child" }[ageBand(m)]}`;
const ARMOR_TYPE = { clothes: "clothes", robe: "clothes", cloth: "clothes", leather: "leather", hide: "leather", chain: "chain", scale: "chain", mail: "chain", plate: "plate-helm" };
export const dollArmor = it => (it ? ARMOR_TYPE[it.type] || (/plate/.test(it.id) ? "plate-helm" : /chain|mail/.test(it.id) ? "chain" : /leather/.test(it.id) ? "leather" : "clothes") : null);

// ---- legacy record (per device, outside the saves) ----
export const emptyLegacyRec = () => ({ v: 1, ach: {}, flags: {}, unlocks: [], bonuses: {}, classUnlocks: {} });
export function normLegacyRec(r) {
  const o = Object.assign(emptyLegacyRec(), r && typeof r === "object" ? r : {});
  for (const k of ["ach", "flags", "bonuses", "classUnlocks"]) if (!o[k] || typeof o[k] !== "object" || Array.isArray(o[k])) o[k] = {};
  if (!Array.isArray(o.unlocks)) o.unlocks = [];
  return o;
}
// what one save has earned (achievement ids -> day, story flags)
export function saveMilestones(s) {
  const f = {};
  if (((s && s.flags) || {}).thaneOath != null) f.thaneOath = 1;
  const ms = (s && s.members) || [];
  if (ms.some(m => m.parents && (m.parents.length || 0) && ((m.traits || []).includes("dwarfblood") || m.race === "dwarf"))) f.dwarfBorn = 1;
  if (ms.some(m => (m.traits || []).includes("seatouched"))) f.seaHeir = 1;
  const hr = s && s.hydra && s.hydra.result;
  if (hr) f["hydra_" + hr] = 1;
  return { ach: Object.assign({}, (s && s.ach) || {}), flags: f };
}
export function unlockMet(u, rec) {
  if (u.flag) return !!rec.flags[u.flag];
  if (u.check) return !!rec.flags[u.check];
  if (u.hydra) return !!rec.flags["hydra_" + u.hydra];
  if (u.ach) return rec.ach[u.ach] != null;
  if (u.achCount) return Object.keys(rec.ach).length >= u.achCount;
  return false;
}
// merge a save's milestones into the record; returns the ids newly unlocked
export function recordSave(rec, s) {
  rec = normLegacyRec(rec);
  const m = saveMilestones(s);
  for (const [k, d] of Object.entries(m.ach)) if (rec.ach[k] == null) rec.ach[k] = d;
  Object.assign(rec.flags, m.flags);
  const fresh = [];
  for (const u of CRD().unlocks) if (!rec.unlocks.includes(u.id) && unlockMet(u, rec)) rec.unlocks.push(u.id), fresh.push(u.id);
  return { rec, fresh };
}
export function loadLegacyRec(store) {
  try { return normLegacyRec(JSON.parse(store.getItem(CR_KEY) || "null")); } catch (e) { return emptyLegacyRec(); }
}
export function saveLegacyRec(store, rec) {
  try { store.setItem(CR_KEY, JSON.stringify(normLegacyRec(rec))); return true; } catch (e) { return false; }
}
export const resetLegacyRec = store => { try { store.removeItem(CR_KEY); } catch (e) {} return emptyLegacyRec(); };
// the record rides along with a save export after a "~LEG:" marker; import strips it off again
const b64e = t => (typeof btoa === "function" ? btoa(unescape(encodeURIComponent(t))) : Buffer.from(t, "utf8").toString("base64"));
const b64d = t => (typeof atob === "function" ? decodeURIComponent(escape(atob(t))) : Buffer.from(t, "base64").toString("utf8"));
export const withLegacyRec = (code, rec) => code + "~LEG:" + b64e(JSON.stringify(normLegacyRec(rec)));
export function splitLegacyRec(text) {
  const t = String(text || "").trim(), i = t.indexOf("~LEG:");
  if (i < 0) return { save: t, rec: null };
  let rec = null;
  try { rec = normLegacyRec(JSON.parse(b64d(t.slice(i + 5).trim()))); } catch (e) {}
  return { save: t.slice(0, i).trim(), rec };
}
export function mergeLegacyRecs(a, b) {
  a = normLegacyRec(a); b = normLegacyRec(b);
  for (const [k, d] of Object.entries(b.ach)) if (a.ach[k] == null) a.ach[k] = d;
  Object.assign(a.flags, b.flags);
  for (const u of b.unlocks) if (!a.unlocks.includes(u)) a.unlocks.push(u);
  for (const k of ["bonuses", "classUnlocks"]) for (const [x, v] of Object.entries(b[k])) if (a[k][x] == null) a[k][x] = v;
  return a;
}

// ---- creation options ----
export const hasUnlock = (rec, id) => normLegacyRec(rec).unlocks.includes(id);
export function creationOptions(rec) {
  const C = CRD(), r = normLegacyRec(rec), have = id => !id || r.unlocks.includes(id);
  const howOf = id => (C.unlocks.find(u => u.id === id) || {}).how || "";
  const traitLock = {};
  for (const u of C.unlocks) for (const t of u.traits || []) traitLock[t] = u.id;
  const traits = [...C.openTraits, ...Object.keys(traitLock).filter(t => !C.openTraits.includes(t))].filter(t => traitDef(t)).map(t => ({ id: t, ok: !traitLock[t] || have(traitLock[t]) || C.openTraits.includes(t), how: howOf(traitLock[t]), bad: (traitDef(t) || {}).rarity === "bad" }));
  const frames = [["open", true]].concat(C.unlocks.filter(u => u.frame).map(u => [u.frame, have(u.id)]));
  return {
    races: C.races.map(([id, name, u]) => ({ id, name, ok: have(u), how: howOf(u) })),
    sexes: [{ id: "m", name: "Male", ok: true }, { id: "f", name: "Female", ok: true }],
    bloodlines: C.bloodlines.map(([id, name, u]) => ({ id, name, ok: have(u), how: howOf(u) })),
    traits,
    classes: ((D.classes || []).filter(c => c.tier === 0)).map(c => ({ id: c.id, name: c.name, icon: c.icon, ok: have("class_pick"), how: howOf("class_pick") })),
    frames: frames.map(([id, ok]) => ({ id, art: C.frames[id], ok })),
    maxPicks: (C.maxPicks || 2) + (have("third_pick") ? 1 : 0),
    bonusForBad: C.bonusPickForBad || 1,
  };
}
// a choice is {name, gender, race, blood, traits[], cls, look{hair,hairCol,skin,beard,bun}, house, frame}
export function creationIssue(choice, rec) {
  const o = creationOptions(rec), c = choice || {};
  const pick = (list, id) => list.find(x => x.id === (id || ""));
  if (c.race && !(pick(o.races, c.race) || {}).ok) return "That race is locked";
  if (c.blood && !(pick(o.bloodlines, c.blood) || {}).ok) return "That bloodline is locked";
  if (c.cls && !(pick(o.classes, c.cls) || {}).ok) return "Starting class is locked";
  if (c.frame && !(pick(o.frames, c.frame) || {}).ok) return "That frame is locked";
  const ts = c.traits || [];
  for (const t of ts) { const x = pick(o.traits, t); if (!x || !x.ok) return "Trait locked: " + t; }
  if (new Set(ts).size !== ts.length) return "Duplicate trait";
  for (const t of ts) { const op = (traitDef(t) || {}).opposes; if (op && ts.includes(op)) return "Opposite traits"; }
  const bad = ts.filter(t => (traitDef(t) || {}).rarity === "bad").length;
  if (ts.length > o.maxPicks + (bad ? o.bonusForBad : 0)) return `Pick at most ${o.maxPicks}${bad ? "" : " (take a bad trait for one more)"}`;
  if (c.gender && !["m", "f"].includes(c.gender)) return "Bad sex";
  return null;
}
// apply to the founder of a fresh newGame(); returns an error string or null. Quick start = never call this.
export function applyCreation(s, choice, rec) {
  const err = creationIssue(choice, rec);
  if (err) return err;
  const c = choice, f = s.members.find(x => x.id === s.activeId) || s.members[0], C = CRD();
  if (c.gender) f.gender = c.gender;
  const nm = String(c.name || "").replace(/[<>"&]/g, "").trim().slice(0, 24);
  if (nm) f.name = nm;
  if (c.race === "dwarf") f.race = "dwarf", f.lifespan = (f.lifespan || T.baseLifespan) + (110 - T.baseLifespan);
  const add = t => { if (f.traits.includes(t)) return; f.traits.push(t); f.lifespan += (traitDef(t) || {}).life || 0; if (t === "seatouched") f.seaLife = 1; };
  for (const t of f.traits || []) f.lifespan -= (traitDef(t) || {}).life || 0; // creation picks replace the rolled traits
  f.traits = []; delete f.seaLife;
  if (c.blood) add(c.blood);
  for (const t of c.traits || []) add(t);
  if (c.cls) { f.cls = c.cls; s.pendingClass = (s.pendingClass || []).filter(x => x !== f.id); }
  const L = c.look || {};
  const sty = (C.hairStyles[f.gender] || []).map(x => x[0]);
  f.look = { hair: sty.includes(L.hair) ? L.hair : sty[0], hairCol: Math.max(0, Math.min(C.hairCols.length - 1, L.hairCol | 0)), skin: Math.max(0, Math.min(C.skins.length - 1, L.skin | 0)) };
  if (f.gender === "f" && L.bun) f.look.bun = true;
  if (f.race === "dwarf" && f.gender === "m" && L.beard) f.look.beard = L.beard;
  const hc = C.houseCols.find(h => h.id === c.house || h.col === c.house);
  s.house = { col: hc ? hc.col : houseColOf(s) };
  if (c.frame && c.frame !== "open") s.house.frame = c.frame;
  return null;
}
// Random button: a legal random choice from the unlocked options (UI randomness, not the game rng)
export function randomCreation(rec, rnd = Math.random) {
  const o = creationOptions(rec), C = CRD(), pk = a => a[Math.floor(rnd() * a.length)];
  const gender = pk(["m", "f"]), race = pk(o.races.filter(x => x.ok)).id, sty = C.hairStyles[gender];
  const traits = [];
  const pool = o.traits.filter(x => x.ok);
  for (let i = 0; i < 40 && traits.length < o.maxPicks; i++) { const t = pk(pool).id; const tr = [...traits, t]; if (!creationIssue({ traits: tr }, rec)) traits.push(t); }
  const look = { hair: pk(sty)[0], hairCol: Math.floor(rnd() * C.hairCols.length), skin: Math.floor(rnd() * C.skins.length) };
  if (gender === "f") look.bun = rnd() < 0.25;
  if (race === "dwarf" && gender === "m") look.beard = pk(["forked", "ringed-plait"]);
  return { name: "", gender, race, blood: pk(o.bloodlines.filter(x => x.ok)).id, traits, cls: "", look, house: pk(C.houseCols).id, frame: "open" };
}
