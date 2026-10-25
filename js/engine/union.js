// R75 Union Hall (data/fields.json -> union). A convenience building for the home quarter, bought in three tiers:
//   T1 Warehouse: producers skip the haul pile (auto collect), one teamster stays on hall duty
//   T2 Hauler's Guild: +2 teamster spots, teamsters haul x1.5, one teamster retires as the foreman
//   T3 Freight Exchange: reach for estates in other quarters (expansion), two more teamsters on hall duty
// Saved state is only s.union = { tier } and only after the first purchase, so old saves need no migration.
// Leaf module (state + builders only) so fields.js and minions.js can both import it.
import { D, afford, pay, log } from "./state.js";
import { bcost } from "./builders.js";
import { itemDef } from "./inventory.js";

export const UH = () => ((D.fields || {}).union) || null;
export const unionTiers = () => (UH() || {}).tiers || [];
export const unionTier = s => (UH() && s.union && s.union.tier | 0) || 0;
export const unionTierDef = s => unionTiers()[unionTier(s) - 1] || null;
export const unionNext = s => unionTiers()[unionTier(s)] || null;
const ups = s => (s.fields && s.fields.ups) || {};
const teamsters = s => (s.minions || []).filter(x => x.job === "teamster");

// teamsters on hall duty: one from T1, two more at T3 (the hall's own work, taken out of the haul rate)
export const unionTied = s => {
  const t = unionTier(s), u = UH();
  return t >= 1 ? (u.tiedBase || 1) + (t >= 3 ? unionTiers()[2].tied || 0 : 0) : 0;
};
// the hall works while a teamster is on duty (housed and not paused)
export const unionActive = s => unionTier(s) >= 1 && teamsters(s).some(x => !x.unhoused && !x.paused);
export const unionSpots = s => (unionTier(s) >= 2 ? unionTiers()[1].teamsterSpots || 0 : 0);
export const unionHaulMult = s => (unionTier(s) >= 2 ? unionTiers()[1].haulMult || 1 : 1);

// Wagon items in the vault (plain or crafted ids), cheapest first; the rest of the need is paid at the Wagon's coin value
const wagonId = id => { const b = String(id).split("#")[0].split("~")[0]; return b.startsWith("c|") ? b.split("|")[1] : b; };
export const vaultWagons = s => (s.vault || []).map((id, i) => ({ id, i })).filter(x => wagonId(x.id) === ((UH() || {}).wagonItem || "wagon")).sort((a, b) => ((itemDef(a.id) || {}).value || 0) - ((itemDef(b.id) || {}).value || 0));
export const wagonValue = () => (itemDef((UH() || {}).wagonItem || "wagon") || { value: 300 }).value;
// what the next tier costs right now: price (resources, after builder discounts), wagons from the vault, wagons bought at value, fees
export function unionQuote(s) {
  const t = unionNext(s);
  if (!t) return null;
  const cost = { ...bcost(s, t.cost, "hub", true) };
  const have = Math.min(t.wagons || 0, vaultWagons(s).length), buy = (t.wagons || 0) - have;
  const fees = Object.values(t.fees || {}).reduce((a, v) => a + v, 0);
  const total = { ...cost, coin: (cost.coin || 0) + buy * wagonValue() + fees };
  return { tier: t, cost, total, wagonsOwned: have, wagonsBought: buy, fees, foreman: t.foreman || 0 };
}
export function unionIssue(s) {
  const u = UH();
  if (!u) return "max";
  if (!unionNext(s)) return "max";
  if (unionTier(s) === 0) {
    if (!u.gate.ups.every(id => ups(s)[id])) return "needs Cart Shed + Second Wagon";
    if (u.gate.teamster && !teamsters(s).length) return "needs a teamster";
  }
  const q = unionQuote(s);
  if (!afford(s, q.total)) return "cannot afford";
  if (q.foreman && teamsters(s).length < q.foreman) return "needs a teamster to become foreman";
  return null;
}
export function unionBuy(s) {
  if (unionIssue(s)) return false;
  const q = unionQuote(s), t = q.tier;
  pay(s, q.total);
  const w = vaultWagons(s).slice(0, q.wagonsOwned).map(x => x.i).sort((a, b) => b - a);
  for (const i of w) s.vault.splice(i, 1);
  for (let n = 0; n < q.foreman; n++) { const i = (s.minions || []).findIndex(x => x.job === "teamster"); if (i >= 0) s.minions.splice(i, 1); }
  s.union = { tier: unionTier(s) + 1 };
  log(s, `🏛️ ${UH().name}: ${t.name} built.`);
  return true;
}

// easy hiring (any tier): hire laborers from the hall at a discount, no trip to town
export const unionHireTypes = s => (unionTier(s) >= 1 ? UH().hire.types : []);
export const unionHireFee = fee => Math.round(fee * ((UH() || { hire: { feeMult: 1 } }).hire.feeMult));
