import { hasLegacy, resGain } from "./legacy.js";
import { guildDef, memberGuild } from "./guilds.js";
import { regionKnown } from "./map.js";
import { mtype } from "./minions.js";
import { D, afford, ageY, bl, cost, isAdult, living, log, pay } from "./state.js";

export const ES = () => D.estate;

export const baseId = id => String(id).split("@")[0];

export const pieceTier = id => +(String(id).split("@")[1] || 0);

export const pieceDef = id => {
  const b = baseId(id);
  return ES().pieces.find(p => p.id === b) || D.furniture.find(p => p.id === b);
};

export const tierName = id => ES().pieceTiers[pieceTier(id)].name;

export const structLevel = st => structDef(st.type).level || 1;

export const pieceMult = (st, id) =>
  ES().pieceTiers[pieceTier(id)].mult * (1 + ES().levelBonus * (structLevel(st) - 1)) * (1 + upgMult(st));

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

export const scaledPiece = (st, id) => {
  const p = pieceDef(id);
  return p && { ...p, bonus: scaleBonus(p.bonus, pieceMult(st, id)) };
};

export const STAGE_ORDER = () => ES().stages.map(x => x[1]);

export function pieceLock(s, p) {
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
  const nx = ES().pieceTiers[t + 1];
  if (!nx) return "max";
  if (!afford(s, nx.cost)) return "cannot afford";
  return null;
}

export function upgradePiece(s, uid, pid) {
  if (pieceUpIssue(s, uid, pid)) return false;
  const st = s.structures.find(x => x.uid === uid);
  const t = pieceTier(pid) + 1,
    nx = ES().pieceTiers[t];
  pay(s, nx.cost);
  st.pieces[st.pieces.indexOf(pid)] = baseId(pid) + "@" + t;
  log(s, `🔧 ${pieceDef(pid).name} upgraded to ${nx.name}.`);
  return true;
}

export const structDef = id => ES().structures.find(x => x.id === id);

export const specDef = st =>
  st && st.spec ? (structDef(st.type).specs || []).find(x => x.id === st.spec) : null;

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
  (s.structures || []).flatMap(st => st.pieces.map(id => scaledPiece(st, id)).filter(Boolean));

export function activeSynergies(st) {
  return ES().synergies.filter(y => y.pieces.every(p => st.pieces.map(baseId).includes(p)));
}

export const allSynergies = s =>
  (s.structures || []).flatMap(st => activeSynergies(st).map(y => ({ ...y, where: st.uid })));

// every placed piece + every active synergy, as {bonus} objects (old furniture code reads f.bonus)
export const effects = s => [
  ...placed(s),
  ...allSynergies(s),
  ...(s.structures || []).map(specDef).filter(Boolean),
];

export const estEff = (s, k) => eff(s, k);

export const eff = (s, k) =>
  effects(s).reduce((a, f) => a + (typeof f.bonus[k] === "number" ? f.bonus[k] : 0), 0);

export const hasPiece = (s, id) =>
  (s.structures || []).some(st => st.pieces.map(baseId).includes(baseId(id)));

export const bedrooms = s => 1 + eff(s, "beds");

export const hasLand = s => (s.land || []).length > 0;

export const established = s => hasLand(s) && (s.structures || []).length > 0;

export const landSlots = s =>
  (s.land || []).reduce((a, id) => a + ES().lands.find(l => l.id === id).slots, 0);

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
  if (d.legacy && !hasLegacy(s, d.legacy)) return "needs Legacy upgrade";
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

export function upgradeIssue(s, uid) {
  const st = s.structures.find(x => x.uid === uid);
  if (!st) return "missing";
  const nx = ES().structures.find(x => x.upgradeFrom === st.type);
  if (!nx) return "max";
  if (landUsed(s) - structDef(st.type).land + nx.land > landSlots(s)) return "no free land slot";
  if (!afford(s, nx.cost)) return "cannot afford";
  return null;
}

export function upgradeStructure(s, uid) {
  if (upgradeIssue(s, uid)) return false;
  const st = s.structures.find(x => x.uid === uid);
  const nx = ES().structures.find(x => x.upgradeFrom === st.type);
  pay(s, nx.cost);
  log(s, `🏗️ ${structDef(st.type).name} upgraded to ${nx.name}.`);
  st.type = nx.id;
  return true;
}

export const freeSlots = (s, st) =>
  structDef(st.type).slots + (structDef(st.type).fixed || []).length - st.pieces.length;

export const isFixed = (st, pid) => (structDef(st.type).fixed || []).includes(baseId(pid));

export const upgMult = st =>
  (structDef(st.type).upgrades || []).slice(0, st.up || 0).reduce((a, u) => a + u.mult, 0);

export function specialUpIssue(s, uid) {
  const st = s.structures.find(x => x.uid === uid);
  const ups = st && structDef(st.type).upgrades;
  if (!ups) return "missing";
  const nx = ups[st.up || 0];
  if (!nx) return "max";
  if (!afford(s, nx.cost)) return "cannot afford";
  return null;
}

export function upgradeSpecial(s, uid) {
  if (specialUpIssue(s, uid)) return false;
  const st = s.structures.find(x => x.uid === uid);
  const nx = structDef(st.type).upgrades[st.up || 0];
  pay(s, nx.cost);
  st.up = (st.up || 0) + 1;
  log(s, `🔧 ${structDef(st.type).name}: ${nx.name} installed (+${nx.mult * 100}% output).`);
  return true;
}

export function placeIssue(s, uid, pid, fromStore) {
  const st = s.structures.find(x => x.uid === uid),
    p = pieceDef(pid);
  if (!st || !p) return "missing";
  if (freeSlots(s, st) <= 0) return "building full";
  const sd = structDef(st.type);
  if (p.fixedOnly) return "built-in only";
  if (sd.allowed && !sd.allowed.includes(baseId(pid))) return "not allowed here";
  if (st.pieces.map(baseId).includes(baseId(pid))) return "already here";
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
  const before = new Set();
  log(s, `🪑 Placed ${p.name} in the ${structDef(st.type).name}.`);
  for (const y of activeSynergies(st))
    if (y.pieces.includes(pid)) log(s, `✨ Synergy: ${y.name} (${y.desc}).`);
  return true;
}

export function removePiece(s, uid, pid) {
  const st = s.structures.find(x => x.uid === uid);
  if (!st || !st.pieces.includes(pid) || isFixed(st, pid)) return false;
  st.pieces.splice(st.pieces.indexOf(pid), 1);
  s.pieceStore.push(pid);
  return true;
}

export function operatorLvl(s, skill) {
  if (!skill) return 0;
  const sp = ES().skillProcess;
  let b = 0;
  for (const m of living(s)) if (isAdult(m) || ageY(m) >= 12) b = Math.max(b, m.skills[skill]?.lvl || 0);
  for (const mi of s.minions || [])
    if (mi.job === "craft") b = Math.max(b, (mtype(mi.type).apt.craft || 1) * sp.minionLvlPerApt);
  return b;
}

export const skillSpeed = (s, p) => 1 + ES().skillProcess.speedPerLvl * operatorLvl(s, p && p.skill);

export const skillYield = (s, p) => 1 + ES().skillProcess.yieldPerLvl * operatorLvl(s, p && p.skill);

export const resTier = k =>
  +(Object.entries(ES().resourceTiers).find(([, t]) => t.res.includes(k)) || [0])[0];

export const DEFAULT_RESERVE = { wood: 50, stone: 50, ore: 0, copperore: 0, hides: 0, herbs: 0 };

export const reserveOf = (s, k) => (s.reserve || {})[k] || 0;

export function setReserve(s, k, n) {
  if (!(k in DEFAULT_RESERVE)) return false;
  s.reserve[k] = Math.max(0, Math.floor(+n || 0));
  return true;
}

export const pkey = (uid, id) => uid + ":" + baseId(id);

export const isPaused = (s, uid, id) => (s.paused || []).includes(pkey(uid, id));

export function togglePiece(s, uid, id) {
  const k = pkey(uid, id);
  const i = s.paused.indexOf(k);
  if (i >= 0) s.paused.splice(i, 1);
  else s.paused.push(k);
  return i < 0;
}

export function processDay(s, mul = 1) {
  for (const st of s.structures || []) {
    const syn = activeSynergies(st);
    for (const p of st.pieces.filter(id => !isPaused(s, st.uid, id)).map(id => scaledPiece(st, id)))
      for (const pr0 of (p && p.bonus.processes) || []) {
        const pr = { ...pr0, rate: pr0.rate * skillSpeed(s, p) * classSynMult(s, st) };
        const yl = skillYield(s, p);
        let n = pr.rate * mul * syn.reduce((a, y) => a * ((y.bonus.processMult || {})[pr.out] || 1), 1);
        for (const [k, v] of Object.entries(pr.in))
          n = Math.min(n, Math.max(0, (s.res[k] || 0) - reserveOf(s, k)) / v);
        if (n <= 0) continue;
        for (const [k, v] of Object.entries(pr.in)) s.res[k] -= v * n;
        s.res[pr.out] = (s.res[pr.out] || 0) + n * yl * resGain(s);
      }
  }
}

export const processRates = (s, st, pid) =>
  (scaledPiece(st, pid).bonus.processes || []).map(pr => ({
    out: pr.out,
    rate:
      Math.round(
        pr.rate *
          skillSpeed(s, pieceDef(pid)) *
          skillYield(s, pieceDef(pid)) *
          activeSynergies(st).reduce((a, y) => a * ((y.bonus.processMult || {})[pr.out] || 1), 1) *
          100,
      ) / 100,
  }));

export const processRate = (s, st, pid) => {
  const r = processRates(s, st, pid);
  return r.length ? r[0].rate : 0;
};

export function jobCap(s, job) {
  if (["idle", "guard", "scout", "adventure"].includes(job)) return Infinity;
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
