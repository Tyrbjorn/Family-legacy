import { ordersCard } from "./orders-ui.js";
import { timerBar } from "./progress.js";
// Crafting tab: recipes (filters, quality odds, materials), crafter queues, minion orders, stations and reserves.
import * as E from "../engine.js";
import { U } from "./state.js";
import { RI, costStr, fmt, itemStatsHtml, sk } from "./common.js";
import { D, s } from "../main.js";

const pct = p => Math.round(p * 100) + "%";

function crafterOptions() {
  const fam = E.living(s).filter(m => E.isAdult(m));
  const opts = fam.map(m => [`m:${m.id}`, `${m.name}${E.isMemberCrafter(m) ? " 🔨" : ""}`]);
  for (const mi of s.minions.filter(E.isMinionCrafter))
    opts.push([`mi:${mi.uid}`, `${mi.name} (${E.npcClass(mi.cls).name})`]);
  return opts;
}

function selected() {
  const opts = crafterOptions();
  if (!opts.some(o => o[0] === U.crafter)) U.crafter = opts.length ? opts[0][0] : null;
  if (!U.crafter) return {};
  const [kind, id] = U.crafter.split(":");
  if (kind === "m") return { m: s.members.find(x => x.id === +id) };
  return { mi: s.minions.find(x => x.uid === id) };
}

function filters() {
  const f = U.craftF;
  const stations = [...new Set(D.crafting.recipes.map(r => r.station))];
  const skills = [...new Set(D.crafting.recipes.map(r => r.skill))];
  const sel = (key, list, name) =>
    `<select data-a="craftf" data-v="${key}"><option value="all">${name}: all</option>${list
      .map(
        x =>
          `<option value="${x}" ${f[key] === x ? "selected" : ""}>${key === "station" ? (E.pieceDef(x) || { name: "Mentor's bench" }).name : sk(x).name}</option>`,
      )
      .join("")}</select>`;
  const who = `<select data-a="crafter">${crafterOptions()
    .map(([v, n]) => `<option value="${v}" ${U.crafter === v ? "selected" : ""}>${n}</option>`)
    .join("")}</select>`;
  return `<div class="row" style="flex-wrap:wrap;gap:6px;justify-content:flex-start">${sel("station", stations, "Station")}${sel("skill", skills, "Skill")}<span class="muted">Crafter:</span>${who}</div>`;
}

function recipeCard(rc, who) {
  const { m, mi } = who;
  const iss = E.recipeIssue(s, m || null, rc);
  const odds = E.qualityOdds(s, m || null, rc, mi)
    .map(o => `${o.name} ${pct(o.p)}`)
    .join(" · ");
  const mats = E.matsStatus(s, rc)
    .map(x => `<span style="color:${x.ok ? "#7c7" : "#e77"}">${RI[x.k] || ""}${x.k} ${fmt(x.have)}/${x.need}</span>`)
    .join(" ");
  const act = E.active(s);
  const on = act.action && act.action.type === "craft" && act.action.target === rc.id;
  let btns = "";
  if (m)
    btns += `<button class="b" data-a="cqueue" data-v="${m.id}" data-w="${rc.id}" ${rc.legacy && !E.hasLegacy(s, rc.legacy) ? "disabled" : ""}>+ Queue</button>`;
  if (m && m.id === act.id)
    btns += `<button class="b ${on ? "sel" : ""}" data-a="craft" data-v="${rc.id}" ${iss || !E.isAdult(m) ? "disabled" : ""}>${on ? "Crafting" : "Craft now"}</button>`;
  if (mi)
    btns += `<button class="b ${mi.craftOrder === rc.id ? "sel" : ""}" data-a="mcraft" data-v="${mi.uid}" data-w="${rc.id}">${mi.craftOrder === rc.id ? "Assigned" : "Assign"}</button>`;
  return `<div class="card" style="padding:6px 8px;margin:4px 0"><div class="row"><b>${rc.name}${rc.requiresClass ? ` <span class="tb">🎓 ${E.className(rc.requiresClass)}</span>` : ""}${rc.set ? ` <span class="tb">${E.setDef(rc.set).icon} ${E.setDef(rc.set).name}</span>` : ""}</b><span class="muted">${(E.pieceDef(rc.station) || { name: "Mentor's bench" }).name} · ${sk(rc.skill).name} · ${rc.days}d</span></div>
 ${rc.base && E.itemDef(rc.base) ? itemStatsHtml(E.itemDef(rc.base), m) : ""}<div class="muted">${mats}</div><div class="muted">🎲 ${odds}${iss ? " · 🔒 " + iss : ""}</div><div class="row" style="justify-content:flex-end;gap:4px">${btns}</div></div>`;
}

function queues() {
  let h = `<h3>📋 Queues & orders</h3>`;
  for (const m of E.living(s).filter(x => (x.craftQueue || []).length || (x.action && x.action.type === "craft"))) {
    const a = m.action && m.action.type === "craft" ? m.action : null;
    const cur = a && (a.target || a.rc);
    h += `<div class="card"><b>${m.name}</b> <span class="muted">${cur ? "now: " + E.recipeDef(cur).name + ` (${Math.floor(a.progress || 0)}/${E.recipeDef(cur).days}d)` : "idle"}</span>${(
      m.craftQueue || []
    )
      .map(
        (id, i) =>
          `<div class="row"><span>${i + 1}. ${E.recipeDef(id).name}</span><button class="b" data-a="cunq" data-v="${m.id}" data-w="${i}">✕</button></div>`,
      )
      .join("")}${a ? timerBar(E.memberTimer(s, m)) : ""}</div>`;
  }
  for (const mi of s.minions.filter(E.isMinionCrafter))
    h += `<div class="muted">${mi.name}: ${mi.job === "craft" ? "crafting " + (mi.craftOrder ? E.recipeDef(mi.craftOrder).name : "best available") : "not on the craft job (set it on the Minions tab)"}</div>`;
  return h;
}

function stations() {
  let h = `<h3>⚙️ Stations</h3>`;
  for (const st of s.structures)
    for (const pid of st.pieces) {
      const rates = E.processRates(s, st, pid);
      if (!rates.length) continue;
      const pz = E.isPaused(s, st.uid, pid);
      const p = E.pieceDef(pid);
      h += `<div class="row" style="${pz ? "opacity:.55" : ""}"><span>${p.icon} ${p.name} <span class="muted">in ${E.structName(st)} · ${rates.map(r => r.out + " " + r.rate.toFixed(1) + "/d").join(", ")}</span></span><button class="b" data-a="toggle" data-v="${st.uid}" data-w="${pid}">${pz ? "Resume" : "Pause"}</button></div>`;
    }
  h += `<div class="row" style="flex-wrap:wrap;gap:6px;margin:4px 0"><span class="muted">Keep in reserve (stations never use below):</span>${Object.keys(
    E.DEFAULT_RESERVE,
  )
    .map(
      k =>
        `<label class="muted">${RI[k] || ""}${k} <input type="number" min="0" step="10" style="width:56px" data-a="reserve" data-v="${k}" value="${E.reserveOf(s, k)}"></label>`,
    )
    .join("")}</div>`;
  return h;
}

export function craftingv() {
  const who = selected();
  const f = U.craftF;
  const list = D.crafting.recipes.filter(
    r =>
      (f.station === "all" || r.station === f.station) &&
      (f.skill === "all" || r.skill === f.skill) &&
      (!r.hidden || s.unlocks.includes("recipe:" + r.id)),
  );
  let h = ordersCard() + `<div class="card"><b>🔨 Crafting</b><div class="muted">Quality (Crude→Masterwork) comes from skill, stations, synergies and profession. Masterworks earn renown.</div>${filters()}</div>`;
  h += list.map(rc => recipeCard(rc, who)).join("") || `<div class="muted">No recipes match.</div>`;
  return h + queues() + stations();
}
