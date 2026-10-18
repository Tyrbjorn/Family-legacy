// R30 Quests tab (Work group, first sub-tab): Start here (rats) · Active · Available (known + seen; locked regions with 🔒) · Story · Completed · Rumoured.
import * as E from "../engine.js";
import { D, s } from "../main.js";
import { U } from "./state.js";
import { qKind, storyv } from "./map-tab.js";

const rew = q => Object.entries(q.reward || {}).map(([k, v]) => `${v} ${k === "coin" ? "🪙" : k}`).join(" · ");
const ratsOpen = () => !s.doneQuests.includes("rats") && D.quests.some(q => q.id === "rats");
export const questBadge = () => (ratsOpen() ? 1 : 0) + E.deliverable(s);
const ICO = { wood: "🪵", stone: "🪨", thyme: "🌿", food: "🍞", fish: "🐟", meat: "🥩", hides: "🦊", planks: "🪚", flour: "🌾", milk: "🥛", eggs: "🥚", blocks: "🧱", ale: "🍺", berries: "🫐", leather: "🧥", butter: "🧈" };
// R31 villager requests: one card per NPC with what they want, your stock and a Deliver button
export function requestsv() {
  const npcs = E.openNpcs(s); // R42: village folk appear with your village
  if (!npcs.length) return "";
  const cards = npcs.map(n => {
    const w = E.wantsOf(s, n.id), r = E.openRequest(s, n.id), x = (s.req || {})[n.id] || {}, iss = E.deliverIssue(s, n.id);
    const ac = D.activities.find(a => a.id === n.task);
    if (!w) return `<div class="card" style="padding:5px 8px;margin:3px 0">${n.icon} <b>${n.name}</b> <span class="muted">· nothing needed right now (back in ${Math.max(1, (x.at || 0) - s.day)}d) · favour ${x.fav || 0}</span></div>`;
    const want = Object.entries(w).map(([k, v]) => `${ICO[k] || ""} ${Math.floor(s.res[k] || 0)}/${v} ${k}`).join(" · ");
    const rw = r.reward || {}, rs = [rw.coin && rw.coin + "🪙", rw.food && rw.food + " food", ...Object.entries(rw.res || {}).map(([k, v]) => v + " " + k), ...(rw.items || []).map(id => (D.items.find(i => i.id === id) || {}).name), rw.renown && rw.renown + " renown"].filter(Boolean).join(" · ");
    return `<div class="card ${iss ? "" : "tut"}" style="padding:6px 8px;margin:4px 0"><div class="row"><span>${n.icon} <b>${n.name}</b> wants ${want}<br><span class="muted">Reward: ${rs}${r.extra ? " · ✨ something special" : ""}${ac ? ` · fed by ${ac.icon} ${ac.name}` : ""} · favour ${x.fav || 0}</span></span><button class="b ${iss ? "" : "sel"}" data-a="deliver" data-v="${n.id}" ${iss ? "disabled" : ""}>Deliver</button></div>${iss ? `<div class="muted">${iss}</div>` : ""}</div>`;
  });
  return `<h3>📮 Requests (${E.deliverable(s)} ready)</h3><div class="muted" style="font-size:12px">Millbrook folk (and later your own village) want goods your Tasks and chores make. Delivering at home is instant.</div>` + cards.join("");
}

function row(m, q, star) {
  const on = m.action && m.action.type === "quest" && m.action.target === q.id;
  const rg = D.regions.find(r => r.id === q.region);
  const open = E.regionOpen(s, q.region);
  const iss = !open ? `region locked (CP ${rg.cp})` : E.questIssue(s, m, q) || E.questAgeIssue(m, q, s);
  const k = qKind(q);
  return `<div class="card ${star ? "tut" : ""}" style="padding:6px 8px;margin:4px 0"><div class="row"><span>${star ? "⭐ <b>Start here:</b> " : k[0] + " "}<b>${q.name}</b><br><span class="muted">${rg.icon || ""} ${rg.name} · ${q.risk} · CP ${q.cp} · ${q.days}d · ${rew(q)} · 🚶 ${E.travelDays(q.id)}d</span>${q.desc && (q.grants || q.firstGrants || q.deliver) ? `<br><span class="muted" style="font-size:11px">${q.desc}</span>` : ""}</span>
<span class="row" style="gap:4px"><button class="b" data-a="qmap" data-v="${q.id}" title="Show on the map">📍</button><button class="b ${on ? "sel" : ""}" data-a="quest" data-v="${q.id}" ${iss ? "disabled" : ""}>${on ? "On it" : "Go"}</button></span></div>${iss ? `<div class="muted">🔒 ${iss}</div>` : ""}</div>`;
}

export function questsv() {
  const m = E.active(s);
  let h = "";
  const rats = D.quests.find(q => q.id === "rats");
  if (ratsOpen()) h += row(m, rats, true);
  h += requestsv();
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
