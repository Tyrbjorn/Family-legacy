// Auto Equip: once a day, fill empty or auto-filled slots with the best gear in the vault (family first, then followers).
// Armory (Guardhouse upgrade) unlocks weapons/armor/offhands; the Workshop unlocks follower tools. Hand-equipped slots are left alone.
import { boughtUps } from "./estate-place.js";
import { hasStruct } from "./estate.js";
import { equip, itemDef } from "./inventory.js";
import { equipMinion } from "./minion-special.js";
import { isAdult, living } from "./state.js";

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
    if (it && it.slot === slot && ok(it) && cpOf(id) > cpOf(b || cur)) b = id;
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

export function autoEquipDay(s) {
  const gear = autoEqOn(s, "gear"),
    tools = autoEqOn(s, "tools");
  if (!gear && !tools) return;
  if (gear)
    for (const m of living(s).filter(isAdult))
      for (const slot of ["weapon", "offhand", "armor"])
        fill(s, m, slot, undefined, id => {
          const had = !!m.equip[slot];
          if (!equip(s, m, id)) return false;
          if (had) s.vault.push(m.bag.pop()); // the replaced piece goes back to the vault
          return true;
        });
  for (const mi of s.minions || []) {
    if (gear && mi.job === "guard") for (const slot of ["weapon", "armor"]) fill(s, mi, slot, undefined, id => equipMinion(s, mi.uid, id));
    if (tools && mi.job) fill(s, mi, "tool", it => it.toolFor === mi.job, id => equipMinion(s, mi.uid, id));
  }
}
