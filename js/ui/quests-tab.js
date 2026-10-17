// R30 Quests tab (Work group, first sub-tab): Start here (rats) · Active · Available (known + seen; locked regions with 🔒) · Story · Completed · Rumoured.
import * as E from "../engine.js";
import { D, s } from "../main.js";
import { U } from "./state.js";
import { qKind, storyv } from "./map-tab.js";

const rew = q => Object.entries(q.reward || {}).map(([k, v]) => `${v} ${k === "coin" ? "🪙" : k}`).join(" · ");
const ratsOpen = () => !s.doneQuests.includes("rats") && D.quests.some(q => q.id === "rats");
export const questBadge = () => (ratsOpen() ? 1 : 0);

function row(m, q, star) {
  const on = m.action && m.action.type === "quest" && m.action.target === q.id;
  const rg = D.regions.find(r => r.id === q.region);
  const open = E.regionOpen(s, q.region);
  const iss = !open ? `region locked (CP ${rg.cp})` : E.questIssue(s, m, q) || E.questAgeIssue(m, q, s);
  const k = qKind(q);
  return `<div class="card ${star ? "tut" : ""}" style="padding:6px 8px;margin:4px 0"><div class="row"><span>${star ? "⭐ <b>Start here:</b> " : k[0] + " "}<b>${q.name}</b><br><span class="muted">${rg.icon || ""} ${rg.name} · ${q.risk} · CP ${q.cp} · ${q.days}d · ${rew(q)} · 🚶 ${E.travelDays(q.id)}d</span></span>
<span class="row" style="gap:4px"><button class="b" data-a="qmap" data-v="${q.id}" title="Show on the map">📍</button><button class="b ${on ? "sel" : ""}" data-a="quest" data-v="${q.id}" ${iss ? "disabled" : ""}>${on ? "On it" : "Go"}</button></span></div>${iss ? `<div class="muted">🔒 ${iss}</div>` : ""}</div>`;
}

export function questsv() {
  const m = E.active(s);
  let h = "";
  const rats = D.quests.find(q => q.id === "rats");
  if (ratsOpen()) h += row(m, rats, true);
  const act = E.living(s).filter(x => x.action && x.action.type === "quest");
  h += `<h3>⚔️ Active (${act.length})</h3>` + (act.length ? act.map(x => {
    const q = D.quests.find(y => y.id === x.action.target);
    return `<div class="card" style="padding:5px 8px;margin:3px 0"><b>${x.name}</b> · ${q ? q.name : x.action.target}<div class="bar"><i style="width:${q ? Math.min(100, ((x.action.progress || 0) / q.days) * 100) : 0}%"></i></div></div>`;
  }).join("") : '<div class="muted">Nobody is on a quest.</div>');
  const f = U.qFilter || "all";
  const vis = D.quests.filter(q => !q.story && E.questVisible(s, q) && !(q.once && s.doneQuests.includes(q.id)) && !(ratsOpen() && q.id === "rats"));
  const can = q => E.regionOpen(s, q.region) && !E.questIssue(s, m, q) && !E.questAgeIssue(m, q, s);
  const list = f === "can" ? vis.filter(can) : vis;
  h += `<h3>📜 Available (${list.length})</h3><div class="row" style="gap:4px;justify-content:flex-start">${[["all", "All"], ["can", "Can do now"]].map(([k, n]) => `<button class="b ${f === k ? "sel" : ""}" data-a="qfilter" data-v="${k}">${n}</button>`).join("")}</div>`;
  for (const rg of D.regions) {
    const qs = list.filter(q => q.region === rg.id);
    if (qs.length) h += `<div class="muted" style="margin-top:6px">${rg.icon || ""} ${rg.name}${E.regionOpen(s, rg.id) ? "" : " 🔒"}</div>` + qs.map(q => row(m, q)).join("");
  }
  if (!list.length) h += '<div class="muted">Nothing here yet: walk, gather or explore to find more.</div>';
  h += storyv(m);
  const done = D.quests.filter(q => s.doneQuests.includes(q.id));
  h += `<details style="margin-top:8px"><summary><b>✅ Completed (${done.length})</b></summary>${done.map(q => `<div class="muted">${q.name}</div>`).join("") || '<div class="muted">None yet.</div>'}</details>`;
  const rum = D.quests.filter(q => q.hidden && !s.revealed.includes(q.id) && E.regionKnown(s, q.region)).length;
  h += `<div class="card muted" style="margin-top:6px">❔ Rumoured: ${rum ? rum + " hidden quests in known lands. Explore, pay for tavern rumors, or find special maps." : "nothing more is whispered about."}</div>`;
  return h;
}
