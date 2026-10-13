import { settingsCard, tourPrompt, tutorialCard } from "./guide.js";
import { timerBar } from "./progress.js";
import { U } from "./state.js";
import * as E from "../engine.js";
import { badges, cl, costStr, doing, dur, it, memberLine, sk, stage, yr } from "./common.js";
import { landShop } from "./estate-tab.js";
import { D, s, sheetOpen } from "../main.js";

export function hero() {
  const m = E.active(s);
  if (!m) return "";
  const a = m.action;
  let h = `<div class="card">${memberLine(m)}<div style="margin:4px 0">${badges(m)}</div><div class="muted">${stage(m)} · Lv ${E.level(m)} · ⏱ personal tick ×${E.memberTick(m).toFixed(2)} (Focus, WIL)${m.injured ? " · 🤕 injured" : ""}${E.ageY(m) >= m.lifespan - 3 ? " · ⚠️ nearing end of life" : ""}</div>
 <div class="muted">Doing: ${doing(a)}</div>${timerBar(E.memberTimer(s, m))}
 ${a && a.type === "quest" ? `<div class="bar"><i style="width:${(a.progress / D.quests.find(q => q.id === a.target).days) * 100}%"></i></div>` : ""}
 <div class="row" style="margin-top:6px"><button class="b ${sheetOpen ? "sel" : ""}" data-a="sheet">📋 Character Sheet ${sheetOpen ? "▴" : "▾"}</button><button class="b" data-a="rest">🛌 Rest</button></div></div>`;
  if (sheetOpen) h += sheet(m);
  h += trainingv(m) + activities(m);
  const evo = D.classes.filter(
    c => (c.from === m.cls && !c.profession) || (m.prof && c.from === m.prof && c.profession),
  );
  if (evo.length)
    h +=
      `<h3>Evolution</h3>` +
      evo
        .map(
          c =>
            `<div class="card row"><span>${c.icon} ${c.name}<br><span class="muted">${Object.entries(c.req)
              .map(([k, v]) => `${sk(k).name} ${m.skills[k].lvl}/${v}`)
              .join(
                " · ",
              )}${c.needsBuildings ? ` · ${E.structReqOk(s, c.needsBuildings) ? "✅" : "🔒"} needs ${E.structReqText(c.needsBuildings)}` : ""}${c.guild ? ` · ${E.guildDef(c.guild).icon} ${E.rankName(c.guildRank)} of ${E.guildDef(c.guild).name}` : ""}${c.advRank != null ? ` · Adventurers' Rank ${E.advRankName(c.advRank)}` : ""}${c.crafterRank != null ? ` · Crafters' ${E.rankName(c.crafterRank)}` : ""}${c.profession ? " · profession" : ""} · ${c.cost}🪙</span></span><button class="b" data-a="evolve" data-v="${c.id}" ${E.canEvolve(s, m, c) ? "" : "disabled"}>Evolve</button></div>`,
        )
        .join("");
  return h;
}

export function sheet(m) {
  const a = m.action;
  let h = `<div class="card"><b>📋 ${m.name}</b><div class="muted">Age ${E.ageY(m)} (${stage(m)}) · lifespan ~${m.lifespan} · Lv ${E.level(m)} · CP ${E.cp(s, m)} · ${cl(m.cls) ? cl(m.cls).name : "no class"}</div>
 <h3>Stats</h3><div class="grid">${E.STATS.map(k => `<span>${k} <b>${E.statVal(m, k)}</b></span>`).join("")}</div>
 <h3>Traits</h3>${m.traits
   .map(t => {
     const d = E.traitDef(t);
     return `<div><span class="tb">${d.icon} ${d.name}</span> <span class="muted">${d.desc}</span></div>`;
   })
   .join("")}
 <h3>Guilds</h3>${guildCard(m)}
 <h3>Skills (soft cap ${E.softCap(m)}) <span class="muted" style="font-size:11px">· view only; train from Main → Training</span></h3>`;
  for (const fam of [...new Set(D.skills.map(x => x.family))]) {
    h += `<div class="muted" style="margin-top:6px">${fam.toUpperCase()}</div>`;
    for (const x of D.skills.filter(y => y.family === fam)) {
      const v = m.skills[x.id];
      const on = a && a.type === "train" && a.target === x.id;
      const iss = E.trainIssue(m, x.id, s);
      h += `<div class="row" style="margin:3px 0"><span style="flex:1">${x.icon} ${x.name} <b>${v.lvl}</b><div class="bar"><i style="width:${(v.xp / E.xpNeed(v.lvl)) * 100}%"></i></div></span><span class="muted" style="font-size:11px;min-width:84px;text-align:right">${Math.floor(v.xp)}/${Math.round(E.xpNeed(v.lvl))} XP${on ? " · ⏳" : ""}</span></div>`;
    }
  }
  return h + `</div>`;
}

export function trainingv(m) {
  return "";
}

export function activities(m) {
  const a = m.action;
  const rows = [...D.activities]
    .sort((x, y) => E.activityOk(s, m, y) - E.activityOk(s, m, x))
    .map(ac => {
      const ok = E.activityOk(s, m, ac);
      const age = E.ageY(m);
      if (ac.maxAge && age > ac.maxAge) return "";
      const why = age < ac.minAge ? `age ${ac.minAge}+` : ac.unlock ? E.activityReq(ac) : "";
      const _w = 0
        ? `${(E.guildDef(ac.unlock.guild) || {}).name} rank ${(ac.unlock.rank || 0) + 1}`
        : ac.unlock?.quest
          ? `complete “${D.quests.find(q => q.id === ac.unlock.quest).name}”`
          : ac.unlock?.building
            ? `build ${D.buildings.find(b => b.id === ac.unlock.building).name}`
            : "";
      const on = a && a.type === "activity" && a.target === ac.id;
      return `<div class="card row" style="padding:6px 8px;margin:4px 0"><span>${ac.icon} ${ac.name}${ac.signature ? ' <span class="pill" title="Class/guild exclusive">⭐ signature</span>' : ""}<br><span class="muted"><b>${{ basic: "Basic", advanced: "Advanced", master: "Master" }[ac.tier] || ""}</b> · ${Object.entries(
        ac.stats,
      )
        .map(([k, v]) => `+${k} ${v}/d`)
        .join(
          ", ",
        )} · ${ac.skills.map(k => "+" + sk(k).name).join(", ")}${ok ? "" : " · 🔒 " + why}</span></span><button class="b ${on ? "sel" : ""}" data-a="activity" data-v="${ac.id}" ${ok ? "" : "disabled"}>Do</button></div>`;
    })
    .join("");
  return (
    `<h3>🎯 Training & Activities</h3><div class="muted" style="font-size:12px">Skills grow only through themed activities. Unlocks: furniture, items, guild rank or class line. ⭐ = exclusive.</div>` +
    rows
  );
}

export function craftv(m) {
  const a = m.action;
  const pf = m.prof && cl(m.prof);
  let h = `<h3>🔨 Crafting ${pf ? `<span class="muted">· ${pf.icon} ${pf.name}</span>` : ""}</h3><div class="muted">Needs stations in your buildings and materials. Quality (Crude→Masterwork) comes from skill, stations, synergies and profession.</div>`;
  for (const rc of D.crafting.recipes) {
    const iss = E.recipeIssue(s, m, rc),
      on = a && a.type === "craft" && a.target === rc.id;
    const sc = E.qualityScore(s, m, rc);
    h += `<div class="card row" style="padding:6px 8px;margin:4px 0"><span>${rc.name} <span class="muted">${costStr(rc.mats)} · ${rc.days}d · ${sk(rc.skill).name} · ${E.pieceDef(rc.station).name} · likely ${
      E.qualities()
        .filter(q => sc + 0.25 >= q.score)
        .pop().name
    }${iss ? " · 🔒 " + iss : ""}</span>${on ? `<div class="bar"><i style="width:${((a.progress || 0) / rc.days) * 100}%"></i></div>` : ""}</span><button class="b ${on ? "sel" : ""}" data-a="craft" data-v="${rc.id}" ${iss || !E.isAdult(m) ? "disabled" : ""}>Craft</button></div>`;
  }
  return h;
}

export function jobsv() {
  const m = E.active(s),
    a = m.action,
    ad = E.isAdult(m);
  let h = `<div class="card muted">${m.name} (${E.ageY(m)}) ${ad ? "works as a journeyman for full pay." : "can apprentice for small pay plus stat and skill growth. Adult pay is higher."}</div>`;
  for (const j of D.jobs) {
    const ok = E.jobOk(m, j),
      on = a && a.type === "job" && a.target === j.id;
    h += `<div class="card row"><span>${j.icon} <b>${j.name}</b><br><span class="muted">${j.desc}<br>${Object.keys(j.stats).join("/")} · ${j.skills.map(k => sk(k).name).join(", ")} · apprentice ${j.payChild}🪙/day · adult ${j.payAdult}🪙/day · age ${j.minAge}+</span></span><button class="b ${on ? "sel" : ""}" data-a="job" data-v="${j.id}" ${ok ? "" : "disabled"}>${ok ? (on ? "Working" : "Work") : "🔒"}</button></div>`;
  }
  return (
    h +
    `<div class="card row"><span>🔨 Crafting has its own tab.</span>${E.craftingUnlocked(s) ? '<button class="b" data-tab="craft">Open Crafting</button>' : '<span class="muted">Unlocks with your first crafter (Artisan line, Crafters\' Guild, or an Artisan/Herbalist follower)</span>'}</div>`
  );
}

export function quests() {
  const m = E.active(s);
  let h = "";
  if (!E.isAdult(m)) h += `<div class="card muted">Children can't quest. Switch to an adult in Family.</div>`;
  for (const rg of D.regions) {
    const open = E.regionOpen(s, rg.id);
    h += `<h3>${rg.icon} ${rg.name} ${open ? "" : `🔒 (needs CP ${rg.cp})`}</h3>`;
    if (!open) continue;
    for (const q of D.quests.filter(x => x.region === rg.id && !x.story && E.known(s, x))) {
      const on = m.action && m.action.type === "quest" && m.action.target === q.id;
      const qok = E.questOk(m, q);
      h += `<div class="card row"><span>${q.guild ? E.guildDef(q.guild).icon + " " : ""}${q.name} <span class="risk-${q.risk}">[${q.risk}]</span>${q.adv && !qok ? `<br><span class="muted">🔒 Adventurers' Rank ${E.advRankName(q.adv)}</span>` : ""}${q.guild && !qok ? `<br><span class="muted">🔒 ${E.rankName(q.rank)} of ${E.guildDef(q.guild).name}</span>` : ""}<br><span class="muted">CP ${q.cp} · ${q.days}d · ${Object.entries(
        q.reward,
      )
        .map(([k, v]) => v + " " + k)
        .join(
          ", ",
        )} · ${Math.round(E.successChance(s, m, q) * 100)}% success${q.risk === "deadly" ? ` · ☠️ ${D.tuning.deadlyDeathChance * 100}%+ death risk` : ""}</span></span>
   <button class="b ${on ? "sel" : ""}" data-a="quest" data-v="${q.id}" ${E.isAdult(m) && qok ? "" : "disabled"}>Go</button></div>`;
    }
  }
  return h;
}

export function family() {
  const m = E.active(s);
  let h = `<h3>Members (${E.living(s).length}/${E.bedrooms(s)} beds)</h3>`;
  for (const x of s.members.filter(y => y.alive)) {
    const o = x.order;
    h += `<div class="card">${memberLine(x)} ${x.id === s.head ? "👑" : ""} ${x.id === s.activeId ? "<b>(active)</b>" : ""}<div class="muted">${x.spouse ? "Married to " + (s.members.find(y => y.id === x.spouse) || {}).name : "Single"}</div>
  ${
    x.id !== s.activeId
      ? `<div class="row" style="margin-top:4px"><span class="muted">Order:</span>${
          E.isAdult(x)
            ? `<select data-a="order" data-v="${x.id}">
  ${["train", "quest", "work", "rest"].map(t => `<option ${o.type === t ? "selected" : ""}>${t}</option>`).join("")}</select>
  ${o.type === "train" ? `<select data-a="ordt" data-v="${x.id}">${D.skills.map(k => `<option value="${k.id}" ${o.target === k.id ? "selected" : ""}>${k.name}</option>`).join("")}</select>` : ""}
  ${o.type === "quest" ? `<select data-a="ordt" data-v="${x.id}">${D.regions.map(k => `<option value="${k.id}" ${o.target === k.id ? "selected" : ""}>${k.name}</option>`).join("")}</select>` : ""}`
            : '<span class="muted">growing up</span>'
        }
  <button class="b" data-a="switch" data-v="${x.id}">Play</button></div>`
      : ""
  }</div>`;
  }
  h += `<h3>💌 Suitors ${E.ageY(m) < D.tuning.courtAge ? "(active member must be ${D.tuning.courtAge}+)" : ""}</h3>`;
  if (!s.suitors.length) h += `<div class="muted">None yet. They appear in town every ~45 days.</div>`;
  const gifts = [...new Set(s.vault.filter(i => it(i).slot === "gift"))];
  for (const su of s.suitors) {
    h += `<div class="card"><div class="row"><span>${su.name}, ${su.age} · ${cl(su.cls).name}</span><span>❤️ ${Math.floor(su.affinity)}/100</span></div><div class="bar"><i style="width:${su.affinity}%;background:#e66"></i></div>
  <div class="row"><button class="b" data-a="court" data-v="${su.id}" ${E.ageY(m) >= D.tuning.courtAge && !m.spouse ? "" : "disabled"}>Court</button>
  ${gifts.map(g => `<button class="b" data-a="gift" data-v="${su.id}" data-w="${g}">🎁 ${it(g).name}</button>`).join("")}
  <button class="b" data-a="propose" data-v="${su.id}" ${!E.proposeIssue(s, su.id) && E.ageY(m) >= D.tuning.courtAge ? "" : "disabled"}>💍 Propose (${E.PROPOSE_COST}🪙)</button></div>${su.affinity >= 100 && E.proposeIssue(s, su.id) ? `<div class="muted">Needs ${E.proposeIssue(s, su.id)}</div>` : ""}</div>`;
  }
  const dead = s.members.filter(x => !x.alive);
  if (dead.length)
    h += `<h3>🕯️ Ancestors</h3>` + dead.map(x => `<div class="muted">${x.name} (${E.ageY(x)}y)</div>`).join("");
  return h;
}

export function guildCard(m) {
  return (
    advLine(m) +
    guildCard0(m) +
    (m.craft
      ? `<div class="card row"><span>🔨 Crafters' Guild (open)</span><span>${E.rankName(m.craft.rank)} · ${m.prof ? cl(m.prof).name : ""}</span></div>`
      : "")
  );
}

export function advLine(m) {
  return `<div class="card row"><span>⚔️ Adventurers' Guild</span><span>${m.adv ? "Rank <b>" + E.advRankName(m.adv.rank) + "</b>" : '<span class="muted">not registered</span>'}</span></div>`;
}

export function guildCard0(m) {
  if (!m.guild)
    return `<div class="card"><b>🏛️ Guild</b><div class="muted">${m.name} is unaffiliated. Guild halls are in towns on the Map. Class guilds: one per member for life. Adventurers' and Crafters' guilds are open to all.</div></div>`;
  const g = E.guildDef(m.guild.id),
    n = E.nextRank(m);
  return `<div class="card"><div class="row"><b>${g.icon} ${g.name}</b><span>🎖️ ${E.rankName(m.guild.rank)}</span></div><div class="muted">${g.desc}</div>
 ${n ? `<div class="bar"><i style="width:${Math.min(100, (m.guild.rep / n.rep) * 100)}%;background:#d9b44a"></i></div><div class="row"><span class="muted">${m.guild.rep >= n.rep ? "✓ Rep " + n.rep + " reached" : "Rep " + m.guild.rep + "/" + n.rep} → ${n.name} (${n.cost}🪙)</span><button class="b" data-a="rankup" ${E.canRankUp(s, m) ? "" : "disabled"}>Rank up</button></div>` : '<div class="muted">Highest rank reached.</div>'}
 <div class="muted">Perks: +${5 * (m.guild.rank + 1)}% XP in ${g.skills.map(k => sk(k).name).join(", ")}</div></div>`;
}

export function saveCard() {
  return `<div class="card"><b>💾 Save export / import</b><div class="row" style="gap:6px;justify-content:flex-start;flex-wrap:wrap;margin:4px 0"><button class="b" data-a="exportsave">Export code + file</button><button class="b" data-a="importsave">Import code</button><label class="b">Import file <input type="file" accept=".txt,.json,application/json,text/plain" data-a="importfile" style="display:none"></label></div>
 <textarea id="savecode" rows="3" style="width:100%" placeholder="Paste a save code here to import, or press Export">${U.exportText || ""}</textarea>${U.saveMsg ? `<div class="muted">${U.saveMsg}</div>` : ""}</div>`;
}

export function mainv() {
  const m = E.active(s);
  let h = tourPrompt() + tutorialCard() + busyBanner(m) + hero();
  const others = E.living(s).filter(x => x.id !== m.id);
  if (others.length)
    h =
      `<div class="row" style="flex-wrap:wrap;gap:4px"><span class="muted">Play as:</span>${E.living(s)
        .map(
          x =>
            `<button class="b ${x.id === m.id ? "sel" : ""}" data-a="switch" data-v="${x.id}">${x.name} (${E.ageY(x)})</button>`,
        )
        .join("")}</div>` + h;
  h += courtship();
  const towns = D.towns.filter(t => E.regionOpen(s, t.region) && E.townKnown(s, t));
  h += `<h3>📜 Land for sale</h3>` + (landShop() || '<div class="muted">You own every parcel.</div>');
  h +=
    `<h3>🛒 Buy items</h3>` +
    towns
      .map(
        t =>
          `<div class="muted">${t.icon} ${t.name}</div>` +
          t.shop
            .map(id => {
              const x = it(id);
              return `<div class="card row" style="padding:5px 8px;margin:4px 0"><span>${x.name} <span class="muted">${x.rarity} ${x.slot}${x.cp ? " +" + x.cp + " CP" : ""}${x.affinity ? " +" + x.affinity + "❤️ gift" : ""}</span></span><button class="b" data-a="buy" data-v="${t.id}" data-w="${id}" ${s.res.coin >= E.buyPrice(x, s, t.id) ? "" : "disabled"}>${E.buyPrice(x, s, t.id)}🪙</button></div>`;
            })
            .join(""),
      )
      .join("");
  h +=
    `<h3>📜 Recent</h3>` +
    s.log
      .slice(0, 8)
      .map(l => `<div class="muted">Y${yr(l.d) + 1} D${(l.d % D.tuning.daysPerYear) + 1} · ${l.msg}</div>`)
      .join("") +
    saveCard() +
    settingsCard() +
    `<div class="row"><button class="b" data-a="reset">New Lineage</button></div>`;
  return h;
}

export function courtship() {
  return family().split("<h3>💌")[1]?.split("<h3>🕯️")[0].replace(/^/, "<h3>💌") || "";
}

export function busyBanner(m) {
  if (!E.isBusy(m)) return "";
  const a = m.action,
    ph = E.tripPhase(a),
    nm =
      a.type === "explore"
        ? E.areaDef(a.target).name
        : a.type === "quest"
          ? D.quests.find(q => q.id === a.target).name
          : D.nodes.find(n => n.id === a.target).name;
  return `<div class="card" style="border-color:#d9b44a"><b>🚶 ${m.name} is busy</b> <span class="muted">· ${{ out: "travelling to", task: a.type === "quest" ? "questing at" : a.type === "explore" ? "exploring" : "gathering at", back: "returning from" }[ph]} ${nm}</span>${timerBar(E.memberTimer(s, m))}<div class="muted">⏳ ${E.tripLeft(a).toFixed(1)} days left · locked until home</div></div>`;
}
