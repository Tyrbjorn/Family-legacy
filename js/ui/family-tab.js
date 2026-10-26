// Family tree: generations as rows in a pannable canvas; tap a member to open their card.
import * as E from "../engine.js";
import { D, s } from "../main.js";
import { autoChip, badges, heritageHtml, cl, injuryTags, memberLine, portrait } from "./common.js";
import { U } from "./state.js";
import { familyR60 } from "./r60-ui.js";

const rcol = id => {
  const d = E.traitDef(id);
  return (D.legacy?.traits?.colors || {})[d?.rarity || "common"] || "#aaa";
};

const mem = id => E.findId(s.members, id);
function node(n) {
  const icon = n.gender === "f" ? "👩" : "👨";
  const t = n.best && E.traitDef(n.best);
  return `<button class="tnode ${n.alive ? "" : "dead"} ${U.treeSel === n.id ? "sel" : ""}" data-a="treesel" data-v="${n.id}">
<span class="ticon">${n.alive && mem(n.id) ? portrait(mem(n.id), 32) : n.alive ? icon : n.marriedOut ? "💍" : "🕯️"}</span><b>${n.name}</b>
<span class="muted">${n.alive ? `${n.age}y` : n.marriedOut ? `wed into ${n.marriedOut}` : `† Y${n.died}, aged ${n.age}`}</span>
<span>${n.cls || "Commoner"} · ⭐${n.renown}</span>
${t ? `<span style="color:${rcol(n.best)}">${t.icon || ""} ${t.name}</span>` : ""}</button>`;
}

export function familyv() {
  const gens = E.familyTree(s);
  const byId = Object.fromEntries(gens.flat().map(n => [n.id, n]));
  const rows = gens
    .map((g, i) => {
      // keep couples adjacent
      const seen = new Set(),
        order = [];
      for (const n of g) {
        if (seen.has(n.id)) continue;
        seen.add(n.id);
        const sp = E.findId(g, n.spouse);
        order.push(
          sp && !seen.has(sp.id)
            ? (seen.add(sp.id), `<div class="couple">${node(n)}<span class="ring">💍</span>${node(sp)}</div>`)
            : node(n),
        );
      }
      return `<div class="gen"><div class="genlbl">Gen ${i + 1}</div><div class="genrow">${order.join("")}</div></div>`;
    })
    .join('<div class="genlink">│</div>');
  let card = "";
  const m = U.treeSel && E.findId(s.members, U.treeSel);
  if (m) {
    const n = byId[m.id];
    const kids = (n?.children || []).map(id => byId[id]?.name).filter(Boolean);
    const sp = byId[n?.spouse];
    const ps = (n?.parents || []).map(id => byId[id]?.name).filter(Boolean);
    card = `<div class="card"><div class="row">${portrait(m, 48)} ${memberLine(m)}<span style="flex:1"></span><button class="b" data-a="treesel" data-v="">✕</button></div>
<div class="muted">${m.alive ? "Living" : n.marriedOut ? `Married into ${n.marriedOut}` : `Died Y${n.died}`}${m.persona && E.personaDef(m.persona) ? ` · ${E.personaDef(m.persona).icon} ${E.personaDef(m.persona).name}` : ""}${m.house && E.houseDef(m.house) ? ` · of ${E.houseDef(m.house).name}` : ""} · lifespan ~${m.lifespan}y</div>
<div>${badges(m)}</div>${E.hasBlood(m) ? `<div>${heritageHtml(m)}</div>` : ""}
${challengeRow(m)}${injuryTags(m)}
${ps.length ? `<div>Parents: ${ps.join(" & ")}</div>` : ""}${sp ? `<div>Spouse: <a data-a="treesel" data-v="${sp.id}">${sp.name}</a></div>` : ""}
${kids.length ? `<div>Children: ${(n.children || []).map(id => `<a data-a="treesel" data-v="${id}">${byId[id].name}</a>`).join(", ")}</div>` : ""}
${m.alive && m.id !== s.activeId ? `<button class="b" data-a="switch" data-v="${m.id}">Play as ${m.name}</button>` : ""}</div>`;
  }
  return famAutoRow() + familyR60() + `<div class="card"><h3>🌳 Family Tree <span class="muted">${gens.length} generation${gens.length === 1 ? "" : "s"} · ${s.members.filter(x => !x.minion).length} members</span></h3>
<div class="muted">Drag to pan · tap someone to open their card${s.bloodline ? ` · Bloodline trait: <b style="color:${rcol(s.bloodline)}">${E.traitDef(s.bloodline)?.name}</b>` : ""}</div>
<div class="treewrap" id="treewrap"><div class="tree">${rows}</div></div></div>${card}`;
}

// personal challenge: shown for every family member; pickable during the first year of life only
function challengeRow(m) {
  if (m.minion) return "";
  const cur = E.chalLvl(m);
  if (!E.chalOpen(m)) return `<div class="muted">Challenge: ${E.chalName(cur)}</div>`;
  return `<div class="row" style="flex-wrap:wrap;gap:4px"><span class="muted">Challenge (choose in the first year):</span>${[1, 2, 3, 4, 5]
    .map(l => `<button class="b${l === cur ? " on" : ""}" data-a="setchal" data-v="${m.id}" data-w="${l}">${E.chalName(l)}</button>`)
    .join("")}</div>`;
}

// R37: ⚙ Auto chips for family automation (free basics; tiers in the Legacy panel)
function famAutoRow() {
  const nm = { orders: "Orders", advance: "Advance", kids: "Tutor", court: "Matchmaker" };
  return `<div class="card row" id="famauto" style="gap:4px;justify-content:flex-start;flex-wrap:wrap">${E.FA_KEYS.map(k => autoChip("fam_" + k, nm[k] + (E.faTier(s, k) ? " T" + E.faTier(s, k) : ""), E.faOn(s, k))).join("")}</div>`;
}
