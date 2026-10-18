import { classCard } from "./classes-ui.js";
import { fieldsLine } from "./fields-ui.js";
import { choresLine } from "./chores-ui.js";
import { ordersLine } from "./orders-ui.js";
import { settingsCard, tourPrompt, tutorialCard } from "./guide.js";
import { timerBar } from "./progress.js";
import { U } from "./state.js";
import * as E from "../engine.js";
import { suitorCard } from "./houses-tab.js";
import { badges, cl, costStr, injuryTags, doing, dur, it, itemStatsHtml, memberLine, sk, stage, yr } from "./common.js";
import { landShop } from "./estate-tab.js";
import { pathsCard } from "./paths-ui.js";
import { D, s, sheetOpen } from "../main.js";

export function hero() {
  const m = E.active(s);
  if (!m) return "";
  const a = m.action;
  let h = `<div class="card">${memberLine(m)}<div style="margin:4px 0">${badges(m)}</div>${injuryTags(m)}<div class="muted">${stage(m)} · Lv ${E.level(m)} · ⏱ personal tick ×${E.memberTick(m).toFixed(2)} (Focus, WIL)${m.injured ? " · 🤕 injured" : ""}${E.ageY(m) >= m.lifespan - 3 ? " · ⚠️ nearing end of life" : ""}</div>
 <div class="muted">Doing: ${doing(a)}</div>${timerBar(E.memberTimer(s, m))}
 ${a && a.type === "quest" ? `<div class="bar"><i style="width:${(a.progress / E.findId(D.quests, a.target).days) * 100}%"></i></div>` : ""}
 <div class="row" style="margin-top:6px"><button class="b" data-a="opentab" data-v="char">📋 Full sheet</button><button class="b" data-a="rest">🛌 Rest</button><button class="b" data-a="market" title="Buy and sell at the nearest town">🏪 Market</button></div></div>`;
  h += trainingv(m) + activities(m) + pathsCard(s, m);
  h += classCard(m); // R46 guild tiers
  return h;
}

const pct = x => (x > 0 ? "+" : "") + Math.round(x * 100) + "%";
export const moraleLine = () =>
  `${(s.morale || 0) >= 0 ? "🙂" : "😟"} Contentment ${(s.morale || 0) >= 0 ? "+" : ""}${(s.morale || 0).toFixed(1)}: skill XP ${pct(E.moraleXp(s))} · speed ${pct(E.moraleSpeed(s))} (work, activities, travel)`;

export function sheet(m) {
  const a = m.action;
  let h = `<div class="card"><b>📋 ${m.name}</b><div class="muted">Age ${E.ageY(m)} (${stage(m)}) · lifespan ~${m.lifespan} · Lv ${E.level(m)} · CP ${E.cp(s, m)} · ${cl(m.cls) ? cl(m.cls).name : "no class"}</div>
 <div class="muted" id="sheet-morale">${moraleLine()}</div>
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

const RICO = { food: "🍞", fish: "🐟", meat: "🥩", hides: "🦊", wood: "🪵", stone: "🪨", thyme: "🌿", stew: "🍲" };
const yieldStr = ac => {
  if (ac.refine) return `${ac.refine.from.join("/")} → ${Object.entries(ac.refine.to).map(([k, v]) => `${RICO[k] || ""}${+(v * E.taskMult(s, ac)).toFixed(2)} ${k}`).join(", ")}/d`;
  if (ac.effect === "explore") return "clears fog near home · chance of a find";
  const y = Object.entries(E.taskYields(s, ac));
  return y.length ? y.map(([k, v]) => `${RICO[k] || ""}+${+v.toFixed(2)} ${k}/d`).join(", ") : "XP only";
};
function actRow(m, ac, task) {
  const a = m.action, age = E.ageY(m);
  if (ac.maxAge && age > ac.maxAge) return "";
  const why = task ? E.taskLock(s, m, ac) : !E.activityOk(s, m, ac) ? (age < ac.minAge ? `age ${ac.minAge}+` : E.activityReq(ac)) : "";
  const on = a && a.type === "activity" && a.target === ac.id;
  const gains = `${Object.entries(ac.stats).map(([k, v]) => `+${k}`).join(", ")} · ${ac.skills.map(k => "+" + sk(k).name).join(", ")}`;
  const fishUi = task && ac.id === "fishing" && D.fish ? fishPicker() : "";
  return `<div class="card" style="padding:6px 8px;margin:4px 0"><div class="row"><span>${ac.icon} <b>${ac.name}</b>${ac.signature ? ' <span class="pill" title="Class/guild exclusive">⭐ signature</span>' : ""}<br><span class="muted">${task ? `<b>${yieldStr(ac)}</b> · ` : `<b>${{ basic: "Basic", advanced: "Advanced", master: "Master" }[ac.tier] || ""}</b> · `}${gains}${why ? " · 🔒 " + why : ""}</span></span><button class="b ${on ? "sel" : ""}" data-a="activity" data-v="${ac.id}" ${why ? "disabled" : ""}>Do</button></div>${fishUi}</div>`;
}
// R32: fishing spot picker (Auto picks the best open spot) + what is landing + species in store
function fishPicker() {
  const cur = E.fishSpot(s), pick = s.fishSpot || "auto";
  const chip = (id, label, iss) => `<button class="b ${pick === id ? "sel" : ""}" style="font-size:12px;padding:3px 8px" data-a="fishspot" data-v="${id}" ${iss ? `disabled title="${iss}"` : ""}>${label}${iss ? " 🔒" : ""}</button>`;
  const spots = E.FD().spots.filter(sp => !sp.future || true);
  const chips = chip("auto", "✨ Auto") + spots.filter(sp => !sp.future).map(sp => chip(sp.id, `${sp.icon} ${sp.name.split(" ")[0]}`, E.spotIssue(s, sp))).join("");
  const tbl = E.catchTable(s, cur.id).sort((a, b) => b.p - a.p).map(r => `${r.f.icon} ${r.f.name} ${Math.round(r.p * 100)}%`).join(" · ");
  const locked = spots.map(sp => [sp, E.spotIssue(s, sp)]).filter(([, i]) => i).map(([sp, i]) => `${sp.icon} ${sp.name}: ${i}`).join(" · ");
  const mix = E.fishMix(s).map(x => `${x.f.icon}${x.n} ${x.f.name}`).join(", ");
  return `<div style="margin-top:5px;display:flex;gap:4px;flex-wrap:wrap">${chips}</div><div class="muted" style="font-size:12px;margin-top:3px">Fishing at <b>${cur.icon} ${cur.name}</b>: ${tbl}${locked ? `<br>🔒 ${locked}` : ""}${mix ? `<br>In store: ${mix} · sells ×${E.fishPriceMult(s).toFixed(2)}` : ""}</div>`;
}
// R31: Tasks (resources) first, then a collapsed Training list (XP). Jobs (coin) live in Work → Jobs.
export function activities(m) {
  const hide = s.hideLocked !== false; // R31: default on, saved with the game
  const tAll = D.activities.filter(ac => ac.task && !(ac.maxAge && E.ageY(m) > ac.maxAge)), tOk = tAll.filter(ac => !E.taskLock(s, m, ac));
  const tasks = (hide ? tOk : tAll).map(ac => actRow(m, ac, true)).join("");
  let tr = [...D.activities].filter(ac => !ac.task && !(ac.maxAge && E.ageY(m) > ac.maxAge)).sort((x, y) => E.activityOk(s, m, y) - E.activityOk(s, m, x));
  const trHidden = hide ? tr.filter(ac => !E.activityOk(s, m, ac)).length : 0;
  if (hide) tr = tr.filter(ac => E.activityOk(s, m, ac));
  const tog = n => `<label class="chip" style="font-size:12px"><input type="checkbox" data-a="hidelocked" ${hide ? "checked" : ""}> Hide unavailable${hide && n ? ` (${n} hidden)` : ""}</label>`;
  const nOk = tr.filter(ac => E.activityOk(s, m, ac)).length;
  const onTr = m.action && m.action.type === "activity" && tr.some(ac => ac.id === m.action.target);
  return (
    `<h3>🧺 Tasks <span class="muted" style="font-size:12px">· resources for the family</span> ${tog(tAll.length - tOk.length)}</h3><div class="muted" style="font-size:12px">Tasks = resources · Jobs = coin (Work → Jobs) · Training = XP.</div>` +
    fieldsLine() + // R40
    choresLine() + // R42
    ordersLine() + // R43
    tasks +
    `<details ${onTr ? "open" : ""}><summary><b>🎯 Training</b> <span class="muted">· XP only · ${nOk} open</span> ${tog(trHidden)}</summary><div class="muted" style="font-size:12px">Skills grow through themed drills. Unlocks: furniture, items, guild rank or class line. ⭐ = exclusive.</div>${tr.map(ac => actRow(m, ac, false)).join("")}</details>`
  );
}

export function craftv(m) {
  const a = m.action;
  const mp = E.mainPath(m),
    pf = mp && E.pathDef(mp.id);
  let h = `<h3>🔨 Crafting ${pf ? `<span class="muted">· ${pf.icon} ${E.pathRankName(mp.rank)} ${pf.name}</span>` : ""}</h3><div class="muted">Needs stations in your buildings and materials. Quality (Crude→Masterwork) comes from skill, stations, synergies and profession.</div>`;
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
  let h = `<div class="card muted">${m.name} (${E.ageY(m)}) ${ad ? "works as a journeyman for full pay." : "can work for youth pay plus stat and skill growth. Adult pay is higher."}</div>`;
  for (const j of D.jobs) {
    const ok = E.jobOk(m, j),
      on = a && a.type === "job" && a.target === j.id;
    h += `<div class="card row"><span>${j.icon} <b>${j.name}</b><br><span class="muted">${j.desc}<br>${Object.keys(j.stats).join("/")} · ${j.skills.map(k => sk(k).name).join(", ")} · youth pay ${j.payChild}🪙/day · adult ${j.payAdult}🪙/day · age ${j.minAge}+</span></span><button class="b ${on ? "sel" : ""}" data-a="job" data-v="${j.id}" ${ok ? "" : "disabled"}>${ok ? (on ? "Working" : "Work") : "🔒"}</button></div>`;
  }
  return h;
}

export function quests() {
  const m = E.active(s);
  let h = "";
  if (!E.isAdult(m)) h += E.isTeen(m) ? `<div class="card muted">Teens can run safe errands, hunt, and take low-risk fights.</div>` : `<div class="card muted">Children can't quest. Switch to a teen or adult in Family.</div>`;
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
   <button class="b ${on ? "sel" : ""}" data-a="quest" data-v="${q.id}" ${E.canQuest(m, q, s) && qok ? "" : "disabled"}>Go</button></div>`;
    }
  }
  return h;
}

export function family() {
  const m = E.active(s);
  let h = `<h3>Members (${E.living(s).length}/${E.bedrooms(s)} beds)</h3>`;
  for (const x of s.members.filter(y => y.alive)) {
    const o = x.order;
    h += `<div class="card">${memberLine(x)} ${x.id === s.head ? "👑" : ""} ${x.id === s.activeId ? "<b>(active)</b>" : ""}<div class="muted">${x.spouse ? "Married to " + (E.findId(s.members, x.spouse) || {}).name : "Single"}</div>
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
  h += s.suitors.map(suitorCard).join("");
  if (s.suitors.length) h += `<div class="muted">More on suitors, houses and alliances in Family → 🏰 Houses.</div>`;
  const dead = s.members.filter(x => !x.alive && !x.marriedOut);
  if (dead.length)
    h += `<h3>🕯️ Ancestors</h3>` + dead.map(x => `<div class="muted">${x.name} (${E.ageY(x)}y)</div>`).join("");
  return h;
}

export function guildCard(m) {
  return (
    advLine(m) +
    guildCard0(m) +
    (m.craft
      ? `<div class="card row"><span>🔨 Crafters' Guild (open)</span><span>${E.mainPath(m) ? E.pathRankName(E.mainPath(m).rank) + " " + E.pathDef(E.mainPath(m).id).name : "choose a main path"}</span></div>`
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
              return `<div class="card row" style="padding:5px 8px;margin:4px 0"><span>${x.name} <span class="muted">${x.rarity} ${x.slot} · ${x.value}🪙</span>${itemStatsHtml(x, m)}</span><button class="b" data-a="buy" data-v="${t.id}" data-w="${id}" ${s.res.coin >= E.buyPrice(x, s, t.id) ? "" : "disabled"}>${E.buyPrice(x, s, t.id)}🪙</button></div>`;
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
          ? E.findId(D.quests, a.target).name
          : E.findId(D.nodes, a.target).name;
  return `<div class="card" style="border-color:#d9b44a"><b>🚶 ${m.name} is busy</b> <span class="muted">· ${{ out: "travelling to", task: a.type === "quest" ? "questing at" : a.type === "explore" ? "exploring" : "gathering at", back: "returning from" }[ph]} ${nm}</span>${timerBar(E.memberTimer(s, m))}<div class="muted">⏳ ${E.tripLeft(a).toFixed(1)} days left · locked until home</div></div>`;
}
