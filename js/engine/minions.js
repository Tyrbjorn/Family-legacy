import { chariotMult } from "./dwarves.js";
import { houseDef, tierOf } from "./houses.js";
import { findId } from "./lookup.js";
// Followers core: types, levels, evolution, hiring and jobs. Housing, the daily job loop and special minions/gear
// live in minion-housing.js, minion-jobs.js and minion-special.js (re-exported here).
import { onMinionEvolve, onMinionLevel } from "./minionups.js";
import { eff, established, jobCap, structDef } from "./estate.js";
import { structReqOk, structReqText } from "./guilds.js";
import { D, known, log, r } from "./state.js";
import { isHoused, minionRoom } from "./minion-housing.js";
import { unionHireFee, unionHireTypes } from "./union.js";
import { minionGearMult } from "./minion-special.js";

export const mtype = id => findId(D.minions.types, id);

export const MLV = () => D.minions.leveling;

export const minionLvl = mi => mi.lvl || 1;

export const minionXpNeed = lv => Math.round(MLV().xpBase * Math.pow(lv, MLV().xpGrowth));

export function minionPerks(mi, job = mi.job) {
  const p = (D.minions.perks || {})[job] || {};
  return Object.entries(p)
    .filter(([l]) => minionLvl(mi) >= +l)
    .map(([l, t]) => ({ lvl: +l, text: t }));
}

export const npcClass = id => (D.minions.npcClasses || []).find(c => c.id === id);

export const minionSkillLvl = (mi, job = mi.job) => Math.floor(Math.sqrt(((mi.skills || {})[job] || 0) / 4));

export const minionLvlMult = (mi, job = mi.job) =>
  (1 + MLV().aptPerLvl * (minionLvl(mi) - 1)) *
  (1 + minionPerks(mi, job).length * 0.1) *
  (1 + ((npcClass(mi.cls) || { bonus: {} }).bonus[job] || 0)) *
  (1 + 0.02 * minionSkillLvl(mi, job)) *
  (mi.home ? 1.15 : 1);

// a title's key job (its biggest job bonus) and the key-job skill it needs (minions.autoAscend.skillByTier)
export const keyJobs = c => Object.entries(c.bonus || {}).sort((a, b) => b[1] - a[1]).map(x => x[0]);
export const keyJob = c => keyJobs(c)[0];
export const titleSkill = c => (c.needs && (D.minions.autoAscend || {}).skillByTier?.[c.needs.tier]) || 0;

export const evolveOptions = mi =>
  mi.special ? [] : (D.minions.npcClasses || []).filter(c => c.from === (mi.cls || "n_peasant"));

export function minionEvolveIssue(s, mi, cid) {
  const c = npcClass(cid);
  if (!c || mi.special) return "not possible";
  if (c.from !== (mi.cls || "n_peasant")) return "wrong path";
  if (minionLvl(mi) < c.lvl) return "Lv " + c.lvl;
  const nd = c.needs;
  if (nd && nd.all && !structReqOk(s, nd.all)) return "needs " + structReqText(nd.all);
  if (
    nd &&
    nd.buildings.length &&
    !(s.structures || []).some(
      st => nd.buildings.includes(st.type) && (st.up || 0) >= nd.up && (!nd.spec || st.spec === nd.spec),
    )
  )
    return (
      "needs " +
      (nd.spec
        ? structDef(nd.buildings[0]).specs.find(x => x.id === nd.spec).name + " specialty"
        : nd.buildings.map(id => structDef(id).name).join(" or ") + (nd.up ? " (upgrade " + nd.up + ")" : ""))
    );
  const kj = keyJob(c), sk = titleSkill(c);
  if (sk && minionSkillLvl(mi, kj) < sk) return `${kj} skill ${sk}`;
  return null;
}

export function evolveMinion(s, uid, cid) {
  const mi = s.minions.find(x => x.uid === uid);
  if (!mi || minionEvolveIssue(s, mi, cid)) return false;
  mi.cls = cid;
  log(s, `🌟 ${mi.name} became a ${npcClass(cid).name}.`);
  onMinionEvolve(s, mi, npcClass(cid).name);
  return true;
}

export function minionGainXp(s, mi, n) {
  if (!mi.job || mi.job === "idle") return;
  mi.skills = mi.skills || {};
  mi.skills[mi.job] = (mi.skills[mi.job] || 0) + n;
  mi.xp = (mi.xp || 0) + n;
  mi.lvl = mi.lvl || 1;
  while (mi.lvl < MLV().maxLvl && mi.xp >= minionXpNeed(mi.lvl)) {
    mi.xp -= minionXpNeed(mi.lvl);
    mi.lvl++;
    log(
      s,
      `⬆️ ${mi.name} reached level ${mi.lvl}${minionPerks(mi).find(p => p.lvl === mi.lvl) ? " – perk: " + minionPerks(mi).find(p => p.lvl === mi.lvl).text : ""}.`,
    );
    onMinionLevel(s, mi);
  }
}

export function minionPower(s, job) {
  return (
    (job === "guard" ? 1 + eff(s, "guardPower") : 1) * chariotMult(s, job) * // R56 War-Chariot
    (s.minions || [])
      .filter(x => x.job === job)
      .reduce((a, x) => a + (mtype(x.type).apt[job] || 1) * minionGearMult(x, job) * minionLvlMult(x, job), 0)
  );
}

export function addMinion(s, type, why) {
  if (!mtype(type).special && !minionRoom(s, type)) {
    log(s, `🚪 No room or no bunk for a new follower (${why}).`);
    return null;
  }
  const t = mtype(type);
  const mi = {
    uid: "mi" + s.nextId++,
    type,
    equip: {},
    name: t.special ? t.name : r(D.minions.names),
    job: "idle",
    loyalty: 100,
    since: s.day,
  };
  if (t.special) {
    mi.special = true;
    mi.source = why;
  } else mi.cls = "n_peasant";
  s.minions.push(mi);
  log(s, `🤝 ${mi.name} the ${t.name} joined (${why}).`);
  return mi;
}

export const hireable = (s, townId) => (D.minions.hireAt[townId] || []).map(mtype);

// R52 dwarf retainers: a type with `house` + `tier` needs that standing (Clan Ironbrow Neutral / Friendly)
const TIER_RANK = ["feud", "rival", "cold", "neutral", "friendly", "allied"];
export const hireLock = (s, t) => (t && t.house && t.tier && TIER_RANK.indexOf(tierOf(s, t.house)) < TIER_RANK.indexOf(t.tier) ? `needs ${(houseDef(t.house) || {}).name || t.house} ${t.tier}` : null);
export function hire(s, townId, type) {
  const t = mtype(type);
  if (!(D.minions.hireAt[townId] || []).includes(type) || s.res.coin < t.hire || !minionRoom(s, type) || hireLock(s, t)) return null;
  s.res.coin -= t.hire;
  return addMinion(s, type, "hired in town");
}

// R75 Union Hall: easy hiring, no trip to town, at a discount (hall owned, types from data/fields.json union.hire)
export const hallHireFee = type => unionHireFee(mtype(type).hire);
export const hallHireIssue = (s, type) => {
  if (!unionHireTypes(s).includes(type)) return unionHireTypes(s).length ? "not hired here" : "needs a Union Hall";
  const t = mtype(type);
  return s.res.coin < hallHireFee(type) ? "cannot afford" : !minionRoom(s, type) ? "no room" : hireLock(s, t);
};
export function hireAtHall(s, type) {
  if (hallHireIssue(s, type)) return null;
  s.res.coin -= hallHireFee(type);
  return addMinion(s, type, "hired at the Union Hall");
}

export function jobOpen(s, jobId) {
  const j = findId(D.minions.jobs, jobId);
  return !!j && (jobId === "idle" || (established(s) && jobCap(s, jobId) > 0));
}

export function setMinionNode(s, uid, nodeId) {
  const mi = s.minions.find(x => x.uid === uid),
    n = findId(D.nodes, nodeId);
  if (!mi || !n || !known(s, n)) return false;
  mi.node = nodeId;
  mi.trip = null;
  return true;
}
export const jobUsed = (s, job, except) => s.minions.filter(x => x.job === job && x.uid !== except).length;

export function assignMinion(s, uid, job) {
  const mi = s.minions.find(x => x.uid === uid);
  if (!mi || !jobOpen(s, job) || (job !== "idle" && !isHoused(s, mi)) || jobUsed(s, job, uid) >= jobCap(s, job))
    return false;
  mi.job = job;
  return true;
}

export function dismiss(s, uid) {
  const i = s.minions.findIndex(x => x.uid === uid);
  if (i < 0) return false;
  for (const id of Object.values(s.minions[i].equip || {})) s.vault.push(id);
  log(s, `👋 ${s.minions[i].name} was dismissed.`);
  s.minions.splice(i, 1);
  return true;
}

// wages scale with the title tier and the key-job skill (endgame.wages): skilled titled staff are a coin sink
export const titleTier = mi => (mi.cls && mi.cls !== "n_peasant" ? ((npcClass(mi.cls) || {}).needs || {}).tier || 1 : 0);
export function wageOf(mi) {
  const W = (D.endgame || {}).wages, base = mtype(mi.type).wage;
  if (!W || mi.special) return base;
  return Math.round(base * W.tierMult[Math.min(titleTier(mi), W.tierMult.length - 1)] * (1 + W.perSkill * minionSkillLvl(mi)));
}
export const monthlyWages = s => s.minions.reduce((a, x) => a + wageOf(x), 0);

// Per-job daily output: (s, mi, a = output multiplier, rg = resource gain bonus)
export * from "./minion-housing.js";
export * from "./minion-jobs.js";
export * from "./minion-special.js";
