// Run every test: node tools/test-all.mjs [--smoke] [--sim]
// --smoke adds the browser UI smoke test (needs the dev server on :8080); --sim adds a short seeded sim (SEED=1, 1 run x 2y).
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
const root = new URL("..", import.meta.url).pathname, args = process.argv.slice(2);
const files = readdirSync(root + "test").filter(f => f.endsWith(".test.mjs")).sort().map(f => "test/" + f);
if (args.includes("--smoke")) files.push("test/ui-smoke.mjs");
let fail = 0;
for (const f of files) {
  const r = spawnSync("node", [f], { cwd: root, encoding: "utf8" });
  const last = ((r.stdout || "") + (r.stderr || "")).trim().split("\n").pop();
  const ok = r.status === 0;
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"} ${f}: ${last}`);
}
if (args.includes("--sim")) {
  const r = spawnSync("node", ["test/longsim.mjs", "1", "2"], { cwd: root, encoding: "utf8", env: { ...process.env, SEED: "1" } });
  if (r.status !== 0) fail++;
  console.log(`${r.status === 0 ? "PASS" : "FAIL"} seeded sim (SEED=1, 2y)`);
}
console.log(`\n${files.length - fail}/${files.length} files passed${fail ? `, ${fail} FAILED` : ""}`);
process.exit(fail ? 1 : 0);
