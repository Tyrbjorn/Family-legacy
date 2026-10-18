// R39.1 release packager: copies the game into a release folder + zip with Dev Mode locked off.
// usage: node tools/make-release.mjs [outDir=../release]
// - copies everything except node_modules, .git, test/ and tools/
// - writes data/build.json with "channel": "release" (Dev Mode code stays but is hard-disabled: ?dev=1 does nothing,
//   the Dev Mode switch never appears, any stored dev flag is wiped on load). Tester links keep working.
// - zips it with python zipfile to <outDir>/family-legacy-idle-release.zip
// The source folder is not changed, so the normal dev build (and the current site) keep Dev Mode.
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const src = path.resolve(new URL("..", import.meta.url).pathname);
const out = path.resolve(process.argv[2] || path.join(src, "..", "release"));
const dest = path.join(out, "family-legacy-idle");
const SKIP = new Set(["node_modules", ".git", "test", "tools"]);
if (dest.startsWith(src + path.sep) || dest === src) throw new Error("outDir must be outside the project");
fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
const keep = p => {
  const parts = path.relative(src, p).split(path.sep);
  return !SKIP.has(parts[0]) && !parts.some(x => x === "node_modules" || x === ".git");
};
fs.cpSync(src, dest, { recursive: true, filter: p => p === src || keep(p) });
const bf = path.join(dest, "data", "build.json");
const b = JSON.parse(fs.readFileSync(bf, "utf8"));
b.channel = "release";
fs.writeFileSync(bf, JSON.stringify(b, null, 1) + "\n");
const zip = path.join(out, "family-legacy-idle-release.zip");
execFileSync("python3", ["-c", `
import zipfile,os,sys
out,root=sys.argv[1],sys.argv[2]
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
  for d,ds,fs in os.walk(root):
    ds[:]=[x for x in ds if x not in('node_modules','.git')]
    for f in fs:
      p=os.path.join(d,f); z.write(p,os.path.relpath(p,os.path.dirname(root)))
`, zip, dest]);
console.log("release build:", dest, "\nzip:", zip, "\nchannel:", b.channel);
