import { effects } from "./estate.js";

// Pure game engine (no DOM). Works in browser and Node.
export const SAVE_VERSION = 1;

export let D, T;

// data, tuning
export function setData(d) {
  D = d;
  T = d.tuning;
}

export const STATS = ["STR", "AGI", "INT", "WIL", "CHA", "VIT"];

export const NAMES = {
  m: ["Aldric", "Tobin", "Bram", "Corin", "Edric", "Fenn", "Garret", "Hale", "Ivo", "Joren", "Kell", "Lorn"],
  f: ["Mara", "Ysolde", "Brina", "Cela", "Dara", "Elsa", "Faye", "Greta", "Hilde", "Isla", "Jessa", "Lira"],
};

export let rng = Math.random;

export function setRng(f) {
  rng = f;
}

export const r = a => a[Math.floor(rng() * a.length)];

export const Y = () => T.daysPerYear;

export const ageY = m => Math.floor(m.ageDays / Y());

export const xpNeed = l => T.xpBase * Math.pow(T.xpGrowth, l);

export const bl = (s, id) => s.buildings[id] || 0;

export const furn = (s, k) => effects(s);

export function log(s, msg) {
  s.log.unshift({ d: s.day, msg });
  if (s.log.length > 80) s.log.length = 80;
}

export const living = s => s.members.filter(m => m.alive);

export const active = s => s.members.find(m => m.id === s.activeId);

export const isAdult = m => ageY(m) >= T.adultAge;

export const known = (s, x) => !x.hidden || s.revealed.includes(x.id);

export function cost(s, b) {
  const lv = s.buildings[b.id];
  return Object.fromEntries(
    Object.entries(b.cost).map(([k, v]) => [k, Math.round(v * Math.pow(T.buildCostMult, lv))]),
  );
}

export const afford = (s, c) => Object.entries(c).every(([k, v]) => s.res[k] >= v);

export const pay = (s, c) => {
  for (const [k, v] of Object.entries(c)) s.res[k] -= v;
};
