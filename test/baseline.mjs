// 10-seed long-sim baseline: runs each seed in parallel and prints medians of renown / followers / buildings
// at years 10, 20, 30, 40 plus how many seeds end big (renown > 3000) vs stuck.
// usage: node test/baseline.mjs [seeds=10] [years=40] [parallel=8]
import { execFile } from "child_process";
const N = +(process.argv[2] || 10), Y = +(process.argv[3] || 40), P = +(process.argv[4] || 8), BIG = 3000;
const run = seed => new Promise(res => execFile("node", [new URL("./longsim.mjs", import.meta.url).pathname, "1", String(Y)], { env: { ...process.env, SEED: String(seed) }, maxBuffer: 1 << 26 }, (e, out) => {
  const r = JSON.parse(out.slice(0, out.indexOf("\n]\n") + 3))[0];
  res({ seed, timing: r.timing, legacy: r.legacyEarned, tithed: r.tithed, snap: [...r.snap.slice(1), [r.renown, r.minions, r.structs]], issues: /ISSUES 0 \[\]/.test(out) ? 0 : 1 });
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
console.log(`sims with issues: ${rows.filter(r => r.issues).length}`);
