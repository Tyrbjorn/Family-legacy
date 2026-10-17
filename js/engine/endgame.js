// Late game (data/endgame.json): coin sinks (mounts, town patronage, stone quarries), era-scaled creatures and
// elites, raids from the Dynasty phase and defenses (walls, Watchtower, Village Palisade) (one-time purchases, no upkeep).
import { era } from "./family.js";
import { estateScore } from "./estate.js";
import { familyPower, wars } from "./war.js";
import { addRenown } from "./legacy.js";
import { registerDayHook } from "./time.js";
import { notify } from "./notify.js";
import { D, active, afford, known, log, pay, rng } from "./state.js";

const NONE = { tiers: [] };
const FALLBACK = { mounts: [], patronage: { list: [] }, quarries: [], creatures: { byPhase: [1], eliteChance: 0 }, raids: { phase: 99 }, defenses: { wall: NONE, tower: NONE, palisade: NONE } };
const EG = () => D.endgame || FALLBACK;
const at = (arr, i) => arr[Math.max(0, Math.min(arr.length - 1, i))];
const costText = c => Object.entries(c).map(([k, v]) => v + " " + k).join(", ");
const buyIssue = (s, c) => (c ? (afford(s, c) ? null : "needs " + costText(c)) : "max");
const owned = s => s.eg || (s.eg = { quarries: {}, defs: {}, funded: [], mount: 0 });

// ---- mounts: one stable tier, faster travel (map.newTrip reads mountSpeed)
export const mountTier = s => (s.eg && s.eg.mount) || 0;
export const mountSpeed = s => (mountTier(s) ? EG().mounts[mountTier(s) - 1].speed : 1);
export const mountIssue = s => buyIssue(s, (EG().mounts[mountTier(s)] || {}).cost);
export function buyMount(s) {
  if (mountIssue(s)) return false;
  const m = EG().mounts[mountTier(s)];
  pay(s, m.cost);
  owned(s).mount++;
  log(s, `${m.icon} The family now keeps a ${m.name}: travel ×${m.speed}.`);
  return true;
}

// ---- town patronage: fund a town building once for a permanent price perk there
export const patronDef = id => EG().patronage.list.find(p => p.id === id);
export const funded = (s, id) => !!(s.eg && s.eg.funded.includes(id));
export const patronOptions = (s, town) => EG().patronage.list.filter(p => !town || p.town === town);
export function patronIssue(s, id) {
  const p = patronDef(id);
  if (!p) return "missing";
  if (funded(s, id)) return "funded";
  if (era(s).n < p.phase) return "needs phase " + p.phase;
  return buyIssue(s, p.cost);
}
export function fundTown(s, id) {
  if (patronIssue(s, id)) return false;
  const p = patronDef(id);
  pay(s, p.cost);
  owned(s).funded.push(id);
  log(s, `${p.icon} You funded the ${p.name}: the town will remember the family.`);
  return true;
}
const perk = (s, town, k) => patronOptions(s, town).reduce((a, p) => a + (funded(s, p.id) ? p[k] || 0 : 0), 0);
export const patronSell = (s, town) => 1 + perk(s, town, "sell");
export const patronBuy = (s, town) => 1 - perk(s, town, "buy");

// ---- stone quarries at the Limestone and Granite nodes (node must be known)
export const quarryDef = id => EG().quarries.find(q => q.id === id);
export const quarryTier = (s, id) => (s.eg && s.eg.quarries[id]) || 0;
export function quarryIssue(s, id) {
  const q = quarryDef(id), n = q && D.nodes.find(x => x.id === q.node);
  if (!q || !n) return "missing";
  if (!known(s, n)) return "find the " + n.name + " first";
  return buyIssue(s, q.tiers[quarryTier(s, id)] && q.tiers[quarryTier(s, id)].cost);
}
export function buildQuarry(s, id) {
  if (quarryIssue(s, id)) return false;
  const q = quarryDef(id), t = quarryTier(s, id);
  pay(s, q.tiers[t].cost);
  owned(s).quarries[id] = t + 1;
  log(s, `${q.icon} ${q.name} ${t ? "upgraded to tier " + (t + 1) : "opened"}: ${q.tiers[t].rate} ${q.res}/day.`);
  return true;
}

// ---- defenses
export const defTier = (s, k) => (s.eg && s.eg.defs[k]) || 0;
export function defIssue(s, k) {
  const d = EG().defenses[k];
  if (!d) return "missing";
  if (d.village && !s.village) return "needs the village";
  return buyIssue(s, (d.tiers[defTier(s, k)] || {}).cost);
}
export function buildDefense(s, k) {
  if (defIssue(s, k)) return false;
  const d = EG().defenses[k], t = d.tiers[defTier(s, k)];
  pay(s, t.cost);
  owned(s).defs[k] = defTier(s, k) + 1;
  log(s, `${d.icon} Built the ${t.name}.`);
  return true;
}
const DEF_KEYS = ["wall", "tower", "palisade"];
const defTiers = s => DEF_KEYS.filter(k => defTier(s, k)).map(k => EG().defenses[k].tiers[defTier(s, k) - 1]);
export const hasWarning = s => defTiers(s).some(t => t.warn);
export const defensePower = s => defTiers(s).reduce((a, t) => a + t.power, 0);

// ---- creatures: repeat fights scale with the phase; elites roll on ~10% of them
export const creatureScale = s => at(EG().creatures.byPhase, era(s).n - 1);
export function threat(s, repeat) {
  if (!repeat) return { mult: 1, coin: 1, elite: false };
  const C = EG().creatures, elite = rng() < C.eliteChance, sc = creatureScale(s);
  return { mult: sc * (elite ? C.elitePower : 1), coin: sc * (elite ? C.eliteReward : 1), elite };
}

// ---- raids (Dynasty on): every 2-3 years, warned ahead by a Watchtower
const R = () => EG().raids;
export const raidPower = s => Math.round((R().base + (s.res.coin || 0) / R().perCoin + estateScore(s) * R().perScore) * (wars(s).length ? R().warMult : 1));
// the garrison (guards) already counts inside familyPower (war guardPower each)
export const raidDefense = s => Math.round(familyPower(s) + defensePower(s));
export function raid(s) {
  const our = raidDefense(s), foe = raidPower(s);
  const win = rng() < our / Math.max(1, our + foe);
  if (win) {
    const c = Math.round((s.res.coin || 0) * R().winCoin);
    const lead = active(s);
    if (lead) addRenown(s, lead, R().winRenown);
    log(s, `⚔️ Raiders struck the estate and were driven off (${our} vs ${foe})${c ? `: +${c} coin bounty` : ""}.`);
    s.res.coin += c;
  } else {
    const [lo, hi] = R().lossCoin, pct = lo + rng() * (hi - lo);
    const lost = Math.floor((s.res.coin || 0) * pct);
    s.res.coin -= lost;
    const vb = (s.structures || []).filter(st => st.site === "village");
    const pal = defTier(s, "palisade");
    let hit = "";
    if (vb.length && !pal) {
      const st = vb[Math.floor(rng() * vb.length)];
      st.raided = s.day + R().idleDays;
      hit = `, a village ${D.estate.structures.find(d => d.id === st.type).name} burned for a month`;
    } else
      for (const k of D.estate.caps.capped || []) if (s.res[k] > 0) s.res[k] = Math.floor(s.res[k] * (1 - R().lossStock));
    log(s, `🔥 Raiders broke through (${our} vs ${foe}): −${lost} coin${hit || ", stores plundered"}.`);
  }
  return win;
}
export function nextRaidDays() {
  const [a, b] = R().everyDays;
  return a + Math.floor(rng() * (b - a));
}

export function endgameDay(s) {
  if (!s.eg) return;
  const e = s.eg;
  for (const q of EG().quarries) {
    const t = quarryTier(s, q.id);
    if (t) s.res[q.res] = (s.res[q.res] || 0) + q.tiers[t - 1].rate;
  }
  if (era(s).n >= R().phase) {
    if (e.raidAt == null) e.raidAt = s.day + nextRaidDays();
    if (hasWarning(s) && e.raidAt - s.day === R().warnDays) notify(s, "houses", `🗼 The Watchtower spots raiders gathering: an attack in ~${R().warnDays} days.`);
    if (s.day >= e.raidAt) (raid(s), (e.raidAt = s.day + nextRaidDays()));
  }
}
export const endgameInit = s => owned(s);
registerDayHook("endgame", s => (owned(s), endgameDay(s)));
