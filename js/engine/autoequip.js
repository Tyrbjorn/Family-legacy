// Auto Equip: once a day, fill empty or auto-filled slots with the best gear in the vault (family first, then followers).
// Armory (Guardhouse upgrade) unlocks weapons/armor/offhands; the Workshop unlocks follower tools. Hand-equipped slots are left alone.
import { boughtUps } from "./estate-place.js";
import { hasStruct } from "./estate.js";
import { equip, itemDef } from "./inventory.js";
import { equipMinion } from "./minion-special.js";
import { isHeld } from "./holds.js";
import { isAdult, living } from "./state.js";
import { clash, itemScore } from "./geartypes.js";
import { cp } from "./family.js";

export const AUTO_EQ = ["gear", "tools"];
export const autoEqUnlocked = (s, k) =>
  k === "tools" ? hasStruct(s, "smithy") : (s.structures || []).some(st => boughtUps(st).some(u => u.name === "Armory"));
export const autoEqOn = (s, k) => autoEqUnlocked(s, k) && !(s.autoOff || {})["eq_" + k];

const cpOf = id => (id && (itemDef(id) || {}).cp) || 0;
// best vault item for a slot that beats `cur`; ok() filters
function best(s, slot, cur, ok = () => true) {
  let b = null;
  for (const id of s.vault) {
    const it = itemDef(id);
    if (it && it.slot === slot && !isHeld(s, id) && ok(it) && cpOf(id) > cpOf(b || cur)) b = id;
  }
  return b;
}

function fill(s, who, slot, ok, put) {
  who.equip = who.equip || {};
  const cur = who.equip[slot];
  if (cur && !(who.autoEq || {})[slot]) return; // hand-equipped
  const id = best(s, slot, cur, ok);
  if (!id || !put(id)) return;
  (who.autoEq = who.autoEq || {})[slot] = true;
}

// family members: score = this member's item CP (class fit −50% off-class, proficiency, dodge from AGI/Evasion,
// caster robes) minus a caster's arcane spell failure; a two-handed weapon must beat weapon + the offhand it frees
export const autoEquipMember = (s, m) => ["weapon", "armor", "offhand"].forEach(sl => memberFill(s, m, sl));
function memberFill(s, m, slot) {
  m.equip = m.equip || {};
  const cur = m.equip[slot];
  if (cur && !(m.autoEq || {})[slot]) return; // hand-equipped
  const mcp = cp(s, m), sc = id => (id ? itemScore(m, id, mcp) : 0);
  const other = slot === "weapon" ? "offhand" : slot === "offhand" ? "weapon" : null;
  let b = null, bv = sc(cur) + 0.01;
  for (const id of s.vault) {
    const it = itemDef(id);
    if (!it || it.slot !== slot || isHeld(s, id)) continue;
    let v = sc(id);
    if (other && m.equip[other]) {
      const w = slot === "weapon" ? id : m.equip.weapon, o = slot === "offhand" ? id : m.equip.offhand;
      if (clash(w, o)) {
        if (slot === "offhand" || !(m.autoEq || {}).offhand) continue; // never drop a weapon or a hand-picked offhand for an offhand
        v -= sc(m.equip.offhand);
      }
    }
    if (v > bv) (b = id), (bv = v);
  }
  if (!b) return;
  const before = m.bag.length;
  if (!equip(s, m, b)) return;
  while (m.bag.length > before) s.vault.push(m.bag.pop()); // replaced / freed pieces go back to the vault
  (m.autoEq = m.autoEq || {})[slot] = true;
}

export function autoEquipDay(s) {
  const gear = autoEqOn(s, "gear"),
    tools = autoEqOn(s, "tools");
  if (!gear && !tools) return;
  if (gear) for (const m of living(s).filter(m => isAdult(m) && !m.noAutoEq)) for (const slot of ["weapon", "armor", "offhand"]) memberFill(s, m, slot);
  for (const mi of s.minions || []) {
    if (gear && mi.job === "guard") for (const slot of ["weapon", "armor"]) fill(s, mi, slot, undefined, id => equipMinion(s, mi.uid, id));
    if (tools && mi.job) fill(s, mi, "tool", it => it.toolFor === mi.job, id => equipMinion(s, mi.uid, id));
  }
}
