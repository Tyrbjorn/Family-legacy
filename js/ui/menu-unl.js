// R76 Unlocks screen: what is unlocked and how to unlock the rest. Rows come from engine/unlockview.js.
import * as E from "../engine.js";
import { D, s, slot, getLegacyRec } from "../main.js";
import { U } from "./state.js";

const esc = x => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
export function unlv() {
  const scope = U.unlScope === "save" && slot > 0 ? "save" : "all";
  const G = E.unlockRows(D, getLegacyRec(), s, scope);
  return `<div class="mhead"><button class="b" data-a="m_back" data-autofocus>← Back</button><h2 id="mtitle">Unlocks</h2></div>
<div class="row" style="gap:6px;justify-content:flex-start;flex-wrap:wrap" role="group" aria-label="Show unlocks for"><button class="b ${scope === "all" ? "sel" : ""}" data-a="unl_scope" data-v="all" aria-pressed="${scope === "all"}">All my lineages</button><button class="b ${scope === "save" ? "sel" : ""}" data-a="unl_scope" data-v="save" ${slot > 0 ? "" : "disabled"} aria-pressed="${scope === "save"}">This save</button></div>
${G.map(g => `<div class="card unlgroup" id="unl-${g.id}"><div class="row"><b>${esc(g.title)}</b><span class="muted">${g.done} of ${g.total}</span></div>${g.note ? `<div class="muted">${esc(g.note)}</div>` : ""}<div role="list">${g.rows.map(r => `<div class="unlrow ${r.done ? "done" : "locked"}" role="listitem"><span class="unlmark" aria-hidden="true">${r.done ? "✅" : "🔒"}</span><span><b>${esc(r.name)}</b> <span class="sr">${r.done ? "(unlocked)" : "(locked)"}</span><div class="muted">${esc(r.how)}${r.reward ? " · Reward: " + esc(r.reward) : ""}</div></span></div>`).join("")}</div></div>`).join("")}`;
}
