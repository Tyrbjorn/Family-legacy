import { choreOpen, choreActive } from "./chores.js";
import { apprOpens, inhXp, leanXp } from "./apprentice.js";
import { injuryXp } from "./injuries.js";
import { toolIssue } from "./requests.js";
import { diffXp } from "./difficulty.js";
import { gearFx } from "./gear.js";
import { famFx, pathReqOk, pathXp, setPathInLine } from "./paths.js";
import { household } from "./courtship.js";
import { isFed, moraleXp, starving, stockValue, tonicXp } from "./food.js";
import { traitSkillXp } from "./traits.js";
import { buffSum } from "./encounters.js";
import { LG, addMemberRenown, legacyTier } from "./legacy.js";
import { ES, eff, hasPiece, structDef, upgMult } from "./estate.js";
import { level, traitSum } from "./family.js";
import { cls, guildDef, guildsOf, memberGuild } from "./guilds.js";
import { itemDef } from "./inventory.js";
import { minionPower } from "./minions.js";
import { D, STATS, T, ageY, bl, furn, isAdult, log, r, xpNeed } from "./state.js";

export function softCap(m) {
  const c = cls(m);
  return T.softCap[c ? c.tier : 0];
}

export function xpMult(s, m, skillId) {
  const sk = D.skills.find(x => x.id === skillId);
  let mult = 1;
  mult += traitSum(m, "xp");
  mult += gearFx(m.equip).xpPct || 0;
  mult += buffSum(s, "xp");
  mult += traitSkillXp(m, skillId);
  mult += leanXp(m, skillId) + inhXp(m, skillId) + (m.appr && legacyTier(s, "fa_kids") >= 2 && leanXp(m, skillId) ? 0.05 : 0); // R37 Family Tutor tier 2: lean +15% while apprenticed // R35 leans + inherited skill boost (under 18)
  if (isFed(s) && s.res.food + stockValue(s) > 0) mult += eff(s, "foodQuality");
  mult += moraleXp(s) + tonicXp(s, sk.family);
  if (!isAdult(m)) mult += household(s, "childXp");
  mult += eff(s, "blessing") + famFx(s, "trainXp") + famFx(s, "blessing");
  for (const st of s.structures || []) {
    const d = structDef(st.type);
    if (d.guildBoost && (d.guildBoost.guild === "adventurers" ? !!m.adv : memberGuild(m, d.guildBoost.guild)))
      mult += d.guildBoost.xp * (1 + upgMult(st));
    if (d.skillBoost && d.skillBoost.skills.includes(skillId)) mult += d.skillBoost.xp * (1 + upgMult(st));
  }
  if (["lore", "magic"].includes(sk.family)) mult += m.skills.reading.lvl * 0.01 + bl(s, "library") * 0.02;
  for (const f of furn(s)) {
    if (f.bonus.skill === skillId) mult += f.bonus.xp;
    if (f.bonus.family === sk.family) mult += f.bonus.xp;
  }
  if (ageY(m) >= 50) mult += 0.1;
  if (starving(s)) mult *= ES().meals.starvingXp;
  for (const mg of guildsOf(m)) {
    const g = guildDef(mg.id);
    if (g.skills.includes(skillId)) mult += 0.05 * (mg.rank + 1);
  }
  mult += Math.min(0.2, minionPower(s, "tutor") * 0.05);
  return mult;
}

export function gainXp(s, m, skillId, amt) {
  const k = m.skills[skillId];
  if (!k) return;
  if (!skillOpen(m, skillId)) return;
  amt *= diffXp(s, m) * injuryXp(m, skillId);
  if (k.lvl >= softCap(m)) amt *= 0.1;
  const gained = amt * xpMult(s, m, skillId);
  k.xp += gained;
  pathXp(s, m, skillId, gained);
  while (k.xp >= xpNeed(k.lvl)) {
    k.xp -= xpNeed(k.lvl);
    k.lvl++;
    addMemberRenown(m, LG().renown.perSkillLevel || 0);
    if (k.lvl % 10 === 0) log(s, `⭐ ${m.name} reached ${D.skills.find(x => x.id === skillId).name} ${k.lvl}.`);
    const before = level(m);
    if (level(m) > before) {
    }
  }
  // stat point per level: auto-allocate to class stats
  const L = level(m);
  m._lv = m._lv || 1;
  while (m._lv < L) {
    m._lv++;
    const c = cls(m);
    const st = c ? r(c.stats) : r(STATS);
    m.stats[st] += 1;
  }
}

export function trainIssue(m, skillId, s) {
  const sk = D.skills.find(x => x.id === skillId);
  if (!sk) return "unknown";
  const a = ageY(m);
  if (sk.guild && !memberGuild(m, sk.guild)) return "guild";
  if (sk.unlockQuest && s && !(s.unlocks || []).includes("skill:" + skillId)) return "quest";
  if (a < 12) return "age12";
  if (sk.family === "magic" && a < 14) return "age14";
  return null;
}

export function canTrain(m, skillId, s, ignoreAge) {
  const i = trainIssue(m, skillId, s);
  return !i || (ignoreAge && i.startsWith("age"));
}

export const jobOk = (m, j) => ageY(m) >= j.minAge;

export const clsLine = id => {
  const out = [];
  let c = id && D.classes.find(x => x.id === id);
  while (c && !out.includes(c.id)) {
    out.push(c.id);
    c = c.from && D.classes.find(x => x.id === c.from);
  }
  return out;
};

export const inLine = (m, cid) => [m.cls, m.prof].some(x => x && clsLine(x).includes(cid)) || pathReqOk(m, cid);

export const ownsItem = (s, m, id) =>
  (s.vault || []).some(x => x === id || String(x).endsWith(id)) ||
  (m.bag || []).includes(id) ||
  Object.values(m.equip || {}).includes(id);

export function srcOk(s, m, u, ac) {
  if (u.cls) return inLine(m, u.cls);
  if (u.piece) return hasPiece(s, u.piece);
  if (u.item) return ownsItem(s, m, u.item);
  if (u.guild) {
    const g = memberGuild(m, u.guild);
    return !!g && (g.rank || 0) >= (u.rank || 0);
  }
  if (u.quest) return (s.unlocks || []).includes("activity:" + ac.id) || (s.doneQuests || []).includes(u.quest);
  if (u.building) return bl(s, u.building) > 0;
  if (u.fields) return ((s.fields || {}).list || []).length > 0; // R40
  if (u.chore === true) return choreOpen(s, ac); // R42 chore tiers
  if (u.chore) return choreActive(s, u.chore); // R42: a chore worked today boosts this task
  if (u.tut) return !!(s.tut && ((s.tut.done || []).includes(u.tut) || s.tut.skipped || !s.tut.started || (D.tutorial && s.tut.step > D.tutorial.steps.findIndex(x => x.id === u.tut))));
  return true;
}

export function srcText(u) {
  if (u.cls) return (D.classes.find(c => c.id === u.cls) || {}).name + " line";
  if (u.piece) return (ES().pieces.find(p => p.id === u.piece) || {}).name || u.piece;
  if (u.item) return (itemDef(u.item) || {}).name || u.item;
  if (u.guild) return ((guildDef(u.guild) || {}).name || u.guild) + (u.rank || 0 ? " rank " + ((u.rank || 0) + 1) : "");
  if (u.quest) return "quest “" + ((D.quests.find(q => q.id === u.quest) || {}).name || u.quest) + "”";
  if (u.tut) return "tutorial: " + ((D.tutorial?.steps.find(x => x.id === u.tut) || {}).title || u.tut);
  if (u.fields) return "a field (Estate → Farmstead)";
  if (u.chore === true) return "it opens as you grow";
  if (u.chore) return ((D.activities.find(a => a.id === u.chore) || {}).name || u.chore) + " worked today";
  if (u.building) return "build " + ((D.buildings.find(b => b.id === u.building) || {}).name || u.building);
  return "";
}

export const activityReq = ac => (!ac.unlock ? "" : "Requires: " + [].concat(ac.unlock).map(srcText).join(" or "));

export function skillOpen(m, skillId) {
  const x = (D.skills.find(k => k.id === skillId) || {}).exclusive;
  if (!x) return true;
  if (apprOpens(m, skillId)) return true; // R35: the master's skills while apprenticed
  return x.guilds.some(g => memberGuild(m, g) || (g === "adventurers" && m.adv)) || x.classes.some(c => inLine(m, c));
}

export function themedFor(s, m, skillId) {
  const ok = D.activities.filter(ac => ac.skills.includes(skillId) && activityOk(s, m, ac));
  return ok.length ? ok[ok.length - 1].id : null;
}

export function activityOk(s, m, ac) {
  const a = ageY(m);
  if (a < ac.minAge || (ac.maxAge && a > ac.maxAge)) return false;
  if (ac.tool && toolIssue(s, ac)) return false;
  const u = ac.unlock;
  if (!u) return true;
  if (Array.isArray(u)) return u.some(x => srcOk(s, m, x, ac));
  return srcOk(s, m, u, ac);
  if (u.guild) {
    const g = memberGuild(m, u.guild);
    return !!g && (g.rank || 0) >= (u.rank || 0);
  }
  if (u.quest) return (s.unlocks || []).includes("activity:" + ac.id);
  if (u.building) return bl(s, u.building) > 0;
  return true;
}

export const ACT_TIERS = { basic: 1, advanced: 2, master: 3 };

export const activityGains = ac => ({ stats: Object.entries(ac.stats), skills: ac.skills });

setPathInLine(inLine);
