// R41: 🐔/🐄 Animals row on the Farmstead card: head count, feed, tending, eggs/milk waiting, buy + one spots upgrade.
import * as E from "../engine.js";
import { RI, fmt } from "./common.js";
import { s } from "../main.js";

const cost = c => Object.entries(c || {}).map(([k, v]) => `${fmt(v)}${RI[k] || " " + E.resName(k)}`).join(" ");
export function animalsRow() {
  const types = E.animalTypes().filter(t => E.buildingCount(s, t));
  if (!types.length) return "";
  const L = (s.fields && s.fields.last && s.fields.last.animals) || {};
  const rows = types.map(t => {
    const d = E.animalDef(t), n = E.herdHead(s, t), max = E.herdMax(s, t), st = L[t] || {};
    const fed = !((s.unfed || {})[t] > 0), wait = (s.fields?.pile || {})[d.out] || 0;
    const why = E.buyAnimalsIssue(s, t), uw = E.spotsUpIssue(s, t);
    const state = !n ? "empty: buy animals to start" : !fed ? '<span style="color:#e0533d">no feed!</span>' : st.state || "new";
    return `<div class="fieldrow animalrow" style="margin-top:4px"><div class="row"><b>${d.icon} ${d.name} ${n}/${max}</b><span class="muted">${state}</span></div>` +
      `<div class="muted" style="font-size:12px">⏱️ ${d.hours} h/day tending · makes ${RI[d.out] || E.resName(d.out)}${wait > 0.5 ? ` · ${fmt(wait)}${RI[d.out] || ""} waiting for haul` : ""}</div>` +
      `<div class="row" style="gap:4px;flex-wrap:wrap;justify-content:flex-start"><button class="b" data-a="animalbuy" data-v="${t}" ${why ? `disabled title="${why}"` : ""}>${d.buy.label} ${cost(d.buy.cost)}</button>` +
      (uw === "Already built" || uw === "none" ? "" : `<button class="b" data-a="animalup" data-v="${t}" ${uw ? `disabled title="${uw}"` : ""}>➕ ${d.spotsUp.name} (+${d.spotsUp.add}) ${cost(d.spotsUp.cost)}</button>`) + `</div></div>`;
  });
  return `<div style="margin-top:6px" id="animalsrow"><b>Animals</b> <span class="muted">· fed from stock, tended with the fields, no upkeep</span>${rows.join("")}</div>`;
}
