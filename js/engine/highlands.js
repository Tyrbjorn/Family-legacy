// R50 the Highlands (fl-stub-regions-proposal round 3a): Falconry (Ysolde's falcons and the Falconry skill), Elder
// Tamsin's lead to the Sealed Dwarven Gate, and House Crane, the usurper's house (families.json `usurper`). Crane is kept
// outside the house list on purpose: no drift, troubles, suitors, gifts or truce. It starts Rival and leaves the realm,
// disgraced, once chapter 10 is done. Mountain routes live in world.js (mountainFx) and map.js (mountainWinter).
import { D, log } from "./state.js";

// ---- falcons: +1% exploring finds per Falconry level (cap +30%). Ysolde's own perk is a villager `discover` perk.
export const falconBonus = m => Math.min(0.3, (((m && m.skills && m.skills.falconry) || {}).lvl || 0) * 0.01);

// ---- Elder Tamsin's lead: a location is marked as found (the gate itself stays sealed until R51)
export function followLead(s, e, reveal) {
  const l = D.world && (D.world.locations || []).find(x => x.id === e.loc);
  if (!l) return false;
  s.discovered ||= [];
  if (!s.discovered.includes("loc:" + l.id)) s.discovered.push("loc:" + l.id);
  if (!s.discovered.includes(l.region)) s.discovered.push(l.region);
  if (reveal) reveal(s, l.x, l.y, 60);
  const tw = e.town || l.post; // R51: Thrain's gate post
  if (tw && !s.discovered.includes(tw)) s.discovered.push(tw);
  log(s, `🗺️ ${l.name} is marked on your map.`);
  return true;
}

// ---- House Crane
export const usurperDef = () => (D.families || {}).usurper || null;
export function usurperState(s) {
  const u = usurperDef();
  if (!u) return null;
  if (!s.usurper) s.usurper = { r: u.start ?? -60 };
  return s.usurper;
}
export const usurperGone = s => { const u = usurperDef(); return !!u && (s.doneQuests || []).includes(u.disgracedAfter); };
export function usurperTier(s) {
  if (usurperGone(s)) return "disgraced";
  const r = usurperState(s).r, st = (D.families.status || []).find(t => r <= t.max);
  return st ? st.id : "rival";
}
export function usurperQuestDone(s, q) {
  const u = usurperDef();
  if (!u || !s) return;
  const st = usurperState(s);
  if (q.usurper && !usurperGone(s)) st.r = Math.max(-100, Math.min(-50, st.r + q.usurper)); // never better than Rival
  if (q.id === u.disgracedAfter && !st.gone) {
    st.gone = s.day || 0;
    log(s, `🦩 ${u.name} is disgraced and leaves the realm. House Vael has its name back.`);
  }
}

// ---- R51 the Rune-Sealed Gate: step 9 opens the gate (the location unlocks), finds Dwarfhold and lays the Rune Road
export const RUNE_ROAD = { type: "travel", region: "highlands", mult: 1.15, from: "runeroad", text: "The Rune Road: Highlands travel ×1.15" };
export const gateOpen = s => !!(s && s.gateOpen != null);
export function openGate(s) {
  if (gateOpen(s)) return false;
  s.gateOpen = s.day || 0;
  s.discovered ||= [];
  for (const id of ["dwarfhold", "gatepost", "loc:l_dwarfhold"]) if (!s.discovered.includes(id)) s.discovered.push(id);
  if (!(s.boons ||= []).some(b => b.from === "runeroad")) s.boons.push({ ...RUNE_ROAD });
  if (!(s.unlocks ||= []).includes("recipe:r_ramcart")) s.unlocks.push("recipe:r_ramcart"); // the dwarves show you the Ram Cart
  revealDeeps(s);
  for (const r of ["r_dwarfpick", "r_dwarfaxe", "r_dwarfsickle"]) if (!s.unlocks.includes("recipe:" + r)) s.unlocks.push("recipe:" + r); // R56 dwarf-steel tools
  log(s, "👑 You set the Ironbrow Clan-Crown before the gate, and the Rune-Sealed Gate opens. The Rune Road leads down into Dwarfhold.");
  return true;
}
// a location is locked until its `opensWith` quest is done
export const locLocked = (s, l) => !!l && !!l.locked && !(l.opensWith && (((s && s.doneQuests) || []).includes(l.opensWith) || (s && s.flags && s.flags[l.opensWith] != null))); // R54 or a flag (the Deep Door)
export const locName = (s, l) => (l.openName && !locLocked(s, l) && l.locked ? l.openName : l.name);
export const locDesc = (s, l) => (l.openDesc && !locLocked(s, l) && l.locked ? l.openDesc : l.desc);

// ---- R51 mountain rams: bought at the Eyrie; two fed rams with a free stall breed a lamb every `days` once the region is known
export function ramsDay(s) {
  const a = D.world && D.world.haul && D.world.haul.animals && D.world.haul.animals.ram, b = a && a.breed;
  if (!b || !s.animals) return;
  const n = s.animals.ram || 0;
  const stallsFree = (s._stallsFree ?? 1) > 0;
  const fed = !((s.unfed || {}).ram > 0);
  if (n < b.pair || !fed || !(s.discovered || []).includes(b.region)) { if (s.ramBreed) s.ramBreed = 0; return; }
  s.ramBreed = (s.ramBreed || 0) + 1;
  if (s.ramBreed < b.days) return;
  s.ramBreed = 0;
  if (!stallsFree) return log(s, "🐏 Your rams could breed, but there is no free stable stall.");
  s.animals.ram = n + 1;
  log(s, `🐏 A ram lamb was born (${n + 1} mountain rams).`);
}

// ---- R52 Dwarfhold: inside the hold (the Old Deeps, Deep Iron Lode, Dwarven Coal) once the gate is open
export const DEEPS = ["d_olddeeps", "n_deepiron", "n_dwarfcoal"];
export function revealDeeps(s) {
  for (const id of DEEPS) if (!(s.revealed ||= []).includes(id)) s.revealed.push(id);
}
// Oath of the Thane: +2 follower places, War-Chariot plans, +10% in chapter 10
export function swearOath(s) {
  if ((s.flags ||= {}).thaneOath != null) return false;
  s.flags.thaneOath = s.day || 0;
  if (!(s.unlocks ||= []).includes("recipe:r_warchariot")) s.unlocks.push("recipe:r_warchariot");
  if (!(s.boons ||= []).some(b => b.from === "oath")) s.boons.push({ type: "questBonus", quest: "st10", pct: 0.1, from: "oath", text: "Clan Ironbrow stands with you: +10% in Reclaim the Name" });
  log(s, "🛡️ The Thane swears Clan Ironbrow's oath to your family: two more dwarves may serve, the War-Chariot plans are yours, and the clan will stand with you in chapter 10.");
  return true;
}
