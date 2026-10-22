// R56 the dwarf rules (fl-r56-dwarf-rules-proposal.md): travel limits for dwarf family members (spouses from Clan
// Ironbrow), old-retainer loyalty, Auto's farming / teamster rules, War-Chariot and Shieldbearer bonuses, dwarf craft
// help, the Oath's places for dwarves only, Dwarf-blood children, and Clan Ironbrow's grudge. Imports state.js only.
import { D, T } from "./state.js";

export const DW = { openGround: 0.8, ramCart: 1.2, retainerMax: 10, chariotGuard: 0.15, shieldPct: 0.1, shieldCap: 0.3, smithPct: 0.1, smithCap: 0.3, runePct: 0.5, runeCap: 1, farmApt: 0.4, bloodChance: 0.5 };
const typeOf = mi => (D.minions.types || []).find(t => t.id === (mi && mi.type)) || {};
export const isDwarfType = t => !!t && t.race === "dwarf";
export const isDwarfMinion = mi => isDwarfType(typeOf(mi));
export const isDwarf = m => !!m && m.race === "dwarf";
const owns = (s, id) => (s.vault || []).includes(id);
export const hasDwarfCart = s => owns(s, "ramcart") || owns(s, "warchariot");
// travel: a dwarf member never rides (no mount), walks ×0.8 off the mountains, and rides the family's Ram Cart at ×1.2 anywhere
export function dwarfTravel(s, m, mountain, mountMult) {
  if (!isDwarf(m)) return mountMult;
  if (owns(s, "ramcart")) return DW.ramCart;
  return mountain ? 1 : DW.openGround;
}
// old retainers: a dwarf follower's loyalty can rise 1 above 100 for each full year served (up to +10)
export const oldRetainer = (s, mi) => (isDwarfMinion(mi) ? Math.min(DW.retainerMax, Math.floor(((s.day || 0) - (mi.since || 0)) / T.daysPerYear)) : 0);
export const loyaltyCap = (s, mi) => 100 + oldRetainer(s, mi);
// the Oath of the Thane's places (minions.json oathCap) are for dwarves only
export const oathExtra = s => ((s.flags || {}).thaneOath != null ? D.minions.oathCap || 0 : 0);
export const dwarvesHired = s => (s.minions || []).filter(x => !x.special && isDwarfMinion(x)).length;
// guard / patrol ×1.15 with a War-Chariot; Shieldbearers +10% raid defence each (cap +30%)
export const chariotMult = (s, job) => ((job === "guard" || job === "patrol") && owns(s, "warchariot") ? 1 + DW.chariotGuard : 1);
export const shieldMult = s => 1 + Math.min(DW.shieldCap, DW.shieldPct * (s.minions || []).filter(x => x.type === "dwarfshield").length);
// family crafting: Dwarf Smiths on the craft job speed forge recipes; Runewrights speed Runestone Anvil recipes
export function dwarfCraftMult(s, rc) {
  const on = t => (s.minions || []).filter(x => x.type === t && x.job === "craft" && !x.paused).length;
  if (!rc) return 1;
  if (rc.station === "runeanvil") return 1 + Math.min(DW.runeCap, DW.runePct * on("dwarfrune"));
  if (rc.station === "forge") return 1 + Math.min(DW.smithCap, DW.smithPct * on("dwarfsmith"));
  return 1;
}
// Clan Ironbrow's grudge: if you sold the gate's secret, they stay Cold until The Ancestor Stones is done
export const grudgeCeil = (s, id) => (id === "ironbrow" && (s.flags || {}).soldGate != null && !(s.doneQuests || []).includes("ht_ironbrow2") ? -25 : null);
// a dwarf spouse from Clan Ironbrow
export function dwarfSpouse(s, sp) {
  if (sp.house !== "ironbrow") return false;
  sp.race = "dwarf";
  sp.lifespan = (sp.lifespan || T.baseLifespan) + (110 - T.baseLifespan);
  return true;
}
// Dwarf-blood: a dwarf parent always passes it; a Dwarf-blood parent passes it half the time
export function dwarfBlood(s, child, parents, rng) {
  if ((child.traits || []).includes("dwarfblood")) return false;
  const full = parents.some(isDwarf), half = parents.some(p => p && (p.traits || []).includes("dwarfblood"));
  if (!full && !(half && rng() < DW.bloodChance)) return false;
  (child.traits ||= []).push("dwarfblood");
  child.lifespan = (child.lifespan || T.baseLifespan) + ((D.traits || []).find(t => t.id === "dwarfblood") || { life: 12 }).life;
  return true;
}
