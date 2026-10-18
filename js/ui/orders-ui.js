// R43: 📋 Work Orders card (Crafting tab) + one line on Main. Rows: item × count, progress, why-stuck, ▲▼, pause, pause when done, remove.
import * as E from "../engine.js";
import { RI, fmt } from "./common.js";
import { D, s } from "../main.js";
import { U } from "./state.js";

const opts = () => {
  const items = [...new Set(D.crafting.recipes.filter(r => r.base && (!r.hidden || s.unlocks.includes("recipe:" + r.id))).map(r => r.base))].filter(k => E.itemDef(k)).sort((a, b) => E.orderName(a).localeCompare(E.orderName(b)));
  const res = ["planks", "ingots", "flour", "leather", "blocks", "cloth", "ale", "bread", "cheese"].filter(k => E.producible(k));
  return [...res, ...items];
};
export function ordersCard() {
  const L = E.orderList(s), act = new Set(E.activeOrders(s).map(o => o.id)), O = opts(), sel = U.oItem || O[0];
  const row = (o, i) => {
    const st = E.orderStatus(s, o), made = E.orderMade(s, o), pct = Math.min(100, (made / o.target) * 100);
    const col = st.k === "done" ? "#7c7" : st.k === "blocked" ? "#e77" : st.k === "on" ? "#ec6" : "#999";
    return `<div class="card orderrow" style="padding:5px 8px;margin:3px 0"><div class="row"><span>${act.has(o.id) ? "▶️" : "⏳"} ${RI[o.item] || "📦"} <b>${fmt(o.target)} × ${E.orderName(o.item)}</b>${o.auto ? ` <span class="tb" title="Placed by Auto-craft: ${o.auto}">🤖 auto</span>` : ""}</span><span>` +
      `<button class="b" style="padding:2px 6px" data-a="oup" data-v="${o.id}" ${i ? "" : "disabled"}>▲</button><button class="b" style="padding:2px 6px" data-a="odown" data-v="${o.id}" ${i < L.length - 1 ? "" : "disabled"}>▼</button>` +
      `<button class="b" style="padding:2px 6px" data-a="opause" data-v="${o.id}" title="${o.paused ? "Resume" : "Pause now"}">${o.paused ? "▶️" : "⏸️"}</button>` +
      `<button class="b ${o.pwd ? "sel" : ""}" style="padding:2px 6px;font-size:11px" data-a="opwd" data-v="${o.id}" title="Pause after the item being made now">⏹ when done</button>` +
      `<button class="b" style="padding:2px 6px" data-a="odel" data-v="${o.id}">✕</button></span></div>` +
      `<div class="bar"><i style="width:${pct}%;background:${col}"></i></div><div class="muted" style="font-size:12px">${fmt(made)}/${fmt(o.target)} made${o.auto ? ` · 🤖 ${o.auto}` : ""} · <span style="color:${col}">${st.k === "blocked" ? "⚠️ " : st.k === "done" ? "✅ " : ""}${st.text}</span>${o.pwd ? " · pauses when this one is done" : ""}</div></div>`;
  };
  return `<div class="card" id="orders"><div class="row"><b>📋 Work Orders</b><span class="muted">${L.filter(o => act.has(o.id) && !o.auto).length}/${E.queueSize(s)} working${E.autoSlots(s) ? ` · 🤖 ${L.filter(o => act.has(o.id) && o.auto).length}/${E.autoSlots(s)} auto` : ""}</span></div>` +
    `<div class="muted" style="font-size:12px">Add what you want made. Workers gather and refine the inputs, then craft, top to bottom. Followers on the craft job go first; family crafters help. 🤖 orders come from Auto-craft and use their own slots. Workshop → Order Queue in 🏛️ Legacy for more.</div>` +
    (L.map(row).join("") || '<div class="muted">No orders yet.</div>') +
    `<div class="row" style="gap:4px;justify-content:flex-start;flex-wrap:wrap;margin-top:4px"><select data-a="oitem">${O.map(k => `<option value="${k}" ${k === sel ? "selected" : ""}>${RI[k] || ""} ${E.orderName(k)}</option>`).join("")}</select><input type="number" min="1" value="${U.oNum || 3}" data-a="onum" style="width:56px"><button class="b sel" data-a="oadd">➕ Add order</button></div></div>`;
}
export function ordersLine() {
  const A = E.activeOrders(s);
  if (!A.length) return "";
  const o = A[0], st = E.orderStatus(s, o);
  return `<div class="muted" id="ordersline" style="font-size:12px">📋 Orders: ${A.length} working · ${E.orderName(o.item)} ${E.orderMade(s, o)}/${o.target}: ${st.text}</div>`;
}
