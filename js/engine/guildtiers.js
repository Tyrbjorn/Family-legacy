// R46 guild tiers: every guild has 4 tiers; a class on tier N needs any class on tier N-1 of the same guild,
// character Lv, its own skill mix, the tier's guild rank and coin (all data: guilds.json tiers, classes.json).
// Classes keep `from` only as their lineage (talents, line bonuses); it no longer gates advancing.
import { findId } from "./lookup.js";
import { classKeyIssue } from "./r60.js";
import { classGuild, cls, memberGuild, structReqOk, structReqText, rankName } from "./guilds.js";
import { level } from "./family.js";
import { canTrain } from "./skills.js";
import { joinDrill } from "./guild2.js";
import { trackFor } from "./family-auto.js";
import { D, Y, log, living } from "./state.js";

const GT = () => D.guilds.tiers || [];
export const guildTierDef = c => GT()[Math.min(GT().length - 1, Math.max(0, c.tier || 0))] || {};
export const tierN = c => (c.tier || 0) + 1; // shown tiers are 1-4; data tiers are 0-3
export const tierLv = c => c.lv ?? guildTierDef(c).lv ?? 1;
// skill needs scale per tier (guilds.json tiers[].skillScale) so pacing is tuned in one place
export const classReq = c => { const k = guildTierDef(c).skillScale ?? 1; return Object.fromEntries(Object.entries(c.req || {}).map(([sk, v]) => [sk, Math.max(1, Math.round(v * k))])); };
// R47: the Architect combo path (or any c.comboCut) lowers that class's skill needs for its holder
export const reqFor = (m, c) => { const r = classReq(c), k = c.comboCut; if (k && m && (m.paths || []).some(e => e.id === k.path)) for (const sk of Object.keys(r)) r[sk] = Math.max(1, r[sk] - k.by); return r; };
export const tierRank = c => c.guildRank ?? guildTierDef(c).rank ?? 0;
export const guildOfCls = id => { const g = classGuild(id); return g ? g.id || "adventurers" : null; };
const skName = k => (findId(D.skills, k) || {}).name || k;

export const sideCost = c => Math.round((guildTierDef(c).cost || c.cost || 0) * (D.guilds.sidewaysCostShare ?? 0.5));
export const moveKind = (m, c) => { const cur = cls(m); return !cur ? null : c.tier === cur.tier + 1 ? "up" : c.tier === cur.tier && c.id !== cur.id ? "side" : null; };
export const moveCost = (m, c) => (moveKind(m, c) === "side" && c.tier > 0 ? sideCost(c) : c.cost || 0);

// Everything missing for this member to take class c; [] = can take it. `money` false ignores coin (for hints).
export function classIssues(s, m, c, money = true) {
  const out = [], cur = cls(m);
  if (!c || c.retired || c.profession) return ["not a guild class"];
  if (!cur) return ["needs a guild class first"];
  if (guildOfCls(c.id) !== guildOfCls(cur.id)) return ["another guild's class"];
  const k = moveKind(m, c);
  if (!k) return [c.tier <= cur.tier ? "same or lower tier" : `needs a tier ${tierN(c) - 1} class first`];
  if (k === "side" && m.sideDay != null && s.day - m.sideDay < Y()) out.push("sideways change once a year");
  if (c.needsClass && ![m.cls, ...(m.clsHist || [])].some(x => [].concat(c.needsClass).includes(x))) out.push("must be a " + [].concat(c.needsClass).map(x => findId(D.classes, x).name).join(" or "));
  if (level(m) < tierLv(c)) out.push(`Lv ${level(m)}/${tierLv(c)}`);
  const k60 = classKeyIssue(s, c); // R60 light story key (hero, paladin, archmage)
  if (k60) out.push(k60);
  if (c.advRank != null) { if (!m.adv || m.adv.rank < c.advRank) out.push(`needs Adventurers' rank ${"FEDCBAS"[c.advRank] || c.advRank}`); }
  else {
    const g = memberGuild(m, guildOfCls(c.id)), r = tierRank(c);
    if (!g || g.rank < r) { const need = D.guilds.ranks[r], nr = need && (g && g === m.guild2 ? Math.ceil(need.rep * ((D.guilds.second || {}).repShare ?? 1)) : need.rep); out.push(`needs ${rankName(r)} rank${g && need ? ` (rep ${g.rep}/${nr})` : ""}`); } // R47: second guild needs half the rep
  }
  for (const [sk, v] of Object.entries(reqFor(m, c))) if ((m.skills[sk] || { lvl: 0 }).lvl < v) out.push(`${skName(sk)} ${(m.skills[sk] || { lvl: 0 }).lvl}/${v}`);
  if (c.needsQuest && !(s.doneQuests || []).includes(c.needsQuest)) out.push("needs chain quest: " + ((findId(D.quests, c.needsQuest) || {}).name || c.needsQuest));
  if (c.needsVillage && !s.village) out.push("needs the village charter"); // R47 Town Planner
  if (c.needsBuildings && !structReqOk(s, c.needsBuildings)) out.push("needs " + structReqText(c.needsBuildings));
  if (money && s.res.coin < moveCost(m, c)) out.push(`${moveCost(m, c)} coin`);
  return out;
}

// Classes this member could move to (up or sideways) in their guild, nearest first (share of needs met).
export function classMoves(s, m) {
  const cur = cls(m);
  if (!cur) return [];
  return D.classes.filter(c => !c.retired && !c.special && !c.profession && moveKind(m, c) && guildOfCls(c.id) === guildOfCls(cur.id));
}
// "nearest" = average share met over Lv and each skill need (partial credit), other needs count 0 or 1
const progress = (s, m, c, miss) => {
  const parts = [Math.min(1, level(m) / tierLv(c)), ...Object.entries(reqFor(m, c)).map(([k, v]) => Math.min(1, (m.skills[k] || { lvl: 0 }).lvl / v))];
  const other = miss.filter(t => !/^Lv |\d+\/\d+$/.test(t) || /rank/.test(t)).length;
  return (parts.reduce((a, b) => a + b, 0) + 2 - Math.min(2, other)) / (parts.length + 2);
};
export function nearestClasses(s, m, n = D.guilds.hints || 2, upOnly = false) {
  return classMoves(s, m)
    .filter(c => !upOnly || moveKind(m, c) === "up")
    .map(c => ({ c, kind: moveKind(m, c), miss: classIssues(s, m, c) }))
    .filter(x => !x.miss.some(t => /once a year|another guild|tier \d class first|lower tier/.test(t)))
    .map(x => ({ ...x, share: progress(s, m, x.c, x.miss) }))
    .sort((a, b) => b.share - a.share)
    .slice(0, n);
}

// One-line reason for "why it's stuck"
export const classStuck = (s, m) => { const x = nearestClasses(s, m, 1)[0]; return x && x.miss.length ? `${x.c.name}: ${x.miss.slice(0, 2).join(" · ")}` : null; };

// ---- guild quest chains: each step is one data line; finishing it grants its unlocks (recipe:/skill:/activity:)
export const chainOf = gid => (D.guilds.chains || {})[gid] || [];
export const chainStep = qid => { for (const [g, ch] of Object.entries(D.guilds.chains || {})) { const i = ch.findIndex(x => x.quest === qid); if (i >= 0) return { g, i, step: ch[i] }; } return null; };
// unlock keys: recipe: skill: activity: (R46) and piece: structure: upgrade: (R47 Architects' chain)
const UNLOCK_KIND = {
  recipe: id => findId(D.crafting.recipes, id),
  skill: id => findId(D.skills, id),
  activity: id => findId(D.activities, id),
  piece: id => findId(D.estate.pieces, id),
  structure: id => findId(D.estate.structures, id),
  upgrade: id => ({ roadworks: D.world && D.world.roadWorks && { name: "road works" } })[id],
};
export const unlockReal = key => { const [k, id] = String(key).split(":"); return !!(UNLOCK_KIND[k] && UNLOCK_KIND[k](id)); };
export const unlockName = key => { const [k, id] = String(key).split(":"); const d = UNLOCK_KIND[k] && UNLOCK_KIND[k](id); return (d && d.name) || id; };
export function grantUnlock(s, key, why) {
  if (!s.unlocks || s.unlocks.includes(key)) return false;
  s.unlocks.push(key);
  const [k, id] = key.split(":");
  const nm = unlockName(key);
  if (why) log(s, `🔓 ${why} unlocked ${k === "skill" ? "training: " : k === "upgrade" ? "" : k + ": "}${nm || id}!`);
  return true;
}
export function chainDone(s, q) {
  const st = chainStep(q.id);
  if (!st) return;
  for (const u of st.step.unlock || []) grantUnlock(s, u, q.name);
}
export const chainNext = (s, gid) => chainOf(gid).find(x => !(s.doneQuests || []).includes(x.quest));

// ---- class role bonuses (data: classes.json role {buyDisc, reqBonus, sellPct}); best living holder counts
export const roleBonus = (s, key) => {
  let v = 0;
  for (const m of (s && s.members ? living(s) : [])) for (const id of [m.cls, m.class2]) { const r = id && (findId(D.classes, id) || {}).role; if (r && typeof r[key] === "number" && r[key] > v) v = r[key]; } // R47: second class too
  return v;
};

// Skill a member should drill toward their nearest next class (lowest share first), or null.
export function drillSkill(s, m) {
  if (!m.guild && !m.craft) { const g = D.guilds.guilds.find(x => x.id === trackFor(s, m)); const need = g && Object.entries(g.req.skills || {}).filter(([k, v]) => (m.skills[k] || { lvl: 0 }).lvl < v && canTrain(m, k, s)); if (need && need.length) return need[0][0]; } // R47.1: no guild yet: drill the track guild's join skill
  const j = joinDrill(s, m); // R47: the second-guild pick's join skills, every other month (or when no class step is left)
  const x = nearestClasses(s, m, 1, true)[0];
  if (j && (!x || Math.floor((s.day || 0) / 30) % 2 === 0)) return j;
  if (!x) return null;
  const need = Object.entries(reqFor(m, x.c)).filter(([k, v]) => (m.skills[k] || { lvl: 0 }).lvl < v && canTrain(m, k, s)).sort((a, b) => m.skills[a[0]].lvl / a[1] - m.skills[b[0]].lvl / b[1]);
  return need.length ? need[0][0] : null;
}
// Skills a guild's tier-2 classes ask for (Auto Upbringing teaches them on that guild's track)
export const tier2Skills = gid => [...new Set(D.classes.filter(c => c.tier === 1 && !c.retired && !c.profession && guildOfCls(c.id) === gid).flatMap(c => Object.keys(c.req || {})))];

// R46 Auto-Adventure "guild first": the member's own guild's next chain quest they can win, else (while short of
// rep for the next rank) their guild's best quest they can win. ok(q) = can take it and win it (caller decides).
export function guildQuestFor(s, m, ok) {
  return questIn(s, m, m.guild, ok) || questIn(s, m, m.guild2, ok, true); // R47: else the second guild's next step
}
function questIn(s, m, mg, ok, second) {
  const gid = mg && mg.id;
  if (!gid) return null;
  const nx = chainOf(gid).map(x => findId(D.quests, x.quest)).find(q => q && !(s.doneQuests || []).includes(q.id) && ok(q));
  if (nx) return nx;
  const nr = D.guilds.ranks[(mg.rank || 0) + 1];
  if (!nr || (second && (mg.rank || 0) + 1 > (D.guilds.tiers[(D.guilds.second || {}).capTier - 1] || { rank: 1 }).rank)) return null;
  if (mg.rep >= (second ? Math.ceil(nr.rep * (D.guilds.second.repShare ?? 1)) : nr.rep)) return null;
  return D.quests.filter(q => q.guild === gid && !q.once && !q.story && ok(q)).sort((a, b) => b.cp - a.cp)[0] || null;
}
