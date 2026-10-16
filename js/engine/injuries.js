// Tiered injuries: 1 Bruised (works slower), 2 Wounded, 3 Maimed, 4 Crippling (rest; m.injured = days left).
// m.inj = { tier, day, treated, counted }; m.perm = [permanent injury ids]; m.load = untreated load (m.loadDay).
// Death only on a bad Crippling roll or infection when untreated wounds pile up. Numbers: tuning.injuries.
import { T, log, rng } from "./state.js";
import { gameLvl, chalLvl } from "./difficulty.js";
import { kill } from "./family.js";

const IJ = () => T.injuries;
export const injTier = n => IJ().tiers[n - 1];
export const permDef = id => IJ().permanent.find(p => p.id === id);
export const permFx = (m, k) => ((m && m.perm) || []).reduce((a, id) => a + ((permDef(id) || { fx: {} }).fx[k] || 0), 0);
const healerKin = s => s.members.some(x => x.alive && (x.paths || []).some(p => p.id === "apothecary" || (p.id === "alchemy" && p.spec === "herbalist")));

// opts: { guards, treated, dressing (Field Dressing: tier 2 → 1) }
export function injure(s, m, tier, why, o = {}) {
  if (!m || m.minion || !m.alive) return;
  if (tier === 2 && rng() < IJ().upgradeMaimed[gameLvl(s) - 1]) tier = 3;
  let treated = !!o.treated;
  if (o.dressing && tier === 2) (tier = 1), (treated = true);
  if (tier >= 2 && tier <= 3 && (s.res.bandages || 0) >= 1) (s.res.bandages -= 1), tier--, (treated = true), (o.bandaged = true);
  const d = injTier(tier);
  if (tier === 4 && rng() < IJ().crippleDeath[gameLvl(s) - 1] * (chalLvl(m) === 5 ? IJ().doomMult : 1))
    return kill(s, m, `died of crippling wounds${why ? " " + why : ""}`);
  if (m.inj && m.inj.tier > tier && m.injured > 0) return; // a worse injury is already healing
  const days = Math.ceil((tier === 2 && o.guards ? d.guardDays : d.days) * (o.bandaged ? 1 - IJ().bandageDays : 1));
  m.inj = { tier, day: s.day, treated, counted: false };
  if (tier === 1) m.bruised = s.day + days;
  else m.injured = Math.max(m.injured || 0, days);
  log(s, `${d.icon} ${m.name} is ${d.name}${why ? " " + why : ""} (${days} days${treated ? ", treated" : ""}).`);
}
// any care counts if it comes in the first treatDays
export function treat(s, m) {
  if (m.inj && !m.inj.treated && s.day - m.inj.day <= IJ().treatDays) m.inj.treated = true;
}
// daily: untreated window closes → load (+ infection risk), load decay, recovery → permanent roll
export function injuryDay(s, m) {
  if (m.load > 0 && s.day - (m.loadDay || 0) >= IJ().loadDecayDays) (m.load -= 1), (m.loadDay = s.day);
  const i = m.inj;
  if (!i) return;
  if (!i.treated && !i.counted && i.tier >= 2 && s.day - i.day > IJ().treatDays) {
    i.counted = true;
    if (i.tier >= 3 && (m.load || 0) >= IJ().loadLimit && rng() < IJ().infection) return kill(s, m, "died of infected wounds");
    m.load = (m.load || 0) + i.tier;
    m.loadDay = s.day;
  }
  if (i.tier === 1 ? s.day >= (m.bruised || 0) : !(m.injured > 0)) {
    const pc = (injTier(i.tier).perm || 0) * (healerKin(s) ? IJ().healerPermMult : 1);
    if (pc && rng() < pc) gainPerm(s, m, i.tier);
    m.inj = null;
  }
}
// hook: entries may carry minTier (e.g. lost limbs from Crippling only) and weight (rare ones)
export function gainPerm(s, m, tier = 4) {
  m.perm = m.perm || [];
  if (m.perm.length >= IJ().permMax) return;
  const left = IJ().permanent.filter(p => !m.perm.includes(p.id) && (p.minTier || 0) <= tier && rng() < (p.weight ?? 1));
  if (!left.length) return;
  const p = left[Math.floor(rng() * left.length)];
  m.perm.push(p.id);
  if (p.fx.cha) m.stats.CHA = Math.max(1, (m.stats.CHA || 0) + p.fx.cha);
  log(s, `🤕 ${p.icon} ${m.name} carries a lasting injury: ${p.name} (${p.desc}).`);
}
// speed for the day: Bruised −10%; Limp on trips; +5% craft with a Limp
export const injurySpeed = (s, m) =>
  (m.bruised > s.day ? 1 + injTier(1).speed : 1) *
  (1 + (m.action && ["quest", "gather", "explore", "dungeon", "travel"].includes(m.action.type) ? permFx(m, "travel") : 0) + (m.action && m.action.type === "craft" ? permFx(m, "craft") : 0));
export const injuryXp = (m, sk) => 1 + (["reading", "history"].includes(sk) ? permFx(m, "loreXp") : 0);
export const loadWarn = m => (m.load > 0 ? `Untreated wounds: ${m.load}/${IJ().loadLimit}` : "");
// quest results: deadly fails are Maimed or (20%) Crippling; deadly successes have a 5% Crippling risk
export function questInjury(s, m, q, ok, guards) {
  if (ok) return q.risk === "deadly" && rng() < IJ().deadlySuccessCripple && injure(s, m, 4, `on ${q.name}`);
  if (q.risk === "safe") return;
  if (q.risk === "deadly") return injure(s, m, rng() < IJ().deadlyCripple ? 4 : 3, `on ${q.name}`, { guards });
  injure(s, m, 2, `on ${q.name}`, { guards });
}
// hook for restoration magic / prosthetics: remove a lasting injury (undoing its stat change)
export function removePerm(s, m, id) {
  const p = permDef(id);
  if (!p || !(m.perm || []).includes(id)) return false;
  m.perm = m.perm.filter(x => x !== id);
  if (p.fx.cha) m.stats.CHA -= p.fx.cha;
  log(s, `✨ ${m.name} is healed of ${p.name}.`);
  return true;
}
