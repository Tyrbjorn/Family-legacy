// R77 intro / tutorial / Orrin logic. PURE and READ-ONLY over the save: nothing here writes `s`, and none of the engine's "state" helpers
// (legacyState, introState, tutState, craftingUnlocked) are called, because those create fields. Predicates read properties directly.
// `ui` is the fl_ui_v1 record (mutated only by the few functions that say so). `h` carries engine reads: see coachHelpers().
import { LEDGER, GROUND, EXPLAINERS, allChimes, GROUND_NOTE_ID, GROUND_NOTE, CHAPTERS, GROUND_TITLE } from "./coach-data.js";

const arr = x => (Array.isArray(x) ? x : []);
const living = s => arr(s.members).filter(m => m && m.alive);
const done = s => arr(s.doneQuests);
const tut = s => s.tut || null;
const tutDoneIds = s => arr(tut(s) && tut(s).done);

// engine reads bundled once: E = engine namespace, D = data. All used calls are pure reads.
export function coachHelpers(E, D) {
  const stg = (D.estate && D.estate.stages) || [];
  const farm = (stg.find(x => x[1] === "Farmstead") || [30])[0];
  const q = id => (D.quests || []).find(x => x.id === id) || null;
  return {
    nSteps: ((D.tutorial && D.tutorial.steps) || []).length,
    Y: (D.tuning && D.tuning.daysPerYear) || 30,
    farmScore: farm,
    estateScore: s => E.estateScore(s),
    teen: D.tuning && D.tuning.teenAge, court: D.tuning && D.tuning.courtAge, adult: D.tuning && D.tuning.adultAge,
    quest: q,
    introText: id => { const l = ((D.intros && D.intros.lines) || []).find(x => x.id === id); return l ? l.intro : ""; },
    level: m => E.level(m),
    era: s => ((E.era && E.era(s)) || {}).n | 0,
  };
}

// ---- tutorial reads
export const tutComplete = (s, h) => !!tut(s) && !tut(s).skipped && (tut(s).step | 0) >= h.nSteps;
export const tutActive = (s, h) => !!tut(s) && !!tut(s).started && !tut(s).skipped && (tut(s).step | 0) < h.nSteps;
const td = (s, ...ids) => !!tut(s) && (tut(s).skipped || ids.every(i => tutDoneIds(s).includes(i)));
export const isMature = s => (s.day | 0) > 3 || (!!tut(s) && ((tut(s).step | 0) > 0 || !!tut(s).skipped));
export const hasLand = s => arr(s.land).length > 0;
const built = s => Object.values(s.buildings || {}).some(v => v > 0) || arr(s.structures).length > 0;
const pathChosen = s => living(s).some(m => m.cls || m.guild || m.craft || m.prof);
const visited = (s, t) => arr(s.townsVisited).includes(t);

// ---- Ledger of Firsts (10 rows; checks read the save or a UI "first" flag kept in fl_ui_v1)
const LCHECK = {
  larder: (s, r) => td(s, "food", "chop"),
  train: (s, r) => !!r.firsts.train,
  tools: (s, r) => !!r.firsts.equip,
  refine: (s, r) => td(s, "cook", "craft"),
  sell: (s, r) => td(s, "trade"),
  ground: s => hasLand(s),
  build: s => built(s),
  heirs: (s, r) => !!r.firsts.court,
  guild: s => pathChosen(s),
  save: (s, r) => !!r.firsts.menu,
};
export const ledgerRows = (s, rec) => LEDGER.map(x => Object.assign({ done: !!LCHECK[x.id](s, rec) }, x));
export const ledgerNext = rows => rows.find(r => !r.done) || null;
export const ledgerDone = rows => rows.every(r => r.done);
export const FIRSTS = ["train", "equip", "court", "menu", "offer", "init"];
// action names (data-a) that record a "first" in the UI profile
export const FIRST_OF = { train: "train", equip: "equip", equipbag: "equip", court: "court", m_open: "menu" };

// ---- Ground Ledger: existing quests and state only
export function reqText(req) {
  if (!req) return "";
  const out = [];
  if (req.lvl) out.push("level " + req.lvl);
  if (req.era) out.push("era " + req.era);
  if (req.town) out.push("visit " + req.town);
  if (req.story) out.push("story " + req.story);
  if (req.land) out.push("land: " + req.land);
  if (arr(req.done).length) out.push("finish " + req.done.join(", "));
  return out.join(", ");
}
const inGuild = (s, ids) => living(s).some(m => [m.guild, m.guild2].some(g => g && ids.includes(g.id)) || (ids.includes("hearth") && m.craft));
const GCHECK = {
  plot: s => hasLand(s),
  bounds: s => arr(s.explored).length > 0 || (tut(s) && ((tut(s).flags || {}).scouted || tutDoneIds(s).includes("scout"))),
  bram: s => done(s).includes("haul_bram"),
  raise: s => built(s),
  hands: s => arr(s.minions).length > 0,
  granary: s => done(s).includes("g_arch_granary") || done(s).includes("g_hearth_bridge"),
  market: s => done(s).includes("merchant_run"),
  hall: s => ((s.union && s.union.tier) | 0) > 0,
  village: s => done(s).includes("st8") || done(s).includes("q_charter"),
};
export function groundRows(s, h) {
  return GROUND.map(x => {
    const dn = !!GCHECK[x.id](s);
    let status = dn ? "done" : x.later ? "later" : "open", lock = "";
    if (!dn) {
      if (x.id === "granary" && !inGuild(s, ["architects", "hearth"])) lock = "needs the Architects' or Crafters' Guild, rank 0";
      if (x.id === "hall" && !hasLand(s)) lock = "needs land first";
      if ((x.id === "raise" || x.id === "hands") && !hasLand(s)) lock = "needs land first";
      if (x.later) { const qs = arr(x.quest).map(h.quest).filter(Boolean); lock = qs.map(q => `${q.name}: ${reqText(q.req)}`).join("; "); }
    }
    return Object.assign({}, x, { status, lock });
  });
}
export const groundDone = rows => rows.filter(r => !r.later).every(r => r.status === "done");

// ---- Orrin's notes: explainers, chimes (voiced over the existing unlock intros), the hand-off, and pack entries
const introOpen = (s, id) => { const l = s.intros && s.intros.lines && s.intros.lines[id]; return !!l && (l.state === "active" || (l.state === "done" && !l.quiet)); };
const EXPL = {
  food: s => tutDoneIds(s).includes("food"), cook: s => tutDoneIds(s).includes("cook"), craft: s => tutDoneIds(s).includes("craft"),
  estate: s => tutDoneIds(s).includes("estate"), path: s => tutDoneIds(s).includes("path"),
};
const TRIG = {
  craft: s => introOpen(s, "craft") || !!s.craftUnlocked,
  guilds: s => introOpen(s, "guilds"),
  food: s => introOpen(s, "food"),
  minions: s => introOpen(s, "minions"),
  houses: s => introOpen(s, "houses") || arr(s.suitors).length > 0,
  dynasty: s => introOpen(s, "dynasty"),
  enchanting: s => introOpen(s, "enchanting"),
  paths: s => introOpen(s, "paths"),
  farmstead: (s, h) => hasLand(s) && h.estateScore(s) >= h.farmScore,
  union: s => !!(s.fields && s.fields.ups && s.fields.ups.cart1 && s.fields.ups.cart2) && arr(s.minions).some(m => m.job === "teamster") && !(s.union && s.union.tier),
  automation: s => arr(s.minions).length > 0 && arr(s.structures).length > 0,
  heirs: (s, h) => living(s).some(m => { const y = Math.floor((m.ageDays | 0) / h.Y); return y >= h.teen && y < h.adult; }),
  legacy: s => !!(s.legacy && s.legacy.earned > 0),
  sea: s => visited(s, "saltmere") && done(s).includes("st4"),
  economy: s => done(s).includes("reef4"),
  highlands: s => visited(s, "dwarfhold"),
  oldones: s => visited(s, "dwarfhold"),
};
// a pack's declarative `when`: the same keys a quest `req` uses
export function declWhen(s, w, h) {
  if (!w || typeof w !== "object") return false;
  if (w.town && !visited(s, w.town)) return false;
  if (w.story && !done(s).includes("st" + w.story)) return false;
  if (arr(w.done).length && !w.done.every(i => done(s).includes(i))) return false;
  if (w.item && !arr(s.vault).includes(w.item)) return false;
  if (w.land && !arr(s.land).includes(w.land)) return false;
  if (w.lvl && !(h && h.level && living(s).some(m => h.level(m) >= w.lvl))) return false;
  if (w.era && !(h && h.era && h.era(s) >= w.era)) return false;
  return true;
}
export function noteList(s, h) {
  const out = [];
  for (const e of EXPLAINERS) out.push({ id: e.id, kind: "explain", icon: e.icon, title: e.title, line: e.text, go: e.go, steps: [], quests: [], on: e.after === "finale" ? tutComplete(s, h) : !!EXPL[e.after](s) });
  out.push({ id: GROUND_NOTE_ID, kind: "ground", icon: "📒", title: GROUND_TITLE.replace("📒 ", ""), line: GROUND_NOTE, go: "quests", steps: [], quests: [], on: tutComplete(s, h) });
  for (const c of allChimes()) {
    const on = c.kind === "pack" ? declWhen(s, c.when, h) : !!TRIG[c.id](s, h);
    out.push(Object.assign({}, c, { on, quote: c.kind === "intro" ? h.introText(c.id) : "" }));
  }
  return out;
}
export const noteById = (s, h, id) => noteList(s, h).find(n => n.id === id) || null;
export const noteView = n => (n && n.go && n.go !== "@menu" ? n.go : "");

// ---- seen flags (fl_ui_v1.orrin.seen[slot][id]); returns the record for a slot, creating it in `ui` only
export const seenRec = (ui, slot) => (ui.orrin.seen[slot] = ui.orrin.seen[slot] || {});
export const isSeen = (ui, slot, id) => !!(ui.orrin.seen[slot] && ui.orrin.seen[slot][id]);
export const markSeen = (ui, slot, id) => { const r = seenRec(ui, slot); if (r[id]) return false; r[id] = 1; return true; };
// the first time a slot is looked at: a mature save marks every trigger that is already true as seen (quiet), so loading never fires a card storm.
export function firstLook(s, ui, slot, h) {
  const r = seenRec(ui, slot);
  if (r._init) return false;
  r._init = 1;
  if (isMature(s)) {
    for (const n of noteList(s, h)) if (n.on) r[n.id] = 1;
    ledgerRec(ui, slot).firsts.offer = 1;
  }
  return true;
}
export const ledgerRec = (ui, slot) => (ui.ledger[slot] = ui.ledger[slot] || { hidden: false, firsts: {}, master: "" });
export function noteFirst(ui, slot, key) { const l = ledgerRec(ui, slot); if (l.firsts[key]) return false; l.firsts[key] = 1; return true; }
// notes the player may open from the menu: every one already seen in this slot
export const seenNotes = (s, h, ui, slot) => noteList(s, h).filter(n => isSeen(ui, slot, n.id) && n.id !== "_init");
// pending (true, unseen) notes in the order the registry lists them
export const pendingNotes = (s, h, ui, slot) => noteList(s, h).filter(n => n.on && !isSeen(ui, slot, n.id));

// ---- chapters: which stops can open right now. `vis(viewId)` says whether a sub-tab is visible; `has(sel)` whether the DOM target exists.
export function stopText(st, h) {
  let t = st.text;
  for (const k of st.needs || []) if (!(h[k] > 0)) return null;
  return t.replace(/\{(\w+)\}/g, (_, k) => (h[k] > 0 ? h[k] : "?"));
}
export const stopAvailable = (st, vis, h) => (!st.tab || vis(st.tab)) && stopText(st, h) != null;
export function chapterStops(ch, vis, h) {
  return ch.stops.filter(st => stopAvailable(st, vis, h));
}
export const chapterIds = () => CHAPTERS.map(c => c.id);

// ---- the offer card, the Ledger and the Ground Ledger decide what the Today page shows
export function todayCoach(s, ui, slot, h, ok) {
  if (!ok || ui.coach.off) return { offer: false, ledger: false, ground: false };
  const rec = ledgerRec(ui, slot);
  const rows = ledgerRows(s, rec);
  const offer = !rec.firsts.offer && !(tut(s) && tut(s).skipped);
  const ledger = !rec.hidden && !ledgerDone(rows);
  const ground = tutComplete(s, h) || (tut(s) && tut(s).skipped) ? !rec.hidden && !groundDone(groundRows(s, h)) && !ledger : false;
  return { offer, ledger, ground, rows };
}
