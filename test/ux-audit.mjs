// 390px mobile audit: horizontal overflow, small tap targets and tiny text on every tab.
const { chromium } =
  await import("/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core/index.mjs");
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const p = await (
  await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
).newPage();
const errs = [];
p.on("pageerror", e => errs.push(e.message));
p.on("dialog", d => d.accept());
await p.goto("http://localhost:" + (process.env.PORT || 8137) + "/");
await p.evaluate(() => localStorage.clear());
await p.reload();
await p.waitForFunction(() => window.__game);
// a rich mid-game state so every tab has content
await p.evaluate(() => {
  const g = __game,
    s = g.s,
    E = g.E;
  E.skipTutorial(s);
  E.markTourSeen(s);
  const m = E.active(s);
  m.ageDays = 20 * g.D.tuning.daysPerYear;
  E.chooseClass(s, m.id, "fighter");
  s.res.coin = 50000;
  for (const k of ["wood", "stone", "planks", "blocks", "ingots", "copper", "leather", "cloth"]) s.res[k] = 500;
  E.buyLand(s, "plot");
  E.buyLand(s, "acre");
  const sh = E.buildStructure(s, "shack");
  for (const pc of ["bunk", "workbench"]) E.placePiece(s, sh.uid, pc);
  const bh = E.buildStructure(s, "bunkhouse");
  if (bh) E.placePiece(s, bh.uid, "minionbunk");
  E.hire(s, "millbrook", g.D.minions.hireAt.millbrook[0]);
  E.startEvent(s, "festival", "millbrook", 9);
  g.save();
});
const tabs = ["main", "jobs", "guilds", "map", "inv", "estate", "minions", "craft", "family", "houses", "chron"];
const report = {};
for (const t of tabs) {
  await p.evaluate(t => {
    const g = window.__tabGroup(t);
    document.querySelector(`#tabs [data-group="${g}"]`)?.click();
  }, t);
  await p.waitForTimeout(150);
  await p.evaluate(t => document.querySelector(`#subtabs [data-tab="${t}"]`)?.click(), t);
  await p.waitForTimeout(500);
  report[t] = await p.evaluate(() => {
    const W = innerWidth,
      out = [],
      small = [],
      tiny = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (!r.width || getComputedStyle(el).visibility === "hidden") continue;
      if (el.closest(".treewrap,.docklist,#subtabs,nav,svg,.tree")) continue;
      if (r.right > W + 1 && !el.closest("[style*=overflow]"))
        out.push(
          el.tagName.toLowerCase() +
            "." +
            (el.className || "").toString().split(" ")[0] +
            " " +
            Math.round(r.right) +
            " " +
            (el.textContent || "").trim().slice(0, 30),
        );
      if (el.matches("button,select,a[data-a],input") && r.height < 32 && !el.closest(".tnode"))
        small.push(
          el.tagName.toLowerCase() +
            ":" +
            (el.textContent || el.dataset.a || "").trim().slice(0, 18) +
            " " +
            Math.round(r.width) +
            "x" +
            Math.round(r.height),
        );
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 11 && el.childNodes.length && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()))
        tiny.push(Math.round(fs) + "px " + (el.textContent || "").trim().slice(0, 25));
    }
    return {
      scrollW: document.documentElement.scrollWidth,
      overflow: [...new Set(out)].slice(0, 8),
      small: [...new Set(small)].slice(0, 12),
      smallN: small.length,
      tiny: [...new Set(tiny)].slice(0, 6),
    };
  });
  await p.screenshot({ path: `/workspace/fl-screenshots/ux-${t}.png` });
}
console.log(JSON.stringify(report, null, 1));
console.log("errs", errs);
await b.close();
