import { findId } from "./lookup.js";
// Family tree: members grouped into generations with spouse/children links (living and deceased).
import { rarityRank } from "./traits.js";
import { D, Y } from "./state.js";

export function generationOf(s, m, memo = {}) {
  if (memo[m.id] != null) return memo[m.id];
  memo[m.id] = 0; // cycle guard
  const ps = (m.parents || []).map(id => findId(s.members, id)).filter(Boolean);
  let g = ps.length ? 1 + Math.max(...ps.map(p => generationOf(s, p, memo))) : null;
  if (g == null) {
    // married-in spouses sit on their partner's row
    const sp = findId(s.members, m.spouse);
    g = sp && sp.parents && sp.parents.length ? generationOf(s, sp, memo) : 0;
  }
  return (memo[m.id] = g);
}

export function treeNode(s, m) {
  const born = Math.floor(((m.alive ? s.day : (m.diedDay ?? s.day)) - m.ageDays) / Y()) + 1;
  const died = m.alive ? null : Math.floor((m.diedDay ?? s.day) / Y()) + 1;
  const best = (m.traits || []).slice().sort((a, b) => rarityRank(b) - rarityRank(a))[0] || null;
  const cls = m.cls && findId(D.classes, m.cls);
  return {
    id: m.id,
    name: m.name,
    alive: m.alive,
    gender: m.gender,
    born,
    died,
    age: Math.floor(m.ageDays / Y()),
    cls: cls ? cls.name : null,
    renown: Math.floor(m.renown || 0),
    best,
    spouse: m.spouse || null,
    parents: m.parents || [],
    children: s.members.filter(c => (c.parents || []).includes(m.id)).map(c => c.id),
    minion: !!m.minion,
    marriedOut: m.marriedOut ? ((D.marriage?.houses?.list || []).find(h => h.id === m.marriedOut) || {}).name || m.marriedOut : null,
  };
}

export function familyTree(s) {
  const memo = {};
  const gens = [];
  for (const m of s.members) {
    if (m.minion) continue;
    const g = generationOf(s, m, memo);
    (gens[g] ||= []).push(treeNode(s, m));
  }
  return gens.filter(Boolean);
}
