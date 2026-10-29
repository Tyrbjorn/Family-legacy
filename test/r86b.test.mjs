// R86b: Orrin must not point at the Estate before the family owns land.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { landGo, LAND_VIEWS, hasLand, chapterStops, noteList, coachHelpers } from "../js/ui/coach-logic.js";
import { CHAPTERS } from "../js/ui/coach-data.js";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const none = { land: [] }, some = { land: ["plot"] };
ok(!hasLand(none) && hasLand(some), "hasLand");
for (const v of LAND_VIEWS) { ok(landGo(none, v) === "land", v + " -> land when landless"); ok(landGo(some, v) === v, v + " kept with land"); }
for (const v of ["land", "quests", "main", "@menu", undefined]) ok(landGo(none, v) === v, "untouched " + v);
const t4 = CHAPTERS.find(c => c.id === "t4"); ok(t4, "t4 exists");
const vis = () => true;
const pre = chapterStops(t4, vis, {}, false), post = chapterStops(t4, vis, {}, true);
ok(pre.length >= 1 && pre.every(st => st.tab === "land" && !st.land), "landless t4 = land-page stops only");
ok(pre.some(st => /data-v="plot"/.test(st.sel)), "landless t4 points at the Starting Plot");
ok(post.every(st => !st.noLand) && post.some(st => st.tab === "estate"), "landed t4 is the full estate tour");
for (const ch of CHAPTERS) ok(chapterStops(ch, vis, {}, false).every(st => !LAND_VIEWS.includes(st.tab)), ch.id + " never lands on an estate room landless");
const ui = readFileSync(new URL("../js/ui/coach-ui.js", import.meta.url), "utf8");
ok(/toGo = v => \{[^}]*landGo\(s, v\)/.test(ui), "toGo gated"); ok(/rowBtns = \(r0[^)]*landGo/.test(ui), "rowBtns gated"); ok(/dotTo = n0[^;]*landGo/.test(ui), "dotTo gated"); ok(/chapterStops\(ch, tabVisible, H\(\), hasLand\(s\)\)/.test(ui), "tour passes hasLand");
ok(/landGo\(s, st\.tab\)/.test(readFileSync(new URL("../js/ui/handlers/meta.js", import.meta.url), "utf8")), "old tour gated");
const CL = JSON.parse(readFileSync(new URL("../data/changelog.json", import.meta.url), "utf8")).entries;
ok(CL[0].build === "R86" && CL[0].items.some(i => /Starting Plot/.test(i)), "changelog");
console.log("r86b ok", n);
// R86c: quest rows' Go scrolls to the quest card (it looked dead from the Quests tab, where the Ledger lives)
{
  const { GROUND } = await import("../js/ui/coach-data.js");
  const ui2 = readFileSync(new URL("../js/ui/coach-ui.js", import.meta.url), "utf8");
  const Q = JSON.parse(readFileSync(new URL("../data/quests.json", import.meta.url), "utf8"));
  let m = 0;
  for (const r of GROUND.filter(r => r.go === "quests" && typeof r.quest === "string")) { assert.ok(Q.some(q => q.id === r.quest), r.id + " quest exists"); m++; }
  assert.ok(m >= 2, "bram + market rows");
  assert.ok(/data-a="coach_quest" data-v="\$\{r\.quest\}"/.test(ui2), "quest rows emit coach_quest");
  assert.ok(/coach_quest: v => goQuest\(v\)/.test(ui2) && /scrollIntoView[\s\S]{0,80}qflash/.test(ui2) && /DETAILS/.test(ui2), "goQuest scrolls, opens, flashes");
  assert.ok(/qNeed\(r\)/.test(ui2), "row shows what the quest needs");
  const CL2 = JSON.parse(readFileSync(new URL("../data/changelog.json", import.meta.url), "utf8")).entries;
  assert.ok(CL2[0].items.some(i => /Bram/.test(i)), "changelog bram");
  console.log("r86c ok", m + 5);
}
