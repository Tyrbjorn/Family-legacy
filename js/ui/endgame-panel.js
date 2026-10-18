// Estate tab: late-game coin sinks and defense (stable, stone quarries, town patronage, walls/watchtower/palisade, raids).
import * as E from "../engine.js";
import { costStr, fmt } from "./common.js";
import { D, s } from "../main.js";

const btn = (a, v, iss, cost) => `<button class="b" data-a="${a}" data-v="${v}" ${iss ? "disabled" : ""}>${iss && !/^needs \d/.test(iss) ? "🔒 " + iss : costStr(cost)}</button>`;
const row = (label, note, b) => `<div class="row" style="margin:3px 0"><span>${label} <span class="muted">${note}</span></span>${b}</div>`;

export function endgamePanel() {
  if (!E.established(s)) return "";
  const G = D.endgame;
  if (!G) return "";
  const mt = E.mountTier(s), nm = G.mounts[mt];
  let h = `<div class="card"><div class="row"><b>🏰 Holdings & defense</b><span class="muted">one-time purchases</span></div>`;
  h += row(`🐴 Stable`, mt ? `${G.mounts[mt - 1].name}: travel ×${E.mountSpeed(s)}` : "no mounts yet", nm ? btn("egmount", 0, E.mountIssue(s), nm.cost) : "");
  for (const q of G.quarries) {
    const t = E.quarryTier(s, q.id), nx = q.tiers[t];
    h += row(`${q.icon} ${q.name}`, t ? `tier ${t}: ${q.tiers[t - 1].rate} ${q.res}/day` : `at the ${E.findId(D.nodes, q.node).name}`, nx ? btn("egquarry", q.id, E.quarryIssue(s, q.id), nx.cost) : "");
  }
  for (const k of ["wall", "tower", "palisade"]) {
    const d = G.defenses[k], t = E.defTier(s, k), nx = d.tiers[t];
    h += row(`${d.icon} ${t ? d.tiers[t - 1].name : d.name}`, t ? `+${d.tiers[t - 1].power} defense` : "", nx ? btn("egdef", k, E.defIssue(s, k), nx.cost) : "");
  }
  if (E.era(s).n >= G.raids.phase) h += `<div class="muted">⚔️ Raid strength ~${E.raidPower(s)} vs your defense ${E.raidDefense(s)}${E.hasWarning(s) && s.eg.raidAt ? ` · next raid in ~${s.eg.raidAt - s.day} days` : ""}.</div>`;
  h += `<div style="margin-top:4px"><b>🏛️ Town patronage</b></div>`;
  for (const p of E.patronOptions(s)) {
    const iss = E.patronIssue(s, p.id);
    h += row(`${p.icon} ${p.name}`, `${E.findId(D.towns, p.town).name}: ${p.sell ? "+" + p.sell * 100 + "% sell" : "−" + p.buy * 100 + "% market buys"}`, iss === "funded" ? '<span class="tb">funded</span>' : btn("egfund", p.id, iss, p.cost));
  }
  return h + "</div>";
}
