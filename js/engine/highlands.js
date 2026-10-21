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
