import { chalFx, enemyCp, gameFx, stampDiff } from "./difficulty.js";
import { hasFeature, parcelDay } from "./world.js";
import { proposeIssue } from "./family.js";
import { courtMult, noteStage } from "./courtship.js";
import { nextQueued } from "./crafting.js";
import { resGain } from "./legacy.js";
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
import { dungeonDef, dungeonIssue, questIssue } from "./quests.js";
import { activityOk, canTrain, gainXp, jobOk, themedFor } from "./skills.js";
import { D, T, active, ageY, furn, isAdult, known, log } from "./state.js";

export function successChance(s, m, q) {
  const c = cp(s, m);
  const qc = enemyCp(s, m, q.cp);
  return Math.max(0.1, Math.min(0.98, 0.5 + (c - qc) / (qc + 20) + Math.min(0.15, minionPower(s, "guard") * 0.03) + chalFx(m, "roll")));
}

// One handler per action type: (s, m, a, eff). Travel types (quest/gather/explore/dungeon) share travelTick.
export const ACTIONS = {
  work(s, m, a, eff) {
    const c =
      (4 + level(m) * 0.5 + m.skills.haggling.lvl * 0.2) *
      eff *
      (1 + traitSum(m, "coin")) *
      (1 + furn(s).reduce((x, f) => x + (f.bonus.coin || 0), 0));
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
    a.progress = (a.progress || 0) + eff;
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
    const j = D.jobs.find(x => x.id === a.target);
    if (!j || !jobOk(m, j)) {
      m.action = null;
      return;
    }
    s.res.coin += (isAdult(m) ? j.payAdult : j.payChild) * (1 + level(m) * 0.02) * eff * (1 + traitSum(m, "coin"));
    for (const [k, v] of Object.entries(j.stats)) m.stats[k] += v * eff;
    for (const k of j.skills) gainXp(s, m, k, T.xpPerDay * 0.5 * eff);
    if (j.id === "shop") sellTick(s, eff * (1 + m.skills.haggling.lvl * 0.02));
  },
  activity(s, m, a, eff) {
    const ac = D.activities.find(x => x.id === a.target);
    if (!ac || !activityOk(s, m, ac)) {
      m.action = null;
      return;
    }
    for (const [k, v] of Object.entries(ac.stats)) m.stats[k] += v * eff;
    for (const k of ac.skills) if (canTrain(m, k, s, true)) gainXp(s, m, k, T.xpPerDay * 0.6 * eff);
    for (const [k, v] of Object.entries(ac.yields || {})) s.res[k] = (s.res[k] || 0) + v * eff;
  },
  rest(s, m) {
    m.injured = Math.max(0, m.injured - 1 - furn(s).reduce((x, f) => x + (f.bonus.rest || 0), 0));
  },
  court(s, m, a, eff) {
    const su = s.suitors.find(x => x.id === a.target);
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

export function autoQuest(s, m, region) {
  const qs = D.quests.filter(
    q =>
      q.region === region &&
      !q.story &&
      !q.house && // standing orders never pick sides between houses
      !questIssue(s, m, q) &&
      q.risk !== "deadly" &&
      q.cp <= cp(s, m) &&
      regionOpen(s, region),
  );
  return qs.sort((a, b) => b.cp - a.cp)[0] || D.quests.find(q => q.id === "rats");
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
  const c = cp(s, m);
  const dgs = (D.dungeons || [])
    .filter(d => !dungeonIssue(s, m, d) && d.floors[0].cp <= c * 1.1)
    .sort((a, b) => b.floors.at(-1).cp - a.floors.at(-1).cp);
  if (dgs.length) return { type: "dungeon", target: dgs[0].id };
  const qs = D.quests
    .filter(q => !q.story && !q.once && !questIssue(s, m, q) && q.risk !== "deadly" && q.cp <= c)
    .sort((a, b) => b.cp - a.cp);
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
  m.action.trip = newTrip(m.action);
}

// ---- player actions
export function setAction(s, a) {
  const m = active(s);
  if (!m) return false;
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
  if (TRAVEL_TYPES.includes(a.type)) m.action.trip = newTrip(m.action);
}

export function defaultAction(s, m) {
  const age = ageY(m);
  for (const id of age < 12 ? ["play", "stories"] : ["chores", "hiking"]) {
    const ac = D.activities.find(x => x.id === id);
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
  if (t === "job") return jobOk(m, D.jobs.find(j => j.id === a.target) || { minAge: 99 });
  if (t === "activity") {
    const ac = D.activities.find(x => x.id === a.target);
    return !!ac && activityOk(s, m, ac);
  }
  if (t === "rest") return true;
  if (t === "parcel") return ageY(m) >= 10 && !!D.world && hasFeature(s, a.target);
  if (t === "gather") {
    const n = D.nodes.find(x => x.id === a.target);
    return ageY(m) >= 10 && (!n || (known(s, n) && regionOpen(s, n.region)));
  }
  if (t === "quest") {
    const q = D.quests.find(x => x.id === a.target);
    return !!q && canQuest(m, q, s) && !questIssue(s, m, q);
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
