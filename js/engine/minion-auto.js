// Auto Ascend + Auto Recruit (Automation tab).
// Titles of tier 2+ have limited slots (minions.autoAscend.slots). When a slot is open, the follower one title below
// that is closest to qualifying (min of level and key-job skill progress) trains in the title's key job and evolves
// automatically once it qualifies. Its own title slot then opens and the next one down follows (cascade).
// Peasants aim for a tier-1 title in branch priority order. Auto Recruit hires the cheapest follower once a month.
import { evolveMinion, hire, hireable, keyJobs, minionEvolveIssue, minionLvl, minionSkillLvl, monthlyWages, npcClass, titleSkill } from "./minions.js";
import { established, jobCap } from "./estate.js";
import { minionRoom } from "./minion-housing.js";
import { townKnown } from "./map.js";
import { D, log, rng } from "./state.js";

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
  // peasants spread over every open tier-1 title: the title with the fewest holders takes its closest-qualifying
  // peasant next; the branch priority only breaks ties
  const t1 = ascPriority(s).flatMap(b => titles.filter(c => c.branch === b && titleSlots(c) === Infinity && c.from === "n_peasant" && buildingOk(s, c)));
  const held = c => P.filter(x => x.cls === c.id || x.trainFor === c.id).length;
  let free = P.filter(x => (x.cls || "n_peasant") === "n_peasant" && !x.trainFor);
  while (t1.length && free.length) {
    const c = t1.reduce((a, b) => (held(b) < held(a) ? b : a));
    const mi = free.sort((a, b) => score(b, c) - score(a, c) || a.since - b.since)[0];
    start(s, mi, c);
    free = free.filter(x => x !== mi);
  }
}

// Auto Recruit modes: cheapest; best fit (best aptitude for jobs with open spots); strongest (best aptitude
// overall); balanced (aptitude per coin)
export const RECRUIT_MODES = [
  { id: "cheap", name: "Cheapest" },
  { id: "fit", name: "Best fit" },
  { id: "strong", name: "Strongest" },
  { id: "balanced", name: "Balanced" },
];
export const recruitMode = s => s.recruitMode || "cheap";
export function setRecruitMode(s, id) {
  if (!RECRUIT_MODES.some(x => x.id === id)) return false;
  s.recruitMode = id;
  return true;
}
const aptMax = x => Math.max(1, ...Object.values(x.apt || {}));
const fitOf = (s, x) => {
  const open = Object.entries(x.apt || {}).filter(([j]) => jobCap(s, j) > (s.minions || []).filter(mi => mi.job === j).length);
  return open.length ? Math.max(...open.map(([, v]) => v)) : 0;
};
export const recruitValue = (s, x, mode = recruitMode(s)) =>
  mode === "fit" ? fitOf(s, x) : mode === "strong" ? aptMax(x) : mode === "balanced" ? aptMax(x) / (x.hire + x.wage * 3 + 1) : -(x.hire + x.wage);

// monthly (or right after a follower dies of age), when a bunk is free and coin covers hire + wages + reserve
export function autoRecruitDay(s) {
  if (!recruitOn(s) || (s.day % 30 !== 0 && !s.recruitNow) || !minionRoom(s)) return;
  delete s.recruitNow;
  const wages = monthlyWages(s);
  const pick = D.towns
    .filter(t => townKnown(s, t))
    .flatMap(t => hireable(s, t.id).map(x => ({ t, x })))
    .sort((a, b) => recruitValue(s, b.x) - recruitValue(s, a.x) || a.x.hire + a.x.wage - b.x.hire - b.x.wage)[0];
  if (!pick || (s.res.coin || 0) < pick.x.hire + (wages + pick.x.wage) * AA().recruitMonths + (s.recruitReserve ?? AA().recruitReserve)) return;
  const mi = hire(s, pick.t.id, pick.x.id);
  if (mi) log(s, `📯 Auto Recruit hired ${mi.name} the ${pick.x.name} in ${pick.t.name}.`);
}

// Minion aging (minions.aging): followers age a month every 30 days; past their span they may die of old age.
// Auto Recruit then looks for a replacement the next day.
const AG = () => D.minions.aging;
export const minionAge = mi => Math.floor(mi.age || 0);
export function minionAgeDay(s) {
  if (!AG() || s.day % 30 !== 0) return;
  for (const mi of [...(s.minions || [])]) {
    if (mi.special) continue;
    if (mi.age == null) mi.age = AG().hireAge[0] + rng() * (AG().hireAge[1] - AG().hireAge[0]);
    mi.age += 1 / 12;
    const over = mi.age - AG().span;
    if (over >= 0 && rng() < AG().deathPerMonth * (over + 1)) {
      for (const id of Object.values(mi.equip || {})) s.vault.push(id);
      s.minions = s.minions.filter(x => x !== mi);
      log(s, `🕯️ ${mi.name} the follower died of old age (${minionAge(mi)}).`);
      s.recruitNow = true;
    }
  }
}
