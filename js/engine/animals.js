// R41 simple animals (base game): the Chicken Coop and Cow Pen keep BOUGHT hens/cows, eat feed (world.feed),
// need ~1 h of tending a day (shared with field workers), and their eggs/milk wait at the building for haul.
// All numbers live in data/fields.json → animals. No breeding, butchering or water (expansion).
import { D, afford, pay, log } from "./state.js";
import { structDef } from "./estate.js";
import { herdHead, herdMax } from "./world.js";

export const AN = () => (D.fields && D.fields.animals) || { types: {} };
export const animalTypes = () => Object.keys(AN().types || {});
export const animalDef = type => (AN().types || {})[type];
const st = s => (s.fields ||= { list: [], ups: {}, auto: {}, pile: {}, extraSlots: 0, last: null });
// after R41 a herd building starts EMPTY unless animals were bought (old saves kept theirs at save step 39)
export const animalsExplicit = s => !!(s.fields && s.fields.animalsExplicit);
export const buildingCount = (s, type) => (s.structures || []).filter(x => x.type === type && !x.unpaid).length;
// extra animal spots from the one '+spots' upgrade (per building)
export const spotsBonus = (s, type) => {
  const d = animalDef(type);
  return d && d.spotsUp && s.fields && (s.fields.ups || {})[d.spotsUp.id] ? d.spotsUp.add * buildingCount(s, type) : 0;
};
export function buyAnimalsIssue(s, type) {
  const d = animalDef(type);
  if (!d) return "unknown";
  if (!buildingCount(s, type)) return `Build a ${structDef(type)?.name || type} first`;
  if (herdHead(s, type) >= herdMax(s, type)) return "No room: all spots full";
  if (!afford(s, d.buy.cost)) return "Not enough coin";
  return "";
}
export function buyAnimals(s, type) {
  if (buyAnimalsIssue(s, type)) return false;
  const d = animalDef(type);
  pay(s, d.buy.cost);
  const n = Math.min(d.buy.n, herdMax(s, type) - herdHead(s, type));
  (s.herds ||= {})[type] = herdHead(s, type) + n;
  log(s, `${d.icon} Bought ${n} ${n === 1 ? d.name.replace(/s$/, "").toLowerCase() : d.name.toLowerCase()}.`);
  return true;
}
export function spotsUpIssue(s, type) {
  const d = animalDef(type);
  if (!d || !d.spotsUp) return "none";
  if ((st(s).ups || {})[d.spotsUp.id]) return "Already built";
  if (!buildingCount(s, type)) return `Build a ${structDef(type)?.name || type} first`;
  if (!afford(s, d.spotsUp.cost)) return "Not enough resources";
  return "";
}
export function buySpotsUp(s, type) {
  if (spotsUpIssue(s, type)) return false;
  const d = animalDef(type);
  pay(s, d.spotsUp.cost);
  st(s).ups[d.spotsUp.id] = true;
  log(s, `${d.icon} ${d.spotsUp.name} built (+${d.spotsUp.add} spots).`);
  return true;
}
// tending share used by production (yesterday's tending; 1 before the first day)
export const tendShare = (s, type) => {
  const t = s.fields && s.fields.animalTend && s.fields.animalTend[type];
  return t == null ? 1 : t;
};
// called from fieldsDay with the shared worker list (after fields are tended)
export function animalsTend(s, W, last, capOf, have) {
  const f = st(s);
  f.animalTend ||= {};
  last.animals = {};
  for (const type of animalTypes()) {
    const d = animalDef(type), n = herdHead(s, type), b = buildingCount(s, type);
    if (!b || !n) { delete f.animalTend[type]; continue; }
    const fed = !((s.unfed || {})[type] > 0);
    if (AN().restWhenFull && f.auto.tend !== false && have(d.out) >= capOf(d.out)) {
      f.animalTend[type] = 1;
      last.animals[type] = { state: "full", n, fed };
      continue;
    }
    const need = (d.hours || 1) * b;
    let got = 0;
    if (f.auto.tend !== false)
      for (const w of W) {
        if (got >= need - 1e-9) break;
        const t = Math.min(w.left, need - got);
        w.left -= t; got += t; last.used += t;
      }
    last.need += need;
    const share = got / need;
    f.animalTend[type] = Math.max(AN().untended ?? 0.25, share);
    last.animals[type] = { state: !fed ? "no feed" : share >= 0.999 ? "tended" : share > 0 ? "partly tended" : "untended", n, fed, share };
  }
}
// save step 39: old buildings keep the animals they have now; new ones start empty
export function migrateAnimals(s) {
  for (const type of animalTypes()) {
    const max = herdMax(s, type);
    if (!max) continue;
    (s.herds ||= {})[type] = Math.min(max, s.herds[type] ?? max);
  }
  st(s).animalsExplicit = true;
}
