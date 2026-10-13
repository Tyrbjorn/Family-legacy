// Dev Mode: a runtime flag owned by the UI (own localStorage key, never in saves).
// Any game ticked while dev mode is on is marked s.devRun and stops earning achievements.
import { D } from "./state.js";

let DEV = false;
export const DEV_SPEEDS = [5, 10, 50];
export const devOn = () => DEV;
export function setDevMode(on) {
  DEV = !!on;
  return DEV;
}
export function taintDev(s) {
  if (DEV && s && !s.devRun) s.devRun = true;
}

// Cheats (only work while dev mode is on).
export function devCheat(s, kind) {
  if (!DEV) return false;
  taintDev(s);
  if (kind === "coin") s.res.coin += 10000;
  else if (kind === "res") {
    for (const k of [
      "food",
      "wood",
      "stone",
      "herbs",
      "planks",
      "blocks",
      "ingots",
      "copper",
      "leather",
      "cloth",
      "hides",
      "potions",
      "dust",
    ])
      s.res[k] = (s.res[k] || 0) + 500;
  } else if (kind === "turbo") s.turbo.charge = (D.tuning.turboCapMin || 60) * 60;
  else if (kind === "tabs") s.craftUnlocked = true;
  else return false;
  return true;
}
