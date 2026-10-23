// One building card on the Estate tab, split into sections (header, pieces, features, place menu, fittings, upgrade/respec/demolish).
import { pbar, secPerDay } from "./progress.js";
import * as E from "../engine.js";
import { costStr, autoChip } from "./common.js";
import { villageRow } from "./village-panel.js";
import { D, s } from "../main.js";
import { U } from "./state.js";
import { roomHtml } from "./estate-room.js";

function cardHead(st, k) {
  const d = E.structDef(st.type),
    nxs = E.upgradeOptions(st.type),
    syn = E.activeSynergies(st);
  return `<div class="card"><div class="row"><b>${d.icon} ${E.structName(st)} #${k + 1}</b>${d.special ? ' <span class="tb" style="border-color:#d9b44a">special</span>' : ""}<span class="muted">Lv ${d.level || 1} (+${((d.level || 1) - 1) * 5}% to furniture) · ${d.slots + (d.fixed || []).length + (st.bonusSlots || 0) + E.rankSlots(st) - E.freeSlots(s, st) - (d.fixed || []).length}/${d.slots + (st.bonusSlots || 0) + E.rankSlots(st)} slots · ${d.land} land</span><button class="b rmbtn${U.estRoom === st.uid ? " on" : ""}" data-a="estroom" data-v="${st.uid}" title="Lift the roof: see every furnishing and upgrade inside">🏠 Inside</button></div>${U.estRoom === st.uid && D.estaterooms ? roomHtml(E, D.estaterooms, s, st, U.estRoomT, !!s.classicEmoji) : ""}${d.builtin && d.builtin.housing ? `<div class="muted">Built-in: houses ${d.builtin.housing.bunk} followers</div>` : ""}${d.mine ? `<div class="muted">${E.featureDef(E.veinOf(st)).icon} ${E.featureDef(E.veinOf(st)).name}${E.veinsFor(s, st).length ? "" : " — idle: needs a deeper mine tier"}</div>` : ""}${d.branch ? `<div class="muted">${d.desc}</div>` : ""}${syn.length ? `<div>${syn.map(y => `<span class="tb" style="border-color:#d9b44a">${y.icon} ${y.name}</span>`).join("")}</div>` : ""}`;
}

function cardPieces(st, k) {
  const d = E.structDef(st.type),
    nxs = E.upgradeOptions(st.type),
    syn = E.activeSynergies(st);
  return `
  ${st.pieces
    .map(pid => {
      const p = E.pieceDef(pid);
      const rates = E.processRates(s, st, pid);
      const t = E.pieceTier(pid),
        nt = E.pieceTiers(pid)[t + 1],
        ui = E.pieceUpIssue(s, st.uid, pid);
      const pz = E.isPaused(s, st.uid, pid);
      return `<div class="row" style="margin:3px 0;${pz ? "opacity:.55" : ""}"><span>${p.icon} ${p.name} <span class="tb">${E.tierName(pid)}${E.pieceSlots(pid) > 1 ? " · " + E.pieceSlots(pid) + " slots" : ""}</span>${rates.length ? ` <span class="tb" style="border-color:${pz ? "#c55" : "#5c5"}">${pz ? "⏸ Paused" : "▶ Running"}</span>` : ""} <span class="muted">${E.pieceLine(pid, st.type)} · ×${E.pieceMult(st, pid).toFixed(2)} effect${rates.length ? " · " + rates.map(r => r.rate + " " + r.out + "/day").join(", ") : ""}</span>${rates.length && !pz ? pbar(s.acc, "daily cycle", (1 - s.acc) * secPerDay(), "thin") : ""}</span><span>${rates.length ? `<button class="b" data-a="toggle" data-v="${st.uid}" data-w="${pid}">${pz ? "Resume" : "Pause"}</button>` : ""}${nt ? `<button class="b" data-a="uppiece" data-v="${st.uid}" data-w="${pid}" ${ui ? "disabled" : ""}>→ ${nt.name} ${costStr(E.bcost(s, nt.cost, "piece", true))}</button>` : ""}${E.isFixed(st, pid) ? '<span class="tb">built-in</span>' : `<button class="b" data-a="unpiece" data-v="${st.uid}" data-w="${pid}">Remove</button>`}</span></div>`;
    })
    .join("")}`;
}

// refining settings row: on/off, stop when output storage is full, input threshold
export function cardRefine(st) {
  if (!E.isRefiner(s, st)) return "";
  const r = E.refineOf(st),
    hold = st.pieces.flatMap(id => (E.pieceDef(id).bonus.processes || []).map(p => E.refineHold(s, st, p))).find(Boolean);
  return `<div class="row" style="margin:3px 0;gap:4px;justify-content:flex-start;flex-wrap:wrap"><span class="muted">⚙️ Refining${hold ? " · ⏸ " + hold : ""}</span><button class="b ${r.on ? "sel" : ""}" data-a="refine" data-v="${st.uid}" data-w="on">${r.on ? "On" : "Off"}</button><button class="b ${r.stopFull ? "sel" : ""}" data-a="refine" data-v="${st.uid}" data-w="full" title="Idle while the output is at its storage cap">Stop when full</button><select data-a="refinemin" data-v="${st.uid}" title="Only refine while each input is above this share of storage">${E.REFINE_MINS.map(m => `<option value="${m}" ${r.min === m ? "selected" : ""}>${m ? "Input > " + m * 100 + "%" : "Always"}</option>`).join("")}</select></div>`;
}

function cardFeatures(st, k) {
  const d = E.structDef(st.type),
    nxs = E.upgradeOptions(st.type),
    syn = E.activeSynergies(st);
  return `${
    d.houses
      ? `<div class="muted" style="margin-top:4px">🏠 Class housing ${E.classResidents(s, st).length}/${E.classHomeCap(st)}: ${d.houses.classes.map(c => E.npcClass(c).name).join(", ")} live here (+${d.houses.bonus * 100}% output)${
          E.classResidents(s, st).length
            ? " · " +
              E.classResidents(s, st)
                .map(x => x.name)
                .join(", ")
            : ""
        }</div>`
      : ""
  }${
    d.stages
      ? `<div class="muted">🏗️ Stage ${E.structStage(st)}/3: ${d.stages.map((n, i) => (i + 1 === E.structStage(st) ? "<b>" + (i === 2 && E.specDef(st) ? E.specDef(st).name : n) + "</b>" : i === 2 && E.specDef(st) ? E.specDef(st).name : n)).join(" → ")}</div>${
          E.specDef(st)
            ? `<div class="muted">🏅 ${E.specDef(st).icon} ${E.specDef(st).name}: ${E.specDef(st).desc}; houses ${E.specDef(
                st,
              )
                .houses.map(c => E.npcClass(c).name)
                .join(", ")}</div>`
            : `<div class="row" style="flex-wrap:wrap;gap:4px;justify-content:flex-start"><span class="muted">Specialise (pick one):</span>${d.specs.map(sp => `<button class="b" data-a="spec" data-v="${st.uid}" data-w="${sp.id}" ${E.specIssue(s, st.uid, sp.id) ? "disabled" : ""} title="${sp.desc}">${sp.icon} ${sp.name}${E.specIssue(s, st.uid, sp.id) === "finish the upgrade line" ? "" : " " + costStr(sp.cost)}</button>`).join("")}${E.specIssue(s, st.uid, d.specs[0].id) === "finish the upgrade line" ? '<span class="muted">(after the full upgrade line)</span>' : ""}</div>`
        }`
      : ""
  }${d.guildBoost ? `<div class="muted">🎓 +${Math.round(d.guildBoost.xp * (1 + E.upgMult(st)) * 100)}% XP for ${d.guildBoost.guild === "adventurers" ? "Adventurers' Guild" : E.guildDef(d.guildBoost.guild).name} members</div>` : ""}${d.skillBoost ? `<div class="muted">🩹 +${Math.round(d.skillBoost.xp * (1 + E.upgMult(st)) * 100)}% ${d.skillBoost.skills.join("/")} XP, faster injury recovery</div>` : ""}${d.classSynergy && E.classSynMult(s, st) > 1 ? `<div class="muted">✨ Hunter in the family: +${d.classSynergy.mult * 100}% output</div>` : ""}${E.curUpgrades(st) ? `<div class="muted" style="margin-top:4px">🔧 Upgrade line (no slot, +housing): ${E.curUpgrades(st).map((u, i) => `${i < (st.up || 0) ? "✅" : "▫️"} ${u.name} ${u.routes ? "+" + u.routes + " route" : "+" + u.mult * 100 + "%"}`).join(" · ")}</div>${E.curUpgrades(st)[st.up || 0] ? `<div class="row"><span class="muted">Next: ${E.curUpgrades(st)[st.up || 0].name}</span><button class="b" data-a="upspecial" data-v="${st.uid}" ${E.specialUpIssue(s, st.uid) ? "disabled" : ""}>${costStr(E.bcost(s, E.curUpgrades(st)[st.up || 0].cost, E.structTag(d), true))}</button></div>` : ""}` : ""}`;
}

function cardPlace(st, k) {
  const d = E.structDef(st.type),
    nxs = E.upgradeOptions(st.type),
    syn = E.activeSynergies(st);
  return `
  ${
    E.freeSlots(s, st) > 0
      ? `<div class="row" style="margin-top:4px"><select data-a="pickpiece" data-v="${st.uid}"><option value="">+ Place a piece…</option>${s.pieceStore
          .filter((x, i, a) => a.indexOf(x) === i)
          .map(
            pid =>
              `<option value="store:${pid}">📦 ${E.pieceDef(pid).name} [${E.tierName(pid)}] (from storage)</option>`,
          )
          .join("")}${[...D.estate.pieces, ...D.furniture]
          .filter(p => !p.fixedOnly && !p.mergedInto && !p.fitting && (!E.allowedOf(st) || E.allowedOf(st).includes(p.id)))
          .map(
            p =>
              `<option value="${p.id}" ${E.placeIssue(s, st.uid, p.id) ? "disabled" : ""}>${p.icon} ${p.name} – ${costStr(p.cost)}${E.placeIssue(s, st.uid, p.id) === "already here" ? " (here)" : E.pieceLock(s, p) ? " 🔒 " + E.pieceLock(s, p) : /^needs upgrade/.test(E.placeIssue(s, st.uid, p.id) || "") ? " 🔒 " + E.placeIssue(s, st.uid, p.id) : ""} — ${E.pieceLine(p.id, st.type)}</option>`,
          )
          .join("")}</select></div>`
      : ""
  }`;
}

function cardFittings(st, k) {
  const d = E.structDef(st.type),
    nxs = E.upgradeOptions(st.type),
    syn = E.activeSynergies(st);
  return `
  ${E.fittingOptions(st).length ? `<div class="muted" style="margin-top:4px">🔩 Fittings (no slot, buy once): ${E.fittingOptions(st)
    .map(f => {
      const fi = E.fittingIssue(s, st.uid, f.id);
      return fi === "owned" ? `<span class="tb" title="${f.desc}">✅ ${f.icon} ${f.name} — ${E.pieceLine(f.id)}</span>` : `<button class="b" data-a="buyfit" data-v="${st.uid}" data-w="${f.id}" ${fi ? "disabled" : ""} title="${f.desc}">${f.icon} ${f.name} — ${E.pieceLine(f.id)} · ${fi && fi !== "cannot afford" ? "🔒 " + fi : costStr(E.bcost(s, f.cost, "piece"))}</button>`;
    })
    .join(" ")}</div>` : ""}`;
}

// production tier: next tier name, what it adds, button (needs the current upgrade line finished)
function cardTier(st) {
  const nx = E.nextTier(st);
  if (!nx) return E.prodTier(st) ? `<div class="muted" style="margin-top:4px">🏛️ Top tier: ${E.prodTier(st).name}</div>` : "";
  const ti = E.tierUpIssue(s, st.uid),
    adds = [`output ×${nx.outputMult}`, nx.slots ? `+${nx.slots} slot` : "", nx.land ? `+${nx.land} land` : "", "new upgrade line; bought upgrades kept"].filter(Boolean).join(", ");
  return `<div class="row" style="margin-top:4px"><span class="muted">🏛️ Tier ${(st.tier || 0) + 2} → ${nx.name} (${adds})</span><button class="b" data-a="tierup" data-v="${st.uid}" ${ti ? "disabled" : ""}>${ti && ti !== "cannot afford" ? "🔒 " + ti : costStr(E.tierCost(s, st))}</button></div>`;
}

function cardNav(st, k) {
  const d = E.structDef(st.type),
    nxs = E.upgradeOptions(st.type),
    syn = E.activeSynergies(st);
  return `
  ${nxs
    .map(nx => {
      const ui = E.upgradeIssue(s, st.uid, nx.id);
      return `<div class="row" style="margin-top:4px"><span class="muted">${nxs.length > 1 ? "Branch" : "Upgrade"} → ${nx.icon} ${nx.name} (${nx.slots} slots, ${nx.land} land)${nx.branch ? "<br>" + nx.desc : ""}</span><button class="b" data-a="upstruct" data-v="${st.uid}" data-w="${nx.id}" ${ui ? "disabled" : ""}>${ui && ui !== "cannot afford" ? "🔒 " + ui : costStr(E.upCost(s, nx))}</button></div>`;
    })
    .join("")}${
    d.branch
      ? E.upgradeOptions(d.upgradeFrom)
          .filter(o => o.id !== d.id)
          .map(o => {
            const ri = E.respecIssue(s, st.uid, o.id);
            return `<div class="row" style="margin-top:4px"><span class="muted">Respec → ${o.icon} ${o.name} (refund half, pay full)</span><button class="b" data-a="respec" data-v="${st.uid}" data-w="${o.id}" ${ri ? "disabled" : ""}>${ri && ri !== "cannot afford" ? "🔒 " + ri : costStr(E.bcost(s, o.cost, E.structTag(o)))}</button></div>`;
          })
          .join("")
      : ""
  }${villageRow(st)}<div class="row" style="margin-top:4px"><span class="muted">Demolish: refund ${costStr(E.demolishRefund(st))}</span>${E.demolishIssue(s, st.uid) ? `<span class="muted">🔒 ${E.demolishIssue(s, st.uid)}</span>` : `<button class="b" data-a="demolish" data-v="${st.uid}">🧨 Demolish</button>`}</div></div>`;
}

// R37: ⚙ Auto Tend chips for the skills this building serves
const autoRow = st => {
  const ks = E.atCatsFor(s, st);
  return ks.length ? `<div class="row" style="gap:4px;justify-content:flex-start;flex-wrap:wrap;margin:2px 0" data-autorow="${st.uid}">${ks.map(k => { const x = E.atStatus(s, k); return autoChip("at_" + k, k[0].toUpperCase() + k.slice(1), x.on, x.why); }).join("")}</div>` : "";
};
export const buildingCard = (st, k) =>
  cardHead(st, k) +
  ((st.type === "warehouse" || E.structDef(st.type)?.upgradeFrom === "warehouse") ? `<div class="row" style="justify-content:flex-start"><button class="b" style="font-size:12px" data-a="quotasgo">📋 Quotas (${E.quotaList(s).length})</button></div>` : "") + autoRow(st) + cardPieces(st, k) + cardRefine(st) + cardFeatures(st, k) + cardPlace(st, k) + cardFittings(st, k) + cardTier(st) + cardNav(st, k);
