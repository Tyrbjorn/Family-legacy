// R77 UI profile store: fl_ui_v1 (per device; the save format is untouched, nothing here is ever written into `s`).
//   { v:1,
//     sections: { "<sectionId>": true|false },              // collapse memory (explicit user choice only)
//     seen:  { "<slot>": { i:1, views:{id:1}, ev:{key:1} } }, // dots: cleared on visit; first look at a slot is silent
//     intro: { played:bool, done:{ "<slot>": 1 } },          // intro cards: "I've played before" + once per new save
//     coach: { off:bool, chapters:{ t1:"seen"|"skipped" }, explainers:{ e1:true } },
//     ledger:{ "<slot>": { hidden:bool, firsts:{id:1}, master:"orrin" } },   // Ledger of Firsts / Ground Ledger; master = "Apprenticed to" flavor
//     orrin: { mute:"all"|"quiet"|"off", seen:{ "<slot>":{ id:1 } }, last:0 },
//     flags: { menuOpened:bool }, recent:["view:map","sec:quests.active"] }  // Go to… recents
// Pure functions over a Storage-like object so node tests can drive them.
export const UI_KEY = "fl_ui_v1";
export const MUTES = ["all", "quiet", "off"];
export const defaultUi = () => ({ v: 1, sections: {}, seen: {}, intro: { played: false, done: {} }, coach: { off: false, chapters: {}, explainers: {} }, ledger: {}, orrin: { mute: "all", seen: {}, last: 0 }, flags: {}, recent: [] });
const isObj = x => x && typeof x === "object" && !Array.isArray(x);
const boolMap = (o, cap = 400) => { const r = {}; if (isObj(o)) for (const k of Object.keys(o).slice(0, cap)) if (typeof o[k] === "boolean") r[k] = o[k]; return r; };
const flagMap = (o, cap = 400) => { const r = {}; if (isObj(o)) for (const k of Object.keys(o).slice(0, cap)) if (o[k]) r[k] = 1; return r; };
const slotMap = (o, inner) => { const r = {}; if (isObj(o)) for (const k of Object.keys(o).slice(0, 12)) if (/^\d{1,3}$/.test(k) && isObj(o[k])) r[k] = inner(o[k]); return r; };
// Validate anything read from disk into a well-formed record (unknown keys dropped, wrong types fall back to defaults).
export function cleanUi(raw) {
  const d = defaultUi(), r = isObj(raw) ? raw : {};
  const ch = {}; if (isObj(r.coach && r.coach.chapters)) for (const k of Object.keys(r.coach.chapters).slice(0, 40)) if (/^t\d{1,2}$/.test(k) && ["seen", "skipped"].includes(r.coach.chapters[k])) ch[k] = r.coach.chapters[k];
  const ex = {}; if (isObj(r.coach && r.coach.explainers)) for (const k of Object.keys(r.coach.explainers).slice(0, 40)) if (/^e\d{1,2}$/.test(k) && r.coach.explainers[k]) ex[k] = true;
  return {
    v: 1,
    sections: boolMap(r.sections),
    seen: slotMap(r.seen, o => ({ i: o.i ? 1 : 0, views: flagMap(o.views), ev: flagMap(o.ev) })),
    intro: { played: !!(r.intro && r.intro.played), done: flagMap(r.intro && r.intro.done, 12) },
    coach: { off: !!(r.coach && r.coach.off), chapters: ch, explainers: ex },
    ledger: slotMap(r.ledger, o => ({ hidden: !!o.hidden, firsts: flagMap(o.firsts), master: typeof o.master === "string" && /^[a-z]{3,12}$/.test(o.master) ? o.master : "" })),
    orrin: { mute: r.orrin && MUTES.includes(r.orrin.mute) ? r.orrin.mute : d.orrin.mute, seen: slotMap(r.orrin && r.orrin.seen, o => flagMap(o)), last: 0 },
    flags: flagMap(r.flags, 20),
    recent: Array.isArray(r.recent) ? r.recent.filter(x => typeof x === "string" && /^(view|sec|menu):[A-Za-z0-9_.]{1,40}$/.test(x)).slice(0, 6) : [],
  };
}
// Load. Returns { ui, ok, migrated, why }.  ok=false means storage is unreadable/unwritable (private mode): the intro, tours and
// Orrin's cards stay hidden for the session (a card that cannot remember that it was dismissed would nag forever).
export function loadUi(st) {
  let txt = null;
  try { txt = st.getItem(UI_KEY); } catch (e) { return { ui: defaultUi(), ok: false, migrated: false, why: "unreadable" }; }
  let raw = null, why = "";
  if (txt != null) { try { raw = JSON.parse(txt); } catch (e) { raw = null; why = "corrupt"; } }
  if (why === "corrupt") { try { st.setItem(UI_KEY + "_bad", txt); } catch (e) { /* keep going */ } } // keep the unreadable text, never silently lose it
  const had = isObj(raw);
  const ui = cleanUi(raw);
  let ok = true;
  if (!had) { ok = saveUi(st, ui); if (!why) why = "new"; }
  else if (raw.v !== 1) { ok = saveUi(st, ui); why = "migrated"; }
  return { ui, ok, migrated: !had || raw.v !== 1, why };
}
export function saveUi(st, ui) { try { st.setItem(UI_KEY, JSON.stringify(cleanUi(ui))); return true; } catch (e) { return false; } }
// forget everything about one save slot (deleted / replaced by a new game / restored)
export function resetSlot(ui, n) {
  const k = String(n);
  delete ui.seen[k]; delete ui.intro.done[k]; delete ui.ledger[k]; delete ui.orrin.seen[k];
  return ui;
}
export const slotRec = (ui, n, key, make) => (ui[key][String(n)] ||= make());
