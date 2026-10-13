// Simulated-play pacing test: a scripted "reasonable new player" at 1× speed with live data/tuning.json.
// Checks the early-game milestones land inside target real-time windows (seconds of active play).
import fs from "fs";
import * as E from "../js/engine.js";
const L = n => JSON.parse(fs.readFileSync(new URL("../data/" + n + ".json", import.meta.url)));
const names = ["skills","classes","traits","buildings","furniture","items","quests","regions","tuning","nodes","towns","minions","guilds","jobs","activities","map","dungeons","estate","crafting","legacy","chronicle","achievements","events","encounters","seasons", "tutorial","notify","marriage","phases","intros"];
const D = {};
for (const n of names) D[n] = L(n);
E.setData(D);
let seed = 7;
E.setRng(() => ((seed = (seed * 16807) % 2147483647), seed / 2147483647));
const s = E.newGame(1_700_000_000_000);
const f = E.active(s);
const at = {};
const hit = (k, c) => { if (at[k] == null && c) at[k] = t; };
let t = 0;
const STEP = 5; // seconds of real time per sim step
const coin0 = s.res.coin;
while (t < 3600) {
  // --- scripted player ---
  const a = f.action;
  if (E.isAdult(f) && !f.cls && !s.pendingClass?.length) E.chooseClass(s, f.id, "fighter");
  if (E.isAdult(f) && f.cls && !f.guild && !E.joinIssues(s, f, "vanguard").length) E.joinGuild(s, f, "vanguard");
  const issues = E.isAdult(f) ? E.joinIssues(s, f, "vanguard") : ["child"];
  let want;
  if (f.guild && E.ageY(f) >= D.tuning.courtAge && s.suitors.length) {
    const su = s.suitors.reduce((x, y) => (y.affinity > x.affinity ? y : x));
    want = su.affinity < 100 ? { type: "court", target: su.id } : { type: "job", target: "smithy" };
  } else if (!f.cls || issues.some(i => /coin/.test(i))) want = { type: "job", target: "smithy" };
  else want = { type: "activity", target: "pells" };
  if (!a || a.type !== want.type || a.target !== want.target) E.setAction(s, want);
  E.advanceReal(s, STEP);
  t += STEP;
  hit("firstLevel", Object.values(f.skills).some(k => k.lvl > 0));
  hit("firstCoin", s.res.coin > coin0);
  hit("adult", E.isAdult(f));
  hit("guild", !!f.guild);
  hit("courtReady", E.ageY(f) >= D.tuning.courtAge && s.suitors.length > 0);
  hit("courted", s.suitors.some(x => x.affinity >= 100));
}
const targets = { firstLevel: 60, firstCoin: 60, adult: 10 * 60, guild: 15 * 60, courtReady: 15 * 60, courted: 30 * 60 };
let bad = 0;
for (const [k, lim] of Object.entries(targets)) {
  const v = at[k];
  const ok = v != null && v <= lim;
  if (!ok) bad++;
  console.log(`${ok ? "ok" : "FAIL"} ${k}: ${v == null ? "never" : (v / 60).toFixed(1) + " min"} (target ≤ ${lim / 60} min)`);
}
// mid/late-game guard rails: lifetime and turbo aren't trivialised by the faster clock
const T = D.tuning;
const lifeHours = (T.baseLifespan * T.daysPerYear * T.secPerDayActive) / 3600;
const turboDays = (T.turboCapMin * 60 * T.turboMult) / T.secPerDayActive;
const chk = (c, m) => { console.log((c ? "ok " : "FAIL ") + m); if (!c) bad++; };
chk(lifeHours >= 25 && lifeHours <= 60, `founder lifetime ≈ ${lifeHours.toFixed(1)} h active play (25–60 h)`);
chk(turboDays <= 1500, `full turbo covers ${turboDays.toFixed(0)} days (≤ 1500)`);
chk(E.xpNeed(30) >= 1200, `level-30 cost ${E.xpNeed(30).toFixed(0)} xp stays ≥ 1200 (late game not cheapened)`);
if (bad) { console.log(bad + " pacing checks failed"); process.exit(1); }
console.log("pacing ok");
