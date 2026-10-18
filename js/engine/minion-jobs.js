import { followerPwdCheck } from "./pausedone.js";
import { haulTier, parcelJobMult } from "./world.js";
import { deliverLoad, gatherInto, travelDays } from "./map.js";
import { seasonYield } from "./seasons.js";
import { pickExplore } from "./actions.js";
import { ES, eff, established } from "./estate.js";
import { bestRecipe, craftItem, recipeDef, recipeIssue, sellTick } from "./inventory.js";
import { resGain, legacyValue } from "./legacy.js";
import { exploreArea, regionOpen } from "./map.js";
import { rollRare } from "./quests.js";
import { D, bl, known, log, r } from "./state.js";
import { isFed, morale } from "./food.js";
import { homeMap, isHoused, minionRoom } from "./minion-housing.js";
import { MLV, addMinion, minionGainXp, minionLvlMult, monthlyWages, mtype } from "./minions.js";
import { checkSpecialMinions, minionGearMult, minionSurvival } from "./minion-special.js";

export const ADVENTURE_SHARE = 0.3; // balance: was 0.6 (then 0.5) of the quest reward

export const MINION_JOBS = {
  farm: (s, mi, a, rg) => {
    // R40: only the hours left after tending fields farm the old way (mi.fieldSpare from fields.js)
    s.res.food += 3 * a * rg * seasonYield(s, "food") * (1 + bl(s, "farm") * 0.2) * (mi.fieldSpare ?? 1);
  },
  teamster: () => {}, // R40: teamsters only haul field harvest into storage (fields.js); no other work
  gather: (s, mi, a, rg) => {
    s.res.wood += 2 * a * rg;
    s.res.stone += 1 * a * rg;
  },
  mine: (s, mi, a, rg) => {
    s.res.ore = (s.res.ore || 0) + 1 * a * rg;
    s.res.copperore = (s.res.copperore || 0) + 0.8 * a * rg;
    s.res.stone += 0.5 * a * rg;
  },
  scout: (s, mi, a, rg) => {
    mi.prog = (mi.prog || 0) + a;
    if (mi.prog >= 6) {
      mi.prog = 0;
      const pm = { name: mi.name + " (scout)", minion: true, skills: { tracking: { lvl: 5 } } };
      const ar = pickExplore(s, pm);
      if (ar) exploreArea(s, pm, ar);
    }
  },
  adventure: (s, mi, a, rg) => {
    // Balance/bug fix: minions no longer run guild/adventurer-rank quests (they paid out 200-coin guild
    // jobs every ~2 days), power no longer NaN-falls back, and a run takes as long as the quest does.
    const pw = 8 * (mtype(mi.type).apt.adventure || 1);
    const q = D.quests
      .filter(
        q =>
          !q.story &&
          !q.once &&
          !q.guild &&
          !q.adv &&
          !q.house &&
          known(s, q) &&
          regionOpen(s, q.region) &&
          q.risk === "safe" &&
          q.cp <= pw * 3,
      )
      .sort((a, b) => b.cp - a.cp)[0];
    mi.prog = (mi.prog || 0) + a;
    if (q && mi.prog >= (q.days || 3) + 2) {
      mi.prog = 0;
      for (const [k, v] of Object.entries(q.reward))
        s.res[k] = (s.res[k] || 0) + Math.round(v * ADVENTURE_SHARE * minionGearMult(mi, "adventure"));
      rollRare(s, q, null);
    }
  },
  hunt: (s, mi, a, rg) => {
    s.res.meat = (s.res.meat || 0) + 1.5 * a * rg;
    s.res.hides = (s.res.hides || 0) + 0.5 * a * rg;
  },
  fish: (s, mi, a, rg) => {
    s.res.fish = (s.res.fish || 0) + 2 * a * rg;
  },
  herbs: (s, mi, a, rg) => {
    s.res.thyme = (s.res.thyme || 0) + 1.3 * a * rg * seasonYield(s, "thyme");
    s.res.sage = (s.res.sage || 0) + 0.2 * a * rg * seasonYield(s, "sage");
    s.res.sage = (s.res.sage || 0) + 0.3 * a * rg * seasonYield(s, "sage");
    s.res.mandrake = (s.res.mandrake || 0) + 0.1 * a * rg * seasonYield(s, "mandrake");
    s.res.moonpetal = (s.res.moonpetal || 0) + 0.05 * a * rg * seasonYield(s, "moonpetal");
  },
  craft: (s, mi, a, rg) => {
    mi.prog = (mi.prog || 0) + 0.2 * a * (1 + legacyValue(s, "craftspd")); // R43 Workshop: Craft Speed
    const ord = mi.craftOrder && recipeDef(mi.craftOrder);
    const rc = ord && !recipeIssue(s, null, ord) ? ord : bestRecipe(s, null);
    if (rc && mi.prog >= rc.days) {
      mi.prog = 0;
      craftItem(s, null, rc, mi, a);
    }
  },
  merchant: (s, mi, a, rg) => {
    sellTick(s, a);
  },
  // node runs: out → gather → haul home (timed trip on the follower; resources land on return)
  noderun: (s, mi, a, rg) => {
    const n = mi.node && D.nodes.find(x => x.id === mi.node);
    if (!n || !known(s, n)) return;
    if (!mi.trip) {
      const out = travelDays(n.id);
      mi.trip = { out, task: D.world.noderun.gatherDays, back: Math.round((out / haulTier(s).haulSpeed) * 10) / 10, t: 0 };
    }
    const t = mi.trip;
    t.t += 1;
    if (t.t > t.out && t.t <= t.out + t.task)
      gatherInto(s, t, n, (1 + D.world.noderun.skillLvl * 0.03) * a * rg, () => 0);
    if (t.t >= t.out + t.task + t.back) {
      if (t.load) deliverLoad(s, mi.name, t);
      mi.trip = null;
    }
  },
};

export function minionDay(s) {
  if (!s.minions) {
    s.minions = [];
    s.repLevel = 0;
  }
  checkSpecialMinions(s);
  const fed = isFed(s);
  const hm = homeMap(s);
  const mor = eff(s, "morale") + morale(s) * (ES().meals.minionLoyaltyPerMorale || 0) * (morale(s) < 0 ? 2 : 1);
  if (mor) for (const mi of s.minions) mi.loyalty = Math.min(100, mi.loyalty + mor);
  // hunger loyalty loss below; meals are eaten in eatDay (food.js) before this runs
  for (const mi of s.minions) mi.home = hm[mi.uid] || null;
  for (const mi of s.minions) {
    if (!fed) {
      mi.hunger = (mi.hunger || 0) + 1;
      mi.loyalty -= D.minions.hungerLoyaltyLoss * minionSurvival(mi);
    } else mi.hunger = 0;
    if (!isHoused(s, mi)) {
      mi.unhoused = true;
      continue;
    }
    mi.unhoused = false;
    const a =
      (mtype(mi.type).apt[mi.job] || 1) *
      (fed ? 1 : D.minions.hungryOutput) *
      minionGearMult(mi, mi.job) *
      minionLvlMult(mi);
    const rg = resGain(s);
    minionGainXp(s, mi, MLV().xpPerDay * (fed ? 1 : 0.5));
    if (mi.paused) continue; // R44 pause when done
    const p0 = mi.prog || 0;
    MINION_JOBS[mi.job]?.(s, mi, D.world ? a * parcelJobMult(s, mi.job) : a, rg);
    followerPwdCheck(s, mi, p0);
  }
  for (const mi of [...s.minions])
    if (mi.loyalty <= 0) {
      s.minions = s.minions.filter(x => x !== mi);
      log(s, `🍽️ ${mi.name} left: ${mi.hunger ? "not enough food" : "unhappy"}.`);
    }
  minionWages(s);
  minionReputation(s);
}

function minionWages(s) {
  if (s.day % 30 === 0 && s.minions.length) {
    const w = monthlyWages(s);
    if (s.res.coin >= w) {
      s.res.coin -= w;
      for (const mi of s.minions) mi.loyalty = Math.min(100, mi.loyalty + 10);
    } else {
      s.res.coin = 0;
      for (const mi of [...s.minions]) {
        mi.loyalty -= D.minions.loyaltyLossUnpaid;
        if (mi.loyalty <= 0) {
          s.minions = s.minions.filter(x => x !== mi);
          log(s, `💸 ${mi.name} left over unpaid wages.`);
        }
      }
      log(s, "💸 Wages went unpaid; loyalty fell.");
    }
  }
}

function minionReputation(s) {
  const lvl = Math.floor(s.renown / D.minions.reputationEveryRenown);
  if (lvl > s.repLevel) {
    s.repLevel = lvl;
    if (established(s) && minionRoom(s))
      addMinion(
        s,
        r(D.minions.types.filter(t => !t.special && t.id !== "refugee" && t.id !== "tutor")).id,
        "drawn by the estate's reputation",
      );
  }
}
