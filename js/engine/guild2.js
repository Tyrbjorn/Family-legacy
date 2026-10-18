// R47 second guilds (guilds.json second): one per person for life, opened by a tier-3 class in the main guild
// ("tier3") or Master in a slotted trade ("craft", paths.js masterGuildCheck). Start at tier 1 / Initiate, pay the
// fee, take its entry class as the second class (m.class2). Capped at tier 2; Journeyman needs repShare of the rep.
// A parent or grandparent at tier 2+ in that guild waives the fee and starts you at tier 2 when Lv and skills fit.
// The second class gives its role bonus and the guild's skills, quests, shop and building bonuses; power (CP)
// still comes from the main class only. Moves inside the second guild reuse classIssues on a member view.
import { findId } from "./lookup.js";
import { classIssues, guildOfCls, guildTierDef, moveCost, moveKind, nearestClasses, reqFor, tierLv, tierRank } from "./guildtiers.js";
import { classGuild, cls, guildDef } from "./guilds.js";
import { apprFee } from "./apprentice.js";
import { level, statVal } from "./family.js";
import { pathDef } from "./paths.js";
import { canTrain } from "./skills.js";
import { D, ageY, isAdult, living, log } from "./state.js";

export const SG = () => D.guilds.second || null;
export const cls2 = m => (m && m.class2 ? findId(D.classes, m.class2) : null);
const capTier = () => (SG() ? SG().capTier : 0) - 1; // data tier index of the cap (tier 2 shown = 1)
export const capRank = () => (D.guilds.tiers[capTier()] || { rank: 1 }).rank;
const sworn = g => g && !g.open && !g.profession;

// which rule opened the second guild for this member ("tier3" | "craft" | null)
export function secondVia(m) {
  if (!SG()) return null;
  const c = cls(m);
  if (SG().rules.includes("tier3") && c && (c.tier || 0) >= 2 && !c.retired && m.guild && guildOfCls(c.id) === m.guild.id) return "tier3";
  if (m.secondGuild && (m.secondGuild.via !== "craft" || SG().rules.includes("craftMaster"))) return m.secondGuild.via || "craft";
  return null;
}
// record the tier-3 opening once (evolve, save step 43); a craft opening is recorded by paths.js
export function markSecond(s, m) {
  if (m.secondGuild || secondVia(m) !== "tier3") return false;
  m.secondGuild = { via: "tier3", cls: m.cls, day: s.day || 0 };
  log(s, `🔓 ${m.name} reached tier 3 as a ${cls(m).name}: a second guild is open to them.`);
  return true;
}
export function secondOpenText(m) {
  const v = secondVia(m);
  if (!v) return null;
  if (v === "tier3") { const c = findId(D.classes, (m.secondGuild && m.secondGuild.cls) || m.cls) || cls(m); return `Second guild open: ${guildTierDef(c).name} ${c.name}`; }
  const p = pathDef(m.secondGuild.path);
  return `Second guild open: Master ${p ? p.name : m.secondGuild.path}`;
}

// parents and grandparents
export const ancestors = (s, m) => {
  const ps = (m.parents || []).map(id => findId(s.members, id)).filter(Boolean);
  return [...ps, ...ps.flatMap(p => (p.parents || []).map(id => findId(s.members, id)).filter(Boolean))];
};
const heldTiers = (a, gid) => [a.cls, a.class2, ...(a.clsHist || []), ...(a.cls2Hist || [])].map(id => id && findId(D.classes, id)).filter(c => c && guildOfCls(c.id) === gid).map(c => (c.tier || 0) + 1);
export const bloodline = (s, m, gid) => !!SG() && ancestors(s, m).some(a => Math.max(0, ...heldTiers(a, gid)) >= SG().bloodlineTier);

export function join2Issues(s, m, gid) {
  const g = guildDef(gid), out = [];
  if (!SG()) return ["second guilds are off"];
  if (m.guild2) return ["can't join: already in a second guild"];
  if (!secondVia(m)) return ["Second guild: reach tier 3, or Master in a trade."];
  if (!sworn(g)) return ["not a sworn guild"];
  if (m.guild && m.guild.id === gid) return ["already their main guild"];
  if (!isAdult(m) || ageY(m) < (D.guilds.minJoinAge || 16)) out.push("too young");
  for (const [k, v] of Object.entries(g.req.stats || {})) if (statVal(m, k) < v) out.push(`${k} ${statVal(m, k)}/${v}`);
  for (const [k, v] of Object.entries(g.req.skills || {})) if ((m.skills[k] || { lvl: 0 }).lvl < v) out.push(`${(findId(D.skills, k) || { name: k }).name} ${(m.skills[k] || { lvl: 0 }).lvl}/${v}`);
  if (s.res.coin < join2Fee(s, m, gid)) out.push(`${join2Fee(s, m, gid)} coin`);
  return out;
}
export const join2Fee = (s, m, gid) => (bloodline(s, m, gid) ? 0 : Math.round((guildDef(gid).req.coin || 0) * apprFee(m, gid)));
// a member seen through their second class (for classIssues / nearestClasses)
export const view2 = m => Object.assign(Object.create(m), { cls: m.class2, clsHist: m.cls2Hist || [], sideDay: m.side2Day });
// bloodline start: the tier-2 class of that guild whose Lv and skills already fit (best fit first)
const bloodStart = (m, gid) =>
  D.classes.filter(c => c.tier === capTier() && !c.retired && !c.profession && guildOfCls(c.id) === gid && level(m) >= tierLv(c) && Object.entries(reqFor(m, c)).every(([k, v]) => (m.skills[k] || { lvl: 0 }).lvl >= v))
    .sort((a, b) => Object.keys(b.req || {}).reduce((x, k) => x + m.skills[k].lvl, 0) - Object.keys(a.req || {}).reduce((x, k) => x + m.skills[k].lvl, 0))[0];

export function joinSecond(s, m, gid) {
  if (join2Issues(s, m, gid).length) return false;
  const g = guildDef(gid), blood = bloodline(s, m, gid);
  s.res.coin -= join2Fee(s, m, gid);
  m.guild2 = { id: gid, rank: 0, rep: 0 };
  m.class2 = g.grantsClass;
  m.cls2Hist = [];
  const st = blood && bloodStart(m, gid);
  if (st) {
    m.cls2Hist.push(m.class2);
    m.class2 = st.id;
    m.guild2.rank = tierRank(st);
  }
  log(s, `${g.icon} ${m.name} joined the ${g.name} as a second guild: ${findId(D.classes, m.class2).name}${blood ? " (bloodline: no fee" + (st ? ", starts at tier 2" : "") + ")" : ""}.`);
  s.deeds.push(`${m.name} joined the ${g.name} as a second guild.`);
  return true;
}

// rank ups in the second guild: capped at the tier-2 rank; Journeyman needs repShare of the rep
export const rep2Need = n => Math.ceil(n.rep * (SG().repShare ?? 1));
export function rank2Issue(s, m) {
  const g = m.guild2, n = g && D.guilds.ranks[g.rank + 1];
  if (!g) return "no second guild";
  if (!n || g.rank + 1 > capRank()) return "second guild capped at tier 2";
  if (g.rep < rep2Need(n)) return `${n.name} (second guild): rep ${g.rep}/${rep2Need(n)}`;
  if (s.res.coin < n.cost) return `${n.cost} coin`;
  return null;
}
export function rankUp2(s, m) {
  if (rank2Issue(s, m)) return false;
  const n = D.guilds.ranks[m.guild2.rank + 1];
  s.res.coin -= n.cost;
  m.guild2.rank++;
  log(s, `🎖️ ${m.name} rose to ${n.name} of the ${guildDef(m.guild2.id).name} (second guild).`);
  return true;
}

// class moves in the second guild (up to the cap tier)
export function class2Issues(s, m, c, money = true) {
  if (!m.class2) return ["join a second guild first"];
  if ((c.tier || 0) > capTier()) return ["second guild capped at tier 2"];
  return classIssues(s, view2(m), c, money);
}
export function evolve2(s, m, cid) {
  const c = findId(D.classes, cid);
  if (!c || class2Issues(s, m, c).length) return false;
  const v = view2(m), kind = moveKind(v, c);
  s.res.coin -= moveCost(v, c);
  (m.cls2Hist || (m.cls2Hist = [])).includes(m.class2) || m.cls2Hist.push(m.class2);
  if (kind === "side") m.side2Day = s.day;
  m.class2 = cid;
  log(s, `🌟 ${m.name} became a ${c.name} (second class).`);
  s.deeds.push(`${m.name} became a ${c.name} (second class).`);
  return true;
}
export const nearest2 = (s, m, n) => (m.class2 ? nearestClasses(s, view2(m), n).filter(x => (x.c.tier || 0) <= capTier()) : []);

// one "why it's stuck" line for the second guild
export function stuck2(s, m) {
  if (!SG()) return null;
  if (!m.guild2) {
    if (!secondVia(m)) return "Second guild: reach tier 3, or Master in a trade.";
    const p = pick2(s, m);
    return p ? `Second guild: ${guildDef(p.gid).name} (${p.why})${join2Issues(s, m, p.gid).length ? " · " + join2Issues(s, m, p.gid).slice(0, 2).join(" · ") : ""}` : null;
  }
  const ri = rank2Issue(s, m);
  if (ri && !/coin$/.test(ri) && ri !== "second guild capped at tier 2") return ri;
  const x = nearest2(s, m, 1)[0];
  if (x && x.miss.length) return `${x.c.name} (second guild): ${x.miss.slice(0, 2).join(" · ")}`;
  if ((cls2(m) || {}).tier >= capTier()) return "second guild capped at tier 2";
  return null;
}

// Auto's pick: a role the family lacks, then a bloodline guild, then the guild that fits the trade; skill fit breaks ties
export function pick2(s, m) {
  if (m.pref2 && guildDef(m.pref2)) return { gid: m.pref2, why: "your choice" };
  const have = new Set(living(s).flatMap(x => [x.guild && x.guild.id, x.guild2 && x.guild2.id]).filter(Boolean));
  const trade = m.secondGuild && m.secondGuild.via === "craft" && (SG().tradeGuild || {})[m.secondGuild.path];
  const tracks = (D.legacy.familyAuto || {}).tracks || {};
  const fit = gid => (tracks[gid] || []).reduce((a, k) => a + ((m.skills[k] || { lvl: 0 }).lvl), 0) / 1000;
  const opts = D.guilds.guilds.filter(g => sworn(g) && !(m.guild && m.guild.id === g.id)).map(g => {
    const lack = !have.has(g.id), blood = bloodline(s, m, g.id), tr = trade === g.id;
    return { gid: g.id, score: (lack ? 4 : 0) + (blood ? 3 : 0) + (tr ? 2 : 0) + fit(g.id), why: lack ? "the family has no " + g.name.replace(/ \(.*\)/, "") : blood ? "bloodline" : tr ? "fits their trade" : "best skill fit" };
  });
  // guilds they can join now (coin aside) come first, so Auto never waits on a skill they don't train
  // then guilds whose missing needs are all skills they can train (Auto drills them); a gated skill (e.g. masonry
  // needs the Crafters' Guild) or a stat need pushes that guild back
  const g = id => guildDef(id);
  const ready = o => !join2Issues(s, m, o.gid).filter(t => !/coin$/.test(t)).length;
  const drillable = o => Object.entries(g(o.gid).req.stats || {}).every(([k, v]) => statVal(m, k) >= v) && Object.entries(g(o.gid).req.skills || {}).every(([k, v]) => (m.skills[k] || { lvl: 0 }).lvl >= v || canTrain(m, k, s));
  return opts.sort((a, b) => ready(b) - ready(a) || drillable(b) - drillable(a) || b.score - a.score)[0] || null;
}
export const class2Guild = m => (m.class2 ? classGuild(m.class2) : null);

// skill to drill toward Auto's second-guild pick when it can't be joined yet (drillSkill alternates with the class step)
export function joinDrill(s, m) {
  if (!SG() || m.guild2 || !secondVia(m)) return null;
  const p = pick2(s, m), g = p && guildDef(p.gid);
  if (!g) return null;
  const need = Object.entries(g.req.skills || {}).filter(([k, v]) => (m.skills[k] || { lvl: 0 }).lvl < v && canTrain(m, k, s)).sort((a, b) => m.skills[a[0]].lvl / a[1] - m.skills[b[0]].lvl / b[1]);
  return need.length ? need[0][0] : null;
}
