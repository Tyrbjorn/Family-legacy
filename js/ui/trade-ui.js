// Trade card (Map tab): routes, carts, crew, auto-trade rules, road patrols.
import * as E from "../engine.js";
import { U } from "./state.js";
import { RI } from "./common.js";
import { priceTagHtml } from "./market-ui.js";
import { D, s } from "../main.js";

const MODES = ["sell", "buy", "haul"];
const r1 = n => Math.round(n * 10) / 10;
const pct = n => Math.round(n * 100) + "%";

// The new-route picker state lives in U.tr: town index, mode, start-town index (haul), good index.
export function routeDraft() {
  const T2 = (U.tr = U.tr || { t: 0, f: 1, mode: "sell", r: 0 });
  const towns = E.tradeTowns(s);
  if (!towns.length) return null;
  const town = towns[T2.t % towns.length];
  const others = towns.filter(t => t.id !== town.id);
  const from = T2.mode === "haul" ? others[T2.f % Math.max(1, others.length)] : null;
  const goods =
    T2.mode === "buy"
      ? E.marketOf(town.id, s)
      : T2.mode === "haul"
        ? from
          ? E.marketOf(from.id, s).filter(k => town.prices[k])
          : []
        : Object.keys(town.prices).filter(k => (s.res[k] || 0) > 0 || !E.marketOf(town.id, s).includes(k));
  const res = goods[T2.r % Math.max(1, goods.length)];
  return { T2, towns, town, from, goods, res };
}

const mname = uid => ((s.minions || []).find(x => x.uid === uid) || {}).name || "—";

function routeRow(r, pool) {
  const price =
    r.mode === "haul"
      ? `buy ${r1(E.townBuyPrice(s, r.from, r.res))}🪙${priceTagHtml(r.from, r.res, "buy")} → sell ${r1(E.townSellPrice(s, r.town, r.res))}🪙${priceTagHtml(r.town, r.res)}`
      : `now ${r1(r.mode === "sell" ? E.townSellPrice(s, r.town, r.res) : E.townBuyPrice(s, r.town, r.res))}🪙${priceTagHtml(r.town, r.res, r.mode === "sell" ? "sell" : "buy")}`;
  const tr = r.trip;
  const st = tr
    ? `${tr.step < tr.stops.length ? "heading to " + E.tradePlace(tr.stops[tr.step].at) : "home"} ${Math.round(tr.t)}/${tr.total}d`
    : r.driver
      ? r.auto
        ? "waiting on rule"
        : "paused"
      : "⚠️ no driver";
  const rule =
    r.mode === "sell"
      ? `<span class="muted">Keep ${r.keep}</span><button class="b" data-a="trk" data-v="${r.id}" data-w="-25">−</button><button class="b" data-a="trk" data-v="${r.id}" data-w="25">+</button>`
      : r.mode === "buy"
        ? `<span class="muted">Buy when below ${r.below}</span><button class="b" data-a="trb" data-v="${r.id}" data-w="-25">−</button><button class="b" data-a="trb" data-v="${r.id}" data-w="25">+</button>`
        : `<span class="muted">Run when margin ≥ ${pct(r.margin)}</span><button class="b" data-a="trm" data-v="${r.id}" data-w="-0.05">−</button><button class="b" data-a="trm" data-v="${r.id}" data-w="0.05">+</button>`;
  return `<div class="card"><b>${r.mode === "haul" ? "Haul" : r.mode === "sell" ? "Sell" : "Buy"} ${RI[r.res] || ""}${r.res}</b> · ${r.mode === "haul" ? E.tradePlace(r.from) + " → " + E.tradePlace(r.town) : "at " + E.tradePlace(r.town)} <span class="muted">· ${price} · ${st} · trips ${r.trips || 0}${r.won ? " · fought off " + r.won : ""}${r.robbed ? " · robbed " + r.robbed : ""} · bandit risk ${pct(E.banditChance(s, r))} · win if attacked ${pct(E.winChance(s, r))}</span>
 <div class="row" style="flex-wrap:wrap;gap:4px;justify-content:flex-start"><span class="muted">Load ${r.qty}</span><button class="b" data-a="trq" data-v="${r.id}" data-w="-10">−</button><button class="b" data-a="trq" data-v="${r.id}" data-w="10">+</button>${rule}
 <button class="b ${r.auto ? "sel" : ""}" data-a="trauto" data-v="${r.id}">Auto ${r.auto ? "on" : "off"}</button><button class="b" data-a="trdel" data-v="${r.id}">✖ Close</button></div>
 <div class="row" style="flex-wrap:wrap;gap:4px;justify-content:flex-start"><span class="muted">🧑‍🌾 Driver: ${mname(r.driver)} · 🗡️ Guard: ${mname(r.guard)} · 🏇 Escorts: ${(r.escorts || []).map(mname).join(", ") || "—"}</span>
 ${pool.length ? `<button class="b" data-a="trcrew" data-v="${r.id}" data-w="driver">Next driver</button><button class="b" data-a="trcrew" data-v="${r.id}" data-w="guard">Next guard</button>${pool.some(E.isEscort) ? `<button class="b" data-a="trcrew" data-v="${r.id}" data-w="escort">Add escort</button>` : ""}` : `<span class="muted">(no free followers)</span>`}</div></div>`;
}

function patrolsv(pool) {
  const tr = s.trade;
  let h = `<div class="muted" style="margin-top:6px"><b>🛡️ Road patrols</b> · followers on a road lower bandit risk there for every cart (up to ${D.tuning.trade.maxPatrol} per road).</div>`;
  for (const p of tr.patrols)
    h += `<div class="row" style="flex-wrap:wrap;gap:4px;justify-content:flex-start"><span>${E.tradePlace(p.a)} – ${E.tradePlace(p.b)}: ${p.members.map(mname).join(", ") || "nobody yet"} <span class="muted">(power ${r1(E.patrolPower(s, p.seg))})</span></span>${pool.length && p.members.length < D.tuning.trade.maxPatrol ? `<button class="b" data-a="trpadd" data-v="${p.id}">Add follower</button>` : ""}<button class="b" data-a="trpdel" data-v="${p.id}">✖</button></div>`;
  const ends = [E.HOME, ...E.tradeTowns(s).map(t => t.id)];
  const P = (U.trp = U.trp || { a: 0, b: 1 });
  const a = ends[P.a % ends.length],
    b = ends[P.b % ends.length];
  h += `<div class="row" style="flex-wrap:wrap;gap:4px;justify-content:flex-start"><span class="muted">New patrol:</span><button class="b" data-a="trpnew" data-v="a">${E.tradePlace(a)}</button><span>–</span><button class="b" data-a="trpnew" data-v="b">${E.tradePlace(b)}</button><button class="b" data-a="trpopen" ${a === b || tr.patrols.some(p => p.seg === E.segKey(a, b)) ? "disabled" : ""}>＋ Start patrol</button></div>`;
  return h;
}

export function tradeCard() {
  if (!E.tradeTier(s))
    return `<div class="card"><b>🛒 Trade routes</b><div class="muted">Build a Warehouse (Estate) to send carts to town markets. It upgrades to a Trading Post, then a Counting House.</div></div>`;
  const tr = E.tradeInit(s),
    sp = E.routeSlotParts(s),
    dr = routeDraft();
  const pool = (s.minions || []).filter(x => x.job !== "trade" && x.job !== "patrol");
  let h = `<div class="card"><b>🛒 Trade routes</b> <span class="muted">· ${tr.routes.length}/${sp.total} slots (building ${sp.building}${sp.upgrades ? ", upgrades " + sp.upgrades : ""}${sp.haggling ? ", haggling " + sp.haggling : ""}${sp.steward ? ", steward " + sp.steward : ""}${sp.merchants ? ", trade factors " + sp.merchants : ""}) · cart carries ${E.cartCarry(s)}</span>
 <div class="muted">Each cart needs a driver; a guard and up to ${D.tuning.trade.maxEscorts} Horseman escorts fight off bandits. Peddler → Travelling Merchant → Trade Factor drivers get better deals. Haul routes buy in one town and sell in another.</div>`;
  for (const r of tr.routes) h += routeRow(r, pool);
  if (tr.routes.length < sp.total && dr) {
    const { T2, town, from, res, goods } = dr;
    h += `<div class="row" style="flex-wrap:wrap;gap:4px;justify-content:flex-start"><span class="muted">New route:</span><button class="b" data-a="trnew" data-v="mode">${T2.mode === "sell" ? "Sell" : T2.mode === "buy" ? "Buy" : "Haul"}</button>${from ? `<button class="b" data-a="trnew" data-v="f">from ${from.icon} ${from.name}</button>` : ""}<button class="b" data-a="trnew" data-v="t">${T2.mode === "haul" ? "to " : ""}${town.icon} ${town.name}</button><button class="b" data-a="trnew" data-v="r" ${goods.length ? "" : "disabled"}>${res ? (RI[res] || "") + res : "—"}</button><button class="b" data-a="tradd" ${res && (T2.mode !== "haul" || from) ? "" : "disabled"}>＋ Open route</button></div>`;
  }
  return h + patrolsv(pool) + `</div>`;
}

export const nextMode = m => MODES[(MODES.indexOf(m) + 1) % MODES.length];
