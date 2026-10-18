// R35 Leans, town apprenticeships and inheritance (data/apprenticeships.json, legacy.familyAuto.affinity, tuning.inherit).
// Leans (m.lean): 1-2 Auto Upbringing track ids from traits + parents' tracks + a little luck, rolled at birth; +10% XP
// on the lean tracks' guild skills for everyone. Apprenticeships: idle teens 14-17 with a town master: lessons on the
// master's skills x1.5, a small wage, the master's exclusive skills open while placed; finishing gives the track
// guild's join fee halved + 20 starting rep. Inheritance (m.inh, snapshot at birth): stats = 5 + 25% of the parents'
// raw average above 5 (cap +3 each, +8 total); parents' top-2 skills at 10+ give +20% XP each (cap 40%) until 18.
import { D, T, ageY, log, rng } from "./state.js";
import { classGuild, guildDef } from "./guilds.js";
import { townKnown } from "./map.js";

export const AP = () => D.apprenticeships || { masters: [], minAge: 14, maxAge: 17, xpMult: 1.5, serveDays: 720, leanXp: 0.1, reward: {} };
const AF = () => (D.legacy.familyAuto || {}).affinity || { traits: {}, names: {} };
const TRACKS = () => (D.legacy.familyAuto || {}).tracks || {};
export const masterDef = id => AP().masters.find(x => x.id === id);
export const leanName = id => AF().names[id] || id;
const STATS = ["STR", "AGI", "INT", "WIL", "CHA", "VIT"];
const lv = (m, k) => ((m.skills || {})[k] || { lvl: 0 }).lvl;
const level = m => Math.floor(Object.values(m.skills || {}).reduce((a, k) => a + k.lvl, 0) / 5) + 1;
// a parent's track: guild, class guild or craft (same lookup Family Tutor uses)
export function parentTrack(p) {
  const g = (p.guild && p.guild.id) || (p.cls && (classGuild(p.cls) || {}).id) || (p.craft && p.craft.id);
  return g && TRACKS()[g] ? g : null;
}

// ---- leans
export function leanScores(s, m, parents) {
  const A = AF(), sc = Object.fromEntries(Object.keys(TRACKS()).map(k => [k, 0]));
  for (const t of m.traits || []) for (const [k, v] of Object.entries(A.traits[t] || {})) if (k in sc) sc[k] += v;
  const ps = (parents || []).filter(Boolean).sort((a, b) => level(b) - level(a));
  ps.forEach((p, i) => { const g = parentTrack(p); if (g) sc[g] += i === 0 ? A.parentMain : A.parentOther; });
  for (const k in sc) sc[k] += rng() * (A.rand ?? 1);
  return sc;
}
export function rollLean(s, m, parents) {
  const sc = Object.entries(leanScores(s, m, parents)).sort((a, b) => b[1] - a[1]);
  m.lean = [sc[0][0]];
  if (sc[1] && sc[0][1] - sc[1][1] <= (AF().secondGap ?? 1)) m.lean.push(sc[1][0]);
  m.leanWhy = { traits: (m.traits || []).filter(t => AF().traits[t]), parents: (parents || []).map(p => p && parentTrack(p)).filter(Boolean) };
  return m.lean;
}
// +10% XP on skills of any lean track's guild
export function leanXp(m, skillId) {
  if (!m.lean || !m.lean.length) return 0;
  return m.lean.some(g => (guildDef(g)?.skills || TRACKS()[g] || []).includes(skillId)) ? AP().leanXp ?? 0.1 : 0;
}

// ---- inheritance
export function inheritFrom(parents) {
  const I = T.inherit || {}, ps = (parents || []).filter(Boolean);
  const inh = { stats: {}, skills: {} };
  if (ps.length) {
    let tot = 0;
    for (const k of STATS) {
      const avg = ps.reduce((a, p) => a + ((p.stats || {})[k] || 5), 0) / ps.length; // raw stats: trait bonuses are not in m.stats
      let b = Math.max(0, Math.min(I.statCapEach ?? 3, Math.round((I.statShare ?? 0.25) * (avg - 5))));
      b = Math.min(b, (I.statCapTotal ?? 8) - tot);
      if (b > 0) (inh.stats[k] = b), (tot += b);
    }
    for (const p of ps) {
      const top = Object.entries(p.skills || {}).filter(([, v]) => v.lvl >= (I.skillMinLvl ?? 10)).sort((a, b) => b[1].lvl - a[1].lvl).slice(0, I.skillTop ?? 2);
      for (const [k] of top) inh.skills[k] = Math.min(I.skillXpCap ?? 0.4, (inh.skills[k] || 0) + (I.skillXp ?? 0.2));
    }
  }
  return inh;
}
// at birth: snapshot, add the stat bonus, roll the lean
export function birthInherit(s, c, parents) {
  c.inh = inheritFrom(parents);
  for (const [k, v] of Object.entries(c.inh.stats)) c.stats[k] = (c.stats[k] || 5) + v;
  rollLean(s, c, parents);
  c.appr = null;
  c.apprDone = [];
}
export const inhXp = (m, skillId) => (m.inh && ageY(m) < T.adultAge ? (m.inh.skills || {})[skillId] || 0 : 0);

// ---- apprenticeships
export const apprentices = (s, mid) => (s.members || []).filter(x => x.alive && x.appr && x.appr.id === mid);
export function apprIssue(s, m, mid) {
  const M = masterDef(mid), a = ageY(m);
  if (!M) return "unknown master";
  if (!m.alive) return "dead";
  if (a < AP().minAge) return "age " + AP().minAge + "+";
  if (a > AP().maxAge) return "too old";
  if (m.id === s.activeId) return "playing";
  if ((m.apprDone || []).includes(mid)) return "already trained here";
  const town = D.towns.find(t => t.id === M.town);
  if (town && !townKnown(s, town)) return "find " + town.name + " first";
  if (!(m.appr && m.appr.id === mid) && apprentices(s, mid).length >= (M.slots || 1)) return "no free place";
  return null;
}
export function setAppr(s, m, mid, auto) {
  if (!mid) {
    m.appr = null;
    if (!auto) (m.pins = m.pins || {}).appr = true;
    return true;
  }
  if (apprIssue(s, m, mid)) return false;
  if (m.appr && m.appr.id === mid) return true;
  m.appr = { id: mid, since: s.day || 0 }; // switching resets progress
  if (!auto) (m.pins = m.pins || {}).appr = true;
  const M = masterDef(mid);
  log(s, `${auto ? "🤖 Family Tutor: " : "🎓 "}${m.name} is apprenticed to ${M.name} (${D.towns.find(t => t.id === M.town)?.name || M.town}).`);
  return true;
}
// the master's skills are open while placed (incl. guild-exclusive ones)
export const apprOpens = (m, skillId) => !!(m.appr && (masterDef(m.appr.id)?.skills || []).includes(skillId));
export const apprSkill = m => { const M = m.appr && masterDef(m.appr.id); return M ? M.skills[(m.ageDays || 0) % M.skills.length] : null; };
// daily (time.js, idle teens): wage, finish, come of age
export function apprDay(s, m) {
  if (!m.appr) return;
  const M = masterDef(m.appr.id);
  if (!M || ageY(m) >= T.adultAge || !m.alive) {
    if (M && m.alive) log(s, `🎓 ${m.name} came of age and left ${M.name}'s workshop.`);
    m.appr = null;
    return;
  }
  s.res.coin = (s.res.coin || 0) + (M.wage || 0);
  if ((s.day || 0) - m.appr.since >= AP().serveDays) {
    (m.apprDone = m.apprDone || []).push(M.id);
    log(s, `🎓 ${m.name} finished their apprenticeship under ${M.name}. The ${guildDef(M.track)?.name || M.track} will take them at half fee, with +${AP().reward.rep || 0} rep.`);
    m.appr = null;
  }
}
export const apprProgress = (s, m) => (m.appr ? Math.min(1, ((s.day || 0) - m.appr.since) / AP().serveDays) : 0);
// finishing reward: halved join fee and starting rep for that track guild
export const apprFee = (m, gid) => ((m.apprDone || []).some(id => masterDef(id)?.track === gid) ? AP().reward.guildFee ?? 0.5 : 1);
export const apprRep = (m, gid) => ((m.apprDone || []).some(id => masterDef(id)?.track === gid) ? AP().reward.rep || 0 : 0);
// Family Tutor: unplaced, unpinned teens go to a free master on lean[0], else lean[1]
export function tutorPlace(s, m) {
  if (m.appr || (m.pins && m.pins.appr) || m.noAutoEq) return false;
  for (const g of m.lean || []) {
    const M = AP().masters.find(x => x.track === g && !apprIssue(s, m, x.id));
    if (M) return setAppr(s, m, M.id, true);
  }
  return false;
}
// ---- migration (save v35)
export function leanMigrate(s) {
  for (const m of (s.members || []).filter(x => x.alive)) {
    const ps = (m.parents || []).map(id => s.members.find(x => x.id === id)).filter(Boolean);
    if (!m.lean) rollLean(s, m, ps);
    if (m.appr === undefined) m.appr = null;
    m.apprDone = m.apprDone || [];
    if (!m.inh) m.inh = ageY(m) < T.adultAge ? { stats: {}, skills: inheritFrom(ps).skills } : { stats: {}, skills: {} }; // no retroactive stat change
  }
}
