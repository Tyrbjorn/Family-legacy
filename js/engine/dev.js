// Dev Mode: a runtime flag owned by the UI (own localStorage key, never in saves).
// Any game ticked while dev mode is on is marked s.devRun and stops earning achievements.
import { D } from "./state.js";

let DEV = false;
export const DEV_SPEEDS = [5, 10, 50];
export const devOn = () => DEV;
// R39.1: release builds (data/build.json channel "release") lock Dev Mode off for good: ?dev=1 does nothing.
let LOCKED = false;
export const devLocked = () => LOCKED;
export const releaseBuild = () => ((D.build || {}).channel || "dev") === "release";
export function lockDevMode() {
  LOCKED = true;
  DEV = false;
}
export const DEV_KEY = "fl-dev";
// launch: ?dev=1 enables + reveals, ?dev=0 disables; in a release build the key is wiped and nothing turns on
export function resolveDevMode(store, query) {
  if (releaseBuild()) {
    lockDevMode();
    store.removeItem(DEV_KEY);
    return { on: false, reveal: false, locked: true };
  }
  if (query === "1") store.setItem(DEV_KEY, "1");
  if (query === "0") store.removeItem(DEV_KEY);
  return { on: setDevMode(store.getItem(DEV_KEY) === "1"), reveal: query === "1", locked: false };
}
export function setDevMode(on) {
  DEV = !LOCKED && !!on;
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
      "thyme",
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
