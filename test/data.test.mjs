// Data integrity: every reference points at something that exists, and every material is obtainable.
import fs from "fs";
import * as E from "../js/engine.js";
const root = new URL("..", import.meta.url).pathname;
const D = {};
for (const f of fs.readdirSync(root + "data"))
  D[f.replace(".json", "")] = JSON.parse(fs.readFileSync(root + "data/" + f));
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
    for (const k of Object.keys(pr.in || {})) ok(src.has(k), `process input "${k}" (${p.id}) has a source`);
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
for (const p of D.phases.list.filter(p => p.need && !p.need.homeAndFamily)) ok(STG.includes(p.need.stage) && p.need.renown > 0, `phase ${p.id} stage exists`);
for (const [k, v] of Object.entries(D.marriage.houses.gates)) if (k[0] !== "_") ok(v >= 1 && v <= 3, `gate ${k} is a built phase`);
ok(D.marriage.houses.gates.feud === 3 && D.marriage.houses.gates.war === 3, "feud & war are Dynasty-phase");
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
  HS = new Set(MD.houses.list.map(h => h.id)),
  STATSET = new Set(["STR", "AGI", "INT", "VIT", "WIL", "CHA"]);
for (const p of MD.personalities) {
  ok(STATSET.has(p.likesStat), `persona ${p.id} likesStat`);
  ok(items.has(p.likesGift) || p.likesGift in D.estate.meals.menu, `persona ${p.id} likesGift ${p.likesGift} is an item or dish`);
  for (const t of p.favors) ok(D.traits.some(x => x.id === t), `persona ${p.id} favors trait ${t}`);
  ok(Object.keys(p.household).length > 0, `persona ${p.id} affects the household`);
}
for (const h of MD.houses.list) {
  ok(D.towns.some(t => t.id === h.town), `house ${h.id} town`);
  ok(h.wealth >= 1 && h.wealth <= 3, `house ${h.id} wealth`);
  ok(D.quests.some(q => q.house === h.id), `house ${h.id} offers a quest`);
  ok(D.quests.some(q => q.needsFeud && q.against === h.id), `house ${h.id} has a feud quest`);
}
for (const st of MD.houses.status) ok(MD.houses.tiers[st.id], `tier ${st.id} has effects`);
ok(MD.houses.status.every((st, i, a) => !i || st.max > a[i - 1].max), "rapport tiers ascend");
ok(MD.houses.feud.at <= MD.houses.status.find(x => x.id === "feud").max && MD.houses.feud.exit > MD.houses.feud.at, "feud thresholds");
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
  const KINDS = ["craft", "yield", "gather", "find", "foodQ", "cropQ", "variety", "vault", "survival", "trainXp", "enchant", "land", "blessing"];
  const specIds = [];
  for (const P of all) {
    ok(P.skills.length && P.skills.every(k => skillIds.has(k)), `path ${P.id} skills real`);
    ok(pieceIds.has(P.station) && skillIds.has(P.craftSkill), `path ${P.id} station/craftSkill real`);
    ok(P.specs.length >= 2, `path ${P.id} offers 2+ specialties`);
    for (const f of [...P.fx, ...P.specs.flatMap(x => x.fx)]) ok(KINDS.includes(f.kind) && f.v > 0, `path ${P.id} fx ${f.kind} known`);
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
  for (const P of PP.paths) for (const c of PP.classLines) ok(rcs.some(r => r.path === P.id && r.forClass === c && E.itemDef(r.base)), `${P.name} has a class recipe for ${c}`);
  ok(rcs.filter(r => r.forClass).every(r => r.path && D.classes.some(c => c.id === r.forClass)), "class recipes name real path + class");
  ok(rcs.filter(r => r.path === "carpenter" && r.forClass === "hunter").length && rcs.some(r => r.path === "carpenter" && r.forClass === "apprentice" && /staff/i.test(r.name)), "Carpenter: Rangers get bows, Mages staves");
  ok(PP.paths.some(x => x.id === "woodsman") && D.estate.meals.menu.mushrooms, "Woodsman + mushrooms resource");
  ok(!PP.paths.find(x => x.id === "carpenter").specs.some(z => z.id === "shipwright") && PP.comboPaths.some(c => c.id === "shipwright"), "Shipwright moved to a combo");
  ok(PP.paths.find(x => x.id === "smithing").specs.some(z => z.id === "jeweler"), "Jeweler is a Smithing specialty");
  ok(!PP.paths.find(x => x.id === "mason").specs.some(z => z.id === "architect"), "Architect is not a Mason specialty");
}
console.log(pass + " data checks passed" + (fail ? `, ${fail} FAILED` : ""));
