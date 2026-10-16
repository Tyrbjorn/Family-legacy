import { memberFx } from "./paths.js";
// Gear sets (2/4-piece bonuses scaled by the worn pieces' quality/rarity) and enchanting (data/gear.json).
// Enchants ride on the item id as a suffix: "<id>#keen.vigor*" ("*" = greater). Slots come from quality/rarity.
// Enchanting stations follow the general home-furniture + dedicated-workshop pattern (gear.stations).
import { baseId, pieceDef, pieceTier, structDef } from "./estate.js";
import { introNote } from "./intros.js";
import { itemDef, vaultRoom } from "./inventory.js";
import { isHoused, minionLvl } from "./minions.js";
import { upEnchant } from "./minionups.js";
import { gainXp, inLine } from "./skills.js";
import { D, afford, isAdult, living, log, pay, rng } from "./state.js";

export const GR = () => D.gear;
const EN = () => GR().enchanting;
export const setDef = id => GR().sets.find(x => x.id === id);
export const enchDef = tok => GR().enchants.find(e => e.id === String(tok).replace("*", ""));
export const isGreater = tok => String(tok).endsWith("*");
export const splitId = id => {
  const [b, e] = String(id).split("#");
  return { base: b, ench: e ? e.split(".").filter(Boolean) : [] };
};
export const joinId = (base, ench) => (ench.length ? `${base}#${ench.join(".")}` : base);
export function enchSlots(it) {
  if (!it || !["weapon", "offhand", "armor", "accessory", "charm"].includes(it.slot)) return 0;
  const S = GR().slots;
  const n = (it.quality ? S.quality[it.quality] : S.rarity[it.rarity]) || 0;
  return Math.min(S.maxSlots + (it.inlaySlot || 0), n + (it.inlaySlot || 0)); // a gem inlay adds a slot
}
const pieceScale = it => (it.quality ? GR().qualityScale[it.quality] : GR().rarityScale[it.rarity]) || 1;
const tokFx = tok => {
  const e = enchDef(tok);
  if (!e) return {};
  const k = isGreater(tok) ? EN().greaterMult : 1;
  return scaleFx(e.fx, k);
};
function scaleFx(fx, k) {
  const o = {};
  for (const [a, v] of Object.entries(fx || {}))
    o[a] = typeof v === "number" ? v * k : Object.fromEntries(Object.entries(v).map(([x, y]) => [x, y * k]));
  return o;
}
function addFx(t, fx) {
  for (const [a, v] of Object.entries(fx || {})) {
    if (typeof v === "number") t[a] = (t[a] || 0) + v;
    else {
      t[a] = t[a] || {};
      for (const [x, y] of Object.entries(v)) t[a][x] = (t[a][x] || 0) + y;
    }
  }
  return t;
}
// cp an item's enchants add (used by itemDef)
export const enchCp = ench => Math.round(ench.reduce((a, t) => a + (tokFx(t).cp || 0), 0));

// ---- sets
export function setProgress(equip) {
  const by = {};
  for (const id of Object.values(equip || {})) {
    const it = itemDef(id);
    if (!it || !it.set) continue;
    (by[it.set] = by[it.set] || []).push(it);
  }
  return Object.entries(by).map(([sid, its]) => ({
    set: setDef(sid),
    n: its.length,
    scale: its.reduce((a, it) => a + pieceScale(it), 0) / its.length,
  }));
}
// combined set + enchant effects (cp from enchants is already in the item's cp)
export function gearFx(equip, who = "member") {
  const t = {};
  for (const p of setProgress(equip)) {
    const tbl = who === "minion" ? p.set.minion || {} : p.set.bonus;
    for (const [k, fx] of Object.entries(tbl)) if (p.n >= +k) addFx(t, scaleFx(fx, p.scale));
  }
  for (const id of Object.values(equip || {}))
    for (const tok of splitId(id).ench) {
      const fx = { ...tokFx(tok) };
      delete fx.cp;
      addFx(t, fx);
    }
  return t;
}
export const gearStat = (m, k) => ((gearFx(m.equip).stats || {})[k] || 0);
export const minionSetMult = (mi, job) => ((gearFx(mi.equip, "minion").minion || {})[job] || 0) + (gearFx(mi.equip, "minion")[job] || 0);
export function noteSets(s, m) {
  m.setsDone = m.setsDone || [];
  for (const p of setProgress(m.equip))
    if (p.n >= p.set.pieces.length && !m.setsDone.includes(p.set.id)) {
      m.setsDone.push(p.set.id);
      log(s, `🧩 ${m.name} completed the ${p.set.icon} ${p.set.name} set!`);
    }
}

// ---- stations: best placed piece (+ same-building synergies) per kind; jobs add up
export function stationFx(s, kind = "enchanting") {
  const G = GR().stations,
    out = { quality: 0, speed: 0, maxSlots: 0, craftQuality: 0, jobs: 0, best: null };
  for (const st of s.structures || [])
    for (const pid of st.pieces) {
      const e = (G[kind] || []).find(x => x.piece === baseId(pid));
      if (!e || (e.structure && st.type !== e.structure)) continue;
      const lv = e.perUpgrade ? st.up || 0 : pieceTier(pid),
        per = e.perUpgrade || e.perTier || {};
      const v = k => (e[k] || 0) + (per[k] || 0) * lv;
      let q = v("quality"),
        sp = v("speed"),
        sl = v("maxSlots");
      const syn = [];
      for (const y of G.synergies || [])
        if ([...st.pieces, ...(st.fittings || [])].map(baseId).includes(y.piece)) (q += y.quality || 0), (sp += y.speed || 0), (sl += y.maxSlots || 0), syn.push(y.desc);
      out.jobs += Math.floor(v("jobs") + 1e-9);
      if (q + sp > out.quality + out.speed || !out.best)
        Object.assign(out, { quality: q, speed: sp, maxSlots: Math.floor(sl + 1e-9), craftQuality: v("craftQuality"), best: { piece: pieceDef(pid).name, tier: e.tier, structure: structDef(st.type).name, syn } });
    }
  return out;
}
// crafting at a station piece (e.g. the workshop's Enchanter's Table) gets its craftQuality
export const stationCraftQ = (s, piece) =>
  (GR().stations.enchanting || []).some(e => e.piece === piece) ? stationFx(s, "enchanting").craftQuality : 0;

// ---- enchanters: mage-line adults, or housed magic-class followers
export function enchanters(s) {
  const out = living(s)
    .filter(m => isAdult(m) && inLine(m, EN().line))
    .map(m => ({ key: "m:" + m.id, name: m.name, skill: (m.skills[EN().skill]?.lvl || 0) + memberFx(m, "enchant"), m }));
  for (const mi of s.minions || [])
    if (EN().minionClasses.includes(mi.cls) && isHoused(s, mi))
      out.push({ key: "n:" + mi.uid, name: mi.name, skill: minionLvl(mi) * EN().minionSkillPerLvl + (EN().minionClassBonus[mi.cls] || 0) + upEnchant(mi), mi });
  return out;
}
const whoOf = (s, key) => enchanters(s).find(x => x.key === key);
const setSyn = w => {
  const y = GR().stations.enchanterSet;
  const eq = w.m ? w.m.equip : w.mi ? w.mi.equip : {};
  const p = setProgress(eq).find(x => x.set.id === y.set);
  return p && p.n >= y.pieces ? y : { quality: 0, speed: 0 };
};
export const enchSpeed = (s, w) => (stationFx(s).speed + setSyn(w).speed) * (1 + w.skill * EN().speedPerSkill);
export const enchJobs = s => (s.enchants = s.enchants || []);

export function enchantIssue(s, key, itemId, enchId, idx) {
  const F = stationFx(s);
  if (!F.jobs) return "needs a Rune Desk or the Arcane Workshop";
  if (enchJobs(s).length >= F.jobs) return `all ${F.jobs} enchanting station(s) busy`;
  const w = whoOf(s, key);
  if (!w) return "needs a mage-line enchanter";
  if (enchJobs(s).some(j => j.who === key)) return `${w.name} is already enchanting`;
  if (!s.vault.includes(itemId)) return "item must be in the vault";
  const it = itemDef(itemId),
    e = enchDef(enchId);
  if (!it || !e) return "missing";
  if (!e.on.includes(it.slot)) return `${e.name} doesn't go on ${it.slot}`;
  const n = enchSlots(it),
    cur = splitId(itemId).ench;
  if (!n) return "no enchant slots";
  if (idx == null) idx = cur.length;
  if (idx >= n) return "no free slot (replace one)";
  if (idx >= F.maxSlots) return `this station can only work slot ${F.maxSlots} and below`;
  if (w.skill < e.minSkill) return `Enchanting ${e.minSkill}`;
  if (!afford(s, e.reagents)) return "missing reagents";
  return null;
}
export function startEnchant(s, key, itemId, enchId, idx) {
  if (idx == null) idx = splitId(itemId).ench.length;
  if (enchantIssue(s, key, itemId, enchId, idx)) return false;
  const e = enchDef(enchId);
  pay(s, e.reagents);
  s.vault.splice(s.vault.indexOf(itemId), 1);
  enchJobs(s).push({ uid: "en" + s.nextId++, who: key, item: itemId, idx, ench: enchId, need: e.days, prog: 0, start: s.day });
  return true;
}
export function enchantDay(s) {
  for (const j of [...enchJobs(s)]) {
    const w = whoOf(s, j.who);
    if (!w) continue; // enchanter away/unhoused: the job waits, never lost
    j.prog += Math.max(0.1, enchSpeed(s, w));
    if (w.m) gainXp(s, w.m, EN().skill, EN().xpPerDay);
    if (j.prog < j.need || !vaultRoom(s)) continue;
    const { base, ench } = splitId(j.item);
    const roll = w.skill / 50 + stationFx(s).quality + setSyn(w).quality + rng() * 0.5;
    const tok = j.ench + (roll >= EN().greaterAt ? "*" : "");
    ench[j.idx] = tok;
    const id = joinId(base, ench);
    s.vault.push(id);
    s.enchants = enchJobs(s).filter(x => x !== j);
    log(s, `✨ ${w.name} enchanted ${itemDef(base).name} with ${isGreater(tok) ? "Greater " : ""}${enchDef(tok).name}.`);
    introNote(s, "enchanted");
  }
}
export function disenchant(s, itemId, idx) {
  const i = s.vault.indexOf(itemId);
  const { base, ench } = splitId(itemId);
  if (i < 0 || !ench[idx]) return false;
  const e = enchDef(ench[idx]);
  ench.splice(idx, 1);
  s.vault[i] = joinId(base, ench);
  for (const [k, v] of Object.entries(e.reagents)) s.res[k] = (s.res[k] || 0) + Math.floor(v * EN().disenchantRefund);
  log(s, `✨ Disenchanted ${e.name} from ${itemDef(base).name} (half the reagents back).`);
  return s.vault[i];
}
export const enchTimer = (s, j) => ({ p: Math.min(1, j.prog / j.need), left: (() => { const w = whoOf(s, j.who); return w ? Math.max(0, (j.need - j.prog) / Math.max(0.1, enchSpeed(s, w))) : null; })() });
