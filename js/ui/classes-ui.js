// R46 guild tiers card: current class + tier, the 2 nearest next classes with only what's missing,
// "show all", and the guild's next chain quest.
import * as E from "../engine.js";
import { D, s } from "../main.js";
import { U } from "./state.js";

const row = (m, x) => {
  const c = x.c, ok = !x.miss.length, side = x.kind === "side";
  const cost = E.moveCost(m, c);
  return `<div class="card row" data-cls="${c.id}"><span>${c.icon || ""} <b>${c.name}</b> <span class="muted">Tier ${E.tierN(c)}${side ? " · sideways" : ""} · ${cost}🪙</span><br><span class="muted">${ok ? "✅ ready" : x.miss.join(" · ")}</span>${c.desc ? `<br><span class="muted">${c.desc}</span>` : ""}</span><button class="b" data-a="evolve" data-v="${c.id}" ${ok ? "" : "disabled"}>${side ? "Switch" : "Advance"}</button></div>`;
};

export function classCard(m) {
  const cur = E.cls(m);
  if (!cur || cur.profession) return "";
  const gid = E.guildOfCls(cur.id), g = gid && (E.guildDef(gid) || D.guilds.adventurers);
  const all = U.clsAll === m.id;
  const list = all
    ? E.classMoves(s, m).map(c => ({ c, kind: E.moveKind(m, c), miss: E.classIssues(s, m, c) })).sort((a, b) => a.c.tier - b.c.tier)
    : E.nearestClasses(s, m);
  const nx = gid && E.chainNext(s, gid), nq = nx && E.findId(D.quests, nx.quest);
  let h = `<h3>🎓 Guild tiers</h3><div class="card" id="guildtiers"><div>${cur.icon || ""} <b>${cur.name}</b> <span class="muted">· Tier ${E.tierN(cur)} (${E.guildTierDef(cur).name || ""})${g ? " · " + (g.icon || "") + " " + g.name : ""} · Lv ${E.level(m)}</span></div>`;
  if (m.secondGuild) h += `<div class="muted">🔓 ${E.pathRankName(2)} ${(E.pathDef(m.secondGuild.path) || {}).name || ""} reached: a second guild opens in a coming update.</div>`;
  h += list.length ? list.map(x => row(m, x)).join("") : `<div class="muted">${E.tierN(cur) >= 3 ? "Top tier of the base game reached (tier 4 comes with the expansion)." : "No next class yet."}</div>`;
  h += `<div class="row"><button class="b" data-a="clsall" data-v="${m.id}">${all ? "Show nearest" : "Show all"}</button>${nq ? `<span class="muted">📜 Next guild chain quest: <b>${nq.name}</b> (${E.rankName(nq.rank || 0)})${nx.unlock ? " → unlocks " + nx.unlock.map(u => (E.findId(D.crafting.recipes, u.split(":")[1]) || {}).name || u).join(", ") : ""}</span>` : ""}</div></div>`;
  return h;
}
