import { pbar, timerBar } from "./progress.js";
import * as E from "../engine.js";
import { QC, fmt, it } from "./common.js";
import { D, s } from "../main.js";
import { setsCard } from "./gear-ui.js";

// milestone upgrades: Auto/Manual toggle, owned upgrades, waiting choices (badge; never blocking)
function upgradesBlock(mi) {
  const MS = D.minions.milestones,
    own = mi.ups || [],
    pend = mi.pending || [];
  const lv = E.minionLvl(mi),
    next = Math.ceil((lv + 1) / MS.every) * MS.every;
  let h = `<div style="margin-top:4px"><div class="row" style="flex-wrap:wrap;gap:4px"><b>🔓 Upgrades</b>${pend.length ? `<span class="tb" style="border-color:#d9b44a">🎯 ${pend.length} to choose</span>` : ""}<span style="flex:1"></span><button class="b ${E.upMode(mi) === "auto" ? "sel" : ""}" data-a="mupmode" data-v="${mi.uid}" data-w="auto">Auto</button><button class="b ${E.upMode(mi) === "manual" ? "sel" : ""}" data-a="mupmode" data-v="${mi.uid}" data-w="manual">Manual</button></div>`;
  h += own.length ? `<div>${own.map(u => { const d = E.upDef(u.id); return d ? `<span class="tb" title="${d.desc}">${d.icon} ${d.name}${u.mult > 1 ? " ×" + u.mult : ""}${u.job ? " (" + u.job + ")" : ""}</span>` : ""; }).join("")}</div>` : "";
  h += lv < D.minions.leveling.maxLvl ? pbar(((lv - (next - MS.every)) + Math.min(1, (mi.xp || 0) / E.minionXpNeed(lv))) / MS.every, `next upgrade at Lv ${next} (evolving gives a double one)`, null, "thin") : "";
  for (const [i, p] of pend.entries())
    h += `<div class="row" style="flex-wrap:wrap;gap:4px;margin-top:3px"><span class="muted">${p.why}${p.big ? " (double)" : ""}:</span>${p.offer.map(id => { const d = E.upDef(id); return `<button class="b" data-a="mupick" data-v="${mi.uid}" data-w="${i}" data-x="${id}" title="${d.desc}">${d.icon} ${d.name}</button>`; }).join("")}</div>`;
  return h + `</div>`;
}

export function minionsv() {
  const M = D.minions;
  const mt = id => M.types.find(t => t.id === id);
  let h = `<div class="card"><b>🧑‍🤝‍🧑 Followers ${s.minions.filter(x => !x.special).length}/${E.minionCap(s)}${s.minions.some(x => x.special) ? " + " + s.minions.filter(x => x.special).length + " ⭐" : ""}</b><div class="muted">Wages ${E.monthlyWages(s)}🪙/month · eat ${E.minionFood(s)}🍞/day (pool ${fmt(s.res.food)}${s.res.food < E.minionFood(s) ? " ⚠️ hungry!" : ""}) · 🛌 bunks ${E.housingUsed(s, "bunk")}/${E.housingCap(s, "bunk")}${E.housingCap(s, "bunk") ? "" : " – build a Bunk or Bunkhouse to hire"} · ${E.established(s) ? "assign them to estate work below" : "jobs unlock once a House establishes the estate"}</div><div class="muted">Gained by hiring in towns, rescues on some quests, tavern rumors, and estate reputation (every ${M.reputationEveryRenown} Renown).</div></div>`;
  if (!s.minions.length) h += `<div class="muted">No followers yet.</div>`;
  if (E.pendingCount(s)) h += `<div class="card tut">🎯 ${E.pendingCount(s)} follower upgrade choice${E.pendingCount(s) > 1 ? "s" : ""} waiting (Manual mode). Followers keep working meanwhile.</div>`;
  for (const mi of s.minions) {
    const t = mt(mi.type);
    h += `<div class="card" ${mi.special ? 'style="border-color:#d9b44a"' : ""}><div class="row"><span>${t.icon} <b>${mi.name}</b>${(mi.pending || []).length ? ' <span class="tb" style="border-color:#d9b44a">🎯</span>' : ""}${mi.special ? ' <span class="tb" style="border-color:#d9b44a">⭐ Special</span>' : " · " + t.name}</span><span class="muted">${mi.cls ? E.npcClass(mi.cls).icon + " " + E.npcClass(mi.cls).name + " · " : ""}Lv ${E.minionLvl(mi)} · ❤️ ${Math.round(mi.loyalty)} · ${t.wage}🪙/mo</span></div>${mi.job ? timerBar(E.minionTimer(s, mi)) : pbar((mi.xp || 0) / E.minionXpNeed(E.minionLvl(mi)), "XP · idle")}${
      E.evolveOptions(mi).length
        ? `<div class="row" style="flex-wrap:wrap;gap:4px;justify-content:flex-start"><span class="muted">Evolve:</span>${E.evolveOptions(
            mi,
          )
            .map(
              c =>
                `<button class="b" data-a="mevolve" data-v="${mi.uid}" data-w="${c.id}" ${E.minionEvolveIssue(s, mi, c.id) ? "disabled" : ""} title="${Object.entries(
                  c.bonus,
                )
                  .map(([k, v]) => "+" + v * 100 + "% " + k)
                  .join(
                    ", ",
                  )}">${c.icon} ${c.name} <span class="muted">(${c.branch}${c.needs && c.needs.all ? " · " + E.structReqText(c.needs.all) : c.needs && c.needs.buildings.length ? " · " + (c.needs.buildings.length > 2 ? "class building" : c.needs.buildings.map(id => D.estate.structures.find(x => x.id === id).name).join("/")) + (c.needs.up ? " upg " + c.needs.up : "") : ""}${E.minionEvolveIssue(s, mi, c.id) ? " · 🔒 " + E.minionEvolveIssue(s, mi, c.id) : ""})</span></button>`,
            )
            .join("")}</div>`
        : ""
    }<div class="muted" style="font-size:11px">XP ${Math.floor(mi.xp || 0)}/${E.minionXpNeed(E.minionLvl(mi))} · output ×${E.minionLvlMult(mi).toFixed(2)}${
      E.minionPerks(mi).length
        ? " · ✨ " +
          E.minionPerks(mi)
            .map(p => p.text)
            .join(" · ")
        : D.minions.perks[mi.job]
          ? " · next perk at Lv " + Object.keys(D.minions.perks[mi.job]).find(l => +l > E.minionLvl(mi))
          : ""
    }</div><div class="muted">${mi.home ? "🏠 lives in " + E.structName(s.structures.find(x => x.uid === mi.home)) + " (class home, +15%)" : E.isHoused(s, mi) ? "🏠 housed (" + t.housing + ")" : "⛺ UNHOUSED – needs " + ({ bunk: "a Bunk/Bunkhouse", kennel: "a Kennel", perch: "a Perch", brazier: "a Brazier", garden: "a Small Garden" }[t.housing] || t.housing) + "; cannot work"}${mi.hunger ? " · 🍽️ hungry " + mi.hunger + "d (output halved)" : ""}</div>
  ${mi.special ? `<div class="muted">⭐ ${E.sourceLabel(t)}${t.source.quest ? "" : " (" + mi.source + ")"} · ${t.desc}</div>` : ""}<div class="row" style="flex-wrap:wrap;gap:4px;margin:4px 0">${E.minionSlots(mi)
    .map(sl => {
      const g = (mi.equip || {})[sl];
      return g
        ? `<span class="tb" style="color:${QC[it(g).rarity] || "#ccc"}">${sl}: ${it(g).name} <a data-a="munequip" data-v="${mi.uid}" data-w="${sl}" style="cursor:pointer">✖</a></span>`
        : `<span class="tb muted">${sl}: —</span>`;
    })
    .join("")}
  ${(() => {
    const opts = [...new Set(s.vault)].filter(id => {
      const x = it(id);
      return (
        x &&
        E.minionSlots(mi).includes(x.slot) &&
        (!x.companion || ["kennel", "perch", "brazier"].includes(t.housing))
      );
    });
    return opts.length
      ? `<select data-a="mequipsel" data-v="${mi.uid}"><option value="">+ Equip from vault…</option>${opts.map(id => `<option value="${id}">${it(id).slot}: ${it(id).name} (+${it(id).cp})</option>`).join("")}</select>`
      : "";
  })()}</div>
  ${upgradesBlock(mi)}${setsCard(mi.equip, "minion")}
  <div class="muted">Gear: job output ×${E.minionGearMult(mi, mi.job).toFixed(2)}${E.minionSurvival(mi) < 1 ? " · hunger resistance " + Math.round((1 - E.minionSurvival(mi)) * 100) + "%" : ""}</div><div class="muted">Good at: ${Object.entries(
    t.apt,
  )
    .map(([j, v]) => M.jobs.find(x => x.id === j).name + " ×" + v)
    .join(", ")}</div>
  <div class="row" style="margin-top:4px"><select data-a="mjob" data-v="${mi.uid}">${M.jobs.map(j => `<option value="${j.id}" ${mi.job === j.id ? "selected" : ""} ${E.jobOpen(s, j.id) ? "" : "disabled"}>${j.icon} ${j.name}${j.id === "idle" || j.id === "guard" ? "" : " " + E.jobUsed(s, j.id) + "/" + (isFinite(E.jobCap(s, j.id)) ? E.jobCap(s, j.id) : "∞")}${E.jobOpen(s, j.id) ? "" : " 🔒"}</option>`).join("")}</select><button class="b" data-a="dismiss" data-v="${mi.uid}">Dismiss</button></div></div>`;
  }
  const locked = M.types.filter(t => t.special && !s.specialGranted.includes(t.id));
  h +=
    `<h3>⭐ Special followers to unlock (${locked.length})</h3>` +
    locked
      .map(
        t =>
          `<div class="muted">${t.icon} ${t.name} — ${
            t.source.buildings
              ? "Estate needs: " +
                E.buildingReqStatus(s, t.source.buildings)
                  .map(g => `${g.ok ? "✅" : "❌"} ${g.names.join(" or ")}`)
                  .join(" + ")
              : E.sourceLabel(t)
          }</div>`,
      )
      .join("");
  h +=
    `<h3>Jobs</h3>` +
    M.jobs
      .filter(j => j.id !== "idle")
      .map(
        j =>
          `<div class="muted">${j.icon} ${j.name}${j.needs ? ` (needs ${D.buildings.find(b => b.id === j.needs).name})` : ""}: ${j.desc} · assigned ${s.minions.filter(x => x.job === j.id).length}</div>`,
      )
      .join("");
  h += `<h3>Hire</h3>`;
  for (const t of D.towns.filter(t => E.regionOpen(s, t.region) && E.townKnown(s, t)))
    h +=
      `<div class="muted">${t.icon} ${t.name}</div>` +
      E.hireable(s, t.id)
        .map(
          x =>
            `<div class="card row" style="padding:5px 8px;margin:4px 0"><span>${x.icon} ${x.name} <span class="muted">${x.wage}🪙/mo</span></span><button class="b" data-a="hire" data-v="${t.id}" data-w="${x.id}" ${s.res.coin >= x.hire && E.minionRoom(s) ? "" : "disabled"}>${x.hire}🪙</button></div>`,
        )
        .join("");
  return h;
}
