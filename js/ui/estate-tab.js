import { pbar, secPerDay } from "./progress.js";
import * as E from "../engine.js";
import { RI, costStr, doing, fmt, memberLine } from "./common.js";
import { D, s } from "../main.js";
import { buildingCard } from "./estate-card.js";

export function landShop(where) {
  return D.estate.lands
    .filter(l => !s.land.includes(l.id) && (!where || l.towns.includes(where)))
    .map(
      l =>
        `<div class="card row" style="padding:6px 8px;margin:4px 0"><span>${l.icon} ${l.name} <span class="muted">+${l.slots} land slots${l.requires && !s.land.includes(l.requires) ? " · needs " + D.estate.lands.find(x => x.id === l.requires).name : ""}${l.desc ? " · " + l.desc : ""}</span></span><button class="b" data-a="land" data-v="${l.id}" ${E.canBuyLand(s, l.id) ? "" : "disabled"}>${costStr(l.cost)}</button></div>`,
    )
    .join("");
}

export function pieceRow(p, btn) {
  return `<div class="row" style="margin:3px 0"><span>${p.icon} ${p.name} <span class="muted">${
    p.desc ||
    Object.entries(p.bonus)
      .map(([k, v]) => k + ": " + v)
      .join(", ")
  }</span></span>${btn}</div>`;
}

// Stronghold-style food panel: menu, variety, rations, days of stock, active bonuses
export function foodPanelv() {
  const f = E.foodPanel(s);
  const days = f.days === Infinity ? "∞" : f.days >= 999 ? "999+" : fmt(f.days);
  const last = f.last;
  const warn = last && last.short > 0.01 ? `<div style="color:#e77">⚠️ Shortage: ate ${Math.round(last.ratio * 100)}% of needs. Contentment and output fall.</div>` : "";
  const emerg = last && last.emergency && last.emergency.length ? `<div class="muted">Ate off-menu as a last resort: ${last.emergency.map(k => RI[k] || k).join(" ")}</div>` : "";
  return `<div class="card" id="foodpanel"><div class="row"><b>🍽️ Food</b><span class="muted">${f.variety} type${f.variety === 1 ? "" : "s"} · ${fmt(f.need)}🍞/day · ${days} days of stock · contentment ${f.morale >= 0 ? "+" : ""}${f.morale.toFixed(1)}</span></div>
 <div class="muted">Everyone eats evenly from every food on the menu. More types = more satiation and contentment (diminishing). Quality makes each portion go further.</div>
 <div class="row" style="flex-wrap:wrap;gap:4px;justify-content:flex-start;margin:4px 0"><span class="muted">Rations:</span>${E.RATIONS()
   .map(r => `<button class="b ${f.ration.id === r.id ? "sel" : ""}" data-a="ration" data-v="${r.id}" title="${r.mult}× food, ${r.morale >= 0 ? "+" : ""}${r.morale} contentment">${r.name}</button>`)
   .join("")}</div>
 <div class="row" style="flex-wrap:wrap;gap:4px;justify-content:flex-start">${f.all
   .map(
     x =>
       `<button class="chip ${x.on ? "sel" : ""}" data-a="diet" data-v="${x.k}" ${x.k === "food" ? "disabled" : ""} title="${x.on ? "On the menu" : "Kept for cooking"} · value ${x.value.toFixed(2)}">${RI[x.k] || ""} ${x.k} ${fmt(x.have)}</button>`,
   )
   .join("")}</div>
 <div class="muted">Bonuses: ${f.bonuses.length ? f.bonuses.join(" · ") : "none"}</div>${warn}${emerg}</div>`;
}

export function estate() {
  let h = foodPanelv() + `<div class="card"><div class="row"><b>🗺️ Land</b><span>${E.landUsed(s)}/${E.landSlots(s)} land slots used</span></div><div class="muted">${s.land.map(id => D.estate.lands.find(l => l.id === id).name).join(", ")}</div></div>${landShop()}`;
  h += `<div class="card"><b>📦 Capacity</b><div class="muted">🍞 ${fmt(s.res.food)}/${fmt(E.foodCap(s))} food · materials cap ${fmt(E.matCap(s))} each</div>
 <div class="muted">${Object.entries(D.estate.resourceTiers)
   .map(
     ([n, t]) =>
       `<b>T${n} ${t.name}:</b> ${t.res.length ? t.res.map(k => `${RI[k] || ""}${k} ${fmt(s.res[k] || 0)}`).join(" · ") : t.planned.join(", ")}`,
   )
   .join(
     "<br>",
   )}</div>${E.craftingUnlocked(s) ? '<div class="muted">📦 Reserves and station overview moved to the <a data-tab="craft" href="#">🔨 Crafting tab</a>.</div>' : reservesRow()}<div class="muted">Family eats ${E.living(s).length}🍞/day · followers eat ${E.minionFood(s)}🍞/day (× rations) · beds ${E.living(s).length}/${E.bedrooms(s)} · follower bunks ${E.housingUsed(s, "bunk")}/${E.housingCap(s, "bunk")}</div></div>`;
  const syn = E.allSynergies(s);
  h +=
    `<h3>✨ Active synergies (${syn.length})</h3>` +
    (syn.length
      ? syn
          .map(
            y =>
              `<div>${y.icon} <b>${y.name}</b> <span class="muted">${y.desc} · in ${E.structDef(s.structures.find(x => x.uid === y.where).type).name}</span></div>`,
          )
          .join("")
      : '<div class="muted">Place related pieces in the same building: ' +
        D.estate.synergies.map(y => y.pieces.map(p => E.pieceDef(p).name).join(" + ")).join(" · ") +
        "</div>");
  h += `<h3>🛖 Buildings & stations</h3>`;
  h += `<h3>🛖 Buildings & stations</h3>`;
  s.structures.forEach((st, k) => (h += buildingCard(st, k)));
  h +=
    `<div class="muted">Build new:</div>` +
    D.estate.structures
      .filter(d => !d.upgradeFrom)
      .map(d => {
        const iss = E.structIssue(s, d.id);
        return `<div class="card row" style="padding:6px 8px;margin:4px 0"><span>${d.icon} ${d.name} <span class="muted">${d.land} land · ${d.desc}</span></span><button class="b" data-a="struct" data-v="${d.id}" ${iss ? "disabled" : ""}>${iss && iss !== "cannot afford" ? "🔒 " + iss : costStr(d.cost)}</button></div>`;
      })
      .join("");
  if (s.pieceStore.length)
    h += `<div class="muted">📦 In storage: ${s.pieceStore.map(p => E.pieceDef(p).name).join(", ")}</div>`;
  h += `<h3>🌾 Outdoor buildings</h3>`;
  for (const b of D.buildings) {
    const lv = s.buildings[b.id];
    const c = E.cost(s, b);
    const iss = E.buildIssue(s, b);
    h += `<div class="card row"><span>${b.icon} ${b.name} <b>Lv${lv}</b><br><span class="muted">${b.land} land slot · ${b.desc}</span></span><button class="b" data-a="build" data-v="${b.id}" ${iss ? "disabled" : ""}>${lv >= b.max ? "Max" : iss && iss !== "cannot afford" ? "🔒 " + iss : costStr(c)}</button></div>`;
  }
  h += `<div class="muted">Upkeep: ${Object.values(s.buildings).reduce((a, b) => a + b, 0) * D.tuning.upkeepPerBuildingMonth}🪙 per month.</div>`;
  return h;
}

export function estatev() {
  if (!E.hasLand(s))
    return (
      `<div class="card"><b>🔒 Landless</b><div class="muted">The family has no land yet. Buy the Starting Plot (2 land slots) here, in Millbrook on the Map, or in the Main shop. Then raise a Shack (1 land slot, 2 station slots) and a Small Garden.</div></div>` +
      landShop()
    );
  let h = `<div class="card"><b>🏞️ ${E.estateStage(s)}</b><div class="muted">${E.established(s) ? "Your holdings are established. Direct idle family members below." : "Scrub land. Build a Shack and fill its 2 slots with stations (Bed + Larder = home; Saw Table + Storage = sawmill; Workbench = crafting)."}</div></div>`;
  h += legacyPanel();
  h += estate();
  h += `<h3>👪 Family & Standing Orders (${E.living(s).length}/${E.bedrooms(s)} beds)</h3>`;
  for (const x of E.living(s)) {
    const o = x.order;
    h += `<div class="card">${memberLine(x)} ${x.id === s.head ? "👑" : ""} ${x.id === s.activeId ? "<b>(playing)</b>" : ""}<div class="muted">${x.spouse ? "Married to " + (s.members.find(y => y.id === x.spouse) || {}).name : "Single"} · ${x.id === s.activeId ? "" : "Doing: " + doing(x.action || (o.type !== "quest" ? o : null))}</div>`;
    if (x.id !== s.activeId) {
      h += `<div class="row" style="margin-top:4px">`;
      if (!E.isAdult(x)) h += `<span class="muted">growing up</span>`;
      else if (!E.established(s)) h += `<span class="muted">Works odd jobs (orders unlock with a House)</span>`;
      else {
        h += `<select data-a="order" data-v="${x.id}">${["train", "quest", "gather", "craft", "work", "rest", "explore", "adventure"].map(t => `<option ${o.type === t ? "selected" : ""}>${t}</option>`).join("")}</select>`;
        const opts = {
          train: D.skills.map(k => [k.id, k.name]),
          quest: D.regions.filter(r => E.regionOpen(s, r.id)).map(k => [k.id, k.name]),
          gather: D.nodes.filter(n => E.known(s, n) && E.regionOpen(s, n.region)).map(k => [k.id, k.name]),
        }[o.type];
        if (opts)
          h += `<select data-a="ordt" data-v="${x.id}">${opts.map(([v, n]) => `<option value="${v}" ${o.target === v ? "selected" : ""}>${n}</option>`).join("")}</select>`;
      }
      h += `<button class="b" data-a="switch" data-v="${x.id}">Play</button></div>`;
    }
    h += `</div>`;
  }
  if (E.established(s))
    h += `<div class="muted">Craft: uses ${costStr(D.tuning.craftCost)} per item every ${D.tuning.craftDays} days.</div>`;
  const dead = s.members.filter(x => !x.alive);
  if (dead.length)
    h += `<h3>🕯️ Ancestors</h3>` + dead.map(x => `<div class="muted">${x.name} (${E.ageY(x)}y)</div>`).join("");
  return h;
}

export function reservesRow() {
  return `<div class="row" style="flex-wrap:wrap;gap:6px;margin:4px 0"><span class="muted">Keep in reserve (stations never use below):</span>${Object.keys(
    E.DEFAULT_RESERVE,
  )
    .map(
      k =>
        `<label class="muted">${RI[k] || ""}${k} <input type="number" min="0" step="10" style="width:56px" data-a="reserve" data-v="${k}" value="${E.reserveOf(s, k)}"></label>`,
    )
    .join("")}</div>`;
}

export function legacyPanel() {
  const L = E.legacyState(s);
  const rate = E.captureRate(s);
  let h = `<div class="card"><div class="row"><b>🏺 Legacy</b><span>⭐ <b>${fmt(L.renown)}</b> Legacy Renown <span class="muted">(earned ${fmt(L.earned)})</span></span></div>
 <div class="muted">${rate ? `🪦 Graveyard captures ${Math.round(rate * 100)}% of a fallen member's renown.` : "🪦 Build a Graveyard (1 land slot) to bank fallen members' renown; upgrade to Crypt/Mausoleum for more."} Upgrades are permanent across generations and new lineages.</div>`;
  for (const u of D.legacy.upgrades) {
    const t = E.legacyTier(s, u.id);
    const nx = u.tiers[t];
    const iss = E.legacyUpIssue(s, u.id);
    const val = t ? (u.id === "speed" ? u.tiers[t - 1].value + "× max speed" : "tier " + t) : "—";
    h += `<div class="row" style="margin:3px 0"><span>${u.icon} <b>${u.name}</b>${u.headline ? ' <span class="tb">headline</span>' : ""}<br><span class="muted">${u.desc} · now: ${val}</span></span><button class="b" data-a="legacy" data-v="${u.id}" ${iss ? "disabled" : ""}>${nx ? (u.id === "speed" ? nx.value + "× · " : "") + nx.cost + "⭐" : "Max"}</button></div>`;
  }
  return h + "</div>";
}
