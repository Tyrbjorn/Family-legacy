// R57 the Deep One mix (fl-r57-sea-touched-proposal.md): three kinds, no fractions. Human; Sea-touched (trait
// `seatouched`, family members); Deep One (Young Deep One followers, never family). Sea-touched passes like R56
// Dwarf-blood; joined families get it at birth; late in life the Sea-touched may "change" and go down to Father.
import { D, T, log, rng } from "./state.js";
import { hasBlood } from "./bloodlines.js";
import { DAGON_TOWN, dagonFavour, hydraBlessed } from "./dagon.js";

export const SEAB = { parentChance: 0.5, joinChance: 0.25, life: 10, fishPct: 0.15, changeAge: 50, changeChance: 0.1, blessedChance: 0.2, warnDays: 30, churchPer: 2, churchCap: 10, lodgePer: 1, lodgeCap: 5, outsidePct: 0.05, raidGuard: 15 };
export const isSea = m => !!m && (m.traits || []).includes("seatouched");
const lifeOf = () => ((D.traits || []).find(t => t.id === "seatouched") || {}).life ?? SEAB.life;
export function makeSea(child) {
  if (isSea(child) || hasBlood(child)) return false; // one bloodline per child (dwarf rolls first)
  (child.traits ||= []).push("seatouched");
  child.lifespan = (child.lifespan || T.baseLifespan) + lifeOf();
  child.seaLife = 1;
  return true;
}
// birth: a Sea-touched parent passes it half the time; a family that joined the Lodge has 25% per child
export function seaBirth(s, child, parents, roll = rng) {
  if (isSea(child) || hasBlood(child)) return false;
  const p = parents.some(isSea) ? SEAB.parentChance : s.dagonPact === "join" ? SEAB.joinChance : 0;
  return p > 0 && roll() < p && makeSea(child);
}
export const seaFishMult = who => (isSea(who) ? 1 + SEAB.fishPct : 1);
const seaHead = s => isSea((s.members || []).find(m => m.id === s.head));
// outside Saltmere a Sea-touched head pays a little more; in Saltmere they count as locals (see dagonOutsider)
export const seaBuyMult = (s, town) => (s && town && town !== DAGON_TOWN && seaHead(s) ? 1 + SEAB.outsidePct : 1);
export const seaLocal = s => !!s && seaHead(s);
export const seaAdults = s => (s.members || []).filter(m => m.alive && isSea(m) && (m.ageDays || 0) >= 16 * T.daysPerYear);
// deps: { church(s, n), addMinion(s, type, why), goDown(s, m) }
export function seaDay(s, deps) {
  const yr = (s.day || 0) % T.daysPerYear === 0 && s.day > 0;
  for (const m of s.members || []) if (m.alive && m.tideCall != null && s.day >= m.tideCall) seaChange(s, m, deps);
  if (!yr) return;
  const n = (s.members || []).filter(m => m.alive && isSea(m)).length;
  if (n) deps.church(s, -Math.min(SEAB.churchCap, SEAB.churchPer * n)), dagonFavour(s, Math.min(SEAB.lodgeCap, SEAB.lodgePer * n));
  const p = hydraBlessed(s) ? SEAB.blessedChance : SEAB.changeChance;
  for (const m of s.members || [])
    if (m.alive && isSea(m) && m.tideCall == null && m.id !== s.head && (m.ageDays || 0) >= SEAB.changeAge * T.daysPerYear && rng() < p) {
      m.tideCall = s.day + SEAB.warnDays;
      log(s, `🌊 ${m.name} hears the tide calling. In ${SEAB.warnDays} days they will go down to Father.`);
    }
}
export function seaChange(s, m, deps) {
  const alive = (s.members || []).filter(x => x.alive);
  if (m.id === s.head || alive.length < 3) return (m.tideCall = null), null; // never the head or the last adults: the call fades
  deps.goDown(s, m);
  m.changed = s.day;
  if (s.dagonPact === "join" && deps.addMinion(s, "deepone", "change")) log(s, `🐸 ${m.name} comes back up out of the sea, changed: a Young Deep One, still yours.`);
  return m;
}
export const SEA_LINES = "seaKin"; // families.json dagonLocals.seaKin: Saltmere's lines for a Sea-touched head
