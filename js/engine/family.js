import { rollTraits, traitStat } from "./traits.js";
import { bankRenown } from "./legacy.js";
import { actionAllowed, defaultAction } from "./actions.js";
import { bedrooms, established, estateStage } from "./estate.js";
import { cls } from "./guilds.js";
import { itemDef } from "./inventory.js";
import { applyMarriage, giftMult, makeSuitor, personaDef } from "./courtship.js";
import { houseDef } from "./houses.js";
const baseGift = id => String(id).replace(/^c\|/, "").split("|")[0];
import { D, NAMES, STATS, T, Y, active, ageY, bl, isAdult, living, log, r, rng } from "./state.js";

export function newMember(s, { gender, age, cls = null, parents = null, stats } = {}) {
  gender = gender || (rng() < 0.5 ? "m" : "f");
  const m = {
    id: s.nextId++,
    name: r(NAMES[gender]),
    gender,
    ageDays: (age || 0) * Y(),
    alive: true,
    cls,
    stats: stats || Object.fromEntries(STATS.map(k => [k, 5])),
    skills: {},
    traits: [],
    spouse: null,
    parents,
    order: { type: "train", target: "farming" },
    action: null,
    injured: 0,
    equip: {},
    bag: [],
    kids: 0,
    lastChild: 0,
    warned: false,
    diedDay: null,
    renown: 0,
    craftQueue: [],
    guild: null,
    adv: null,
    persona: null,
    house: null,
  };
  m.traits = rollTraits(s, 2);
  m.lifespan = T.baseLifespan + traitSum(m, "life") + Math.round((rng() - 0.5) * 8);
  for (const sk of D.skills) m.skills[sk.id] = { lvl: 0, xp: 0 };
  return m;
}

export const traitDef = id => D.traits.find(t => t.id === id);

export const conflicts = (a, b) => {
  const x = traitDef(a),
    y = traitDef(b);
  return a === b || (x && x.opposes === b) || (y && y.opposes === a);
};

export function pickTraits(n, have = []) {
  const out = [...have];
  const pool = [...D.traits].sort(() => rng() - 0.5);
  for (const t of pool) {
    if (out.length >= n) break;
    if (!out.some(o => conflicts(o, t.id))) out.push(t.id);
  }
  return out;
}

export const traitSum = (m, k) => m.traits.reduce((a, t) => a + ((traitDef(t) || {})[k] || 0), 0);

export function fixTraits(m) {
  const kept = [];
  let changed = false;
  for (const t of m.traits) {
    if (!traitDef(t) || kept.some(k => conflicts(k, t))) {
      changed = true;
      m.lifespan -= (traitDef(t) || {}).life || 0;
    } else kept.push(t);
  }
  if (!changed) return false;
  m.traits = pickTraits(2, kept);
  for (const t of m.traits.slice(kept.length)) m.lifespan += traitDef(t).life || 0;
  return true;
}

export function lifeStageMult(m) {
  const a = ageY(m);
  return a >= 65 ? 0.75 : a >= 50 ? 0.9 : 1;
}

export function statVal(m, k) {
  let v = m.stats[k] + traitStat(m, k);
  for (const sk of D.skills) if (sk.stat === k) v += m.skills[sk.id].lvl * 0.2;
  if (["STR", "AGI", "VIT"].includes(k)) v *= lifeStageMult(m);
  return Math.round(v * 10) / 10;
}

export function level(m) {
  return Math.floor(Object.values(m.skills).reduce((a, b) => a + b.lvl, 0) / 5) + 1;
}

export function cp(s, m) {
  const c = cls(m);
  let v = 0;
  if (c) {
    v += c.stats.reduce((a, k) => a + statVal(m, k), 0);
    v += c.cpSkills.reduce((a, k) => a + m.skills[k].lvl * 2, 0);
    v *= c.cpMult || 1;
  } else v = (statVal(m, "STR") + statVal(m, "AGI")) / 2;
  for (const id of Object.values(m.equip)) {
    const it = itemDef(id);
    if (it) v += it.cp || 0;
  }
  v *= 1 + traitSum(m, "cp");
  return Math.round(v);
}

export function kill(s, m, why) {
  if (!m.alive) return;
  m.alive = false;
  m.diedDay = s.day;
  m.action = null;
  for (const id of [...Object.values(m.equip), ...(m.bag || [])]) s.vault.push(id);
  m.equip = {};
  m.bag = [];
  const sp = s.members.find(x => x.id === m.spouse);
  if (sp) sp.widowed = true;
  log(s, `🕯️ ${m.name} (${ageY(m)}) ${why}.`);
  s.deeds.push(`${m.name} ${why} at ${ageY(m)}.`);
  s.renown += level(m) * 5;
  bankRenown(s, m);
  const alive = living(s);
  if (!alive.length) {
    s.gameOver = true;
    s.turbo.on = false;
    log(s, "⚰️ The family line has ended.");
    return;
  }
  if (s.head === m.id) {
    const h =
      alive.filter(isAdult).sort((a, b) => b.ageDays - a.ageDays)[0] || alive.sort((a, b) => b.ageDays - a.ageDays)[0];
    s.head = h.id;
    log(s, `📜 ${h.name} is now Head of Family.`);
  }
  if (s.activeId === m.id) {
    s.needSuccession = true;
    const h = alive.filter(isAdult).sort((a, b) => b.ageDays - a.ageDays)[0] || alive[0];
    s.activeId = h.id;
  }
}

export function inherit(s, child) {
  const ps = (child.parents || []).map(id => s.members.find(x => x.id === id)).filter(Boolean);
  const share = T.inheritShare + bl(s, "library") * 0.01;
  for (const sk of D.skills) {
    const best = Math.max(0, ...ps.map(p => p.skills[sk.id].lvl));
    child.skills[sk.id].lvl = Math.max(child.skills[sk.id].lvl, Math.floor(best * share));
  }
}

export function spawnSuitor(s) {
  const su = makeSuitor(s);
  s.suitors.push(su);
  const p = personaDef(su.persona),
    h = su.house && houseDef(su.house);
  log(
    s,
    `💌 A suitor, ${su.name} the ${D.classes.find(c => c.id === su.cls).name}${h ? " of " + h.name : ""}${p ? " (" + p.name + ")" : ""}, appeared in town.`,
  );
}

export const PROPOSE_COST = 200;
export function proposeIssue(s, suitorId) {
  const m = active(s);
  const su = s.suitors.find(x => x.id === suitorId);
  if (!su) return "suitor gone";
  if (m.spouse) return "already married";
  if (ageY(m) < T.courtAge) return `age ${T.courtAge}+`;
  if (su.affinity < 100) return "affection below 100";
  if (s.res.coin < PROPOSE_COST) return `${PROPOSE_COST} coin for the wedding`;
  if (living(s).length >= bedrooms(s)) return "a free bed at home (build a shelter with a bunk)";
  return null;
}

export function propose(s, suitorId) {
  const m = active(s);
  const su = s.suitors.find(x => x.id === suitorId);
  const cost = PROPOSE_COST;
  if (proposeIssue(s, suitorId)) return false;
  s.res.coin -= cost;
  const sp = newMember(s, { gender: su.gender, age: su.age, cls: su.cls });
  sp.name = su.name;
  sp.spouse = m.id;
  m.spouse = sp.id;
  sp.order = { type: "work" };
  s.members.push(sp);
  s.suitors = s.suitors.filter(x => x !== su);
  applyMarriage(s, m, sp, su);
  if (m.gender === sp.gender) {
    sp.gender = m.gender === "m" ? "f" : "m";
  } // MVP: births need one f partner
  log(s, `💍 ${m.name} married ${sp.name}!`);
  s.deeds.push(`${m.name} married ${sp.name}.`);
  return true;
}

export function giveGift(s, suitorId, itemId) {
  const i = s.vault.indexOf(itemId);
  const su = s.suitors.find(x => x.id === suitorId);
  const it = itemDef(itemId);
  if (i < 0 || !su || !it.affinity) return false;
  s.vault.splice(i, 1);
  su.affinity = Math.min(100, su.affinity + it.affinity * giftMult(su, baseGift(itemId)));
  return true;
}

export function switchTo(s, id) {
  const m = s.members.find(x => x.id === id && x.alive);
  if (!m) return false;
  s.activeId = id;
  s.needSuccession = false;
  if (!m.action && m.order) m.action = { type: m.order.type, target: m.order.target, progress: 0 };
  if (!m.action || !actionAllowed(s, m, m.action)) m.action = defaultAction(s, m);
  return true;
}

export function setOrder(s, id, order) {
  const m = s.members.find(x => x.id === id);
  m.order = order;
  m.action = null;
}

// ---- eras (eras only ADD systems; nothing earlier is ever locked)
export const ERAS = [
  { n: 1, name: "Solo Adventurer", icon: "🧭" },
  { n: 2, name: "Established Family", icon: "🏡" },
  { n: 3, name: "Ruling Power", icon: "👑" },
];

export function era(s) {
  const fam = living(s).length > 1 || s.members.some(m => m.spouse);
  if (s.renown >= 5000 && ["Manor", "Prosperous Estate"].includes(estateStage(s))) return ERAS[2];
  if ((established(s) && fam) || s.renown >= 300) return ERAS[1];
  return ERAS[0];
}

export function nextEraHint(s) {
  const e = era(s).n;
  return e === 1
    ? "Next: build a home on your land and start a family (or reach 300 Renown)."
    : e === 2
      ? "Next: 5,000 Renown and a Manor-tier estate (Era 3 systems coming in a later update)."
      : "Era 3 systems (titles, vassals, taxes) are planned.";
}
