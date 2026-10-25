// R75: 🏛️ Union Hall card (Estate tab, under the Farmstead hub): gate, three tiers, easy hiring, stock readout.
// Convenience, not income. Uses existing art only (the oxwagon/handcart vehicle icons); the hall's own exterior and room art is an Art Studio ask.
import * as E from "../engine.js";
import { RI, fmt, vehIco } from "./common.js";
import { D, s } from "../main.js";

const U = () => (D.fields || {}).union;
const cost = c => Object.entries(c || {}).filter(([, v]) => v).map(([k, v]) => `${fmt(v)}${RI[k] || " " + E.resName(k)}`).join(" ");
const tick = ok => (ok ? "✅" : "⬜");

export function unionCard() {
  const u = U();
  if (!u || !(E.fieldsState(s).list.length || E.unionTier(s))) return "";
  const t = E.unionTier(s), next = E.unionNext(s), why = E.unionIssue(s), ups = E.fieldsState(s).ups, tm = (s.minions || []).filter(x => x.job === "teamster");
  let h = `<div class="card" id="unionhall"><div class="row"><b>${u.icon} ${u.name}</b><span class="muted">Home quarter (NW) · ${t ? "tier " + t + "/" + E.unionTiers().length + " · " + E.unionTierDef(s).name : "not built"}</span></div>`;
  h += `<div class="muted">A convenience hall for the home quarter, not an income building. ${vehIco("oxwagon", "🛒", 16)}</div>`;
  if (!t) {
    const g = u.gate;
    h += `<div style="margin-top:4px"><b>To unlock</b> <span class="muted">${g.ups.map(id => `${tick(ups[id])} ${E.hubUps("teamster").find(x => x.id === id).name}`).join(" · ")}${g.teamster ? ` · ${tick(tm.length)} a teamster` : ""}</span></div>`;
  } else {
    const on = E.unionActive(s);
    h += `<div style="margin-top:4px">${on ? "🟢 Active" : '<span style="color:#e0533d">🔴 Idle: needs a teamster on duty</span>'} <span class="muted">· ${E.unionTied(s)} teamster${E.unionTied(s) === 1 ? "" : "s"} on hall duty · producers skip the haul pile${t >= 2 ? ` · +${E.unionSpots(s)} teamster spots, hauling x${E.unionHaulMult(s)}` : ""}</span></div>`;
  }
  h += E.unionTiers().map((x, i) => `<div class="row" style="gap:6px;margin-top:3px;justify-content:flex-start"><span>${i < t ? "✅" : i === t ? "🔨" : "🔒"} ${x.icon} <b>${x.name}</b></span><span class="muted" style="font-size:12px">${x.desc}</span></div>`).join("");
  if (next) {
    const q = E.unionQuote(s), w = next.wagons ? ` · ${next.wagons} Wagon${next.wagons > 1 ? "s" : ""} (${q.wagonsOwned} from the vault${q.wagonsBought ? `, ${q.wagonsBought} bought at ${fmt(E.wagonValue())}🪙` : ""})` : "";
    const fees = Object.entries(next.fees || {}).map(([k, v]) => ` · ${k} ${fmt(v)}🪙`).join("");
    h += `<div style="margin-top:6px"><button class="b" data-a="unionbuy" ${why ? `disabled title="${why}"` : ""}>${next.icon} Build ${next.name} (${cost(q.cost)}${w}${fees})</button>${next.foreman ? ' <span class="muted">· one teamster retires as foreman</span>' : ""}</div>`;
    if (why && why !== "max") h += `<div class="muted" style="font-size:12px">${why}</div>`;
  } else h += `<div class="muted" style="margin-top:4px">All tiers built.</div>`;
  if (t) {
    const types = E.unionHireTypes(s);
    h += `<div style="margin-top:6px"><b>Easy hiring</b> <span class="muted">· ${Math.round((1 - u.hire.feeMult) * 100)}% off, no trip to town</span><div class="row" style="gap:4px;flex-wrap:wrap;justify-content:flex-start">${types.map(id => { const w2 = E.hallHireIssue(s, id); return `<button class="b" data-a="hallhire" data-v="${id}" ${w2 ? `disabled title="${w2}"` : ""}>${E.mtype(id).icon} ${E.mtype(id).name} (${fmt(E.hallHireFee(id))}🪙)</button>`; }).join("")}</div></div>`;
    const stock = u.stockReadout.filter(k => (s.res[k] || 0) >= 1).map(k => `${RI[k] || E.resName(k)} ${fmt(s.res[k])}`);
    h += `<div class="muted" style="margin-top:4px">📦 Hall stock: ${stock.length ? stock.join(" · ") : "empty"}</div>`;
  }
  return h + `</div>`;
}
