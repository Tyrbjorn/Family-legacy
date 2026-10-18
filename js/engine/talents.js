import { findId } from "./lookup.js";
// R36 Talents (data/talents.json): earned, personal bonuses. Traits stay birth-only (Nimble is a trait, not a talent).
// m.talents = { own: [ids in earn order], on: [active ids] }. Slots = base + perTier x class tier (cap 4) + fx.slots (Heir of Vael, max 5).
// Earned once per member, adults only; auto-activated into a free slot. Never passed on directly: with a Hall of Ancestors the
// family keeps up to 3 shrines (one talent per death); descendants learn the shrined talents free at 18 (still using a slot).
import { D, T, ageY, isAdult, living, log } from "./state.js";
import { chron } from "./chronicle.js";
import { tutComplete } from "./tutorial.js";

export const TL = () => D.talents || { slots: { base: 2, perTier: 1, cap: 4, max: 5 }, shrines: { max: 3 }, talents: [] };
export const talentDef = id => TL().talents.find(t => t.id === id);
const RANKS = () => ((D.guilds && D.guilds.ranks) || []).map(r => r.name);
const tl = m => m.talents || (m.talents = { own: [], on: [] });
const clsDef = id => findId(D.classes, id);
// active talents' sum for a numeric fx key (traitSum adds this)
export function talentSum(m, k) {
  let v = 0;
  for (const id of (m && m.talents && m.talents.on) || []) { const x = (talentDef(id) || { fx: {} }).fx[k]; if (typeof x === "number") v += x; }
  return v;
}
export const talentSkillXp = (m, sk) => ((m && m.talents && m.talents.on) || []).reduce((a, id) => a + (((talentDef(id) || { fx: {} }).fx.skillXp || {})[sk] || 0), 0);
export const hasTalent = (m, id) => !!(m && m.talents && m.talents.on.includes(id));
export function talentSlots(m) {
  const S = TL().slots, c = clsDef(m.cls);
  return Math.min(S.max, Math.min(S.cap, S.base + S.perTier * ((c && c.tier) || 0)) + talentSum(m, "slots"));
}
// family-wide price cut: the best active Haggler-type talent among living adults
export const talentBuy = s => (s ? Math.min(0, ...living(s).map(m => talentSum(m, "buy"))) : 0);
// class line: current class and everything it evolved from
const line = m => { const o = []; for (let c = clsDef(m.cls); c && !o.includes(c.id); c = c.from && clsDef(c.from)) o.push(c.id); return o; };
const guildRank = (m, gid) => Math.max(m.guild && m.guild.id === gid ? m.guild.rank : -1, m.craft && m.craft.id === gid ? m.craft.rank : -1);
export function earned(s, m, t) {
  const f = t.from || {};
  if (f.class) return line(m).includes(f.class);
  if (f.guild) return guildRank(m, f.guild) >= Math.max(0, RANKS().indexOf(f.rank));
  if (f.tutorial) return tutComplete(s) && m.id === (s.members[0] || {}).id;
  return false; // quest talents come from questDone (the member who did it)
}
export function grantTalent(s, m, id, why, quiet) {
  const t = talentDef(id), x = tl(m);
  if (!t || x.own.includes(id) || !m.alive || !isAdult(m)) return false;
  x.own.push(id);
  if (x.on.length < talentSlots(m)) x.on.push(id);
  if (t.fx.slots) while (x.on.length < talentSlots(m) && x.own.some(k => !x.on.includes(k))) x.on.push(x.own.find(k => !x.on.includes(k)));
  if (!quiet) {
    log(s, `⭐ ${m.name} earned the talent ${t.icon} ${t.name}${why ? " (" + why + ")" : ""}: ${t.desc}.${x.on.includes(id) ? "" : " Slots full: swap it in on the Character tab."}`);
    chron(s, "family", `⭐ ${m.name} earned ${t.name}`, m.name);
  }
  return true;
}
// daily: class / guild / tutorial talents; shrine talents at 18
export function talentDay(s) {
  for (const m of living(s)) {
    if (!isAdult(m)) continue;
    for (const t of TL().talents) if (!tl(m).own.includes(t.id) && earned(s, m, t)) grantTalent(s, m, t.id, t.from.class ? "class" : t.from.guild ? "guild rank" : "prologue");
    if (!m.shrineSeen) {
      m.shrineSeen = true;
      if ((m.parents || []).length && ageY(m) <= TL().shrines.learnAge + 1) for (const id of s.shrines || []) grantTalent(s, m, id, "learned at the family shrine");
    }
  }
}
// quests.js: the member who finished it
export function talentQuest(s, m, qid) {
  for (const t of TL().talents) if (t.from.quest === qid) grantTalent(s, m, t.id, "quest");
}
// toggling (manual pins the loadout from Auto Advance)
export function toggleTalent(s, m, id, auto) {
  const x = tl(m);
  if (!x.own.includes(id)) return false;
  if (x.on.includes(id)) {
    if (talentDef(id).fx.slots) return false; // Heir of Vael can't free its own slot
    x.on = x.on.filter(k => k !== id);
  } else {
    if (x.on.length >= talentSlots(m)) return false;
    x.on.push(id);
  }
  if (!auto) (m.pins = m.pins || {}).talents = true;
  return true;
}
// Auto Advance (unpinned): fill empty slots, prefer talents tagged for the current work
export function talentAuto(s, m) {
  const x = tl(m);
  if ((m.pins && m.pins.talents) || !x.own.length) return;
  const a = m.action && m.action.type, want = ["quest", "dungeon", "explore"].includes(a) ? "combat" : a === "gather" ? "gather" : a === "craft" ? "craft" : a === "job" || a === "trade" ? "coin" : "xp";
  const score = id => (talentDef(id).fx.slots ? 9 : 0) + ((talentDef(id).tags || []).includes(want) ? 2 : 0) - x.own.indexOf(id) * 0.01;
  x.on = [...x.own].sort((p, q) => score(q) - score(p)).slice(0, talentSlots(m));
}
// next class / guild talent hint (quest talents stay hidden)
export function nextTalents(s, m) {
  const out = [], x = tl(m);
  for (const t of TL().talents) {
    if (x.own.includes(t.id)) continue;
    const f = t.from;
    if (f.class && (clsDef(f.class) || {}).from === m.cls || (f.class && !m.cls && !(clsDef(f.class) || {}).from)) out.push({ t, how: (clsDef(f.class) || {}).name });
    else if (f.guild && ((m.guild && m.guild.id === f.guild) || (m.craft && m.craft.id === f.guild))) out.push({ t, how: `${f.rank} in ${(findId(D.guilds.guilds, f.guild) || {}).name}` });
  }
  return out;
}
export const hiddenTalents = (m) => TL().talents.filter(t => t.from.quest && !tl(m).own.includes(t.id)).length;
// ---- Hall of Ancestors shrines
export const hasHall = s => (s.structures || []).some(st => st.type === TL().shrines.building);
export function onDeathTalents(s, m) {
  const own = ((m.talents || {}).own || []).filter(id => !(s.shrines || []).includes(id));
  if (!hasHall(s) || !own.length) return;
  s.shrines = s.shrines || [];
  if (s.shrines.length < TL().shrines.max) { s.shrines.push(own[0]); log(s, `🏛️ ${talentDef(own[0]).name} of ${m.name} was enshrined in the Hall of Ancestors.`); }
  else s.shrineOffer = { name: m.name, ids: own }; // full: the head may replace one
}
export function enshrine(s, id, replace) {
  const S = (s.shrines = s.shrines || []), off = s.shrineOffer;
  if (!hasHall(s) || !talentDef(id) || S.includes(id)) return false;
  if (off && !off.ids.includes(id)) return false;
  if (S.length >= TL().shrines.max) { const i = S.indexOf(replace); if (i < 0) return false; S.splice(i, 1); }
  S.push(id); s.shrineOffer = null;
  return true;
}
// save v36: empty talents, class/guild talents from current state (quiet), head gets quest talents from s.doneQuests
export function talentMigrate(s) {
  for (const m of s.members || []) { tl(m); if (m.alive && isAdult(m)) m.shrineSeen = true; }
  s.shrines = s.shrines || [];
  if (s.shrineOffer === undefined) s.shrineOffer = null;
  for (const m of living(s).filter(isAdult)) for (const t of TL().talents) if (earned(s, m, t)) grantTalent(s, m, t.id, "", true);
  const h = s.members.find(x => x.id === s.head && x.alive) || living(s).find(isAdult);
  if (h) for (const t of TL().talents) if (t.from.quest && (s.doneQuests || []).includes(t.from.quest)) grantTalent(s, h, t.id, "", true);
}
