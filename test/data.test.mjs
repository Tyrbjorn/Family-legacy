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
["wood", "stone", "ore", "copperore", "meat", "hides", "fish", "herbs", "sage", "mandrake", "moonpetal"].forEach(k =>
  src.add(k),
); // minion jobs
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
console.log(pass + " data checks passed" + (fail ? `, ${fail} FAILED` : ""));
if (fail) process.exit(1);
