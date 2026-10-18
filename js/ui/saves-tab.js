// R38 slot picker: 5 dynasty cards (from slot meta, so big saves aren't parsed), storage bar, delete (press twice) + undo.
import * as E from "../engine.js";
import { slot } from "../main.js";
import { U } from "./state.js";
import { fmt } from "./common.js";

const ago = t => {
  if (!t) return "never";
  const d = (Date.now() - t) / 1000;
  if (d < 90) return "just now";
  if (d < 3600) return Math.round(d / 60) + " min ago";
  if (d < 86400) return "today " + new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return Math.round(d / 86400) + " day" + (d >= 172800 ? "s" : "") + " ago";
};
export function storageBar() {
  const u = E.Slots.storageUsed(localStorage), pct = Math.min(100, u.frac * 100);
  return `<div class="card" id="storagebar"><div class="row"><span>💾 Storage</span><span class="muted">${(u.bytes / 1048576).toFixed(2)} MB of ~${u.quota / 1048576} MB</span></div><div class="bar"><i style="width:${pct}%;background:${u.warn ? "#e77" : "#7c7"}"></i></div>${u.warn ? `<div style="color:#e77">⚠️ Storage is over ${Math.round(E.Slots.WARN * 100)}% full. Export a slot or delete one you no longer need.</div>` : ""}</div>`;
}
export function savesv() {
  const L = E.Slots.listSlots(localStorage);
  let h = `<div class="card"><b>📂 Saves</b><div class="muted">Keep up to ${E.Slots.SLOTS} dynasties side by side. Each slot has its own Legacy renown and upgrades. The game opens the last one you played.</div>${U.slotMsg ? `<div>${U.slotMsg}</div>` : ""}${U.undoSlot ? `<button class="b" data-a="slotundo" data-v="${U.undoSlot}">↩ Undo delete (slot ${U.undoSlot})</button>` : ""}</div>`;
  for (const x of L) {
    const c = x.card, cur = x.n === slot;
    if (x.empty) {
      h += `<div class="card slot" data-slot="${x.n}"><div class="row"><span><b>Slot ${x.n}</b> <span class="muted">Empty</span></span><span><button class="b" data-a="slotnew" data-v="${x.n}">New dynasty</button><button class="b" data-a="slotimport" data-v="${x.n}">Import</button></span></div></div>`;
      continue;
    }
    const armed = U.delArm === x.n;
    h += `<div class="card slot" data-slot="${x.n}" style="${cur ? "border-color:#d9b44a" : ""}"><div class="row"><span>${cur ? "▶ " : ""}<b>${x.name || "Slot " + x.n}</b> <span class="muted">slot ${x.n}</span></span><span class="muted">${ago(x.played)}</span></div>
${c ? `<div>Gen ${c.gen} · ${c.head}, ${c.age} · Year ${c.year}${c.season ? ", " + c.season : ""}${c.over ? " · ⚰️ ended" : ""}</div><div class="muted">⭐ ${fmt(c.renown)} renown · 🏛️ ${fmt(c.legacy)} Legacy · 🪙 ${fmt(c.coin)} · ${c.stage} · ${c.alive} alive</div>` : ""}${x.note ? `<div class="muted">📝 ${x.note}</div>` : ""}
<div class="row" style="gap:4px;justify-content:flex-start;flex-wrap:wrap;margin-top:4px"><button class="b ${cur ? "sel" : ""}" data-a="slotplay" data-v="${x.n}">${cur ? "Playing" : "Play"}</button><button class="b" data-a="slotrename" data-v="${x.n}">Rename</button><button class="b" data-a="slotexport" data-v="${x.n}">Export</button><button class="b" data-a="slotimport" data-v="${x.n}">Import</button>${cur ? "" : `<button class="b" data-a="slotdel" data-v="${x.n}" style="${armed ? "background:#a33;color:#fff;border-color:#e55" : "color:#e77"}">${armed ? "Press again to delete" : "Delete"}</button>`}</div></div>`;
  }
  h += `<div class="card"><div class="muted">Import: paste a save code here, then press Import on a slot.</div><textarea id="slotcode" rows="3" style="width:100%" placeholder="Paste a save code">${U.slotCode || ""}</textarea></div>`;
  return h + storageBar();
}
