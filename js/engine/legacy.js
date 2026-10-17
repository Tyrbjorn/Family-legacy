import { gameFx, diffRenown } from "./difficulty.js";
import { foodOutputMult } from "./food.js";
import { DEV_SPEEDS, devOn } from "./dev.js";
// Prestige: per-member renown, Legacy Renown banked at the Graveyard, permanent Legacy upgrades,
// and game speed (global speed selector + tick bonuses from skill, stat, furniture and legacy).
import { estEff, structDef } from "./estate.js";
import { newGame } from "./save.js";
import { D, log } from "./state.js";

const FALLBACK = { tickCap: 4, memberTickCap: 1.5, speedTiers: [1], renown: {}, upgrades: [] };

export const LG = () => D.legacy || FALLBACK;

export function legacyState(s) {
  if (!s.legacy) s.legacy = { renown: 0, earned: 0, ups: {} };
  if (!s.legacy.ups) s.legacy.ups = {};
  return s.legacy;
}

export const legacyDef = id => LG().upgrades.find(x => x.id === id);

export const legacyTier = (s, id) => (s.legacy && s.legacy.ups[id]) || 0;
export function legacyCost(s, id) {
  const u = legacyDef(id), nx = u && u.tiers[legacyTier(s, id)];
  return nx ? nx.cost : null;
}

export function legacyValue(s, id) {
  const u = legacyDef(id);
  const t = legacyTier(s, id);
  return u && t ? u.tiers[t - 1].value : 0;
}

export const hasLegacy = (s, id) => legacyTier(s, id) > 0;

export function legacyUpIssue(s, id) {
  const u = legacyDef(id);
  if (!u) return "missing";
  const nx = u.tiers[legacyTier(s, id)];
  if (!nx) return "max";
  const c = legacyCost(s, id);
  if (legacyState(s).renown < c) return "needs " + c + " Legacy Renown";
  return null;
}

export function buyLegacy(s, id) {
  if (legacyUpIssue(s, id)) return false;
  const L = legacyState(s);
  const u = legacyDef(id);
  L.renown -= legacyCost(s, id);
  L.ups[id] = legacyTier(s, id) + 1;
  log(s, `🏺 Legacy: ${u.name} tier ${L.ups[id]}.`);
  return true;
}

// ---- renown
export function addRenown(s, m, n) {
  n = Math.round(n * diffRenown(s, m));
  s.renown += n;
  const mem = m && !m.minion;
  if (mem) m.renown = (m.renown || 0) + n;
  tithe(s, mem ? m : null, n);
}

// Ancestors' Tithe: while a Graveyard stands, a share of each renown gain goes straight to Legacy.
// The member's tithed renown is remembered so the death capture only banks the untithed part.
export const titheRate = s => (captureRate(s) > 0 ? (LG().renown.tithe || 0) + legacyValue(s, "tithe") : 0);
function tithe(s, m, n) {
  const r = n > 0 ? titheRate(s) : 0;
  if (!r) return;
  s.titheFrac = (s.titheFrac || 0) + n * r;
  const w = Math.floor(s.titheFrac);
  s.titheFrac -= w;
  const L = legacyState(s);
  L.renown += w;
  L.earned += w;
  s.tithed = (s.tithed || 0) + w;
  if (m) m.tithed = (m.tithed || 0) + n;
}

export function addMemberRenown(m, n) {
  if (m && !m.minion) m.renown = (m.renown || 0) + n;
}

export function captureRate(s) {
  let best = 0;
  for (const st of s.structures || []) {
    const d = structDef(st.type);
    if (d && d.capture) best = Math.max(best, d.capture[Math.min(st.up || 0, d.capture.length - 1)]);
  }
  return best;
}

export function bankRenown(s, m) {
  const c = captureRate(s), rate = c && (m.wasHead || m.id === s.head) ? Math.max(c, LG().renown.headBank || 0) : c;
  const n = Math.floor(Math.max(0, (m.renown || 0) - (m.tithed || 0)) * rate); // tithed renown was already banked
  if (!rate) {
    if (m.renown) log(s, `🪦 No graveyard: ${m.name}'s ${Math.floor(m.renown)} renown is lost to legend.`);
    return 0;
  }
  const L = legacyState(s);
  L.renown += n;
  L.earned += n;
  m.banked = n;
  log(s, `🪦 ${m.name} is laid to rest: +${n} Legacy Renown (${Math.round(rate * 100)}% captured).`);
  return n;
}

// ---- speed
export const maxSpeed = s => Math.max(1, legacyValue(s, "speed"));

export const speedOptions = s => [...LG().speedTiers.filter(v => v <= maxSpeed(s)), ...(devOn() ? DEV_SPEEDS : [])];

export function setSpeed(s, v) {
  if (!speedOptions(s).includes(v)) return false;
  s.speed = v;
  return true;
}

export const tickBonus = s => estEff(s, "tick") + legacyValue(s, "tick");

export const globalTick = s => {
  const v = Math.max(1, s.speed || 1);
  if (devOn() && DEV_SPEEDS.includes(v)) return v * (1 + tickBonus(s)); // dev speeds bypass the cap
  return Math.min(LG().tickCap, v * (1 + tickBonus(s)));
};

export function memberTick(m) {
  const focus = (m.skills && m.skills.focus && m.skills.focus.lvl) || 0;
  const wil = Math.max(0, ((m.stats && m.stats.WIL) || 0) - 10);
  return Math.min(LG().memberTickCap, 1 + focus * 0.005 + wil * 0.005);
}

export const resGain = s => (1 + legacyValue(s, "resgain")) * foodOutputMult(s) * gameFx(s, "prod");

export const lifeBonus = s => legacyValue(s, "life");

// New lineage after game over: Legacy carries over.
export function newLineage(old, now) {
  const s = newGame(now);
  s.legacy = JSON.parse(JSON.stringify(legacyState(old)));
  s.speed = Math.min(old.speed || 1, maxSpeed(s));
  return s;
}
