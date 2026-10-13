// Long headless simulation (balance/bug pass): a greedy bot plays several lineages and checks invariants.
// usage: node test/longsim.mjs [seeds=3] [years=200]
import fs from "fs";
import * as E from "../js/engine.js";
const root = new URL("..", import.meta.url).pathname;
const D = {};
for (const f of fs.readdirSync(root + "data"))
  D[f.replace(".json", "")] = JSON.parse(fs.readFileSync(root + "data/" + f));
E.setData(D);
const SEEDS = +(process.argv[2] || 3),
  YEARS = +(process.argv[3] || 200);
const T = D.tuning,
  YD = T.daysPerYear;
const issues = [];
const seen = {
  quests: new Set(),
  structs: new Set(),
  pieces: new Set(),
  classes: new Set(),
  ach: new Set(),
  legacy: new Set(),
  guilds: new Set(),
  enc: 0,
  events: new Set(),
  recipes: new Set(),
};
const bad = (seed, day, msg) => {
  if (issues.filter(i => i.msg === msg).length < 3) issues.push({ seed, day, msg });
};
const PIECES = [
  "bunk",
  "larder",
  "cradle",
  "storage",
  "workbench",
  "sawtable",
  "forge",
  "herbrack",
  "minionbunk",
  "studydesk",
  "shrine",
  "loom",
  "toolrack",
  "oven",
  "smoker",
  "pells",
  "masontable",
  "tanrack",
  "hourglass",
  "hearth",
  "quern",
  "churn",
  "jars",
];
const STRUCTS = [
  "shack",
  "cabin",
  "house",
  "hall",
  "bunkhouse",
  "sawmill",
  "masonyard",
  "quarry",
  "herbgarden",
  "fields",
  "kitchen",
  "cowpen",
  "gristmill",
  "fishinghut",
  "hunterscabin",
  "smithy",
  "graveyard",
  "mineshaft",
  "ancestorhall",
  "orchard",
  "smokehouse",
  "brewery",
  "preservery",
];

function check(s, seed) {
  for (const [k, v] of Object.entries(s.res)) {
    if (typeof v !== "number" || !isFinite(v)) bad(seed, s.day, `res.${k} is ${v}`);
    else if (v < -1e-9) bad(seed, s.day, `res.${k} negative (${v.toFixed(2)})`);
  }
  for (const m of s.members) {
    for (const [k, v] of Object.entries(m.stats || {}))
      if (!isFinite(v)) bad(seed, s.day, `stat ${k} NaN on ${m.name}`);
    for (const [k, v] of Object.entries(m.skills || {}))
      if (!isFinite(v.xp) || !isFinite(v.lvl)) bad(seed, s.day, `skill ${k} NaN`);
    if (!isFinite(m.renown)) bad(seed, s.day, "member renown NaN");
  }
  for (const mi of s.minions || []) if (!isFinite(mi.xp || 0) || !isFinite(mi.loyalty)) bad(seed, s.day, "minion NaN");
  if (!isFinite(s.renown)) bad(seed, s.day, "renown NaN");
  if (!isFinite(s.morale || 0)) bad(seed, s.day, "morale NaN");
  for (const [k, q] of Object.entries(s.foodQ || {})) if (!isFinite(q) || q <= 0 || q > 2.6) bad(seed, s.day, `foodQ.${k}=${q}`);
  if (!isFinite(s.turbo.charge) || s.turbo.charge < 0) bad(seed, s.day, "turbo charge broken");
  for (const t of E.timers(s))
    if (!isFinite(t.p) || (t.left != null && !isFinite(t.left))) bad(seed, s.day, `timer ${t.key} NaN`);
  if ((s.chronicle || []).length > 300) bad(seed, s.day, "chronicle over cap");
  if ((s.notes || []).length > (D.notify.cap || 40)) bad(seed, s.day, "notes over cap");
}

function bot(s, m) {
  const g = s;
  if (s.pendingEnc) {
    seen.enc++;
    const e = D.encounters.list.find(x => x.id === s.pendingEnc.id);
    E.resolvePending(
      s,
      (e.options.filter(o => E.optionOk(s, o))[s.day % 2] || e.options.find(o => E.optionOk(s, o))).id,
    );
    if (s.pendingEnc) bad(0, s.day, "encounter could not be resolved");
  }
  while (s.pendingClass && s.pendingClass.length) {
    const who = s.members.find(x => x.id === s.pendingClass[0]);
    const opts = D.classes.filter(c => c.tier === 0 && !c.line);
    E.chooseClass(s, who.id, opts[who.id % opts.length].id);
    if (s.pendingClass[0] === who.id) s.pendingClass.shift();
  }
  if (s.needSuccession) {
    const l = E.living(s).sort((a, b) => b.ageDays - a.ageDays)[0];
    if (l) E.switchTo(s, l.id);
  }
  m = E.active(s);
  if (!m) return;
  // tutorial
  if (E.tutActive(s)) {
    const st = E.tutCurrent(s);
    if (st.check === "equipped" && s.vault.includes("rusty_sword")) E.equip(s, m, "rusty_sword");
    if (st.check === "quest:rats") E.setAction(s, { type: "quest", target: "rats" });
    if (st.check === "crafted") E.mentorCraft(s);
    if (st.check === "activity") E.setAction(s, { type: "activity", target: "hiking" });
    if (st.check === "estate") E.tutNote(s, "estate");
    E.tutCheck(s);
  }
  if (E.isAdult(m) && !m.cls) {
    const opts = D.classes.filter(c => c.tier === 0 && !c.line);
    if (opts.length) E.chooseClass(s, m.id, opts[m.id % opts.length].id);
  }
  if (m.cls) seen.classes.add(m.cls);
  // estate
  if (!s.land.length) E.buyLand(s, "plot");
  for (const l of D.estate.lands)
    if (s.res.coin > (l.cost.coin || 0) * 3 && !s.land.includes(l.id) && E.landUsed(s) >= E.landSlots(s) - 1)
      E.buyLand(s, l.id);
  for (const t of STRUCTS)
    if (
      !s.structures.some(x => x.type === t) &&
      !E.structIssue(s, t) &&
      s.res.coin > (D.estate.structures.find(x => x.id === t).cost.coin || 0) * 2
    ) {
      if (E.buildStructure(s, t)) seen.structs.add(t);
    }
  for (const st of s.structures) {
    for (const p of PIECES)
      if (!E.placeIssue(s, st.uid, p) && s.res.coin > 300) E.placePiece(s, st.uid, p) && seen.pieces.add(p);
    if (!E.upgradeIssue(s, st.uid) && s.res.coin > 2000) E.upgradeStructure(s, st.uid);
  }
  // food: never let the larder run dry — buy provisions, else do chores (the starter path)
  if (E.daysOfStock(s) < 4) {
    if (s.res.coin >= E.townBuyPrice(s, "millbrook", "food") * 30) E.buyRes(s, "millbrook", "food", 30);
    else if (!E.isBusy(m) && !E.tutActive(s) && s.day % 9 < 3) {
      E.setAction(s, { type: "activity", target: "chores" });
      return;
    }
  }
  // food: keep salt stocked for the smokehouse
  if (s.res.coin > 400 && (s.res.salt || 0) < 10) E.buyRes(s, "millbrook", "salt", 10);
  // minions
  if (s.res.coin > 800 && E.established(s)) {
    const type = (D.minions.hireAt.millbrook || [])[s.day % 3];
    const mi = type && E.hire(s, "millbrook", type);
    if (mi)
      for (const j of ["farm", "gather", "herbs", "mine", "hunt", "craft", "merchant", "adventure", "fish", "scout"])
        if (E.assignMinion(s, mi.uid, j)) break;
  }
  // legacy
  for (const u of D.legacy.upgrades) if (E.buyLegacy(s, u.id)) seen.legacy.add(u.id);
  // family
  if (E.isAdult(m) && !m.spouse && E.ageY(m) >= T.courtAge && s.suitors.length) {
    const su = s.suitors.reduce((a, b) => (b.affinity > a.affinity ? b : a));
    if (su.affinity >= 100) E.propose(s, su.id);
    else if (!E.isBusy(m)) {
      E.setAction(s, { type: "court", target: su.id });
      return;
    }
  }
  // materials: gather when short of wood/stone for the next build
  if (E.isAdult(m) && !E.isBusy(m) && ((s.res.wood || 0) < 40 || (s.res.stone || 0) < 20) && s.day % 60 < 20) {
    const n = D.nodes.find(x => E.actionAllowed(s, m, { type: "gather", target: x.id }));
    if (n) E.setAction(s, { type: "gather", target: n.id });
    return;
  }
  // guilds
  for (const gd of D.guilds.guilds || D.guilds)
    if (!E.joinIssues(s, m, gd.id).length && E.joinGuild(s, m, gd.id)) seen.guilds.add(gd.id);
  if (m.guild) E.rankUp(s, m);
  if (m.adv !== undefined && !m.adv && m.cls) E.joinAdventurers && E.joinAdventurers(s, m);
  if (m.adv) E.advRankUp && E.advRankUp(s, m);
  // others work quests
  for (const o of E.living(s))
    if (o.id !== m.id && E.isAdult(o) && (!o.order || o.order.type === "work"))
      E.setOrder(s, o.id, { type: "quest", target: "outskirts" });
  // active: quest the best available, sometimes explore
  if (!E.isBusy(m) && E.isAdult(m) && !E.tutActive(s)) {
    if (s.day % 97 < 10) E.setAction(s, { type: "auto", target: "explore" });
    else {
      const q = D.quests
        .filter(q => E.actionAllowed(s, m, { type: "quest", target: q.id }) && q.cp <= E.cp(s, m) * 1.2)
        .sort((a, b) => b.cp - a.cp)[0];
      if (q) E.setAction(s, { type: "quest", target: q.id });
    }
  }
}

// coin source accounting by day hook
const coinBy = {};
for (const h of E.DAY_HOOKS) {
  const f = h.fn;
  h.fn = (s, a, b) => {
    const c0 = s.res.coin;
    f(s, a, b);
    coinBy[h.name] = (coinBy[h.name] || 0) + (s.res.coin - c0);
  };
}
for (const [k, f] of Object.entries(E.MINION_JOBS))
  E.MINION_JOBS[k] = (s, mi, a, rg) => {
    const c0 = s.res.coin;
    f(s, mi, a, rg);
    coinBy["job:" + k] = (coinBy["job:" + k] || 0) + (s.res.coin - c0);
  };
const report = [];
const SEED0 = +(process.env.SEED || 1);
for (let seed = SEED0; seed < SEED0 + SEEDS; seed++) {
  let sd = seed * 104729;
  E.setRng(() => ((sd = (sd * 16807) % 2147483647), sd / 2147483647));
  let s = E.newGame(1e12);
  let lineages = 1,
    maxGen = 1,
    peakCoin = 0,
    idleDays = 0;
  const food = { spans: [], days: 0, short: 0, starving: 0, variety: 0, morale: 0, minMorale: 0, emergency: 0 };
  const coinAt = [];
  for (let day = 0; day < YEARS * YD; day++) {
    E.advanceReal(s, T.secPerDayActive / E.globalTick(s));
    if (s.gameOver) {
      if (process.env.DBG) console.log("GAMEOVER", day, s.log.slice(0, 6).map(l => l.msg).join(" | "));
      for (const a of Object.keys(s.ach || {})) seen.ach.add(a);
      s = E.newLineage(s, 1e12);
      lineages++;
      continue;
    }
    if (day % 3 === 0) bot(s, E.active(s));
    if (process.env.FDBG && day % 720 === 0 && s.meal)
      console.log("FOOD", day, "alive", E.living(s).length, "min", s.minions.length, "need", s.meal.need.toFixed(1), "ratio", s.meal.ratio.toFixed(2), "food", Math.round(s.res.food), "cap", E.foodCap(s), "coin", Math.round(s.res.coin), "structs", s.structures.map(x => x.type).join("/"));
    if (process.env.DBG && day % 1800 === 0) {
      const m = E.active(s);
      console.log(
        JSON.stringify(s.tut),
        s.doneQuests.includes("rats"),
        day,
        s.day,
        m && m.alive,
        m && E.ageY(m),
        JSON.stringify(m && m.action),
        s.res.coin | 0,
        s.log[0] && s.log[0].msg,
      );
    }
    const m = E.active(s);
    if (m && !m.action && !m.injured && E.isAdult(m)) idleDays++;
    if (day % 10 === 0) check(s, seed);
    if (s.meal && day > YD * 2) {
      food.days++;
      if (s.meal.short > 0.01) food.short++;
      if (s.meal.short > 0.5) {
        food.starving++;
        const last = food.spans[food.spans.length - 1];
        if (last && last.to === day - 1) last.to = day;
        else if (food.spans.length < 6)
          food.spans.push({ from: day, to: day, lineage: lineages, alive: E.living(s).length, minions: s.minions.length, structs: s.structures.length });
      }
      if (s.meal.emergency && s.meal.emergency.length) food.emergency++;
      food.variety += s.meal.variety;
      food.morale += s.morale;
      food.minMorale = Math.min(food.minMorale, s.morale);
    }
    for (const q of s.doneQuests) seen.quests.add(q);
    for (const e of s.wevents) seen.events.add(e.type);
    for (const id of s.vault) if (id.startsWith("c|")) seen.recipes.add(id.split("|")[1]);
    peakCoin = Math.max(peakCoin, s.res.coin);
    if (day % (YD * 10) === 0) coinAt.push(Math.round(s.res.coin));
    if (day % 30 === 0) {
      const gens = E.familyTree(s).length;
      maxGen = Math.max(maxGen, gens);
    }
    // migration round trip mid-game
    if (day === YD * 50) {
      const code = E.exportCode(s);
      const r = E.importSave(code);
      const a = JSON.parse(E.serialize(s, 1)),
        b = JSON.parse(E.serialize(r, 1));
      delete a._norm;
      delete b._norm;
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        bad(seed, day, "export/import round trip changed state");
        console.log(
          "  LOG",
          JSON.stringify(a.log.slice(0, 2)),
          "→",
          JSON.stringify(b.log.slice(0, 2)),
          a.chronicle.length,
          b.chronicle.length,
        );
        for (const k of new Set([...Object.keys(a), ...Object.keys(b)]))
          if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) {
            if (Array.isArray(a[k]))
              a[k].forEach((x, i) => {
                for (const f of new Set([...Object.keys(x || {}), ...Object.keys(b[k][i] || {})]))
                  if (JSON.stringify(x[f]) !== JSON.stringify((b[k][i] || {})[f]))
                    console.log(
                      "  diff",
                      k,
                      i,
                      f,
                      JSON.stringify(x[f])?.slice(0, 120),
                      "→",
                      JSON.stringify((b[k][i] || {})[f])?.slice(0, 120),
                    );
              });
            else console.log("  diff", k);
          }
      }
    }
  }
  for (const a of Object.keys(s.ach || {})) seen.ach.add(a);
  if (food.starving > food.days * 0.02) bad(seed, s.day, `starvation on ${food.starving}/${food.days} days`);
  const ip = E.timers(s);
  report.push({
    seed,
    lineages,
    maxGen,
    members: s.members.length,
    minions: s.minions.length,
    structs: s.structures.length,
    peakCoin: Math.round(peakCoin),
    coinEvery10y: coinAt.join(","),
    idleAdultDays: idleDays,
    renown: Math.round(s.renown),
    legacyRenown: Math.round(s.legacy?.renown || 0),
    ach: Object.keys(s.ach || {}).length,
    timers: ip.length,
    legacyUps: JSON.stringify(s.legacy?.ups || {}),
    food: {
      shortDays: food.short,
      starvingDays: food.starving,
      emergencyDays: food.emergency,
      avgVariety: +(food.variety / Math.max(1, food.days)).toFixed(2),
      avgMorale: +(food.morale / Math.max(1, food.days)).toFixed(2),
      minMorale: +food.minMorale.toFixed(2),
      menuAtEnd: (s.meal || {}).menu,
      starvingSpans: food.spans,
    },
  });
}
// starter check: a brand-new founder doing only Chores (no estate, no shopping) for 5 years must not starve
{
  let sd = 7;
  E.setRng(() => ((sd = (sd * 16807) % 2147483647), sd / 2147483647));
  const s = E.newGame(1e12);
  E.skipTutorial && E.skipTutorial(s);
  let starving = 0;
  for (let d = 0; d < YD * 5 && !s.gameOver; d++) {
    const m = E.active(s);
    if (m && (!m.action || m.action.target !== "chores") && E.ageY(m) >= 6) E.setAction(s, { type: "activity", target: "chores" });
    E.advanceReal(s, T.secPerDayActive / E.globalTick(s));
    if (s.meal && s.meal.short > 0.5) starving++;
  }
  report.push({ starterChores5y: { starvingDays: starving, food: Math.round(s.res.food), morale: +(s.morale || 0).toFixed(2) } });
  if (starving > 0) bad("starter", s.day, `idle starter family starved ${starving} days`);
}
console.log(JSON.stringify(report, null, 1));
const never = (all, set) => all.filter(x => !set.has(x));
console.log(
  "never achieved:",
  JSON.stringify({
    ach: never(
      D.achievements.map(a => a.id),
      seen.ach,
    ),
    structs: never(STRUCTS, seen.structs),
    legacy: never(
      D.legacy.upgrades.map(u => u.id),
      seen.legacy,
    ),
    events: never(
      D.events.types.map(e => e.id),
      seen.events,
    ),
    guilds: never(
      (D.guilds.guilds || D.guilds).map(g => g.id),
      seen.guilds,
    ),
    quests: D.quests.length - seen.quests.size + "/" + D.quests.length,
  }),
);
console.log(
  "coin by day hook (all seeds):",
  JSON.stringify(Object.fromEntries(Object.entries(coinBy).map(([k, v]) => [k, Math.round(v)]))),
);
console.log("encounters prompted:", seen.enc, "crafted bases:", [...seen.recipes].join(","));
console.log("ISSUES", issues.length, JSON.stringify(issues, null, 1));
fs.writeFileSync("/tmp/longsim.json", JSON.stringify({ report, issues }, null, 1));
