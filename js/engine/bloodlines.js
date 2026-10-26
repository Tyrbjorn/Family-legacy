// R81 bloodlines (fl-bloodlines-proposal.md + Jeremy's final answers). Imports state.js only.
// A person's heritage, per mixed-in race (data/creation.json `heritage.races`; dwarf only for now, elf / Sea-touched can be
// added as data later): "pure" (member.race), "half" (1st generation, the old Dwarf-blood trait), "blooded" (permanent, never half
// again) or "none". A person can hold several tags (a half-dwarf x half-elf child carries both blooded tags).
// Birth: ONE rng draw per birth, only when a parent carries a non-human heritage (human-only seeds replay byte-identical).
import { D, T, log, rng as RNG } from "./state.js";

const HER = () => (D.creation || {}).heritage || { races: {}, rules: {} };
const RACES = () => Object.keys(HER().races || {});
export const heritageRace = rid => (HER().races || {})[rid] || null;
const tdef = id => (D.traits || []).find(t => t.id === id) || {};
// trait ids that are blood tags (trait defs carry blood:{race,kind})
export const isBloodTag = id => !!tdef(id).blood;
const has = (m, id) => !!m && (m.traits || []).includes(id);

// kind of one race in one person: pure > half > blooded > none
export function bloodKind(m, rid) {
  const c = heritageRace(rid);
  if (!m || !c) return "none";
  if (m.race === rid) return "pure";
  if (has(m, c.half)) return "half";
  if (has(m, c.blooded)) return "blooded";
  return "none";
}
export const heritageOf = m => Object.fromEntries(RACES().map(r => [r, bloodKind(m, r)]).filter(([, k]) => k !== "none"));
export const hasBlood = m => RACES().some(r => bloodKind(m, r) !== "none");
export const heritageLabel = (rid, kind) => kindLabel(rid, kind);
const kindLabel = (rid, kind) => {
  const c = heritageRace(rid) || {};
  return kind === "pure" ? c.Name || rid : (tdef(kind === "half" ? c.half : c.blooded) || {}).name || rid;
};
// "Half-dwarf", "Dwarf-blooded", "Dwarf" (several joined with " · ")
export const heritageLabels = m => Object.entries(heritageOf(m)).map(([r, k]) => kindLabel(r, k));
const KORD = ["pure", "half", "blooded", "none"];
const rule = (rid, a, b) => (HER().rules || {})[[a, b].sort((x, y) => KORD.indexOf(x) - KORD.indexOf(y)).join("+")];
// every race either parent carries, with the result rule (string = fixed, object = odds)
export function bloodPlan(a, b) {
  return RACES()
    .map(rid => {
      const ka = bloodKind(a, rid), kb = bloodKind(b, rid);
      if (ka === "none" && kb === "none") return null;
      const r = rule(rid, ka, kb);
      return { race: rid, ka, kb, rule: r === undefined ? "none" : r, tag: HER().pureTag !== false && [ka, kb].some(k => k === "half" || k === "blooded") };
    })
    .filter(Boolean);
}
const pick = (dist, u) => {
  let c = 0, last = null;
  for (const [k, p] of Object.entries(dist)) if (((c += p), (last = k), u < c)) return k;
  return last;
};
const addTrait = (child, id) => {
  if (!id || has(child, id)) return false;
  (child.traits ||= []).push(id);
  child.lifespan = (child.lifespan || T.baseLifespan) + (tdef(id).life || 0);
  return true;
};
// one birth. Returns the list of {race, kind, tag} it applied (empty = a human-only birth, NO rng draw).
export function bloodTrait(s, child, parents, roll = RNG) {
  const ps = parents.filter(Boolean);
  const pl = bloodPlan(ps[0], ps[1] || null);
  if (!pl.length) return [];
  let u = roll(), first = true;
  const out = [];
  for (const p of pl) {
    const c = heritageRace(p.race);
    let kind = p.rule;
    if (kind && typeof kind === "object") {
      if (!first) u = roll();
      kind = pick(kind, u);
    }
    first = false;
    if (kind === "none" || !kind) continue;
    if (kind === "pure") {
      child.race = p.race;
      child.lifespan = (child.lifespan || T.baseLifespan) + ((c.lifespan || 110) - T.baseLifespan);
      // the lineage tag (a parent was half / blooded): bookkeeping only, no bonus, no extra years
      if (p.tag && c.blooded && !has(child, c.blooded)) (child.traits ||= []).push(c.blooded);
      out.push({ race: p.race, kind, tag: !!p.tag });
    } else {
      addTrait(child, kind === "half" ? c.half : c.blooded);
      out.push({ race: p.race, kind, tag: false });
    }
  }
  for (const o of out) log(s, bloodLog(child, o));
  return out;
}
// placeholder birth lines
export function bloodLog(child, o) {
  const c = heritageRace(o.race) || {};
  const ic = c.icon || "🩸";
  if (o.kind === "pure") return `${ic} ${child.name} is born a full ${c.name || o.race}${o.tag ? ", though the blood ran thin in the line" : ""}: long-lived, strong, and at home in mine and forge.`;
  if (o.kind === "half") return `${ic} ${child.name} is born ${kindLabel(o.race, "half")}: long-lived, strong, and at home in mine and forge.`;
  return `${ic} ${child.name} is born ${kindLabel(o.race, "blooded")}: a lasting trace of ${c.name || o.race} blood.`;
}
// the odds for a marriage preview: [{race, outcomes:[{kind, label, p}], tag}]
export function bloodOdds(a, b) {
  return bloodPlan(a, b).map(p => {
    const r = p.rule, d = r && typeof r === "object" ? r : { [r || "none"]: 1 };
    return { race: p.race, tag: p.tag, outcomes: Object.entries(d).map(([kind, pr]) => ({ kind, label: kind === "none" ? "Human" : kindLabel(p.race, kind), p: pr })) };
  });
}
// suitor of a race's house counts as pure for the preview (their race is set only at the wedding)
const asSuitor = x => {
  if (!x) return x;
  for (const rid of RACES()) if (heritageRace(rid).house && x.house === heritageRace(rid).house && x.race !== rid) return { ...x, race: rid };
  return x;
};
// marriage preview line {text, tip} or null (no non-human blood on either side). Words in the line, numbers only in the tip.
export function bloodPreview(m, su) {
  const odds = bloodOdds(m, asSuitor(su));
  if (!odds.length) return null;
  const words = [], tips = [];
  for (const o of odds) {
    const ls = o.outcomes.map(x => x.label);
    words.push(ls.length === 1 ? `will be ${ls[0]}` : `may be ${ls.join(" or ")}`);
    tips.push(o.outcomes.map(x => `${x.label} ${Math.round(x.p * 100)}%`).join(" · "));
  }
  return { text: `Heirs ${words.join("; ")}`, tip: tips.join(" | ") + (odds.some(o => o.tag && o.outcomes.some(x => x.kind === "pure" && x.p > 0)) ? " · a Dwarf child of a half or blooded parent carries a lineage mark (no bonus)" : "") };
}
// save migration (R81): idempotent via the per-member marker bloodV. Old saves gave every Dwarf-blood child of a half parent the
// half trait; under the new rules only the 1st generation is half. A member with no marker keeps `dwarfblood` (half) when they are a
// founder / have an unknown or pure-dwarf parent; otherwise it becomes `dwarfblooded` (trait swap only; lifespan is kept as it was, R82).
export function migrateBloodlines(s) {
  const by = new Map((s.members || []).map(m => [m.id, m]));
  for (const m of s.members || []) {
    if (m.bloodV) continue;
    m.bloodV = 1;
    for (const rid of RACES()) {
      const c = heritageRace(rid);
      if (!has(m, c.half) || m.race === rid) continue;
      const ps = (m.parents || []).map(id => by.get(id)).filter(Boolean);
      if (!(m.parents || []).length || !ps.length || ps.some(p => p.race === rid)) continue;
      m.traits = m.traits.map(t => (t === c.half ? c.blooded : t));
      // R82: lifespan is deliberately NOT touched: a converted member keeps the years they already had (frailty / death unchanged).
    }
  }
}
