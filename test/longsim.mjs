const NO_TIERS = !!process.env.NO_TIERS; // R46: disable the bot's tier logic
// Long headless simulation (balance/bug pass): a greedy bot plays several lineages and checks invariants.
// usage: node test/longsim.mjs [seeds=3] [years=200]
import fs from "fs";
import * as E from "../js/engine.js";
if (process.env.R60OFF) globalThis.R60OFF = 1; // R60: switch off branch races, locks and gates to compare with R59
const root = new URL("..", import.meta.url).pathname;
const D = {};
for (const f of fs.readdirSync(root + "data").filter(f => f.endsWith(".json")))
  D[f.replace(".json", "")] = JSON.parse(fs.readFileSync(root + "data/" + f));
for (const f of D.estate.structureFiles) D["structures/" + f] = JSON.parse(fs.readFileSync(root + "data/structures/" + f + ".json"));
// experiment knobs (sim only): LG_TITHE=0.2 base tithe; LG_TIERS="cost:value,..." tithe upgrade tiers; LG_DEED=1 banks each first dungeon clear's renown again as Legacy
if (process.env.LG_TITHE) D.legacy.renown.tithe = +process.env.LG_TITHE;
if (process.env.TIER_TUNE) { const [l2, l3, k2, k3] = process.env.TIER_TUNE.split(",").map(Number); Object.assign(D.guilds.tiers[1], { lv: l2, skillScale: k2 }); Object.assign(D.guilds.tiers[2], { lv: l3, skillScale: k3 }); } // R46 sim knob
if (process.env.LG_TIERS) D.legacy.upgrades.find(u => u.id === "tithe").tiers = process.env.LG_TIERS.split(",").map(x => ({ cost: +x.split(":")[0], value: +x.split(":")[1] }));
// LG_LAND=1 adds four late parcels (sim-only draft of the "more land" proposal)
if (process.env.LG_LAND) D.estate.lands.push(
  { id: "northfield", name: "Northfield", icon: "🌾", slots: 4, cost: { coin: 40000, blocks: 200 }, requires: "valley", towns: ["millbrook"], features: ["topsoil", "pasture", "stream"] },
  { id: "lakeshore", name: "Lakeshore", icon: "🏞️", slots: 4, cost: { coin: 80000, blocks: 300, planks: 200 }, requires: "northfield", towns: ["millbrook"], features: ["stream", "clay_bank", "woods"] },
  { id: "deepvein", name: "Deepvein Claim", icon: "⛏️", slots: 4, cost: { coin: 120000, blocks: 400 }, requires: "highclaim", region: "highlands", towns: ["millbrook"], features: ["ore_vein", "coal_seam", "gem_vein", "silver_vein"] },
  { id: "demesne", name: "Old Demesne", icon: "🏰", slots: 6, cost: { coin: 200000, blocks: 600, ingots: 100 }, requires: "lakeshore", towns: ["millbrook"], features: ["topsoil", "woods", "stone_outcrop"] },
);
const LG_DEED = +(process.env.LG_DEED || 0), deedSeen = new WeakMap();
// generation knobs (sim only): LIFE base lifespan, CHILD days between births, KIDS per couple (handover, illness and wages now live in the engine)
if (process.env.LIFE) D.tuning.baseLifespan = +process.env.LIFE;
if (process.env.CHILD) D.tuning.childEvery = +process.env.CHILD;
if (process.env.KIDS) D.tuning.maxKidsPerCouple = +process.env.KIDS;
// NO_MKT=1 (sim only): drop the R39 shortage/glut events for A/B
if (process.env.NO_MKT) D.events.types = D.events.types.filter(t => !t.pick);
if (process.env.SH_MULT) D.events.types.filter(t => t.pick).forEach(t => (t.effects.resPrice = t.id === "shortage" ? +process.env.SH_MULT : t.effects.resPrice));
if (process.env.QCD_OFF) D.tuning.questCooldown = {}; // R86 sim knob: quest cooldowns off (pre-R86 spread)
E.setData(D);
if (process.env.NO_CHORES && D.estate.chores) D.estate.chores.autoRate = 0; // R42 isolate chores
const SEEDS = +(process.argv[2] || 3),
  YEARS = +(process.argv[3] || 200);
const T = D.tuning,
  YD = T.daysPerYear;
const issues = [];
let lastS = null;
const mapTick = new WeakMap();
const findQ = id => D.quests.find(q => q.id === id);
const seen = {
  enchants: 0,
  pathOpens: 0,
  specs: 0,
  combos: 0,
  picks: 0,
  evolves: 0,
  setWorn: 0,
  setCrafts: 0,
  animals: 0,
  noderuns: 0,
  parcels: 0,
  haulCrafts: 0,
  convoyTrips: 0,
  herdDays: 0,
  maxCarry: 0,
  quests: new Set(),
  structs: new Set(),
  pieces: new Set(),
  classes: new Set(),
  ach: new Set(),
  legacy: new Set(),
  guilds: new Set(),
  enc: 0,
  events: new Set(),
  recipes: new Set(),
  houseQuests: new Set(),
  wars: 0,
};
const bad = (seed, day, msg) => {
  if (issues.filter(i => i.msg === msg).length < 3) issues.push({ seed, day, msg });
};
const PIECES = [
  "bunk",
  "stablestall",
  "larder",
  "cradle",
  "storage",
  "workbench",
  "sawtable",
  "forge",
  "herbrack",
  "minionbunk",
  "studydesk",
  "shrine",
  "loom",
  "toolrack",
  "oven",
  "smoker",
  "pells",
  "masontable",
  "tanrack",
  "hourglass",
  "hearth",
  "quern",
  "churn",
  "jars",
];
// keep the last free land slot(s) for a bunkhouse until one stands, so followers always get beds
const holdForBunks = (s, t) =>
  !["shack", "bunkhouse"].includes(t) && !s.structures.some(x => x.type === "bunkhouse") && E.landSlots(s) - E.landUsed(s) <= (D.estate.structures.find(x => x.id === "bunkhouse").land || 1);
// bunkhouse right after the first home, so followers have beds before production fills the land
const STRUCTS = [
  "shack",
  "bunkhouse",
  "cabin",
  "house",
  "hall",
  "sawmill",
  "masonyard",
  "quarry",
  "herbgarden",
  "fields",
  "chickencoop",
  "warehouse",
  "kitchen",
  "cowpen",
  "gristmill",
  "fishinghut",
  "hunterscabin",
  "smithy",
  "graveyard",
  "mineshaft",
  "ancestorhall",
  "orchard",
  "smokehouse",
  "brewery",
  "preservery",
  "shrinehouse",
  "barracks",
];

// manual equipping, same for both builds: per adult, per slot, the vault piece worth the most to that member
// (E.itemCpFor when the build has class fit/proficiency, else raw cp); skips members Auto Equip already handles
function botEquip(s) {
  if (E.autoEqOn && E.autoEqOn(s, "gear")) return;
  const val = (m, id) => (id ? (E.itemCpFor ? E.itemCpFor(m, id) : (E.itemDef(id) || {}).cp || 0) : 0);
  for (const m of s.members.filter(m => m.alive && E.isAdult(m)))
    for (const slot of ["weapon", "armor", "offhand"]) {
      let b = null, bv = val(m, m.equip[slot]) + 0.5;
      for (const id of s.vault) {
        const it = E.itemDef(id);
        if (!it || it.slot !== slot) continue;
        let v = val(m, id);
        if (E.clash && slot === "weapon" && m.equip.offhand && E.clash(id, m.equip.offhand)) v -= val(m, m.equip.offhand);
        if (E.clash && slot === "offhand" && m.equip.weapon && E.clash(m.equip.weapon, id)) continue;
        if (v > bv) (b = id), (bv = v);
      }
      if (!b) continue;
      const n = m.bag.length;
      if (E.equip(s, m, b)) while (m.bag.length > n) s.vault.push(m.bag.pop());
    }
}
function check(s, seed) {
  for (const [k, v] of Object.entries(s.res)) {
    if (typeof v !== "number" || !isFinite(v)) bad(seed, s.day, `res.${k} is ${v}`);
    else if (v < -1e-9) bad(seed, s.day, `res.${k} negative (${v.toFixed(2)})`);
  }
  for (const m of s.members) {
    for (const [k, v] of Object.entries(m.stats || {}))
      if (!isFinite(v)) bad(seed, s.day, `stat ${k} NaN on ${m.name}`);
    for (const [k, v] of Object.entries(m.skills || {}))
      if (!isFinite(v.xp) || !isFinite(v.lvl)) bad(seed, s.day, `skill ${k} NaN`);
    if (!isFinite(m.renown)) bad(seed, s.day, "member renown NaN");
  }
  for (const mi of s.minions || []) if (!isFinite(mi.xp || 0) || !isFinite(mi.loyalty)) bad(seed, s.day, "minion NaN");
  if (!isFinite(s.renown)) bad(seed, s.day, "renown NaN");
  if (!isFinite(s.morale || 0)) bad(seed, s.day, "morale NaN");
  for (const [id, h] of Object.entries(s.houses || {})) {
    if (!isFinite(h.r) || h.r < -100 || h.r > 100) bad(seed, s.day, `house ${id} rapport ${h.r}`);
    if (!["peace", "feud", "war"].includes(h.state)) bad(seed, s.day, `house ${id} state ${h.state}`);
    if (h.state === "war" && s.day - h.warStart > D.families.war.maxDays + 1) bad(seed, s.day, `war with ${id} never ends`);
  }
  for (const su of s.suitors) if (!su.dowry || !isFinite(su.dowry.coin)) bad(seed, s.day, "suitor dowry broken");
  for (const [k, q] of Object.entries(s.foodQ || {})) if (!isFinite(q) || q <= 0 || q > 2.6) bad(seed, s.day, `foodQ.${k}=${q}`);
  if (!isFinite(s.turbo.charge) || s.turbo.charge < 0) bad(seed, s.day, "turbo charge broken");
  for (const t of E.timers(s))
    if (!isFinite(t.p) || (t.left != null && !isFinite(t.left))) bad(seed, s.day, `timer ${t.key} NaN`);
  if ((s.chronicle || []).length > 300) bad(seed, s.day, "chronicle over cap");
  if ((s.notes || []).length > (D.notify.cap || 40)) bad(seed, s.day, "notes over cap");
}

// a sensible adventurer: first clears of known dungeons once power covers the last floor (×1.1 for the dragon),
// a repeat clear of the best dungeon about once a year for loot, and one-time/story quests (renown) before grinding;
// deadly quests only with a 25% power margin
const lastDg = new WeakMap();
function smartAdventure(s, m) {
  if (E.daysOfStock(s) < 10 || m.injured) return false;
  const c = E.cp(s, m), ok = d => !E.dungeonIssue(s, m, d);
  const fresh = (D.dungeons || []).filter(d => ok(d) && !(s.cleared || []).includes(d.id) && d.floors.at(-1).cp * (d.dragon ? 1.1 : 1) <= c);
  const best = (D.dungeons || []).filter(d => ok(d) && (s.cleared || []).includes(d.id) && d.floors.at(-1).cp <= c).sort((a, b) => b.floors.at(-1).cp - a.floors.at(-1).cp)[0];
  const dg = fresh.sort((a, b) => a.floors.at(-1).cp - b.floors.at(-1).cp)[0] || (best && s.day - (lastDg.get(s) ?? -1e9) > YD ? best : null);
  if (dg) {
    lastDg.set(s, s.day);
    E.setAction(s, { type: "dungeon", target: dg.id });
    (s._drag = s._drag || []).push(dg.id.slice(2, 6) + ":" + Math.round(c) + "/" + (m.cls || "-") + "@" + Math.round(s.day / 36) / 10);
    return true;
  }
  const q = D.quests
    .filter(q => (q.once || q.story) && (!q.house || (q.thread && !q.against)) && !q.needsFeud && E.actionAllowed(s, m, { type: "quest", target: q.id }) && q.cp * (q.risk === "deadly" ? 1.25 : 1) <= c)
    .sort((a, b) => (a.story || 99) - (b.story || 99) || a.cp - b.cp)[0];
  if (q) {
    E.setAction(s, { type: "quest", target: q.id });
    return true;
  }
  // R46: own guild's chain quest first (same rule as Auto-Adventure)
  if (!NO_TIERS) { const gq = E.guildQuestFor(s, m, q => E.actionAllowed(s, m, { type: "quest", target: q.id }) && !E.questIssue(s, m, q) && q.risk !== "deadly" && q.cp <= c); if (gq) { E.setAction(s, { type: "quest", target: gq.id }); return true; } }
  // R45: quest lines (start any open one, follow it) and town board jobs from your band (planner orders missing goods)
  if (E.lineDefs && !process.env.NO_BOARDS) {
    for (const L of E.lineDefs()) { const st = E.lineState(s, L.id); if ((!st || (!st.done && st.who === m.id)) && !E.stopIssue(s, m, L.id) && E.goStop(s, m, L.id)) return true; }
    const c = E.cp(s, m), qb = D.quests.filter(q => !q.story && !q.once && !E.questIssue(s, m, q) && q.risk !== "deadly" && q.cp <= c).sort((a, b) => b.cp - a.cp)[0];
    const bar = qb ? ((qb.reward || {}).coin || 0) / Math.max(1, 2 * E.travelDays(qb.id) + qb.days) : 0;
    if (E.boardsPick(s, m, bar)) return true; // same rule as Auto-Adventure
  }
  return false;
}

// R48: top a resource up to n from any known town that sells it
function buyAny(s, k, n) {
  const need = n - Math.floor(s.res[k] || 0);
  if (need <= 0) return true;
  for (const tw of D.towns) if (E.townKnown(s, tw) && (tw.market || []).includes(k) && E.buyRes(s, tw.id, k, need)) return true;
  // R49: a town brewery's small monthly stock (ale at Gull's Landing, Saltmere, Millbrook) when no market has it
  for (const tw of D.towns) if (E.townKnown(s, tw) && E.brewLeft(s, tw.id, k) >= need) { const n = E.buyBrew(s, tw.id, k, need); if (n) { (seen.brew ||= {})[k] = (seen.brew[k] || 0) + n; return true; } }
  return false;
}
function bot(s, m) {
  // craft paths: main by best skill, more as slots open, a specialty at Master, any combo that qualifies
  if (s.day % 30 === 6 && E.daysOfStock(s) > 10)
    for (const o of E.living(s).filter(x => E.isAdult(x))) {
      if (!o.craft && s.res.coin > 1500 && s.day > 5 * YD && !E.joinIssues(s, o, "hearth").length) E.joinGuild(s, o, "hearth");
      if (!o.craft) continue;
      const lv = P => Math.max(...P.skills.map(k => o.skills[k].lvl)) + ((o.id + P.id.length) % 4);
      const opts = E.pathDefs().filter(P => !P.advanced && !E.openPathIssue(s, o, P.id) && (!E.nextSlotFor || E.nextSlotFor(o, P.id) !== "dabble")).sort((a, b) => lv(b) - lv(a)); // R46: only into a free slot
      if (opts.length && E.openPath(s, o, opts[0].id)) seen.pathOpens++;
      for (const e of E.memberPaths(o)) {
        const ch = E.specChoices(o, e.id);
        if (ch.length && E.chooseSpec(s, o, e.id, ch[o.id % ch.length].id)) seen.specs++;
      }
      for (const P of E.pathDefs().filter(P => P.advanced)) if (!E.openPathIssue(s, o, P.id) && E.openPath(s, o, P.id)) seen.combos++;
    }
  const g = s;
  if (s.pendingEnc) {
    seen.enc++;
    const e = D.encounters.list.find(x => x.id === s.pendingEnc.id);
    E.resolvePending(
      s,
      (e.options.filter(o => E.optionOk(s, o))[s.day % 2] || e.options.find(o => E.optionOk(s, o))).id,
    );
    if (s.pendingEnc) bad(0, s.day, "encounter could not be resolved");
  }
  while (s.pendingClass && s.pendingClass.length) {
    const who = s.members.find(x => x.id === s.pendingClass[0]);
    const opts = D.classes.filter(c => c.tier === 0 && !c.line);
    E.chooseClass(s, who.id, who.id % 3 === 0 && s.members.filter(x => E.isAdult(x)).length > 1 ? "apprentice" : opts[who.id % opts.length].id);
    if (s.pendingClass[0] === who.id) s.pendingClass.shift();
  }
  if (s.needSuccession) {
    const l = E.living(s).sort((a, b) => b.ageDays - a.ageDays)[0];
    if (l) E.switchTo(s, l.id);
  }
  m = E.active(s);
  if (!m) return;
  // tutorial
  if (E.tutActive(s)) {
    const st = E.tutCurrent(s);
    if (st.check === "equipped" && s.vault.includes("rusty_sword")) E.equip(s, m, "rusty_sword");
    if (st.check === "quest:rats") E.setAction(s, { type: "quest", target: "rats" });
    if (st.check === "crafted") E.mentorCraft(s);
    if (st.check === "activity") E.setAction(s, { type: "activity", target: "hiking" });
    const go = { fed: "fishing", chopped: "chop", hunted: "hunt", cooked: "cook" }[st.check]; // R31 task steps
    if (go && !E.isBusy(m) && !(m.action && m.action.target === go)) E.setAction(s, { type: "activity", target: go });
    if (st.check === "estate") E.tutNote(s, "estate");
    if (st.check === "scouted" && !E.isBusy(m)) {
      const n = D.nodes.find(x => E.known(s, x) && E.actionAllowed(s, m, { type: "gather", target: x.id }));
      if (n) E.setAction(s, { type: "gather", target: n.id });
    }
    if (st.check === "traded") {
      const k = Object.keys(D.towns[0].prices).find(r => (s.res[r] || 0) >= 1);
      if (k) E.sellRes(s, D.towns[0].id, k, 1);
    }
    E.tutCheck(s);
  }
  if (E.isAdult(m) && !m.cls) {
    const opts = D.classes.filter(c => c.tier === 0 && !c.line);
    // every third heir goes mage-line so enchanting/sets get long-run coverage
    const pick = m.id % 3 === 0 && s.members.filter(x => E.isAdult(x) && x.alive !== false).length > 1 && opts.some(c => c.id === "apprentice") ? "apprentice" : opts[m.id % opts.length].id;
    if (opts.length) E.chooseClass(s, m.id, pick);
  }
  if (m.cls) seen.classes.add(m.cls);
  // estate
  if (!s.land.length) E.buyLand(s, "plot");
  // stone-using refiners only refine above 75% of storage while the next land deed still needs stone, so the deed stays affordable
  const nextLand = D.estate.lands.find(l => !s.land.includes(l.id) && (!l.requires || s.land.includes(l.requires)));
  const needStone = !!(nextLand && nextLand.cost.stone && (s.res.stone || 0) < nextLand.cost.stone);
  for (const st of s.structures)
    if (E.isRefiner(s, st) && st.pieces.some(id => (E.pieceDef(id).bonus.processes || []).some(p => (p.in || {}).stone))) E.setRefine(s, st.uid, { min: needStone ? 0.75 : 0 });
  for (const l of D.estate.lands)
    if (s.res.coin > (l.cost.coin || 0) * 3 && !s.land.includes(l.id) && E.landUsed(s) >= E.landSlots(s) - 1)
      E.buyLand(s, l.id);
  // R40 fields: build one per free slot (food first, then grains/veg/flax/berries), level + enlarge when rich, hub upgrades
  if (D.fields && !process.env.NO_FIELDS) {
    const order = ["food", "wheat", "vegetables", "barley", "flax", "berries"];
    const have = new Set(E.fieldsState(s).list.map(f => f.crop));
    const next = order.find(c => !have.has(c) && !E.buildFieldIssue(s, c)) || (E.fieldsState(s).list.length < E.fieldSlots(s) && !E.buildFieldIssue(s, "food") ? "food" : null);
    if (next && E.bedrooms(s) >= 2 && s.res.coin > (E.fieldsState(s).list.length ? 1500 : 600)) E.buildField(s, next);
    // R40.2 smarter bot: only grow a field that has idle tending hours behind it and whose crop isn't sitting at its storage limit
    for (const f of E.fieldsState(s).list) {
      const res = (E.cropDef(f.crop) || {}).res, st = ((E.fieldsState(s).last || {}).fields || {})[f.id] || {};
      const useful = res && (s.res[res] || 0) + (E.fieldsState(s).pile[res] || 0) < E.capOf(s, res) * 0.7 && st.state !== "full" && st.state !== "waiting for haul";
      if (!useful) continue;
      const spare = E.tendAvail(s) - E.tendNeeded(s);
      const lc = E.levelCost(f);
      if (lc && spare > 0 && !E.levelIssue(s, f) && s.res.coin > (lc.coin || 0) * 15) E.levelField(s, f.id);
      const sc = E.sizeCost(f);
      if (sc && !E.sizeIssue(s, f) && s.res.coin > (sc.coin || 0) * 20 && spare >= 1) E.sizeUp(s, f.id);
    }
    { const pileNow = Object.values(E.fieldsState(s).pile).reduce((a, b) => a + b, 0); const waits = pileNow > 100 || Object.values((E.fieldsState(s).last || {}).fields || {}).some(x => x.state === "waiting for haul");
      for (const k of ["teamster", "worker"]) { const u = E.nextHubUp(s, k); if (!u || E.hubUpIssue(s, k)) continue;
        const busyT = s.minions.filter(x => x.job === "teamster").length >= E.jobCap(s, "teamster");
        const want = k === "teamster" ? (waits && (busyT || E.jobCap(s, "teamster") === 0) ? 1.1 : 6) : 5;
        if (s.res.coin > (u.cost.coin || 0) * want) { E.buyHubUp(s, k); if (k === "teamster") (seen.teamBuys ||= []).push(`${u.id}@y${(s.day / D.tuning.daysPerYear).toFixed(1)}`); } } }
    // R41: stock the coop / pen when there's room (feed + tending are the running cost)
    for (const t of E.animalTypes()) { if (!E.buyAnimalsIssue(s, t) && s.res.coin > 400) { E.buyAnimals(s, t); (seen.animalBuys ||= {})[t] = (seen.animalBuys[t] || 0) + 1; }
      if (!E.spotsUpIssue(s, t) && s.res.coin > (E.animalDef(t).spotsUp.cost.coin || 0) * 15) E.buySpotsUp(s, t); }
    // R75 Union Hall: buy the next tier once coin is 2.5x its full price (NO_HALL=1 keeps the pre-R75 bot, byte-identical to the R67 baseline)
    if (!process.env.NO_HALL) { const q = E.unionQuote(s); if (q && s.res.coin > q.total.coin * 2.5 && E.unionBuy(s)) (seen.hall ||= []).push(`T${E.unionTier(s)}@y${(s.day / D.tuning.daysPerYear).toFixed(1)}`); }
    (seen.fields ||= { max: 0, teamsters: 0 }).max = Math.max(seen.fields.max, E.fieldsState(s).list.length);
    seen.fields.teamsters = Math.max(seen.fields.teamsters, s.minions.filter(x => x.job === "teamster").length);
    const L = E.fieldsState(s).last;
    if (L) { const F = seen.fields; F.days = (F.days || 0) + 1; F.need = (F.need || 0) + L.need; F.avail = (F.avail || 0) + L.avail; for (const x of Object.values(L.fields)) F[x.state] = (F[x.state] || 0) + 1; for (const [k, v] of Object.entries(L.made)) (F.made ||= {})[k] = Math.round(((F.made || {})[k] || 0) + v); F.hauledT = (F.hauledT || 0) + L.byTeamsters; F.hauledF = (F.hauledF || 0) + L.byFarmers; F.farmers = Math.max(F.farmers || 0, L.workers.filter(w => w.kind === "follower").length); }
  }
  // Graveyard first (Ancestors' Tithe + death capture), then Stone Walls when affordable
  const gy = s.structures.find(x => x.type === "graveyard");
  if (!gy) {
    if (!E.structIssue(s, "graveyard") && E.buildStructure(s, "graveyard")) seen.structs.add("graveyard");
  } else if (!gy.up && (s.res.coin || 0) > 600 && (s.res.blocks || 0) >= 20) E.upgradeSpecial(s, gy.uid);
  // a type counts as built when any building's upgrade chain passed through it (Shack → Cabin → House; Warehouse → Trading Post …)
  const chain = id => { const o = []; for (let d = E.structDef(id); d; d = d.upgradeFrom && E.structDef(d.upgradeFrom)) o.push(d.id); return o; };
  for (const t of STRUCTS)
    if (
      !s.structures.some(x => chain(x.type).includes(t)) &&
      !E.structIssue(s, t) &&
      !holdForBunks(s, t) &&
      s.res.coin > (D.estate.structures.find(x => x.id === t).cost.coin || 0) * 2
    ) {
      if (E.buildStructure(s, t)) seen.structs.add(t);
    }
  for (const st of s.structures) {
    for (const p of PIECES)
      if (!E.placeIssue(s, st.uid, p) && s.res.coin > 300) E.placePiece(s, st.uid, p) && seen.pieces.add(p);
    // any upgrade or manor branch the family qualifies for (House → Mansion / Fort / Tower Keep / Abbey)
    const up = E.upgradeOptions(st.type).find(o => !E.upgradeIssue(s, st.uid, o.id));
    if (up && s.res.coin > 2000) E.upgradeStructure(s, st.uid, up.id);
    if (["shrinehouse", "barracks"].includes(st.type) && s.res.coin > 5000) E.upgradeSpecial(s, st.uid);
  }
  // enchanting: when a station + enchanter exist, enchant the best gear now and then
  if (s.day % 40 === 0 && E.stationFx(s).jobs > E.enchJobs(s).length) {
    const w = E.enchanters(s).find(w => !E.enchJobs(s).some(j => j.who === w.key));
    const id = w && s.vault.find(v => E.enchSlots(E.itemDef(v)) > E.splitId(v).ench.length);
    const en = id && D.gear.enchants.find(e => !E.enchantIssue(s, w.key, id, e.id));
    if (en && E.startEnchant(s, w.key, id, en.id)) seen.enchants++;
  }
  if (s.day % 200 === 0 && !E.hasPiece(s, "enchdesk") && E.enchanters(s).length && s.res.coin > 600) {
    const st = s.structures.find(x => !E.placeIssue(s, x.uid, "enchdesk"));
    if (st) E.placePiece(s, st.uid, "enchdesk");
  }
  // diplomacy: occasionally work for a friendly house, gift a rival, buy peace when rich
  for (const h of D.families.list) {
    const st = E.houseState(s, h.id);
    if (st.state === "war") {
      seen.wars++;
      if (s.res.coin > E.tributeCost(s, h.id) * 3) E.offerTruce(s, h.id);
    } else if (["rival", "feud"].includes(E.tierOf(s, h.id)) && s.res.coin > 2000) E.sendGift(s, h.id);
  }
  // livestock feed: keep ~20 days of hay (grazers) and wheat (hens) in store
  if (s.day % 5 === 0 && E.feedGroups) {
    const gs = E.feedGroups(s);
    if (gs.some(g => g.herd && g.n > 0)) seen.herdDays += 5;
    const need = r => gs.filter(g => D.world.feed.diets[D.world.feed.kinds[g.kind].diet][0] === r).reduce((a, g) => a + E.feedNeed(s, g), 0) * 20;
    for (const r of ["hay", "wheat"]) {
      const want = Math.ceil(need(r) - (s.res[r] || 0));
      if (want > 0 && s.res.coin > E.townBuyPrice(s, "millbrook", r) * want * 3) E.buyRes(s, "millbrook", r, want);
    }
  }
  // trade: one follower-led sell route once a Warehouse stands
  if (s.day % 30 < 3 && E.tradeTier(s)) {
    E.tradeInit(s);
    if (!s.trade.routes.length) {
      const t = D.towns[0];
      for (const res of Object.keys(t.prices).filter(k => !["food", "stone", "wheat", "hay"].includes(k) && (s.res[k] || 0) > 120).sort((a, b) => s.res[b] - s.res[a]))
        if (E.addRoute(s, t.id, "sell", res)) break;
    }
    for (const r of s.trade.routes)
      if (!r.driver) {
        const mi = s.minions.find(x => !x.special && ["gather", "idle", "herbs"].includes(x.job) && !E.driverIssue(x));
        if (mi) E.setCrew(s, r.id, "driver", mi.uid);
      }
    seen.convoyTrips = Math.max(seen.convoyTrips, s.trade.routes.reduce((a, r) => a + (r.trips || 0), 0));
  }
  // R31: hand in any villager request we can fill
  if (E.deliverable) for (const n of D.requests?.npcs || []) {
    const w = E.deliverIssue(s, n.id) ? null : E.wantsOf(s, n.id);
    // keep building materials for the estate: only hand over building materials (R42: + planks, blocks, leather, ingots) with 3x the ask in stock
    if (w && Object.entries(w).every(([k, v]) => !["wood", "stone", "planks", "blocks", "leather", "ingots"].includes(k) || (s.res[k] || 0) >= v * 3)) E.deliverRequest(s, n.id);
  }
  const FOODTASK = D.activities.some(a => a.id === "fishing" && a.task) ? "fishing" : "chores"; // R31: Fish is the day-1 food task
  // food: never let the larder run dry — buy provisions, else do chores (the starter path)
  if (E.daysOfStock(s) < 4) {
    if (s.res.coin >= E.townBuyPrice(s, "millbrook", "food") * 30) E.buyRes(s, "millbrook", "food", 30);
    else if (!E.tutActive(s) && (!E.isBusy(m) || E.daysOfStock(s) < 1) && !(m.action && m.action.target === FOODTASK)) {
      E.setAction(s, { type: "activity", target: FOODTASK });
      return;
    } else if (!(s.structures || []).length && m.action && m.action.target === FOODTASK) return; // fresh lineage: stay on chores until stocked
  }
  if (E.isAdult(m) && !E.isBusy(m) && !E.tutActive(s) && s.day % 50 < 3 && E.daysOfStock(s) >= 10) {
    const q = D.quests.find(q => (q.house || q.needsFeud) && E.actionAllowed(s, m, { type: "quest", target: q.id }) && q.cp <= E.cp(s, m));
    if (q) {
      seen.houseQuests.add(q.id);
      E.setAction(s, { type: "quest", target: q.id });
      return;
    }
  }
  // food: keep salt stocked for the smokehouse
  if (s.res.coin > 400 && (s.res.salt || 0) < 10) E.buyRes(s, "millbrook", "salt", 10);
  // minions
  if (s.res.coin > 800 && E.established(s)) {
    const type = (D.minions.hireAt.millbrook || [])[s.day % 3];
    const mi = type && E.hire(s, "millbrook", type);
    if (mi)
      for (const j of ["farm", "gather", "herbs", "mine", "hunt", "craft", "merchant", "adventure", "fish", "scout"])
        if (E.assignMinion(s, mi.uid, j)) break;
  }
  if (process.env.DBGS && s.day % 1800 < 3) console.log("DBGM", s.day, Math.round(E.daysOfStock(s)), Math.round(s.res.coin), E.established(s), s.minions.map(x => x.job + (x.special ? "*" : "")).join(","), E.jobCap(s, "noderun"), E.stalls(s));
  // map round: hauling animals, a follower on node runs, a cart now and then (gated so travel never starves the family)
  if (s.day - (mapTick.get(s) ?? -99) >= 30 && E.daysOfStock(s) > 15 && s.res.coin > 1500) {
    mapTick.set(s, s.day);
    if (!E.stalls(s)) for (const st of s.structures) if (!E.placeIssue(s, st.uid, "stablestall") && E.placePiece(s, st.uid, "stablestall")) break;
    // still no stall: swap a storage piece for one where stalls are allowed
    if (!E.stalls(s))
      for (const st of s.structures)
        if (st.pieces.includes("storage") && (E.allowedOf(st) || []).includes("stablestall")) {
          E.removePiece(s, st.uid, "storage");
          if (E.placePiece(s, st.uid, "stablestall")) break;
        }
    for (const id of ["mule", "ox"]) {
      const town = D.world.haul.animals[id].towns.find(x => E.townKnown(s, D.towns.find(t => t.id === x)));
      if (town && !E.animalCount(s) && E.buyAnimal(s, id, town)) seen.animals++;
    }
    if (s.minions.length >= 1 && !s.minions.some(x => x.job === "noderun")) {
      const mi = s.minions.find(x => ["gather", "herbs", "idle"].includes(x.job));
      const n = D.nodes.filter(x => E.known(s, x) && E.regionOpen(s, x.region) && E.nodeStock(s, x) > 0).sort((a, b) => E.travelDays(a.id) - E.travelDays(b.id))[0];
      if (mi && n && E.assignMinion(s, mi.uid, "noderun") && E.setMinionNode(s, mi.uid, n.id)) seen.noderuns++;
    }
    if (s.day % 4 === 0 && E.isAdult(m) && !E.isBusy(m) && !E.ownsVehicle(s, "handcart").length) {
      const rc = D.crafting.recipes.find(r => r.id === "r_handcart");
      if (rc && !E.recipeIssue(s, m, rc)) { E.setAction(s, { type: "craft", target: rc.id }); seen.haulCrafts++; }
    }
  }
  // followers: evolve (magic branch when possible), Manual mode on some to exercise choices
  if (s.day % 30 === 0 && E.daysOfStock(s) > 10)
    for (const mi of s.minions) {
      if (mi.uid.endsWith("3") && !mi.upMode) E.setUpMode(s, mi.uid, "manual");
      for (const [i, p] of (mi.pending || []).entries()) if (s.day % 90 === 0 && E.choosePending(s, mi.uid, i, p.offer[p.offer.length - 1])) { seen.picks++; break; }
      const ev = E.evolveOptions(mi).filter(c => !E.minionEvolveIssue(s, mi, c.id)).sort((a, b) => (b.branch === "magic") - (a.branch === "magic"))[0];
      if (ev && E.evolveMinion(s, mi.uid, ev.id)) seen.evolves++;
    }
  // gear sets: wear set pieces (member first, then followers); craft a set piece now and then
  if (s.day % 30 === 15 && E.daysOfStock(s) > 10 && s.coins > 200) {
    for (const id of s.vault.filter(v => (E.itemDef(v) || {}).set)) {
      const x = E.itemDef(id);
      if (!m.equip[x.slot]) { E.equip(s, m, id); seen.setWorn++; continue; }
      const f = s.minions.find(mi => E.minionSlots(mi).includes(x.slot) && !(mi.equip || {})[x.slot]);
      if (f && E.equipMinion(s, f.uid, id)) seen.setWorn++;
    }
    if (s.day % 120 === 15 && E.isAdult(m) && !E.isBusy(m) && E.daysOfStock(s) > 10) {
      const rc = D.crafting.recipes.find(r => r.set && !E.recipeIssue(s, m, r));
      if (rc) { E.setAction(s, { type: "craft", target: rc.id }); seen.setCrafts++; }
    }
  }
  // R48 the coast (as a player would): trade at Gull's Landing once found, buy the Sea Boat Plans, Dock → Slipway, build a Sea Boat
  if (!process.env.NO_SEA && s.day % 30 === 7 && E.townKnownId(s, "gullport")) {
    (seen.r48 ||= {}).gullKnown ??= +(s.day / YD).toFixed(1);
    if ((s.res.fish || 0) >= 5) E.sellRes(s, "gullport", "fish", 5);
    if (s.res.coin > 4000 && !s.unlocks.includes("recipe:r_seaboat") && E.buyItem(s, "gullport", "seaboat_plans")) seen.r48.plans = +(s.day / YD).toFixed(1);
    if (s.res.coin > 15000 && !E.hasStructType(s, "dock") && E.structIssue(s, "dock") === "no free land slot") { const l = D.estate.lands.filter(l => !s.land.includes(l.id) && E.canBuyLand(s, l.id)).sort((a, b) => (a.cost.coin || 0) - (b.cost.coin || 0))[0]; if (l && s.res.coin > (l.cost.coin || 0) + 15000 && E.buyLand(s, l.id)) seen.r48.landForDock = (seen.r48.landForDock || 0) + 1; }
    if (s.res.coin > 15000 && !E.hasStructType(s, "dock") && !E.structIssue(s, "dock") && E.buildStructure(s, "dock")) seen.r48.dock = +(s.day / YD).toFixed(1);
    const dk = s.structures.find(st => st.type === "dock");
    if (dk && s.res.coin > 20000) {
      if ((s.res.rope || 0) < 10) E.buyRes(s, "gullport", "rope", 10 - Math.floor(s.res.rope || 0));
      if (!E.hasStructType(s, "slipway")) for (const [k, n] of [["planks", 40], ["stone", 20]]) buyAny(s, k, n);
      if (!E.upgradeIssue(s, dk.uid, "slipway") && E.upgradeStructure(s, dk.uid, "slipway")) seen.r48.slipway = +(s.day / YD).toFixed(1);
    }
    if (!E.hasSeaBoat(s) && E.hasStructType(s, "slipway") && s.unlocks.includes("recipe:r_seaboat")) {
      if ((s.res.rope || 0) < 12) E.buyRes(s, "gullport", "rope", 12 - Math.floor(s.res.rope || 0));
      if (s.res.coin > 3000) for (const [k, n] of [["planks", 40], ["cloth", 8]]) buyAny(s, k, n);
      const rc = D.crafting.recipes.find(r => r.id === "r_seaboat");
      if (E.recipeIssue(s, E.living(s).find(o => E.isAdult(o)) || m, rc) === "vault full") { const cheap = [...s.vault].map(id => E.itemDef(id)).filter(it => it && it.id !== "seaboat").sort((x, y) => E.sellValue(s, x) - E.sellValue(s, y))[0]; if (cheap) E.sell(s, cheap.id); }
      // a non-active adult who can make it takes a standing craft order for the boat (released once it is built)
      const cr = E.living(s).find(o => o.order && o.order.type === "craft" && o.order.target === rc.id) || E.living(s).find(o => E.isAdult(o) && o.id !== s.activeId && !E.recipeIssue(s, o, rc) && !(o.action && o.action.progress > 0));
      if (!cr && E.isAdult(m) && !E.recipeIssue(s, m, rc) && !(m.action && m.action.progress > 0)) { E.setAction(s, { type: "craft", target: rc.id }); seen.r48.boatCrafts = (seen.r48.boatCrafts || 0) + 1; seen.r48.boatByHead = 1; }
      else if (!cr) seen.r48.boatWhy = E.living(s).filter(o => E.isAdult(o)).map(o => E.recipeIssue(s, o, rc)).find(Boolean) || "busy";
      if (!cr && /Workbench/.test(seen.r48.boatWhy)) { for (const st of s.structures) if (!E.placeIssue(s, st.uid, "workbench") && E.placePiece(s, st.uid, "workbench")) { seen.r48.benchForBoat = 1; break; } if (!seen.r48.benchForBoat) seen.r48.benchWhy = [...new Set(s.structures.map(st => E.placeIssue(s, st.uid, "workbench")))].join("/"); }
      if (cr && !(cr.order && cr.order.type === "craft" && cr.order.target === rc.id)) { E.setOrder(s, cr.id, { type: "craft", target: rc.id }); seen.r48.boatCrafts = (seen.r48.boatCrafts || 0) + 1; }
    }
    if (E.hasStructType(s, "slipway")) seen.r48.slipway ??= +(s.day / YD).toFixed(1);
    if (E.hasSeaBoat(s)) { seen.r48.seaBoat ??= +(s.day / YD).toFixed(1); for (const o of E.living(s)) if (o.order && o.order.type === "craft" && o.order.target === "r_seaboat") E.setOrder(s, o.id, { type: "quest", target: "outskirts" }); }
    if (!E.hasStructType(s, "dock")) seen.r48.dockWhy = E.structIssue(s, "dock") || (s.res.coin <= 15000 ? "coin" : null);
    else if (!E.hasStructType(s, "slipway") && dk) seen.r48.slipWhy = E.upgradeIssue(s, dk.uid, "slipway") || (s.res.coin <= 20000 ? "coin" : null);
  }
  // R48 coast jobs: an idle adult takes a repeatable Gull's Landing job (by ferry or Sea Boat when that is quicker)
  if (!process.env.NO_SEA && Math.floor(s.day / 3) % 2 === 0 && Math.floor(s.day / 30) % 3 === 2 && E.townKnownId(s, "gullport")) { // one month in three
    if ((s.res.rope || 0) < 4 && s.res.coin > 500) E.buyRes(s, "gullport", "rope", 4);
    seen.r48 ||= {};
    // one coast hand: a grown non-active member on a plain quest order is sent on Gull's Landing jobs in rotation (orders repeat)
    const w = E.living(s).find(o => o.id === seen.r48.hand && E.isAdult(o) && o.order && o.order.type === "quest") || E.living(s).find(o => E.isAdult(o) && o.id !== s.activeId && o.order && o.order.type === "quest");
    if (w && w.id !== s.activeId) {
      seen.r48.hand = w.id;
      const q = D.quests.filter(q => q.id.startsWith("q_gull") && E.actionAllowed(s, w, { type: "quest", target: q.id }) && !E.questIssue(s, w, q) && q.cp <= E.cp(s, w) * 1.1).sort((a, b) => ((seen.r48.coastN || {})[a.id] || 0) - ((seen.r48.coastN || {})[b.id] || 0))[0];
      if (process.env.SDBG && w.action) console.error("ACT", s.day, w.id, JSON.stringify(w.action).slice(0, 160), JSON.stringify(w.order), w.paused);
      if (q && !E.isBusy(w)) { w.action = { type: "quest", target: q.id, progress: 0 }; if (process.env.SDBG2 && !w._trap) { w._trap = 1; let v = w.action; Object.defineProperty(w, "action", { get: () => v, set: x => { if (v && String(v.target).startsWith("q_gull") && !(x && x === v) && (v.trip ? v.trip.t < v.trip.out + v.trip.task + v.trip.back : true)) console.error("TRAP", s.day, v.target, v.trip && v.trip.t, x && x.target, new Error().stack.split("\n").slice(2, 6).join(" | ")); v = x; }, configurable: true, enumerable: true }); } seen.r48.coastTaken = (seen.r48.coastTaken || 0) + 1; (seen.r48.coastN ||= {})[q.id] = (seen.r48.coastN[q.id] || 0) + 1; }
    }
  }
  // R49 Saltmere (as a player would): find the coast (Strand / Merrow's chart), keep ale for Old Tobiah, send the coast hand on Saltmere work by the ferry route,
  // walk the reef chain and make its choice (keep on even seeds, tell on odd), build the Salt Works, a Kelp Vat, and run a little reef-gold trade
  if (!process.env.NO_SEA && !process.env.NO_R49) {
    const r9 = (seen.r49 ||= {}), yr = () => +(s.day / YD).toFixed(1);
    const c0 = s.res.coin, sp = k => { (r9.spend ||= {})[k] = Math.round((r9.spend[k] || 0) + c0 - s.res.coin); };
    if (E.regionKnown(s, "saltcoast")) r9.coastKnown ??= yr();
    if (E.townKnownId(s, "saltmere")) r9.townKnown ??= yr();
    if ((s.charts || []).includes("saltcoast")) r9.chart ??= yr();
    // scout the Southern Strand now and then once Gull's Landing is found and the coast is still unknown
    if (!E.regionKnown(s, "saltcoast") && E.townKnownId(s, "gullport") && s.day % 60 < 3 && m && !E.isBusy(m) && E.isAdult(m) && !E.exploreIssue(s, m, "a_strand")) { E.setAction(s, { type: "explore", target: "a_strand" }); r9.strandTries = (r9.strandTries || 0) + 1; }
    if (E.regionKnown(s, "saltcoast") && !E.explored(s, "a_saltshore") && s.day % 30 < 3 && m && !E.isBusy(m) && E.isAdult(m) && !E.exploreIssue(s, m, "a_saltshore")) { E.setAction(s, { type: "explore", target: "a_saltshore" }); r9.shoreTries = (r9.shoreTries || 0) + 1; }
      sp("explore");
    if (E.townKnownId(s, "saltmere")) {
      // Old Tobiah drinks: buy exactly what he asks for, hand it over at once (ale also goes elsewhere, so no standing stock)
      // ale is brewed, not bought: once a coast villager asks for it and barley is piling up, build a Brewery and its vats
      if (((E.wantsOf(s, "tobiah") || {}).ale || (E.wantsOf(s, "merrow") || {}).ale) && (s.res.barley || 0) > 100 && s.res.coin > 6000) {
        if (!E.hasStructType(s, "brewery") && !E.structIssue(s, "brewery") && E.buildStructure(s, "brewery")) r9.brewery = +(s.day / YD).toFixed(1);
        if (!r9.vats) for (const st of s.structures) if (!E.placeIssue(s, st.uid, "brewvats") && E.placePiece(s, st.uid, "brewvats")) { r9.vats = +(s.day / YD).toFixed(1); break; }
        if (!r9.vats) r9.vatsWhy = [...new Set(s.structures.map(st => E.placeIssue(s, st.uid, "brewvats")))].slice(0, 3).join("/") + (E.hasStructType(s, "brewery") ? "" : " | brewery: " + E.structIssue(s, "brewery"));
      }
      // the same for Captain Merrow (ale, salted fish) until his chart is handed over
      for (const [who, town, max] of [["tobiah", "saltmere", 3], ["merrow", "gullport", 3]]) {
        const tw = E.wantsOf(s, who);
        if (!tw || !E.visited(s, town) || s.res.coin < 3000 || (((s.req || {})[who] || {}).n || 0) >= max) continue;
        if (tw.saltedfish && !r9.tub) { for (const st of s.structures) if (!E.placeIssue(s, st.uid, "saltingtub") && E.placePiece(s, st.uid, "saltingtub")) { r9.tub = +(s.day / YD).toFixed(1); break; } if (!r9.tub) r9.tubWhy = [...new Set(s.structures.map(st => E.placeIssue(s, st.uid, "saltingtub")))].slice(0, 3).join("/"); }
        if (tw.saltedfish) { buyAny(s, "fish", 40); buyAny(s, "salt", 20); }
        if (tw.saltedfish && (s.res.saltedfish || 0) < tw.saltedfish) continue; // wait for the tub
        const got = Object.entries(tw).every(([k, v]) => buyAny(s, k, Math.ceil((s.res[k] || 0) >= v ? 0 : v)));
        if (process.env.R9DBG && !got) console.error("BUY", s.day, who, JSON.stringify(tw), Math.round(s.res.coin), JSON.stringify(Object.fromEntries(Object.keys(tw).map(k => [k, s.res[k]]))), D.towns.filter(tw2 => E.townKnown(s, tw2) && (tw2.market || []).includes("ale")).map(x => x.id).join());
        if (got && !E.deliverIssue(s, who)) { E.deliverRequest(s, who); r9[who + "Gave"] = (r9[who + "Gave"] || 0) + 1; } else r9[who + "Why"] = E.deliverIssue(s, who);
      }
      const r1 = findQ("reef1");
      sp("ale");
      // the reef choice
      for (const c of E.pendingChoices(s)) { const pick = (globalThis.SIMSEED || 0) % 2 ? "tell" : "keep"; if (!E.choiceIssue(s, c.id, pick) && E.makeChoice(s, c.id, pick)) r9.choice = pick + "@" + yr(); }
      // Salt Works once there is a Dock
      if (s.res.coin > 25000 && E.hasStructType(s, "dock") && !E.hasStructType(s, "saltworks") && E.structIssue(s, "saltworks") === "no free land slot") { const l = D.estate.lands.filter(l => !s.land.includes(l.id) && E.canBuyLand(s, l.id)).sort((a, c) => (a.cost.coin || 0) - (c.cost.coin || 0))[0]; if (l && s.res.coin > (l.cost.coin || 0) + 20000 && E.buyLand(s, l.id)) r9.landForSW = (r9.landForSW || 0) + 1; }
      if (s.res.coin > 20000 && !E.hasStructType(s, "saltworks") && !E.structIssue(s, "saltworks") && E.buildStructure(s, "saltworks")) r9.saltworks = yr();
      if (!r9.kelpvat && s.res.coin > 10000) for (const st of s.structures) if (!E.placeIssue(s, st.uid, "kelpvat") && E.placePiece(s, st.uid, "kelpvat")) { r9.kelpvat = yr(); break; }
      if ((s.res.kelp || 0) < 30 && r9.kelpvat && s.res.coin > 2000) E.buyRes(s, "saltmere", "kelp", 30);
      sp("build");
      // reef-gold: buy a few cheap in Saltmere, sell them where they fetch more (monthly)
      if (s.day % 30 < 3 && s.res.coin > 8000) { const b = E.buyRes(s, "saltmere", "reefgold", 4); if (b) { const to = D.towns.filter(tw => tw.id !== "saltmere" && E.townKnown(s, tw)).sort((a, c) => E.townSellPrice(s, c.id, "reefgold") - E.townSellPrice(s, a.id, "reefgold"))[0]; const sold = to && E.sellRes(s, to.id, "reefgold", 4); r9.goldTrips = (r9.goldTrips || 0) + 1; if (sold) r9.goldSold = (r9.goldSold || 0) + 4; } }
      sp("gold");
      // the coast hand: one month in three (the month the Gull's Landing jobs are not running) on Saltmere work: chain/beats/thread first, then jobs
      if (process.env.R9DBG && seen.r48 && seen.r48.hand) { const h = E.living(s).find(o => o.id === seen.r48.hand); if (h) console.error("H", s.day, JSON.stringify(h.action || null).slice(0, 220), JSON.stringify(h.order)); }
      { const h = seen.r48 && E.living(s).find(o => o.id === seen.r48.hand); if (h && h.action && h.action.target === "reef1" && (s.res.ale || 0) < 3) buyAny(s, "ale", 3); if (process.env.R9DBG && h && h.action && h.action.target === "reef1") console.error("RF", s.day, s.res.ale, JSON.stringify(h.action.trip), (s.log || []).filter(l => /Tobiah|failed/.test(l.msg)).slice(0, 2).map(l => JSON.stringify(l).slice(0, 160)).join(" / ")); } // keep the ale for Tobiah until the hand arrives
      if (Math.floor(s.day / 30) % 3 === 1) {
        const w = E.living(s).find(o => o.id === (seen.r48 || {}).hand && E.isAdult(o) && o.id !== s.activeId) || E.living(s).find(o => E.isAdult(o) && o.id !== s.activeId && o.order && o.order.type === "quest");
        if (w && !E.isBusy(w)) {
          (seen.r48 ||= {}).hand = w.id;
          if (r1 && !s.doneQuests.includes("reef1") && E.questVisible(s, r1) && !(w.action && w.action.target === "reef1")) buyAny(s, "ale", Math.ceil((s.res.ale || 0) + 3)); // reef1 hands Tobiah a few ales
          const ok = q => E.questVisible(s, q) && !(q.once && s.doneQuests.includes(q.id)) && E.actionAllowed(s, w, { type: "quest", target: q.id }) && !E.questIssue(s, w, q) && q.cp <= E.cp(s, w) * 1.1;
          const pri = q => (q.chain ? 0 : q.beat || q.id.startsWith("b_") ? 1 : q.id.startsWith("ht_") ? 2 : 3);
          const q = D.quests.filter(q => q.town === "saltmere" && ok(q)).sort((a, b) => pri(a) - pri(b) || ((r9.n || {})[a.id] || 0) - ((r9.n || {})[b.id] || 0))[0];
          if (process.env.R9DBG) console.error("R9", s.day, w.id, q && q.id, JSON.stringify(w.action || null).slice(0, 200), JSON.stringify(w.order)); if (q) { E.setOrder(s, w.id, { type: "quest", target: q.id }); w.action = { type: "quest", target: q.id, progress: 0 }; (r9.n ||= {})[q.id] = (r9.n[q.id] || 0) + 1; r9.taken = (r9.taken || 0) + 1; }
          else if (!r9.whyNone && E.cp(s, w) > 0) r9.whyNone = D.quests.filter(q => q.town === "saltmere" && q.chain && !s.doneQuests.includes(q.id)).map(q => q.id + ":" + (E.questVisible(s, q) ? E.questIssue(s, w, q) || "cp" : "hidden")).join(",");
        }
      }
    }
  }
  seen.maxCarry = Math.max(seen.maxCarry, E.haulTier(s).carry);
  // stone ranks: keep some limestone/granite/marble for the Mason's Table once the estate is rich (bought in town)
  if (s.day % 30 < 3 && s.res.coin > 30000)
    for (const [k, b] of [["limestone", "limeblocks"], ["granite", "graniteblocks"], ["marble", "marbleblocks"]]) if ((s.res[k] || 0) < 150 && (s.res[b] || 0) < 150) for (const tw of D.towns) if (E.townKnown(s, tw) && tw.market.includes(k) && E.buyRes(s, tw.id, k, 150)) break;
  // village: Auto Deliver on; one project at a time: relocate production, then cottages, then grow and add copies
  if (s.village && s.day % 30 < 3) {
    if (!s.village.auto) E.toggleAutoDeliver(s);
    // raw goods the refiners eat (wood, stone) get bought in town for the project when coin is plentiful
    for (const [k, n] of Object.entries(E.projectLeft(s))) if (k !== "coin" && s.res.coin > 20000) for (const tw of D.towns) if (E.townKnown(s, tw) && (tw.prices || {})[k] && E.buyRes(s, tw.id, k, Math.min(n, 200))) { E.deliver(s, k); break; }
    if (!E.project(s)) {
      const V = D.estate.village, mv = s.structures.find(x => !E.isVillage(x) && !E.relocateIssue(s, x.uid));
      if (mv) E.relocate(s, mv.uid);
      else if (s.structures.filter(x => x.type === "cottage").length < 2 && !E.villageBuildIssue(s, "cottage")) E.buildVillage(s, "cottage");
      else if (!E.villageUpIssue(s) && s.res.coin > 3 * V.tiers[s.village.tier + 1].cost.coin) E.upgradeVillage(s);
      else for (const t of ["fields", "sawmill", "quarry", "gristmill", "orchard"]) if (!E.villageBuildIssue(s, t, E.maxTier(s, t)) && s.res.coin > 3 * E.villageCost(t, E.maxTier(s, t)).coin && E.buildVillage(s, t, E.maxTier(s, t))) break;
    }
  }
  // late-game coin sinks (only with plenty of coin): stable, stone quarries, defenses once raids loom, patronage
  if (E.buyMount && !process.env.NOSINK && s.day % 30 < 3 && s.res.coin > 30000) {
    const G = D.endgame, rich = c => s.res.coin > 3 * (c.coin || 0);
    const nm = G.mounts[E.mountTier(s)]; if (nm && rich(nm.cost)) E.buyMount(s);
    for (const q of G.quarries) { const t = q.tiers[E.quarryTier(s, q.id)]; if (t && rich(t.cost)) E.buildQuarry(s, q.id); }
    if (E.era(s).n >= G.raids.phase) for (const k of ["tower", "wall", "palisade"]) { const t = G.defenses[k].tiers[E.defTier(s, k)]; if (t && rich(t.cost)) E.buildDefense(s, k); }
    for (const p of E.patronOptions(s)) if (rich(p.cost)) E.fundTown(s, p.id);
  }
  // legacy
  for (const u of D.legacy.upgrades) if (!(process.env.FA_OFF && u.id.startsWith("fa_")) && E.buyLegacy(s, u.id)) seen.legacy.add(u.id);
  if (process.env.QUOTA_FREE && !E.legacyTier(s, "quotas")) E.legacyState(s).ups.quotas = +process.env.QUOTA_FREE; // sim knob: grant the Ledger
  // R34 bot rule: with the Steward's Ledger, keep a few staples topped up
  if (E.quotaSlots && E.quotaSlots(s) && !(s.quotas || []).length) for (const [k, n] of [["bread", 150], ["planks", 80], ["stew", 60]]) E.addQuota(s, k, n, "standing");
  // family
  if (E.isAdult(m) && !m.spouse && E.ageY(m) >= T.courtAge && s.suitors.length) {
    const su = s.suitors.reduce((a, b) => (b.affinity > a.affinity ? b : a));
    if (su.affinity >= 100) { const ok = E.propose(s, su.id); if (process.env.PDBG && !ok) console.error("PROPOSE", s.day, E.proposeIssue(s, su.id)); }
    else if (!E.isBusy(m)) {
      E.setAction(s, { type: "court", target: su.id });
      return;
    }
  }
  // materials: gather when short of wood/stone for the next build
  if (E.isAdult(m) && !E.isBusy(m) && ((s.res.wood || 0) < 40 || (s.res.stone || 0) < 20) && s.day % 60 < 20) {
    const ok = D.nodes.filter(x => E.actionAllowed(s, m, { type: "gather", target: x.id }));
    const n = ok.find(x => E.nodeStock(s, x) > 0 && (x.res.wood || x.res.stone)) || ok[0];
    if (n) E.setAction(s, { type: "gather", target: n.id });
    return;
  }
  // guilds
  // R46: each adult joins their class's guild first (then any guild they qualify for)
  for (const o of NO_TIERS ? [m] : E.living(s).filter(x => E.isAdult(x) && !x.guild)) {
    const own = o.cls && (E.classGuild(o.cls) || {}).id, tr = !process.env.NO_TRACK && E.trackFor ? E.trackFor(s, o) : null; // R47.1: then the track guild, as Auto Advance does
    for (const gd of [...(D.guilds.guilds || D.guilds)].sort((a, b) => (b.id === own) - (a.id === own) || (b.id === tr) - (a.id === tr)))
      if (!o.guild && !E.joinIssues(s, o, gd.id).length && E.joinGuild(s, o, gd.id)) seen.guilds.add(gd.id);
  }
  if (m.guild) E.rankUp(s, m);
  // R46 guild tiers: advance any member who qualifies for the next tier (best power first)
  if (!NO_TIERS) for (const o of E.living(s)) if (o.guild && o.cls) {
    const up = E.classMoves(s, o).filter(c => E.moveKind(o, c) === "up" && E.canEvolve(s, o, c) && s.res.coin - E.moveCost(o, c) > 300).sort((a, b) => (b.cpMult || 1) - (a.cpMult || 1));
    if (up.length && E.evolve(s, o, up[0].id)) seen.tierUps = (seen.tierUps || 0) + 1;
    if (o !== m && E.canRankUp(s, o)) E.rankUp(s, o);
  }

  // R47 what-if (ARCH=1): from year 3 one non-active adult holds a Master Builder second class (requirements skipped),
  // to measure what the Architects' discounts are worth over the run (reported as buildSaved)
  if (process.env.ARCH && s.day >= 3 * YD && !E.living(s).some(x => x.class2 && E.guildOfCls(x.class2) === 'architects')) { const o = E.living(s).find(x => x.id !== m.id && E.isAdult(x) && !x.guild2) || m; o.guild2 = { id: 'architects', rank: 1, rep: 0 }; o.class2 = process.env.ARCH === 'fort' ? 'b_surveyor' : 'b_masterbuilder'; }
  // R47 second guilds (as Auto Advance would): join Auto's pick once eligible, rank it, advance its class to tier 2
  if (!NO_TIERS && E.secondVia && !process.env.NO_SECOND) for (const o of E.living(s).filter(x => E.isAdult(x) && x.guild)) {
    if (E.secondVia(o) && !o.guild2) {
      const p = E.pick2(s, o);
      if (process.env.R47DBG && !(seen.r47dbg ||= new Set()).has(o.id + ':' + Math.floor(s.day / YD)) && seen.r47dbg.add(o.id + ':' + Math.floor(s.day / YD))) console.error('R47 Y' + s.day / YD, o.name, o.cls, E.secondVia(o), p && p.gid, p && E.join2Issues(s, o, p.gid).join('|'), Math.round(s.res.coin));
      if (p && !E.join2Issues(s, o, p.gid).length && s.res.coin - E.join2Fee(s, o, p.gid) > 300 && E.joinSecond(s, o, p.gid)) { const j = (seen.second ||= { joins: {}, via: {}, year: [] }); j.joins[p.gid] = (j.joins[p.gid] || 0) + 1; j.via[o.secondGuild.via] = (j.via[o.secondGuild.via] || 0) + 1; j.year.push(+(s.day / YD).toFixed(1)); }
    }
    if (o.guild2) {
      const n = D.guilds.ranks[o.guild2.rank + 1];
      if (n && !E.rank2Issue(s, o) && s.res.coin - n.cost > 300) E.rankUp2(s, o);
      const c2 = E.findId(D.classes, o.class2), up = E.classMoves(s, E.view2(o)).filter(c => c.tier === (c2.tier || 0) + 1 && !E.class2Issues(s, o, c).length && s.res.coin - (c.cost || 0) > 300);
      if (up.length && E.evolve2(s, o, up[0].id)) { const j = (seen.second ||= { joins: {}, via: {}, year: [] }); j.tier2 = (j.tier2 || 0) + 1; }
    }
  }
  if (m.adv !== undefined && !m.adv && m.cls) E.joinAdventurers && E.joinAdventurers(s, m);
  if (m.adv) E.advRankUp && E.advRankUp(s, m);
  // others work quests
  for (const o of E.living(s)) {
    if (o.id === m.id || !E.isAdult(o)) continue;
    if (o.id === (seen.r48 || {}).hand && o.action && (findQ(o.action.target) || {}).town === "saltmere") {
      if (Math.floor(s.day / 30) % 3 === 1 || (o.action.progress || 0) > 0 || o.action.trip) continue; // R49 the coast hand finishes Saltmere work
      o.action = null;
    }
    if (o.id === (seen.r48 || {}).hand && o.order && (findQ(o.order.target) || {}).town === "saltmere" && Math.floor(s.day / 30) % 3 !== 1 && !(o.action && (findQ(o.action.target) || {}).town === "saltmere")) E.setOrder(s, o.id, { type: "quest", target: "outskirts" });
    if (o.id === (seen.r48 || {}).hand && o.action && String(o.action.target).startsWith("q_gull")) {
      if (Math.floor(s.day / 30) % 3 === 2 || (o.action.progress || 0) > 0) continue; // R48 the coast hand finishes the job (coast month, or mid-trip)
      o.action = null; // back to the usual quests outside the coast month
    }
    // R46: one month in three, drill a skill the nearest next class still needs
    const dk = !NO_TIERS && Math.floor(s.day / 30) % 3 === 0 && E.drillSkill(s, o);
    if (dk) { if (!o.order || o.order.type !== "train" || o.order.target !== dk) E.setOrder(s, o.id, { type: "train", target: dk }); continue; }
    if (!o.order || o.order.type === "work" || o.order.type === "train") E.setOrder(s, o.id, { type: "quest", target: "outskirts" });
  }
  // active: quest the best available, sometimes explore
  // R46: one month in three the active member also drills toward their next tier
  if (!NO_TIERS && !E.isBusy(m) && E.isAdult(m) && !E.tutActive(s) && Math.floor(s.day / 30) % 3 === 1 && E.daysOfStock(s) >= 10) { const dk = E.drillSkill(s, m); if (dk) { if (!(m.action && m.action.type === "train" && m.action.target === dk)) E.setAction(s, { type: "train", target: dk }); return; } }
  if (!E.isBusy(m) && E.isAdult(m) && !E.tutActive(s) && !process.env.OLDBOT && smartAdventure(s, m)) return;
  if (!E.isBusy(m) && E.isAdult(m) && !E.tutActive(s)) {
    // explore more while dungeons are still undiscovered (otherwise first clears hinge on discovery luck)
    if (s.day % 97 < 10 || ((D.dungeons || []).some(d => E.dungeonIssue(s, m, d) === "undiscovered") && s.day % 40 < 8)) E.setAction(s, { type: "auto", target: "explore" });
    else {
      const q = D.quests
        .filter(q => E.actionAllowed(s, m, { type: "quest", target: q.id }) && (process.env.OLDBOT ? q.cp <= E.cp(s, m) * 1.2 : q.cp * (q.risk === "deadly" ? 1.25 : 1) <= E.cp(s, m)))
        .sort((a, b) => b.cp - a.cp)[0];
      if (q) E.setAction(s, { type: "quest", target: q.id });
    }
  }
}

// coin source accounting by day hook
const coinBy = {};
for (const h of E.DAY_HOOKS) {
  const f = h.fn;
  h.fn = (s, a, b) => {
    const c0 = s.res.coin;
    f(s, a, b);
    coinBy[h.name] = (coinBy[h.name] || 0) + (s.res.coin - c0);
  };
}
for (const [k, f] of Object.entries(E.MINION_JOBS))
  E.MINION_JOBS[k] = (s, mi, a, rg) => {
    const c0 = s.res.coin;
    f(s, mi, a, rg);
    coinBy["job:" + k] = (coinBy["job:" + k] || 0) + (s.res.coin - c0);
  };
const report = [];
const SEED0 = +(process.env.SEED || 1);
for (let seed = SEED0; seed < SEED0 + SEEDS; seed++) {
  let sd = seed * 104729;
  globalThis.SIMSEED = seed;
  E.setRng(() => ((sd = (sd * 16807) % 2147483647), sd / 2147483647));
  let s = E.newGame(1e12);
  const BREC = { ach: Object.fromEntries((Array.isArray(D.achievements) ? D.achievements : D.achievements.list).map(a => [a.id, 1])), flags: { thaneOath: 1, seaHeir: 1, hydra_slain: 1, craneDisgraced: 1 }, bonuses: {} };
  const bonus = x => { if (process.env.BONUS) E.applyLegacyBonuses(x, BREC); return x; }; // R60: every carry-over bonus owned, applied at each run start
  bonus(s);
  lastS = s;
  let lineages = 1,
    maxGen = 1,
    peakCoin = 0,
    idleDays = 0;
  const noSuitor = { cur: 0, max: 0 };
  const phaseDay = {};
  const timing = {}, gens = [], deaths = [];
  let lastHeir = null, deadSeen = 0, maxScore = 0, wageX = 0, famDays = 0, famN = 0; const evt = {}, lastLog = new WeakMap(); const EVT = [['raidWon', /Raiders struck/], ['raidLost', /Raiders broke/], ['war', /^🏴 War with/], ['elite', /elite/], ['minionOld', /follower died of old age/], ['illness', /died of illness/], ['handover', /hands the family over/], ['oldAge', /died of old age\./]]; // years (loop time, across lineages) to the Graveyard, Stone Walls, first Auto Tend (80 Legacy) and the full tier-1 set (1240)
  const food = { spans: [], days: 0, short: 0, starving: 0, variety: 0, morale: 0, minMorale: 0, emergency: 0 };
  const coinAt = [];
  const snap = [];
  for (let day = 0; day < YEARS * YD; day++) {
    if (day % 30 === 0) for (const m of s.members) { if (m.appr) (seen.appr ||= new Set()).add(seed + ':' + m.id); if ((m.apprDone || []).length) (seen.apprDone ||= new Set()).add(seed + ':' + m.id); if (m.lean) { (seen.lean ||= new Map()).set(seed + ':' + m.id, m.lean.length); } } // R35
    if (day % YD === 0 && day) for (const o of E.living(s)) if (o.cls && E.isAdult(o)) { const c = E.findId(D.classes, o.cls); const t = E.tierN(c); const k = seed + ':' + o.id; const ft = (seen.firstTier ||= {}); for (let n = 2; n <= t; n++) if (!(ft[n] ||= {})[k]) ft[n][k] = day / YD; if (process.env.TIERDBG) console.error('Y' + day / YD, o.name, o.cls, 'Lv' + E.level(o), o.guild ? o.guild.id + ' r' + o.guild.rank + ' rep' + o.guild.rep : 'noguild', 'coin' + Math.round(s.res.coin), '|', E.classStuck(s, o), '| top', Object.entries(o.skills).sort((a, b) => b[1].lvl - a[1].lvl).slice(0, 5).map(([k, v]) => k + v.lvl).join(' ')); }
    if ([2, 5, 10].includes(day / YD) || day === YEARS * YD - 1) ((seen.early ||= {})[seed] ||= []).push([Math.round(day / YD), Math.round(s.res.coin), Math.round(s.res.food), s.structures.length, s.minions.length, Math.round(E.legacyState(s).renown)]); // R37 growth
    if (day % 30 === 0) for (const m of s.members) for (const id of (m.talents || {}).own || []) ((seen.tal ||= {})[seed] ||= new Set()).add(m.id + ':' + id); // R36
    if (process.env.BRANCH && day % 30 === 3) for (const b of E.openBranches(s)) if (b.lock !== "race") E.chooseBranch(s, b.id, seed % 2 ? "a" : "b"); // R60 branch bot: odd seeds side A
    E.advanceReal(s, T.secPerDayActive / E.globalTick(s));
    if (s.gameOver) {
      if (process.env.DBG) console.log("GAMEOVER", day, s.log.slice(0, 6).map(l => l.msg).join(" | "));
      for (const a of Object.keys(s.ach || {})) seen.ach.add(a);
      s = bonus(E.newLineage(s, 1e12));
      lineages++;
      continue;
    }
    if (process.env.YDBG && day % 180 === 0) { const mm = E.active(s); console.error("Y", day, mm && E.ageY(mm).toFixed(1), mm && mm.spouse, s.suitors.map(x => Math.round(x.affinity)).join("/"), JSON.stringify(mm && mm.action).slice(0, 80), E.tutActive(s) && E.tutCurrent(s).id); }
    if (process.env.MDBG && day === 35 * YD) console.error('MDBG', seed, JSON.stringify(s.structures.filter(x => ['barracks', 'shrinehouse', 'magestower', 'house', 'mansion', 'fort', 'abbey', 'towerkeep'].includes(x.type)).map(x => x.type + ':up' + (x.up || 0) + ':' + (E.specialUpIssue ? E.specialUpIssue(s, x.uid) : ''))), 'house opts', JSON.stringify(s.structures.filter(x => x.type === 'house').slice(0, 1).flatMap(x => E.upgradeOptions('house').map(o => o.id + '=' + E.upgradeIssue(s, x.uid, o.id)))), 'lines', E.living(s).map(m => m.cls).join(','), 'hag', Math.max(...E.living(s).map(m => m.skills.haggling?.lvl || 0)), 'land', E.landUsed(s) + '/' + E.landSlots(s));
    if (process.env.NOASC) (s.autoOff ||= {}).ascend = true;
    if (day % 3 === 0) bot(s, E.active(s));
    if (day % 30 === 0) (famDays += E.living(s).length), famN++;
    // event counters from the log (raids, wars, elites, follower deaths, illness, handovers)
    for (const e of s.log) { if (e === lastLog.get(s)) break; for (const [k, re] of EVT) if (re.test(e.msg)) evt[k] = (evt[k] || 0) + 1; }
    lastLog.set(s, s.log[0]);
    if (LG_DEED) {
      const n0 = deedSeen.get(s) || 0, cl = s.cleared || [];
      for (const id of cl.slice(n0)) { const g = Math.round(D.legacy.renown.dungeonTier[D.dungeons.find(d => d.id === id).deedTier || 1] * LG_DEED); s.legacy.renown += g; s.legacy.earned += g; }
      deedSeen.set(s, cl.length);
    }
    {
      const y = +(day / YD).toFixed(1), at = k => timing[k] == null && (timing[k] = y);
      if (s.structures.length) at("firstBuilding");
      if (s.union) for (let i = 1; i <= (s.union.tier | 0); i++) at("hall" + i);
      { const st = E.estateStage(s), order = D.estate.stages.map(x => x[1]); for (const n of order.slice(1, order.indexOf(st) + 1)) at("stage_" + n); at("phase_" + E.era(s).name);
        const sc = Object.values(s.buildings).reduce((x, b) => x + b, 0) + s.structures.reduce((x, q) => x + E.structDef(q.type).slots / 2 + q.pieces.length, 0); maxScore = Math.max(maxScore, sc); for (const n of [10, 20, 30, 45, 60, 80, 100, 130]) if (sc >= n) at("score" + n); }
      for (const t of ["cabin", "house", "hall", "smithy", "warehouse"]) if (s.structures.some(x => x.type === t || E.structDef(x.type).upgradeFrom === t)) at(t);
      if (s.structures.some(x => E.structDef(x.type).upgradeFrom)) at("firstUpgrade");
      if (E.landUsed(s) >= E.landSlots(s) && !D.estate.lands.some(l => !s.land.includes(l.id))) at("landCap");
      for (const id of s.cleared || []) at("clear_" + id);
      if (s.village) at("charter"), at("village_" + E.villageTier(s).name);
      const vb = s.structures.filter(E.isVillage).length;
      if (vb) at("villageBuilding1"); if (vb >= 5) at("villageBuildings5"); if (vb >= 8) at("villageBuildings8");
      if (s.structures.some(x => ["mansion", "fort", "towerkeep", "abbey"].includes(x.type))) at("manorLine");
      for (const r of [100, 500, 1000, 3000]) if (s.renown >= r) at("renown" + r);
      const a = E.active(s);
      if (a && a.id !== lastHeir) { if (lastHeir != null) gens.push([y, Math.round(s.renown)]); lastHeir = a.id; }
      const dead = s.members.filter(x => x.alive === false && !x.marriedOut).length;
      if (dead < deadSeen) deadSeen = 0;
      if (dead > deadSeen) { for (const x of s.members.filter(x => x.alive === false && !x.marriedOut).slice(deadSeen)) deaths.push([y, Math.round(E.ageY(x))]); deadSeen = dead; }
    }
    if (process.env.FDBG && day % 720 === 0 && s.meal)
      console.log("FOOD", day, "alive", E.living(s).length, "min", s.minions.length, "need", s.meal.need.toFixed(1), "ratio", s.meal.ratio.toFixed(2), "food", Math.round(s.res.food), "cap", E.foodCap(s), "coin", Math.round(s.res.coin), "structs", s.structures.map(x => x.type).join("/"));
    if (process.env.DBG && day % 1800 === 0) {
      const m = E.active(s);
      console.log(
        JSON.stringify(s.tut),
        s.doneQuests.includes("rats"),
        day,
        s.day,
        m && m.alive,
        m && E.ageY(m),
        JSON.stringify(m && m.action),
        s.res.coin | 0,
        s.log[0] && s.log[0].msg,
      );
    }
    const m = E.active(s);
    if (m && !m.action && !m.injured && E.isAdult(m)) idleDays++;
    if (day % 10 === 0) check(s, seed);
    if (day % 30 === 0) botEquip(s); // a player equips by hand (no Armory needed)
    if (day % 10 === 0) { // gear probe: when Auto Equip unlocks, how geared the best member is
      if (s._armoryDay == null && E.autoEqUnlocked(s, "gear")) s._armoryDay = day;
      const best = E.living(s).filter(E.isAdult).sort((a, b) => E.cp(s, b) - E.cp(s, a))[0];
      if (best) { s._bestCp = Math.max(s._bestCp || 0, E.cp(s, best)); if (day % 3600 === 0) (s._cpYears = s._cpYears || []).push(E.cp(s, best) + "/" + Object.keys(best.equip || {}).length); }
    }
    { const pn = E.era(s).n; if (phaseDay[pn] == null) phaseDay[pn] = s.day; for (const r of [1000, 2000, 5000]) if (s.renown >= r && phaseDay['renown' + r] == null) phaseDay['renown' + r] = s.day; if (['Manor', 'Prosperous Estate'].includes(E.estateStage(s)) && phaseDay.manor == null) phaseDay.manor = s.day; if (E.estateStage(s) === 'Prosperous Estate' && phaseDay.prosp == null) phaseDay.prosp = s.day; if (pn < 3 && Object.values(s.houses || {}).some(h => h.state !== 'peace')) bad(seed, s.day, 'feud/war before the Dynasty phase'); }
    {
      const gy = s.structures.find(x => x.type === "graveyard"), le = s.legacy.earned, at = k => timing[k] == null && (timing[k] = +(day / YD).toFixed(1));
      if (gy) at("graveyard");
      if (gy && gy.up) at("walls");
      if (le >= 80) at("autoTend1"), (timing.lines1 ??= lineages);
      if (le >= 1240) at("autoTendAll"), (timing.linesAll ??= lineages);
      if (le >= 900) at("atBundle1"); if (le >= 3400) at("atBundle2");
      if (E.mountTier && E.mountTier(s)) at("mount"); if (s.eg && Object.keys(s.eg.quarries).length) at("quarry"); if (s.eg && s.eg.defs.wall) at("wall"); if (s.eg && s.eg.funded.length) at("patron");
      if (le >= 1240 + D.legacy.upgrades.find(u => u.id === "tithe").tiers.reduce((x, y) => x + y.cost, 0)) at("autoTendAllTithe");
      if (le >= 500) at("legacy500"); for (const n of [700, 800, 900, 1000]) if (le >= n) at("legacy" + n);
    }
    if (s.suitors.length) noSuitor.cur = 0;
    else noSuitor.max = Math.max(noSuitor.max, ++noSuitor.cur);
    if (s.meal && day > YD * 2) {
      food.days++;
      if (s.meal.short > 0.01) food.short++;
      if (s.meal.short > 0.5) {
        food.starving++;
        const last = food.spans[food.spans.length - 1];
        if (last && last.to === day - 1) last.to = day;
        else if (food.spans.length < 6)
          food.spans.push({ from: day, to: day, lineage: lineages, alive: E.living(s).length, minions: s.minions.length, structs: s.structures.length });
      }
      if (s.meal.emergency && s.meal.emergency.length) food.emergency++;
      food.variety += s.meal.variety;
      food.morale += s.morale;
      food.minMorale = Math.min(food.minMorale, s.morale);
    }
    for (const q of s.doneQuests) seen.quests.add(q);
    for (const e of s.wevents) seen.events.add(e.type);
    for (const id of s.vault) if (id.startsWith("c|")) seen.recipes.add(id.split("|")[1]);
    peakCoin = Math.max(peakCoin, s.res.coin);
    if (process.env.METRICS) { const yy = Math.floor(day / YD), c0 = globalThis.__pc ?? s.res.coin, d = s.res.coin - c0; globalThis.__pc = s.res.coin; const I = (globalThis.__inc ||= []); if (d > 0) I[yy] = (I[yy] || 0) + d; } // R75 paired-sim metric: gross daily coin gain per year (only when METRICS=<file>)
    if (process.env.DBGS && day % (YD * 5) === 0) console.log("DBG", day / YD, Math.round(s.res.coin), E.daysOfStock(s), s.minions.map(x => x.job).join(","), E.stalls(s), s.structures.map(x => E.placeIssue(s, x.uid, "stablestall")).join("|"));
    if (day % (YD * 10) === 0) coinAt.push(Math.round(s.res.coin));
    if (day % (YD * 10) === 0) snap.push([Math.round(s.renown), (s.minions || []).length, (s.structures || []).length]);
    for (const x of E.living(s)) if (x.action && x.action.load && Object.values(x.action.load).reduce((a, b) => a + b, 0) > E.haulTier(s).carry * 1.01 + 1) bad(seed, day, "trip load over haul cap");
    for (const mi of s.minions) if (mi.trip && mi.trip.load && Object.values(mi.trip.load).reduce((a, b) => a + b, 0) > E.haulTier(s).carry * 1.01 + 1) bad(seed, day, "follower load over haul cap");
    for (const [k, v] of Object.entries(s.nodeStock || {})) if (!(v >= 0)) bad(seed, day, "node stock negative " + k);
    if (day % 30 === 0) {
      const gens = E.familyTree(s).length;
      maxGen = Math.max(maxGen, gens);
    }
    // migration round trip mid-game
    if (day === YD * 50) {
      const code = E.exportCode(s);
      const r = E.importSave(code);
      const a = JSON.parse(E.serialize(s, 1)),
        b = JSON.parse(E.serialize(r, 1));
      delete a._norm;
      delete b._norm;
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        bad(seed, day, "export/import round trip changed state");
        console.log(
          "  LOG",
          JSON.stringify(a.log.slice(0, 2)),
          "→",
          JSON.stringify(b.log.slice(0, 2)),
          a.chronicle.length,
          b.chronicle.length,
        );
        for (const k of new Set([...Object.keys(a), ...Object.keys(b)]))
          if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) {
            if (Array.isArray(a[k]))
              a[k].forEach((x, i) => {
                for (const f of new Set([...Object.keys(x || {}), ...Object.keys(b[k][i] || {})]))
                  if (JSON.stringify(x[f]) !== JSON.stringify((b[k][i] || {})[f]))
                    console.log(
                      "  diff",
                      k,
                      i,
                      f,
                      JSON.stringify(x[f])?.slice(0, 120),
                      "→",
                      JSON.stringify((b[k][i] || {})[f])?.slice(0, 120),
                    );
              });
            else console.log("  diff", k);
          }
      }
    }
  }
  for (const a of Object.keys(s.ach || {})) seen.ach.add(a);
  for (const id of [...s.vault, ...s.members.flatMap(m => Object.values(m.equip || {})), ...(s.minions || []).flatMap(x => Object.values(x.equip || {}))]) if (!E.itemDef(id)) bad(seed, s.day, 'unloadable item ' + id);
  for (const o of s.members.filter(x => x.alive !== false)) {
    if (o.prof) bad(seed, s.day, 'old m.prof survived migration ' + o.name);
    const ps = E.memberPaths(o);
    for (const e of ps) if (e.rank > E.pathCap(o, e) || (e.spec && e.srank > e.rank)) bad(seed, s.day, 'path rank over its cap ' + o.name + ' ' + e.id);
  }
  for (const mi of s.minions || []) {
    if ((mi.pending || []).length > D.minions.milestones.maxPending) bad(seed, s.day, 'pending upgrades over cap ' + mi.name);
    for (const sl of Object.keys(mi.equip || {})) if (!E.minionSlots(mi).includes(sl)) bad(seed, s.day, 'follower gear in a locked slot ' + sl);
    if ((mi.lvl || 1) >= D.minions.milestones.every && !(mi.ups || []).length && !(mi.pending || []).length) bad(seed, s.day, 'missing milestone ' + mi.name);
  }
  for (const j of s.enchants || []) if (s.day - j.start > 365) bad(seed, s.day, 'enchant job stuck ' + j.item);
  for (const st of s.structures) if (E.freeSlots(s, st) < 0) bad(seed, s.day, 'over-full building ' + st.type);
  for (const [id, l] of Object.entries((s.intros || {}).lines || {})) if (!['active', 'done', 'skipped'].includes(l.state)) bad(seed, s.day, 'bad intro state ' + id);
  if (noSuitor.max > YD * 2) bad(seed, s.day, `no suitors for ${noSuitor.max} days (marriage soft-lock)`);
  if (food.starving > food.days * 0.02) bad(seed, s.day, `starvation on ${food.starving}/${food.days} days`);
  const ip = E.timers(s);
  report.push({
    seed,
    lineages,
    maxGen,
    members: s.members.length,
    minions: s.minions.length,
    structs: s.structures.length,
    peakCoin: Math.round(peakCoin),
    coinEvery10y: coinAt.join(","),
    qRuns: s.qRuns || {}, // R86 quest spread
    boards: JSON.stringify({ ...(s.boardStats || {}), lines: Object.entries(s.lines || {}).filter(([, v]) => v.done).map(([k, v]) => k + "@y" + Math.round((v.doneDay || 0) / YD)) }),
    r49: JSON.stringify({ ...(seen.r49 || {}), jobs: s.doneQuests.filter(q => q.startsWith("q_salt")).length, saltRuns: Object.entries(s.qRuns || {}).filter(([k]) => k.startsWith("q_salt")).reduce((a, [, v]) => a + v, 0), chain: E.questChainStep(s, "reef"), pick: E.choiceMade(s, "reef"), beats: ["b_bell", "b_vaelsmugglers"].filter(q => s.doneQuests.includes(q)), routes: s.ferryRoutesUsed || {}, shore: E.explored(s, "a_saltshore"), strand: E.explored(s, "a_strand"), grotto: (s.cleared || []).includes("d_grotto") ? "cleared" : E.dungeonIssue(s, E.living(s).find(o => o.id === s.activeId) || E.living(s)[0], D.dungeons.find(d => d.id === "d_grotto")) || "open", swWhy: E.hasStructType(s, "saltworks") ? null : E.structIssue(s, "saltworks"), vatWhy: (seen.r49 || {}).kelpvat ? null : [...new Set(s.structures.map(st => E.placeIssue(s, st.uid, "kelpvat")))].slice(0, 3).join("/"), fert: s.fert || null, kelpfert: Math.round(s.res.kelpfert || 0), gilmane: E.tierOf(s, "gilmane"), gilSteps: s.doneQuests.filter(q => q.startsWith("ht_gilmane")).length, brewBought: seen.brew || {}, reefWhy: ["reef2", "reef3", "reef4"].map(id => { const q = D.quests.find(x => x.id === id), w = E.living(s).find(o => o.id === (seen.r48 || {}).hand) || E.living(s)[0]; return id + ":" + (s.doneQuests.includes(id) ? "done" : !E.questVisible(s, q) ? "hidden" : E.questIssue(s, w, q) || (q.cp > E.cp(s, w) * 1.1 ? "cp " + Math.round(E.cp(s, w)) : "ok")); }).join(","), ale: Math.round(s.res.ale || 0), brewery: (s.structures || []).some(st => st.type === "brewery" || String(st.id).startsWith("brewery")), barley: Math.round(s.res.barley || 0), tob: ((s.req || {}).tobiah || {}).n || 0, merrow: ((s.req || {}).merrow || {}).n || 0, hask: ((s.req || {}).hask || {}).n || 0, kelda: ((s.req || {}).kelda || {}).n || 0, boons: s.boons || [], reefgold: Math.round(s.res.reefgold || 0), seatouched: E.living(s).filter(o => (o.traits || []).includes("seatouched")).length }),
    r48: JSON.stringify({ ...(seen.r48 || {}), visited: s.townsVisited || [], ferry: (s.unlocks || []).includes("ferry:gullport"), ferryTrips: s.ferryTrips || 0, beat: s.doneQuests.includes("b_lights"), gullQuests: s.doneQuests.filter(q => q.startsWith("q_gull")).length, gullRuns: Object.entries(s.qRuns || {}).filter(([k]) => k.startsWith("q_gull")).reduce((a, [, v]) => a + v, 0), gullReqs: ["odile", "pell", "merrow"].map(n => ((s.req || {})[n] || {}).n || 0), threads: s.threads || [], threadSteps: s.doneQuests.filter(q => q.startsWith("ht_")).length, tiers: Object.fromEntries(E.houseList().map(h => [h.id, E.tierOf(s, h.id)])), salted: Math.round(s.res.saltedfish || 0), rope: Math.round(s.res.rope || 0), deepsea: !!E.hasSeaBoat(s) }),
    r47: JSON.stringify({ second: seen.second || null, archMembers: E.living(s).filter(o => (o.guild && o.guild.id === "architects") || (o.guild2 && o.guild2.id === "architects")).map(o => [o.cls, o.class2]), buildSaved: Math.round(s.buildSaved || 0), disc: Object.fromEntries(((D.guilds.build || {}).tags || []).map(k => [k, E.buildDisc ? +E.buildDisc(s, k).toFixed(2) : 0]).filter(([, v]) => v > 0)), roads: s.roads || null, unlocks: (s.unlocks || []).filter(u => /^(piece|structure|upgrade):|r_g_square/.test(u)) }),
    tiers: JSON.stringify({ ups: seen.tierUps || 0, firstTier: Object.fromEntries(Object.entries(seen.firstTier || {}).map(([n, o]) => [n, Object.values(o).sort((a, b) => a - b)])), classes: E.living(s).map(o => o.cls).filter(Boolean), chainUnlocks: (s.unlocks || []).filter(u => /^recipe:r_g_/.test(u)) }),
    snap, // [renown, followers, buildings] at years 0,10,20,30
    idleAdultDays: idleDays,
    armoryDay: s._armoryDay ?? -1,
    dragonTries: (s._drag || []).join(" "),
    bestCp: s._bestCp || 0,
    cpEvery10y: (s._cpYears || []).join(" "),
    renown: Math.round(s.renown),
    legacyRenown: Math.round(s.legacy?.renown || 0),
    ach: Object.keys(s.ach || {}).length,
    timers: ip.length,
    legacyUps: JSON.stringify(s.legacy?.ups || {}),
    houses: Object.fromEntries(Object.entries(s.houses || {}).map(([k, h]) => [k, `${Math.round(h.r)}/${E.tierOf(s, k)}${h.state !== "peace" ? "/" + h.state : ""}`])),
    marriages: s.members.filter(x => x.persona).length,
    marriedOut: s.members.filter(x => x.marriedOut).length,
    longestNoSuitorDays: noSuitor.max,
    timing,
    maxScore: Math.round(maxScore),
    wageX: Math.round(wageX),
    riskDeaths: evt.illness || 0, evt, famSize: E.living(s).length, avgFam: Math.round(famDays / Math.max(1, famN) * 10) / 10,
    wagesNow: E.monthlyWages(s),
    villageBuildings: s.structures.filter(E.isVillage).length,
    relocated: s.structures.filter(x => E.isVillage(x) && !E.structDef(x.type).villageOnly).length,
    gens,
    deaths,
    legacyEarned: s.legacy.earned,
    tithed: s.tithed || 0,
    phaseYear: Object.fromEntries(Object.entries(phaseDay).map(([k, d]) => [k, +(d / YD).toFixed(1)])),
    paths: (() => {
      const o = {};
      for (const m of s.members) for (const e of E.memberPaths(m)) o[e.id] = Math.max(o[e.id] || 0, e.rank);
      return o;
    })(),
    pathXp: s.members.filter(m => m.alive !== false).flatMap(m => E.memberPaths(m).map(e => e.id + ':' + Math.round(e.xp) + '/L' + Math.max(...E.pathDef(e.id).skills.map(k => m.skills[k].lvl)))),
    pathSpecs: s.members.flatMap(m => E.memberPaths(m).filter(e => e.spec).map(e => e.spec)),
    minionUps: (s.minions || []).reduce((a, mi) => a + (mi.ups || []).length, 0),
    fullSetFollowers: (s.minions || []).filter(mi => E.setProgress(mi.equip).some(p => p.n >= 4)).length,
    sets: s.vault.concat(s.members.flatMap(m => Object.values(m.equip || {}))).filter(id => (E.itemDef(id) || {}).set).length,
    enchanted: s.vault.concat(s.members.flatMap(m => Object.values(m.equip || {}))).filter(id => String(id).includes('#')).length,
    intros: Object.fromEntries(Object.entries((s.intros || {}).lines || {}).map(([k, l]) => [k, l.state])),
    food: {
      shortDays: food.short,
      starvingDays: food.starving,
      emergencyDays: food.emergency,
      avgVariety: +(food.variety / Math.max(1, food.days)).toFixed(2),
      avgMorale: +(food.morale / Math.max(1, food.days)).toFixed(2),
      minMorale: +food.minMorale.toFixed(2),
      menuAtEnd: (s.meal || {}).menu,
      starvingSpans: food.spans,
    },
  });
}
// starter check: a brand-new founder doing only Chores (no estate, no shopping) for 5 years must not starve
{
  let sd = 7;
  E.setRng(() => ((sd = (sd * 16807) % 2147483647), sd / 2147483647));
  const s = E.newGame(1e12);
  E.skipTutorial && E.skipTutorial(s);
  let starving = 0;
  for (let d = 0; d < YD * 5 && !s.gameOver; d++) {
    const m = E.active(s);
    if (m && (!m.action || m.action.target !== "chores") && E.ageY(m) >= 6) E.setAction(s, { type: "activity", target: "chores" });
    E.advanceReal(s, T.secPerDayActive / E.globalTick(s));
    if (s.meal && s.meal.short > 0.5) starving++;
  }
  report.push({ starterChores5y: { starvingDays: starving, food: Math.round(s.res.food), morale: +(s.morale || 0).toFixed(2) } });
  if (starving > 0) bad("starter", s.day, `idle starter family starved ${starving} days`);
}
console.log(JSON.stringify(report, null, 1));
const never = (all, set) => all.filter(x => !set.has(x));
console.log(
  "never achieved:",
  JSON.stringify({
    ach: never(
      D.achievements.map(a => a.id),
      seen.ach,
    ),
    structs: never(STRUCTS, seen.structs),
    legacy: never(
      D.legacy.upgrades.map(u => u.id),
      seen.legacy,
    ),
    events: never(
      D.events.types.map(e => e.id),
      seen.events,
    ),
    guilds: never(
      (D.guilds.guilds || D.guilds).map(g => g.id),
      seen.guilds,
    ),
    quests: D.quests.length - seen.quests.size + "/" + D.quests.length,
  }),
);
console.log(
  "coin by day hook (all seeds):",
  JSON.stringify(Object.fromEntries(Object.entries(coinBy).map(([k, v]) => [k, Math.round(v)]))),
);
console.log("house quests taken:", seen.houseQuests.size, "war-days seen by bot:", seen.wars * 3);
console.log("paths opened:", seen.pathOpens, "specialties:", seen.specs, "combos:", seen.combos, "enchant jobs started by bot:", seen.enchants, "set pieces worn:", seen.setWorn, "set crafts:", seen.setCrafts, "evolutions:", seen.evolves, "manual picks:", seen.picks);
console.log("R41 animal buys:", JSON.stringify(seen.animalBuys || {}));
console.log("R401 teamster buys:", JSON.stringify(seen.teamBuys || []));
console.log("map: animals bought", seen.animals, "noderun assigns", seen.noderuns, "parcel work", seen.parcels, "cart crafts", seen.haulCrafts, "convoy trips (max/seed)", seen.convoyTrips, "herd days", seen.herdDays, "max carry", seen.maxCarry, "fog charted", Math.round((lastS ? E.fogPct(lastS) : 0) * 100) + "%");
console.log("encounters prompted:", seen.enc, "crafted bases:", [...seen.recipes].join(","));
console.log("R35 apprentices placed:", (seen.appr || new Set()).size, "finished:", (seen.apprDone || new Set()).size, "members with leans:", (seen.lean || new Map()).size, "two leans:", [...(seen.lean || new Map()).values()].filter(x => x === 2).length);
console.log("R36 talents earned per seed:", JSON.stringify(Object.fromEntries(Object.entries(seen.tal || {}).map(([k, v]) => [k, v.size]))), "by talent:", JSON.stringify([...Object.values(seen.tal || {})].flatMap(v => [...v]).reduce((a, x) => ((a[x.split(":")[1]] = (a[x.split(":")[1]] || 0) + 1), a), {})));
console.log("R37 early [year, coin, food, structs, minions, legacyRenown]:", JSON.stringify(seen.early || {}));
if (process.env.SAVESIZE && lastS) { const j = E.serialize(lastS), c = E.exportCode(lastS); console.log("SAVESIZE json", j.length, "exportCode", c.length, "years", (lastS.day / YD).toFixed(1), "members", lastS.members.length, "log", (lastS.log || []).length, "chron", (lastS.chron || []).length); fs.writeFileSync("/tmp/longsave.json", j); }
console.log("R40 fields:", JSON.stringify(seen.fields || null));
console.log("ISSUES", issues.length, JSON.stringify(issues, null, 1));
if (process.env.METRICS) fs.appendFileSync(process.env.METRICS, JSON.stringify({ seed: process.env.SEED, hall: seen.hall || [], inc: (globalThis.__inc || []).map(x => Math.round(x || 0)), renown: lastS ? Math.round(lastS.renown) : null, followers: lastS ? lastS.minions.length : null, coin: lastS ? Math.round(lastS.res.coin) : null, pile: lastS ? Object.values(E.fieldsState(lastS).pile).reduce((a, v) => a + v, 0) : null, union: lastS ? lastS.union || null : null }) + "\n");
fs.writeFileSync("/tmp/longsim.json", JSON.stringify({ report, issues }, null, 1));
