import { findId } from "./lookup.js";
// Item types in play: per-member item power (class fit, proficiency, dodge, caster robes, Bulwark),
// two-handed clashes, enemy armor vs weapon hits, arcane spell failure, proficiency growth and the old-save start.
import { baseStats } from "./geardata.js";
import { traitSum } from "./family.js";
import { cls } from "./guilds.js";
import { itemDef } from "./inventory.js";
import { D } from "./state.js";

export const GK = () => D.gear.kinds;
const qMult = it => (it.quality ? (findId(D.crafting.qualities, it.quality) || { mult: 1 }).mult : 1);
// stats of an item (quality included; enchant cp stays a flat add on it.cp)
export function gstats(idOrIt) {
  const it = typeof idOrIt === "string" ? itemDef(idOrIt) : idOrIt;
  return it && it.type ? baseStats(GK(), it, qMult(it)) : null;
}
const lvl = (m, k) => ((m.skills || {})[k] || { lvl: 0 }).lvl;
export const isCaster = m => {
  const c = m && cls(m);
  return !!c && (c.cpSkills || []).some(k => GK().spellFail.magicSkills.includes(k));
};
export function gearGroup(m) {
  const c = m && m.cls;
  return c ? Object.values(GK().groups).find(g => g.classes.includes(c)) || null : null;
}
// "primary" | "secondary" | "off" for a weapon/armor family; no class (or an unlisted one) = secondary everywhere
export function famFit(m, fam) {
  const g = gearGroup(m);
  if (!g) return "secondary";
  if (g.primary.includes(fam)) return "primary";
  if (g.secondary.includes(fam) || GK().always.includes(fam)) return "secondary";
  return "off";
}
export const profCap = (m, fam) => GK().prof.caps[famFit(m, fam)];
// proficiency = trained use, or what the matching skills already imply (swordsmanship → blades, archery → bows …), capped by class
export const skillProf = (m, fam) => Object.entries(GK().prof.fromSkills[fam] || {}).reduce((a, [k, w]) => a + lvl(m, k) * w, 0);
export const prof = (m, fam) => Math.min(profCap(m, fam), Math.max(((m && m.wprof) || {})[fam] || 0, m && m.skills ? skillProf(m, fam) : 0));
export const profMult = (m, fam) => 1 + GK().prof.perPt * prof(m, fam);
export const fitMult = (m, fam) => (famFit(m, fam) === "off" ? GK().prof.offMult : 1);

// dodge from the worn armor's class, scaled by AGI, Evasion and the Nimble trait; capped
export function memberDodge(m, armorId) {
  const st = gstats(armorId);
  if (!st || !st.cls) return 0;
  const K = GK(), ac = K.armorClasses[st.cls], agi = (m.stats || {}).AGI || 0;
  const v = ac.dodge * (1 + agi / K.dodge.agiDiv) + ac.evade * (lvl(m, "evasion") * K.dodge.perEvasion + traitSum(m, "dodge"));
  return Math.min(K.dodge.cap, Math.max(0, v));
}
// arcane spell failure for this member in this armor (casters only): class base, cut by that armor proficiency, Battle Mage clears light, mithril halves
export function spellFail(m, armorId = (m.equip || {}).armor) {
  const st = gstats(armorId);
  if (!st || !st.cls) return 0;
  let f = st.spellFail; // mithril already halved
  if ((cls(m) || {}).noSpellFail) return 0; // Battle Mage never miscasts in armor
  f *= 1 - (GK().spellFail.profCut * prof(m, st.cls)) / 100;
  return Math.max(0, f);
}
export const memberFail = m => (isCaster(m) ? spellFail(m) : 0);

// what this item adds to this member's CP
export function itemCpFor(m, id) {
  const it = itemDef(id);
  if (!it) return 0;
  const st = gstats(it);
  if (!st || !m) return it.cp || 0;
  let c = it.cp || 0;
  if (st.cls) {
    c += (memberDodge(m, id) - st.dodge) * GK().dodge.cpPer;
    if (st.spell && (!isCaster(m) || (cls(m) || {}).noCasterGear)) c -= st.spell; // robes: caster bonus (not for Battle Mages)
    if (st.cls === "heavy") c += st.def * traitSum(m, "bulwark");
  }
  if (st.caster && isCaster(m) && !(cls(m) || {}).noCasterGear) c *= 1 + st.caster;
  return Math.max(0, c * fitMult(m, st.fam) * profMult(m, st.fam));
}
// Auto Equip / compare score: CP, minus what arcane spell failure costs a caster
export function itemScore(m, id, memberCp = 0) {
  let v = itemCpFor(m, id);
  const st = gstats(id);
  if (st && st.cls && isCaster(m)) v -= spellFail(m, id) * memberCp;
  return v;
}
// a two-handed weapon that blocks this offhand?
export function clash(weaponId, offId) {
  const w = gstats(weaponId), o = gstats(offId);
  return !!(w && o && w.blocks.includes(o.fam));
}
// enemy armor A soaks part of every weapon hit (at most 80%); mace and adamantium ignore part of it
export function armorLoss(m, A) {
  const id = (m.equip || {}).weapon, st = gstats(id);
  if (!A || !st || !st.hit) return 0;
  const it = itemDef(id), k = (it.cp || 1) / Math.max(1, st.dps); // keep enchant scaling
  const soak = Math.min(0.8 * st.hit, A * (1 - Math.min(0.9, st.pierce || 0)));
  return st.spd * soak * k * fitMult(m, st.fam) * profMult(m, st.fam);
}
// families this member is training right now (weapon, offhand shield, armor class)
export function wornFams(m) {
  const f = [];
  for (const sl of ["weapon", "offhand", "armor"]) {
    const st = gstats((m.equip || {})[sl]);
    if (st && st.fam !== "kit" && st.fam !== "quiver" && st.fam !== "focus") f.push(st.fam);
  }
  return f;
}
export function gainProf(m, n = GK().prof.perWin) {
  m.wprof = m.wprof || {};
  for (const fam of wornFams(m)) m.wprof[fam] = Math.min(profCap(m, fam), (m.wprof[fam] || 0) + n);
}
// old saves: proficiency starts from the matching skills (capped by class)
export function profFromSkills(m) {
  m.wprof = m.wprof || {};
  for (const [fam, ks] of Object.entries(GK().prof.fromSkills)) {
    const v = Object.entries(ks).reduce((a, [k, w]) => a + lvl(m, k) * w, 0);
    if (v > (m.wprof[fam] || 0)) m.wprof[fam] = Math.min(profCap(m, fam), Math.round(v));
  }
}
export const famName = f => GK().famNames[f] || f;
