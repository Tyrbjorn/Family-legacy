import { findId } from "./lookup.js";
// Estate items: crafter class perks, item ids/tiers/scaling, bed roles, locks and item upgrades (re-exported by estate.js).
import { guildDef, memberGuild } from "./guilds.js";
import { D, afford, living, log, pay } from "./state.js";
import { bcost, structSum, structTag, roleVal } from "./builders.js";
import { inLine } from "./skills.js";
import { pathReqName } from "./paths.js";
import { nightShare } from "./daynight.js";
import { freeSlots, prodTier, upgMult } from "./estate-place.js";
import { eff, estateStage, structDef } from "./estate.js";

// ---- crafter class perks (data/crafting.json classPerks): stored on the structure when built
const CPK = () => Object.entries(D.crafting.classPerks || {}).filter(([k]) => k[0] !== "_");
export const famHasClass = (s, c) => living(s).some(m => inLine(m, c));
export const className = c => pathReqName(c) || (findId(D.classes, c) || { name: c }).name;
export const classLock = (s, c) => (c && !famHasClass(s, c) ? `needs ${/^[AEIOU]/.test(className(c)) ? "an" : "a"} ${className(c)} in the family` : null);
export const piecePerk = (s, pid) =>
  CPK().reduce((a, [c, k]) => a + (k.pieces.includes(baseId(pid)) && famHasClass(s, c) ? k.furniture : 0), 0);
export const upgradePerk = (s, type) =>
  CPK().reduce((a, [c, k]) => a + (k.structures.includes(type) && famHasClass(s, c) ? k.upgrade : 0), 0);
export const markPerk = (s, st, pid) => {
  const v = piecePerk(s, pid);
  if (v) (st.perk = st.perk || {})[baseId(pid)] = Math.max(v, (st.perk || {})[baseId(pid)] || 0);
};

export const ES = () => D.estate;

export const baseId = id => String(id).split("@")[0];

export const pieceTier = id => +(String(id).split("@")[1] || 0);

const rawPiece = b => ES().pieces.find(p => p.id === b) || findId(D.furniture, b);
// merged items (furniture redo) resolve to the item they were folded into
export const pieceDef = id => {
  const p = rawPiece(baseId(id));
  return p && p.mergedInto ? rawPiece(p.mergedInto) : p;
};

// Per-piece tier tables (piece.tiers) override the generic pieceTiers: higher tiers can need rarer resources
// and take more furniture slots (tier.slots).
export const pieceTiers = id => (pieceDef(id) || {}).tiers || ES().pieceTiers;
export const pieceTierDef = id => pieceTiers(id)[Math.min(pieceTier(id), pieceTiers(id).length - 1)];
export const pieceSlots = () => 1; // furniture redo: every item takes exactly one slot
export const tierName = id => pieceTierDef(id).name;

export const structLevel = st => structDef(st.type).level || 1;

export const pieceMult = (st, id) =>
  pieceTierDef(id).mult * (1 + ES().levelBonus * (structLevel(st) - 1)) * ((prodTier(st) || {}).outputMult || 1) * (1 + upgMult(st)) * (1 + ((st.perk || {})[baseId(id)] || 0));

export const INTK = new Set(["beds"]);

// vm = village multipliers: processes ×v.out, follower job spots ×v.jobs (other bonuses unchanged)
export function scaleBonus(b, m, vm = { out: 1, jobs: 1 }) {
  const o = {};
  for (const [k, v] of Object.entries(b)) {
    if (typeof v === "number") o[k] = INTK.has(k) ? Math.floor(v * m + 1e-9) : v * m;
    else if (k === "jobs" || k === "housing")
      o[k] = Object.fromEntries(Object.entries(v).map(([j, n]) => [j, Math.floor(n * m * (k === "jobs" ? vm.jobs : 1) + 1e-9)]));
    else if (k === "process" || k === "processes")
      o.processes = [...(o.processes || []), ...[].concat(v).map(p => ({ ...p, rate: p.rate * m * vm.out }))];
    else o[k] = v;
  }
  return o;
}

// A Bed's effect depends on where it stands: family beds at home, follower beds in a bunkhouse/barracks/Fort.
export const bedRole = st => structDef(st.type).bedRole || "family";
// a building may also retune an item it hosts (e.g. the Counting House desk teaches Haggling)
export const pieceBonus = (st, p) =>
  (structDef(st.type).pieceBonus || {})[p.id] || (p.followerBonus && bedRole(st) === "followers" ? p.followerBonus : p.bonus);
// wagon speed from Loading Docks / Lanterns: trips take 1/(1+x) as long (capped)
// Lanterns add nightWagonSpeed for the night share of each day (wagons keep rolling after dark)
export const wagonSpeed = s => 1 + Math.min(1, eff(s, "wagonSpeed") + nightShare() * eff(s, "nightWagonSpeed"));
export const scaledPiece = (st, id) => {
  const p = pieceDef(id);
  const v = st.site === "village" && ES().village;
  return p && { ...p, bonus: scaleBonus(pieceBonus(st, p), pieceMult(st, id), v ? { out: v.outMult, jobs: v.jobMult } : undefined) };
};
// slot-free fittings (former stat-bump furniture): bought once per building, flat bonus
export const fittingFx = st => (st.fittings || []).map(pieceDef).filter(Boolean);

export const STAGE_ORDER = () => ES().stages.map(x => x[1]);

export function pieceLock(s, p) {
  if (p.requiresClass && !famHasClass(s, p.requiresClass)) return classLock(s, p.requiresClass);
  const u = p.unlock;
  if (!u) return null;
  if (u.stage && STAGE_ORDER().indexOf(estateStage(s)) < STAGE_ORDER().indexOf(u.stage))
    return "estate tier " + u.stage;
  if (u.quest && !s.doneQuests.includes(u.quest))
    return "quest: " + ((findId(D.quests, u.quest) || {}).name || u.quest);
  if (u.key && !(s.unlocks || []).includes(u.key)) return "Architects' Guild chain"; // R47 chain unlocks (piece:…)
  if (
    u.guild &&
    !living(s).some(m => {
      const g = memberGuild(m, u.guild);
      return g && (g.rank || 0) >= (u.rank || 0);
    })
  )
    return ((guildDef(u.guild) || {}).name || u.guild) + " rank " + ((u.rank || 0) + 1);
  return null;
}

export function pieceUpIssue(s, uid, pid) {
  const st = s.structures.find(x => x.uid === uid);
  if (!st || !st.pieces.includes(pid)) return "missing";
  const t = pieceTier(pid);
  const nx = pieceTiers(pid)[t + 1];
  if (!nx) return "max";
  const more = (nx.slots || 1) - pieceSlots(pid);
  if (more > 0 && freeSlots(s, st) < more) return `needs ${more} more free slot${more > 1 ? "s" : ""}`;
  if (!afford(s, bcost(s, nx.cost, "piece", true))) return "cannot afford";
  return null;
}

export function upgradePiece(s, uid, pid) {
  if (pieceUpIssue(s, uid, pid)) return false;
  const st = s.structures.find(x => x.uid === uid);
  const t = pieceTier(pid) + 1,
    nx = pieceTiers(pid)[t];
  pay(s, bcost(s, nx.cost, "piece", true)); // R47 Master Builder
  st.pieces[st.pieces.indexOf(pid)] = baseId(pid) + "@" + t;
  markPerk(s, st, pid);
  log(s, `🔧 ${pieceDef(pid).name} upgraded to ${nx.name}.`);
  return true;
}
