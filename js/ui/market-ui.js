// R39: Market Board + ▲/▼ price tags + town "Short of / Flooded with" tags (read-only views over E.market*)
import * as E from "../engine.js";
import { RI, fmt } from "./common.js";
import { D, s } from "../main.js";

const tName = id => (E.findId(D.towns, id) || {}).name || id;
const esc = x => String(x).replace(/"/g, "&quot;");

// small coloured arrow after a price; nothing when the price is normal
export function priceTagHtml(townId, res, side = "sell") {
  const t = E.priceTag(s, townId, res, side);
  if (!t.arrow) return "";
  const good = side === "sell" ? t.level === "high" : t.level === "low"; // green = good for the player
  return ` <span class="ptag ptag-${t.level}" style="color:${good ? "#3fbf5f" : "#e0533d"};font-weight:700" title="${esc(t.tip)}">${t.arrow}</span>`;
}
export const priceTipOf = (townId, res, side = "sell") => E.priceTag(s, townId, res, side).tip;

export function townTagsHtml(townId) {
  const { short, flooded } = E.townTags(s, townId);
  if (!short.length && !flooded.length) return "";
  const list = xs => xs.map(x => `<span title="${esc(x.tip)}">${RI[x.res] || ""}${x.res}</span>`).join(", ");
  return `<div class="mtags" style="margin-top:4px">${short.length ? `<span style="color:#3fbf5f">▲ Short of:</span> ${list(short)}` : ""}${short.length && flooded.length ? " · " : ""}${flooded.length ? `<span style="color:#e0533d">▼ Flooded with:</span> ${list(flooded)}` : ""}</div>`;
}

const sellRow = (r, link) =>
  `<div class="row mrow" style="margin:3px 0"><span style="flex:1">${RI[r.res] || ""} ${r.res} <span class="muted">×${fmt(r.have)}</span>${r.tag.arrow ? `<br><span class="muted" style="font-size:11px">${r.tag.tip}</span>` : ""}</span><span>${tName(r.town)} ${fmt(r.price)}🪙${priceTagHtml(r.town, r.res)} <span class="muted">🚶${r.days}d</span></span>${link ? `<button class="b" data-a="mapsel" data-v="t:${r.town}">📍</button>` : ""}</div>`;
const buyRow = (r, link) =>
  `<div class="row mrow" style="margin:3px 0"><span style="flex:1">${RI[r.res] || ""} ${r.res}</span><span>${tName(r.town)} ${fmt(r.price)}🪙${priceTagHtml(r.town, r.res, "buy")} <span class="muted">🚶${r.days}d</span></span>${link ? `<button class="b" data-a="mapsel" data-v="t:${r.town}">📍</button>` : ""}</div>`;

// full board (Map tab): best sell spots for goods you hold + cheapest buys, "show all" in a <details>
export function marketBoardCard() {
  const b = E.marketBoard(s);
  if (!E.knownTowns(s).length) return "";
  const part = (title, rows, fn, empty) =>
    `<div style="margin-top:6px"><b>${title}</b>${rows.length ? rows.slice(0, b.rows).map(r => fn(r, true)).join("") + (rows.length > b.rows ? `<details><summary class="muted">Show all (${rows.length})</summary>${rows.slice(b.rows).map(r => fn(r, true)).join("")}</details>` : "") : `<div class="muted">${empty}</div>`}</div>`;
  return `<div class="card" id="marketboard"><b>📊 Market Board</b> <span class="muted">· best prices in towns you know · ▲ high ▼ low</span>${part("Where to sell what you have", b.sell, sellRow, "Nothing to sell yet.")}${part("Where to buy cheapest", b.buy, buyRow, "No markets known yet.")}${shortList()}</div>`;
}
// towns that are short/flooded right now (one line each)
function shortList() {
  const rows = E.knownTowns(s).map(t => ({ t, h: townTagsHtml(t.id) })).filter(x => x.h);
  return rows.length ? `<div style="margin-top:6px"><b>Towns right now</b>${rows.map(x => `<div>${x.t.icon} <b>${x.t.name}</b>${x.h}</div>`).join("")}</div>` : "";
}

// short version (Bag tab): top 3 sell spots for what you hold
export function marketSummaryCard() {
  const b = E.marketBoard(s);
  if (!b.sell.length) return "";
  return `<h3>📊 Best places to sell</h3><div class="card" id="marketsummary">${b.sell.slice(0, 3).map(r => sellRow(r, false)).join("")}<div class="muted">Full Market Board on the Map tab.</div></div>`;
}
