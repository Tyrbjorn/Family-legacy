// Minimal day/night: the fraction of the current game day (s.acc) sets the time of day.
// Night spans tuning.dayNight.nightStart → nightEnd (wrapping past midnight).
import { T } from "./state.js";

const DN = () => T.dayNight || { nightStart: 0.75, nightEnd: 0.2 };
export const timeOfDay = s => (((s && s.acc) || 0) % 1 + 1) % 1;
export const isNight = s => {
  const t = timeOfDay(s), d = DN();
  return t >= d.nightStart || t < d.nightEnd;
};
export const nightShare = () => 1 - DN().nightStart + DN().nightEnd;
export const todLabel = s => (isNight(s) ? "🌙 Night" : "☀️ Day");
