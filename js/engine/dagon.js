// R53 the Gilded Hall (fl-r53-dagon-proposal.md): Saltmere's church, politely "the Lodge of the Drowned Light",
// underneath the Esoteric Order of Dagon (house `dagon`). Outsiders (Cold or worse) pay more and get less in Saltmere,
// and the Drowned Lamp won't serve them. The investigation ends in a choice (expose / join / bargain), kept in
// s.dagonPact for when the Deep Door opens in a later round. Imports state.js only (families/houses import this).
import { D, T, log, rng } from "./state.js";

export const DAGON_TOWN = "saltmere";
const COLD = -15;
const rOf = s => ((s && s.houses && s.houses.dagon) || { r: -25 }).r;
export const dagonOutsider = s => !!s && s.dagonPact !== "join" && rOf(s) <= COLD;
const exposedHot = s => s && s.flags && s.flags.dagonExpose != null && (s.day || 0) < s.flags.dagonExpose + 2 * T.daysPerYear;
// price multipliers in Saltmere only
export const dagonBuyMult = (s, town) => (town !== DAGON_TOWN || !s ? 1 : (dagonOutsider(s) ? 1.2 : 1) * (exposedHot(s) ? 1.3 : 1));
export const dagonSellMult = (s, town) => (town !== DAGON_TOWN || !s ? 1 : dagonOutsider(s) ? 0.8 : 1);
export const brewRefused = (s, town) => (town === DAGON_TOWN && dagonOutsider(s) ? "The barman looks straight through you. Outsiders aren't served at the Drowned Lamp." : null);
// small trust from helping Saltmere's own (Hask, Kelda)
export function dagonFavour(s, n) {
  const h = ((s.houses ||= {}).dagon ||= { r: (D.families.list.find(x => x.id === "dagon") || {}).start ?? -25, state: "peace" });
  h.r = Math.max(-100, Math.min(100, h.r + n));
}
export const dagonFishMult = s => (s && s.dagonPact === "join" ? 1.25 : 1) * (hydraBlessed(s) ? 1.15 : 1); // R54 her blessing
export const BARGAIN = { first: 2000, season: 200, every: 90, cache: 10 };
// the Old Bargain (makeChoice passes fx.pact here; `setR` is houses' addRapport "set" wrapper)
export function dagonPact(s, pact, setR) {
  s.dagonPact = pact;
  if (pact === "expose") setR("dagon", -85), setR("gilmane", -85);
  if (pact === "join") setR("dagon", 70);
  if (pact === "bargain") setR("dagon", 0), (s.res.reefgold = (s.res.reefgold || 0) + BARGAIN.cache), (s.dagonDue = (s.day || 0) + BARGAIN.every);
}
// daily: bargain payments; for those who joined, some years one of the family "goes down to Father"
export const DOWN_CHANCE = 0.25;
export function dagonDay(s) {
  if (s.dagonPact === "bargain" && (s.day || 0) >= (s.dagonDue || 0)) {
    if ((s.res.coin || 0) >= BARGAIN.season) (s.res.coin -= BARGAIN.season), (s.dagonDue += BARGAIN.every);
    else {
      s.dagonPact = "lapsed";
      if (s.houses && s.houses.dagon) s.houses.dagon.r = -25;
      log(s, "🐟 You missed the Lodge's payment. Saltmere's doors close to you again.");
    }
  }
  const yr = (s.day || 0) % T.daysPerYear === 0 && s.day > 0;
  if (s.dagonPact === "join" && yr && rng() < (hydraBlessed(s) ? 0.35 : DOWN_CHANCE)) goDown(s); // R54 she calls her children home more often
  openDeepDoor(s); // R54
  if (yr) hydraYear(s);
}
export function goDown(s) {
  const alive = (s.members || []).filter(m => m.alive);
  const pool = alive.filter(m => m.id !== s.head && (m.ageDays || 0) >= 16 * T.daysPerYear);
  if (alive.length < 3 || !pool.length) return null;
  const m = pool[Math.floor(rng() * pool.length)];
  m.alive = false;
  m.wentDown = s.day;
  m.leftDay = s.day;
  m.action = null;
  for (const id of [...Object.values(m.equip || {}), ...(m.bag || [])]) s.vault.push(id);
  m.equip = {};
  m.bag = [];
  log(s, `🌊 ${m.name} walked into the sea at low tide, singing. They have gone down to Father.`);
  (s.deeds ||= []).push(`${m.name} went down to Father.`);
  return m;
}

// ---- R54 Mother's Pool: Mother Hydra behind the Deep Door (fl-r54-hydra-proposal.md)
export const HYDRA = { trialLvl: 25, retryDays: 30, floodLosses: 3, floodDays: 90, shutDays: 0, gift: 5 }; // shutDays 0 = one year (T.daysPerYear)
const ALLIED = 60;
// mood read on entry: the pact first, then Lodge trust; an expose only yields to trust once its 2-year penalty is over
export function hydraMood(s) {
  const r = rOf(s), p = s.dagonPact;
  const byTrust = () => (r >= ALLIED ? "peaceful" : r > COLD ? "tested" : "violent");
  if (p === "join") return r <= COLD ? "tested" : "peaceful";
  if (p === "bargain") return "tested";
  if (p === "lapsed") return "violent";
  if (p === "expose") return exposedHot(s) ? "violent" : byTrust();
  return byTrust();
}
export const deepDoorOpen = s => !!(s.flags && s.flags.deepDoor != null);
export function openDeepDoor(s) {
  if (deepDoorOpen(s) || !(s.cleared || []).includes("d_olddeeps") || !(s.choices || []).some(c => c.id === "dagon" && c.pick)) return false;
  (s.flags ||= {}).deepDoor = s.day || 0;
  for (const id of ["hy_audience", "hy_trial", "hy_fight"]) if (!(s.revealed ||= []).includes(id)) s.revealed.push(id);
  if (!(s.discovered ||= []).includes("loc:l_deepdoor")) s.discovered.push("loc:l_deepdoor");
  log(s, "🚪 Salt water pours under the Deep Door, and it swings open. Below lies Mother's Pool.");
  return true;
}
const MOOD_TXT = { peaceful: "she would greet you in peace", tested: "she would test you", violent: "she would rise against you" };
export function hydraIssue(s, q) {
  if (!deepDoorOpen(s)) return "the Deep Door is sealed";
  if (s.hydra && s.hydra.result) return "Mother Hydra has met your family";
  const md = hydraMood(s);
  if (md !== q.hydra) return "not now: " + MOOD_TXT[md];
  if (q.hydra === "tested" && (s.hydraRetry || 0) > (s.day || 0)) return "she sent you away; return in " + (s.hydraRetry - s.day) + " days";
  if ((s.hydraFlood || 0) > (s.day || 0)) return "the Old Deeps are flooded";
  return null;
}
const best = (m, sk) => Math.max(...sk.map(k => ((m.skills || {})[k] || {}).lvl || 0));
// called after a successful resolve; `m` is the member, `hurt` the injure fn, `grant` adds coin/renown etc.
export function hydraDone(s, m, q, hurt, extra) {
  const md = q.hydra, day = s.day || 0;
  if (md === "tested") {
    const sets = [["faith", "focus"], ["sailing", "fishing"], ["etiquette", "haggling"]];
    const pass = 1 + sets.slice(1).filter(sk => { const l = best(m, sk); return l >= HYDRA.trialLvl || rng() < l / HYDRA.trialLvl; }).length; // the quest's own check was the first
    if (pass < 2) {
      s.hydraRetry = day + HYDRA.retryDays;
      hurt(s, m, 1, "in the Trial of Tides");
      log(s, "🌀 Mother Hydra found " + m.name + " wanting and sent them back up. Try again in 30 days.");
      return null;
    }
    s.res.tidepearl = (s.res.tidepearl || 0) + 1;
    if (rng() < EGG.trialChance) (s.res.deepegg = (s.res.deepegg || 0) + 1), log(s, "🥚 A Deep One egg floats up after you.");
    s.res.coin = (s.res.coin || 0) + 600;
    dagonFavour(s, 20);
    log(s, "🌀 " + m.name + " passed the Trial of Tides (" + pass + " of 3). Mother Hydra gives you a Tide-Pearl.");
  }
  if (md === "peaceful") {
    (s.boons ||= []).push({ type: "hydra", from: "hydra", text: "Mother Hydra's blessing: +15% fishing, reef-gold sells for 10% more" });
    log(s, "🙏 Mother Hydra blesses your family.");
  }
  if (md === "violent") {
    s.hydraShut = day + (HYDRA.shutDays || T.daysPerYear);
    s.res.deepegg = (s.res.deepegg || 0) + 2; // R54 eggs from her pool (EGG.fightN)
    if (extra) extra();
    log(s, "🐙 " + m.name + " has slain Mother Hydra! Saltmere mourns, and closes its market to your family for a year.");
  }
  s.hydra = { mood: md, result: md === "violent" ? "slain" : md === "tested" ? "passed" : "blessed", day };
  return s.hydra;
}
export function hydraFail(s, q) {
  if (q.hydra !== "violent") return;
  s.hydraLosses = (s.hydraLosses || 0) + 1;
  if (s.hydraLosses % HYDRA.floodLosses === 0) {
    s.hydraFlood = (s.day || 0) + HYDRA.floodDays;
    log(s, "🌊 Mother Hydra rises in fury, and the sea floods the Old Deeps for a season.");
  }
}
export const hydraBlessed = s => ((s && s.boons) || []).some(b => b.type === "hydra");
export const hydraSellMult = (s, res) => (res === "reefgold" && hydraBlessed(s) ? 1.1 : 1);
export const hydraShut = (s, town) => town === DAGON_TOWN && !!s && (s.hydraShut || 0) > (s.day || 0);
export function hydraYear(s) {
  if (s.hydra && ["blessed", "passed"].includes(s.hydra.result)) {
    s.res.pearls = (s.res.pearls || 0) + HYDRA.gift;
    log(s, "🦪 A gift from Mother's Pool: " + HYDRA.gift + " pearls.");
  }
}

// ---- R54 Deep One eggs: sell (a trade good) or hatch at home into a Young Deep One follower (minions.json `deepone`)
export const EGG = { res: "deepegg", days: 90, churchCost: 50, badChance: 0.3, lodgeAnger: 15, fightN: 2, trialChance: 0.25 };
export const hatchClean = s => s.dagonPact === "join" || rOf(s) >= ALLIED;
export function hatchIssue(s) {
  if ((s.res[EGG.res] || 0) < 1) return "no Deep One egg";
  if (s.hatch) return "an egg is already hatching";
  return null;
}
// church rep: members in the Church lose it; with none yet, the debt waits for the first to join (guildFavour)
export function hatchEgg(s, guildsOf) {
  if (hatchIssue(s)) return false;
  s.res[EGG.res] -= 1;
  s.hatch = { day: s.day || 0, due: (s.day || 0) + EGG.days, clean: hatchClean(s) };
  const ms = (s.members || []).filter(m => m.alive).flatMap(m => (guildsOf ? guildsOf(m) : []).filter(g => g.id === "church"));
  for (const g of ms) g.rep -= EGG.churchCost;
  if (!ms.length) (s.guildFavour ||= {}).church = ((s.guildFavour || {}).church || 0) - EGG.churchCost;
  log(s, "🥚 You set a Deep One egg in a tub of salt water. The Church will hear of it. It should hatch in " + EGG.days + " days.");
  return true;
}
export function hatchDay(s, addMinion) {
  if (!s.hatch || (s.day || 0) < s.hatch.due) return;
  const h = s.hatch;
  delete s.hatch;
  if (!h.clean) {
    dagonFavour(s, -EGG.lodgeAnger);
    if (rng() < EGG.badChance) return void log(s, "🥚 The egg splits, and something small and grey dies in the tub. The Lodge knows you took one of theirs.");
    log(s, "🥚 The Lodge knows you hatched one of theirs, and is not pleased.");
  }
  return addMinion(s, "deepone", "hatched from a Deep One egg");
}
