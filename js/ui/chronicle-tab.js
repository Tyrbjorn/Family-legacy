// Chronicle tab: filterable family history plus achievements.
import * as E from "../engine.js";
import { U } from "./state.js";
import { D, s } from "../main.js";

function chronicle() {
  const cats = D.chronicle.cats;
  const f = U.chronF || "all";
  const sel = `<select data-a="chronf"><option value="all">All events</option>${Object.entries(cats)
    .map(([k, n]) => `<option value="${k}" ${f === k ? "selected" : ""}>${n}</option>`)
    .join("")}</select>`;
  const rows = E.chronicleView(s, f)
    .map(
      e =>
        `<div class="row" style="margin:2px 0;justify-content:flex-start;gap:6px"><span class="tb">Y${E.chronicleYear(e.d)}</span><span>${e.t}${e.w ? ` <span class="muted">· ${e.w}</span>` : ""}</span></div>`,
    )
    .join("");
  return `<div class="card"><div class="row"><b>📜 Family Chronicle</b>${sel}</div><div class="muted">${(s.chronicle || []).length}/${D.chronicle.cap} entries kept (minor ones are trimmed first)</div><div style="max-height:420px;overflow:auto;margin-top:6px">${rows || '<div class="muted">Nothing recorded yet.</div>'}</div></div>`;
}

function achievements() {
  const list = E.achDefs();
  const done = list.filter(a => s.ach && s.ach[a.id] != null).length;
  return (
    `<h3>🏅 Achievements ${done}/${list.length}</h3>` +
    list
      .map(a => {
        const p = E.achProgress(s, a);
        const hid = a.hidden && !p.done;
        const r = a.reward || {};
        const rw = [r.renown && `+${r.renown} renown`, r.coin && `+${r.coin}🪙`, r.legacy && `+${r.legacy} Legacy`]
          .filter(Boolean)
          .join(", ");
        return `<div class="card" style="padding:6px 8px;margin:4px 0;${p.done ? "border-color:#d9b44a" : ""}"><div class="row"><span>${hid ? "❔" : a.icon} <b>${hid ? "Hidden achievement" : a.name}</b></span><span class="muted">${p.done ? "✅ Y" + E.chronicleYear(s.ach[a.id]) : hid ? "???" : p.have + "/" + p.goal}</span></div><div class="muted">${hid ? "Keep playing to discover it." : a.desc} · ${rw}</div>${!p.done && !hid ? `<div class="bar"><i style="width:${(p.have / p.goal) * 100}%"></i></div>` : ""}</div>`;
      })
      .join("")
  );
}

export function chroniclev() {
  return chronicle() + achievements();
}
