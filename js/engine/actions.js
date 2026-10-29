import { dwarfCraftMult } from "./dwarves.js";
import { guildQuestFor } from "./guildtiers.js";
import { findId } from "./lookup.js";
import { boardsPick } from "./boards.js";
import { markChore } from "./chores.js";
import { quotaCredit } from "./quotas.js";
import { chalFx, enemyCp, gameFx, stampDiff } from "./difficulty.js";
import { hasFeature, parcelDay } from "./world.js";
import { proposeIssue } from "./family.js";
import { courtMult, noteStage } from "./courtship.js";
import { nextQueued } from "./crafting.js";
import { resGain, legacyValue } from "./legacy.js";
import { cp, level, statVal, traitSum } from "./family.js";
import { bestRecipe, craftItem, recipeDef, recipeIssue, sellTick } from "./inventory.js";
import {
  MP,
  TRAVEL_TYPES,
  areaSecretsLeft,
  distTo,
  exploreIssue,
  explored,
  isBusy,
  newTrip,
  regionOpen,
  travelTick,
} from "./map.js";
import { minionPower } from "./minions.js";
import { dungeonDef, dungeonIssue, questIssue, questRest } from "./quests.js";
import { refineDay, taskYields } from "./requests.js";
import { checkBonus } from "./saltmere.js";
import { landFish } from "./fish.js";
import { exploreDay, travelDays } from "./map.js";
import { activityOk, canTrain, gainXp, jobOk, themedFor } from "./skills.js";
import { D, T, active, ageY, furn, isAdult, known, log } from "./state.js";

import { memberFail } from "./geartypes.js";
export function successChance(s, m, q) {
  const c = cp(s, m);
  const qc = enemyCp(s, m, q.cp);
  const p = Math.max(0.1, Math.min(0.98, 0.5 + (c - qc) / (qc + 20) + Math.min(0.15, minionPower(s, "guard") * 0.03) + chalFx(m, "roll") + checkBonus(m, q) + ((s && s.boons) || []).filter(b => b.type === "questBonus" && b.quest === q.id).reduce((a, b) => a + b.pct, 0))); // R52 Oath of the Thane // R49 skill checks
  // a caster's spells can fail in armor: fights and magic-skill quests lose that share of the odds
  const f = q.cp > 0 || D.gear.kinds.spellFail.magicSkills.includes(q.skill) ? memberFail(m) : 0;
  return f ? Math.max(0.05, p * (1 - f)) : p;
}

// One handler per action type: (s, m, a, eff). Travel types (quest/gather/explore/dungeon) share travelTick.
export const ACTIONS = {
  work(s, m, a, eff) {
    const c =
      (4 + level(m) * 0.5 + m.skills.haggling.lvl * 0.2) *
      eff *
      (1 + traitSum(m, "coin")) *
      (1 + furn(s).reduce((x, f) => x + (f.bonus.coin || 0), 0)) *
      (1 + ((s.lb || {}).coin || 0)); // R60 legacy coin bonus
    s.res.coin += c;
    gainXp(s, m, "haggling", T.xpPerDay * 0.3 * eff);
  },
  craft(s, m, a, eff) {
    if (!a.target && m.craftQueue && m.craftQueue.length) {
      a.target = nextQueued(m);
      a.queued = true;
    }
    const rc = a.target ? recipeDef(a.target) : bestRecipe(s, m);
    if (!rc || recipeIssue(s, m, rc)) {
      if (!a.target) a.progress = 0;
      return;
    }
    a.target = a.target || null;
    a.rc = rc.id;
    (s.atLast = s.atLast || {})["rc:" + rc.skill] = rc.id; // Auto Tend repeats the last recipe of each skill
    a.progress = (a.progress || 0) + eff * (1 + legacyValue(s, "craftspd")) * dwarfCraftMult(s, rc); // R43 Workshop: Craft Speed; R56 dwarf smiths / runewrights
    gainXp(s, m, rc.skill, T.xpPerDay * 0.8 * eff);
    if (a.progress >= rc.days * gameFx(s, "craft", a.diff)) {
      a.progress = 0;
      craftItem(s, m, rc, null);
      if (a.queued) {
        a.target = nextQueued(m);
        a.queued = !!a.target;
      }
    }
  },
  job(s, m, a, eff) {
    const j = findId(D.jobs, a.target);
    if (!j || !jobOk(m, j, s)) {
      m.action = null;
      return;
    }
    s.res.coin += (isAdult(m) ? j.payAdult : j.payChild) * (1 + level(m) * 0.02) * eff * (1 + traitSum(m, "coin")) * (1 + ((s.lb || {}).coin || 0));
    for (const [k, v] of Object.entries(j.stats)) m.stats[k] += v * eff;
    for (const k of j.skills) gainXp(s, m, k, T.xpPerDay * 0.5 * eff);
    if (j.id === "shop") sellTick(s, eff * (1 + m.skills.haggling.lvl * 0.02));
  },
  activity(s, m, a, eff) {
    const ac = findId(D.activities, a.target);
    if (!ac || !activityOk(s, m, ac)) {
      m.action = null;
      return;
    }
    for (const [k, v] of Object.entries(ac.stats)) m.stats[k] += v * eff;
    for (const k of ac.skills) if (canTrain(m, k, s, true)) gainXp(s, m, k, T.xpPerDay * 0.6 * eff);
    for (const [k, v] of Object.entries(taskYields(s, ac))) { k === "fish" && ac.id === "fishing" ? landFish(s, v * eff, m) : (s.res[k] = (s.res[k] || 0) + v * eff); quotaCredit(s, k, v * eff); }
    if (ac.effect === "explore") exploreDay(s, m, eff);
    if (ac.chore) markChore(s, ac); // R42
    let did = !!(ac.yields || ac.effect);
    if (ac.refine) did = refineDay(s, ac, eff);
    if (did && s.tut && s.tut.flags) s.tut.flags["t_" + ac.id] = (s.tut.flags["t_" + ac.id] || 0) + eff;
    if (ac.yields) for (const k of ac.skills) (s.atLast = s.atLast || {})["ac:" + k] = ac.id;
  },
  rest(s, m) {
    m.injured = Math.max(0, m.injured - 1 - furn(s).reduce((x, f) => x + (f.bonus.rest || 0), 0));
  },
  court(s, m, a, eff) {
    const su = findId(s.suitors, a.target);
    if (!su) {
      m.action = null;
      return;
    }
    su.affinity = Math.min(
      100,
      su.affinity +
        (1 + statVal(m, "CHA") * 0.1 + m.skills.etiquette.lvl * 0.1) *
          eff *
          (1 + traitSum(m, "court")) *
          (1 + furn(s).reduce((x, f) => x + (f.bonus.court || 0), 0)) *
          courtMult(s, m, su),
    );
    noteStage(s, m, su);
    gainXp(s, m, "etiquette", T.xpPerDay * 0.5 * eff);
    if (su.affinity >= 100) {
      // fix: courting used to continue forever at 100 affinity when the proposal was blocked
      const why = proposeIssue(s, su.id);
      log(s, `💌 ${su.name} would say yes!${why ? " First: " + why + "." : " Propose on the Main tab."}`);
      m.action = defaultAction(s, m);
    }
  },
};

export function doAction(s, m, a, eff) {
  if (!a) return;
  if (a.type === "train") {
    // train is resolved against the passed action (orders pass a fresh object)
    const t = themedFor(s, m, a.target);
    m.action = t ? { type: "activity", target: t, progress: 0 } : defaultAction(s, m);
    return;
  }
  stampDiff(s, a);
  if (TRAVEL_TYPES.includes(a.type)) return travelTick(s, m, a, eff);
  if (a.type === "parcel") return parcelDay(s, m, a, eff, gainXp);
  const h = ACTIONS[a.type];
  if (h) h(s, m, a, eff);
}

// R86: picks the hardest quest the person can take in the region. Resting quests are skipped (questIssue). If the region's
// quests are ALL resting, move to the open region whose hardest available quest is highest (ties: first in D.regions);
// otherwise the old fallback "rats" (if it isn't resting itself); otherwise null (the caller has them work that day).
export function autoQuest(s, m, region) {
  const ok = (q, rg, ign) =>
    q.region === rg &&
    !q.story &&
    !q.house && // standing orders never pick sides between houses
    !questIssue(s, m, q, ign) &&
    q.risk !== "deadly" &&
    q.cp <= cp(s, m) &&
    regionOpen(s, rg);
  const best = (rg, ign) => D.quests.filter(q => ok(q, rg, ign)).sort((a, b) => b.cp - a.cp)[0];
  const q = best(region);
  if (q) return q;
  if (best(region, true)) {
    const alt = D.regions.filter(r => r.id !== region).map(r => best(r.id)).filter(Boolean).sort((a, b) => b.cp - a.cp)[0];
    if (alt) return alt;
  }
  const rats = findId(D.quests, "rats");
  return rats && !questRest(s, rats) ? rats : null;
}

// ---- standing orders: Explore / Adventure
export function pickExplore(s, m) {
  const h = MP().home;
  const ok = (MP().areas || []).filter(a => !exploreIssue(s, m, a.id) || (m.minion && regionOpen(s, a.region)));
  const fresh = ok.filter(a => !explored(s, a.id)),
    left = ok.filter(a => areaSecretsLeft(s, a) > 0);
  const pool = fresh.length ? fresh : left.length ? left : ok;
  return pool.sort((a, b) => distTo(a.id) - distTo(b.id))[0] || null;
}

export function pickAdventure(s, m) {
  const ln = boardsPick(s, m, Infinity); // R45: follow a quest line this person started
  if (ln) return ln;
  const c = cp(s, m);
  const gq = guildQuestFor(s, m, q => !questIssue(s, m, q) && q.risk !== "deadly" && q.cp <= c); // R46: own guild's chain quest first
  if (gq) return { type: "quest", target: gq.id };
  const dgs = (D.dungeons || [])
    .filter(d => !dungeonIssue(s, m, d) && d.floors[0].cp <= c * 1.1)
    .sort((a, b) => b.floors.at(-1).cp - a.floors.at(-1).cp);
  if (dgs.length) return { type: "dungeon", target: dgs[0].id };
  const qs = D.quests
    .filter(q => !q.story && (!q.once || q.thread || q.beat) && !questIssue(s, m, q) && q.risk !== "deadly" && q.cp <= c)
    .sort((a, b) => !!b.once - !!a.once || b.cp - a.cp); // R48: house-thread steps and act side beats go first (one-time)
  // R45: a board job from your band when it pays at least as well per trip-day as the quest it would run
  const bar = qs[0] ? ((qs[0].reward || {}).coin || 0) / Math.max(1, 2 * travelDays(qs[0].id) + qs[0].days) : 0;
  const bj = boardsPick(s, m, bar);
  if (bj) return bj;
  return qs[0] ? { type: "quest", target: qs[0].id } : null;
}

export function standingTick(s, m) {
  if (!m.standing || isBusy(m)) return;
  let a = null;
  if (m.standing === "explore") {
    const ar = pickExplore(s, m);
    if (ar) a = { type: "explore", target: ar.id };
  } else {
    a = pickAdventure(s, m);
  }
  if (!a) {
    m.action = null;
    return;
  }
  m.action = { ...a, progress: 0 };
  m.action.trip = newTrip(m.action, s, m);
}

// ---- player actions
export function setAction(s, a) {
  const m = active(s);
  if (!m) return false;
  if (m.paused) { m.paused = false; if (m.action && m.action.type === "rest") m.action = null; } // R44: a new task resumes a paused member
  if (a && a.type === "train") {
    const t = themedFor(s, m, a.target);
    if (!t) return false;
    a = { type: "activity", target: t };
  }
  if (isBusy(m) && a.type === "auto") {
    m.standing = a.target;
    return true;
  }
  if (isBusy(m) && a.type === "stopauto") {
    m.standing = null;
    return true;
  }
  if (isBusy(m) && !(m.action.type === a.type && m.action.target === a.target)) return false;
  if (a.type === "stopauto") {
    m.standing = null;
    return true;
  }
  if (isBusy(m)) return true;
  if (
    ["train", "job", "activity", "quest", "court", "gather", "rest", "explore", "dungeon", "auto"].includes(a.type) &&
    !actionAllowed(s, m, a)
  )
    return false;
  if (!m || (!isAdult(m) && a.type !== "rest" && a.type !== "train")) {
  }
  if (a.type === "auto") {
    m.standing = a.target;
    m.action = null;
    standingTick(s, m);
    if (!m.action) m.action = { type: "rest", progress: 0 };
    return true;
  }
  m.standing = null;
  m.action = { ...a, progress: 0 };
  if (TRAVEL_TYPES.includes(a.type)) m.action.trip = newTrip(m.action, s, m);
}

export function defaultAction(s, m) {
  const age = ageY(m);
  for (const id of age < 12 ? ["play", "stories"] : ["chores", "hiking"]) {
    const ac = findId(D.activities, id);
    if (ac && activityOk(s, m, ac)) return { type: "activity", target: id, progress: 0 };
  }
  const ac = D.activities.find(x => activityOk(s, m, x));
  if (ac) return { type: "activity", target: ac.id, progress: 0 };
  return { type: "rest", progress: 0 };
}

export function actionAllowed(s, m, a) {
  if (!a) return false;
  const t = a.type;
  if (t === "train") return !!themedFor(s, m, a.target);
  if (t === "job") return jobOk(m, findId(D.jobs, a.target) || { minAge: 99 }, s);
  if (t === "activity") {
    const ac = findId(D.activities, a.target);
    return !!ac && activityOk(s, m, ac);
  }
  if (t === "rest") return true;
  if (t === "parcel") return ageY(m) >= 10 && !!D.world && hasFeature(s, a.target);
  if (t === "gather") {
    const n = findId(D.nodes, a.target);
    return ageY(m) >= 10 && (!n || (known(s, n) && regionOpen(s, n.region)));
  }
  if (t === "quest") {
    const q = findId(D.quests, a.target);
    const mid = m.action && m.action.type === "quest" && m.action.target === a.target && (m.action.trip || m.action.progress > 0); // R86: a run already under way finishes even if someone else's success set the quest resting
    return !!q && canQuest(m, q, s) && !questIssue(s, m, q, mid);
  }
  if (t === "explore") return !exploreIssue(s, m, a.target);
  if (t === "dungeon") return !dungeonIssue(s, m, dungeonDef(a.target));
  if (t === "auto") return isAdult(m) && ["explore", "adventure"].includes(a.target);
  if (t === "craft") {
    const rc = recipeDef(a.target);
    return !!rc && !recipeIssue(s, m, rc);
  }
  if (t === "court") return isAdult(m) && !m.spouse && s.suitors.some(x => x.id === a.target);
  return false;
}

// Teens (teenAge..adult) may take safe errands, hunting, and low-injury combat: CP <= teenRiskyMaxCp,
// or (when the game state is known) an injury chance (= failure chance) under trade.teenSafeLoss.
const TEEN_COMBAT = ["brawling", "swordsmanship", "archery", "shield", "tactics"];
export const teenInjuryChance = (s, m, q) => (q.risk === "safe" ? 0 : 1 - successChance(s, m, q));
export function teenQuestOk(q, s, m) {
  if (!q || q.risk === "deadly" || q.type === "dungeon") return false;
  if (q.risk === "safe") return true;
  if (!(q.type === "hunt" || q.skill === "hunting" || TEEN_COMBAT.includes(q.skill))) return false;
  return q.cp <= (T.teenRiskyMaxCp ?? 15) || (!!s && !!m && teenInjuryChance(s, m, q) < (T.teenSafeLoss ?? 0.1));
}
export const isTeen = m => !isAdult(m) && ageY(m) >= (T.teenAge ?? 14);
export const canQuest = (m, q, s) =>
  isAdult(m) || (q && q.apprentice && ageY(m) >= (T.teenAge ?? 14)) || (isTeen(m) && teenQuestOk(q, s, m));
export const questAgeIssue = (m, q, s) => (canQuest(m, q, s) ? null : isTeen(m) ? "too dangerous for a teen" : "too young");
