import { findId } from "./lookup.js";
import { onDeathTalents, talentSum } from "./talents.js";
import { gearFx, gearStat } from "./gear.js";
import { rollTraits, traitStat } from "./traits.js";
import { bankRenown } from "./legacy.js";
import { actionAllowed, defaultAction } from "./actions.js";
import { bedrooms, established, estateStage } from "./estate.js";
import { cls } from "./guilds.js";
import { itemDef } from "./inventory.js";
import { itemCpFor } from "./geartypes.js";
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
    bloodV: 1, // R81: bloodline model version (migrateBloodlines skips members that have it)
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
    challenge: 3,
  };
  m.chUntil = m.ageDays + Y(); // challenge can be picked during the first year
  m.traits = rollTraits(s, 2);
  m.lifespan = T.baseLifespan + traitSum(m, "life") + Math.round((rng() - 0.5) * 8);
  for (const sk of D.skills) m.skills[sk.id] = { lvl: 0, xp: 0 };
  return m;
}

export const traitDef = id => findId(D.traits, id);

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

export const traitSum = (m, k) => m.traits.reduce((a, t) => a + ((traitDef(t) || {})[k] || 0), 0) + talentSum(m, k); // R36: active talents add on the same keys

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
  let v = m.stats[k] + traitStat(m, k) + gearStat(m, k);
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
    // magicCap: a limited spell list (Battle Mage) — magic skills only count up to that level; the big spells above it are Archmage-only
    v += c.cpSkills.reduce((a, k) => a + (c.magicCap && D.gear.kinds.spellFail.magicSkills.includes(k) ? Math.min(c.magicCap + talentSum(m, "magicCap"), m.skills[k].lvl) : m.skills[k].lvl) * 2, 0);
    v *= c.cpMult || 1;
  } else v = (statVal(m, "STR") + statVal(m, "AGI")) / 2;
  for (const id of Object.values(m.equip)) v += itemCpFor(m, id); // class fit, proficiency, dodge (geartypes.js)
  const gf = gearFx(m.equip);
  v = (v + (gf.cp || 0)) * (1 + (gf.cpPct || 0));
  v *= 1 + traitSum(m, "cp");
  return Math.round(v);
}

export function kill(s, m, why) {
  if (!m.alive) return;
  m.alive = false;
  m.diedDay = s.day;
  onDeathTalents(s, m); // R36 Hall of Ancestors shrine
  m.action = null;
  for (const id of [...Object.values(m.equip), ...(m.bag || [])]) s.vault.push(id);
  m.equip = {};
  m.bag = [];
  const sp = findId(s.members, m.spouse);
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
    m.wasHead = true;
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
  const ps = (child.parents || []).map(id => findId(s.members, id)).filter(Boolean);
  const share = (T.inheritShare + bl(s, "library") * 0.01) * (1 + (T.inheritBoost || 0));
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
    `💌 A suitor, ${su.name} the ${findId(D.classes, su.cls).name}${h ? " of " + h.name : ""}${p ? " (" + p.name + ")" : ""}, appeared in town.`,
  );
}

export const PROPOSE_COST = 200;
export function proposeIssue(s, suitorId, m = active(s)) {
  const su = findId(s.suitors, suitorId);
  if (!su) return "suitor gone";
  if (m.spouse) return "already married";
  if (ageY(m) < T.courtAge) return `age ${T.courtAge}+`;
  if (su.affinity < 100) return "affection below 100";
  if (s.res.coin < PROPOSE_COST) return `${PROPOSE_COST} coin for the wedding`;
  if (living(s).length >= bedrooms(s)) return "a free bed at home (build a shelter with a bunk)";
  return null;
}

export function propose(s, suitorId, m = active(s)) {
  const su = findId(s.suitors, suitorId);
  const cost = PROPOSE_COST;
  if (proposeIssue(s, suitorId, m)) return false;
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
  s.celebrate = s.day || 0; // R33: Honey Cakes celebration
  s.deeds.push(`${m.name} married ${sp.name}.`);
  return true;
}

export function giveGift(s, suitorId, itemId) {
  const i = s.vault.indexOf(itemId);
  const su = findId(s.suitors, suitorId);
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
  const m = findId(s.members, id);
  m.order = order;
  m.paused = false; // R44: a new order resumes a paused member
  (m.pins = m.pins || {}).order = true; // a hand-set order is pinned: Auto Orders / Courtship leave it alone (unpin on the member card)
  m.faCourt = false;
  m.action = null;
}

// ---- phases (data/phases.json; each phase only ADDS systems; nothing earlier is ever locked)
const PH = () => D.phases.list.filter(p => !p.hidden); // R45: hidden phases (Titles) stay in the data but are not shown
export const phaseCount = () => PH().length;
export const ERAS = new Proxy([], { get: (_, k) => PH()[k] });
const stageAt = (s, st) => { const o = D.estate.stages.map(x => x[1]); return o.indexOf(estateStage(s)) >= o.indexOf(st); };
export function phaseReached(s, p) {
  const q = p.need;
  if (!q || p.planned) return p.n === 1;
  if (q.homeAndFamily) return (established(s) && (living(s).length > 1 || s.members.some(m => m.spouse))) || s.renown >= q.orRenown;
  if (living(s).length < (q.living || 0)) return false;
  if (living(s).filter(isAdult).length < (q.adults || 0)) return false;
  return stageAt(s, q.stage) && s.renown >= (q.renown || 0);
}
export function era(s) {
  let cur = PH()[0];
  for (const p of PH()) if (p.n > 1 && !p.planned && phaseReached(s, p) && p.n === cur.n + 1) cur = p;
  return cur;
}
export const phase = era;
export function nextEraHint(s) {
  const nx = PH().find(p => p.n === era(s).n + 1);
  return !nx ? "" : nx.planned ? `${nx.hint} (Phase ${nx.n}).` : `Next: ${nx.hint}.`;
}

// ---- generations (tuning.generations): yearly heir handover and illness risk
export function handoverHeir(s) {
  const G = T.generations, hd = s.members.find(x => x.id === s.head && x.alive);
  if (!G || !hd || ageY(hd) < G.retireAge) return null;
  const h = living(s)
    .filter(x => (x.parents || []).includes(hd.id) && isAdult(x) && ageY(hd) - ageY(x) >= G.gap)
    .sort((a, b) => b.ageDays - a.ageDays)[0];
  if (!h) return null;
  hd.wasHead = true;
  s.head = h.id;
  if (s.activeId === hd.id) switchTo(s, h.id);
  log(s, `📜 ${hd.name} hands the family over: ${h.name} is now Head of Family.`);
  return h;
}

export function illnessRisk(s, m, care) {
  const R = T.generations.risk, a = ageY(m);
  const base = a < T.adultAge ? R.child : a < 30 ? R.young : R.mid * (1 + Math.max(0, a - 40) / 8);
  return base * Math.max(R.floor, 1 - (m.stats.VIT || 5) * R.vit - care * R.care);
}

export function generationsDay(s) {
  if (!T.generations || s.day % Y() !== 0) return;
  handoverHeir(s);
  const care = Math.max(0, ...living(s).map(x => Math.max(x.skills.healing?.lvl || 0, x.skills.herbalism?.lvl || 0)));
  for (const x of living(s)) if (rng() < illnessRisk(s, x, care)) kill(s, x, "died of illness");
}
