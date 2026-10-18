import { injure } from "./injuries.js";
// Feud escalation and war between houses (Dynasty phase): battles, power, truce/tribute, weariness.
// Numbers in data/families.json war / feud.
import { LG, addRenown } from "./legacy.js";
import { cp } from "./family.js";
import { FEUD, HC, atWar, houseDef, houseList, houseState, phaseOk, tierOf } from "./houses.js";
import { minionPower, minionSurvival } from "./minions.js";
import { active, isAdult, living, log, rng } from "./state.js";
import { houseEvent } from "./families.js";

export const WAR = () => HC().war;
export const wars = s => houseList().filter(h => atWar(s, h.id));

// ---- power & war
export const familyPower = s =>
  living(s)
    .filter(m => isAdult(m) && m.cls && !m.injured)
    .reduce((a, m) => a + cp(s, m) * WAR().memberPower, 0) +
  minionPower(s, "guard") * WAR().guardPower;
export const allyPower = s => houseList().filter(h => tierOf(s, h.id) === "allied").length * WAR().allyPower;
// newbie-safe: the enemy scales with you inside a band, capped by the house's wealth
export function enemyPower(s, id) {
  const W = WAR(),
    our = familyPower(s) + allyPower(s);
  const cap = houseDef(id).wealth * W.enemyPerWealth * 3;
  return Math.max(10, Math.min(cap, Math.max(our * W.enemyMinScale, Math.min(our * W.enemyMaxScale, houseDef(id).wealth * W.enemyPerWealth))));
}

export function declareWarIssue(s, id) {
  const h = houseState(s, id);
  if (!phaseOk(s, "war")) return "war is a Dynasty-phase matter";
  if (h.state === "war") return "already at war";
  if (h.state !== "feud") return "only from a feud";
  if (!living(s).some(isAdult)) return "no adults";
  return null;
}
export function declareWar(s, id) {
  if (declareWarIssue(s, id)) return false;
  startWar(s, id, "you declared war");
  return true;
}
function startWar(s, id, why) {
  Object.assign(houseState(s, id), { state: "war", warStart: s.day, warDay: s.day, score: 0 });
  log(s, `🏴 War with ${houseDef(id).name} (${why})! Battles every ${WAR().battleEvery} days until a truce, a marriage or ${WAR().decisive} decisive wins.`);
}

export function battle(s, id) {
  const W = WAR(),
    h = houseState(s, id),
    hd = houseDef(id);
  const our = familyPower(s) + allyPower(s),
    foe = enemyPower(s, id);
  const win = rng() < our / Math.max(1, our + foe);
  s.weary = (s.weary || 0) + W.weariness;
  h.warDay = s.day;
  if (win) {
    h.score++;
    const lead = active(s);
    if (lead) addRenown(s, lead, LG().renown.warBattle || 0);
    const sp = hd.wealth * W.spoilsPerWealth;
    s.res.coin += sp;
    log(s, `🛡️ Battle won against ${hd.name}: +${sp} coin spoils (${h.score}/${W.decisive}).`);
  } else {
    h.score--;
    const lost = Math.min(W.lossCoinMax, Math.floor(s.res.coin * W.lossCoinPct));
    s.res.coin -= lost;
    const f = living(s).filter(m => isAdult(m) && m.cls && !m.injured);
    const hurt = f.length ? f[Math.floor(rng() * f.length)] : null;
    if (hurt) injure(s, hurt, 2, "in battle");
    const g = (s.minions || []).filter(x => x.job === "guard" && !x.special);
    let gone = null;
    if (g.length && rng() < W.minionLossChance * minionSurvival(g[0], s)) {
      gone = g[Math.floor(rng() * g.length)];
      s.minions = s.minions.filter(x => x !== gone);
    }
    log(s, `🛡️ Battle lost against ${hd.name}: −${lost} coin${hurt ? `, ${hurt.name} wounded` : ""}${gone ? `, ${gone.name} fell` : ""} (${h.score}/−${W.decisive}).`);
  }
  if (h.score >= W.decisive) endWar(s, id, "victory");
  else if (h.score <= -W.decisive) endWar(s, id, "defeat");
  return win;
}

export function endWar(s, id, how) {
  const W = WAR(),
    h = houseState(s, id),
    hd = houseDef(id);
  h.state = "peace";
  h.warned = null;
  const set = r => (h.r = Math.max(h.r, r));
  if (how === "victory") {
    set(W.victoryRapport);
    houseEvent(s, "warWon", { why: `victory over ${hd.name}` }); // R48: ruthless houses respect it
    const m = active(s);
    if (m) addRenown(s, m, W.victoryRenown);
    log(s, `🕊️ Victory over ${hd.name}! They sue for peace (+${W.victoryRenown} renown).`);
  } else if (how === "defeat") {
    const t = Math.min(W.defeatTributeMax, Math.floor(s.res.coin * W.defeatTributePct));
    s.res.coin -= t;
    set(W.defeatRapport);
    log(s, `🕊️ Defeated by ${hd.name}: peace bought with ${t} coin tribute.`);
  } else if (how === "truce") {
    set(W.truceRapport);
    log(s, `🕊️ Truce with ${hd.name}: tribute paid, the war is over.`);
  } else if (how === "marriage") {
    set(W.marryPeaceRapport);
    log(s, `🕊️ A wedding ends the war with ${hd.name}.`);
  } else {
    set(W.timeoutRapport);
    log(s, `🕊️ Both sides are exhausted: the war with ${hd.name} peters out.`);
  }
  if (h.r <= FEUD().at) h.r = FEUD().exit + 1; // peace never drops straight back into a feud
}

export const tributeCost = (s, id) => houseDef(id).wealth * WAR().tributePerWealth;
export const truceIssue = (s, id) =>
  !atWar(s, id) ? "not at war" : s.res.coin < tributeCost(s, id) ? `${tributeCost(s, id)} coin tribute` : null;
export function offerTruce(s, id) {
  if (truceIssue(s, id)) return false;
  s.res.coin -= tributeCost(s, id);
  endWar(s, id, "truce");
  return true;
}

export const wearyMorale = s => -Math.min(WAR().wearyMoraleMax, (s.weary || 0) * WAR().wearyMoralePer);

export const warTimer = (s, id) => {
  const h = houseState(s, id);
  return { p: Math.min(1, (s.day - h.warDay) / WAR().battleEvery), left: Math.max(0, WAR().battleEvery - (s.day - h.warDay)), score: h.score };
};

export function warDay(s, id) {
  const h = houseState(s, id);
  if (s.day - h.warDay >= WAR().battleEvery) battle(s, id);
  if (h.state === "war" && s.day - h.warStart >= WAR().maxDays) endWar(s, id, "timeout");
}

export function warEscalate(s, hd, h) {
  // feud escalation by the rival: Dynasty only, warn first, never against a weak young family
  if (!phaseOk(s, "war") || h.state !== "feud") return;
  if (h.r <= HC().range[0]) return void startWar(s, hd.id, "rapport hit rock bottom"); // -100: house war
  if (familyPower(s) < FEUD().minPowerForAggression) return;
  if (h.warned == null) {
    if (rng() < FEUD().escalateChance) {
      h.warned = s.day;
      log(s, `🔥 ${hd.name} is mustering men. War in ~${FEUD().warnDays} days unless the feud cools.`);
    }
  } else if (s.day - h.warned >= FEUD().warnDays) startWar(s, hd.id, "they attacked");
}
