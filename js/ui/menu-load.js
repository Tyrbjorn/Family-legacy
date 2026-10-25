// R76 Load screen (replaces the old 📂 Saves tab): 5 slot cards from slot meta (big saves are not parsed), storage bar, delete (press twice) + undo,
// and for an unreadable slot: restore backup / export raw / delete. Rendered into #menu by menu.js.
import * as E from "../engine.js";
import { slot, entered } from "../main.js";
import { U } from "./state.js";
import { fmt } from "./common.js";

export const ago = t => {
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
const esc = x => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const playTime = sec => (sec >= 3600 ? Math.floor(sec / 3600) + " h " + Math.round((sec % 3600) / 60) + " min" : Math.max(1, Math.round(sec / 60)) + " min");
export const slotSummary = x => {
  const c = x.card;
  return c ? `<div>Gen ${c.gen} · ${esc(c.head)}, ${c.age} · Year ${c.year}${c.season ? ", " + c.season : ""}${c.over ? " · ⚰️ ended" : ""}</div><div class="muted">⭐ ${fmt(c.renown)} renown · 🏛️ ${fmt(c.legacy)} Legacy · 🪙 ${fmt(c.coin)} · ${c.stage} · ${c.alive} alive</div>` : "";
};
export function loadv() {
  const L = E.Slots.listSlots(localStorage);
  let h = `<div class="mhead"><button class="b" data-a="m_back" data-autofocus>← Back</button><h2 id="mtitle">Load game</h2></div><div class="card muted">Up to ${E.Slots.SLOTS} dynasties side by side. Each slot has its own Legacy renown and upgrades. A game saves itself every few seconds, and each slot keeps one older backup.</div>${U.slotMsg ? `<div class="card" role="status">${U.slotMsg}</div>` : ""}${U.undoSlot ? `<div><button class="b" data-a="slotundo" data-v="${U.undoSlot}">↩ Undo delete (slot ${U.undoSlot})</button></div>` : ""}<div role="list" data-nav>`;
  for (const x of L) {
    const cur = x.n === slot && slot > 0;
    if (x.empty) {
      h += `<div class="card slot" role="listitem" data-slot="${x.n}"><div class="row"><span><b>Slot ${x.n}</b> <span class="muted">Empty</span></span><span><button class="b" data-a="m_newat" data-v="${x.n}">New game</button> <button class="b" data-a="slotimport" data-v="${x.n}">Import</button></span></div></div>`;
      continue;
    }
    const armed = U.delArm === x.n, delBtn = `<button class="b" data-a="slotdel" data-v="${x.n}" style="${armed ? "background:#a33;color:#fff;border-color:#e55" : "color:#e77"}">${armed ? "Press again to delete" : "Delete"}</button>`;
    if (x.bad) {
      h += `<div class="card slot" role="listitem" data-slot="${x.n}" style="border-color:#e77"><div class="row"><span>⚠️ <b>${esc(x.name || "Slot " + x.n)}</b> <span class="muted">slot ${x.n}</span></span><span class="muted">${ago(x.played)}</span></div>
<div>${x.bad.reason === "version" ? "This save comes from a different save version and can't be opened here." : "This save's data is damaged and can't be opened."} It has <b>not</b> been changed or replaced.</div>${x.bak ? `<div class="muted">💾 Backup from ${ago(x.bakAt)} available.</div>` : '<div class="muted">No backup for this slot.</div>'}
<div class="row" style="gap:4px;justify-content:flex-start;flex-wrap:wrap;margin-top:4px">${x.bak ? `<button class="b sel" data-a="slotrestore" data-v="${x.n}">Restore backup</button>` : ""}<button class="b" data-a="slotraw" data-v="${x.n}">Export raw data</button><button class="b" data-a="slotimport" data-v="${x.n}">Import</button>${delBtn}</div></div>`;
      continue;
    }
    h += `<div class="card slot" role="listitem" data-slot="${x.n}" style="${cur ? "border-color:#d9b44a" : ""}"><div class="row"><span>${cur && entered ? "▶ " : ""}<b>${esc(x.name || "Slot " + x.n)}</b> <span class="muted">slot ${x.n}</span></span><span class="muted">${ago(x.played)}</span></div>
${slotSummary(x)}${x.note ? `<div class="muted">📝 ${esc(x.note)}</div>` : ""}<div class="muted">${x.sec ? "⏱ " + playTime(x.sec) + " played · " : ""}${x.bak ? "💾 backup " + ago(x.bakAt) : "no backup yet"}${x.build ? " · " + esc(x.build) : ""}</div>
<div class="row" style="gap:4px;justify-content:flex-start;flex-wrap:wrap;margin-top:4px"><button class="b ${cur ? "sel" : ""}" data-a="slotplay" data-v="${x.n}">${cur && entered ? "Resume" : "Load"}</button><button class="b" data-a="slotrename" data-v="${x.n}">Rename</button><button class="b" data-a="slotexport" data-v="${x.n}">Export</button><button class="b" data-a="slotimport" data-v="${x.n}">Import</button>${x.bak && !cur ? `<button class="b" data-a="slotrestore" data-v="${x.n}">Restore backup</button>` : ""}${cur && entered ? "" : delBtn}</div></div>`;
  }
  h += `</div><div class="card"><div class="muted">Import: paste a save code here, then press Import on a slot.</div><textarea id="slotcode" rows="3" style="width:100%" placeholder="Paste a save code" aria-label="Save code to import">${esc(U.slotCode || "")}</textarea></div>`;
  return h + storageBar();
}
export function newv() {
  const L = E.Slots.listSlots(localStorage), free = L.filter(x => x.empty);
  return `<div class="mhead"><button class="b" data-a="m_back" data-autofocus>← Back</button><h2 id="mtitle">New game</h2></div><div class="card muted">Pick a free slot for the new dynasty. Existing saves are never touched; delete one on the Load screen to free its slot.</div><div role="list" data-nav>${L.map(x => x.empty ? `<div class="card slot" role="listitem"><div class="row"><span><b>Slot ${x.n}</b> <span class="muted">Empty</span></span><button class="b sel" data-a="m_newat" data-v="${x.n}">Start here</button></div></div>` : `<div class="card slot" role="listitem" style="opacity:.7"><div class="row"><span><b>Slot ${x.n}</b> <span class="muted">${esc(x.name || "in use")}${x.bad ? " · unreadable" : ""}</span></span><span class="muted">in use</span></div></div>`).join("")}</div>${free.length ? "" : '<div class="card">All slots are in use. <button class="b" data-a="m_go" data-v="load">Open the Load screen</button> to delete one.</div>'}`;
}
