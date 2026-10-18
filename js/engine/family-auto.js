// Family automation (Legacy upgrades fa_*; switches in s.autoOff as fam_<k>, on by default once owned).
// Never drives the active member. Excluded members (m.noAutoEq, the one "Automation" switch on the member sheet) are skipped.
// Hand-set choices are pinned (m.pins.order / .track / .court) until unpinned. Every automatic choice is logged (🤖).
//  orders: idle adults get the standing order that fits them (monthly)
//  advance: join the track/best-fit guild, rank up, evolve (one step per member per month), keeping a 25% coin reserve
//  kids: children train their track's skills instead of random lessons
//  court: unmarried adults 18-35 court the best suitor (no feuding house) and marry in; Head only if s.faCourtHead
import { legacyDef } from "./legacy.js";
import { cp } from "./family.js";
import { talentAuto } from "./talents.js";
import { AP, tutorPlace } from "./apprentice.js";
import { skillOpen } from "./skills.js";
import { autoQuest } from "./actions.js";
import { level, propose, proposeIssue } from "./family.js";
import { canEvolve, canRankUp, classGuild, cls, evolve, guildDef, joinGuild, joinIssues, nextRank, rankUp } from "./guilds.js";
import { bestRecipe } from "./inventory.js";
import { legacyTier } from "./legacy.js";
import { tierOf } from "./houses.js";
import { regionOpen } from "./map.js";
import { D, ageY, isAdult, living, log } from "./state.js";

export const FA_KEYS = ["orders", "advance", "kids", "court"];
export const FA = () => D.legacy.familyAuto;
export const faOwned = (s, k) => !!legacyDef("fa_" + k); // R37: the basic version is free
export const faTier = (s, k) => legacyTier(s, "fa_" + k);
export const faOn = (s, k) => faOwned(s, k) && !(s.autoOff || {})["fam_" + k];
const pins = m => m.pins || (m.pins = {});
export const pinned = (m, k) => !!(m.pins && m.pins[k]);
export function unpin(s, id, k) {
  const m = s.members.find(x => x.id === id);
  if (m && m.pins) delete m.pins[k];
  return !!m;
}
// automation may act on this member (never the active one, never excluded)
export const faFor = (s, m) => m.alive && m.id !== s.activeId && !m.noAutoEq;
const say = (s, t) => log(s, "🤖 " + t);
const reserveOk = (s, cost) => s.res.coin - cost >= s.res.coin * (faTier(s, "advance") >= 2 ? FA().reserveT2 ?? 0.1 : FA().reserve); // R37 tier 2: 10%
const lv = (m, k) => ((m.skills || {})[k] || { lvl: 0 }).lvl;

// ---- tracks (children and guild picks): a guild id; from the higher-level parent's guild/class, else best skills
export function trackFor(s, m) {
  if (m.track) return m.track;
  if (m.lean && m.lean[0] && FA().tracks[m.lean[0]]) return m.lean[0]; // R35: lean first (it already weighs the parents)
  const ps = (m.parents || []).map(id => s.members.find(x => x.id === id)).filter(Boolean).sort((a, b) => level(b) - level(a));
  for (const p of ps) {
    const g = (p.guild && p.guild.id) || (p.cls && (classGuild(p.cls) || {}).id) || (p.craft && p.craft.id);
    if (g && FA().tracks[g]) return g;
  }
  return bestTrack(m);
}
export const bestTrack = m => Object.entries(FA().tracks).map(([g, ks]) => [g, ks.reduce((a, k) => a + lv(m, k), 0)]).sort((a, b) => b[1] - a[1])[0][0];
export function setTrack(s, id, g) {
  const m = s.members.find(x => x.id === id);
  if (!m || (g && !FA().tracks[g])) return false;
  m.track = g || null;
  if (g) pins(m).track = true;
  else delete pins(m).track;
  return true;
}
// child lesson skill (time.js): the track's skills in turn while Upbringing is on, else null (random lessons)
export function kidSkill(s, m) {
  if (!faOn(s, "kids") || m.noAutoEq) return null;
  if (!m.track) {
    m.track = trackFor(s, m);
    say(s, `Auto Upbringing: ${m.name} follows the ${guildDef(m.track).name} track.`);
  }
  // R35 fix: guild-exclusive track skills are closed to kids (that XP was silently dropped); skip them
  const ks = FA().tracks[m.track].filter(k => skillOpen(m, k));
  return ks.length ? ks[(m.ageDays || 0) % ks.length] : null;
}

// ---- orders
function pickOrder(s, m) {
  const c = cls(m), artisan = (m.craft && !m.guild) || (c && !(c.cpSkills || []).length);
  if (artisan && bestRecipe(s, m)) return { type: "craft" };
  if (c && (c.cpSkills || []).length) {
    const best = D.regions
      .filter(r => regionOpen(s, r.id))
      .map(r => [r.id, autoQuest(s, m, r.id)])
      .filter(([r, q]) => q && q.region === r)
      .filter(([, q], i, all) => faTier(s, "orders") < 2 || q.cp <= cp(s, m) || !all.some(([, x]) => x.cp <= cp(s, m))) // R37 tier 2: where they'll succeed
      .sort((a, b) => b[1].cp - a[1].cp)[0];
    if (best) return { type: "quest", target: best[0] };
  }
  if (bestRecipe(s, m) && lv(m, "smithing") + lv(m, "carpentry") + lv(m, "tailoring") >= 15) return { type: "craft" };
  return { type: "work" };
}
const sameOrder = (a, b) => !!a && a.type === b.type && (a.target || null) === (b.target || null);
function ordersMonth(s) {
  for (const m of living(s).filter(m => isAdult(m) && faFor(s, m) && !pinned(m, "order") && !m.faCourt)) {
    const o = pickOrder(s, m);
    if (sameOrder(m.order, o)) continue;
    m.order = o;
    m.action = null;
    say(s, `Auto Orders: ${m.name} → ${o.type}${o.target ? " (" + o.target + ")" : ""}.`);
  }
}

// ---- advance
const evoScore = (m, c) => Object.keys(c.req || {}).reduce((a, k) => a + lv(m, k), 0) + (c.cpSkills || []).reduce((a, k) => a + lv(m, k), 0) + ((m.lean || []).includes((classGuild(c.id) || {}).id) ? 5 : 0); // R35 lean +5
function advanceOne(s, m) {
  if (faTier(s, "advance") >= 1) talentAuto(s, m); // R36 fill/swap talent slots unless pinned (R37: tier 1)
  // 1) no guild yet: the track guild if eligible, else the best-fitting one
  if (!m.guild && !m.craft) {
    const order = [trackFor(s, m), ...Object.keys(FA().tracks)];
    const g = order.find(g => guildDef(g) && !joinIssues(s, m, g).length && reserveOk(s, guildDef(g).req.coin || 0));
    if (g && joinGuild(s, m, g)) return say(s, `Auto Advance: ${m.name} joined the ${guildDef(g).name}.`), true;
  }
  // 2) rank up
  if (m.guild && canRankUp(s, m) && reserveOk(s, nextRank(m).cost)) {
    if (rankUp(s, m)) return say(s, `Auto Advance: ${m.name} ranked up.`), true;
  }
  // 3) evolve: preference, else the branch that fits their skills
  const opts = faTier(s, "advance") >= 1 ? D.classes.filter(c => !c.profession && canEvolve(s, m, c) && reserveOk(s, c.cost)) : []; // R37: evolving is tier 1
  if (!opts.length) return false;
  const c = opts.find(c => c.id === m.prefCls) || opts.sort((a, b) => evoScore(m, b) - evoScore(m, a))[0];
  if (evolve(s, m, c.id)) return say(s, `Auto Advance: ${m.name} became a ${c.name}${opts.length > 1 ? " (best fit of " + opts.map(x => x.name).join("/") + ")" : ""}.`), true;
  return false;
}
export function setPref(s, id, cid) {
  const m = s.members.find(x => x.id === id);
  if (!m) return false;
  m.prefCls = cid || null;
  return true;
}

// ---- courtship
const courtOk = (s, su) => !su.house || tierOf(s, su.house) !== "feud";
// R37 Matchmaker tiers: free = affinity; tier 1 + suitor trait quality; tier 2 + dowry and house standing
const RAR = { bad: -1, common: 0, good: 1, rare: 2, epic: 3 };
function suitorScore(s, su) {
  const t = faTier(s, "court");
  let v = su.affinity || 0;
  if (t >= 1) v += 10 * (su.traits || []).reduce((a, id) => a + (RAR[(D.traits.find(x => x.id === id) || {}).rarity] ?? 0), 0);
  if (t >= 2) v += ((su.dowry || {}).coin || 0) / 100 + (su.house ? 10 : 0);
  return v;
}
function courtWeek(s) {
  const [a0, a1] = FA().courtAge;
  const taken = new Set(living(s).filter(m => m.order && m.order.type === "court").map(m => m.order.target));
  for (const m of living(s)) {
    if (!m.faCourt) continue;
    const su = s.suitors.find(x => x.id === (m.order || {}).target);
    if (m.spouse || !su || !faFor(s, m) || !courtOk(s, su)) {
      m.faCourt = false;
      m.order = { type: "work" };
      m.action = null;
      continue;
    }
    if (su.affinity >= 100 && !proposeIssue(s, su.id, m) && reserveOk(s, 0)) {
      if (propose(s, su.id, m)) {
        m.faCourt = false;
        m.order = { type: "work" };
        m.action = null;
        say(s, `Auto Courtship: ${m.name} married ${m.spouse ? s.members.find(x => x.id === m.spouse).name : "their suitor"}.`);
      }
    }
  }
  const free = s.suitors.filter(su => !taken.has(su.id) && courtOk(s, su)).sort((a, b) => suitorScore(s, b) - suitorScore(s, a) || ((b.dowry || {}).coin || 0) - ((a.dowry || {}).coin || 0));
  for (const m of living(s).filter(m => isAdult(m) && faFor(s, m) && !m.spouse && !m.faCourt && !pinned(m, "order") && !pinned(m, "court") && ageY(m) >= a0 && ageY(m) <= a1 && (m.id !== s.head || s.faCourtHead))) {
    const su = free.shift();
    if (!su) break;
    m.order = { type: "court", target: su.id };
    m.action = null;
    m.faCourt = true;
    say(s, `Auto Courtship: ${m.name} is courting ${su.name}.`);
  }
}

export function familyAutoDay(s) {
  const F = FA();
  if (!F) return;
  if (faOn(s, "court") && s.day % F.courtEvery === 0) courtWeek(s);
  if (faOn(s, "orders") && faTier(s, "orders") >= 1 && s.day % (F.ordersEveryT1 || 7) === 0 && s.day % F.every !== 0) ordersMonth(s); // R37 tier 1: weekly
  if (s.day % F.every !== 0) return;
  if (faOn(s, "kids")) for (const m of living(s).filter(m => faFor(s, m) && ageY(m) >= AP().minAge && ageY(m) <= AP().maxAge)) faTier(s, "kids") >= 1 && tutorPlace(s, m); // R35 (R37: Family Tutor tier 1)
  if (faOn(s, "advance")) for (const m of living(s).filter(m => isAdult(m) && faFor(s, m))) advanceOne(s, m);
  if (faOn(s, "orders")) ordersMonth(s);
}
