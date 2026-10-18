import { fertBonus, fertSeason } from "./saltmere.js";
import { seasonDay } from "./seasons.js";
import { perkField } from "./families.js";
// R40 per-crop fields (base game). Each field grows ONE crop (data/fields.json). Tending costs worker hours,
// not coin: farm-job followers give 8 h/day, family on the Tend Fields chore 8 h, other family 12+ help 1 h.
// Harvest piles up at the fields; TEAMSTERS (their own follower job) only haul it into storage. Farmers haul
// with leftover hours. When a crop's storage is full, its field rests and the hours go to processing
// (wheat → flour, barley → ale) if the right station exists. All of it is the free basic auto, settable/pausable.
import { D, afford, pay, ageY, living, log } from "./state.js";
import { bcost, structSum, structTag, roleVal } from "./builders.js";
import { seasonYield } from "./seasons.js";
import { resGain } from "./legacy.js";
import { ES, baseId, estateStage, foodCap, matCap, structDef } from "./estate.js";
import { prodTier, upgMult } from "./estate-place.js";
import { itemDef } from "./inventory.js";
import { blendFoodQ, operatorLvl } from "./production.js";
import { minionSkillLvl, minionLvlMult, mtype } from "./minions.js";
import { registerDayHook } from "./time.js";
import { animalsTend, animalTypes } from "./animals.js";
import { rotationChores } from "./chores.js";

export const FLD = () => D.fields || { crops: {}, sizes: [{ mult: 1, hours: 1 }], levels: { max: 1, perLvl: 0, cost: [] }, hours: {}, tools: { cut: {}, kinds: {} }, haul: {}, processing: {}, hub: { workerUps: [], teamsterUps: [] }, slots: {} };
const H = () => FLD().hours;
export const DEFAULT_AUTO = { tend: true, family: true, process: true, haul: true, teamsters: true };

export function fieldsState(s) {
  if (!s.fields) s.fields = { list: [], ups: {}, auto: { ...DEFAULT_AUTO }, pile: {}, extraSlots: 0, last: null };
  const f = s.fields;
  f.list = f.list || [];
  f.ups = f.ups || {};
  f.auto = { ...DEFAULT_AUTO, ...(f.auto || {}) };
  f.pile = f.pile || {};
  return f;
}
export const cropDef = id => FLD().crops[id];
export const cropIds = () => Object.keys(FLD().crops);
export const cropOpen = (s, id) => {
  const c = cropDef(id);
  return !!c && (!c.needs || !c.needs.structure || (s.structures || []).some(st => st.type === c.needs.structure));
};

// ---- slots: 1 at Homestead, +1 per Crop Fields tier (Farmstead, Great Fields), +1 per extra land parcel
const stageRank = s => ES().stages.findIndex(([, n]) => n === estateStage(s));
const fieldsStructs = s => (s.structures || []).filter(st => st.type === "fields");
export const hubTier = s => Math.max(0, ...fieldsStructs(s).map(st => st.tier || 0));
export function fieldSlots(s) {
  const S = FLD().slots;
  const need = ES().stages.findIndex(([, n]) => n === S.stage);
  if (stageRank(s) < need) return fieldsState(s).extraSlots || 0;
  return 1 + hubTier(s) * (S.perTier || 0) + Math.max(0, (s.land || []).length - 1) * (S.perExtraLand || 0) + (fieldsState(s).extraSlots || 0);
}
export const fieldsUnlockHint = s => `reach ${FLD().slots.stage} (estate stage)`;

// hub multiplier: the best Crop Fields building's tier and upgrades (Drainage, Crop Rotation, Seed Drill...)
export const hubMult = s => Math.max(1, ...fieldsStructs(s).map(st => ((prodTier(st) || {}).outputMult || 1) * (1 + upgMult(st)) * (st.site === "village" ? ES().village.outMult || 1 : 1))); // village Crop Fields keep their output bonus

export const sizeDef = f => FLD().sizes[Math.min(f.size || 0, FLD().sizes.length - 1)];
export const fieldBase = (f, season = 1) => {
  const c = cropDef(f.crop);
  return c ? c.base * (1 + FLD().levels.perLvl * ((f.lvl || 1) - 1)) * sizeDef(f).mult * (f.bonus || 1) * season : 0;
};
// full output per day when fully tended (season, hub and Legacy multipliers included)
export const fieldYield = (s, f) => fieldBase(f, seasonYield(s, cropDef(f.crop)?.res)) * hubMult(s) * resGain(s) * (1 + perkField(s) + fertBonus(s)); // R48 Ashbrook allied; R49 kelp fertiliser
export const capOf = (s, res) => (res === "food" ? foodCap(s) : (ES().caps.capped || []).includes(res) ? matCap(s) : Infinity);
const stopOf = (s, f) => Math.min(capOf(s, cropDef(f.crop).res), f.stopAt ?? Infinity);

// ---- actions
export function buildFieldIssue(s, crop) {
  if (!cropOpen(s, crop)) return cropDef(crop) ? `needs ${structDef(cropDef(crop).needs.structure)?.name || "a building"}` : "unknown crop";
  if (fieldsState(s).list.length >= fieldSlots(s)) return fieldSlots(s) ? "no free field slot" : fieldsUnlockHint(s);
  if (!afford(s, fieldCost(s))) return "cannot afford";
  return null;
}
export const fieldCost = s => bcost(s, FLD().build, "field"); // R47 Surveyor
export function buildField(s, crop) {
  if (buildFieldIssue(s, crop)) return null;
  pay(s, fieldCost(s));
  const f = { id: "f" + s.nextId++, crop, lvl: 1, size: 0, auto: true };
  fieldsState(s).list.push(f);
  log(s, `${cropDef(crop).icon} New field: ${cropDef(crop).name}.`);
  return f;
}
const fieldById = (s, id) => fieldsState(s).list.find(f => f.id === id);
export function setCrop(s, id, crop) {
  const f = fieldById(s, id);
  if (!f || !cropOpen(s, crop) || f.crop === crop) return false;
  f.crop = crop;
  return true;
}
export const levelCost = (f, s) => bcost(s, FLD().levels.cost[(f.lvl || 1) + 1] || null, "field", true);
export const levelIssue = (s, f) => (!f ? "missing" : (f.lvl || 1) >= FLD().levels.max ? "max" : !afford(s, levelCost(f, s)) ? "cannot afford" : null);
export function levelField(s, id) {
  const f = fieldById(s, id);
  if (levelIssue(s, f)) return false;
  pay(s, levelCost(f, s));
  f.lvl = (f.lvl || 1) + 1;
  return true;
}
export const sizeCost = (f, s) => bcost(s, (FLD().sizes[(f.size || 0) + 1] || {}).cost || null, "field", true);
// a step already paid for once (f.sizeMax) can be re-taken for free
export const sizeIssue = (s, f) =>
  !f ? "missing" : (f.size || 0) >= FLD().sizes.length - 1 ? "max" : (f.size || 0) < (f.sizeMax || 0) ? null : !afford(s, sizeCost(f, s)) ? "cannot afford" : null;
export function sizeUp(s, id) {
  const f = fieldById(s, id);
  if (sizeIssue(s, f)) return false;
  if ((f.size || 0) >= (f.sizeMax || 0)) pay(s, sizeCost(f, s));
  f.size = (f.size || 0) + 1;
  f.sizeMax = Math.max(f.sizeMax || 0, f.size);
  return true;
}
export function sizeDown(s, id) {
  const f = fieldById(s, id);
  if (!f || !f.size) return false;
  f.size--;
  return true;
}
export function toggleField(s, id) {
  const f = fieldById(s, id);
  if (!f) return false;
  f.auto = f.auto === false;
  return true;
}
export function setStopAt(s, id, n) {
  const f = fieldById(s, id);
  if (!f) return false;
  f.stopAt = n == null || n === "" || +n <= 0 ? undefined : Math.floor(+n);
  return true;
}
export function setFieldsAuto(s, key, on) {
  const st = fieldsState(s);
  if (!(key in DEFAULT_AUTO)) return false;
  st.auto[key] = on == null ? !st.auto[key] : !!on;
  return true;
}

// ---- hub upgrades: more farm worker slots and teamster slots (upgrades, not hiring)
export const hubUps = kind => FLD().hub[kind === "teamster" ? "teamsterUps" : "workerUps"] || [];
export const nextHubUp = (s, kind) => hubUps(kind).find(u => !fieldsState(s).ups[u.id]);
export const hubUpIssue = (s, kind) => {
  const u = nextHubUp(s, kind);
  return !u ? "max" : !fieldsState(s).list.length ? "build a field first" : !afford(s, bcost(s, u.cost, "hub", true)) ? "cannot afford" : null;
};
export function buyHubUp(s, kind) {
  if (hubUpIssue(s, kind)) return false;
  const u = nextHubUp(s, kind);
  pay(s, bcost(s, u.cost, "hub", true));
  fieldsState(s).ups[u.id] = true;
  log(s, `🌾 ${FLD().hub.name}: ${u.name} built.`);
  return true;
}
const bought = (s, kind, key) => hubUps(kind).filter(u => fieldsState(s).ups[u.id]).reduce((a, u) => a + (u[key] || 0), 0);
export const farmSpotsFromHub = s => (s.fields ? bought(s, "worker", "farmSpots") : 0);
export const teamsterCap = s => (s.fields ? (s.fields.list.length ? FLD().hub.teamsterBase || 0 : 0) + bought(s, "teamster", "teamsterSpots") + structSum(s, "teamsterSpots") : 0); // R47 Builder's Yard

// ---- tools: cut tend time by metal tier (+ masterwork), only for the matching kind (grain / plot / orchard)
export function toolCut(id, kind) {
  const d = id && itemDef(id);
  if (!d || !d.fieldTool || (kind && d.fieldTool !== kind)) return 0;
  const T = FLD().tools;
  const mw = typeof id === "string" && id.startsWith("c|") && id.split("|")[2] === "masterwork";
  return (d.metal ? T.cut[d.metal] || 0 : T.plain || 0) + (mw ? T.masterwork || 0 : 0);
}
const ownedTools = s => (s.vault || []).filter(id => itemDef(id)?.fieldTool);

// ---- workers: followers on the farm job first (it's their job), then family by Farming skill
const skillSpeed = lvl => (H().skillSpeedMax || 0) * Math.min(1, lvl / (H().skillAtMax || 50));
export function fieldWorkers(s) {
  const st = fieldsState(s);
  const out = [];
  for (const mi of (s.minions || []).filter(x => x.job === "farm" && !x.unhoused && !x.paused))
    out.push({ kind: "follower", ref: mi, name: mi.name, hours: H().follower || 8, lvl: minionSkillLvl(mi, "farm") * 5 * minionLvlMult(mi, "farm"), tools: mi.equip && mi.equip.tool ? [mi.equip.tool] : [] });
  out.sort((a, b) => b.lvl - a.lvl);
  if (st.auto.family) {
    const fam = living(s)
      .filter(m => ageY(m) >= (H().minAge || 12) && !m.away)
      .map(m => ({ kind: "family", ref: m, name: m.name, hours: m.action && m.action.target === "tendfields" ? H().tendChore || 8 : H().familyHelp || 1, lvl: (m.skills.farming || {}).lvl || 0, tools: [] }))
      .sort((a, b) => b.hours - a.hours || b.lvl - a.lvl);
    // family share the vault's field tools: best tool to the busiest worker
    const tools = ownedTools(s).sort((a, b) => toolCut(b) - toolCut(a));
    fam.forEach((w, i) => (w.tools = tools.slice(i * 3, i * 3 + 3)));
    out.push(...fam);
  }
  return out;
}
export const workerCut = (w, kind) => Math.max(0, ...w.tools.map(id => toolCut(id, kind)));
export const tendHours = (f, w) => sizeDef(f).hours * (1 - (w ? workerCut(w, cropDef(f.crop).tool) : 0)) * (1 - (w ? skillSpeed(w.lvl) : 0));
const hasPiece = (s, ids) => (s.structures || []).some(st => st.pieces.some(p => ids.includes(baseId(p))));
export const processorFor = (s, res) => {
  const p = FLD().processing[res];
  return p && hasPiece(s, p.needs) ? p : null;
};

// ---- the day
export function fieldsDay(s) {
  if (!D.fields) return null;
  const st = fieldsState(s);
  const W = fieldWorkers(s);
  for (const w of W) w.left = w.hours;
  if (st.list.length && (st.auto || {}).fert !== false) fertSeason(s, st.list.length, Math.ceil(D.tuning.daysPerYear / 4) - seasonDay(s)); // lasts to the season's end // R49 Fields' Auto spreads kelp fertiliser
  const last = { avail: W.reduce((a, w) => a + w.hours, 0), need: 0, used: 0, fields: {}, made: {}, processed: {}, hauled: 0, byTeamsters: 0, byFarmers: 0 };
  // auto teamster: an idle follower takes a free teamster spot when there is harvest to move
  if (st.auto.teamsters && Object.values(st.pile).some(v => v > 0.5)) {
    const tm = (s.minions || []).filter(x => x.job === "teamster" && !x.paused).length;
    let idle = (s.minions || []).find(x => !x.special && (!x.job || x.job === "idle") && !x.unhoused && !x.paused);
    // no idle hands: the least-skilled farmer moves over, as long as another farmer keeps tending
    const farmers = (s.minions || []).filter(x => !x.special && x.job === "farm" && !x.unhoused && !x.paused);
    if (!idle && farmers.length >= 2) idle = farmers.sort((a, b) => (a.skills?.farm || 0) - (b.skills?.farm || 0))[0];
    if (idle && tm < teamsterCap(s)) {
      idle.job = "teamster";
      log(s, `🛒 ${idle.name} became a teamster (hauls the harvest into storage).`);
    }
  }
  const take = (f, frac0 = 0) => {
    let frac = frac0;
    for (const w of W) {
      if (frac >= 1 - 1e-9) break;
      if (w.left <= 1e-9) continue;
      const need = tendHours(f, w);
      const t = Math.min(w.left, need * (1 - frac));
      w.left -= t;
      last.used += t;
      frac += t / need;
    }
    return Math.min(1, frac);
  };
  const full = [];
  const cropY = {}; // the pile holds a few days of ALL fields of that crop
  for (const f of st.list) { const c = cropDef(f.crop); if (c) cropY[c.res] = (cropY[c.res] || 0) + fieldYield(s, f); }
  for (const f of st.list) {
    const c = cropDef(f.crop);
    if (!c) continue;
    const res = c.res,
      y = fieldYield(s, f),
      pileCap = (cropY[res] || y) * (FLD().haul.pileDays || 3);
    const have = (s.res[res] || 0) + (st.pile[res] || 0);
    let state, tended = 0, made = 0;
    if (st.auto.tend && f.auto !== false && have >= stopOf(s, f)) {
      state = "full";
      full.push(f);
    } else if (!c.noHaul && (st.pile[res] || 0) >= pileCap + 1e-9) state = "waiting for haul";
    else {
      last.need += sizeDef(f).hours;
      tended = st.auto.tend && f.auto !== false ? take(f) : 0;
      made = y * Math.max(H().wild ?? 0.25, tended);
      const grown = made;
      if (!c.noHaul) made = Math.min(made, Math.max(0, pileCap - (st.pile[res] || 0)));
      const stuck = grown - made > grown * 0.5;
      if (c.noHaul) s.res[res] = Math.min(capOf(s, res), (s.res[res] || 0) + made); // Kitchen Plot: straight to the table
      else st.pile[res] = (st.pile[res] || 0) + made;
      const cq = ES().cropQuality; // farmers raise crop quality, as the old fields did
      if (cq && made > 0 && cq.res.includes(res)) blendFoodQ(s, res, made, 1 + operatorLvl(s, cq.skill) * cq.perLvl);
      last.made[res] = (last.made[res] || 0) + made;
      state = stuck ? "waiting for haul" : tended >= 0.999 ? "tended" : tended > 0 ? "partly tended" : "growing wild";
    }
    last.fields[f.id] = { state, tended, made };
  }
  // storage full → workers move to processing (hours that field would have needed)
  if (st.auto.process)
    for (const f of full) {
      const res = cropDef(f.crop).res,
        p = processorFor(s, res);
      if (!p) continue;
      let hrs = sizeDef(f).hours;
      for (const w of W) {
        if (hrs <= 0) break;
        const t = Math.min(w.left, hrs);
        w.left -= t;
        hrs -= t;
        last.used += t;
        const room = capOf(s, p.out) - (s.res[p.out] || 0);
        const n = Math.max(0, Math.min(t * p.perHour, s.res[res] || 0, room * p.in));
        if (n <= 0) continue;
        s.res[res] -= n;
        s.res[p.out] = (s.res[p.out] || 0) + n / p.in;
        last.processed[p.out] = (last.processed[p.out] || 0) + n / p.in;
      }
    }
  // haul: teamsters first (they only transport), then farmers with leftover hours
  const room = res => Math.max(0, capOf(s, res) - (s.res[res] || 0));
  const move = (cap, who) => {
    let left = cap;
    for (const res of Object.keys(st.pile)) {
      if (left <= 0) break;
      const n = Math.min(st.pile[res], room(res), left);
      if (n <= 0) continue;
      st.pile[res] -= n;
      s.res[res] = (s.res[res] || 0) + n;
      left -= n;
      last[who] += n;
      last.hauled += n;
    }
    return cap - left;
  };
  if (st.auto.haul) {
    const teams = (s.minions || []).filter(x => x.job === "teamster" && !x.unhoused && !x.paused);
    move(teams.reduce((a, mi) => a + (FLD().haul.teamsterPerDay || 60) * ((mtype(mi.type) || { apt: {} }).apt.teamster || 1) * minionLvlMult(mi, "teamster"), 0), "byTeamsters");
    let handLeft = FLD().haul.farmerDayCap ?? Infinity; // farmers carry by hand: a whole-farm daily limit
    for (const w of W) {
      if (handLeft <= 1e-9) break;
      const pileLeft = Object.keys(st.pile).reduce((a, k) => a + Math.min(st.pile[k], room(k)), 0);
      if (pileLeft <= 1e-9) break;
      const per = FLD().haul.farmerPerHour || 20;
      const used = move(Math.min(w.left * per, pileLeft, handLeft), "byFarmers");
      handLeft -= used;
      w.left -= used / per;
      last.used += used / per;
    }
  }
  rotationTend(s, W, last, res => capOf(s, res), res => (s.res[res] || 0) + (st.pile[res] || 0)); // R43 Auto rotation (R41 coop & cow pen, R42 chores)
  for (const k of Object.keys(st.pile)) if (st.pile[k] < 1e-6) delete st.pile[k];
  // followers' spare hours still farm the old way (plain food), so nothing is lost
  for (const w of W) if (w.kind === "follower") w.ref.fieldSpare = Math.max(0, w.left / w.hours);
  last.workers = W.map(w => ({ name: w.name, kind: w.kind, hours: w.hours, used: Math.round((w.hours - w.left) * 10) / 10 }));
  st.last = last;
  return last;
}

// expected food per day from fields when tended (used by the save step's 90% check and the UI)
export const fieldsFoodPerDay = (s, season = 1) =>
  fieldsState(s).list.filter(f => cropDef(f.crop)?.res === "food" || ["vegetables", "berries"].includes(cropDef(f.crop)?.res)).reduce((a, f) => a + fieldBase(f, season) * hubMult(s) * ((ES().meals.menu || {})[cropDef(f.crop).res] || 1), 0);
export const tendNeeded = s => fieldsState(s).list.reduce((a, f) => a + sizeDef(f).hours, 0);
export const tendAvail = s => fieldWorkers(s).reduce((a, w) => a + w.hours, 0);

// ---- save step 38: old Farm/Garden levels and Crop Fields become fields (fair: >= 90% of the old daily food)
export const oldFarmFood = s => (s.buildings?.farm || 0) * (FLD().migrate?.farmFood ?? 5) + (s.buildings?.garden || 0) * (FLD().migrate?.gardenFood ?? 2);
export function migrateFields(s) {
  if (!D.fields) return null;
  const st = fieldsState(s),
    M = FLD().migrate;
  if (st.list.length) return st;
  const add = (crop, lvl) => {
    const f = { id: "f" + s.nextId++, crop, lvl: Math.max(1, Math.min(FLD().levels.max, lvl)), size: 0, auto: true };
    st.list.push(f);
    return f;
  };
  const target = oldFarmFood(s) * M.minFoodShare;
  if (target > 0) {
    const k = add("food", s.buildings.farm || 1);
    while (fieldBase(k) < target && k.lvl < FLD().levels.max) k.lvl++;
    if (fieldBase(k) < target) k.bonus = Math.ceil((target / fieldBase(k)) * 100) / 100; // never below the old food
  }
  if ((s.buildings?.farm || 0) >= M.wheatFromFarm) add("wheat", s.buildings.farm - M.wheatFromFarm + 1);
  if (fieldsStructs(s).length) for (const crop of Object.keys(M.oldFurrows)) if (!st.list.some(f => f.crop === crop)) add(crop, 1);
  st.extraSlots = Math.max(0, st.list.length - fieldSlots(s));
  st.migrated = { food: oldFarmFood(s), fields: st.list.length };
  return st;
}

registerDayHook("fields", fieldsDay);

// ---- generic producers: any building listed in fields.haul.producers sends its raw harvest to the haul pile
export const hauledProducer = type => !!((FLD().haul || {}).producers || {})[type];
export function toPile(s, st, res, made) {
  const f = fieldsState(s), cap = made * (FLD().haul.pileDays || 3) + ((f.prodCap || {})[res] || 0);
  const room = Math.max(0, cap - (f.pile[res] || 0)), n = Math.min(made, room);
  f.pile[res] = (f.pile[res] || 0) + n;
  ((f.prodLast ||= {})[st.uid] = { type: st.type, res, made, stuck: made - n, day: s.day });
  return n;
}

// ---- R43 Auto rotation: after the fields, spare worker hours move down fields.rotation.order (data)
export const rotationOrder = () => ((FLD().rotation || {}).order || [...animalTypes(), "chores"]);
export function rotationTend(s, W, last, cap, have) {
  last.rotation = [{ step: "fields", state: Object.values(last.fields).some(x => x.state === "tended") ? "worked" : "skipped" }];
  last.animals = {};
  for (const step of rotationOrder()) {
    const before = W.reduce((a, w) => a + w.left, 0);
    if (step === "chores") rotationChores(s, W, last, cap, FLD().rotation || {});
    else animalsTend(s, W, last, cap, have, [step]);
    const used = before - W.reduce((a, w) => a + w.left, 0);
    last.rotation.push({ step, state: used > 1e-9 ? "worked" : "skipped", hours: Math.round(used * 10) / 10 });
  }
}
