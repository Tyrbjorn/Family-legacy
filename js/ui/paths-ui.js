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
          ? `+${f.v} variety contentment`
          : f.kind === "find"
            ? `finds ${f.res}`
            : f.kind === "land"
              ? `+${f.v} land slot`
              : f.kind === "vault"
                ? `+${f.v} vault slot`
                : f.kind === "quotaSlot"
                  ? `+${f.v} quota slot${f.max ? " (max +" + f.max + ")" : ""}`
                  : f.kind === "route"
                    ? `+${f.v} trade route`
                    : f.kind === "orderSlot"
                      ? `+${f.v} Work Orders slot`
                      : f.kind === "storage"
                        ? `+${Math.round(f.v * 100)}% storage`
                        : f.kind === "trade"
                          ? `+${Math.round(f.v * 100)}% trade sale prices`
                : `+${Math.round(f.v * 100)}% ${f.kind === "trainXp" ? "family training XP" : f.kind}${f.res ? " " + f.res.filter(x => x !== "*").join("/") : ""}`,
    )
    .join(" · ") + (fx.every(f => f.flat) ? "" : " per rank");

const slotIcon = sl => ({ main: "⭐", second: "🔹", gather: "🌿", dabble: "·" })[sl] || "";
const slotSelect = (m, e, sl) => `<select data-a="pslot" data-v="${e.id}" data-w="${m.id}" aria-label="Slot for ${E.pathDef(e.id).name}">${E.SLOT_IDS.filter(k => k === sl || k === "dabble" || E.slotDef(k).kind === (E.pathDef(e.id).kind || "crafting")).map(k => `<option value="${k}" ${k === sl ? "selected" : ""}>${E.slotName(k)}</option>`).join("")}</select>`;
// R46 slots summary: who fills main / secondary / gathering, and the caps
function slotsSummary(s, m) {
  const P = E.memberPaths(m).filter(e => !E.pathDef(e.id).advanced);
  const nm = k => P.filter(e => e.slot === k).map(e => E.pathDef(e.id).icon + " " + E.pathDef(e.id).name).join(", ") || "—";
  const capN = k => rk(E.slotCapOf(k)).name;
  return `<div class="card" id="craftslots" style="padding:6px 8px;margin:4px 0"><b>🎚️ Trade slots</b> <span class="muted" style="font-size:12px">learn any number; only these rank up</span>
<div class="grid" style="font-size:13px"><span>⭐ Main (to ${capN("main")})</span><b>${nm("main")}</b><span>🔹 Secondary (a rank below main)</span><b>${nm("second")}</b><span>🌿 Gathering ×${E.slotDef("gather").n || 2} (to ${capN("gather")})</span><b>${nm("gather")}</b><span>· Dabbling (Apprentice only)</span><b>${nm("dabble")}</b></div>
<div class="muted" style="font-size:12px">Crafting trades fill Main and Secondary; Woodsman, Farmer and Mason fill Gathering. Switch a slot once a year for free; ranks above a slot's cap are kept and count at the cap. Until you pick, your highest crafting trade is main and the next highest secondary.${m.slotDay != null && s.day - m.slotDay < 360 ? " · next switch in " + (360 - (s.day - m.slotDay)) + " days" : ""}</div></div>`;
}
function pathRow(m, e) {
  const p = E.pathDef(e.id),
    pr = E.pathProgress(m, e),
    sl = E.pathSlotOf(m, e), cap = E.pathCap(m, e);
  const why = sl === "dabble" ? "dabbling stays Apprentice: move it into a slot" : sl === "second" && E.slotDef("second").belowMain && cap < (E.slotDef("second").cap ?? 0) ? "secondary stays a rank below the main" : "slot cap";
  const label = pr.next
    ? pr.capped
      ? `held at ${rk(Math.min(e.rank, cap)).name}: ${why}`
      : `→ ${pr.next.name}: ${Math.floor(pr.xp)}/${pr.next.xp} XP · skill ${pr.lvl}/${pr.next.skill}`
    : "Grandmaster";
  let h = `<div class="card" data-path="${e.id}" style="padding:6px 8px;margin:4px 0"><div class="row"><b>${p.icon} ${p.name}</b><span class="tb">${rk(e.rank).icon} ${rk(e.rank).name}${e.rank > cap ? ` (counts as ${rk(cap).name})` : ""}</span></div><div class="row" style="gap:6px;font-size:12px"><span class="muted">${p.advanced ? "🧬 combo · no slot, uncapped" : `${slotIcon(sl)} ${E.slotName(sl)} · ${p.kind || "crafting"} · up to ${rk(cap).name}`}</span>${p.advanced ? "" : slotSelect(m, e, sl)}</div>${pbar(pr.pct, label, null, "thin")}`;
  if (e.spec) {
    const sp = E.pathSpecDef(e.id, e.spec),
      sq = E.pathProgress(m, e, true);
    const art = E.isArtisan(e),
      nxt = sp.artisan && !art ? ` · artisan at ${rk(E.pathRanks().length - 1).name}: ${sp.artisan.icon} ${sp.artisan.name}` : "";
    const c2 = E.spec2Choices(m, e.id),
      g = E.mergedTitle(e);
    if (c2.length) h += `<div class="muted">🎯 Grandmaster: take a second specialty toward ${E.pathDef(e.id).merges[0].name}:</div><div class="row" style="flex-wrap:wrap;gap:4px">${c2.map(x => `<button class="b" data-a="pickspec2" data-v="${e.id}" data-w="${x.id}" title="${x.desc}">${x.icon} ${x.name}</button>`).join("")}</div>`;
    if (e.spec2 && !g) h += `<div class="muted">${E.pathSpecDef(e.id, e.spec2).icon} second specialty ${E.pathSpecDef(e.id, e.spec2).name}: ${rk(e.s2rank).name} (Grandmaster in both = ${E.pathDef(e.id).merges[0].name})</div>`;
    h += `<div class="muted">${g ? g.icon : art ? sp.artisan.icon : sp.icon} <b>${E.specName(e)}</b> ${art ? "(artisan)" : rk(e.srank).name} · ${sp.desc}${nxt}</div>${pbar(sq.pct, sq.next ? (sq.capped ? "held at the path's rank" : `→ ${sq.next.name}`) : "Grandmaster", null, "thin")}`;
  } else {
    const ch = E.specChoices(m, e.id);
    if (ch.length)
      h += `<div class="muted">🎯 Choose ONE specialty:</div><div class="row" style="flex-wrap:wrap;gap:4px">${ch
        .map(x => `<button class="b" data-a="pickspec" data-v="${e.id}" data-w="${x.id}" title="${x.desc}${x.artisan ? " Artisan: " + x.artisan.name + "." : ""}">${x.icon} ${x.name}${x.artisan ? " → " + x.artisan.name : ""}</button>`)
        .join("")}</div>`;
    else if (e.rank < E.pathRanks().length && !p.advanced)
      h += `<div class="muted" style="font-size:12px">Specialty at ${rk(2).name}: ${p.specs.map(x => x.icon + " " + x.name).join(", ")}</div>`;
  }
  return h + `<div class="muted" style="font-size:12px">${fxText(p.fx)}</div></div>`;
}

export function pathsCard(s, m) {
  if (!E.isAdult(m)) return "";
  const defs = E.pathDefs();
  let h = `<h3>🔨 Craft paths <span class="muted" style="font-size:12px">${E.memberPaths(m).filter(e => !E.pathDef(e.id).advanced).length} learned</span>${E.pendingPathChoices(m) ? ` <span class="tb">🎯 ${E.pendingPathChoices(m)}</span>` : ""}</h3>`;
  if (!m.craft) return h + `<div class="card muted">Join the 🔨 Crafters' Guild to start a main path (Apprentice → Journeyman → Master → Grandmaster).</div>`;
  if (E.memberPaths(m).length) h += slotsSummary(s, m);
  for (const e of E.memberPaths(m)) h += pathRow(m, e);
  const opens = defs.filter(x => !x.advanced && !E.pathOf(m, x.id));
  const iss = opens.length ? E.openPathIssue(s, m, opens[0].id) : "all paths taken";
  h += `<div class="card" style="padding:6px 8px;margin:4px 0"><b>${E.memberPaths(m).length ? "Open another path" : "🎯 Choose your main path"}</b><div class="muted" style="font-size:12px">${E.memberPaths(m).length ? "A new trade takes a free slot (secondary or gathering), otherwise you dabble in it at Apprentice." : "XP in the path's skills ranks it up. Your first crafting trade becomes your main."}${iss ? " · 🔒 " + iss : ""}</div><div class="row" style="flex-wrap:wrap;gap:4px">${opens
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
