// R48 Families of the realm (data/families.json): house perks at Friendly / Allied, temperament standing rules,
// family events the houses react to (houseEvent), the 3-quest house threads, and the player's own House Vael.
// houses.js keeps rapport tiers, gifts, troubles, feuds; this module only reads its state, so every rule here is data.
import { D, living, log, rng } from "./state.js";
import { houseList, houseDef, houseState, tierOf, addRapport, phaseOk } from "./houses.js";
import { memberGuild } from "./guilds.js";
import { addRenown } from "./legacy.js";
import { revealAt } from "./map.js";
import { townKnownId } from "./sea.js";

export const FAM = () => D.families || {};
export const playerHouse = () => FAM().player || { id: "vael", name: "House Vael" };
export const temperDef = id => (FAM().temperaments || {})[id] || {};
export const houseTemper = id => temperDef((houseDef(id) || {}).temperament);
export const majorHouses = () => houseList().filter(h => h.major);
export const minorHouses = () => houseList().filter(h => !h.major);

// ---- perks: major houses have a Friendly and an Allied perk (Allied keeps the Friendly one); minor houses one from Friendly
const RANK = { friendly: 1, allied: 2 };
export function activePerks(s, id) {
  const h = houseDef(id);
  if (!h || !s) return [];
  const st = houseState(s, id);
  if (st.state !== "peace") return [];
  const t = RANK[tierOf(s, id)] || 0,
    p = h.perks || {};
  return [...(t >= 1 ? p.friendly || [] : []), ...(t >= 2 ? p.allied || [] : [])].map(x => ({ ...x, house: id }));
}
export const allPerks = (s, type) => (s ? houseList().flatMap(h => activePerks(s, h.id)).filter(p => !type || p.type === type) : []);
const sumPct = (L, f) => L.filter(f).reduce((a, p) => a + (p.pct || 0), 0);
// −x on buying these market goods
export const perkBuy = (s, res) => 1 - sumPct(allPerks(s, "buy"), p => (p.res || []).includes(res));
// +x on selling in this town
export const perkSell = (s, town) => 1 + sumPct(allPerks(s, "sell"), p => p.town === town);
// −x on a town's shop items
export const perkShop = (s, town) => sumPct(allPerks(s, "shopDisc"), p => p.town === town);
// extra shop items while the perk holds
export const perkShopItems = (s, town) => [...new Set(allPerks(s, "shop").filter(p => p.town === town).flatMap(p => p.items || []))];
export const perkField = s => sumPct(allPerks(s, "fieldYield"), () => true);
export const perkNode = (s, nodeId) => sumPct(allPerks(s, "node"), p => p.node === nodeId);
export const perkRoutes = s => allPerks(s, "tradeRoute").reduce((a, p) => a + (p.n || 0), 0);
export const perkDiscover = (s, region) => sumPct(allPerks(s, "discover"), p => p.region === region);
export const perkTravel = (s, region) => allPerks(s, "travel").filter(p => p.region === region).reduce((a, p) => a * (p.mult || 1), 1);
export const perkFerry = s => sumPct(allPerks(s, "ferry"), () => true);
export const perkCargo = (s, tier) => allPerks(s, "cargo").filter(p => p.tier === tier).reduce((a, p) => a + (p.n || 0), 0);
export const perkXp = (s, skill) => sumPct(allPerks(s, "xp"), p => (p.skills || []).includes(skill));
export const perkRep = (s, guild) => sumPct(allPerks(s, "guildRep"), p => p.guild === guild);

// ---- temperament: scale a rapport change (houses.addRapport calls this with the change's kind)
export function temperScale(id, n, kind) {
  const t = houseTemper(id);
  if (!n || kind === "drift" || kind === "set") return n;
  if (n > 0) return n * (t.gain || 1);
  return n * (t.loss || 1) * (kind === "against" ? t.againstMult || 1 : 1);
}
export const giftScale = id => houseTemper(id).gift || 1;
// a proud house that is Allied stays loyal: drift never takes it below alliedFloor
export const driftFloor = (s, id) => {
  const f = houseTemper(id).alliedFloor;
  return f != null && tierOf(s, id) === "allied" ? f : null;
};

// ---- family events the houses react to (likes / dislikes by temperament). ctx.town: where it happened; ctx.against: the house hurt
export function houseEvent(s, on, ctx = {}) {
  if (!s || !D.families) return [];
  const out = [];
  for (const h of houseList()) {
    const t = temperDef(h.temperament);
    for (const r of [...(t.likes || []), ...(t.dislikes || [])]) {
      if (r.on !== on) continue;
      if (r.seat && ctx.town !== h.seat) continue;
      if (on === "againstAny" && ctx.against === h.id) continue; // the house hurt already lost standing
      addRapport(s, h.id, r.n, ctx.why || on, "event");
      out.push([h.id, r.n]);
    }
  }
  return out;
}
// quests that count as a family event (families.json events lists)
export function questEvents(s, q) {
  const ev = FAM().events || {};
  for (const [on, ids] of Object.entries(ev)) if (Array.isArray(ids) && ids.includes(q.id)) houseEvent(s, on, { why: q.name });
  if (q.against) houseEvent(s, "againstAny", { against: q.against, why: q.name });
}

// ---- monthly temperament checks (called from housesDay on the 30-day tick, before drift)
export function temperMonth(s, h) {
  const t = temperDef(h.temperament);
  for (const r of t.monthly || []) {
    const n = living(s).filter(m => r.guild && memberGuild(m, r.guild)).length;
    if (n) addRapport(s, h.id, r.n * Math.min(2, n), r.n > 0 ? `${(D.guilds.guilds.find(g => g.id === r.guild) || {}).name || r.guild} members` : `dislikes your ${(D.guilds.guilds.find(g => g.id === r.guild) || {}).name || r.guild} members`, "event");
  }
  if (t.betray && ["cold", "rival", "feud"].includes(tierOf(s, h.id)) && phaseOk(s, "troubles") && rng() < t.betray.chance) {
    const n = Math.min(t.betray.coinMax, Math.floor((s.res.coin || 0) * t.betray.coinPct));
    s.res.coin -= n;
    log(s, t.betray.msg.replace("{house}", h.name).replace("{n}", n));
    return n;
  }
  return 0;
}

// ---- house threads: 3 quests in order (steps 2-3 reveal as the previous one is done); the last pays a bonus
export const threadOf = id => (houseDef(id) || {}).thread || null;
export const threadQuests = id => ((threadOf(id) || {}).quests || []).map(q => D.quests.find(x => x.id === q)).filter(Boolean);
export const threadStep = (s, id) => threadQuests(id).filter(q => (s.doneQuests || []).includes(q.id)).length;
export const threadDone = (s, id) => threadQuests(id).length > 0 && threadStep(s, id) >= threadQuests(id).length;
export function threadQuestDone(s, q, m) {
  const h = houseList().find(x => (x.thread || {}).quests && x.thread.quests.includes(q.id));
  if (!h || !threadDone(s, h.id) || (s.threads || []).includes(h.id)) return null;
  (s.threads = s.threads || []).push(h.id);
  const td = FAM().threadDone || {};
  addRapport(s, h.id, td.rapport || 0, `finished “${h.thread.name}”`, "quest");
  if (m && td.renown) addRenown(s, m, td.renown);
  log(s, `📜 ${h.icon} ${h.name}'s thread “${h.thread.name}” is complete (+${td.rapport || 0} standing).`);
  return h.id;
}
// a house quest that pleases one house angers its sworn rival (Sallow ⇄ Corran): half the gain, as a loss
export function rivalSting(s, id, n) {
  const r = (houseDef(id) || {}).rival;
  if (r && n > 0 && houseDef(r)) addRapport(s, r, -Math.round(n / 2), `you helped ${houseDef(id).name}`, "against");
}
// marriage: true (from Neutral as before) or "allied" (only once Allied, e.g. Clan Brokka)
export const offersMarriage = (s, id) => {
  const mm = (houseDef(id) || {}).marriage;
  return mm === false ? false : mm === "allied" ? tierOf(s, id) === "allied" : true;
};
// a thread opens (its first quest is revealed) on a monthly tick once you know the seat town and they're Neutral or better
export function threadOpenCheck(s, h) {
  const q = threadQuests(h.id)[0];
  if (!q || !q.threadOpen || (s.revealed || []).includes(q.id)) return false;
  if (!townKnownId(s, h.seat) || ["cold", "rival", "feud"].includes(tierOf(s, h.id)) || !phaseOk(s, "houseQuests")) return false;
  s.revealed.push(q.id);
  revealAt(s, q.id);
  log(s, `📜 ${h.icon} ${h.name} has a task for your family: “${q.name}” (thread “${h.thread.name}”, 1 of ${threadQuests(h.id).length}).`);
  return true;
}
