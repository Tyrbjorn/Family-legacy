// R47 Architects' Guild: one cost hook for every build (buildMult / bcost by tag) plus road works.
// Data: guilds.json build {cap, tags, defaultTag, specBoost}; classes.json role.build {tag: share, all: share},
// role.resCut {res: share}; structures carry an optional `tag` (default "estate"); Builder's Yard buildDisc and
// the Drafting Room fitting's upCut add to it. The family's best holder (main or second class) counts per tag.
import { findId } from "./lookup.js";
import { memberGuild } from "./guilds.js";
import { D, afford, living, log, pay } from "./state.js";

const BG = () => D.guilds.build || { cap: 0, tags: [] };
const sdef = id => (D.estate.structures || []).find(x => x.id === id);
const pdef = id => (D.estate.pieces || []).find(x => x.id === String(id).split("@")[0]);
// [member, class def] for every living member's main and second class that carries a role
export const roleHolders = s => (s && s.members ? living(s) : []).flatMap(m => [m.cls, m.class2].filter(Boolean).map(id => [m, findId(D.classes, id)])).filter(([, c]) => c && c.role);
export const structTag = d => (d && d.tag) || (d && d.branch ? "manor" : BG().defaultTag || "estate");

// share off a build with this tag (0..cap). up = it is an upgrade (Drafting Room counts).
export function buildDisc(s, tag, up = false) {
  if (!s || !s.members) return 0;
  let best = 0;
  for (const [m, c] of roleHolders(s)) {
    const b = c.role.build;
    if (!b) continue;
    let v = Math.max(b[tag] || 0, b.all || 0);
    for (const [sp, x] of Object.entries(BG().specBoost || {})) if (x.tags.includes(tag) && b[tag] && (m.paths || []).some(e => e.spec === sp || e.spec2 === sp)) v += x.v; // Castellan → Fortwright, Sculptor → Architect
    best = Math.max(best, v);
  }
  let yard = 0, draft = 0;
  for (const st of s.structures || []) {
    const d = sdef(st.type);
    if (d && d.buildDisc) yard = Math.max(yard, d.buildDisc);
    if (up) for (const f of st.fittings || []) draft = Math.max(draft, (pdef(f) || {}).upCut || 0);
  }
  return Math.min(BG().cap ?? 0.25, best + yard + draft);
}
export const buildMult = (s, tag, up) => 1 - buildDisc(s, tag, up);
const resCut = (s, k) => Math.max(0, ...roleHolders(s).map(([, c]) => (c.role.resCut || {})[k] || 0));
// the price actually paid: every resource × buildMult (× resCut for e.g. marble), rounded; unchanged when no discount
export function bcost(s, cost, tag, up = false) {
  if (!cost) return cost;
  const k = buildMult(s, tag, up);
  const cuts = Object.keys(cost).map(r => resCut(s, r));
  if (k >= 1 && !cuts.some(Boolean)) return cost;
  const out = Object.fromEntries(Object.entries(cost).map(([r, v], i) => [r, Math.round(v * k * (1 - cuts[i]))]));
  return Object.defineProperty(out, "saved", { value: (cost.coin || 0) - (out.coin || 0), enumerable: false }); // pay() adds it to s.buildSaved
}
// numeric role values (best holder); Surveyor's land slot needs Journeyman rank in the Architects' Guild
export const roleVal = (s, key) => Math.max(0, ...roleHolders(s).map(([, c]) => (typeof c.role[key] === "number" ? c.role[key] : 0)));
export const landBonus = s => Math.max(0, ...roleHolders(s).filter(([m, c]) => c.role.landSlot && (memberGuild(m, "architects") || { rank: 0 }).rank >= 1).map(([, c]) => c.role.landSlot));
export const structSum = (s, key) => (s.structures || []).reduce((a, st) => a + ((sdef(st.type) || {})[key] || 0), 0);

// ---- road works (world.json roadWorks): tracks then roads; each level adds trade-route earnings × condition
const RW = () => (D.world && D.world.roadWorks) || null;
export const roads = s => s.roads || { track: 0, road: 0, cond: 1 };
const hasYard = s => (s.structures || []).some(st => (sdef(st.type) || {}).buildDisc);
export const roadsOpen = s => !!RW() && ((s.unlocks || []).includes("upgrade:roadworks") || (roleVal(s, "roads") > 0 && hasYard(s)));
export const roadCost = (s, k) => bcost(s, RW().build[k], "road");
export function roadIssue(s, k) {
  if (!RW() || !RW().build[k]) return "missing";
  if (!roadsOpen(s)) return roleVal(s, "roads") > 0 ? "road works need a Builder's Yard" : "needs The Old Keep Survey (Architects' Guild) or a Surveyor";
  if (roads(s)[k] >= (RW().max || {})[k]) return "max";
  if (k === "road" && roads(s).road >= roads(s).track) return "lay another track first";
  return afford(s, roadCost(s, k)) ? null : "cannot afford";
}
export function buildRoad(s, k) {
  if (roadIssue(s, k)) return false;
  pay(s, roadCost(s, k));
  s.roads = { ...roads(s) };
  s.roads[k]++;
  log(s, `🛤️ Road works: ${k === "road" ? "a paved road" : "a cart track"} laid (+${Math.round(RW().fx[k] * 100)}% trade-route earnings).`);
  return true;
}
export const roadEdge = s => (RW() && s.roads ? (s.roads.track * RW().fx.track + s.roads.road * RW().fx.road) * (s.roads.cond ?? 1) : 0);
export const repairCost = s => Object.fromEntries(Object.entries(RW().repair.cost).map(([k, v]) => [k, Math.ceil(v * (roads(s).track + roads(s).road) * Math.round((1 - (roads(s).cond ?? 1)) * 20))]));
export const repairIssue = s => (!s.roads || (s.roads.cond ?? 1) >= 1 ? "in good repair" : afford(s, repairCost(s)) ? null : "cannot afford");
export function repairRoads(s) {
  if (repairIssue(s)) return false;
  pay(s, repairCost(s));
  s.roads.cond = 1;
  log(s, "🛤️ The roads were repaired.");
  return true;
}
// yearly wear (called from the endgame day hook)
export function roadsDay(s) {
  if (!s.roads || s.day % 360) return;
  s.roads.cond = Math.max(0.5, Math.round(((s.roads.cond ?? 1) - RW().repair.decayPerYear) * 100) / 100);
}
