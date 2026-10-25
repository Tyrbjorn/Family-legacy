// R76 Encyclopedia screen. Entries unlock when the player encounters them; until then only a count is shown (there is no spoiler toggle).
// Discovery is remembered profile-wide (fl_enc_v1); the "This save" filter shows what the loaded dynasty has encountered.
import * as E from "../engine.js";
import { D, slot, enc, encScan } from "../main.js";
import { U } from "./state.js";
import { itemIco } from "./common.js";

const esc = x => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
let CAT = null, CATD = null;
export const catalog = () => (CATD === D && CAT) || ((CATD = D), (CAT = E.encCatalog(D)));
const FAITH = ["g:church", "g:crone", "g:dagon"]; // factions whose entries are about belief

function listHtml() {
  const sec = U.encSec || "items", scope = U.encScope === "save" && slot > 0 ? "save" : "all", q = (U.encQ || "").trim().toLowerCase();
  if (sec === "faiths") return faithsPage();
  const C = catalog()[sec] || [], got = E.encSet(enc, scope, slot, sec);
  const rows = C.filter(e => got.has(e.id) && (!q || (e.name + " " + e.sub + " " + e.text).toLowerCase().includes(q))).sort((a, b) => a.name.localeCompare(b.name));
  const hidden = C.length - C.filter(e => got.has(e.id)).length;
  const head = `<div class="muted" role="status">${C.length - hidden} of ${C.length} found${hidden ? ` · ${hidden} still undiscovered` : " · all found"}${q ? ` · ${rows.length} match${rows.length === 1 ? "" : "es"}` : ""}</div>`;
  if (!rows.length) return head + `<div class="card muted">${got.size ? "Nothing matches that search." : scope === "save" ? "This save hasn't encountered any of these yet." : "Nothing found here yet. Entries appear as you meet them in play."}</div>`;
  return head + rows.map(e => `<div class="card enc" data-enc="${esc(e.id)}"><div class="row"><span>${sec === "items" ? itemIco(e.id, null, 24) : esc(e.icon)} <b>${esc(e.name)}</b></span><span class="muted">${esc(e.sub)}</span></div>${e.text ? `<div class="muted">${esc(e.text)}</div>` : ""}</div>`).join("");
}
// text page: only what the game already says about belief; no entries for individual powers until the Old Ones pack
function faithsPage() {
  const C = catalog().factions, got = E.encSet(enc, U.encScope === "save" && slot > 0 ? "save" : "all", slot, "factions");
  const met = FAITH.filter(id => got.has(id)).map(id => C.find(e => e.id === id)).filter(Boolean);
  return `<div class="card"><h3>Faiths and powers</h3><div>Two ways of belief pull at the realm: the <b>Old Ways</b> and the <b>New Faith</b>. Your line's Honor and Faith (Family screen) show which way it leans.</div>
${met.length ? met.map(e => `<div style="margin-top:6px">${esc(e.icon)} <b>${esc(e.name)}</b>${e.text ? `<div class="muted">${esc(e.text)}</div>` : ""}</div>`).join("") : '<div class="muted" style="margin-top:6px">You haven\'t met any of the faiths yet.</div>'}
<div class="muted" style="margin-top:8px">Pages for individual powers will be added with the Old Ones pack.</div></div>`;
}

export function encv() {
  const sec = U.encSec || "items", scope = U.encScope === "save" && slot > 0 ? "save" : "all", cat = catalog();
  const chip = (id, label, ico) => {
    const n = id === "faiths" ? "" : ` <span class="muted">${E.encSet(enc, scope, slot, id).size}/${(cat[id] || []).length}</span>`;
    return `<button class="b chip ${sec === id ? "sel" : ""}" data-a="enc_sec" data-v="${id}" aria-pressed="${sec === id}">${ico} ${label}${n}</button>`;
  };
  return `<div class="mhead"><button class="b" data-a="m_back" data-autofocus>← Back</button><h2 id="mtitle">Encyclopedia</h2></div>
<div class="card muted">Entries appear when you encounter them in play. Discoveries are remembered across all your saves on this device.</div>
<div class="row" style="gap:6px;justify-content:flex-start;flex-wrap:wrap"><button class="b" data-a="m_go" data-v="how">🧭 Orrin's tours</button><button class="b" data-a="m_go" data-v="notes">📜 Orrin's notes</button></div>
<div class="row" style="gap:6px;justify-content:flex-start;flex-wrap:wrap" role="group" aria-label="Show discoveries from"><button class="b ${scope === "all" ? "sel" : ""}" data-a="enc_scope" data-v="all" aria-pressed="${scope === "all"}">All my saves</button><button class="b ${scope === "save" ? "sel" : ""}" data-a="enc_scope" data-v="save" ${slot > 0 ? "" : "disabled"} aria-pressed="${scope === "save"}">This save</button></div>
<div class="encchips" role="group" aria-label="Sections">${E.ENC_SECTIONS.map(([id, l, i]) => chip(id, l, i)).join("")}${chip("faiths", "Faiths and powers", "🕯️")}</div>
${sec === "faiths" ? "" : `<input type="search" id="encq" placeholder="Search this section" aria-label="Search this section" value="${esc(U.encQ || "")}" style="width:100%;margin:6px 0">`}
<div id="enclist" data-nav-off>${listHtml()}</div>`;
}
export function encAfter() { /* focus is handled by menu.js */ }

// live search: update the list only, so the field keeps focus while typing
if (typeof document !== "undefined") document.addEventListener("input", e => {
  if (!e.target || e.target.id !== "encq") return;
  U.encQ = e.target.value;
  const el = document.getElementById("enclist");
  if (el) el.innerHTML = listHtml();
});
