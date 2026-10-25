// R39.1 release packager: copies the game into a release folder + zip with Dev Mode locked off.
// usage: node tools/make-release.mjs [outDir=../release] [--target web|android|steam] [--edition demo|full]
// R76: --target / --edition are written into data/build.json. The tip jar link (tipUrl) is kept ONLY for target web + edition demo
//   (the default), and is deleted from every other build, so Play / Steam / full builds carry no tip link.
// - copies everything except node_modules, .git, test/, tools/ and archive/
// - writes data/build.json with "channel": "release" (Dev Mode code stays but is hard-disabled: ?dev=1 does nothing,
//   the Dev Mode switch never appears, any stored dev flag is wiped on load). Tester links keep working.
// - zips it with python zipfile to <outDir>/family-legacy-idle-release.zip
// The source folder is not changed, so the normal dev build (and the current site) keep Dev Mode.
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const src = path.resolve(new URL("..", import.meta.url).pathname);
const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (/^--(target|edition)$/.test(args[i])) opt[args[i].slice(2)] = args[++i]; else if (/^--/.test(args[i])) throw new Error("unknown flag " + args[i]);
const pos = args.filter((a, i) => !/^--/.test(a) && !/^--(target|edition)$/.test(args[i - 1] || ""));
if (opt.target && !["web", "android", "steam"].includes(opt.target)) throw new Error("--target must be web|android|steam");
if (opt.edition && !["demo", "full"].includes(opt.edition)) throw new Error("--edition must be demo|full");
const out = path.resolve(pos[0] || path.join(src, "..", "release"));
const dest = path.join(out, "family-legacy-idle");
const SKIP = new Set(["node_modules", ".git", "test", "tools", "archive"]);
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
b.target = opt.target || b.target || "web";
b.edition = opt.edition || b.edition || "demo";
if (!(b.target === "web" && b.edition === "demo")) delete b.tipUrl;
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
console.log("release build:", dest, "\nzip:", zip, "\nchannel:", b.channel, "target:", b.target, "edition:", b.edition, "tip link:", b.tipUrl ? "yes (placeholder)" : "stripped");
