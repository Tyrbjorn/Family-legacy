// R60 Legacy branches & alignment: Honor / Old Ways<->New Faith (s.align), Respect shown over existing numbers
// (base never written; deltas live in s.respectAdj), quest tiers + spill-over, the rival-quest lock (s.locked),
// six branch points (s.branches), special classes, capped carry-over legacy bonuses (s.lb), and the four endings.
import { D, ageY, living, log } from "./state.js";
import { chron } from "./chronicle.js";
// Engine helpers are wired in by r60-wire.js (keeps this module out of the day-hook import cycle).
const DEP = {};
export const setR60Deps = o => Object.assign(DEP, o);

const FD = () => D.factions || { list: [], words: [], guildMap: [[0, 0]], tiers: {} };
const RD = () => D.r60 || { bonuses: [], branches: [], endings: [], honorBands: [], bonusCaps: {} };
const clamp = v => Math.max(-100, Math.min(100, Math.round(v)));
export const factionDef = id => FD().list.find(f => f.id === id);
const HOUSE_F = { dagon: "dagon", gilmane: "gilmane", ironbrow: "thanes" };

// ---- alignment
export const alignOf = s => (s.align ||= { honor: 0, faith: 0 });
export function shiftAlign(s, fx, why) {
  if (!fx || (!fx.honor && !fx.faith)) return;
  const a = alignOf(s);
  a.honor = clamp(a.honor + (fx.honor || 0));
  a.faith = clamp(a.faith + (fx.faith || 0));
  (s.alignLog ||= []).unshift({ d: s.day || 0, h: fx.honor || 0, f: fx.faith || 0, why: why || "" });
  s.alignLog.length = Math.min(s.alignLog.length, RD().alignLog || 5);
}
const band = (list, v) => (list.find(b => v <= b[2]) || list[list.length - 1] || ["", "", 0]);
export const honorBand = s => { const b = band(RD().honorBands, alignOf(s).honor); return { id: b[0], name: b[1] }; };
export const faithWord = s => { const f = alignOf(s).faith; return f <= -20 ? "Old Ways" : f >= 20 ? "New Faith" : "Between"; };

// ---- respect
const rels = (id, k) => {
  const f = factionDef(id), out = new Set((f && f[k]) || []);
  for (const g of FD().list) if ((g[k] || []).includes(id)) out.add(g.id);
  out.delete(id);
  return [...out];
};
export const rivalsOf = id => rels(id, "rivals");
export const alliesOf = id => rels(id, "allies");
const mapGuild = rep => {
  const M = FD().guildMap;
  if (rep <= M[0][0]) return M[0][1];
  for (let i = 1; i < M.length; i++) if (rep <= M[i][0]) return M[i - 1][1] + ((rep - M[i - 1][0]) / (M[i][0] - M[i - 1][0])) * (M[i][1] - M[i - 1][1]);
  return M[M.length - 1][1];
};
const guildMembers = (s, g) => living(s).flatMap(m => DEP.guildsOf(m).filter(x => x.id === g));
export const guildTopRank = (s, g) => Math.max(-1, ...guildMembers(s, g).map(x => x.rank || 0));
// the existing number (read only) and whether the family has met the faction
export function respectBase(s, id) {
  const f = factionDef(id);
  if (!f) return { v: 0, met: false };
  const [src, sub] = f.src.split(":");
  if (src === "guild") {
    const ms = guildMembers(s, id), fav = (s.guildFavour || {})[id] || 0;
    if (!ms.length) return { v: fav ? Math.round(mapGuild(Math.max(0, fav))) : 0, met: !!fav };
    return { v: Math.round(mapGuild(Math.max(...ms.map(x => x.rep || 0)))), met: true };
  }
  if (src === "house") { const h = (s.houses || {})[sub || id]; return { v: h ? h.r : 0, met: !!h }; }
  if (src === "usurper") return { v: s.usurper ? s.usurper.r : 0, met: !!s.usurper };
  if (src === "adv") { const ad = living(s).filter(m => m.adv); return { v: ad.length ? 5 + 12 * Math.max(...ad.map(m => m.adv.rank || 0)) : 0, met: !!ad.length }; }
  const met = (s.respectAdj || {})[id] != null || (f.metFlag && (s.r60f || {})[f.metFlag]) || (f.metQuest && (s.doneQuests || []).includes(f.metQuest)) || (f.metTown && DEP.townKnownId(s, f.metTown)) || (f.metGuild && guildMembers(s, f.metGuild).length);
  return { v: 0, met: !!met };
}
export function respect(s, id) {
  const f = factionDef(id) || { honorWeight: 0 }, b = respectBase(s, id), adj = (s.respectAdj || {})[id] || 0;
  const hon = Math.round((f.honorWeight || 0) * alignOf(s).honor * 0.5);
  const v = clamp(b.v + adj + hon);
  return { id, base: b.v, adj, hon, v, met: b.met || adj !== 0, word: respectWord(v) };
}
export const respectWord = v => { const w = band(FD().words, v); return { id: w[0], name: w[1] }; };
const WORDS = () => FD().words.map(w => w[0]);
export const respectAtLeast = (s, id, word) => WORDS().indexOf(respect(s, id).word.id) >= WORDS().indexOf(word);
export const respectList = s => FD().list.map(f => ({ ...respect(s, f.id), name: f.name, icon: f.icon })).sort((a, b) => b.met - a.met || b.v - a.v);
export function adjRespect(s, id, n) {
  if (!n || !factionDef(id)) return;
  const a = (s.respectAdj ||= {});
  a[id] = Math.max(-200, Math.min(200, (a[id] || 0) + n));
}

// ---- quest tiers and spill-over (only s.respectAdj is written)
export const questGiver = q => q.giver || q.guild || (q.house && HOUSE_F[q.house]) || null;
export const questTier = q => (q.againstF ? "against" : q.tier >= 3 || q.story || (q.guild && q.rank >= 1) ? "major" : "minor");
export function questSpill(s, q) {
  const T = FD().tiers, tier = questTier(q);
  if (tier === "against") {
    const t = q.againstF;
    adjRespect(s, t, T.against.target);
    for (const a of alliesOf(t)) adjRespect(s, a, T.against.ally);
    for (const r of rivalsOf(t)) adjRespect(s, r, T.against.rival);
    return tier;
  }
  const g = questGiver(q);
  if (tier === "major" && g && !q.against) { // hard-coded house feud hits (q.against) are not doubled
    for (const r of rivalsOf(g)) adjRespect(s, r, T.major.rival);
    for (const a of alliesOf(g)) adjRespect(s, a, T.major.ally);
  }
  return tier;
}

// ---- the rival lock
export const isLocked = (s, id) => (s.locked || []).includes(id);
export const lockWhy = (s, id) => (s.lockWhy || {})[id] || "another side";
export function lockIds(s, ids, why) {
  for (const id of ids || []) if (!isLocked(s, id)) (s.locked ||= []).push(id), ((s.lockWhy ||= {})[id] = why);
}
export function rivalLockCheck(s, q) {
  if (!q.rivals || !q.rivals.length) return false;
  const n = q.chain ? D.quests.filter(x => x.chain === q.chain && (s.doneQuests || []).includes(x.id)).length : 1;
  if (q.lockAt && n < q.lockAt) return false;
  const fresh = q.rivals.filter(id => !isLocked(s, id));
  if (!fresh.length) return false;
  const who = (factionDef(questGiver(q)) || {}).name || q.name;
  lockIds(s, fresh, who);
  log(s, `🔒 ${q.name}: you sided with ${who}; ${fresh.length} rival path${fresh.length > 1 ? "s" : ""} closed for this run.`);
  return true;
}
export function questGate(s, q) {
  if (globalThis.R60OFF) return null; // test-only switch (longsim R60OFF=1)
  if (isLocked(s, q.id)) return "Locked: you sided with " + lockWhy(s, q.id);
  const h = alignOf(s).honor;
  if (q.oath && h <= -50) return "your word is doubted (Oathbreaker)";
  if (q.envoy && h < 50) return "needs Honor: True";
  const g = questGiver(q);
  if (g && respect(s, g).word.id === "hostile") return (factionDef(g) || {}).name + " is Hostile";
  return null;
}

// ---- branch points
export const branchDef = id => RD().branches.find(b => b.id === id);
const counter = (s, k) => {
  const [t, x] = k.split(":");
  if (t === "rank") return guildTopRank(s, x);
  if (t === "guildq") return D.quests.filter(q => q.guild === x).reduce((a, q) => a + ((s.qRuns || {})[q.id] || 0), 0);
  if (t === "quest") return (s.qRuns || {})[x] || 0;
  if (t === "count") return (s.r60c || {})[x] || 0;
  return 0;
};
export const bump = (s, k, n = 1) => ((s.r60c ||= {})[k] = ((s.r60c || {})[k] || 0) + n);
function whenMet(s, w) {
  if (!w) return true;
  if (w.region && !DEP.regionOpen(s, w.region)) return false;
  if (w.usurper && !s.usurper) return false;
  if (w.guildAny && !w.guildAny.some(g => guildMembers(s, g).length)) return false;
  if (w.doneAny && !w.doneAny.some(id => (s.doneQuests || []).includes(id))) return false;
  if (w.done && !w.done.every(id => (s.doneQuests || []).includes(id))) return false;
  if (w.town && !DEP.townKnownId(s, w.town)) return false;
  return true;
}
export const branchOpen = (s, b) => !(s.branches || {})[b.id] && whenMet(s, b.when);
export const openBranches = s => RD().branches.filter(b => branchOpen(s, b));
export const raceState = (s, b) => (b.race ? { a: counter(s, b.race.a), b: counter(s, b.race.b), at: b.race.at } : null);
export function chooseBranch(s, id, side, how = "chose") {
  const b = branchDef(id);
  if (!b || !["a", "b"].includes(side)) return "no such choice";
  if ((s.branches || {})[id]) return "already decided";
  if (isLocked(s, "side:" + id + "." + side)) return "Locked: you sided with " + lockWhy(s, "side:" + id + "." + side);
  if (how === "chose" && !whenMet(s, b.when)) return "not yet";
  const x = b[side], other = side === "a" ? "b" : "a";
  (s.branches ||= {})[id] = side;
  if (x.pair) adjRespect(s, x.pair[0], x.pair[2]), adjRespect(s, x.pair[1], -x.pair[2]);
  shiftAlign(s, x.align, b.name + ": " + x.name);
  if (x.coin) s.res.coin += x.coin;
  if (x.item) DEP.addToVault(s, x.item);
  if (x.minion) DEP.addMinion(s, x.minion, b.name);
  if (x.flag) (s.r60f ||= {})[x.flag] = side;
  for (const q of x.reveal || []) if (!(s.revealed ||= []).includes(q)) s.revealed.push(q);
  const who = x.name.replace(/^(Back|Side with|Stand with|Take) /, "");
  lockIds(s, ["side:" + id + "." + other, ...(x.lockQ || []), ...(x.lockC || []).map(c => "cls:" + c)], who);
  log(s, `${b.icon} ${b.name}: ${how === "race" ? "the race is decided, " : ""}${x.name}.`);
  chron(s, "deed", `${b.icon} ${b.name}: ${x.name}.`);
  return null;
}
export function r60Day(s) {
  if (globalThis.R60OFF) return;
  for (const b of RD().branches) {
    if ((s.branches || {})[b.id] || b.lock !== "race" || !whenMet(s, b.when)) continue;
    const r = raceState(s, b);
    if (r.a >= r.at || r.b >= r.at) chooseBranch(s, b.id, r.a >= r.at ? "a" : "b", "race");
  }
  if (alignOf(s).honor >= 50) for (const q of D.quests) if (q.envoy && !(s.revealed ||= []).includes(q.id)) s.revealed.push(q.id), log(s, `🕊️ Your word is trusted: “${q.name}” is offered.`);
  const lb = s.lb;
  if (lb && lb.remedy && (s.day || 0) % 360 === 0 && s.day) s.res.thyme = (s.res.thyme || 0) + 3 * lb.remedy;
}
export function questDone60(s, q) {
  if (globalThis.R60OFF) return;
  if (!s.align) alignOf(s);
  questSpill(s, q);
  rivalLockCheck(s, q);
  if (q.align) shiftAlign(s, q.align, q.name);
  if (q.town === "saltmere" && q.deliver && Object.keys(q.deliver).some(k => /fish|eel|cod|herring|crab/.test(k))) bump(s, "fish");
}

// ---- special classes and light story keys
let REC = null;
export const setR60Rec = r => (REC = r || null);
export function keyOk(s, k) {
  if (!k) return true;
  if (k.flag) return (s.flags || {})[k.flag] != null;
  if (k.done) return (s.doneQuests || []).includes(k.done);
  if (k.dagon) return s.dagonPact === k.dagon;
  if (k.hydra) return !!s.hydra && s.hydra.result === k.hydra;
  if (k.guildTop) return guildTopRank(s, k.guildTop) >= 3;
  if (k.guildRank) return guildTopRank(s, k.guildRank[0]) >= k.guildRank[1];
  if (k.gens) return DEP.metric(s, "generations") >= k.gens;
  if (k.resp) return respectAtLeast(s, k.resp[0], k.resp[1]);
  if (k.dungeonTier) return (s.cleared || []).some(id => { const d = (D.dungeons || []).find(x => x.id === id); return d && DEP.dungeonTier(d) >= k.dungeonTier; });
  return false;
}
const keyWaived = c => !!(REC && REC.classUnlocks && REC.classUnlocks[c.id]);
export const classKeyIssue = (s, c) => (!globalThis.R60OFF && c.key && !keyWaived(c) && !keyOk(s, c.key) ? "story: " + c.key.text : null);
export function specialIssues(s, m, c, money = true) {
  const out = [], b = c.bar || {}, g = c.gate || {}, a = alignOf(s);
  if (isLocked(s, "cls:" + c.id)) return ["Locked: you sided with " + lockWhy(s, "cls:" + c.id)];
  if (m.cls === c.id) return ["already this class"];
  const k = classKeyIssue(s, c);
  if (k) out.push(k);
  if (b.dwarf && m.race !== "dwarf" && !(m.traits || []).includes("dwarfblood")) out.push("dwarf or Dwarf-blood");
  if (b.trait && !(m.traits || []).includes(b.trait)) out.push("needs the " + b.trait + " trait");
  for (const [sk, v] of Object.entries(b.skills || {})) if (((m.skills || {})[sk] || { lvl: 0 }).lvl < v) out.push(`${sk} ${((m.skills || {})[sk] || { lvl: 0 }).lvl}/${v}`);
  for (const [st, v] of Object.entries(b.stat || {})) if (DEP.statVal(m, st) < v) out.push(`${st} ${v}`);
  if (b.age && ageY(m) < b.age) out.push("age " + b.age + "+");
  if (b.renown && (m.renown || 0) < b.renown) out.push(`renown ${m.renown || 0}/${b.renown}`);
  if (b.head && s.activeId !== m.id) out.push("the head of the family");
  if (b.tier2 && !((DEP.cls(m) || {}).tier >= 2)) out.push("a tier-2 class");
  if (b.needsClass && ![m.cls, ...(m.clsHist || [])].includes(b.needsClass)) out.push("must have been a " + ((D.classes.find(x => x.id === b.needsClass) || {}).name || b.needsClass));
  if (c.ach && (s.ach || {})[c.ach] == null) out.push("achievement: " + ((D.achievements || []).find(x => x.id === c.ach) || {}).name);
  if (g.honor != null && a.honor < g.honor) out.push("Honor " + g.honor + "+");
  if (g.faithMin != null && a.faith < g.faithMin) out.push("New Faith " + g.faithMin + "+");
  if (g.faithMax != null && a.faith > g.faithMax) out.push("Old Ways " + -g.faithMax + "+");
  if (g.resp && !respectAtLeast(s, g.resp[0], g.resp[1])) out.push(`${(factionDef(g.resp[0]) || {}).name} ${g.resp[1]}`);
  if (money && s.res.coin < c.cost) out.push(`${c.cost} coin`);
  return out;
}
export const specialClasses = () => (D.classes || []).filter(c => c.special);
export function adoptSpecial(s, m, cid) {
  const c = specialClasses().find(x => x.id === cid);
  if (!c || !m) return "no such class";
  const is = specialIssues(s, m, c);
  if (is.length) return is[0];
  s.res.coin -= c.cost;
  if (m.cls && !(m.clsHist ||= []).includes(m.cls)) m.clsHist.push(m.cls);
  m.cls = cid;
  if (!(s.clsEarned ||= []).includes(cid)) s.clsEarned.push(cid);
  log(s, `${c.icon} ${m.name} became a ${c.name}!`);
  (s.deeds ||= []).push(`${m.name} became a ${c.name}.`);
  return null;
}

// ---- carry-over legacy bonuses (applied once, to a fresh game, outside newGame)
const owned = (b, r) =>
  b.ach ? r.ach[b.ach] != null : b.flag ? !!r.flags[b.flag] : b.anyFlag ? b.anyFlag.some(f => r.flags[f]) : b.achCount ? Object.keys(r.ach).length >= b.achCount : false;
export const bonusesOff = rec => !!(rec && rec.bonuses && rec.bonuses.off);
export function legacyBonuses(rec, ignoreOff = false) {
  const r = Object.assign({ ach: {}, flags: {}, bonuses: {} }, rec || {}), C = RD().bonusCaps, fx = {}, list = [];
  if (!ignoreOff && bonusesOff(r)) return { list, fx, off: true };
  const cap = { coin: C.coin, xp: C.xp, picks: C.picks, follower: C.follower, heirloom: C.heirloom };
  for (const b of RD().bonuses) {
    if (list.length >= C.pips || !owned(b, r)) continue;
    for (const [k, v] of Object.entries(b.fx)) {
      if (typeof v === "string") { if ((cap[k] ?? 1) > 0 && !fx[k]) fx[k] = v, cap[k] = (cap[k] ?? 1) - 1; continue; }
      const room = cap[k] != null ? Math.max(0, cap[k] - (fx[k] || 0)) : Infinity;
      fx[k] = +((fx[k] || 0) + Math.min(v, room)).toFixed(4);
    }
    list.push(b.id);
  }
  return { list, fx };
}
export function applyLegacyBonuses(s, rec, xpSkill) {
  const { list, fx } = legacyBonuses(rec);
  if (!list.length) return [];
  s.lb = { ...fx, ids: list };
  const f = s.members.find(x => x.id === s.activeId) || s.members[0];
  if (fx.xp) s.lb.xpSkill = xpSkill || Object.entries(f.skills || {}).sort((a, b) => b[1].lvl - a[1].lvl)[0]?.[0];
  if (fx.startCoin) s.res.coin += fx.startCoin;
  if (fx.follower) DEP.addMinion(s, "laborer", "a loyal household");
  if (fx.heirloom) DEP.addToVault(s, fx.heirloom);
  if (fx.highland) s.usurper = { r: 0 };
  if (fx.road) (s.flags ||= {}).knowsRoad = 1;
  delete s.lb.picks;
  return list;
}
export const lbOf = (s, k) => ((s && s.lb) || {})[k] || 0;

// ---- endings
export function endingOf(s) {
  const a = alignOf(s), hi = a.honor >= 0 ? "true" : "low", fa = a.faith >= 0 ? "new" : "old";
  const e = RD().endings.find(x => x.honor === hi && x.faith === fa) || RD().endings[0];
  const top = respectList(s).find(x => x.met);
  return e && { ...e, by: top ? (factionDef(top.id) || {}).name : null };
}

// ---- save step 55 back-fill from choices already made
export function backfillAlign(s) {
  const a = { honor: 0, faith: 0 };
  if (s.dagonPact === "join") a.faith -= 20, a.honor += 5;
  if (s.dagonPact === "expose") a.faith += 15;
  if (s.dagonPact === "lapsed") a.honor -= 15;
  if (s.dagonPact === "bargain") a.faith -= 5;
  const h = s.hydra && s.hydra.result;
  if (h === "blessed") a.faith -= 15;
  if (h === "slain") a.faith += 5;
  if ((s.flags || {}).thaneOath != null) a.honor += 15;
  if ((s.doneQuests || []).includes("st10")) a.honor += 5;
  s.align = { honor: clamp(a.honor), faith: clamp(a.faith) };
  s.alignLog = [];
  if (a.honor || a.faith) s.alignLog.push({ d: s.day || 0, h: a.honor, f: a.faith, why: "your family's past choices" });
  return s.align;
}
