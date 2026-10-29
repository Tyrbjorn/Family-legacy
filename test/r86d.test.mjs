// R86d: guild rules explained; Adventurers never blocks a sworn guild (rules unchanged)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const r = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const gt = r("js/ui/guilds-tab.js"), cu = r("js/ui/classes-ui.js"), ge = r("js/engine/guilds.js");
ok(/id="guild-rules"/.test(gt) && /one<\/b> of the other guilds/.test(gt), "guild rules card");
ok(/if \(!m\.guild\) return "";/.test(cu), "no second-guild hint without a sworn guild");
ok(/id="adv-note"/.test(cu), "adventurer note");
ok(/else if \(!g\.open && m\.guild\) out\.push\(`sworn to/.test(ge), "one-sworn-guild rule unchanged (checks m.guild, not m.adv)");
ok(!/m\.adv/.test(ge.slice(ge.indexOf("export function joinIssues"), ge.indexOf("export function joinGuild"))), "joinIssues ignores Adventurers rank");
const G = JSON.parse(r("data/guilds.json"));
ok(G.adventurers && /Does not count toward the one-guild rule/.test(G.adventurers.desc), "adventurers desc");
ok(G.guilds.filter(g => !g.open).length >= 5, "sworn guilds present");
const CL = JSON.parse(r("data/changelog.json")).entries;
ok(CL[0].build === "R86" && CL[0].items.some(i => /Adventurers/.test(i)), "changelog");
console.log("r86d ok", n);
