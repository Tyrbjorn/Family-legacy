// R40: 🌾 Farmstead hub card (Estate tab): fields, tending hours, teamsters, hub upgrades and Auto settings.
import * as E from "../engine.js";
import { RI, fmt } from "./common.js";
import { D, s } from "../main.js";
import { animalsRow } from "./animals-ui.js";

const cost = c => Object.entries(c || {}).map(([k, v]) => `${fmt(v)}${RI[k] || " " + k}`).join(" ");
const r1 = x => Math.round(x * 10) / 10;
const chip = (key, label) => {
  const on = E.fieldsState(s).auto[key];
  return `<button class="b ${on ? "sel" : ""}" data-a="fieldsauto" data-v="${key}" title="Auto: ${label}">${on ? "✅" : "⏸️"} ${label}</button>`;
};

function fieldRow(f, L) {
  const c = E.cropDef(f.crop), st = (L && L.fields[f.id]) || {}, sz = E.sizeDef(f);
  const crops = E.cropIds().filter(id => id === f.crop || E.cropOpen(s, id));
  const sel = `<select data-a="fieldcrop" data-v="${f.id}">${crops.map(id => `<option value="${id}" ${id === f.crop ? "selected" : ""}>${E.cropDef(id).icon} ${E.cropDef(id).name}</option>`).join("")}</select>`;
  const lvlI = E.levelIssue(s, f), szI = E.sizeIssue(s, f);
  const se = E.seasonYield(s, c.res), arrow = se >= 1.15 ? ' <span style="color:#3fbf5f">▲</span>' : se <= 0.85 ? ' <span style="color:#e0533d">▼</span>' : "";
  return `<div class="card fieldrow" data-field="${f.id}" style="margin:4px 0;padding:6px 8px">
<div class="row"><span>${c.icon} ${sel} <span class="muted">Lv ${f.lvl}/${D.fields.levels.max} · ${sz.name}</span></span><span>${r1(E.fieldYield(s, f))}${RI[c.res] || " " + c.res}/day${arrow}</span></div>
<div class="muted" style="font-size:12px">⏱️ ${r1(sz.hours)} h/day · ${st.state || "new"}${st.tended != null && st.state !== "full" ? ` (${Math.round(st.tended * 100)}% tended)` : ""}${f.stopAt ? ` · stop at ${fmt(f.stopAt)}` : ""}</div>
<div class="row" style="gap:4px;justify-content:flex-start;flex-wrap:wrap;margin-top:3px">
<button class="b" data-a="fieldlvl" data-v="${f.id}" ${lvlI ? `disabled title="${lvlI}"` : ""}>⬆️ Level ${lvlI === "max" ? "max" : cost(E.levelCost(f))}</button>
<button class="b" data-a="fieldsize" data-v="${f.id}" ${szI ? `disabled title="${szI}"` : ""} title="More crop, longer to tend">➕ Bigger ${szI === "max" ? "max" : (f.size || 0) < (f.sizeMax || 0) ? "(paid)" : cost(E.sizeCost(f))}</button>
${f.size ? `<button class="b" data-a="fieldsmall" data-v="${f.id}" title="Back to a smaller plot (free to re-enlarge)">➖</button>` : ""}
<button class="b ${f.auto === false ? "" : "sel"}" data-a="fieldtoggle" data-v="${f.id}" title="Auto-tend this field">${f.auto === false ? "⏸️ Paused" : "✅ Auto"}</button></div></div>`;
}

export function fieldsCard() {
  if (!D.fields) return "";
  const st = E.fieldsState(s), L = st.last, slots = E.fieldSlots(s);
  const need = E.tendNeeded(s), avail = E.tendAvail(s);
  let h = `<div class="card" id="fieldshub"><div class="row"><b>🌾 ${D.fields.hub.name} · Fields</b><span class="muted">${st.list.length}/${slots} fields</span></div>`;
  if (!slots && !st.list.length) return h + `<div class="muted">Fields open at the ${D.fields.slots.stage} stage. Each field grows one crop; tending takes about 1 hour a day.</div>${animalsRow()}</div>`;
  h += `<div class="muted">Tending: <b>${r1(need)} h</b> needed / <b>${r1(avail)} h</b> available today${need > avail ? ' · <span style="color:#e0533d">short of hands</span>' : ""}. Farm followers give 8 h, a family member on Tend Fields 8 h, everyone else 1 h.</div>`;
  h += st.list.map(f => fieldRow(f, L)).join("");
  if (st.list.length < slots) {
    const btns = E.cropIds().map(id => { const why = E.buildFieldIssue(s, id); return `<button class="b" data-a="fieldbuild" data-v="${id}" ${why ? `disabled title="${why}"` : ""}>${E.cropDef(id).icon} ${E.cropDef(id).name}</button>`; }).join("");
    h += `<div style="margin-top:4px"><b>New field</b> <span class="muted">(${cost(D.fields.build)})</span><div class="row" style="gap:4px;flex-wrap:wrap;justify-content:flex-start">${btns}</div></div>`;
  }
  const pile = Object.entries(st.pile).filter(([, v]) => v >= 0.5);
  const tm = (s.minions || []).filter(x => x.job === "teamster").length;
  h += `<div style="margin-top:6px">🛒 <b>Teamsters</b> ${tm}/${E.teamsterCap(s)} <span class="muted">· only haul the harvest into storage${L ? ` · hauled today ${fmt(L.byTeamsters)} (farmers ${fmt(L.byFarmers)})` : ""} · farmers carry at most ${fmt(D.fields.haul.farmerDayCap ?? 0)}/day by hand; a teamster ${fmt(D.fields.haul.teamsterPerDay)}/day</span>${pile.length ? `<div class="muted">Waiting at the fields: ${pile.map(([k, v]) => `${fmt(v)}${RI[k] || " " + k}`).join(", ")}</div>` : ""}</div>`;
  const up = k => { const u = E.nextHubUp(s, k), why = E.hubUpIssue(s, k); return u ? `<button class="b" data-a="hubup" data-v="${k}" ${why ? `disabled title="${why}"` : ""}>${k === "worker" ? "🛏️" : "🛒"} ${u.name} (+${u.farmSpots || u.teamsterSpots} ${k === "worker" ? "farm" : "teamster"} spot${(u.farmSpots || u.teamsterSpots) > 1 ? "s" : ""}) ${cost(u.cost)}</button>` : `<span class="muted">${k === "worker" ? "Farm" : "Teamster"} spots maxed</span>`; };
  h += animalsRow(); // R41
  h += rotationRow(); // R43
  h += `<div style="margin-top:6px"><b>Upgrades</b> <span class="muted">· farm spots ${E.jobCap(s, "farm")}</span><div class="row" style="gap:4px;flex-wrap:wrap;justify-content:flex-start">${up("worker")}${up("teamster")}</div></div>`;
  h += `<div style="margin-top:6px"><b>Auto</b> <span class="muted">(free, on from the start)</span><div class="row" style="gap:4px;flex-wrap:wrap;justify-content:flex-start">${chip("tend", "Tend")}${chip("family", "Family helps")}${chip("process", "Process when full")}${chip("haul", "Haul")}${chip("teamsters", "Assign teamsters")}</div></div>`;
  return h + `</div>`;
}

// one line for Main
export function fieldsLine() {
  if (!D.fields) return "";
  const st = E.fieldsState(s);
  if (!st.list.length) return "";
  const L = st.last, tended = L ? st.list.filter(f => (L.fields[f.id] || {}).state === "tended" || (L.fields[f.id] || {}).state === "full").length : 0;
  const short = Math.max(0, E.tendNeeded(s) - E.tendAvail(s));
  const hungry = E.animalTypes().filter(t => E.herdHead(s, t) > 0 && (s.unfed || {})[t] > 0).map(t => `${E.animalDef(t).icon} no feed`).join(" · ");
  return `<div class="muted" id="fieldsline">🌾 Fields: ${tended}/${st.list.length} tended${short > 0 ? ` · ${r1(short)} h short` : ""}${hungry ? ` · <span style="color:#e0533d">${hungry}</span>` : ""}</div>`;
}

// R43: Auto rotation, in data order: what the workers did after the fields (and why a stop was skipped)
const ROT = { fields: "🌾 Fields", chores: "🧹 Chores" };
export function rotationRow() {
  const L = E.fieldsState(s).last;
  if (!L || !L.rotation) return "";
  const why = st => {
    if (st.step === "chores") { const c = L.chores || {}, w = Object.values(c).filter(x => x === "worked").length; return w ? `${w} worked` : Object.keys(c).length ? "skipped: " + [...new Set(Object.values(c))].join("/") : "none open"; }
    if (st.step === "fields") return st.state === "worked" ? "tended" : "skipped";
    const a = (L.animals || {})[st.step]; return !a ? "skipped: none" : a.state;
  };
  const name = k => ROT[k] || ((E.animalDef(k) || {}).icon || "") + " " + ((E.structDef(k) || {}).name || k);
  return `<div style="margin-top:6px" id="rotationrow"><b>🔁 Auto rotation</b> <span class="muted">· spare hours move down the list, skipping anything done, paused or full</span><div class="muted" style="font-size:12px">${L.rotation.map(st => `<span style="color:${st.state === "worked" ? "#9c6" : "#999"}">${name(st.step)}: ${why(st)}${st.hours ? ` (${st.hours} h)` : ""}</span>`).join(" → ")}</div></div>`;
}
