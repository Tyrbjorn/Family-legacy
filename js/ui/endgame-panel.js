// Estate tab: late-game coin sinks and defense (stable, stone quarries, town patronage, walls/watchtower/palisade, raids).
import * as E from "../engine.js";
import { anIco, costStr, fmt } from "./common.js";
import { D, s } from "../main.js";

const btn = (a, v, iss, cost) => `<button class="b" data-a="${a}" data-v="${v}" ${iss ? "disabled" : ""}>${iss && !/^needs \d/.test(iss) ? "🔒 " + iss : costStr(cost)}</button>`;
const row = (label, note, b) => `<div class="row" style="margin:3px 0"><span>${label} <span class="muted">${note}</span></span>${b}</div>`;

// R47 Architects' Guild: the family's build discounts by tag and road works (when open)
function archRows() {
  const tags = (D.guilds.build || {}).tags || [];
  const disc = tags.map(k => [k, E.buildDisc(s, k)]).filter(([, v]) => v > 0);
  let h = disc.length ? `<div class="muted" id="arch-disc">📐 Architects' discounts: ${disc.map(([k, v]) => `${k} −${Math.round(v * 100)}%`).join(" · ")}</div>` : "";
  const RW = D.world && D.world.roadWorks;
  if (!RW) return h;
  const r = E.roads(s);
  if (!E.roadsOpen(s) && !r.track) return h + `<div class="muted">🛤️ Road works: ${E.roadIssue(s, "track")}.</div>`;
  h += `<div style="margin-top:4px" id="roadworks"><b>🛤️ Road works</b> <span class="muted">+${Math.round(E.roadEdge(s) * 100)}% trade-route earnings · condition ${Math.round((r.cond ?? 1) * 100)}%</span></div>`;
  for (const k of ["track", "road"]) h += row(k === "track" ? "🟫 Cart track" : "🛣️ Paved road", `${r[k]}/${RW.max[k]} · +${Math.round(RW.fx[k] * 100)}% each`, r[k] < RW.max[k] ? btn("egroad", k, E.roadIssue(s, k), E.roadCost(s, k)) : '<span class="tb">max</span>');
  if ((r.cond ?? 1) < 1) h += row("🔧 Repair roads", "wear 5% a year", btn("egrepair", 0, E.repairIssue(s), E.repairCost(s)));
  return h;
}

export function endgamePanel() {
  if (!E.established(s)) return "";
  const G = D.endgame;
  if (!G) return "";
  const mt = E.mountTier(s), nm = G.mounts[mt];
  let h = `<div class="card" id="holdings"><div class="row"><b>🏰 Holdings & defense</b><span class="muted">one-time purchases</span></div>`;
  h += row(`${anIco(["", "pony", "courser", "warhorse"][mt] || "pony", "🐴", 18)} Stable`, mt ? `${G.mounts[mt - 1].name}: travel ×${E.mountSpeed(s)}` : "no mounts yet", nm ? btn("egmount", 0, E.mountIssue(s), nm.cost) : "");
  for (const q of G.quarries) {
    const t = E.quarryTier(s, q.id), nx = q.tiers[t];
    h += row(`${q.icon} ${q.name}`, t ? `tier ${t}: ${q.tiers[t - 1].rate} ${q.res}/day` : `at the ${E.findId(D.nodes, q.node).name}`, nx ? btn("egquarry", q.id, E.quarryIssue(s, q.id), E.bcost(s, nx.cost, "quarry", t > 0)) : "");
  }
  for (const k of ["wall", "tower", "palisade"]) {
    const d = G.defenses[k], t = E.defTier(s, k), nx = d.tiers[t];
    h += row(`${d.icon} ${t ? d.tiers[t - 1].name : d.name}`, t ? `+${d.tiers[t - 1].power} defense` : "", nx ? btn("egdef", k, E.defIssue(s, k), E.bcost(s, nx.cost, "defense", t > 0)) : "");
  }
  h += archRows();
  if (E.era(s).n >= G.raids.phase) h += `<div class="muted">⚔️ Raid strength ~${E.raidPower(s)} vs your defense ${E.raidDefense(s)}${E.hasWarning(s) && s.eg.raidAt ? ` · next raid in ~${s.eg.raidAt - s.day} days` : ""}.</div>`;
  h += `<div style="margin-top:4px"><b>🏛️ Town patronage</b></div>`;
  for (const p of E.patronOptions(s)) {
    const iss = E.patronIssue(s, p.id);
    h += row(`${p.icon} ${p.name}`, `${E.findId(D.towns, p.town).name}: ${p.sell ? "+" + p.sell * 100 + "% sell" : "−" + p.buy * 100 + "% market buys"}`, iss === "funded" ? '<span class="tb">funded</span>' : btn("egfund", p.id, iss, p.cost));
  }
  return h + "</div>";
}
