// Craft paths card (data/paths.json): ranks with progress bars, open-path choices, specialties, combo requirements.
import * as E from "../engine.js";
import { pbar } from "./progress.js";

const rk = r => E.pathRanks()[r] || E.pathRanks()[0];
const fxText = fx =>
  fx
    .map(f =>
      f.kind === "craft"
        ? `+${Math.round(f.v * 100)}% craft quality${f.slots ? " (" + f.slots.join("/") + ")" : f.bases ? " (signature items)" : f.mats ? " (" + f.mats.join("/") + " work)" : ""}`
        : f.kind === "variety"
          ? `+${f.v} variety morale`
          : f.kind === "find"
            ? `finds ${f.res}`
            : f.kind === "land"
              ? `+${f.v} land slot`
              : f.kind === "vault"
                ? `+${f.v} vault slot`
                : `+${Math.round(f.v * 100)}% ${f.kind === "trainXp" ? "family training XP" : f.kind}${f.res ? " " + f.res.filter(x => x !== "*").join("/") : ""}`,
    )
    .join(" · ") + " per rank";

function pathRow(m, e) {
  const p = E.pathDef(e.id),
    pr = E.pathProgress(m, e),
    main = e === E.mainPath(m);
  const label = pr.next
    ? pr.capped
      ? `held at ${rk(e.rank).name}: ${p.advanced ? "" : "raise your main path"}`
      : `→ ${pr.next.name}: ${Math.floor(pr.xp)}/${pr.next.xp} XP · skill ${pr.lvl}/${pr.next.skill}`
    : "Grandmaster";
  let h = `<div class="card" style="padding:6px 8px;margin:4px 0"><div class="row"><b>${p.icon} ${p.name}</b><span class="tb">${rk(e.rank).icon} ${rk(e.rank).name}${main ? " · main" : p.advanced ? " · combo" : ""}</span></div>${pbar(pr.pct, label, null, "thin")}`;
  if (e.spec) {
    const sp = E.pathSpecDef(e.id, e.spec),
      sq = E.pathProgress(m, e, true);
    h += `<div class="muted">${sp.icon} <b>${sp.name}</b> ${rk(e.srank).name} · ${sp.desc}</div>${pbar(sq.pct, sq.next ? (sq.capped ? "held at the path's rank" : `→ ${sq.next.name}`) : "Grandmaster", null, "thin")}`;
  } else {
    const ch = E.specChoices(m, e.id);
    if (ch.length)
      h += `<div class="muted">🎯 Choose ONE specialty:</div><div class="row" style="flex-wrap:wrap;gap:4px">${ch
        .map(x => `<button class="b" data-a="pickspec" data-v="${e.id}" data-w="${x.id}" title="${x.desc}">${x.icon} ${x.name}</button>`)
        .join("")}</div>`;
    else if (e.rank < E.pathRanks().length && !p.advanced)
      h += `<div class="muted" style="font-size:12px">Specialty at ${rk(2).name}: ${p.specs.map(x => x.icon + " " + x.name).join(", ")}</div>`;
  }
  return h + `<div class="muted" style="font-size:12px">${fxText(p.fx)}</div></div>`;
}

export function pathsCard(s, m) {
  if (!E.isAdult(m)) return "";
  const defs = E.pathDefs();
  let h = `<h3>🔨 Craft paths <span class="muted" style="font-size:12px">${E.memberPaths(m).filter(e => !E.pathDef(e.id).advanced).length}/${E.pathSlots(m)} open · max ${E.pathCapMax()}</span>${E.pendingPathChoices(m) ? ` <span class="tb">🎯 ${E.pendingPathChoices(m)}</span>` : ""}</h3>`;
  if (!m.craft) return h + `<div class="card muted">Join the 🔨 Crafters' Guild to start a main path (Apprentice → Journeyman → Master → Grandmaster).</div>`;
  for (const e of E.memberPaths(m)) h += pathRow(m, e);
  const opens = defs.filter(x => !x.advanced && !E.pathOf(m, x.id));
  const iss = opens.length ? E.openPathIssue(s, m, opens[0].id) : "all paths taken";
  h += `<div class="card" style="padding:6px 8px;margin:4px 0"><b>${E.memberPaths(m).length ? "Open another path" : "🎯 Choose your main path"}</b><div class="muted" style="font-size:12px">${E.memberPaths(m).length ? "Each rank gained opens one more (secondaries stay a rank below the main)." : "XP in the path's skills ranks it up."}${iss ? " · 🔒 " + iss : ""}</div><div class="row" style="flex-wrap:wrap;gap:4px">${opens
    .map(x => `<button class="b" data-a="openpath" data-v="${x.id}" ${iss ? "disabled" : ""} title="${x.desc}">${x.icon} ${x.name}</button>`)
    .join("")}</div></div>`;
  const combos = defs.filter(x => x.advanced && !E.pathOf(m, x.id));
  if (combos.length && E.memberPaths(m).length)
    h += `<details class="card" style="padding:6px 8px;margin:4px 0"><summary><b>🧬 Combo paths</b> <span class="muted" style="font-size:12px">no slot used · inputs keep ranking</span></summary>${combos
      .map(x => {
        const rq = E.advancedReqs(m, x.id),
          ok = rq.every(r => r.ok);
        return `<div class="row" style="margin:4px 0;gap:6px"><span>${x.icon} <b>${x.name}</b> <span class="muted" style="font-size:12px">${x.desc}<br>${rq.map(r => (r.ok ? "✅ " : "🔒 ") + r.text).join(" · ")}</span></span><button class="b" data-a="openpath" data-v="${x.id}" ${ok ? "" : "disabled"}>Open</button></div>`;
      })
      .join("")}</details>`;
  return h;
}
