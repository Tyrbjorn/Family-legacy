import { resName } from "./resname.js";
import { dwarfSpouse } from "./dwarves.js";
import { findId } from "./lookup.js";
// Marriage depth: suitor personalities, visible traits, houses, courtship stages and patience,
// dowries both ways (marrying in / marrying out) and household effects of spouse personalities.
import { conflicts, level } from "./family.js";
import { rollTraits } from "./traits.js";
import { addRapport, atWar, houseDef, houseList, tierFx, tierOf } from "./houses.js";
import { offersMarriage } from "./families.js";
import { endWar } from "./war.js";
import { addRenown } from "./legacy.js";
import { D, NAMES, active, ageY, isAdult, living, log, r, rng } from "./state.js";

export const MC = () => D.marriage;
export const personas = () => MC().personalities;
export const personaDef = id => personas().find(p => p.id === id) || null;

// ---- suitors
export function makeSuitor(s, opts = {}) {
  const g = opts.gender || r(["m", "f"]);
  const houses = houseList().filter(h => tierFx(s, h.id).suitors && offersMarriage(s, h.id)); // R48 families.json marriage
  // a third of suitors are commoners, so offers never dry up even if every house is hostile
  const hd = opts.house !== undefined ? houseDef(opts.house) : houses.length && rng() < 0.67 ? r(houses) : null;
  const p = r(personas());
  const fav = p.favors.find(t => D.traits.some(x => x.id === t));
  const traits = rollTraits(s, 2, fav ? [fav] : []);
  const su = {
    id: "su" + s.day + (opts.tag || ""),
    name: r(NAMES[g]),
    gender: g,
    cls: r(D.classes.filter(c => c.tier === 0 && !c.line)).id,
    affinity: 0,
    age: 18 + Math.floor(rng() * 8),
    persona: p.id,
    traits,
    house: hd ? hd.id : null,
    arrived: s.day,
    stage: 0,
  };
  su.dowry = dowryOf(s, su);
  return su;
}

export function ensureSuitor(s, su) {
  if (su.persona === undefined) su.persona = null;
  if (su.house === undefined) su.house = null;
  if (su.arrived == null) su.arrived = s.day;
  if (su.stage == null) su.stage = 0;
  if (!su.dowry) su.dowry = dowryOf(s, su);
  return su;
}

export function dowryOf(s, su) {
  const dw = MC().dowry,
    hd = su.house && houseDef(su.house);
  const wealth = hd ? hd.wealth : 0.5,
    mult = hd ? tierFx(s, hd.id).dowryMult || 0 : 1;
  const coin = Math.round(dw.coinPerWealth * wealth * mult);
  const res = {};
  if (hd && mult > 0) res[dw.res[(hd.id.length + hd.wealth) % dw.res.length]] = Math.round(dw.resPerWealth * wealth * mult);
  return { coin, res };
}

export const stageOf = aff => [...MC().stages].reverse().find(st => aff >= st.at) || MC().stages[0];
export const leavesIn = (s, su) => (su.affinity >= 100 ? Infinity : Math.max(0, (su.arrived ?? s.day) + MC().stayDays - s.day));

// courting speed: liked stat + house rapport
export function courtMult(s, m, su) {
  const p = personaDef(su.persona);
  let x = 1;
  if (p && (m.stats[p.likesStat] || 0) >= MC().likedStatAt) x *= MC().likedStatMult;
  const hb = su.house ? tierFx(s, su.house).courtMult || 0 : 0;
  return x * (1 + hb);
}

export function noteStage(s, m, su) {
  const st = MC().stages.findIndex(x => x === stageOf(su.affinity));
  if (st > (su.stage || 0)) {
    su.stage = st;
    if (MC().stages[st].at === 60) log(s, `💕 ${m.name} and ${su.name} are sweethearts.`);
  }
}

// R84 (D14): a suitor's starting class likes one craft gift (data/marriage.json classGifts); x classGiftMult, stacking with the persona
// liked-gift bonus (x2.25 when both). Luxury gifts (Amber Brooch, Wedding Cloth Bolt) match no class. Crafted ids ("c|id|quality") are unwrapped.
const giftBase = id => String(id).replace(/^c\|/, "").split("|")[0];
export const likedGift = (su, id) => (personaDef(su.persona) || {}).likesGift === giftBase(id); // R84: crafted ids ("c|id|quality") are unwrapped, as for classLiked
export const classLiked = (su, id) => !!su && !!(MC().classGifts || {})[su.cls] && (MC().classGifts || {})[su.cls] === giftBase(id);
export const giftMult = (su, id) => (likedGift(su, id) ? MC().likedGiftMult : 1) * (classLiked(su, id) ? MC().classGiftMult || 1 : 1);

// food from the larder as a courting gift (ties the food chains in)
export function foodGiftIssue(s, su, k) {
  if (!(k in (D.estate.meals || { menu: {} }).menu) || k === "food") return "not a dish";
  if ((s.res[k] || 0) < MC().foodGift.units) return `${MC().foodGift.units} ${resName(k)}`;
  if (su.affinity >= 100) return "already smitten";
  return null;
}
export function giveFoodGift(s, suitorId, k) {
  const su = findId(s.suitors, suitorId);
  if (!su || foodGiftIssue(s, su, k)) return false;
  s.res[k] -= MC().foodGift.units;
  su.affinity = Math.min(100, su.affinity + MC().foodGift.affinity * giftMult(su, k));
  return true;
}

// called by the suitors day hook: impatient suitors leave (jilting a house sours it), new ones arrive
export function suitorsTick(s) {
  for (const su of [...s.suitors]) {
    ensureSuitor(s, su);
    if (leavesIn(s, su) > 0) continue;
    s.suitors = s.suitors.filter(x => x !== su);
    for (const m of living(s)) if (m.action && m.action.type === "court" && m.action.target === su.id) m.action = null;
    const jilted = su.affinity >= MC().jiltAt && su.house;
    log(s, `💌 ${su.name} grew tired of waiting and left town${jilted ? "." : "."}`);
    if (jilted) addRapport(s, su.house, D.families.jilt, `${su.name} was jilted`);
  }
}

// ---- marrying in: dowry + house ties
export function applyMarriage(s, m, sp, su) {
  ensureSuitor(s, su);
  if (su.traits && su.traits.length) sp.traits = su.traits.filter((t, i, a) => !a.slice(0, i).some(o => conflicts(o, t)));
  sp.persona = su.persona;
  sp.house = su.house;
  dwarfSpouse(s, sp); // R56 a dwarf of Clan Ironbrow
  const d = su.dowry || { coin: 0, res: {} };
  s.res.coin += d.coin;
  for (const [k, v] of Object.entries(d.res || {})) s.res[k] = (s.res[k] || 0) + v;
  const dw = [d.coin ? d.coin + " coin" : "", ...Object.entries(d.res || {}).map(([k, v]) => v + " " + k)].filter(Boolean).join(", ");
  if (dw) log(s, `💍 ${sp.name} brought a dowry: ${dw}.`);
  if (su.house) {
    if (atWar(s, su.house)) endWar(s, su.house, "marriage");
    addRapport(s, su.house, D.families.marryIn, "marriage");
  }
}

// ---- marrying out: pay a dowry, the member joins the other house, rapport rises
export const marryOutDowry = m => MC().marryOut.dowryBase + MC().marryOut.dowryPerLevel * level(m);
export function marryOutIssue(s, memberId, houseId) {
  const m = s.members.find(x => x.id === memberId && x.alive),
    hd = houseDef(houseId);
  if (!m || !hd) return "missing";
  if (m.id === s.activeId) return "not the active heir";
  if (m.spouse) return "already married";
  if (ageY(m) < MC().marryOut.minAge || !isAdult(m)) return `age ${MC().marryOut.minAge}+`;
  if (living(s).length < 2) return "the family needs someone left at home";
  if (!atWar(s, houseId) && ["feud", "rival"].includes(tierOf(s, houseId))) return `${hd.name} refuses (rapport too low)`;
  if (s.res.coin < marryOutDowry(m)) return `${marryOutDowry(m)} coin dowry`;
  return null;
}
export function marryOut(s, memberId, houseId) {
  if (marryOutIssue(s, memberId, houseId)) return false;
  const m = findId(s.members, memberId),
    hd = houseDef(houseId);
  s.res.coin -= marryOutDowry(m);
  m.alive = false;
  m.marriedOut = houseId;
  m.leftDay = s.day;
  m.action = null;
  log(s, `💍 ${m.name} married into ${hd.name} (dowry ${marryOutDowry(m)} coin).`);
  if (atWar(s, houseId)) endWar(s, houseId, "marriage");
  addRapport(s, houseId, MC().marryOut.rapport, "marriage");
  const a = active(s);
  if (a) addRenown(s, a, MC().marryOut.renown);
  return true;
}

// ---- household effects of married-in spouses' personalities
export function household(s, key) {
  let v = 0;
  for (const m of living(s)) {
    const p = m.persona && personaDef(m.persona);
    if (p) v += p.household[key] || 0;
  }
  return v;
}
export const householdList = s =>
  living(s)
    .filter(m => m.persona && personaDef(m.persona))
    .map(m => ({ who: m.name, p: personaDef(m.persona) }));

export function householdMonth(s) {
  const rm = household(s, "renownMonth");
  if (rm) s.renown = (s.renown || 0) + rm;
}
export const householdDay = s => {
  const c = household(s, "coinPerDay");
  if (c) s.res.coin += c;
  if (s.day % 30 === 0) householdMonth(s);
};
