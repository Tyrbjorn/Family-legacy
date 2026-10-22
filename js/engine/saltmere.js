// R49 the Saltmere Coast: Merrow's chart, quest skill checks (“Sailing or Scouting”), quest choices (the reef chain's
// ending), boons (lasting perks a choice grants), the “What the Reef Keeps” chain progress, the Lodge procession and
// kelp fertiliser. Everything is data: quests.json `check` / `choice` / `chain`, requests.json extra `chart`,
// events.json `closed` / `coastFish` / `oddCatch`, fields.json `fertiliser`, families.json `marriageTrait`.
import { dwarfBlood } from "./dwarves.js";
import { dagonPact } from "./dagon.js";
import { seaBirth, makeSea } from "./seablood.js";
import { D, log, rng, living } from "./state.js";
import { findId } from "./lookup.js";
import { addRapport, houseDef, houseState } from "./houses.js";
import { guildsOf } from "./guilds.js";
import { addRenown } from "./legacy.js";
import { revealAt } from "./map.js";
import { chron } from "./chronicle.js";

// ---- Merrow's chart: the Saltmere Coast is found (region + its town marked on your map)
export function readChart(s, e) {
  if (!e || e.type !== "chart") return false;
  if (!(s.charts ||= []).includes(e.region)) s.charts.push(e.region);
  const rg = findId(D.regions, e.region);
  if (!rg) return false;
  if (!(s.discovered ||= []).includes(e.region)) s.discovered.push(e.region);
  if (e.town && !s.discovered.includes(e.town)) s.discovered.push(e.town), revealAt(s, e.town, 120);
  log(s, `🗺️ ${rg.name} is on your map now${e.town ? ": " + ((findId(D.towns, e.town) || {}).name || e.town) + " is marked" : ""}.`);
  return true;
}

// ---- skill checks: best of the listed skills against `lvl` (±3% a level, −30%..+20%) on top of the power roll
export const checkSkill = (m, q) => (q.check ? [...q.check.skills].sort((a, b) => ((m.skills[b] || {}).lvl || 0) - ((m.skills[a] || {}).lvl || 0))[0] : q.skill);
export function checkBonus(m, q) {
  if (!q || !q.check || !m) return 0;
  const lv = (m.skills[checkSkill(m, q)] || { lvl: 0 }).lvl;
  return Math.max(-0.3, Math.min(0.2, (lv - q.check.lvl) * 0.03));
}
export const checkText = (m, q) => (q.check ? q.check.skills.map(k => (findId(D.skills, k) || { name: k }).name).join(" or ") + " " + q.check.lvl + (m ? ` (best ${(m.skills[checkSkill(m, q)] || { lvl: 0 }).lvl})` : "") : "");

// ---- chains (quests.json `chain`, `step`): progress for the UI and the house cards
export const questChain = id => D.quests.filter(q => q.chain === id).sort((a, b) => a.step - b.step);
export const questChainStep = (s, id) => questChain(id).filter(q => s.doneQuests.includes(q.id)).length;
export const questChainName = id => (questChain(id)[0] || {}).chainName || id;

// ---- choices: a quest with `choice` asks once on its first clear; the ask waits (never blocks play)
export const choiceOf = qid => (findId(D.quests, qid) || {}).choice || null;
export const pendingChoices = s => (s.choices || []).filter(c => !c.pick);
export const choiceMade = (s, id) => ((s.choices || []).find(c => c.id === id && c.pick) || {}).pick || null;
export function askChoice(s, q) {
  if (!q.choice || (s.choices || []).some(c => c.id === q.choice.id)) return false;
  (s.choices ||= []).push({ id: q.choice.id, q: q.id, day: s.day });
  log(s, `❓ ${q.choice.title}: a choice waits for you (Quests tab).`);
  return true;
}
export function choiceIssue(s, id, opt) {
  const c = (s.choices || []).find(x => x.id === id);
  if (!c) return "nothing to choose";
  if (c.pick) return "already chosen";
  const ch = choiceOf(c.q);
  if (!ch || !ch.options.some(o => o.id === opt)) return "no such option";
  return null;
}
export function makeChoice(s, id, opt) {
  if (choiceIssue(s, id, opt)) return null;
  const c = s.choices.find(x => x.id === id), ch = choiceOf(c.q), o = ch.options.find(x => x.id === opt), fx = o.fx || {};
  c.pick = opt;
  c.at = s.day;
  for (const [h, n] of Object.entries(fx.rapport || {})) if (houseDef(h)) addRapport(s, h, n, o.name, "quest");
  if (fx.boon) (s.boons ||= []).push({ ...fx.boon, from: ch.id });
  for (const [g, n] of Object.entries(fx.guildRep || {})) {
    const ms = living(s).flatMap(m => guildsOf(m).filter(mg => mg.id === g));
    for (const mg of ms) mg.rep += n;
    if (!ms.length) (s.guildFavour ||= {})[g] = (s.guildFavour[g] || 0) + n; // no member yet: the first to join gets it
  }
  if (fx.cold && houseDef(fx.cold)) {
    const hs = houseState(s, fx.cold), cold = (D.families.status.find(t => t.id === "cold") || { max: -15 }).max;
    if (hs.r > cold - 10) addRapport(s, fx.cold, cold - 10 - hs.r, o.name, "set");
  }
  if (fx.renown) addRenown(s, living(s)[0], fx.renown);
  if (fx.coin) s.res.coin = (s.res.coin || 0) + fx.coin; // R51
  if (fx.flag) (s.flags ||= {})[fx.flag] = s.day || 0;
  if (fx.pact) dagonPact(s, fx.pact, (h, r) => houseDef(h) && (addRapport(s, h, r - houseState(s, h).r, o.name, "set"), (houseState(s, h).r = r), r <= -75 && (houseState(s, h).state = "feud"))); // R53 the Old Bargain // R51 remembered for later rounds (Clan Ironbrow)
  const msg = `${o.icon || "❓"} ${ch.title}: you chose to ${o.name.toLowerCase()}. ${o.text}`;
  log(s, msg);
  chron(s, "deed", msg);
  return o;
}
// lasting perks from choices (same shape as house perks)
export const boons = (s, type) => ((s && s.boons) || []).filter(b => !type || b.type === type);

// ---- kelp fertiliser (fields.json fertiliser): Fields' Auto spreads it (all fields or none); it lasts to the season's end
const FZ = () => (D.fields || {}).fertiliser || null;
export const fertBonus = s => (FZ() && s.fert && s.fert.until > s.day ? FZ().bonus : 0);
export function fertSeason(s, fields, seasonDays) {
  const F = FZ();
  if (!F || !fields || s.fieldsAuto === false || fertBonus(s)) return false;
  const need = fields * F.perField;
  if (!need || (s.res[F.res] || 0) < need) return false;
  s.res[F.res] -= need;
  s.fert = { until: s.day + seasonDays, n: fields };
  log(s, `🌿 Fields' Auto spread ${need} kelp fertiliser: +${Math.round(F.bonus * 100)}% field yield this season.`);
  return true;
}

// ---- House Gilmane blood: children may carry the house trait (families.json marriageTrait)
export function houseBirthTrait(s, child, parents) {
  if (dwarfBlood(s, child, parents, rng)) log(s, `⛏️ ${child.name} is born with Dwarf-blood: long-lived, strong, and at home in mine and forge.`); // R56
  if (seaBirth(s, child, parents)) return log(s, `🌊 ${child.name} is born Sea-touched: the sea is in their eyes.`), "seatouched"; // R57
  for (const p of parents) {
    const h = p && p.house && houseDef(p.house), mt = h && h.marriageTrait;
    if (mt && !(child.traits || []).includes(mt.id) && rng() < mt.chance) {
      if (mt.id === "seatouched") { if (!makeSea(child)) continue; } else (child.traits ||= []).push(mt.id); // R57 Sea-touched: +10 years
      log(s, `🌊 ${child.name} has ${houseDef(p.house).name}'s look about them: ${(findId(D.traits, mt.id) || { name: mt.id }).name}.`);
      return mt.id;
    }
  }
  return null;
}
