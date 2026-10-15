import { introNote } from "./intros.js";
// Stronghold-style food: everyone eats evenly from every food on the menu each day.
// Variety (distinct foods actually eaten) gives satiation + morale with diminishing returns;
// the ration level trades consumption for morale; shortages drag morale (and so output) down.
import { ES, eff, reserveOf } from "./estate.js";
import { D, living } from "./state.js";
import { famFx } from "./paths.js";
import { household } from "./courtship.js";
import { wearyMorale } from "./war.js";

export const MEALS = () => ES().meals;
export const RATIONS = () => MEALS().rations;
export const rationDef = s => RATIONS().find(r => r.id === (s.ration || "normal")) || RATIONS()[2];

export function setRation(s, id) {
  if (!RATIONS().some(r => r.id === id)) return false;
  s.ration = id;
  introNote(s, "ration");
  return true;
}

export const menuKeys = () => Object.keys(MEALS().menu);
export const onMenu = (s, k) => (k in MEALS().menu ? ((s.diet || {})[k] ?? !MEALS().defaultOff.includes(k)) : false);

export function toggleDiet(s, k) {
  if (!(k in MEALS().menu) || k === "food") return false;
  if (!s.diet) s.diet = {};
  s.diet[k] = !onMenu(s, k);
  return true;
}

// food value of one unit: base value × quality (quality from cooks, stations and farmers)
export const unitValue = (s, k) => MEALS().menu[k] * ((s.foodQ || {})[k] || 1);
const edible = (s, k) => Math.max(0, (s.res[k] || 0) - (k === "food" ? 0 : reserveOf(s, k)));

export const mouths = s => living(s).length + (s.minions || []).length * ES().minionFoodPerDay;

export const varietyMorale = n => {
  const v = MEALS().varietyMorale;
  return v[Math.min(n, v.length - 1)];
};
export const satiation = n => 1 - Math.min(MEALS().satiationCap, MEALS().varietySatiation * Math.max(0, n - 1));

// what would be eaten today (types with stock, on the menu)
export const servable = s => menuKeys().filter(k => onMenu(s, k) && edible(s, k) >= 0.01);

export const dailyNeed = (s, n = servable(s).length) =>
  mouths(s) * rationDef(s).mult * satiation(n) * Math.max(0.5, 1 + household(s, "foodNeed"));

export const stockValue = (s, keys = servable(s)) => keys.reduce((a, k) => a + edible(s, k) * unitValue(s, k), 0);

export const daysOfStock = s => {
  const n = dailyNeed(s);
  return n > 0 ? stockValue(s) / n : Infinity;
};

// consume `need` food value evenly across the given foods; returns {eaten, used:{k:units}}
export function eatEvenly(s, keys, need) {
  let left = need,
    av = keys.filter(k => edible(s, k) > 1e-9);
  const used = {};
  while (left > 1e-9 && av.length) {
    const share = left / av.length;
    for (const k of av) {
      const v = unitValue(s, k),
        give = Math.min(share, edible(s, k) * v),
        u = give / v;
      s.res[k] -= u;
      used[k] = (used[k] || 0) + u;
      left -= give;
    }
    av = av.filter(k => edible(s, k) > 1e-9);
  }
  return { eaten: need - left, used };
}

export function eatDay(s) {
  const M = MEALS(),
    keys = servable(s),
    need = dailyNeed(s, keys.length);
  let { eaten, used } = eatEvenly(s, keys, need);
  const menu = Object.keys(used).filter(k => used[k] > 1e-6);
  // never starve with food in the larder: off-menu foods are eaten as a last resort (no variety credit)
  let emergency = [];
  if (need - eaten > 1e-9) {
    const off = menuKeys().filter(k => !onMenu(s, k));
    const e2 = eatEvenly(s, off, need - eaten);
    eaten += e2.eaten;
    emergency = Object.keys(e2.used).filter(k => e2.used[k] > 1e-6);
  }
  const ratio = need > 0 ? eaten / need : 1;
  const short = mouths(s) > 0 && rationDef(s).mult > 0 ? 1 - ratio : 0;
  const drinks = menu.reduce((a, k) => a + ((M.drinks || {})[k] || 0), 0);
  const target = Math.max(
    M.min,
    Math.min(
      M.max,
      rationDef(s).morale +
        varietyMorale(menu.length) +
        (menu.length > 1 ? famFx(s, "variety") : 0) +
        drinks +
        M.shortageMorale * short +
        household(s, "morale") +
        eff(s, "familyMorale") +
        wearyMorale(s),
    ),
  );
  s.morale = (s.morale || 0) + (target - (s.morale || 0)) * M.smoothing;
  s.meal = { need, eaten, ratio, short, menu, emergency, variety: menu.length, target, fed: short < 0.01 };
  tonicDay(s);
  return s.meal;
}

function tonicDay(s) {
  const t = MEALS().tonics || {};
  s.tonics = {};
  for (const [k, d] of Object.entries(t))
    if (d.perDay && (s.res[k] || 0) >= d.perDay) {
      s.res[k] -= d.perDay;
      s.tonics[k] = true;
    }
}

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const morale = s => s.morale || 0;
export const starving = s => !!s.meal && s.meal.short > 0.5;
export const isFed = s => !s.meal || s.meal.fed;
export const foodOutputMult = s => {
  const M = MEALS();
  return clamp(1 + morale(s) * M.outputPerMorale, M.outputMin, M.outputMax);
};
// morale → skill XP and character speed (tuning.json "morale"): neutral 0, high ≈ +10%, starving ≈ −15%
const TM = () => D.tuning.morale || { xpPerPoint: 0, speedPerPoint: 0 };
export const moraleXp = s => clamp(morale(s) * TM().xpPerPoint, TM().xpMin, TM().xpMax);
export const moraleSpeed = s => clamp(morale(s) * TM().speedPerPoint, TM().speedMin, TM().speedMax);
export const mealHeal = s => (morale(s) >= MEALS().healAtMorale ? MEALS().heal : 0);
export const tonicXp = (s, family) =>
  Object.entries(MEALS().tonics || {}).reduce(
    (a, [k, d]) => a + ((s.tonics || {})[k] && d.family === family ? d.xp : 0),
    0,
  );

// summary for the Food panel
export function foodPanel(s) {
  const keys = servable(s);
  const bonuses = [];
  const vm = varietyMorale(keys.length),
    sat = 1 - satiation(keys.length);
  if (sat > 0) bonuses.push(`Satiation −${Math.round(sat * 100)}% food eaten`);
  if (vm) bonuses.push(`Variety +${vm} morale`);
  const out = foodOutputMult(s) - 1,
    xp = moraleXp(s);
  if (Math.abs(out) > 0.004) bonuses.push(`Output ${out > 0 ? "+" : ""}${Math.round(out * 100)}%`);
  const sp = moraleSpeed(s);
  if (Math.abs(xp) > 0.004) bonuses.push(`Skill XP ${xp > 0 ? "+" : ""}${Math.round(xp * 100)}%`);
  if (Math.abs(sp) > 0.004) bonuses.push(`Speed ${sp > 0 ? "+" : ""}${Math.round(sp * 100)}% (work, activities, travel)`);
  if (mealHeal(s)) bonuses.push(`Healing +${mealHeal(s)}/day`);
  for (const k of Object.keys(s.tonics || {})) bonuses.push(`${k === "manatonic" ? "Mana tonic: +10% magic XP" : k}`);
  return {
    menu: keys,
    variety: keys.length,
    ration: rationDef(s),
    need: dailyNeed(s, keys.length),
    days: daysOfStock(s),
    morale: morale(s),
    bonuses,
    last: s.meal || null,
    all: menuKeys().map(k => ({ k, on: onMenu(s, k), have: s.res[k] || 0, value: unitValue(s, k) })),
  };
}
