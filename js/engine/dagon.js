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
export const dagonFishMult = s => (s && s.dagonPact === "join" ? 1.25 : 1);
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
  if (s.dagonPact === "join" && (s.day || 0) % T.daysPerYear === 0 && s.day > 0 && rng() < DOWN_CHANCE) goDown(s);
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
