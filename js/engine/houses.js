// Diplomacy with neighbouring houses: rapport tiers (feud → rival → cold → neutral → friendly → allied),
// house quests that pick sides, ally perks, rival troubles, and light feud/war states.
// Kept deliberately small and data-driven (data/marriage.json "houses") for the later ruling-house era.
import { addRenown } from "./legacy.js";
import { cp, era } from "./family.js";
import { minionPower } from "./minions.js";
import { D, active, isAdult, living, log, rng } from "./state.js";

export const HC = () => D.marriage.houses;
export const WAR = () => HC().war;
export const FEUD = () => HC().feud;
export const houseList = () => HC().list;
// Phase gates (data): light marriage/rapport from the start, rivalry and feuds once the family is Established.
// The house model (id, seat, wealth, rank) is what Phase 4 lords/titles will extend.
export const phaseOk = (s, key) => era(s).n >= ((HC().gates || {})[key] || 1);
export const houseDef = id => houseList().find(h => h.id === id);

export function houseState(s, id) {
  if (!s.houses) s.houses = {};
  if (!s.houses[id]) s.houses[id] = { r: (houseDef(id) || {}).start || 0, state: "peace" };
  return s.houses[id];
}
export const rapport = (s, id) => houseState(s, id).r;

export function tierOf(s, id) {
  const h = houseState(s, id);
  if (h.state === "war") return "feud";
  return (HC().status.find(t => h.r <= t.max) || HC().status[HC().status.length - 1]).id;
}
export const tierDef = id => HC().status.find(t => t.id === id);
export const tierFx = (s, id) => HC().tiers[tierOf(s, id)] || {};
export const atWar = (s, id) => houseState(s, id).state === "war";
export const inFeud = (s, id) => ["feud", "war"].includes(houseState(s, id).state);
export const wars = s => houseList().filter(h => atWar(s, h.id));

// living ties (married-in spouses, members married out) keep rapport from sliding below a floor
export const ties = (s, id) =>
  living(s).filter(m => m.house === id).length + (s.members || []).filter(m => m.marriedOut === id).length;

export function addRapport(s, id, n, why = "") {
  const h = houseState(s, id),
    before = tierOf(s, id);
  const [lo, hi] = HC().range;
  h.r = Math.max(lo, Math.min(hi, h.r + n));
  checkFeud(s, id);
  const after = tierOf(s, id);
  if (after !== before && h.state === "peace") {
    const t = tierDef(after);
    log(s, `${after === "allied" ? "🤝" : after === "rival" ? "😠" : "🏳️"} ${houseDef(id).name} is now ${t.name} toward your family${why ? " (" + why + ")" : ""}.`);
  }
  return h.r;
}

function checkFeud(s, id) {
  const h = houseState(s, id);
  if (h.state === "peace" && h.r <= FEUD().at && !phaseOk(s, "feud")) h.r = FEUD().at + 1; // no feuds before Established
  if (h.state === "peace" && h.r <= FEUD().at) {
    h.state = "feud";
    h.since = s.day;
    log(s, `🔥 Feud with ${houseDef(id).name}! Expect raids and theft; hostile quests are open. Gifts or quests can cool it.`);
  } else if (h.state === "feud" && h.r > FEUD().exit) {
    h.state = "peace";
    h.warned = null;
    log(s, `🕊️ The feud with ${houseDef(id).name} has cooled.`);
  }
}

// ---- house quests
export function houseQuestIssue(s, q) {
  if (q.needsFeud) return inFeud(s, q.against) ? null : `only while feuding with ${houseDef(q.against).name}`;
  if (q.against && !phaseOk(s, "againstQuests")) return "rivalry quests open once your family is Established";
  if (!q.house) return null;
  if (!phaseOk(s, "houseQuests")) return "later phase";
  if (!tierFx(s, q.house).quests || inFeud(s, q.house)) return `${houseDef(q.house).name} won't deal with you`;
  return null;
}
export const houseQuests = (s, id) => D.quests.filter(q => q.house === id || (q.needsFeud && q.against === id));

export function houseQuestDone(s, q) {
  if (q.house) addRapport(s, q.house, HC().questRapport, q.name);
  if (q.against) {
    addRapport(s, q.against, HC().againstRapport, q.name);
    if (atWar(s, q.against)) houseState(s, q.against).score += 0.5; // raids count toward a decisive win
  }
}

// ---- gifts (the way back from rival/feud; never a permanent lock)
export function giftIssue(s, id) {
  const h = houseState(s, id);
  if (h.state === "war") return "at war: offer a truce first";
  if (s.day - (h.gift ?? -1e9) < HC().giftCooldown) return `cooldown ${HC().giftCooldown - (s.day - h.gift)}d`;
  if (s.res.coin < HC().giftCoin) return `${HC().giftCoin} coin`;
  return null;
}
export function sendGift(s, id) {
  if (giftIssue(s, id)) return false;
  s.res.coin -= HC().giftCoin;
  houseState(s, id).gift = s.day;
  addRapport(s, id, HC().giftStanding, "gift");
  return true;
}

// ---- perks
export function houseSellMult(s, townId) {
  let m = 1;
  for (const h of houseList()) if (h.town === townId) m *= tierFx(s, h.id).sellMult || 1;
  return m;
}
export const courtBonus = (s, houseId) => (houseId ? tierFx(s, houseId).courtMult || 0 : 0);

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
    const sp = hd.wealth * W.spoilsPerWealth;
    s.res.coin += sp;
    log(s, `🛡️ Battle won against ${hd.name}: +${sp} coin spoils (${h.score}/${W.decisive}).`);
  } else {
    h.score--;
    const lost = Math.min(W.lossCoinMax, Math.floor(s.res.coin * W.lossCoinPct));
    s.res.coin -= lost;
    const f = living(s).filter(m => isAdult(m) && m.cls && !m.injured);
    const hurt = f.length ? f[Math.floor(rng() * f.length)] : null;
    if (hurt) hurt.injured = Math.max(hurt.injured, W.injureDays);
    const g = (s.minions || []).filter(x => x.job === "guard" && !x.special);
    let gone = null;
    if (g.length && rng() < W.minionLossChance) {
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

// ---- daily hook
function troubles(s, id) {
  const t = HC().troubles[Math.floor(rng() * HC().troubles.length)],
    hd = houseDef(id);
  let n = 0;
  if (t.coinPct) {
    n = Math.min(t.coinMax, Math.floor(s.res.coin * t.coinPct));
    s.res.coin -= n;
  } else if (t.foodPct) {
    n = Math.floor((s.res.food || 0) * t.foodPct);
    s.res.food -= n;
  } else if (t.renown) {
    n = Math.min(t.renown, Math.floor(s.renown || 0));
    s.renown -= n;
  } else if (t.loyalty) {
    n = t.loyalty;
    for (const mi of s.minions || []) mi.loyalty = Math.max(1, mi.loyalty - n);
  }
  log(s, t.msg.replace("{house}", hd.name).replace("{n}", n));
}

export function housesDay(s) {
  for (const hd of houseList()) {
    const h = houseState(s, hd.id);
    if (h.state === "war") {
      if (s.day - h.warDay >= WAR().battleEvery) battle(s, hd.id);
      if (h.state === "war" && s.day - h.warStart >= WAR().maxDays) endWar(s, hd.id, "timeout");
      continue;
    }
    if (s.day % 30 !== 0) continue;
    // drift toward neutral (or toward the tie floor while a marriage links the houses)
    const target = ties(s, hd.id) ? HC().tieFloor : 0,
      d = HC().driftPerMonth;
    h.r = h.r > target ? Math.max(target, h.r - d) : Math.min(target, h.r + d);
    checkFeud(s, hd.id);
    const fx = tierFx(s, hd.id);
    if (fx.troubleChance && phaseOk(s, "troubles") && rng() < fx.troubleChance) troubles(s, hd.id);
    if (fx.renownMonth) s.renown = (s.renown || 0) + fx.renownMonth;
    if (fx.giftChance && rng() < fx.giftChance) {
      const g = HC().gifts[Math.floor(rng() * HC().gifts.length)];
      if (g.coin) s.res.coin += g.coin;
      for (const [k, v] of Object.entries(g.res || {})) s.res[k] = (s.res[k] || 0) + v;
      log(s, `🤝 ${hd.name} sent a gift: ${g.coin ? g.coin + " coin" : Object.entries(g.res).map(([k, v]) => v + " " + k).join(", ")}.`);
    }
    // feud escalation by the rival: warn first, never against a weak young family
    if (h.state === "feud" && familyPower(s) >= FEUD().minPowerForAggression) {
      if (h.warned == null) {
        if (rng() < FEUD().escalateChance) {
          h.warned = s.day;
          log(s, `🔥 ${hd.name} is mustering men. War in ~${FEUD().warnDays} days unless the feud cools.`);
        }
      } else if (s.day - h.warned >= FEUD().warnDays) startWar(s, hd.id, "they attacked");
    }
  }
  if (s.day % 30 === 0 && s.weary && !wars(s).length) s.weary = Math.max(0, s.weary - WAR().wearyDecayPerMonth);
}
