import { extraSlots } from "./minionups.js";
import { CR } from "./inventory.js";
import { famFx } from "./paths.js";
import { upJobMult, upVigor } from "./minionups.js";
import { minionSetMult } from "./gear.js";
import { buildingReqMet, hasStruct, structDef } from "./estate.js";
import { cls, guildDef, rankName } from "./guilds.js";
import { itemDef, vaultRoom } from "./inventory.js";
import { D, living } from "./state.js";
import { housingKind } from "./minion-housing.js";
import { addMinion } from "./minions.js";

// ---- special minions (from classes, guild ranks, quests)
export function specialSource(s, t) {
  const src = t.source,
    L = living(s);
  if (src.class) {
    const m = L.find(x => x.cls === src.class);
    return m ? `${cls(m).name} ${m.name}` : null;
  }
  if (src.guild) {
    const m = L.find(x => x.guild && x.guild.id === src.guild && x.guild.rank >= src.rank);
    return m ? `${rankName(src.rank)} of ${guildDef(src.guild).name}` : null;
  }
  if (src.quest)
    return (s.doneQuests || []).includes(src.quest) ? `quest: ${D.quests.find(q => q.id === src.quest).name}` : null;
  if (src.buildings)
    return buildingReqMet(s, src.buildings)
      ? "drawn by your " + src.buildings.map(g => structDef(g.find(id => hasStruct(s, id))).name).join(" + ")
      : null;
  return null;
}

export function sourceLabel(t) {
  const src = t.source;
  if (src.buildings)
    return "Estate: " + src.buildings.map(g => g.map(id => structDef(id).name).join(" or ")).join(" + ");
  if (src.class) return `Class: ${D.classes.find(c => c.id === src.class).name}`;
  if (src.guild) return `${guildDef(src.guild).name} – ${rankName(src.rank)}`;
  return `Quest: ${D.quests.find(q => q.id === src.quest).name}`;
}

export function checkSpecialMinions(s) {
  for (const t of D.minions.types.filter(x => x.special)) {
    if (s.specialGranted.includes(t.id)) continue;
    const why = specialSource(s, t);
    if (why) {
      s.specialGranted.push(t.id);
      addMinion(s, t.id, why);
    }
  }
}

export function minionGearMult(mi, job) {
  const g = mi.equip || {},
    cp = sl => (itemDef(g[sl]) || {}).cp || 0;
  let m = 1 + cp("charm") / 100;
  if (job === "guard") m += (cp("weapon") + cp("armor")) / 50;
  const t = itemDef(g.tool);
  if (t && t.toolFor === job) m += t.cp / 40;
  return m + minionSetMult(mi, job) + upJobMult(mi, job);
}

export const minionSurvival = (mi, s) =>
  1 / (1 + ((itemDef((mi.equip || {}).armor) || {}).cp || 0) / 20 + upVigor(mi) + (s ? famFx(s, "survival") : 0));
export const minionSlots = mi => [...CR().minionSlots, ...extraSlots(mi)];

export function equipMinion(s, uid, id) {
  const mi = s.minions.find(x => x.uid === uid);
  const it = itemDef(id);
  const i = s.vault.indexOf(id);
  if (
    !mi ||
    !it ||
    i < 0 ||
    !minionSlots(mi).includes(it.slot) ||
    (it.companion && !["kennel", "perch", "brazier"].includes(housingKind(mi)))
  )
    return false;
  mi.equip = mi.equip || {};
  if (mi.autoEq) delete mi.autoEq[it.slot];
  s.vault.splice(i, 1);
  if (mi.equip[it.slot]) s.vault.push(mi.equip[it.slot]);
  mi.equip[it.slot] = id;
  return true;
}

export function unequipMinion(s, uid, slot) {
  const mi = s.minions.find(x => x.uid === uid);
  if (!mi || !mi.equip || !mi.equip[slot] || !vaultRoom(s)) return false;
  s.vault.push(mi.equip[slot]);
  delete mi.equip[slot];
  if (mi.autoEq) delete mi.autoEq[slot];
  return true;
}
