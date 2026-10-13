// Four-season cycle: yields, gathering, travel speed, event odds and prices.
import { D } from "./state.js";

const NONE = { id: "none", name: "", icon: "", yield: {}, gather: 1, travel: 1, events: 1, price: {} };

export function season(s) {
  const L = D.seasons && D.seasons.list;
  if (!L || !L.length) return NONE;
  const y = D.tuning.daysPerYear;
  return L[Math.floor(((s.day % y) / y) * L.length)];
}

export const seasonDay = s => (s.day % D.tuning.daysPerYear) % Math.ceil(D.tuning.daysPerYear / 4);
export const seasonYield = (s, res) => season(s).yield[res] || 1;
export const seasonGather = s => season(s).gather || 1;
export const seasonTravel = s => season(s).travel || 1;
export const seasonEvents = s => season(s).events || 1;
export const seasonPrice = (s, res) => season(s).price[res] || 1;
