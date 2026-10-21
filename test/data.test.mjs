// Data integrity: every reference points at something that exists, and every material is obtainable.
import fs from "fs";
import * as E from "../js/engine.js";
const root = new URL("..", import.meta.url).pathname;
const D = {};
for (const f of fs.readdirSync(root + "data").filter(f => f.endsWith(".json")))
  D[f.replace(".json", "")] = JSON.parse(fs.readFileSync(root + "data/" + f));
for (const f of D.estate.structureFiles) D["structures/" + f] = JSON.parse(fs.readFileSync(root + "data/structures/" + f + ".json"));
E.setData(D);
let pass = 0,
  fail = 0;
const ok = (c, m) => (c ? pass++ : (fail++, console.log("FAIL " + m)));
const skills = new Set(D.skills.map(x => x.id)),
  items = new Set(D.items.map(x => x.id)),
  classes = new Set(D.classes.map(x => x.id)),
  guilds = new Set(D.guilds.guilds.map(g => g.id)),
  pieces = new Set(D.estate.pieces.map(p => p.id)),
  regions = new Set(D.regions.map(r => r.id));
for (const c of D.classes) {
  for (const k of Object.keys(c.req || {})) ok(skills.has(k), `class ${c.id} req skill ${k}`);
  if (c.from) ok(classes.has(c.from), `class ${c.id} from ${c.from}`);
  if (c.guild) ok(guilds.has(c.guild), `class ${c.id} guild ${c.guild}`);
}
for (const g of D.guilds.guilds)
  for (const k of Object.keys(g.req.skills || {})) ok(skills.has(k), `guild ${g.id} skill ${k}`);
for (const q of D.quests) {
  ok(regions.has(q.region), `quest ${q.id} region`);
  ok(skills.has(q.skill), `quest ${q.id} skill ${q.skill}`);
  for (const id of q.loot || []) ok(items.has(id), `quest ${q.id} loot ${id}`);
  if (q.guild) ok(guilds.has(q.guild), `quest ${q.id} guild`);
}
// story chain is contiguous
const st = D.quests
  .filter(q => q.story)
  .map(q => q.story)
  .sort((a, b) => a - b);
ok(
  st.every((n, i) => n === i + 1),
  "story chapters are 1..n",
);
for (const t of D.towns) for (const id of t.shop || []) ok(items.has(id), `town ${t.id} shop ${id}`);
for (const rc of D.crafting.recipes) {
  ok(items.has(rc.base), `recipe ${rc.id} base ${rc.base}`);
  ok(skills.has(rc.skill), `recipe ${rc.id} skill`);
  ok(rc.station === "mentor" || pieces.has(rc.station), `recipe ${rc.id} station ${rc.station}`);
}
for (const a of D.achievements) ok(a.metric && a.goal > 0, `achievement ${a.id} metric`);
for (const s of D.tutorial.steps)
  for (const id of (s.reward.items || []).concat((s.start || {}).items || []))
    ok(items.has(id), `tutorial ${s.id} item ${id}`);
for (const t of D.tutorial.tour) ok(t.tab, "tour tab");
// every recipe material / structure cost resource can be obtained somewhere
const src = new Set(["coin", "food"]);
for (const n of D.nodes) Object.keys(n.res).forEach(k => src.add(k));
for (const q of D.quests) Object.keys(q.reward).forEach(k => src.add(k));
for (const p of D.estate.pieces)
  for (const pr of [].concat((p.bonus || {}).processes || (p.bonus || {}).process || [])) src.add(pr.out);
for (const st of D.estate.structures) for (const p of st.fixed || []) src.add(p);
["wood", "stone", "ore", "copperore", "meat", "hides", "fish", "thyme", "sage", "mandrake", "moonpetal"].forEach(k =>
  src.add(k),
); // minion jobs
for (const t of D.towns) (t.market || []).forEach(k => src.add(k));
for (const f of Object.values(D.world.features)) if (f.mine) src.add(f.mine.res); // mine veins
for (const P of [...D.paths.paths, ...D.paths.comboPaths]) for (const f of [...P.fx, ...P.specs.flatMap(x => x.fx)]) if (f.kind === "find") src.add(f.res); // craft-path finds (mushrooms)
const need = new Set();
for (const rc of D.crafting.recipes) Object.keys(rc.mats).forEach(k => need.add(k));
for (const st of D.estate.structures) Object.keys(st.cost).forEach(k => need.add(k));
for (const p of D.estate.pieces) Object.keys(p.cost || {}).forEach(k => need.add(k));
for (const l of D.estate.lands) Object.keys(l.cost).forEach(k => need.add(k));
for (const k of need) ok(src.has(k), `material "${k}" has a source`);
// prices: shop items can never be resold for more than they cost (any event stack, best sell bonuses)
const S = E.newGame(1);
for (const t of D.towns) {
  E.startEvent(S, "caravan", t.id, 5);
  E.startEvent(S, "festival", t.id, 5);
}
for (const t of D.towns)
  for (const id of t.shop || []) {
    const it = E.itemDef(id);
    ok(
      E.buyPrice(it, S, t.id) > it.value * E.SELL_CAP && E.buyPrice(it, S, t.id) > it.value * D.crafting.stallSellRate,
      `no arbitrage on ${id} at ${t.id}`,
    );
  }

// food chains: every process input has a source, every menu food can be produced or bought
for (const p of D.estate.pieces)
  for (const pr of [].concat((p.bonus || {}).processes || (p.bonus || {}).process || []))
    for (const k of Object.keys(pr.in || {})) ok(src.has(k) || (k.startsWith("fish:") && D.fish.species.some(f => f.id === k.slice(5))), `process input "${k}" (${p.id}) has a source`);
for (const k of Object.keys(D.estate.meals.menu)) ok(src.has(k), `menu food "${k}" has a source`);
for (const f of ["estate", "towns", "seasons", "quests", "nodes", "events", "crafting", "tutorial"])
  ok(!/"(in|out|res|cost|mats|prices|reward)":\s*\{[^}]*"herbs"/.test(JSON.stringify(D[f])) && !/"out":"herbs"/.test(JSON.stringify(D[f])), `${f}: no generic herbs resource`);
// specific herb uses
const uses = h => D.estate.pieces.flatMap(p => [].concat(p.bonus.processes || p.bonus.process || [])).filter(pr => pr.in && pr.in[h]).map(pr => pr.out);
ok(uses("sage").includes("salves"), "sage → healing salves");
ok(uses("mandrake").includes("draught"), "mandrake → sleep/poison draughts");
ok(uses("moonpetal").includes("manatonic"), "moonpetal → mana tonic");
ok(uses("thyme").includes("stew") && uses("thyme").includes("potions"), "thyme → stew and potions");
for (const t of D.towns) for (const k of t.market || []) ok(t.prices[k] > 0, `market ${t.id} ${k} priced`);
// market resale: buying at the cheapest market town can never be resold for a profit anywhere (events stacked)
const maxEv = k => Math.max(1, ...D.events.types.map(e => ((e.effects || {}).price || {})[k] || 1)) * Math.max(1, ...D.events.types.map(e => (e.effects || {}).sellMult || 1));
for (const t of D.towns)
  for (const k of t.market || []) {
    const buy = t.prices[k] * ((D.tuning.resBuyMarkupBy || {})[k] || D.tuning.resBuyMarkup) * E.BUY_MULT_FLOOR;
    const sell = Math.max(...D.towns.map(u => u.prices[k] || 0)) * maxEv(k);
    ok(buy > sell, `no market arbitrage on ${k} at ${t.id} (${buy.toFixed(2)} > ${sell.toFixed(2)})`);
  }
// phases + unlock intros
ok(D.phases.list.map(p => p.n).join() === "1,2,3,4" && D.phases.list[3].planned, "four phases, Titles planned");
const STG = D.estate.stages.map(x => x[1]);
for (const p of D.phases.list.filter(p => p.need && !p.need.homeAndFamily)) ok(STG.includes(p.need.stage) && p.need.adults > 0, `phase ${p.id} stage exists`);
for (const [k, v] of Object.entries(D.families.gates)) if (k[0] !== "_") ok(v >= 1 && v <= 3, `gate ${k} is a built phase`);
ok(D.families.gates.feud === 3 && D.families.gates.war === 3, "feud & war are Dynasty-phase");
const TABSET = new Set(["main","family","jobs","inv","estate","map","minions","guilds","craft","chron","houses"]), IDS = new Set();
for (const l of D.intros.lines) {
  ok(!IDS.has(l.id), `intro ${l.id} unique`); IDS.add(l.id);
  ok(TABSET.has(l.tab), `intro ${l.id} tab`); ok(E.INTRO_PREDS.includes(l.when), `intro ${l.id} when`);
  ok(l.steps.length >= 1 && l.steps.length <= 3, `intro ${l.id} has 1-3 steps`);
  for (const st of l.steps) {
    ok(/^(view|flag):/.test(st.check) || E.INTRO_PREDS.includes(st.check), `intro step ${st.id} check`);
    ok(Object.keys(st.reward || {}).length && Object.values(st.reward).every(v => v > 0 && v <= 500), `intro step ${st.id} small reward`);
    if (st.check.startsWith("view:")) ok(TABSET.has(st.check.slice(5)), `intro step ${st.id} view tab`);
  }
}
// gear sets, enchanting, stations, class perks
{ const GD = D.gear, IT = new Set(D.items.map(i => i.id)), PC = new Set(D.estate.pieces.map(p => p.id)), RES = new Set([...Object.keys(D.towns[0].prices), ...D.towns.flatMap(t => Object.keys(t.prices))]);
  for (const st of GD.sets) {
    ok(st.pieces.length === 4 && st.pieces.every(p => IT.has(p) && D.items.find(i => i.id === p).set === st.id), `set ${st.id}: 4 real pieces tagged with the set`);
    ok(new Set(st.pieces.map(p => D.items.find(i => i.id === p).slot)).size === 4, `set ${st.id}: one piece per member slot`);
    ok(st.bonus["2"] && st.bonus["4"], `set ${st.id}: 2- and 4-piece bonuses`);
  }
  for (const e of GD.enchants) {
    ok(e.on.length && e.days > 0 && e.minSkill >= 0, `enchant ${e.id} fields`);
    for (const k of Object.keys(e.reagents)) ok(RES.has(k) || D.estate.pieces.some(p => JSON.stringify(p.bonus || {}).includes('"' + k + '"')), `enchant ${e.id} reagent ${k} obtainable`);
  }
  ok(D.skills.some(k => k.id === GD.enchanting.skill) && D.activities.some(a => a.skills.includes(GD.enchanting.skill)), "Enchanting skill + a themed activity");
  for (const [k, list] of Object.entries(GD.stations)) if (Array.isArray(list)) for (const st of list) ok(PC.has(st.piece) && (!st.structure || D.estate.structures.some(x => x.id === st.structure)), `station ${k}/${st.piece}`);
  for (const y of GD.stations.synergies) ok(PC.has(y.piece), `synergy piece ${y.piece}`);
  for (const p of D.estate.pieces.filter(p => p.tiers)) ok(p.tiers.length === D.estate.pieceTiers.length && p.tiers.every((t, i) => !i || (t.slots || 1) >= (p.tiers[i - 1].slots || 1)), `piece ${p.id}: tier slots never shrink`);
  for (const x of [...D.crafting.recipes, ...D.estate.pieces, ...D.estate.structures.flatMap(s => s.upgrades || [])].filter(x => x.requiresClass)) ok(D.classes.some(c => c.id === x.requiresClass), `requiresClass ${x.requiresClass} exists`);
  for (const r of D.crafting.recipes.filter(r => r.set)) ok(PC.has(r.station), `set recipe ${r.id} station`);
}
// follower milestones
{ const MS = D.minions.milestones, ids = new Set(MS.pool.map(u => u.id)), cls = new Set(D.minions.npcClasses.map(c => c.id)), slots = new Set(D.items.map(i => i.slot));
  ok(ids.size === MS.pool.length && MS.every >= 2 && MS.offer >= 2 && MS.offer <= 3, "milestone pool unique; offers 2-3");
  for (const [b, l] of Object.entries(MS.prefs)) ok(l.every(x => ids.has(x)) && D.minions.npcClasses.some(c => c.branch === b), `prefs ${b} valid`);
  for (const [c, l] of Object.entries(MS.classPrefs)) ok(cls.has(c) && l.every(x => ids.has(x)), `classPrefs ${c} valid`);
  for (const u of MS.pool.filter(u => u.kind === "slot")) ok(slots.has(u.slot) && !D.crafting.minionSlots.includes(u.slot), `slot upgrade ${u.id} adds a new slot`);
  const all = new Set([...D.crafting.minionSlots, ...MS.pool.filter(u => u.kind === "slot").map(u => u.slot)]);
  ok(["weapon", "offhand", "armor", "accessory"].every(x => all.has(x)), "followers can reach every set slot");
  for (const st of D.gear.sets) ok(st.minion["4"], `set ${st.id} has a follower 4-piece bonus`);
}
// marriage & diplomacy data
const MD = D.marriage,
  HS = new Set(D.families.list.map(h => h.id)),
  STATSET = new Set(["STR", "AGI", "INT", "VIT", "WIL", "CHA"]);
for (const p of MD.personalities) {
  ok(STATSET.has(p.likesStat), `persona ${p.id} likesStat`);
  ok(items.has(p.likesGift) || p.likesGift in D.estate.meals.menu, `persona ${p.id} likesGift ${p.likesGift} is an item or dish`);
  for (const t of p.favors) ok(D.traits.some(x => x.id === t), `persona ${p.id} favors trait ${t}`);
  ok(Object.keys(p.household).length > 0, `persona ${p.id} affects the household`);
}
for (const h of D.families.list) {
  ok(D.towns.some(t => t.id === h.town), `house ${h.id} town`);
  ok(h.wealth >= 1 && h.wealth <= 3, `house ${h.id} wealth`);
  ok(D.quests.some(q => q.house === h.id), `house ${h.id} offers a quest`);
  ok(D.quests.some(q => q.needsFeud && q.against === h.id), `house ${h.id} has a feud quest`);
}
for (const st of D.families.status) ok(D.families.tiers[st.id], `tier ${st.id} has effects`);
ok(D.families.status.every((st, i, a) => !i || st.max > a[i - 1].max), "rapport tiers ascend");
ok(D.families.feud.at <= D.families.status.find(x => x.id === "feud").max && D.families.feud.exit > D.families.feud.at, "feud thresholds");
for (const q of D.quests.filter(q => q.house || q.against)) {
  if (q.house) ok(HS.has(q.house), `quest ${q.id} house`);
  if (q.against) ok(HS.has(q.against) && q.against !== q.house, `quest ${q.id} against`);
  ok(D.map.points[q.id], `quest ${q.id} map point`);
}
ok(MD.stages[MD.stages.length - 1].at === 100 && MD.stages[0].at === 0, "courtship stages span 0..100");
if (fail) process.exit(1);

// ---- craft paths (data/paths.json)
{
  const PP = D.paths, all = [...PP.paths, ...PP.comboPaths], ids = all.map(x => x.id);
  const skillIds = new Set(D.skills.map(x => x.id)), pieceIds = new Set(D.estate.pieces.map(x => x.id));
  ok(new Set(ids).size === ids.length, "path ids unique (paths + combos)");
  ok(PP.ranks.length === 4 && PP.ranks.every((r, i) => !i || (r.xp > PP.ranks[i - 1].xp && r.skill >= PP.ranks[i - 1].skill)), "4 ranks with rising thresholds");
  ok(PP.maxPaths >= 2 && PP.secondaryGap >= 1 && PP.specAt > 0 && PP.specAt < PP.ranks.length, "path cap / gap / specAt sane");
  const KINDS = ["craft", "yield", "gather", "find", "foodQ", "cropQ", "variety", "vault", "survival", "trainXp", "enchant", "land", "blessing", "haul", "make"];
  const MGR_KINDS = ["quotaSlot", "storage", "trade", "route", "orderSlot"]; // each consumed via famFx (quotas/estate/inventory+trade/orders) or the Steward route rule
  const specIds = [];
  for (const P of all) {
    ok(P.skills.length && P.skills.every(k => skillIds.has(k)), `path ${P.id} skills real`);
    const fxs = [...P.fx, ...P.specs.flatMap(x => [...x.fx, ...((x.artisan || {}).fx || [])])]; // R47: artisan titles may carry fx
    if (P.manager) {
      // R46 manager line (Clerk): no station or craft skill, no crafting fx, 1+ specialty, estate-management fx only
      ok(!P.station && !P.craftSkill && !fxs.some(f => f.kind === "craft" || f.kind === "make"), `manager path ${P.id} has no station/craft fx`);
      ok(P.specs.length >= 1, `manager path ${P.id} offers a specialty`);
      for (const f of fxs) ok(MGR_KINDS.includes(f.kind) && f.v > 0 && (f.max === undefined || f.max >= f.v), `manager path ${P.id} fx ${f.kind} known`);
    } else {
      ok(pieceIds.has(P.station) && skillIds.has(P.craftSkill), `path ${P.id} station/craftSkill real`);
      ok(P.specs.length >= 2, `path ${P.id} offers 2+ specialties`);
      for (const f of fxs) ok(KINDS.includes(f.kind) && f.v > 0, `path ${P.id} fx ${f.kind} known`);
    }
    for (const f of P.specs.flatMap(x => x.fx)) for (const b of f.bases || []) ok(!!E.itemDef(b), `spec base ${b} exists`);
    specIds.push(...P.specs.map(x => x.id));
  }
  ok(new Set(specIds).size === specIds.length, "specialty ids unique");
  for (const C of PP.comboPaths) {
    ok(C.requires.length >= 2, `combo ${C.id} has 2+ inputs`);
    for (const q of C.requires)
      ok(q.classLine ? D.classes.some(c => c.id === q.classLine) : q.skill ? skillIds.has(q.skill) : PP.paths.some(x => x.id === q.path) && (!q.spec || PP.paths.find(x => x.id === q.path).specs.some(z => z.id === q.spec)), `combo ${C.id} input ${q.path || q.skill} real`);
  }
  for (const [k, q] of Object.entries(PP.classMap))
    ok((q.paths === "*" || q.paths.every(x => ids.includes(x))) && (!q.spec || all.some(P => P.specs.some(z => z.id === q.spec))), `classMap ${k} maps to real paths/specs`);
  for (const [k, plan] of Object.entries(PP.migrate))
    ok(plan.every(([p, r, sp]) => ids.includes(p) && PP.ranks[r] && (!sp || all.find(x => x.id === p).specs.some(z => z.id === sp))) && plan.slice(1).every(([p, r]) => all.find(x => x.id === p).comboPaths || PP.comboPaths.some(c => c.id === p) || r <= plan[0][1] - PP.secondaryGap), `migrate ${k} valid and within secondary caps`);
  ok(PP.comboPaths.every(C => C.requires.some(q => q.path === "scribe")), "every combo needs Scribe");
  ok(PP.comboPaths.find(C => C.id === "artificer").requires.some(q => q.classLine === "apprentice") && PP.comboPaths.find(C => C.id === "battlesmith").requires.some(q => q.classLine === "fighter"), "class-gated combos (Artificer mage line, Battle Smith warrior line)");
  ok(!D.classes.some(c => c.id === "couturier"), "Couturier dropped");
  ok(D.classes.filter(c => c.line === "artisan").every(c => c.retired), "old crafter classes retired");
  const rcs = D.crafting.recipes;
  for (const P of PP.paths.filter(P => !P.manager)) for (const c of PP.classLines) ok(rcs.some(r => r.path === P.id && r.forClass === c && E.itemDef(r.base)), `${P.name} has a class recipe for ${c}`);
  ok(rcs.filter(r => r.forClass).every(r => r.path && D.classes.some(c => c.id === r.forClass)), "class recipes name real path + class");
  ok(rcs.filter(r => r.path === "carpenter" && r.forClass === "hunter").length && rcs.some(r => r.path === "carpenter" && r.forClass === "apprentice" && /staff/i.test(r.name)), "Carpenter: Rangers get bows, Mages staves");
  ok(PP.paths.some(x => x.id === "woodsman") && D.estate.meals.menu.mushrooms, "Woodsman + mushrooms resource");
  ok(!PP.paths.find(x => x.id === "carpenter").specs.some(z => z.id === "shipwright") && PP.comboPaths.some(c => c.id === "shipwright"), "Shipwright moved to a combo");
  ok(PP.paths.find(x => x.id === "smithing").specs.some(z => z.id === "goldsmith") && PP.paths.find(x => x.id === "smithing").merges[0].name === "Jeweler", "Goldsmith + Gemcutter merge into Jeweler");
  ok(!PP.paths.find(x => x.id === "mason").specs.some(z => z.id === "architect"), "Architect is not a Mason specialty");
}

// ---- map round (data/world.json)
{
  const WW = D.world, TT = Object.keys(WW.terrain);
  ok(["forest", "hills", "mountains", "river", "lake", "swamp", "plains", "coast"].every(k => TT.includes(k)), "8 terrain types");
  for (const [k, t] of Object.entries(WW.terrain)) ok(t.speed > 0 && t.speed <= 1.2 && t.risk > 0 && t.discover > 0 && /^#/.test(t.fill), `terrain ${k} numbers + colour`);
  ok(WW.zones.every(z => TT.includes(z.t) && ["rect", "ellipse", "line"].includes(z.shape)), "zones use known terrain/shapes");
  ok(Object.values(WW.regionTerrain).every(t => TT.includes(t)) && D.regions.filter(r => !r.future).every(r => WW.regionTerrain[r.id]), "every live region has a default terrain");
  ok(["track", "road", "highway"].every(k => WW.roadTypes[k]) && WW.roadTypes.track.speed < WW.roadTypes.road.speed && WW.roadTypes.road.speed < WW.roadTypes.highway.speed && WW.roadTypes.highway.risk < WW.roadTypes.track.risk && WW.roadTypes.track.speed > WW.offroad.speed && WW.offroad.discover > WW.roadTypes.track.discover, "roads: faster + safer by tier; off-road discovers more");
  ok(WW.roads.every(r => WW.roadTypes[r.type] && r.pts.length >= 2 && r.pts.every(([x, y]) => x >= 0 && y >= 0 && x <= D.map.size.w && y <= D.map.size.h)), "roads valid and on the map");
  ok(WW.roadWorks && WW.roadWorks.builder.path === "mason", "road works hook (Mason) present");
  const LT = Object.keys(WW.locTypes);
  ok(["town", "village", "ruins", "cave", "shrine", "camp", "mine", "grove", "hidden", "port"].every(k => LT.includes(k)), "location types");
  ok(new Set(WW.locations.map(l => l.id)).size === WW.locations.length, "location ids unique");
  for (const l of WW.locations) ok(LT.includes(l.type) && D.regions.some(r => r.id === l.region) && (!l.town || D.towns.some(t => t.id === l.town)) && (!l.link || [...D.quests, ...D.nodes, ...D.dungeons].some(x => x.id === l.link)), `location ${l.id} valid`);
  ok(WW.locations.some(l => l.id === "l_crone" && l.hidden && l.link === "witch"), "crone/witch is a hidden place");
  ok(WW.locations.some(l => l.stub === "runecarver" && l.locked && l.hidden), "dwarven hold stub (locked, hidden)");
  ok(WW.locations.some(l => l.port && l.town && D.towns.some(t => t.id === l.town && t.port)), "R48: the port location is a real port town (Gull's Landing)");
  const secretLocs = D.map.areas.flatMap(a => a.secrets).filter(x => x.type === "location");
  ok(WW.locations.filter(l => l.hidden && !l.town && !l.link && !D.dungeons.some(d => d.reveals === l.id) && !l.revealedBy).every(l => secretLocs.some(x => x.id === l.id)) && secretLocs.every(x => WW.locations.some(l => l.id === x.id)), "hidden locations are reachable via explore secrets");
  const NN = D.nodes.filter(n => n.terrainNode);
  const want = { highlands: ["ore", "gems"], forest: ["wood", "mushrooms"], plains: ["thyme"], river: ["fish"], lake: ["fish"], swamp: ["clay", "peat"], coast: ["salt"] };
  for (const [tr, rs] of Object.entries(want)) ok(rs.every(k => NN.some(n => n.terrain === tr && n.res[k])), `terrain ${tr} has nodes for ${rs.join("/")}`);
  ok(NN.some(n => n.remote && n.hidden && n.rare), "a rare remote find");
  ok(D.nodes.every(n => TT.includes(n.terrain) && D.map.points[n.id]), "every node has a terrain and a map point");
  ok(NN.every(n => n.fog), "terrain nodes are discovered through fog");
  ok(WW.nodeDefaults.stock > 0 && WW.nodeDefaults.depleted > 0 && WW.nodeDefaults.depleted < 1 && Object.keys(WW.regrowBySeason).length === 4, "stock / depletion / seasonal regrowth numbers");
  const H = WW.haul; ok(H.tiers.length >= 4 && H.tiers.every(t => t.carry > H.base.carry && t.haulSpeed >= 1), "hauling tiers beat walking");
  ok(H.tiers.filter(t => t.item).every(t => D.items.some(i => i.id === t.item && i.slot === "haul") && D.crafting.recipes.some(r => r.base === t.item && r.path === "carpenter")), "carts/wagons crafted by Carpenter");
  ok(D.paths.paths.find(p => p.id === "carpenter").specs.some(x => /Wainwright/.test(x.name) && x.fx.some(f => (f.bases || []).includes("wagon"))), "Cooper & Wainwright specialty boosts carts/wagons");
  ok(H.tiers.filter(t => t.animal).every(t => H.animals[t.animal] && D.world.feed.kinds[t.animal] && H.animals[t.animal].towns.every(id => D.towns.some(x => x.id === id))), "animals have feed and real towns");
  ok(D.estate.pieces.some(p => p.id === H.stall && p.bonus.stalls), "stable stall piece exists");
  for (const [k, f] of Object.entries(WW.features)) ok(Object.keys(f.res).length && D.skills.some(x => x.id === f.skill) && (!f.structures || f.structures.every(st => D.estate.structures.some(x => x.id === st))), `feature ${k} valid`);
  ok(D.estate.lands.every(l => (WW.landFeatures[l.id] || []).length && WW.landFeatures[l.id].every(f => WW.features[f])), "every land parcel shows features");
  for (const [st, f] of Object.entries(WW.structureFeature)) ok([].concat(f).every(x => WW.features[x]) && D.estate.lands.some(l => [].concat(f).some(x => WW.landFeatures[l.id].includes(x))), `structure ${st} has a land with its feature`);
  ok(D.regions.every(r => r.requires) && D.regions.some(r => r.id === "saltcoast" && !r.future && r.requires.location), "regions carry unlock requirements; R49: the Saltmere Coast is open (no longer a stub)");
  const EV = D.events.types; ok(["bandits", "storm", "merchant", "lost", "monsters", "festival"].every(id => EV.some(e => e.id === id)) && EV.some(e => e.season) && EV.some(e => e.regions), "world events incl. season/region-tied ones");
  ok(EV.every(e => (e.season || []).every(x => D.seasons.order.includes(x)) && (e.regions || []).every(x => D.regions.some(r => r.id === x))), "event season/region filters valid");
  const EN = D.encounters.list; ok(["ambush", "lostsoul", "wmerchant", "sighting", "stormroad", "festband"].every(id => EN.some(e => e.id === id)), "road encounters added");
  ok(EN.every(e => !e.when || ((e.when.terrain || []).every(x => TT.includes(x)) && (!e.when.road || ["on", "off"].includes(e.when.road)) && (e.when.season || []).every(x => D.seasons.order.includes(x)))), "encounter filters valid");
  ok(EN.filter(e => e.when && e.when.road === "off").length >= 2, "off-road has its own (riskier) encounters");
  for (const k of ["gems", "clay", "peat", "salt"]) ok(D.towns.every(t => t.prices[k]), `${k} sells in towns`);
}
// R47 second guilds + Architects' Guild
{
  const G = D.guilds, BT = new Set((G.build || {}).tags || []);
  ok(G.second && G.second.capTier === 2 && G.second.repShare > 0 && G.second.repShare <= 1 && G.second.rules.every(r => ["tier3", "craftMaster"].includes(r)), "second guild config sane");
  ok(Object.entries(G.second.tradeGuild || {}).every(([p, g]) => D.paths.paths.some(x => x.id === p) && G.guilds.some(x => x.id === g && !x.open)), "second guild trade fits name real paths and sworn guilds");
  const A = G.guilds.find(g => g.id === "architects");
  ok(A && !A.open && D.towns.some(t => t.id === A.town) && D.towns.some(t => t.id === A.board) && A.path.every(id => D.classes.some(c => c.id === id)), "Architects' Guild: sworn, real seat/board towns and classes");
  ok(G.build.cap > 0 && G.build.cap <= 0.25 && BT.has(G.build.defaultTag), "build discount cap ≤25% and default tag known");
  for (const c of D.classes.filter(c => c.role && c.role.build)) ok(Object.entries(c.role.build).every(([k, v]) => (k === "all" || BT.has(k)) && v > 0 && v <= G.build.cap), `class ${c.id} build discounts use known tags, within the cap`);
  for (const [sp, x] of Object.entries(G.build.specBoost || {})) ok(D.paths.paths.some(p => p.specs.some(z => z.id === sp)) && x.tags.every(k => BT.has(k)), `spec boost ${sp} real`);
  for (const f of D.estate.structureFiles) for (const d of D["structures/" + f] || []) if (d.tag) ok(BT.has(d.tag), `structure ${d.id} tag ${d.tag} known`);
  for (const ch of Object.values(G.chains)) for (const st of ch) for (const u of st.unlock || []) ok(E.unlockReal(u), `chain unlock ${u} real`);
  for (const d of D.estate.structures.filter(d => d.needsUnlock)) ok(Object.values(G.chains).flat().some(st => (st.unlock || []).includes(d.needsUnlock)), `structure ${d.id} unlock is granted by a chain`);
  for (const p of D.estate.pieces.filter(p => p.unlock && p.unlock.key)) ok(Object.values(G.chains).flat().some(st => (st.unlock || []).includes(p.unlock.key)), `piece ${p.id} unlock is granted by a chain`);
  for (const c of D.classes.filter(c => c.comboCut)) ok(D.paths.comboPaths.some(x => x.id === c.comboCut.path) && c.comboCut.by > 0, `class ${c.id} combo cut names a real combo path`);
  ok(D.legacy.familyAuto.tracks.architects.every(k => D.skills.some(x => x.id === k)), "Architects' track skills real");
  const RW = D.world.roadWorks; ok(RW && ["track", "road"].every(k => RW.build[k] && RW.max[k] > 0 && RW.fx[k] > 0), "road works data complete");
}
console.log(pass + " data checks passed" + (fail ? `, ${fail} FAILED` : ""));
if (fail) process.exit(1); // any failure fails the run (was first-half only)
