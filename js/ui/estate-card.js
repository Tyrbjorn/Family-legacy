// One building card on the Estate tab, split into sections (header, pieces, features, place menu, fittings, upgrade/respec/demolish).
import { pbar, secPerDay } from "./progress.js";
import * as E from "../engine.js";
import { costStr } from "./common.js";
import { D, s } from "../main.js";

function cardHead(st, k) {
  const d = E.structDef(st.type),
    nxs = E.upgradeOptions(st.type),
    syn = E.activeSynergies(st);
  return `<div class="card"><div class="row"><b>${d.icon} ${E.structName(st)} #${k + 1}</b>${d.special ? ' <span class="tb" style="border-color:#d9b44a">special</span>' : ""}<span class="muted">Lv ${d.level || 1} (+${((d.level || 1) - 1) * 5}% to furniture) · ${d.slots + (d.fixed || []).length + (st.bonusSlots || 0) + E.rankSlots(st) - E.freeSlots(s, st) - (d.fixed || []).length}/${d.slots + (st.bonusSlots || 0) + E.rankSlots(st)} slots · ${d.land} land</span></div>${d.builtin && d.builtin.housing ? `<div class="muted">Built-in: houses ${d.builtin.housing.bunk} followers</div>` : ""}${d.branch ? `<div class="muted">${d.desc}</div>` : ""}${syn.length ? `<div>${syn.map(y => `<span class="tb" style="border-color:#d9b44a">${y.icon} ${y.name}</span>`).join("")}</div>` : ""}`;
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
      return `<div class="row" style="margin:3px 0;${pz ? "opacity:.55" : ""}"><span>${p.icon} ${p.name} <span class="tb">${E.tierName(pid)}${E.pieceSlots(pid) > 1 ? " · " + E.pieceSlots(pid) + " slots" : ""}</span>${rates.length ? ` <span class="tb" style="border-color:${pz ? "#c55" : "#5c5"}">${pz ? "⏸ Paused" : "▶ Running"}</span>` : ""} <span class="muted">${E.pieceLine(pid, st.type)} · ×${E.pieceMult(st, pid).toFixed(2)} effect${rates.length ? " · " + rates.map(r => r.rate + " " + r.out + "/day").join(", ") : ""}</span>${rates.length && !pz ? pbar(s.acc, "daily cycle", (1 - s.acc) * secPerDay(), "thin") : ""}</span><span>${rates.length ? `<button class="b" data-a="toggle" data-v="${st.uid}" data-w="${pid}">${pz ? "Resume" : "Pause"}</button>` : ""}${nt ? `<button class="b" data-a="uppiece" data-v="${st.uid}" data-w="${pid}" ${ui ? "disabled" : ""}>→ ${nt.name} ${costStr(nt.cost)}</button>` : ""}${E.isFixed(st, pid) ? '<span class="tb">built-in</span>' : `<button class="b" data-a="unpiece" data-v="${st.uid}" data-w="${pid}">Remove</button>`}</span></div>`;
    })
    .join("")}`;
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
  }${d.guildBoost ? `<div class="muted">🎓 +${Math.round(d.guildBoost.xp * (1 + E.upgMult(st)) * 100)}% XP for ${d.guildBoost.guild === "adventurers" ? "Adventurers' Guild" : E.guildDef(d.guildBoost.guild).name} members</div>` : ""}${d.skillBoost ? `<div class="muted">🩹 +${Math.round(d.skillBoost.xp * (1 + E.upgMult(st)) * 100)}% ${d.skillBoost.skills.join("/")} XP, faster injury recovery</div>` : ""}${d.classSynergy && E.classSynMult(s, st) > 1 ? `<div class="muted">✨ Hunter in the family: +${d.classSynergy.mult * 100}% output</div>` : ""}${d.upgrades ? `<div class="muted" style="margin-top:4px">🔧 Upgrade line (no slot, +housing): ${d.upgrades.map((u, i) => `${i < (st.up || 0) ? "✅" : "▫️"} ${u.name} ${u.routes ? "+" + u.routes + " route" : "+" + u.mult * 100 + "%"}`).join(" · ")}</div>${d.upgrades[st.up || 0] ? `<div class="row"><span class="muted">Next: ${d.upgrades[st.up || 0].name}</span><button class="b" data-a="upspecial" data-v="${st.uid}" ${E.specialUpIssue(s, st.uid) ? "disabled" : ""}>${costStr(d.upgrades[st.up || 0].cost)}</button></div>` : ""}` : ""}`;
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
          .filter(p => !p.fixedOnly && !p.mergedInto && !p.fitting && (!d.allowed || d.allowed.includes(p.id)))
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
      return fi === "owned" ? `<span class="tb" title="${f.desc}">✅ ${f.icon} ${f.name} — ${E.pieceLine(f.id)}</span>` : `<button class="b" data-a="buyfit" data-v="${st.uid}" data-w="${f.id}" ${fi ? "disabled" : ""} title="${f.desc}">${f.icon} ${f.name} — ${E.pieceLine(f.id)} · ${fi && fi !== "cannot afford" ? "🔒 " + fi : costStr(f.cost)}</button>`;
    })
    .join(" ")}</div>` : ""}`;
}

function cardNav(st, k) {
  const d = E.structDef(st.type),
    nxs = E.upgradeOptions(st.type),
    syn = E.activeSynergies(st);
  return `
  ${nxs
    .map(nx => {
      const ui = E.upgradeIssue(s, st.uid, nx.id);
      return `<div class="row" style="margin-top:4px"><span class="muted">${nxs.length > 1 ? "Branch" : "Upgrade"} → ${nx.icon} ${nx.name} (${nx.slots} slots, ${nx.land} land)${nx.branch ? "<br>" + nx.desc : ""}</span><button class="b" data-a="upstruct" data-v="${st.uid}" data-w="${nx.id}" ${ui ? "disabled" : ""}>${ui && ui !== "cannot afford" ? "🔒 " + ui : costStr(nx.cost)}</button></div>`;
    })
    .join("")}${
    d.branch
      ? E.upgradeOptions(d.upgradeFrom)
          .filter(o => o.id !== d.id)
          .map(o => {
            const ri = E.respecIssue(s, st.uid, o.id);
            return `<div class="row" style="margin-top:4px"><span class="muted">Respec → ${o.icon} ${o.name} (refund half, pay full)</span><button class="b" data-a="respec" data-v="${st.uid}" data-w="${o.id}" ${ri ? "disabled" : ""}>${ri && ri !== "cannot afford" ? "🔒 " + ri : costStr(o.cost)}</button></div>`;
          })
          .join("")
      : ""
  }<div class="row" style="margin-top:4px"><span class="muted">Demolish: refund ${costStr(E.demolishRefund(st))}</span>${E.demolishIssue(s, st.uid) ? `<span class="muted">🔒 ${E.demolishIssue(s, st.uid)}</span>` : `<button class="b" data-a="demolish" data-v="${st.uid}">🧨 Demolish</button>`}</div></div>`;
}

export const buildingCard = (st, k) => cardHead(st, k) + cardPieces(st, k) + cardFeatures(st, k) + cardPlace(st, k) + cardFittings(st, k) + cardNav(st, k);
