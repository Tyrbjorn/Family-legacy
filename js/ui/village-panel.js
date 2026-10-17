// Estate tab: the personal village (charter, tier, village buildings, relocation is on each estate card).
import * as E from "../engine.js";
import { costStr, fmt } from "./common.js";
import { D, s } from "../main.js";

export function villagePanel() {
  const V = D.estate.village,
    q = D.quests.find(x => x.id === "q_charter");
  if (!s.village) {
    if (!s.land.includes("valley")) return "";
    const m = E.active(s),
      iss = m && E.questIssue(s, m, q);
    return `<div class="card"><b>🏘️ Village charter</b><div class="muted">${q.desc} Needs the Dynasty phase. Village buildings are larger and ${V.outMult}× as productive (${V.jobMult}× follower spots) but cost ${V.coinMult}× the coin; moving production there frees estate land for the Hall and manor line.</div><div class="muted">${iss ? "🔒 " + iss : "Ready: take the quest “" + q.name + "” on the Map or Quests list."}</div></div>`;
  }
  const t = E.villageTier(s),
    nx = V.tiers[s.village.tier + 1],
    ui = E.villageUpIssue(s);
  let h = `<div class="card"><div class="row"><b>🏘️ ${t.name}</b><span>${E.villageUsed(s)}/${E.villageSlots(s)} village slots · upkeep ${fmt(E.villageUpkeep(s))}🪙/month</span></div>`;
  if (nx) h += `<div class="row"><span class="muted">Grow to ${nx.name} (${nx.slots} slots)</span><button class="b" data-a="vup" ${ui ? "disabled" : ""}>${ui && ui !== "cannot afford" ? "🔒 " + ui : costStr(nx.cost)}</button></div>`;
  const p = E.project(s);
  if (p) {
    const L = E.projectLeft(s);
    h += `<div class="card"><b>🏗️ Project: ${E.projectName(p)}</b><div class="muted">Still to deliver: ${costStr(L)} (delivered ${costStr(p.paid) || "nothing yet"})</div><div class="row" style="gap:4px;justify-content:flex-start"><button class="b" data-a="vdeliver">📦 Deliver what we have</button><button class="b ${s.village.auto ? "sel" : ""}" data-a="vauto" title="Each day, feed the project from surplus: coin above ${fmt(V.autoCoin)}, materials above their keep-in-reserve setting">🤖 Auto Deliver ${s.village.auto ? "on" : "off"}</button><button class="b" data-a="vcancel">Cancel (refund)</button></div></div>`;
  }
  h += `<div class="muted">Start a building project in the village (one at a time; deliver its price in parts; production takes ${V.slotsPer} slots; any tier you have raised can be built directly):</div>`;
  for (const id of E.villageTypes()) {
    const d = E.structDef(id);
    for (let k = 0; k <= E.maxTier(s, id); k++) {
      const iss = E.villageBuildIssue(s, id, k),
        nm = k ? d.tiers[k - 1].name : d.name;
      h += `<div class="row" style="margin:3px 0"><span>${d.icon} ${nm}</span><button class="b" data-a="vbuild" data-v="${id}" data-w="${k}" ${iss ? "disabled" : ""}>${iss && iss !== "cannot afford" ? "🔒 " + iss : costStr(E.villageCost(id, k))}</button></div>`;
    }
  }
  return h + "</div>";
}

// one row on an estate building card: relocate to the village (or the village tag)
export function villageRow(st) {
  if (E.isVillage(st)) return `<div class="muted">🏘️ In the village${st.unpaid ? " · ⚠️ upkeep unpaid, idle" : ""}</div>`;
  if (!s.village || !D.estate.village.types.includes(st.type)) return "";
  const iss = E.relocateIssue(s, st.uid);
  return `<div class="row" style="margin-top:4px"><span class="muted">Move to the village: ${D.estate.village.outMult}× output, frees ${E.structDef(st.type).land} land, refunds ${costStr(E.demolishRefund(st))}</span><button class="b" data-a="reloc" data-v="${st.uid}" ${iss ? "disabled" : ""}>${iss && iss !== "cannot afford" ? "🔒 " + iss : costStr(E.villageCost(st.type))}</button></div>`;
}
