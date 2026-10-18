// Gear sets + enchanting UI (Inventory tab). Mobile-first cards; timed enchanting shows progress bars.
import * as E from "../engine.js";
import { D, s } from "../main.js";
import { pbar } from "./progress.js";
import { U } from "./state.js";

const fxText = E.fxText;
// small tags for an item row: set + enchant slots (◆ filled, ◇ free)
export function gearTags(x) {
  if (!x) return "";
  let h = "";
  const sd = x.set && E.setDef(x.set);
  if (sd) h += ` <span class="tb">${sd.icon} ${sd.name}</span>`;
  const n = E.enchSlots(x);
  if (n) {
    const en = E.splitId(x.id).ench;
    h += ` <span class="tb" title="${en.map(t => (E.isGreater(t) ? "Greater " : "") + E.enchDef(t).name).join(", ") || "no enchants"}">${en.map(t => E.enchDef(t).icon).join("")}${"◇".repeat(Math.max(0, n - en.length))}</span>`;
  }
  return h;
}
export function setsCard(equip, who = "member") {
  const ps = E.setProgress(equip);
  if (!ps.length) return "";
  return `<div class="card"><b>🧩 Sets</b>${ps
    .map(p => {
      const tbl = who === "minion" ? p.set.minion || {} : p.set.bonus;
      return `<div style="margin-top:4px">${p.set.icon} ${p.set.name}${pbar(p.n / p.set.pieces.length, `${p.n}/${p.set.pieces.length} pieces · quality ×${p.scale.toFixed(2)}`)}${Object.entries(tbl)
        .map(([k, fx]) => `<div class="${p.n >= +k ? "" : "muted"}">${p.n >= +k ? "✅" : "⬜"} ${k}-piece: ${fxText(fx)}</div>`)
        .join("")}</div>`;
    })
    .join("")}</div>`;
}
export function enchantCard() {
  const F = E.stationFx(s),
    ws = E.enchanters(s),
    jobs = E.enchJobs(s);
  let h = `<h3>✨ Enchanting</h3><div class="card">`;
  if (!F.jobs)
    return h + `<div class="muted">Place a Rune Desk at home (cheap, first slot only) or build the Arcane Workshop beside the Mage's Tower. Enchanters are mage-line family members or magic followers.</div></div>`;
  h += `<div class="muted">${F.best.piece} (${F.best.tier}) · quality +${Math.round(F.quality * 100)}% · speed ×${F.speed.toFixed(2)} · slot 1–${F.maxSlots} · ${jobs.length}/${F.jobs} busy${F.best.syn.length ? " · synergy: " + F.best.syn.join(", ") : ""}</div>`;
  for (const j of jobs) {
    const t = E.enchTimer(s, j);
    h += `<div style="margin:4px 0">${pbar(t.p, `${E.itemDef(j.item).name} ← ${E.enchDef(j.ench).name}`, t.left)}</div>`;
  }
  if (!ws.length) return h + `<div class="muted">No enchanter: a mage-line adult (Apprentice and its classes) or a magic follower.</div></div>`;
  const withE0 = s.vault.filter(id => E.splitId(id).ench.length);
  if (jobs.length >= F.jobs && !withE0.length) return h + `<div class="muted">All enchanting stations are busy.</div></div>`;
  const sel = (U.ench ||= {});
  const items = s.vault.filter(id => E.enchSlots(E.itemDef(id)) > 0);
  const who = ws.find(w => w.key === sel.who) || ws[0],
    item = items.includes(sel.item) ? sel.item : items[0];
  const it = item && E.itemDef(item);
  const ens = D.gear.enchants.filter(e => !it || e.on.includes(it.slot)),
    en = E.findId(ens, sel.ench) || ens[0];
  const cur = item ? E.splitId(item).ench : [];
  const slots = it ? Math.min(E.enchSlots(it), F.maxSlots) : 0;
  const idx = sel.idx != null && +sel.idx < slots ? +sel.idx : Math.min(cur.length, Math.max(0, slots - 1));
  const opt = (k, v, label, on) => `<option value="${v}" ${on ? "selected" : ""}>${label}</option>`;
  h += `<div class="row" style="flex-wrap:wrap;gap:4px;margin-top:6px">
<select data-a="enchsel" data-v="who" aria-label="Enchanter">${ws.map(w => opt("who", w.key, `${w.name} (Ench ${w.skill})`, w === who)).join("")}</select>
<select data-a="enchsel" data-v="item" aria-label="Item">${items.length ? items.map(id => opt("item", id, E.itemDef(id).name, id === item)).join("") : "<option>no enchantable gear in vault</option>"}</select>
<select data-a="enchsel" data-v="ench" aria-label="Enchantment">${ens.map(e => opt("ench", e.id, `${e.icon} ${e.name} (Ench ${e.minSkill})`, e === en)).join("")}</select>
<select data-a="enchsel" data-v="idx" aria-label="Slot">${Array.from({ length: slots }, (_, i) => opt("idx", i, cur[i] ? `slot ${i + 1}: replace ${E.enchDef(cur[i]).name}` : `slot ${i + 1}: empty`, i === idx)).join("")}</select></div>`;
  if (en) {
    const iss = item ? E.enchantIssue(s, who.key, item, en.id, idx) : "no item";
    h += `<div class="muted">${fxText(en.fx)} · ${Object.entries(en.reagents).map(([k, v]) => `${v} ${k}`).join(", ")} · ${en.days} days base</div><button class="b" data-a="enchgo" data-v="${who.key}" data-w="${item || ""}" data-x="${en.id}" data-i="${idx}" ${iss ? "disabled" : ""}>✨ Enchant${iss ? " — " + iss : ""}</button>`;
  }
  const withE = s.vault.filter(id => E.splitId(id).ench.length);
  if (withE.length)
    h += `<div style="margin-top:6px"><b>Disenchant</b> <span class="muted">(half the reagents back)</span>${withE
      .map(id => `<div class="row"><span>${E.itemDef(id).name}</span><span>${E.splitId(id).ench.map((t, i) => `<button class="b" data-a="disench" data-v="${id}" data-w="${i}">✖ ${E.enchDef(t).name}</button>`).join("")}</span></div>`)
      .join("")}</div>`;
  return h + "</div>";
}
