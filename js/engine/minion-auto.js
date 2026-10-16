// Auto Ascend + Auto Recruit (Automation tab).
// Titles of tier 2+ have limited slots (minions.autoAscend.slots). When a slot is open, the follower one title below
// that is closest to qualifying (min of level and key-job skill progress) trains in the title's key job and evolves
// automatically once it qualifies. Its own title slot then opens and the next one down follows (cascade).
// Peasants aim for a tier-1 title in branch priority order. Auto Recruit hires the cheapest follower once a month.
import { evolveMinion, hire, hireable, keyJobs, minionEvolveIssue, minionLvl, minionSkillLvl, mtype, npcClass, titleSkill } from "./minions.js";
import { established, jobCap } from "./estate.js";
import { minionRoom } from "./minion-housing.js";
import { townKnown } from "./map.js";
import { D, log } from "./state.js";

const AA = () => D.minions.autoAscend;
const off = s => s.autoOff || (s.autoOff = {});
export const ascendOn = s => !off(s).ascend;
export const titleOn = (s, cid) => !off(s)["asc_" + cid];
export const recruitOn = s => !!(s.autoOn || {}).recruit;
export const ascPriority = s => s.ascPrio || AA().priority;
export function toggleRecruit(s) {
  s.autoOn = s.autoOn || {};
  s.autoOn.recruit = !s.autoOn.recruit;
}
// move a branch one step up the tier-1 priority list
export function raiseBranch(s, b) {
  const p = [...ascPriority(s)],
    i = p.indexOf(b);
  if (i > 0) [p[i - 1], p[i]] = [p[i], p[i - 1]];
  s.ascPrio = p;
}
export const toggleKeepJob = mi => (mi.keepJob = !mi.keepJob);
export const titleSlots = c => (c.needs && AA().slots[c.needs.tier]) || Infinity;

const pool = s => (s.minions || []).filter(mi => !mi.special && !mi.keepJob);
// building requirement met? (a would-be follower with any level/skill)
const buildingOk = (s, c) => !minionEvolveIssue(s, { cls: c.from, lvl: 99, skills: Object.fromEntries(keyJobs(c).map(j => [j, 1e9])) }, c.id);
export const score = (mi, c) =>
  Math.min(minionLvl(mi) / c.lvl, titleSkill(c) ? minionSkillLvl(mi, keyJobs(c)[0]) / titleSkill(c) : 1);

// put a trainee in the title's key job (next-best bonus job if it can't); swap with the weakest worker if full
function train(s, mi, c) {
  for (const j of keyJobs(c)) {
    if (mi.job === j) return;
    if (!jobCap(s, j)) continue;
    const there = s.minions.filter(x => x.job === j && x !== mi);
    if (there.length < jobCap(s, j)) return void (mi.job = j);
    const w = there.filter(x => !x.trainFor && !x.keepJob && !x.special).sort((a, b) => minionLvl(a) - minionLvl(b))[0];
    if (w) return void ([w.job, mi.job] = [mi.job, j]);
  }
}
function start(s, mi, c) {
  mi.trainFor = c.id;
  train(s, mi, c);
  log(s, `🎓 ${mi.name} began training to become a ${c.name}.`);
}

export function autoAscendDay(s) {
  if (!ascendOn(s) || !(s.minions || []).length || !established(s)) return;
  const P = pool(s),
    titles = (D.minions.npcClasses || []).filter(c => c.from && titleOn(s, c.id));
  // trainees: evolve when qualified; drop stale targets; keep them in the key job
  for (const mi of P.filter(x => x.trainFor)) {
    const c = npcClass(mi.trainFor);
    if (!c || c.from !== (mi.cls || "n_peasant") || !titleOn(s, c.id)) delete mi.trainFor;
    else if (!minionEvolveIssue(s, mi, c.id)) delete mi.trainFor, evolveMinion(s, mi.uid, c.id);
    else if (s.day % 10 === 0) train(s, mi, c);
  }
  // limited titles, top tier first so the cascade runs downward the same day
  for (const c of titles.filter(c => titleSlots(c) < Infinity && buildingOk(s, c)).sort((a, b) => b.needs.tier - a.needs.tier)) {
    let used = P.filter(x => (x.cls === c.id && !x.trainFor) || x.trainFor === c.id).length;
    while (used < titleSlots(c)) {
      const mi = P.filter(x => (x.cls || "n_peasant") === c.from && !x.trainFor).sort((a, b) => score(b, c) - score(a, c) || b.loyalty - a.loyalty || a.since - b.since)[0];
      if (!mi) break;
      start(s, mi, c);
      used++;
    }
  }
  // peasants → a tier-1 title by branch priority
  const t1 = ascPriority(s).flatMap(b => titles.filter(c => c.branch === b && titleSlots(c) === Infinity && c.from === "n_peasant" && buildingOk(s, c)));
  if (t1.length) for (const mi of P.filter(x => (x.cls || "n_peasant") === "n_peasant" && !x.trainFor)) start(s, mi, t1[0]);
}

// Auto Recruit: monthly, cheapest follower in a known town, when a bunk is free and coin covers hire + wages + reserve
export function autoRecruitDay(s) {
  if (!recruitOn(s) || s.day % 30 !== 0 || !minionRoom(s)) return;
  const wages = (s.minions || []).reduce((a, x) => a + mtype(x.type).wage, 0);
  const pick = D.towns
    .filter(t => townKnown(s, t))
    .flatMap(t => hireable(s, t.id).map(x => ({ t, x })))
    .sort((a, b) => a.x.hire + a.x.wage - b.x.hire - b.x.wage)[0];
  if (!pick || (s.res.coin || 0) < pick.x.hire + (wages + pick.x.wage) * AA().recruitMonths + (s.recruitReserve ?? AA().recruitReserve)) return;
  const mi = hire(s, pick.t.id, pick.x.id);
  if (mi) log(s, `📯 Auto Recruit hired ${mi.name} the ${pick.x.name} in ${pick.t.name}.`);
}
