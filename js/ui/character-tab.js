// R30 Character tab (Family group, first sub-tab): the full sheet for one member.
import * as E from "../engine.js";
import { D, s } from "../main.js";
import { U } from "./state.js";
import { badges, itemStatsHtml, memberLine } from "./common.js";
import { sheet } from "./main-tab.js";

const pct = v => Math.round(v * (v <= 1 ? 100 : 1)) + "%";
export function characterv() {
  const all = E.living(s);
  const m = all.find(x => x.id === U.charId) || E.active(s);
  if (!m) return "";
  const K = D.gear.kinds, eq = m.equip || {};
  let h = `<div class="row" style="flex-wrap:wrap;gap:4px;justify-content:flex-start">${all.map(x => `<button class="b ${x.id === m.id ? "sel" : ""}" data-a="charpick" data-v="${x.id}">${x.name} (${E.ageY(x)})</button>`).join("")}</div>`;
  h += `<div class="card">${memberLine(m)}<div style="margin:4px 0">${badges(m)}</div><div class="muted">Lv ${E.level(m)} · CP <b>${E.cp(s, m)}</b>${m.id === s.head ? " · 👑 Head" : ""}${m.id === s.activeId ? " · ▶ playing" : ""}</div></div>`;
  // combat
  const dodge = E.memberDodge(m, eq.armor), fail = E.memberFail(m);
  h += `<h3>⚔️ Combat</h3><div class="card"><div class="grid"><span>CP <b>${E.cp(s, m)}</b></span><span>Dodge <b>${pct(dodge)}</b> <span class="muted">(cap ${pct(K.dodge.cap)})</span></span><span>Spell failure <b>${pct(fail)}</b></span><span>Armor class <b>${(E.gstats && eq.armor && (E.gstats(eq.armor) || {}).cls) || "none"}</b></span></div></div>`;
  // gear
  h += `<h3>🛡️ Gear</h3>` + ["weapon", "offhand", "armor", "accessory"].map(sl => {
    const id = eq[sl], x = id && E.itemDef(id);
    return `<div class="card" style="padding:5px 8px;margin:3px 0"><div class="row"><span><span class="muted">${sl}:</span> <b>${x ? x.name : "—"}</b>${x ? ` <span class="muted">+${Math.round(E.itemCpFor(m, id))} CP</span>` : ""}</span><button class="b" data-a="chargear" title="Change in the Bag">Change</button></div>${x ? itemStatsHtml(x, m, false) : ""}</div>`;
  }).join("");
  // proficiency
  const fams = Object.entries(K.famNames).map(([f, n]) => [n, E.prof(m, f), E.profCap(m, f)]).filter(([, v, c]) => v > 0 || c > 0);
  h += `<h3>🎯 Proficiency</h3><div class="card"><div class="muted">Grows with use (and from related skills) up to the class cap.</div><div class="grid">${fams.map(([n, v, c]) => `<span>${n} <b>${Math.round(v)}</b>/${c}</span>`).join("")}</div></div>`;
  // advancement
  const nxt = D.classes.filter(c => c.from && c.from === m.cls);
  h += `<h3>🎓 Class & advancement</h3><div class="card">${nxt.length ? nxt.map(c => `<div>${c.icon || ""} <b>${c.name}</b> <span class="muted">${E.canEvolve(s, m, c) ? "✅ ready (Work → Guilds)" : Object.entries(c.req || {}).map(([k, v]) => `${k} ${v}`).join(", ")}</span></div>`).join("") : '<div class="muted">No further class from here yet (or choose a guild first).</div>'}${m.prefCls ? `<div class="muted">Auto Advance preference: ${m.prefCls}</div>` : ""}</div>`;
  // family
  const nm = id => (s.members.find(x => x.id === id) || {}).name || "?";
  const kids = s.members.filter(x => (x.parents || []).includes(m.id));
  h += `<h3>🌳 Family</h3><div class="card"><div>Spouse: <b>${m.spouse ? nm(m.spouse) : "—"}</b></div><div>Parents: ${(m.parents || []).map(nm).join(" & ") || "—"}</div><div>Children: ${kids.map(x => x.name + (x.alive ? "" : " †")).join(", ") || "—"}</div></div>`;
  h += `<h3>⚙️ Automation</h3><div class="card"><button class="b ${m.noAutoEq ? "" : "sel"}" data-a="faex" data-v="${m.id}">${m.noAutoEq ? "Excluded" : "Included"}</button> <span class="muted">Auto Equip + family automation${Object.keys(m.pins || {}).length ? " · pinned: " + Object.keys(m.pins).join(", ") : ""}</span></div>`;
  return h + sheet(m);
}
