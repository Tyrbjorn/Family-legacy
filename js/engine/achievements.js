import { taintDev } from "./dev.js";
// Achievements: data-driven goals with progress, hidden entries and small rewards.
import { craftingUnlocked } from "./crafting.js";
import { addRenown, legacyState } from "./legacy.js";
import { minionLvl } from "./minions.js";
import { D, log } from "./state.js";

export const inc = (s, k, n = 1) => {
  if (!s.counts) s.counts = {};
  s.counts[k] = (s.counts[k] || 0) + n;
};

function generation(s, m, seen = new Set()) {
  if (!m || !m.parents || seen.has(m.id)) return 1;
  seen.add(m.id);
  const ps = m.parents.map(id => s.members.find(x => x.id === id)).filter(Boolean);
  return 1 + Math.max(0, ...ps.map(p => generation(s, p, seen)));
}

const METRICS = {
  crafters: s => (craftingUnlocked(s) ? 1 : 0),
  dungeons: s => (s.cleared || []).length,
  generations: s => Math.max(1, ...s.members.map(m => generation(s, m))),
  minionLevels: s => (s.minions || []).reduce((a, mi) => a + minionLvl(mi), 0),
  quests: s => s.members.reduce((a, m) => a + (m.questsDone || 0), 0),
  rareDrops: s => (s.found || []).length,
  land: s => (s.land || []).length,
  buildings: s => (s.structures || []).length,
  legacyEarned: s => legacyState(s).earned,
  renown: s => s.renown,
};

export const metric = (s, id) => (METRICS[id] ? METRICS[id](s) : (s.counts || {})[id] || 0);

export const achDefs = () => D.achievements || [];

export function achProgress(s, a) {
  return { have: Math.min(a.goal, metric(s, a.metric)), goal: a.goal, done: !!(s.ach || {})[a.id] };
}

function grant(s, a) {
  const r = a.reward || {};
  if (r.renown) addRenown(s, null, r.renown);
  if (r.coin) s.res.coin += r.coin;
  if (r.legacy) {
    const L = legacyState(s);
    L.renown += r.legacy;
    L.earned += r.legacy;
  }
  const parts = [r.renown && `+${r.renown} renown`, r.coin && `+${r.coin}🪙`, r.legacy && `+${r.legacy} Legacy`].filter(
    Boolean,
  );
  const msg = `🏅 Achievement: ${a.name}${parts.length ? " (" + parts.join(", ") + ")" : ""}`;
  log(s, msg);
}

export function checkAchievements(s) {
  if (!s.ach) s.ach = {};
  taintDev(s);
  if (s.devRun) return [];
  const got = [];
  for (const a of achDefs()) {
    if (s.ach[a.id] != null || metric(s, a.metric) < a.goal) continue;
    s.ach[a.id] = s.day;
    grant(s, a);
    got.push(a.id);
  }
  return got;
}
