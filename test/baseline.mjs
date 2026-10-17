// 10-seed long-sim baseline: runs each seed in parallel and prints medians of renown / followers / buildings
// at years 10, 20, 30, 40 plus how many seeds end big (renown > 3000) vs stuck.
// usage: node test/baseline.mjs [seeds=10] [years=40] [parallel=8]
import { execFile } from "child_process";
const N = +(process.argv[2] || 10), Y = +(process.argv[3] || 40), P = +(process.argv[4] || 8), BIG = 3000;
const run = seed => new Promise(res => execFile("node", [new URL("./longsim.mjs", import.meta.url).pathname, "1", String(Y)], { env: { ...process.env, SEED: String(seed) }, maxBuffer: 1 << 26 }, (e, out) => {
  const r = JSON.parse(out.slice(0, out.indexOf("\n]\n") + 3))[0];
  res({ seed, maxGen: r.maxGen, avgFam: r.avgFam, wageX: r.wageX, wagesNow: r.wagesNow, maxScore: r.maxScore, vb: r.villageBuildings, coin: r.coinEvery10y, timing: r.timing, gens: r.gens, deaths: r.deaths, lineages: r.lineages, legacy: r.legacyEarned, tithed: r.tithed, evt: r.evt || {}, snap: [...r.snap.slice(1), [r.renown, r.minions, r.structs]], issues: /ISSUES 0 \[\]/.test(out) ? 0 : 1 });
}));
const seeds = Array.from({ length: N }, (_, i) => i + 1), rows = [];
for (let i = 0; i < seeds.length; i += P) rows.push(...(await Promise.all(seeds.slice(i, i + P).map(run))));
const med = a => { const b = [...a].sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : Math.round((b[m - 1] + b[m]) / 2); };
const yrs = [10, 20, 30, 40].filter(y => y <= Y);
for (const [i, y] of yrs.entries()) {
  const at = rows.map(r => r.snap[Math.min(i, r.snap.length - 1)]);
  console.log(`year ${y}: renown ${med(at.map(x => x[0]))} · followers ${med(at.map(x => x[1]))} · buildings ${med(at.map(x => x[2]))}`);
}
const end = rows.map(r => r.snap[r.snap.length - 1]);
console.log(`end: big ${end.filter(x => x[0] > BIG).length}/${N}, stuck ${end.filter(x => x[0] <= BIG).length}/${N} · per seed renown/followers/buildings: ${rows.map(r => r.snap[r.snap.length - 1].join("/")).join("  ")}`);
const tm = k => rows.map(r => r.timing[k] ?? ">" + Y).join(",");
console.log(`legacy earned by year ${Y}: median ${med(rows.map(r => r.legacy))} (tithe ${med(rows.map(r => r.tithed))}) · per seed ${rows.map(r => r.legacy).join(",")}`);
console.log(`years to Graveyard: ${tm("graveyard")} · Stone Walls: ${tm("walls")}`);
console.log(`years to first Auto Tend (80): ${tm("autoTend1")} (family lines ${rows.map(r => r.timing.lines1 ?? "-").join(",")}) · full tier 1 (1240): ${tm("autoTendAll")}`);
console.log(`pacing (years; median, then per seed):`);
for (const k of ["stage_Homestead", "stage_Farmstead", "stage_Manor", "stage_Prosperous Estate", "phase_Established", "phase_Dynasty", "phase_Titles", "firstBuilding", "cabin", "house", "hall", "smithy", "firstUpgrade", "landCap", "charter", "villageBuilding1", "villageBuildings5", "villageBuildings8", "village_Village", "village_Market Village", "manorLine", "mount", "quarry", "wall", "patron", "atBundle1", "atBundle2", "autoTend1", "legacy500", "legacy700", "legacy800", "legacy900", "legacy1000", "autoTendAll", "autoTendAllTithe", "renown100", "renown500", "renown1000", "renown3000", "clear_d_ratwarren", "clear_d_barrow", "clear_d_spidercave", "clear_d_ruinvault", "clear_d_stormhold", "clear_d_dragonlair"]) {
  const v = rows.map(r => r.timing[k]), got = v.filter(x => x != null);
  console.log(`  ${k}: ${got.length ? med(got) : "-"} (${got.length}/${N}) · ${v.map(x => x ?? "-").join(",")}`);
}
console.log(`max estate score (Prosperous at 20): median ${med(rows.map(r => r.maxScore || 0))} · ${rows.map(r => r.maxScore).join(",")}`);
console.log(`village buildings at end: ${rows.map(r => r.vb).join(",")} · coin every 10y (median): ${[0,1,2,3,4,5,6].map(i => med(rows.map(r => +(String(r.coin).split(",")[i] || 0)))).join(", ")}`);
console.log(`base wages/month at end: ${rows.map(r => r.wagesNow).join(",")} · extra scaled wages paid: ${rows.map(r => r.wageX).join(",")}`);
console.log(`GEN generations ${rows.map(r => r.maxGen).join(",")} (median ${med(rows.map(r => r.maxGen))}) · lineages ${rows.map(r => r.lineages).join(",")} · heir changes median ${med(rows.map(r => r.gens.length))} · avg living family ${med(rows.map(r => r.avgFam * 10)) / 10} · legacy/heir change median ${med(rows.map(r => Math.round(r.legacy / Math.max(1, r.gens.length))))} · deaths median ${med(rows.map(r => r.deaths.length))} · mean death age ${med(rows.map(r => Math.round(r.deaths.reduce((a, d) => a + d[1], 0) / Math.max(1, r.deaths.length))))}`);
console.log(`heir changes [year, renown at handover] per seed:\n${rows.map(r => "  " + r.seed + ": " + r.gens.map(g => g.join("y/")).join("  ")).join("\n")}`);
console.log(`family deaths [year, age] per seed (lineages):\n${rows.map(r => "  " + r.seed + " (" + r.lineages + "): " + r.deaths.map(g => g.join("y/a")).join(" ")).join("\n")}`);
const ek = [...new Set(rows.flatMap(r => Object.keys(r.evt)))];
console.log(`events per seed (median): ${ek.map(k => k + " " + med(rows.map(r => r.evt[k] || 0))).join(" · ")}`);
if (process.env.ROWS) (await import("fs")).writeFileSync(process.env.ROWS, JSON.stringify(rows));
console.log(`sims with issues: ${rows.filter(r => r.issues).length}`);
