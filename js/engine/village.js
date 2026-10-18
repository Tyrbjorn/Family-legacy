import { choreFx } from "./chores.js";
// Personal village (Era 3): founded by the Baron's charter quest (data/quests.json q_charter grants it).
// Village buildings live in s.structures with site "village": they use village slots, not land; production
// types take slotsPer slots, make outMult× output with jobMult× follower spots (estate-pieces scaledPiece),
// cost coinMult× the estate coin + matMult× its materials and pay a monthly upkeep share of that coin.
// Each building is a construction project fed by deliveries (one at a time). An estate building can be relocated
// (half its cost refunded; pieces, tier and workers move) or kept.
import { D, afford, log, pay } from "./state.js";
import { ES, demolishRefund, reserveOf, structDef } from "./estate.js";
import { registerDayHook } from "./time.js";

const V = () => ES().village;
export const isVillage = st => st.site === "village";
export const villageTier = s => (s.village ? V().tiers[s.village.tier] : null);
export const villageSlots = s => (villageTier(s) || {}).slots || 0;
const vSlots = d => (V().types.includes(d.id) ? V().slotsPer : d.land || 1);
export const villageUsed = s => (s.structures || []).filter(isVillage).reduce((a, st) => a + vSlots(structDef(st.type)), 0);
export const villageTypes = () => [...V().types, ...ES().structures.filter(d => d.villageOnly).map(d => d.id)];

export const villageUpIssue = s => {
  const nx = s.village && V().tiers[s.village.tier + 1];
  return !s.village ? "no village" : !nx ? "max" : !afford(s, nx.cost) ? "cannot afford" : null;
};
export function upgradeVillage(s) {
  if (villageUpIssue(s)) return false;
  pay(s, V().tiers[++s.village.tier].cost);
  log(s, `🏘️ The village grew into a ${villageTier(s).name} (${villageSlots(s)} slots).`);
  return true;
}

// village price: coinMult× the estate coin, matMult× the other materials; built straight at a tier adds that tier chain
export function villageCost(type, tier = 0) {
  const d = structDef(type);
  if (d.villageOnly) return { ...d.cost };
  const out = {};
  for (const [k, v] of Object.entries(d.cost || {})) out[k] = v * (k === "coin" ? V().coinMult : V().matMult);
  for (const t of (d.tiers || []).slice(0, tier)) for (const [k, v] of Object.entries(t.cost)) out[k] = (out[k] || 0) + v;
  for (const [k, v] of Object.entries((V().tierStone || {})[tier] || {})) out[k] = (out[k] || 0) + v; // higher tiers need higher stone ranks
  return out;
}
// any tier the family has already raised (anywhere) may be built directly
export const maxTier = (s, type) => Math.max(0, ...(s.structures || []).filter(x => x.type === type).map(x => x.tier || 0));

// ---- building a village is one construction project at a time (a resource request): pick a building, then
// deliver its coin and materials in any number of parts; it rises when everything is in. Relocation is a project too.
export const project = s => (s.village || {}).project || null;
const left = p => Object.fromEntries(Object.entries(p.need).map(([k, v]) => [k, v - (p.paid[k] || 0)]).filter(([, v]) => v > 0));
export const projectLeft = s => (project(s) ? left(project(s)) : {});

export function villageBuildIssue(s, type, tier = 0) {
  const d = structDef(type);
  if (!s.village) return "found a village first";
  if (project(s)) return "a project is underway";
  if (!d || !villageTypes().includes(type)) return "not a village building";
  if (tier > maxTier(s, type)) return "raise that tier on the estate first";
  if (villageUsed(s) + vSlots(d) > villageSlots(s)) return "no free village slot";
  return null;
}
export function relocateIssue(s, uid) {
  const st = (s.structures || []).find(x => x.uid === uid);
  if (!st || isVillage(st)) return "missing";
  if (!s.village) return "found a village first";
  if (project(s)) return "a project is underway";
  if (!V().types.includes(st.type)) return "stays on the estate";
  if (villageUsed(s) + V().slotsPer > villageSlots(s)) return "no free village slot";
  return null;
}
const begin = (s, p) => ((s.village.project = { ...p, paid: {} }), log(s, `🏗️ Village project: ${projectName(p)}. Deliver ${Object.entries(p.need).map(([k, v]) => v + " " + k).join(", ")}.`), true);
export const projectName = p => (p.uid ? "move the " : "build a ") + structDef(p.type).name + (p.tier ? ` (${structDef(p.type).tiers[p.tier - 1].name})` : "");
export const buildVillage = (s, type, tier = 0) => !villageBuildIssue(s, type, tier) && begin(s, { type, tier, need: villageCost(type, tier) });
export function relocate(s, uid) {
  if (relocateIssue(s, uid)) return false;
  const st = s.structures.find(x => x.uid === uid);
  return begin(s, { type: st.type, uid, need: villageCost(st.type) });
}
// hand over up to n of one resource (all that is left when n is omitted); finishes the project when complete
export function deliver(s, k, n = Infinity) {
  const p = project(s),
    need = p && (left(p)[k] || 0),
    give = Math.floor(Math.min(need, n, s.res[k] || 0));
  if (give <= 0) return 0;
  s.res[k] -= give;
  p.paid[k] = (p.paid[k] || 0) + give;
  if (!Object.keys(left(p)).length) finish(s, p);
  return give;
}
export const deliverAll = s => Object.keys(projectLeft(s)).reduce((a, k) => a + deliver(s, k), 0);
export function cancelProject(s) {
  const p = project(s);
  if (!p) return false;
  for (const [k, v] of Object.entries(p.paid)) s.res[k] = (s.res[k] || 0) + v;
  delete s.village.project;
  log(s, `🏗️ Village project cancelled; deliveries returned.`);
  return true;
}
function finish(s, p) {
  delete s.village.project;
  if (p.uid) {
    const st = s.structures.find(x => x.uid === p.uid);
    if (!st) return;
    const r = demolishRefund(st);
    for (const [k, v] of Object.entries(r)) s.res[k] = (s.res[k] || 0) + v;
    Object.assign(st, { site: "village", vcost: p.need.coin || 0 });
    return void log(s, `🏘️ The ${structDef(st.type).name} now works in the village (estate half-refund: ${Object.entries(r).map(([k, v]) => v + " " + k).join(", ")}).`);
  }
  const d = structDef(p.type), tier = p.tier || 0;
  const fixed = [...(d.tiers || []).slice(0, tier).reverse().flatMap(t => t.fixed || []), ...(d.fixed || [])];
  s.structures.push({ uid: "st" + s.nextId++, type: p.type, pieces: fixed, up: 0, site: "village", vcost: p.need.coin || 0, ...(tier ? { tier } : {}) });
  log(s, `🏘️ Village project done: a new ${d.name}.`);
}
// Auto Deliver (toggle): each day feeds the project from surplus only: coin above autoCoin, materials above
// their reserve (the player's keep-in-reserve settings)
export const toggleAutoDeliver = s => s.village && (s.village.auto = !s.village.auto);
function autoDeliver(s) {
  for (const k of Object.keys(projectLeft(s))) {
    const keep = k === "coin" ? V().autoCoin : reserveOf(s, k);
    deliver(s, k, (s.res[k] || 0) - keep);
  }
}

// monthly upkeep; an unpaid building stops producing until the next paid month
export const upkeepMult = s => Math.max(0.5, 1 + choreFx(s, "upkeep") - (s.reqPerks || []).filter(p => p.type === "upkeep").reduce((a, p) => a + p.pct, 0)); // R42 errands + Reeve
export const villageUpkeep = s => (s.structures || []).filter(isVillage).reduce((a, st) => a + Math.round((st.vcost || 0) * V().upkeep * upkeepMult(s)), 0);
export function villageDay(s) {
  if (!s.village) return;
  if (s.village.auto && project(s)) autoDeliver(s);
  if (s.day % 30) return;
  for (const st of s.structures.filter(isVillage)) {
    const fee = Math.round((st.vcost || 0) * V().upkeep * upkeepMult(s));
    if ((s.res.coin || 0) >= fee) (s.res.coin -= fee), delete st.unpaid;
    else st.unpaid = true;
  }
}
registerDayHook("village", villageDay);
