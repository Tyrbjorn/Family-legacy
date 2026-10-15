
import { hasLegacy } from "./legacy.js";
import { guildDef, memberGuild } from "./guilds.js";
import { regionKnown } from "./map.js";
import { D, afford, ageY, bl, cost, isAdult, living, log, pay } from "./state.js";
import { inLine } from "./skills.js";
import { famFx, pathReqName } from "./paths.js";
import { stalls, structFeatureIssue } from "./world.js";
export * from "./production.js";
export * from "./tiers.js";
export * from "./furnish.js";

// ---- crafter class perks (data/crafting.json classPerks): stored on the structure when built
const CPK = () => Object.entries(D.crafting.classPerks || {}).filter(([k]) => k[0] !== "_");
export const famHasClass = (s, c) => living(s).some(m => inLine(m, c));
export const className = c => pathReqName(c) || (D.classes.find(x => x.id === c) || { name: c }).name;
export const classLock = (s, c) => (c && !famHasClass(s, c) ? `needs ${/^[AEIOU]/.test(className(c)) ? "an" : "a"} ${className(c)} in the family` : null);
export const piecePerk = (s, pid) =>
  CPK().reduce((a, [c, k]) => a + (k.pieces.includes(baseId(pid)) && famHasClass(s, c) ? k.furniture : 0), 0);
export const upgradePerk = (s, type) =>
  CPK().reduce((a, [c, k]) => a + (k.structures.includes(type) && famHasClass(s, c) ? k.upgrade : 0), 0);
const markPerk = (s, st, pid) => {
  const v = piecePerk(s, pid);
  if (v) (st.perk = st.perk || {})[baseId(pid)] = Math.max(v, (st.perk || {})[baseId(pid)] || 0);
};

export const ES = () => D.estate;

export const baseId = id => String(id).split("@")[0];

export const pieceTier = id => +(String(id).split("@")[1] || 0);

const rawPiece = b => ES().pieces.find(p => p.id === b) || D.furniture.find(p => p.id === b);
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
  pieceTierDef(id).mult * (1 + ES().levelBonus * (structLevel(st) - 1)) * (1 + upgMult(st)) * (1 + ((st.perk || {})[baseId(id)] || 0));

export const INTK = new Set(["beds"]);

export function scaleBonus(b, m) {
  const o = {};
  for (const [k, v] of Object.entries(b)) {
    if (typeof v === "number") o[k] = INTK.has(k) ? Math.floor(v * m + 1e-9) : v * m;
    else if (k === "jobs" || k === "housing")
      o[k] = Object.fromEntries(Object.entries(v).map(([j, n]) => [j, Math.floor(n * m + 1e-9)]));
    else if (k === "process" || k === "processes")
      o.processes = [...(o.processes || []), ...[].concat(v).map(p => ({ ...p, rate: p.rate * m }))];
    else o[k] = v;
  }
  return o;
}

// A Bed's effect depends on where it stands: family beds at home, follower beds in a bunkhouse/barracks/Fort.
export const bedRole = st => structDef(st.type).bedRole || "family";
export const pieceBonus = (st, p) => (p.followerBonus && bedRole(st) === "followers" ? p.followerBonus : p.bonus);
export const scaledPiece = (st, id) => {
  const p = pieceDef(id);
  return p && { ...p, bonus: scaleBonus(pieceBonus(st, p), pieceMult(st, id)) };
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
    return "quest: " + ((D.quests.find(q => q.id === u.quest) || {}).name || u.quest);
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
  if (!afford(s, nx.cost)) return "cannot afford";
  return null;
}

export function upgradePiece(s, uid, pid) {
  if (pieceUpIssue(s, uid, pid)) return false;
  const st = s.structures.find(x => x.uid === uid);
  const t = pieceTier(pid) + 1,
    nx = pieceTiers(pid)[t];
  pay(s, nx.cost);
  st.pieces[st.pieces.indexOf(pid)] = baseId(pid) + "@" + t;
  markPerk(s, st, pid);
  log(s, `🔧 ${pieceDef(pid).name} upgraded to ${nx.name}.`);
  return true;
}

export const structDef = id => ES().structures.find(x => x.id === id);

export const specDef = st => (st && st.spec ? (structDef(st.type).specs || []).find(x => x.id === st.spec) : null);

export const structStage = st =>
  specDef(st) ? 3 : Object.keys(structDef(st.type).upName || {}).some(k => (st.up || 0) >= +k) ? 2 : 1;

export function specIssue(s, uid, id) {
  const st = s.structures.find(x => x.uid === uid);
  const d = st && structDef(st.type);
  const sp = d && (d.specs || []).find(x => x.id === id);
  if (!sp) return "missing";
  if (st.spec) return "already specialised";
  if ((st.up || 0) < (d.upgrades || []).length) return "finish the upgrade line";
  if (!afford(s, sp.cost)) return "cannot afford";
  return null;
}

export function specialize(s, uid, id) {
  if (specIssue(s, uid, id)) return false;
  const st = s.structures.find(x => x.uid === uid);
  const sp = structDef(st.type).specs.find(x => x.id === id);
  pay(s, sp.cost);
  st.spec = id;
  log(s, `🏅 ${structDef(st.type).name} specialised: ${sp.name}.`);
  return true;
}

export const structName = st => {
  const sp = specDef(st);
  if (sp) return sp.name;
  const d = structDef(st.type);
  const u = Object.entries(d.upName || {})
    .filter(([k]) => (st.up || 0) >= +k)
    .pop();
  return u ? u[1] : d.name;
};

export const placed = s =>
  (s.structures || []).flatMap(st => [...st.pieces.map(id => scaledPiece(st, id)).filter(Boolean), ...fittingFx(st)]);

export function activeSynergies(st) {
  const ids = [...st.pieces, ...(st.fittings || [])].map(x => (pieceDef(x) || { id: baseId(x) }).id);
  return ES().synergies.filter(y => y.pieces.every(p => ids.includes(p)));
}

export const allSynergies = s =>
  (s.structures || []).flatMap(st => activeSynergies(st).map(y => ({ ...y, where: st.uid })));

// every placed piece + every active synergy, as {bonus} objects (old furniture code reads f.bonus)
// Cached per save object: rebuilt only when the structures change (it was ~80% of tick time).
const _fx = new WeakMap();
export function effects(s) {
  let key = "";
  for (const st of s.structures || [])
    key += `${st.uid}:${st.type}:${st.up || 0}:${st.spec || ""}:${st.pieces.join(",")}:${(st.fittings || []).join(",")}|`;
  const c = _fx.get(s);
  if (c && c.key === key) return c.list;
  const list = [
    ...placed(s),
    ...allSynergies(s),
    ...(s.structures || []).map(specDef).filter(Boolean),
    ...(s.structures || []).map(st => structDef(st.type).builtin).filter(b => b && b.bonus),
  ];
  _fx.set(s, { key, list });
  return list;
}

export const estEff = (s, k) => eff(s, k);

export const eff = (s, k) => effects(s).reduce((a, f) => a + (typeof f.bonus[k] === "number" ? f.bonus[k] : 0), 0);

export const hasPiece = (s, id) =>
  (s.structures || []).some(st => [...st.pieces, ...(st.fittings || [])].map(x => baseId(pieceDef(x) ? pieceDef(x).id : x)).includes(baseId(pieceDef(id) ? pieceDef(id).id : id)));

export const bedrooms = s => 1 + eff(s, "beds");

export const hasLand = s => (s.land || []).length > 0;

export const established = s => hasLand(s) && (s.structures || []).length > 0;

export const landSlots = s =>
  (s.land || []).reduce((a, id) => a + ES().lands.find(l => l.id === id).slots, 0) + ((s.land || []).length ? Math.floor(famFx(s, "land")) : 0);

export const landUsed = s =>
  D.buildings.reduce((a, b) => a + (bl(s, b.id) > 0 ? b.land : 0), 0) +
  (s.structures || []).reduce((a, st) => a + structDef(st.type).land, 0);

export const foodCap = s => ES().caps.foodBase + eff(s, "foodCap") + bl(s, "farm") * 100;

export const matCap = s => ES().caps.matBase + eff(s, "matCap");

export const craftQuality = s => eff(s, "craftQuality");

export const buildingLevelName = (b, lv) => b.name;

export function canBuyLand(s, id) {
  const l = ES().lands.find(x => x.id === id);
  return (
    !!l &&
    (!l.region || regionKnown(s, l.region)) &&
    !(s.land || []).includes(id) &&
    (!l.requires || s.land.includes(l.requires)) &&
    afford(s, l.cost)
  );
}

export function buyLand(s, id) {
  if (!canBuyLand(s, id)) return false;
  const l = ES().lands.find(x => x.id === id);
  pay(s, l.cost);
  s.land.push(id);
  log(s, `📜 Bought ${l.name} (+${l.slots} land slots).`);
  s.deeds.push(`Bought ${l.name}.`);
  return true;
}

export function structIssue(s, type) {
  const d = structDef(type);
  if (!hasLand(s)) return "buy land first";
  if (landUsed(s) + d.land > landSlots(s)) return "no free land slot";
  if (d.requires && !(s.structures || []).some(x => x.type === d.requires || structDef(x.type).upgradeFrom === d.requires))
    return `needs a ${structDef(d.requires).name}`;
  if (d.legacy && !hasLegacy(s, d.legacy)) return "needs Legacy upgrade";
  const fi = D.world ? structFeatureIssue(s, type) : null;
  if (fi) return fi;
  if (!afford(s, d.cost)) return "cannot afford";
  return null;
}

export function buildStructure(s, type) {
  if (structIssue(s, type)) return null;
  const d = structDef(type);
  pay(s, d.cost);
  const st = { uid: "st" + s.nextId++, type, pieces: [...(d.fixed || [])], up: 0 };
  s.structures.push(st);
  log(s, `🛖 Built a ${d.name} (${d.slots} slots).`);
  return st;
}

export const freeSlots = (s, st) =>
  structDef(st.type).slots + (structDef(st.type).fixed || []).length + (st.bonusSlots || 0) - st.pieces.reduce((a, p) => a + pieceSlots(p), 0);

export const isFixed = (st, pid) => (structDef(st.type).fixed || []).includes(baseId(pid));

export const upgMult = st => (structDef(st.type).upgrades || []).slice(0, st.up || 0).reduce((a, u) => a + u.mult, 0) + (st.upPerk || 0);

export function specialUpIssue(s, uid) {
  const st = s.structures.find(x => x.uid === uid);
  const ups = st && structDef(st.type).upgrades;
  if (!ups) return "missing";
  const nx = ups[st.up || 0];
  if (!nx) return "max";
  if (nx.requiresClass && !famHasClass(s, nx.requiresClass)) return classLock(s, nx.requiresClass);
  if (!afford(s, nx.cost)) return "cannot afford";
  return null;
}

export function upgradeSpecial(s, uid) {
  if (specialUpIssue(s, uid)) return false;
  const st = s.structures.find(x => x.uid === uid);
  const nx = structDef(st.type).upgrades[st.up || 0];
  pay(s, nx.cost);
  st.up = (st.up || 0) + 1;
  const pk = upgradePerk(s, st.type);
  if (pk) st.upPerk = (st.upPerk || 0) + nx.mult * pk;
  log(s, `🔧 ${structDef(st.type).name}: ${nx.name} installed (${nx.routes ? "+" + nx.routes + " trade route slot" : "+" + nx.mult * 100 + "% output"}).`);
  return true;
}

export function placeIssue(s, uid, pid, fromStore) {
  const st = s.structures.find(x => x.uid === uid),
    p = pieceDef(pid);
  if (!st || !p) return "missing";
  if (freeSlots(s, st) <= 0) return "building full";
  const sd = structDef(st.type);
  if (p.fixedOnly || p.mergedInto) return "built-in only";
  if (p.fitting) return "slot-free fitting (buy it under Fittings)";
  if (sd.allowed && !sd.allowed.includes(baseId(pid))) return "not allowed here";
  if (!p.stack && st.pieces.map(baseId).includes(baseId(pid))) return "already here";
  if (!fromStore && pieceLock(s, p)) return "🔒 " + pieceLock(s, p);
  if (!fromStore && !afford(s, p.cost)) return "cannot afford";
  if (fromStore && !s.pieceStore.includes(pid)) return "not in storage";
  return null;
}

export function placePiece(s, uid, pid, fromStore = false) {
  if (placeIssue(s, uid, pid, fromStore)) return false;
  const st = s.structures.find(x => x.uid === uid),
    p = pieceDef(pid);
  if (fromStore) s.pieceStore.splice(s.pieceStore.indexOf(pid), 1);
  else pay(s, p.cost);
  st.pieces.push(pid);
  markPerk(s, st, pid);
  const before = new Set();
  log(s, `🪑 Placed ${p.name} in the ${structDef(st.type).name}.`);
  for (const y of activeSynergies(st)) if (y.pieces.includes(pid)) log(s, `✨ Synergy: ${y.name} (${y.desc}).`);
  return true;
}

export function removePiece(s, uid, pid) {
  const st = s.structures.find(x => x.uid === uid);
  if (!st || !st.pieces.includes(pid) || isFixed(st, pid)) return false;
  st.pieces.splice(st.pieces.indexOf(pid), 1);
  s.pieceStore.push(pid);
  return true;
}

export const ADVENTURE_BASE_CAP = 2;

export function jobCap(s, job) {
  if (["idle", "guard", "scout"].includes(job)) return Infinity;
  if (job === "noderun") return D.world ? D.world.noderun.cap + Math.floor(stalls(s) / 2) : 0;
  // Balance: adventuring was uncapped and out-earned the whole family ~3:1 in long sims.
  // Now 2 parties, +cap of every building that houses adventurers (Adventurers' Lodge: +2).
  if (job === "adventure")
    return (
      ADVENTURE_BASE_CAP +
      (s.structures || []).reduce((a, st) => {
        const h = structDef(st.type).houses;
        return a + (h && (h.jobs || []).includes("adventure") ? h.cap || 0 : 0);
      }, 0)
    );
  let c = placed(s).reduce((a, p) => a + ((p.bonus.jobs || {})[job] || 0), 0);
  if (job === "farm") c += bl(s, "farm") * 2 + bl(s, "garden");
  if (job === "gather") c += bl(s, "lumber") * 2;
  if (job === "tutor") c += bl(s, "library");
  return c;
}

export function estateStage(s) {
  if (!hasLand(s)) return "Landless";
  const t =
    Object.values(s.buildings).reduce((a, b) => a + b, 0) +
    s.structures.reduce((a, st) => a + structDef(st.type).slots / 2 + st.pieces.length, 0);
  const STAGES = ES().stages;
  let n = STAGES[0][1];
  for (const [k, v] of STAGES) if (t >= k) n = v;
  return n;
}

export const classSynMult = (s, st) => {
  const cs = structDef(st.type).classSynergy;
  return cs && living(s).some(m => cs.classes.includes(m.cls)) ? 1 + cs.mult : 1;
};

export function buildIssue(s, b) {
  if (!hasLand(s)) return "buy land first";
  if (s.buildings[b.id] >= b.max) return "max level";
  if (!established(s)) return "build a Shack first";
  if (!s.buildings[b.id] && landUsed(s) + b.land > landSlots(s)) return "no free land slot";
  if (!afford(s, cost(s, b))) return "cannot afford";
  return null;
}

export function build(s, id) {
  const b = D.buildings.find(x => x.id === id);
  if (buildIssue(s, b)) return false;
  const c = cost(s, b);
  if (!afford(s, c)) return false;
  pay(s, c);
  s.buildings[id]++;
  log(s, `🏗️ ${b.name} ${s.buildings[id] > 1 ? "upgraded to Lv" + s.buildings[id] : "built"}.`);
  return true;
}

// data-driven: buildings = list of groups; every group needs one of its structures (AND of ORs)
export const hasStruct = (s, id) => (s.structures || []).some(st => st.type === id);

export const buildingReqMet = (s, groups) => groups.every(g => g.some(id => hasStruct(s, id)));

export const buildingReqStatus = (s, groups) =>
  groups.map(g => ({ names: g.map(id => structDef(id).name), ok: g.some(id => hasStruct(s, id)) }));

// one-line effect for the UI: the building's tradeoff line (specialty picks) or the item desc, plus its combos
export function pieceLine(id, type) {
  const p = pieceDef(id);
  if (!p) return "";
  const d = type ? structDef(type) : null;
  const base = (d && d.picks && d.picks[p.id]) || p.desc || "";
  const combos = ES()
    .synergies.filter(y => y.pieces.includes(p.id))
    // in a building, only combos it can actually hold (1-slot buildings pair with built-ins/fittings)
    .filter(y => !d || y.pieces.filter(x => x !== p.id).every(x => [...(d.fixed || []), ...(d.fittings || []), ...((d.slots || 0) > 1 ? d.allowed || [] : [])].includes(x)))
    .map(y => `${y.icon} +${y.pieces.filter(x => x !== p.id).map(x => pieceDef(x).name).join(" + ")}: ${y.desc}`);
  return combos.length ? `${base} · Combo ${combos.join("; ")}` : base;
}
