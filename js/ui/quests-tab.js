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
    const ac = E.findId(D.activities, n.task);
    if (!w) return `<div class="card" style="padding:5px 8px;margin:3px 0">${n.icon} <b>${n.name}</b> <span class="muted">· nothing needed right now (back in ${Math.max(1, (x.at || 0) - s.day)}d${Object.values(x.done || {}).some(v => v > ((D.requests.repeat || {}).free || 99)) ? ", asks less often now" : ""}) · favour ${x.fav || 0}</span></div>`;
    const want = Object.entries(w).map(([k, v]) => `${ICO[k] || ""} ${Math.floor(s.res[k] || 0)}/${v} ${E.resName(k)}`).join(" · ");
    const rw = r.reward || {}, rs = [rw.coin && rw.coin + "🪙", rw.food && rw.food + " food", ...Object.entries(rw.res || {}).map(([k, v]) => v + " " + k), ...(rw.items || []).map(id => (E.findId(D.items, id) || {}).name), rw.renown && rw.renown + " renown"].filter(Boolean).join(" · ");
    const tw = n.town !== "millbrook" && n.town !== "village" ? E.findId(D.towns, n.town) : null; // R48: Gull's Landing folk
    return `<div class="card ${iss ? "" : "tut"}" style="padding:6px 8px;margin:4px 0"><div class="row"><span>${n.icon} <b>${n.name}</b>${tw ? ` <span class="muted">(${tw.icon} ${tw.name})</span>` : ""} wants ${want}<br><span class="muted">Reward: ${rs}${r.extra ? " · ✨ something special" : ""}${ac ? ` · fed by ${ac.icon} ${ac.name}` : ""} · favour ${x.fav || 0}</span></span><button class="b ${iss ? "" : "sel"}" data-a="deliver" data-v="${n.id}" ${iss ? "disabled" : ""}>Deliver</button></div>${iss ? `<div class="muted">${iss}</div>` : ""}</div>`;
  });
  return `<h3>📮 Requests (${E.deliverable(s)} ready)</h3><div class="muted" style="font-size:12px">Millbrook folk (and later your own village) want goods your Tasks and chores make. Delivering at home is instant; folk in other towns (Gull's Landing) take deliveries once someone has traded or worked there.</div>` + cards.join("");
}

function row(m, q, star) {
  const on = m.action && m.action.type === "quest" && m.action.target === q.id;
  const rg = E.findId(D.regions, q.region);
  const open = E.regionOpen(s, q.region);
  const iss = !open ? `region locked (CP ${rg.cp})` : E.questIssue(s, m, q) || E.questAgeIssue(m, q, s);
  const k = qKind(q);
  return `<div class="card ${star ? "tut" : ""}" style="padding:6px 8px;margin:4px 0"><div class="row"><span>${star ? "⭐ <b>Start here:</b> " : k[0] + " "}<b>${q.name}</b><br><span class="muted">${rg.icon || ""} ${rg.name} · ${q.risk} · CP ${q.cp} · ${q.days}d · ${rew(q)} · 🚶 ${E.travelDays(q.id)}d${(so => (so ? ` · ${so.mode === "boat" ? "⛵" : "⛴️"} ${so.days}d${so.fare ? ` (${so.fare}🪙)` : ""}` : ""))(E.seaOption(s, q.id))}${q.act ? ` · Act ${q.act}${q.beat ? " beat" : ""}` : ""}${q.chain ? ` · 🪸 ${E.questChainName(q.chain)} ${q.step}/${E.questChain(q.chain).length}` : ""}${q.check ? ` · 🎲 ${E.checkText(m, q)}` : ""}</span>${q.desc && (q.grants || q.firstGrants || q.deliver || q.chain) ? `<br><span class="muted" style="font-size:11px">${q.desc}</span>` : ""}</span>
<span class="row" style="gap:4px"><button class="b" data-a="qmap" data-v="${q.id}" title="Show on the map">📍</button><button class="b ${on ? "sel" : ""}" data-a="quest" data-v="${q.id}" ${iss ? "disabled" : ""}>${on ? "On it" : "Go"}</button></span></div>${iss ? `<div class="muted">🔒 ${iss}</div>` : ""}</div>`;
}

// R49: choices waiting from a quest's ending (the reef chain): never block play
export function choicesv() {
  return E.pendingChoices(s).map(c => {
    const ch = E.choiceOf(c.q);
    return ch ? `<div class="card tut" id="choice-${c.id}" style="padding:8px"><b>❓ ${ch.title}</b><div class="muted">${ch.text}</div>${ch.options.map(o => `<div class="row" style="margin-top:6px"><span>${o.icon || ""} <b>${o.name}</b><br><span class="muted">${o.text}</span></span><button class="b" data-a="choose" data-v="${c.id}:${o.id}">Choose</button></div>`).join("")}</div>` : "";
  }).join("");
}
// R49: optional quest chains (quests.json chain/step): shown once their first step is in reach
export function chainsv() {
  const ids = [...new Set(D.quests.filter(q => q.chain).map(q => q.chain))];
  return ids.map(id => {
    const L = E.questChain(id), n = E.questChainStep(s, id);
    if (!n && !E.questVisible(s, L[0])) return "";
    const pick = E.choiceMade(s, (L.find(q => q.choice) || {}).choice?.id);
    const opt = pick && (L.find(q => q.choice).choice.options.find(o => o.id === pick) || {});
    return `<div class="card" id="chain-${id}" style="padding:6px 8px;margin:4px 0"><b>🪸 ${E.questChainName(id)}</b> <span class="muted">${n}/${L.length}${L[0].act ? " · Act " + L[0].act : ""} · optional</span>${L.map(q => `<div class="muted">${s.doneQuests.includes(q.id) ? "✅" : E.questVisible(s, q) ? "▫️" : "🔒"} ${q.step}. ${E.questVisible(s, q) || s.doneQuests.includes(q.id) ? q.name : "(Old Tobiah may tell you more)"}</div>`).join("")}${opt ? `<div style="margin-top:4px">${opt.icon || ""} You chose: <b>${opt.name}</b>. The sea-cave stays sealed.</div>` : ""}</div>`;
  }).join("");
}

// R77: Quests is split into named parts (the Quests tab composes them as collapsible sections; Story has its own sub-tab).
export function questParts() {
  const m = E.active(s);
  const P = {};
  let h = "";
  const rats = E.findId(D.quests, "rats");
  if (ratsOpen()) h += row(m, rats, true);
  h += choicesv();
  P.top = h;
  P.requests = requestsv();
  P.chains = chainsv();
  h = "";
  const act = E.living(s).filter(x => x.action && x.action.type === "quest");
  h += `<h3>⚔️ Active (${act.length})</h3>` + (act.length ? act.map(x => {
    const q = E.findId(D.quests, x.action.target);
    return `<div class="card" style="padding:5px 8px;margin:3px 0"><b>${x.name}</b> · ${q ? q.name : x.action.target}<div class="bar"><i style="width:${q ? Math.min(100, ((x.action.progress || 0) / q.days) * 100) : 0}%"></i></div></div>`;
  }).join("") : '<div class="muted">Nobody is on a quest.</div>');
  P.active = h;
  h = "";
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
  P.available = h;
  P.story = storyv(m);
  h = "";
  const done = D.quests.filter(q => s.doneQuests.includes(q.id));
  h += `<details style="margin-top:8px"><summary><b>✅ Completed (${done.length})</b></summary>${done.map(q => `<div class="muted">${q.name}</div>`).join("") || '<div class="muted">None yet.</div>'}</details>`;
  const rum = D.quests.filter(q => q.hidden && !s.revealed.includes(q.id) && E.regionKnown(s, q.region)).length;
  h += `<div class="card muted" style="margin-top:6px">❔ Rumoured: ${rum ? rum + " hidden quests in known lands. Explore, pay for tavern rumors, or find special maps." : "nothing more is whispered about."}</div>`;
  P.done = h;
  return P;
}
export const questsv = () => { const P = questParts(); return P.top + P.requests + P.chains + P.active + P.available + P.story + P.done; };
