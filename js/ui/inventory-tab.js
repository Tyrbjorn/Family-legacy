import * as E from "../engine.js";
import { MATS, QC, RI, fmt, it, itemRow, itemStatsHtml } from "./common.js";
import { D, invF, s } from "../main.js";
import { marketSummaryCard, priceTagHtml } from "./market-ui.js";
import { enchantCard, gearTags, setsCard } from "./gear-ui.js";

export function vault() {
  const m = E.active(s);
  let h = `<h3>Equipped (${m.name})</h3><div class="card">${["weapon", "offhand", "armor", "accessory"].map(sl => `<div>${sl}: ${m.equip[sl] ? it(m.equip[sl]).name + itemStatsHtml(it(m.equip[sl]), m, false) : "—"}</div>`).join("")}</div><h3>Family Vault</h3>`;
  if (!s.vault.length) h += `<div class="muted">Empty. Quests drop loot.</div>`;
  s.vault.forEach(id => {
    const x = it(id);
    h += `<div class="card row"><span>${x.name} <span class="muted">${x.rarity} ${x.slot}${x.cp ? " +" + x.cp + " CP" : ""}</span>${itemStatsHtml(x, m)}</span><span>${x.slot !== "gift" && x.slot !== "map" ? `<button class="b" data-a="equip" data-v="${id}">Equip</button>` : ""}<button class="b" data-a="sell" data-v="${id}">Sell ${Math.round(x.value / 2)}</button></span></div>`;
  });
  return h;
}

// hold buttons: this exact item / every item of this type (held items skip bulk sell/stock and Auto Equip)
const holdBtns = id =>
  `<button class="b ${E.heldItem(s, id) ? "sel" : ""}" data-a="hold" data-v="${id}" data-w="item" title="Hold this exact item">📌${E.heldItem(s, id) ? " Held" : " Hold"}</button><button class="b ${E.heldType(s, id) ? "sel" : ""}" data-a="hold" data-v="${id}" data-w="type" title="Hold every item of this type">📌 Type${E.heldType(s, id) ? " held" : ""}</button>`;

// inlays (shown once a Goldsmith exists, for accessories/charms; gems need a Jeweler)
const inlayBtns = id =>
  (E.goldsmith(s) || E.runecarver(s)) && Object.values(D.crafting.inlays.mats).some(x => (x.slots || D.crafting.inlays.slots).includes(it(id).slot)) && !/[~#]/.test(id)
    ? Object.entries(D.crafting.inlays.mats).filter(([, x]) => (x.slots || D.crafting.inlays.slots).includes(it(id).slot))
        .map(([k, x]) => { const why = E.inlayIssue(s, id, k); return `<button class="b" data-a="inlay" data-v="${id}" data-w="${k}" ${why ? `disabled title="${why}"` : ""}>💍 ${x.name}</button>`; })
        .join("")
    : "";

export function invv() {
  const m = E.active(s);
  const town = D.towns.find(t => E.regionOpen(s, t.region) && t.id === "thornwick") || D.towns[0];
  let h = `<h3>⚔️ ${m.name}'s gear (CP ${E.cp(s, m)})</h3><div class="card">${["weapon", "offhand", "armor", "accessory"].map(sl => `<div class="row"><span>${sl}: ${m.equip[sl] ? `<span style="color:${QC[it(m.equip[sl]).rarity] || "#ccc"}">${it(m.equip[sl]).name}</span> ${gearTags(it(m.equip[sl]))}${itemStatsHtml(it(m.equip[sl]), m, false)}` : "—"}</span>${m.equip[sl] ? `<button class="b" data-a="unequip" data-v="${sl}">Unequip</button>` : ""}</div>`).join("")}${gearSheet(m)}<div class="row" style="margin-top:4px"><span class="muted">🛡️ Auto Equip for ${m.name}</span><button class="b ${m.noAutoEq ? "" : "sel"}" data-a="noautoeq">${m.noAutoEq ? "Excluded" : "Included"}</button></div></div>` + setsCard(m.equip) + enchantCard();
  h +=
    `<h3>🧱 Materials & goods <span class="muted">(cap ${fmt(E.matCap(s))}, food ${fmt(E.foodCap(s))})</span></h3><div class="card">` +
    MATS.map(
      k =>
        `<div class="row" style="margin:3px 0"><span>${RI[k] || ""} ${k} <b>${fmt(s.res[k] || 0)}</b></span>${k !== "food" && town.prices[k] ? `<button class="b" data-a="sellallres" data-v="${town.id}" data-w="${k}" ${(s.res[k] || 0) >= 1 ? "" : "disabled"}>Sell all @${E.townSellPrice(s, town.id, k)}🪙${priceTagHtml(town.id, k)}</button>` : ""}</div>`,
    ).join("") +
    `<div class="muted">Sells at ${town.name}.</div></div>` + marketSummaryCard();
  h +=
    `<h3>🎒 Personal pack (${m.bag.length}/${E.packCap()})</h3>` +
    (m.bag.length
      ? m.bag
          .map(id =>
            itemRow(
              it(id),
              `${["weapon", "offhand", "armor", "accessory"].includes(it(id).slot) ? `<button class="b" data-a="equipbag" data-v="${id}">Equip</button>` : ""}<button class="b" data-a="tovault" data-v="${id}">→ Vault</button>`,
              m,
            ),
          )
          .join("")
      : '<div class="muted">Empty.</div>');
  const types = ["all", "weapon", "offhand", "armor", "accessory", "tool", "charm", "gift"],
    qs = ["all", "Crude", "Common", "Fine", "Superior", "Masterwork", "Rare", "Epic"];
  let list = s.vault
    .map((id, k) => ({ id, k, x: it(id) }))
    .filter(o => o.x && (invF.type === "all" || o.x.slot === invF.type) && (invF.q === "all" || o.x.rarity === invF.q));
  list.sort((a, b) =>
    invF.sort === "value"
      ? b.x.value - a.x.value
      : invF.sort === "cp"
        ? (b.x.cp || 0) - (a.x.cp || 0)
        : a.x.name.localeCompare(b.x.name),
  );
  h += `<h3>🏛️ Family vault (${s.vault.length}/${E.vaultCap(s)}) <span class="muted">+10 per Storage Chest</span></h3>
 <div class="row" style="flex-wrap:wrap;gap:4px"><select data-a="invf" data-v="type">${types.map(t => `<option ${invF.type === t ? "selected" : ""}>${t}</option>`).join("")}</select><select data-a="invf" data-v="q">${qs.map(t => `<option ${invF.q === t ? "selected" : ""}>${t}</option>`).join("")}</select><select data-a="invf" data-v="sort">${["value", "cp", "name"].map(t => `<option ${invF.sort === t ? "selected" : ""}>${t}</option>`).join("")}</select>
 <button class="b" data-a="bulksell" ${list.length ? "" : "disabled"}>Sell ${list.filter(o => !E.isHeld(s, o.id)).length} shown (${list.filter(o => !E.isHeld(s, o.id)).reduce((a, o) => a + E.sellValue(s, o.x), 0)}🪙; held kept)</button><button class="b" data-a="bulklist" ${list.length ? "" : "disabled"}>Stock all shown</button></div>`;
  h += list.length
    ? list
        .map(({ id, x }) =>
          itemRow(
            x,
            `${["weapon", "offhand", "armor", "accessory"].includes(x.slot) ? `<button class="b" data-a="equip" data-v="${id}">Equip</button>` : ""}${E.isSpecialMap(id) ? `<button class="b sel" data-a="readmap" data-v="${id}" title="${x.desc || ""}">🗺️ Read</button>` : ""}<button class="b" data-a="tobag" data-v="${id}">Take</button><button class="b" data-a="list" data-v="${id}">Stock ${E.stallValue(s, x)}</button><button class="b" data-a="sell" data-v="${id}">Sell ${E.sellValue(s, x)}</button>${holdBtns(id)}${inlayBtns(id)}`,
            m,
          ),
        )
        .join("")
    : '<div class="muted">Nothing matches.</div>';
  const sellers =
    s.minions.filter(x => x.job === "merchant" && E.isHoused(s, x)).length +
    E.living(s).filter(
      x =>
        (x.action && x.action.type === "job" && x.action.target === "shop") ||
        (x.id !== s.activeId && x.order && x.order.type === "job" && x.order.target === "shop"),
    ).length;
  h +=
    `<h3>🏷️ Stock for sale (${s.forSale.length})</h3><div class="muted">${sellers ? `${sellers} seller(s) working: about 1 item every ${D.crafting.stallDaysPerItem} days at full value.` : "No seller. Put a follower on Selling (needs a Market Stall) or have a family member work the General Store."}</div>` +
    s.forSale.map(id => itemRow(it(id), `<button class="b" data-a="unlist" data-v="${id}">Unlist</button>`)).join("");
  return h;
}

// member sheet line: dodge, arcane spell failure, weapon/armor proficiencies (capped by class)
function gearSheet(m) {
  const fams = Object.keys(m.wprof || {}).filter(f => (m.wprof[f] || 0) > 0);
  const pr = fams.map(f => `${E.famName(f)} ${Math.round(E.prof(m, f))}/${E.profCap(m, f)}`).join(" · ");
  const fail = E.isCaster(m) ? ` · 🔮 spell failure ${Math.round(E.spellFail(m) * 100)}%` : "";
  return `<div class="istats">💨 dodge ${Math.round(E.memberDodge(m, m.equip.armor) * 100)}%${fail}${pr ? " · 🎯 " + pr : ""}</div>`;
}
