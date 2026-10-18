// R45: 📋 town quest board (map town card / pin) and 🧭 quest lines card (Map tab), plus the line route on the map.
import * as E from "../engine.js";
import { RI, fmt } from "./common.js";
import { D, s } from "../main.js";
import { U } from "./state.js";

const KIND = { deliver: "📦", clear: "⚔️", escort: "🛒" };
const bandTag = n => { const b = E.bandDef(n); return `<span class="tb" title="${b.name} band · rewards ×${b.mult}">${b.icon} ${b.name}</span>`; };
export function boardCard(tid, m) {
  if (!E.boardTowns(s).some(t => t.id === tid)) return "";
  const J = E.boardOf(s, tid), left = Math.max(0, E.boardNext(s, tid) - (s.day || 0));
  const row = j => {
    const iss = E.jobIssue(s, m, j.uid), who = j.taken != null ? (E.findId(s.members, j.taken) || {}).name : null;
    const what = j.kind === "deliver" ? `${j.n}${RI[j.res] || " " + j.res}` : j.kind === "clear" ? `CP ${j.cp}` : `to ${E.boardPlace(j.to)}`;
    const ord = j.kind === "deliver" && !who && /needs/.test(iss || "") ? `<button class="b" style="font-size:11px" data-a="bjorder" data-v="${j.uid}" title="Add a Work Order for what's missing">📋 Order it</button>` : "";
    return `<div class="card boardjob" style="padding:5px 8px;margin:3px 0"><div class="row"><span>${KIND[j.kind] || "📋"} <b>${j.name}</b> ${bandTag(j.band)}${j.stretch ? ' <span class="tb" title="One band above yours">⬆️ stretch</span>' : ""}</span></div>` +
      `<div class="row" style="gap:4px;justify-content:flex-start;flex-wrap:wrap"><span class="muted" style="font-size:12px">${what} · ${j.days}d at the spot · 🚶 ${E.travelDays(E.jobDest(tid, j))}d each way · <b>${fmt(j.coin)}🪙</b> +${j.favour || 0} favour</span>` +
      (who ? `<span class="muted">🚶 ${who} is on it</span>` : `<button class="b" data-a="bjtake" data-v="${j.uid}" ${iss ? "disabled" : ""} title="${iss || ""}">Take (${m.name.split(" ")[0]})</button>${iss ? `<span class="muted" style="font-size:11px">${iss}</span>` : ""}${ord}`) + `</div></div>`;
  };
  return `<div class="card townboard" data-board="${tid}" style="padding:6px 8px;margin-top:6px"><div class="row"><b>📋 Board</b><span class="muted">favour ${E.townFavour(s, tid)}/100 · new jobs in ${left}d</span></div>` +
    `<div class="muted" style="font-size:12px">Your band: ${bandTag(E.bandOf(s))}. Two jobs from your band, one stretch from the band above. Auto-Adventure takes jobs from your band.</div>${J.map(row).join("") || '<div class="muted">Nothing posted.</div>'}</div>`;
}
export function linesCard(m) {
  const L = E.lineDefs();
  const row = l => {
    const st = E.lineState(s, l.id), lock = E.lineIssue(s, l), iss = !lock && E.stopIssue(s, m, l.id), n = st ? (st.done ? l.stops.length : st.stop) : 0;
    const who = st && st.who != null ? (E.findId(s.members, st.who) || {}).name : null;
    const stops = l.stops.map((x, i) => `<span style="${i < n ? "opacity:.6;text-decoration:line-through" : i === n && !lock ? "font-weight:bold" : ""}">${i + 1}. ${E.boardPlace(x.at)}</span>`).join(" → ");
    const btn = st && st.done ? '<span class="muted">🏁 complete</span>' : lock ? `<span class="muted">🔒 ${lock}</span>` : `<button class="b" data-a="lgo" data-v="${l.id}" ${iss ? "disabled" : ""} title="${iss || ""}">${n ? "Next stop" : "Start"} (${m.name.split(" ")[0]})</button>${iss ? `<span class="muted" style="font-size:11px">${iss}</span>` : ""}${/needs \d/.test(iss || "") ? `<button class="b" style="font-size:11px" data-a="lorder" data-v="${l.id}">📋 Order it</button>` : ""}`;
    return `<div class="card questline" data-line="${l.id}" style="padding:5px 8px;margin:3px 0;${lock ? "opacity:.75" : ""}"><div class="row"><span>${l.icon} <b>${l.name}</b> ${bandTag(l.band)}</span><button class="b ${U.lineShow === l.id ? "sel" : ""}" style="font-size:11px" data-a="lshow" data-v="${l.id}">🗺️ Route</button></div>` +
      `<div style="font-size:12px">🏡 → ${stops} → 🏡</div>` +
      `<div class="muted" style="font-size:12px">${n < l.stops.length ? `Now: ${l.stops[Math.min(n, l.stops.length - 1)].name}` : ""} · end reward ${fmt(Math.round((l.reward.coin || 0) * E.bandMult(l.band)))}🪙${l.reward.renown ? ` +${l.reward.renown}⭐` : ""}${who && !(st && st.done) ? ` · ${who} is on it (Auto-Adventure follows it)` : ""}</div><div class="row" style="gap:4px;justify-content:flex-start;flex-wrap:wrap">${btn}</div></div>`;
  };
  return `<div class="card" id="questlines"><b>🧭 Quest lines</b><div class="muted" style="font-size:12px">Several stops in a row; each stop is a normal trip with its own reward, and a bigger reward at the end.</div>${L.map(row).join("")}</div>`;
}
// SVG overlay: the chosen (or in-progress) line's route, numbered stops
export function lineRouteSvg(MP) {
  const id = U.lineShow || (E.lineDefs().find(l => { const st = E.lineState(s, l.id); return st && !st.done; }) || {}).id;
  if (!id) return "";
  const pts = E.lineRoute(id).map(p => (p === "home" ? MP.home : E.ptOf(p)));
  pts.push(MP.home);
  const n = (E.lineState(s, id) || {}).stop || 0;
  return `<g class="lineroute"><polyline points="${pts.map(q => q.x + "," + q.y).join(" ")}" fill="none" stroke="#7a3fb0" stroke-width="7" stroke-dasharray="18 10" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>` +
    pts.slice(1, -1).map((q, i) => `<g><circle cx="${q.x}" cy="${q.y - 40}" r="24" fill="${i < n ? "#888" : "#7a3fb0"}" stroke="#fff" stroke-width="2"/><text x="${q.x}" y="${q.y - 31}" font-size="26" fill="#fff" text-anchor="middle" font-weight="bold">${i + 1}</text></g>`).join("") + `</g>`;
}
