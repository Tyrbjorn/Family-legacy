// Crafting tab support: crafter unlock, quality odds, per-crafter queues and minion craft orders.
import { CR, recipeDef, recipeIssue, qualityScore } from "./inventory.js";
import { memberGuild } from "./guilds.js";
import { inLine } from "./skills.js";
import { living } from "./state.js";

const unlockCfg = () => CR().crafterUnlock || { memberLines: [], memberGuilds: [], minionClasses: [] };

export function isMemberCrafter(m) {
  const c = unlockCfg();
  return c.memberLines.some(l => inLine(m, l)) || c.memberGuilds.some(g => !!memberGuild(m, g));
}

export const isMinionCrafter = mi => unlockCfg().minionClasses.includes(mi.cls);

export const crafters = s => [...living(s).filter(isMemberCrafter), ...(s.minions || []).filter(isMinionCrafter)];

// Sticky: once any crafter exists the Crafting tab stays visible.
export function craftingUnlocked(s) {
  if (!s.craftUnlocked && crafters(s).length) s.craftUnlocked = true;
  return !!s.craftUnlocked;
}

// Quality roll is score + U(0, 0.5); odds are the overlap of that window with each quality band.
export function qualityOdds(s, m, rc, mi) {
  const lo = qualityScore(s, m, rc, mi);
  const hi = lo + 0.5;
  const Q = CR().qualities;
  return Q.map((q, i) => {
    const a = i === 0 ? -Infinity : q.score;
    const b = i + 1 < Q.length ? Q[i + 1].score : Infinity;
    const p = Math.max(0, Math.min(hi, b) - Math.max(lo, a)) / 0.5;
    return { id: q.id, name: q.name, p };
  }).filter(x => x.p > 0.001);
}

export function matsStatus(s, rc) {
  return Object.entries(rc.mats).map(([k, need]) => ({
    k,
    need,
    have: Math.floor(s.res[k] || 0),
    ok: (s.res[k] || 0) >= need,
  }));
}

export function queueCraft(s, m, rcId) {
  const rc = recipeDef(rcId);
  if (!rc || !m || !m.alive) return false;
  if (!m.craftQueue) m.craftQueue = [];
  m.craftQueue.push(rcId);
  if (!m.action || m.action.type !== "craft") {
    if (m.id !== s.activeId) m.order = { type: "craft" };
  }
  return true;
}

export function unqueueCraft(m, i) {
  if (!m.craftQueue || i < 0 || i >= m.craftQueue.length) return false;
  m.craftQueue.splice(i, 1);
  return true;
}

// Pull the next queued recipe (skipping ones that can't be crafted right now stays the caller's choice).
export function nextQueued(m) {
  return m.craftQueue && m.craftQueue.length ? m.craftQueue.shift() : null;
}

export function setMinionCraft(s, mi, rcId) {
  if (!mi) return false;
  mi.craftOrder = rcId && recipeDef(rcId) ? rcId : null;
  return true;
}

export const recipeOkFor = (s, m, rc) => !recipeIssue(s, m, rc);
