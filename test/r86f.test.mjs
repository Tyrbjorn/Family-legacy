// R86f: quest cooldowns (Jeremy): per quest, family-wide, success only; auto-quest skips resting quests and moves region
import assert from "node:assert/strict";
import fs from "fs";
import * as E from "../js/engine.js";
const root = new URL("..", import.meta.url).pathname, D = {};
for (const f of fs.readdirSync(root + "data").filter(f => f.endsWith(".json"))) D[f.replace(".json", "")] = JSON.parse(fs.readFileSync(root + "data/" + f));
for (const f of D.estate.structureFiles) D["structures/" + f] = JSON.parse(fs.readFileSync(root + "data/structures/" + f + ".json"));
E.setData(D);
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const Q = id => D.quests.find(q => q.id === id), byType = t => D.quests.find(q => q.type === t && !q.once && !q.story);
ok(E.questCooldown(byType("errand")) === 3 && E.questCooldown(byType("gather")) === 3, "gathering/errands 3");
ok(E.questCooldown(byType("hunt")) === 5 && E.questCooldown(byType("fight")) === 5 && E.questCooldown(byType("bounty")) === 5, "hunting/fights 5");
ok(E.questCooldown(Q("hq_ashbrook_harvest")) === 7, "house 7");
ok(E.questCooldown(byType("guild")) === 4, "guild 4");
ok(D.quests.filter(q => q.type === "dungeon" && !q.once && !q.story).every(q => E.questCooldown(q) === 7), "dungeon quests 7");
ok(D.quests.filter(q => q.story || q.once).every(q => E.questCooldown(q) === 0), "story/once none");
let seed = 3; E.setRng(() => ((seed = (seed * 16807) % 2147483647), seed / 2147483647));
const s = E.newGame(1_700_000_000_000), m = E.active(s);
// old save: no qCool at all
delete s.qCool; ok(E.questRest(s, Q("rats")) === 0, "old save loads with nothing resting");
// failure does not start a cooldown
E.setRng(() => 0.999999); const hard = { ...Q("goblins"), apprentice: false, cp: 1e9 };
const r0 = s.qRuns?.goblins || 0; E.resolveQuest(s, m, hard, 1); ok(!(s.qCool || {}).goblins, "failure: no cooldown");
// success starts it for the whole family
E.setRng(() => 0); E.resolveQuest(s, m, { ...Q("b_smugglers"), cp: 0, deliver: null }, 1);
ok(s.qCool.b_smugglers === s.day + 5, "success rests bounty 5 days");
s.qCool = { rats: s.day + 3 };
ok(E.questRest(s, Q("rats")) === 3 && E.questIssue(s, m, Q("rats")) === "🕒 Back in 3 days", "rest text");
ok(E.questIssue(s, m, Q("rats"), true) !== "🕒 Back in 3 days", "ignoreRest");
s.day += 2; ok(E.questIssue(s, m, Q("rats")) === "🕒 Back in 1 day", "counts down");
s.day += 1; ok(E.questRest(s, Q("rats")) === 0, "opens again");
// auto-quest: skips resting, picks next-hardest; whole region resting -> other region; all resting incl rats -> null
const reg = Q("rats").region, avail = rg => D.quests.filter(q => q.region === rg && !q.story && !q.house && q.risk !== "deadly" && !E.questIssue(s, m, q) && q.cp <= E.cp(s, m)).sort((a, b) => b.cp - a.cp);
const a1 = avail(reg);
if (a1.length >= 2) { s.qCool = { [a1[0].id]: s.day + 5 }; ok(E.autoQuest(s, m, reg).id === a1[1].id, "next-hardest when top rests"); }
s.qCool = Object.fromEntries(D.quests.filter(q => q.region === reg).map(q => [q.id, s.day + 9]));
const alt = E.autoQuest(s, m, reg); ok(!alt || alt.region !== reg, "region all resting -> another region (or nothing)");
s.qCool = Object.fromEntries(D.quests.map(q => [q.id, s.day + 9])); ok(E.autoQuest(s, m, reg) === null, "everything resting -> null (works)");
// a run already under way is allowed to finish
m.action = { type: "quest", target: "rats", progress: 1 }; ok(E.actionAllowed(s, m, { type: "quest", target: "rats" }), "mid-run not cancelled");
m.action = null; ok(!E.actionAllowed(s, m, { type: "quest", target: "rats" }), "can't start a resting quest");
const ui = fs.readFileSync(root + "js/ui/quests-tab.js", "utf8"); ok(/Resting \(\$\{resting\.length\}\)/.test(ui), "Resting (N) group");
const CL = JSON.parse(fs.readFileSync(root + "data/changelog.json")).entries; ok(CL[0].build === "R86" && CL[0].items.some(i => /Back in/.test(i)), "changelog");
console.log("r86f ok", n);
