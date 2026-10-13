import { pbar, secPerDay } from "./progress.js";
import * as E from "../engine.js";
import { U } from "./state.js";
import { RI, dur, fmt, sk, unlockName } from "./common.js";
import { landShop } from "./estate-tab.js";
import { guildHall } from "./guilds-tab.js";
import { D, s } from "../main.js";
import { busyBanner } from "./main-tab.js";

export function qKind(q) {
  return q.story
    ? ["📖", "#e6c34a", "Story"]
    : q.once
      ? s.doneQuests.includes(q.id)
        ? ["✔️", "#888", "One-time (done)"]
        : ["⭐", "#c58cf0", "One-time"]
      : ["🔁", "#7fc8ff", "Repeatable"];
}

export function rareLine(src) {
  if (!src.rare) return "";
  return `<div class="muted">🌟 Rare drops: ${src.rare.map(d => (E.dropFound(s, d.id) ? `<b>${E.dropName(d.id)}</b> (${d.chance * 100}%)` : "???")).join(", ")}</div>`;
}

export function mapSvg(m) {
  const MP = D.map,
    W = MP.size.w,
    H = MP.size.h;
  if (!U.mv) U.mv = { x: 0, y: 0, w: W, h: H };
  let g = "";
  for (const r of MP.regions) {
    const rg = D.regions.find(x => x.id === r.id),
      kn = E.regionKnown(s, r.id),
      op = E.regionOpen(s, r.id);
    g += `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="14" fill="${r.color}" stroke="#000" stroke-opacity=".4"/>`;
    g += `<text x="${r.x + 12}" y="${r.y + 26}" font-size="20" fill="#fff" opacity=".8">${kn ? rg.icon + " " + rg.name : "❔ Uncharted"}${kn && !op ? " 🔒 CP " + rg.cp : ""}</text>`;
    if (!op)
      g += `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="14" fill="#9aa" opacity="${kn ? 0.45 : 0.8}"/>`;
  }
  for (const a of MP.areas.filter(a => E.regionKnown(s, a.region))) {
    const ex = E.explored(s, a.id),
      sel = U.mapSel === "a:" + a.id;
    g += `<g data-a="mapsel" data-v="a:${a.id}" style="cursor:pointer"><circle cx="${a.x}" cy="${a.y}" r="${a.r}" fill="${ex ? "none" : "#cfd6d6"}" fill-opacity="${ex ? 0 : 0.75}" stroke="${sel ? "#ffd34d" : "#fff"}" stroke-width="${sel ? 5 : 2}" stroke-dasharray="${ex ? "8 6" : "0"}"/><text x="${a.x}" y="${a.y + 8}" font-size="${ex ? 20 : 34}" text-anchor="middle">${ex ? "🧭" : "❓"}</text><text x="${a.x}" y="${a.y + a.r - 10}" font-size="15" text-anchor="middle" fill="#fff">${ex ? a.name : "Unexplored"}</text></g>`;
  }
  const pin = (id, x, y, ic, col, lab, kind) =>
    `<g data-a="mapsel" data-v="${kind}:${id}" style="cursor:pointer"><circle cx="${x}" cy="${y}" r="${U.mapSel === kind + ":" + id ? 24 : 19}" fill="#141824" stroke="${col}" stroke-width="3"/><text x="${x}" y="${y + 7}" font-size="20" text-anchor="middle">${ic}</text>${lab ? `<text x="${x}" y="${y + 38}" font-size="13" text-anchor="middle" fill="#fff">${lab}</text>` : ""}</g>`;
  for (const t of D.towns)
    if (E.townKnown(s, t) && E.regionKnown(s, t.region)) {
      const p = MP.towns[t.id];
      g += pin(t.id, p.x, p.y, t.icon, "#fff", t.name, "t");
      const ev = E.eventsAtTown(s, t.id);
      if (ev.length)
        g += `<text x="${p.x + 20}" y="${p.y - 14}" font-size="18">${ev.map(e => E.eventType(e.type).icon).join("")}</text>`;
    }
  for (const n of D.nodes)
    if (E.known(s, n) && E.regionKnown(s, n.region)) {
      const p = MP.points[n.id];
      g += pin(n.id, p.x, p.y, n.icon, "#8fd18f", "", "n");
    }
  for (const q of D.quests)
    if (
      E.known(s, q) &&
      E.regionKnown(s, q.region) &&
      !(q.story && E.questIssue(s, m, q) && E.questIssue(s, m, q).startsWith("finish"))
    ) {
      const p = MP.points[q.id],
        k = qKind(q);
      g += pin(q.id, p.x, p.y, k[0], k[1], "", "q");
    }
  for (const d of D.dungeons)
    if (E.known(s, d) && E.regionKnown(s, d.region)) {
      const p = MP.points[d.id];
      g += pin(d.id, p.x, p.y, d.icon, (s.cleared || []).includes(d.id) ? "#888" : "#ff7a5c", "", "d");
    }
  const hm = MP.home;
  g += `<g><circle cx="${hm.x}" cy="${hm.y}" r="26" fill="#3a2a10" stroke="#ffd34d" stroke-width="3"/><text x="${hm.x}" y="${hm.y + 9}" font-size="26" text-anchor="middle">🏡</text></g>`;
  const mins = s.minions.filter(x => ["gather", "herbs", "mine", "farm"].includes(x.job));
  mins.forEach((x, i) => {
    const an = (i / Math.max(1, mins.length)) * 6.283;
    g += `<circle cx="${hm.x + Math.cos(an) * 42}" cy="${hm.y + Math.sin(an) * 42}" r="6" fill="#9ad"><title>${x.name} (${x.job})</title></circle>`;
  });
  for (const x of E.living(s))
    if (x.action && x.action.trip) {
      const p = E.ptOf(x.action.target),
        d = E.tripPos(x.action),
        act = x.id === m.id;
      g += `<line x1="${hm.x}" y1="${hm.y}" x2="${p.x}" y2="${p.y}" stroke="${act ? "#ffd34d" : "#bcd"}" stroke-width="${act ? 4 : 2.5}" stroke-dasharray="3 9" stroke-linecap="round"/><circle cx="${d.x}" cy="${d.y}" r="${act ? 11 : 8}" fill="${act ? "#ffd34d" : "#bcd"}" stroke="#000"><title>${x.name}</title></circle>`;
    }
  return `<div class="card" style="padding:4px"><div class="row" style="justify-content:flex-end;gap:4px"><button class="b" data-a="zoom" data-v="0.7">＋</button><button class="b" data-a="zoom" data-v="1.4">－</button><button class="b" data-a="zoom" data-v="0">⟲</button></div>
 <svg id="worldmap" viewBox="${U.mv.x} ${U.mv.y} ${U.mv.w} ${U.mv.h}" style="width:100%;height:58vh;touch-action:none;background:#0d1a12;border-radius:10px;user-select:none">${g}</svg>
 <div class="muted" style="font-size:11px">Drag to pan, pinch/scroll or ＋/－ to zoom, tap a marker. 📖 story · ⭐ one-time · 🔁 repeatable · 🌫️ unexplored.</div></div>`;
}

export function mapDetail(m) {
  if (!U.mapSel) return '<div class="muted">Tap a marker on the map for details.</div>';
  const [k, id] = U.mapSel.split(":");
  const busy = E.isBusy(m);
  let h = "";
  const trav = `${E.travelDays(id)} days each way (~${dur(E.travelDays(id))})`;
  if (k === "q") {
    const q = D.quests.find(x => x.id === id),
      kd = qKind(q),
      iss = E.questIssue(s, m, q) || (!E.isAdult(m) ? "adults only" : null),
      on = m.action && m.action.type === "quest" && m.action.target === id;
    h = `<div class="card"><b>${kd[0]} ${q.name}</b> <span class="tb" style="border-color:${kd[1]}">${kd[2]}${q.story ? " · ch. " + q.story : ""}</span> <span class="risk-${q.risk}">[${q.risk}]</span>${q.desc ? `<div class="muted">${q.desc}</div>` : ""}
  <div class="muted">CP ${q.cp} · task ${q.days}d · 🚶 ${trav} · reward ${Object.entries(q.reward)
    .map(([k, v]) => v + (RI[k] || k))
    .join(" ")}${
    q.grants
      ? " · 🎁 " +
        Object.entries(q.grants)
          .map(([k, v]) =>
            k === "item"
              ? E.itemDef(v).name
              : k === "minion"
                ? "follower"
                : k === "land"
                  ? "land deed"
                  : "+" + v + " renown",
          )
          .join(", ")
      : ""
  } · ${Math.round(E.successChance(s, m, q) * 100)}%</div>${rareLine(q)}
  <div class="row"><span class="muted">${iss ? "🔒 " + iss : busy && !on ? "🚶 busy travelling" : ""}</span><button class="b ${on ? "sel" : ""}" data-a="quest" data-v="${q.id}" ${iss || (busy && !on) ? "disabled" : ""}>${on ? "On it" : "Go"}</button></div></div>`;
  }
  if (k === "n") {
    const n = D.nodes.find(x => x.id === id),
      on = m.action && m.action.type === "gather" && m.action.target === id,
      ok = E.actionAllowed(s, m, { type: "gather", target: id });
    h = `<div class="card"><b>${n.icon} ${n.name}</b> <span class="tb">🔁 Resource node</span><div class="muted">${Object.entries(
      n.res,
    )
      .map(([k, v]) => `+${v}${RI[k] || k}/day`)
      .join(" ")} · ${sk(n.skill).name} · trip ${D.map.gatherTripDays}d gathering · 🚶 ${trav}</div>${rareLine(n)}
  <div class="row"><span class="muted">${ok ? (busy && !on ? "🚶 busy" : "") : "🔒 age 10+ / region"}</span><button class="b ${on ? "sel" : ""}" data-a="gather" data-v="${id}" ${!ok || (busy && !on) ? "disabled" : ""}>${on ? "Gathering" : "Gather"}</button></div></div>`;
  }
  if (k === "a") {
    const a = E.areaDef(id),
      iss = E.exploreIssue(s, m, id),
      ex = E.explored(s, id),
      on = m.action && m.action.type === "explore" && m.action.target === id;
    h = `<div class="card"><b>${ex ? "🧭" : "🌫️"} ${a.name}</b> <span class="tb">${ex ? "Explored" : "Fogged"}</span><div class="muted">Explore ${a.days}d · 🚶 ${trav} · ${E.areaSecretsLeft(s, a)} secrets left (plus random encounters) · Tracking improves the odds</div>
  <div class="row"><span class="muted">${iss ? "🔒 " + iss : busy && !on ? "🚶 busy" : ""}</span><button class="b ${on ? "sel" : ""}" data-a="explore" data-v="${id}" ${iss || (busy && !on) ? "disabled" : ""}>${on ? "Exploring" : "Explore"}</button></div></div>`;
  }
  if (k === "d") {
    const d = E.dungeonDef(id),
      iss = E.dungeonIssue(s, m, d),
      on = m.action && m.action.type === "dungeon" && m.action.target === id,
      cl = (s.cleared || []).includes(id);
    h = `<div class="card"><b>${d.icon} ${d.name}</b> <span class="tb" style="border-color:#ff7a5c">Dungeon · ${d.floors.length} floors${cl ? " · cleared" : ""}</span><div class="muted">🚶 ${trav} · ${d.floors
      .map(
        (f, i) =>
          `${i + 1}. ${f.name} (CP ${f.cp}, ${f.days}d, ${Object.entries(f.reward)
            .map(([k, v]) => v + (RI[k] || k))
            .join(" ")})`,
      )
      .join(
        " → ",
      )}</div><div class="muted">Fail a floor and you retreat home injured. Final floor: treasure + rare roll.</div>${rareLine(d)}
  <div class="row"><span class="muted">${iss ? "🔒 " + iss : busy && !on ? "🚶 busy" : ""}</span><button class="b ${on ? "sel" : ""}" data-a="dungeon" data-v="${id}" ${iss || (busy && !on) ? "disabled" : ""}>${on ? "Delving" : "Delve"}</button></div></div>`;
  }
  if (k === "t") {
    const t = D.towns.find(x => x.id === id);
    const ev = E.eventsAtTown(s, t.id);
    h = `<div class="card"><b>${t.icon} ${t.name}</b><div class="muted">Town · trade, rumors, hiring and guilds below · 🚶 ${trav}</div>${ev.map(e => `<div>${E.eventType(e.type).icon} ${E.eventText(e)}${pbar(e.from != null ? (s.day - e.from) / Math.max(1, e.until - e.from) : 0.5, `${e.until - s.day}d left`, (e.until - s.day) * secPerDay())}</div>`).join("")}</div>`;
  }
  return h;
}

export function storyv(m) {
  const st = E.storyQuests(),
    n = E.storyProgress(s);
  return (
    `<h3>📖 Story: The Lost House <span class="muted">${n}/${st.length} chapters</span></h3><div class="bar"><i style="width:${(n / st.length) * 100}%"></i></div>` +
    st
      .map(q => {
        const done = s.doneQuests.includes(q.id),
          iss = done ? null : E.questIssue(s, m, q);
        const nxt = !done && !(iss || "").startsWith("finish");
        return `<div class="card row" style="padding:5px 8px;margin:3px 0;${done ? "opacity:.6" : ""}"><span>${done ? "✅" : nxt ? "📖" : "🔒"} Ch. ${q.story}: ${done || nxt ? q.name : "???"}<br><span class="muted">${done ? "complete" : iss ? "🔒 " + iss : "ready · " + D.regions.find(r => r.id === q.region).name}</span></span>${nxt && !iss ? `<button class="b" data-a="mapsel" data-v="q:${q.id}">Show</button>` : ""}</div>`;
      })
      .join("")
  );
}

export function standingv(m) {
  const st = m.standing;
  return `<div class="card"><b>🧭 Standing orders</b> <span class="muted">${st ? "· now: <b>" + (st === "explore" ? "Auto-Explore" : "Auto-Adventure") + "</b>" : "· none"}</span><div class="muted">Explore: travels to fogged areas and finds towns, secrets and dungeons. Adventure: runs known dungeons and safe quests. Both repeat until stopped. A change applies once the member is home.</div>
 <div class="row" style="gap:4px;justify-content:flex-start"><button class="b ${st === "explore" ? "sel" : ""}" data-a="auto" data-v="explore" ${E.isAdult(m) ? "" : "disabled"}>🧭 Explore</button><button class="b ${st === "adventure" ? "sel" : ""}" data-a="auto" data-v="adventure" ${E.isAdult(m) ? "" : "disabled"}>⚔️ Adventure</button><button class="b" data-a="stopauto" ${st ? "" : "disabled"}>⏹ Stop</button></div>
 <div class="muted" style="font-size:11px">🤝 Parties (family + minions adventuring together) unlock later – see the roadmap.</div></div>`;
}

export function mapv() {
  const m = E.active(s);
  let h = busyBanner(m) + mapSvg(m) + mapDetail(m) + worldEventsCard() + standingv(m) + storyv(m);
  h += E.isAdult(m) ? "" : `<div class="card muted">Children can gather but not quest or explore.</div>`;
  for (const rg of D.regions.filter(r => E.regionKnown(s, r.id))) {
    const open = E.regionOpen(s, rg.id);
    h += `<h3>${rg.icon} ${rg.name} ${open ? "" : `🔒 (needs CP ${rg.cp})`}</h3>`;
    if (!open) continue;
    const hidden = [...D.quests, ...D.nodes].filter(x => x.region === rg.id && !E.known(s, x)).length;
    for (const t of D.towns.filter(t => t.region === rg.id && E.townKnown(s, t)))
      h += `<div class="card"><b>${t.icon} ${t.name}</b> <span class="muted">· trade</span><div class="row" style="flex-wrap:wrap;margin-top:4px">${Object.entries(
        t.prices,
      )
        .map(
          ([k, p]) =>
            `<button class="b" data-a="sellres" data-v="${t.id}" data-w="${k}" ${s.res[k] >= 10 ? "" : "disabled"}>Sell 10${RI[k]} → ${p * 10}🪙</button>`,
        )
        .join("")}</div>${
        (t.market || []).length
          ? `<div class="row" style="flex-wrap:wrap;margin-top:4px"><span class="muted">Market:</span>${t.market
              .map(k => {
                const p = E.townBuyPrice(s, t.id, k);
                return `<button class="b" data-a="buyres" data-v="${t.id}" data-w="${k}" ${s.res.coin >= p * 10 ? "" : "disabled"}>Buy 10${RI[k] || k} ← ${fmt(p * 10)}🪙</button>`;
              })
              .join("")}</div>`
          : ""
      }
   ${landShop(t.id) ? '<div class="muted" style="margin-top:4px">📜 LAND FOR SALE</div>' + landShop(t.id) : ""}
   ${D.guilds.guilds
     .filter(g => g.town === t.id)
     .map(g => guildHall(m, g))
     .join("")}
   <div class="muted" style="margin-top:4px">⚔️ Adventurers' Guild branch here (see Guilds tab)</div>
   <div class="row" style="margin-top:6px"><span class="muted">🗣️ Tavern rumors (${hidden} secrets left)</span><button class="b" data-a="rumor" data-v="${rg.id}" ${s.res.coin >= D.tuning.rumorCost && hidden ? "" : "disabled"}>Listen ${D.tuning.rumorCost}🪙</button></div></div>`;
    h +=
      `<div class="muted">RESOURCE NODES</div>` +
      D.nodes
        .filter(n => n.region === rg.id && E.known(s, n))
        .map(n => {
          const on = m.action && m.action.type === "gather" && m.action.target === n.id;
          return `<div class="card row"><span>${n.icon} ${n.name}<br><span class="muted">${Object.entries(n.res)
            .map(([k, v]) => `+${v}${RI[k]}/day`)
            .join(
              " ",
            )} · ${sk(n.skill).name}</span></span><button class="b ${on ? "sel" : ""}" data-a="gather" data-v="${n.id}">Gather</button></div>`;
        })
        .join("");
    h += `<div class="muted">QUESTS</div>`;
    for (const q of D.quests.filter(x => x.region === rg.id && E.known(s, x) && !x.story)) {
      const on = m.action && m.action.type === "quest" && m.action.target === q.id;
      h += `<div class="card row"><span>${qKind(q)[0]} ${q.name} <span class="muted" style="font-size:11px">${qKind(q)[2]}</span> <span class="risk-${q.risk}">[${q.risk}]</span><br><span class="muted">CP ${q.cp} · ${q.days}d · ${Object.entries(
        q.reward,
      )
        .map(([k, v]) => v + RI[k])
        .join(
          " ",
        )} · ${Math.round(E.successChance(s, m, q) * 100)}%${q.risk === "deadly" ? " · ☠️ death risk" : ""}${q.unlocks ? ` · 🔓 ${s.unlocks.includes(q.unlocks) ? "unlocked" : "unlocks"} ${unlockName(q.unlocks)}` : ""}</span>${on ? `<div class="bar"><i style="width:${(m.action.progress / q.days) * 100}%"></i></div>` : ""}</span><button class="b ${on ? "sel" : ""}" data-a="quest" data-v="${q.id}" ${E.isAdult(m) ? "" : "disabled"}>Go</button></div>`;
    }
  }
  return h;
}

export function worldEventsCard() {
  const ev = E.activeEvents(s);
  const pol = D.encounters.policies;
  return `<div class="card"><b>🌍 World events</b>${ev.length ? ev.map(e => `<div>${E.eventType(e.type).icon} ${E.eventText(e)} <span class="muted">(${e.until - s.day}d left)</span></div>`).join("") : '<div class="muted">All quiet across the land.</div>'}
 <div class="row" style="justify-content:flex-start;gap:6px;margin-top:4px"><span class="muted">Road encounters on automated orders:</span><select data-a="encpolicy">${Object.entries(
   pol,
 )
   .map(([k, n]) => `<option value="${k}" ${s.encPolicy === k ? "selected" : ""}>${n}</option>`)
   .join("")}</select></div>${
   E.activeBuffs(s).length
     ? `<div class="muted">${E.activeBuffs(s)
         .map(b => `${b.curse ? "🪬" : "✨"} ${b.name} (${b.until - s.day}d)`)
         .join(" · ")}</div>`
     : ""
 }</div>`;
}
