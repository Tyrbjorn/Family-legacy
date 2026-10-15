// Followers core: types, levels, evolution, hiring and jobs. Housing, the daily job loop and special minions/gear
// live in minion-housing.js, minion-jobs.js and minion-special.js (re-exported here).
import { onMinionEvolve, onMinionLevel } from "./minionups.js";
import { eff, established, jobCap, structDef } from "./estate.js";
import { structReqOk, structReqText } from "./guilds.js";
import { D, known, log, r } from "./state.js";
import { isHoused, minionRoom } from "./minion-housing.js";
import { minionGearMult } from "./minion-special.js";

export const mtype = id => D.minions.types.find(t => t.id === id);

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
    (job === "guard" ? 1 + eff(s, "guardPower") : 1) *
    (s.minions || [])
      .filter(x => x.job === job)
      .reduce((a, x) => a + (mtype(x.type).apt[job] || 1) * minionGearMult(x, job) * minionLvlMult(x, job), 0)
  );
}

export function addMinion(s, type, why) {
  if (!mtype(type).special && !minionRoom(s)) {
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

export function hire(s, townId, type) {
  const t = mtype(type);
  if (!(D.minions.hireAt[townId] || []).includes(type) || s.res.coin < t.hire || !minionRoom(s)) return null;
  s.res.coin -= t.hire;
  return addMinion(s, type, "hired in town");
}

export function jobOpen(s, jobId) {
  const j = D.minions.jobs.find(x => x.id === jobId);
  return !!j && (jobId === "idle" || (established(s) && jobCap(s, jobId) > 0));
}

export function setMinionNode(s, uid, nodeId) {
  const mi = s.minions.find(x => x.uid === uid),
    n = D.nodes.find(x => x.id === nodeId);
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

export const monthlyWages = s => s.minions.reduce((a, x) => a + mtype(x.type).wage, 0);

// Per-job daily output: (s, mi, a = output multiplier, rg = resource gain bonus)
export * from "./minion-housing.js";
export * from "./minion-jobs.js";
export * from "./minion-special.js";
