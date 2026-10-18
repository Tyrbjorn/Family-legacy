import { injuryDay, injurySpeed, treat } from "./injuries.js";
import { enchantDay } from "./gear.js";
import { notify } from "./notify.js";
import { pathsDay } from "./paths.js";
import { autoTendDay } from "./autotend.js";
import { autoEquipDay } from "./autoequip.js";
import { familyAutoDay, kidSkill } from "./family-auto.js";
import { autoAscendDay, autoRecruitDay, minionAgeDay } from "./minion-auto.js";
import { evolveOptions, minionEvolveIssue } from "./minions.js";
import { taintDev } from "./dev.js";
import { tutCheck } from "./tutorial.js";
import { seasonYield } from "./seasons.js";
import { inheritTraits } from "./traits.js";
import { checkAchievements } from "./achievements.js";
import { expireBuffs } from "./encounters.js";
import { eventsDay } from "./worldevents.js";
import { worldDay as mapDay } from "./world.js";
import { season, seasonDay } from "./seasons.js";
import { globalTick, lifeBonus, memberTick } from "./legacy.js";
import { actionAllowed, autoQuest, doAction, standingTick } from "./actions.js";
import { ES, bedrooms, estEff, established, foodCap, matCap, processDay } from "./estate.js";
import { generationsDay, inherit, kill, newMember, spawnSuitor } from "./family.js";
import { hasService } from "./guilds.js";
import { isBusy } from "./map.js";
import { minionDay } from "./minions.js";
import { eatDay, mealHeal, moraleSpeed } from "./food.js";
import { household, householdDay, suitorsTick } from "./courtship.js";
import { housesDay } from "./houses.js";
import { introsDay } from "./intros.js";
import { normalize } from "./save.js";
import { gainXp } from "./skills.js";
import { D, T, Y, active, ageY, bl, furn, living, log, r, rng } from "./state.js";

export const idleEff = s => T.idleEff + bl(s, "yard") * 0.05;

export const turboCapSec = s => (T.turboCapMin + bl(s, "hourglass") * 30) * 60;

export const offlineCapSec = s => (T.offlineCapHours + bl(s, "hourglass") * 2) * 3600;

// One in-game day = the registered hooks below, run in order. Order matters (RNG sequence, food before births).
export const DAY_HOOKS = [];
export const registerDayHook = (name, fn, at = DAY_HOOKS.length) => DAY_HOOKS.splice(at, 0, { name, fn });

export function dayTick(s, effActive, effIdle) {
  if (s.gameOver) return;
  if (!s._norm) normalize(s);
  s.day++;
  for (const h of DAY_HOOKS) {
    h.fn(s, effActive, effIdle);
    if (s.gameOver) return;
  }
}

function worldDay(s) {
  eventsDay(s);
  expireBuffs(s);
  if (D.world) mapDay(s, seasonDay(s) === 0, season(s).id);
}

function milestonesDay(s) {
  if (s.day % 5 !== 0) return;
  checkAchievements(s);
  for (const mi of s.minions || [])
    if (mi.evoNoted !== mi.cls && evolveOptions(mi).some(c => !minionEvolveIssue(s, mi, c.id))) {
      mi.evoNoted = mi.cls;
      notify(s, "evolution", `🌟 ${mi.name} is ready to evolve.`);
    }
}

function tutorialDay(s) {
  if (s.tut && s.tut.started && !s.tut.skipped && s.tut.step < (D.tutorial?.steps.length || 0)) {
    const aa = active(s)?.action;
    if (aa?.type === "activity") {
      s.tut.flags.activity = true;
    }
    tutCheck(s);
  }
}

function estateDay(s) {
  const lv = s.buildings;
  s.res.food +=
    (lv.farm * 5 + (lv.garden || 0) * 2) * seasonYield(s, "food") +
    furn(s).reduce((x, f) => x + (f.bonus.food || 0), 0);
  s.res.wood += lv.lumber * 3;
  s.res.stone += lv.lumber * 1;
  eatDay(s);
  if (s.day % 30 === 0) {
    const up = Object.values(lv).reduce((a, b) => a + b, 0) * T.upkeepPerBuildingMonth;
    s.res.coin = Math.max(0, s.res.coin - up);
    s.renown += furn(s).reduce((x, f) => x + (f.bonus.renown || 0), 0) * 30;
  }
  minionDay(s);
  processDay(s);
  s.res.food = Math.min(s.res.food, foodCap(s));
  for (const k of ES().caps.capped) if ((s.res[k] || 0) > matCap(s)) s.res[k] = matCap(s);
  for (const m of living(s))
    if (m.injured > 1 && (s.res.potions || 0) >= 1) {
      s.res.potions -= 1;
      m.injured = 0;
      treat(s, m);
    }
}

function suitorsDay(s) {
  suitorsTick(s);
  if (s.suitors.length < 2 && s.day % 45 === 0) spawnSuitor(s);
}

function membersDay(s, effActive, effIdle) {
  for (const m of [...living(s)]) {
    memberDay(s, m, effActive, effIdle);
    if (s.gameOver) return;
  }
}

// birthday + old age; returns false if the member died
function ageMember(s, m) {
  m.ageDays++;
  const a = ageY(m);
  if (m.ageDays % Y() === 0) {
    if (a === T.adultAge) {
      if (m.parents) inherit(s, m);
      log(s, `🎂 ${m.name} came of age (${T.adultAge}): guild halls will now consider them.`);
    }
    if (a >= m.lifespan + lifeBonus(s) - 3 && !m.warned) {
      m.warned = true;
      log(s, `⚠️ ${m.name} is growing frail (lifespan ~${m.lifespan}).`);
    }
  }
  if (a >= m.lifespan + lifeBonus(s) && rng() < 0.002 * (a - m.lifespan - lifeBonus(s) + 1)) {
    kill(s, m, "died of old age");
    return false;
  }
  return true;
}

function healDay(s, m) {
  let h = 1 + estEff(s, "healBoost") + mealHeal(s) + household(s, "heal");
  if ((s.res.remedies || 0) >= 1) {
    s.res.remedies -= 1;
    h += 2;
    treat(s, m);
  }
  if (estEff(s, "healBoost") > 0 || hasService(s, "healer")) treat(s, m); // Infirmary/Shrine at home or a healer
  const dr = (ES().meals.tonics || {}).draught;
  if (dr && m.injured > h && (s.res.draught || 0) >= 1) {
    s.res.draught -= 1;
    h += dr.heal;
  }
  m.injured = hasService(s, "healer") ? 0 : Math.max(0, m.injured - h);
}

// what a non-active member does: their standing order
function orderDay(s, m, eff) {
  const o = established(s) ? m.order : { type: "work" };
  if (o.type === "quest") {
    if (!m.action || m.action.type !== "quest") {
      const q = autoQuest(s, m, o.target);
      m.action = q ? { type: "quest", target: q.id, progress: 0 } : null;
    }
    doAction(s, m, m.action, eff);
  } else if (o.type === "craft") {
    if (!m.action || m.action.type !== "craft") m.action = { type: "craft", target: o.target, progress: 0 };
    doAction(s, m, m.action, eff);
  } else if (o.type === "gather") {
    if (!m.action || m.action.type !== "gather" || m.action.target !== o.target) {
      if (!isBusy(m)) m.action = { type: "gather", target: o.target, progress: 0 };
    }
    doAction(s, m, m.action, eff);
  } else doAction(s, m, { type: o.type, target: o.target }, eff);
}

function birthDay(s, m) {
  const sp = s.members.find(x => x.id === m.spouse && x.alive);
  if (
    sp &&
    m.gender === "f" &&
    ageY(m) < 45 &&
    m.kids < T.maxKidsPerCouple &&
    s.day - m.lastChild >= T.childEvery &&
    living(s).length < bedrooms(s) &&
    rng() < 0.01
  ) {
    const c = newMember(s, { age: 0, parents: [m.id, sp.id] });
    inheritTraits(s, c, [m, sp]);
    c.ageDays = 0;
    s.members.push(c);
    m.kids++;
    sp.kids++;
    m.lastChild = s.day;
    log(s, `👶 ${c.name} was born to ${m.name} and ${sp.name}!`);
    s.celebrate = s.day || 0; // R33: Honey Cakes celebration
  }
}

function memberDay(s, m, effActive, effIdle) {
  if (!ageMember(s, m)) return;
  if (ageY(m) < T.adultAge && !(m.id === s.activeId && actionAllowed(s, m, m.action))) {
    const f = 1 + furn(s).reduce((x, f) => x + (f.bonus.childxp || 0), 0);
    gainXp(s, m, kidSkill(s, m) || r(D.skills).id, T.xpPerDay * 0.15 * f); // Auto Upbringing: the child's track
    return;
  }
  const isAct = m.id === s.activeId;
  const eff = (isAct ? effActive : effIdle) * memberTick(m) * (1 + moraleSpeed(s)) * injurySpeed(s, m);
  injuryDay(s, m);
  if (!m.alive) return;
  if (m.injured > 0) return healDay(s, m);
  if (!isAct && established(s) && ["explore", "adventure"].includes((m.order || {}).type)) m.standing = m.order.type;
  else if (!isAct && m.standing) m.standing = null;
  if (m.standing) {
    standingTick(s, m);
    if (m.action) doAction(s, m, m.action, eff);
    return;
  }
  if (isAct) doAction(s, m, m.action, eff);
  else orderDay(s, m, eff);
  birthDay(s, m);
}

for (const [n, f] of [
  ["world", worldDay],
  ["milestones", milestonesDay],
  ["tutorial", tutorialDay],
  ["estate", s => (estateDay(s), enchantDay(s), pathsDay(s))],
  ["automation", s => (autoTendDay(s), autoEquipDay(s), autoAscendDay(s), minionAgeDay(s), autoRecruitDay(s), familyAutoDay(s))],
  ["suitors", suitorsDay],
  ["houses", s => (housesDay(s), householdDay(s), introsDay(s))],
  ["members", membersDay],
  ["generations", generationsDay],
])
  registerDayHook(n, f);

export function toggleTurbo(s) {
  if (!s.turbo.on && s.turbo.charge < T.turboMinMin * 60) return false;
  s.turbo.on = !s.turbo.on;
  return true;
}

// ---- time
// real seconds elapsed while app is open. Turbo: 3x game time (aging included) and burns 1s charge per real second.
export function advanceReal(s, sec) {
  if (s.gameOver) return;
  taintDev(s);
  let mult = 1;
  sec *= globalTick(s);
  if (s.turbo.on) {
    const use = Math.min(sec, s.turbo.charge);
    s.turbo.charge -= use;
    s._turboSec = (s._turboSec || 0) + use;
    if (s.turbo.charge <= 0) {
      s.turbo.on = false;
      s.turbo.charge = 0;
    }
    s.acc += (use * T.turboMult) / T.secPerDayActive + (sec - use) / T.secPerDayActive;
  } else s.acc += sec / T.secPerDayActive;
  while (s.acc >= 1 && !s.gameOver) {
    s.acc--;
    dayTick(s, 1, idleEff(s));
  }
}

// Time away does not simulate the world: it only charges the turbo bar.
export function applyOffline(s, now = Date.now()) {
  const elapsed = (now - s.lastSave) / 1000;
  if (!(elapsed > 0) || elapsed > 3600 * 24 * 365) {
    s.lastSave = now;
    return null;
  }
  const before = s.turbo.charge;
  s.turbo.charge = Math.min(turboCapSec(s), s.turbo.charge + elapsed * T.turboChargeRatio);
  s.lastSave = now;
  return {
    elapsed,
    turboAdded: Math.round(s.turbo.charge - before),
    turboFull: s.turbo.charge >= turboCapSec(s),
  };
}
