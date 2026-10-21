import { boardCard, linesCard } from "./boards-ui.js";
import { pbar, secPerDay } from "./progress.js";
import * as E from "../engine.js";
import { U } from "./state.js";
import { RI, dur, fmt, sk, unlockName } from "./common.js";
import { landShop } from "./estate-tab.js";
import { guildHall } from "./guilds-tab.js";
import { D, s } from "../main.js";
import { busyBanner } from "./main-tab.js";
import { tradeCard } from "./trade-ui.js";
import { marketBoardCard, priceTagHtml, priceTipOf, townTagsHtml } from "./market-ui.js";
import { hintSpots, mapSvg } from "./map-draw.js";
export { mapSvg };

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
  // R31.3: themed vehicle drops (rare entries marked shown) and first-clear rewards are always listed by name
  const veh = (src.rare || []).filter(d => d.shown).map(d => `<b>${E.dropName(d.id)}</b> (${Math.round(d.chance * 100)}%)`);
  const gu = src.grants && src.grants.item ? `<b>${E.dropName(src.grants.item)}</b> (guaranteed)` : "";
  const fg = src.firstGrants && src.firstGrants.item ? `<b>${E.dropName(src.firstGrants.item)}</b> (first clear${(s.doneQuests || []).includes(src.id) ? ", claimed" : ""})` : "";
  const extra = [...veh, gu, fg].filter(Boolean).length ? `<div class="muted">🎁 Loot: ${[...veh, gu, fg].filter(Boolean).join(", ")}</div>` : "";
  const rs = (src.rare || []).filter(d => !d.shown);
  if (!rs.length) return extra;
  return extra + `<div class="muted">🌟 Rare drops: ${rs.map(d => (E.dropFound(s, d.id) ? `<b>${E.dropName(d.id)}</b> (${d.chance * 100}%)` : "???")).join(", ")}</div>`;
}

export function routeLine(id, pt) {
  const r = pt ? E.routeTo(pt) : E.routeOf(id, E.ptOf),
    te = D.world.terrain[r.terrain];
  const via = r.detours ? ` · ↪️ around ${r.detours === 1 ? "a mountain or lake" : r.detours + " mountains/lakes"}` : "";
  return `${te.icon} ${te.name}${via}${r.boat ? " · 🛶 crosses a lake by boat" : ""} · ${r.road ? `${Math.round(r.roadFrac * 100)}% on ${r.road.name}` : "off-road"} · risk ×${r.risk.toFixed(2)} · finds ×${r.discover.toFixed(2)}`;
}

// a spot whose bonus terrain can't be walked on sits at its edge (e.g. "at the mountain's edge")
function edgeNote(n) {
  const te = n.terrain && D.world.terrain[n.terrain],
    p = D.map.points[n.id];
  return te && te.impassable && p && E.terrainAt(p.x, p.y) !== n.terrain ? ` <span class="muted">${te.icon} ${te.edge} (${te.name.toLowerCase()} bonus)</span>` : "";
}

function feedLine() {
  const F = D.world.feed,
    gs = E.feedGroups(s);
  if (!F || !gs.length) return "";
  return `<div class="muted">🌾 Feed/day: ${gs
    .map(g => {
      const k = F.kinds[g.kind],
        nm = g.herd ? `${k.icon} ${k.name}` : `${D.world.haul.animals[g.key].icon} ${D.world.haul.animals[g.key].name}`,
        un = (s.unfed || {})[g.key];
      return `${nm} ×${g.n} ${+E.feedNeed(s, g).toFixed(1)} (${F.diets[k.diet].join("→")})${un ? ` ⚠️ unfed ${un}d` : ""}`;
    })
    .join(" · ")} · stores: ${["hay", "wheat", "vegetables"].map(r => `${RI[r] || r + " "}${fmt(s.res[r] || 0)}`).join(" ")}. Unfed animals stop working; after ${F.runOffDays} days one runs off.</div>`;
}

// R48 the coast: Sea Boat (Dock → Slipway, plans from Gull's Landing) and the harbour ferry (Act 1 beat)
export function seaCard() {
  const SEA = E.SEA();
  if (!SEA) return "";
  const port = E.portTown(), known = E.townKnownId(s, SEA.port), F = SEA.ferry || {};
  const boat = E.hasSeaBoat(s), fo = E.ferryOpen(s), slip = E.hasStructType(s, "slipway"), plans = (s.unlocks || []).includes("recipe:r_seaboat");
  const tier = (D.world.haul.tiers || []).find(x => x.coast) || {};
  const ex = D.quests.find(q => q.coastal && q.id !== SEA.port && E.questVisible(s, q) && E.seaOption(s, q.id));
  const eo = ex && E.seaOption(s, ex.id);
  const routes = E.ferryRoutes(s).map(r => `${r.name}${r.open ? "" : ` 🔒 <span class="muted">(${r.opens || "later"})</span>`}`).join(" · ");
  return `<div class="card" id="seacard"><b>⛵ The coast</b> <span class="muted">· ${port ? port.icon + " " + port.name : ""}${known ? "" : " (not found yet: follow the Salt Track west)"}</span>
 <div class="muted">${tier.icon || "⛵"} Sea Boat: ${boat ? `yours. Sails coast routes (×${SEA.speed} vs walking the shore), fishes the deep sea, and hauls ${tier.carry}${E.perkCargo(s, tier.id) ? "+" + tier.cargoTier * E.perkCargo(s, tier.id) : ""} on coast hauls.` : `${plans ? "✅ plans learned" : "📜 buy the Sea Boat Plans at Gull's Landing"} · ${slip ? "✅ Slipway built" : "🏗️ upgrade a Dock to a Slipway"} · then a Carpenter builds it (planks, rope, cloth).`}</div>
 <div class="muted">${F.icon || "⛴️"} ${F.name || "Ferry"}: ${fo ? `open · fare ${E.ferryFare(s, 1)}🪙 a short hop (+${Math.round(F.farePerDay * (1 - E.ferryDisc(s)))}🪙 per sea day)${E.ferryDisc(s) ? ` · −${Math.round(E.ferryDisc(s) * 100)}% (harbour pass / House Corwen)` : ""}` : "closed: the harbour needs the wreckers stopped (Act 1 beat “Lights on the Rocks”, after chapter 2)"} · routes: ${routes}</div>
 ${eo ? `<div class="muted">e.g. ${ex.name}: ${eo.mode === "boat" ? "⛵ by boat" : `⛴️ by ferry (${eo.fare}🪙 each way)`} ${eo.days}d instead of ${E.travelDays(ex.id)}d walking</div>` : ""}
 ${fo && !boat ? `<div class="row" style="justify-content:flex-start;gap:6px"><span class="muted">Use the ferry automatically for coast trips:</span><button class="b ${s.ferryAuto === false ? "" : "sel"}" data-a="ferryauto">${s.ferryAuto === false ? "Off" : "On"}</button></div>` : ""}</div>`;
}

export function haulCard() {
  const H = D.world.haul,
    t = E.haulTier(s),
    st = E.stalls(s),
    an = E.animalCount(s);
  const towns = D.towns.filter(x => E.townKnown(s, x)).map(x => x.id);
  return `<div class="card"><b>${t.icon || "🎒"} Hauling</b> <span class="muted">· ${t.name} · carry ${t.carry}/trip · haul speed ×${t.haulSpeed}</span>
 <div class="muted">Tiers: ${[H.base, ...H.tiers].map(x => `${x.icon || "🎒"} ${x.name} ${x.carry}`).join(" → ")}. Carts and wagons are made by a Cooper &amp; Wainwright (Carpenter); animals need feed and a stable stall. A wagon with no animal is pulled by hand (half cargo, ×${D.world.haul.wagonNoAnimal.haulSpeed} speed).</div>
 <div class="muted">🛶 Boats: ${E.hasBoat(s) ? "you have a Small Boat: routes cross lakes and Fish can work deep water" : "a Small Boat (River quest, or a Carpenter with a Dock) lets routes cross lakes instead of going around. Mountains always need a detour."}</div>
 <div class="muted">🐴 Animals ${an}/${st} stalls${an ? (s.animalsFed === false ? " · ⚠️ unfed" : " · fed") : ""}</div>${feedLine()}
 <div class="row" style="flex-wrap:wrap;gap:4px;justify-content:flex-start">${Object.entries(H.animals)
   .map(([id, a]) => {
     const town = a.towns.find(x => towns.includes(x)),
       iss = town ? E.buyAnimalIssue(s, id, town) : "no known market";
     return `<button class="b" data-a="buyanimal" data-v="${id}" data-w="${town || ""}" ${iss ? "disabled" : ""} title="${iss || ""}">${a.icon} ${a.name} ${a.cost.coin}🪙 (${(s.animals || {})[id] || 0})${iss ? " · " + iss : ""}</button>`;
   })
   .join("")}</div></div>`;
}

export function parcelCard(m) {
  const fs = E.ownedFeatures(s);
  if (!fs.length) return `<div class="card muted">🏞️ Own land to work its features here with no travel (+${D.world.parcelBonus * 100}%). Land is sold in towns.</div>`;
  const busy = E.isBusy(m);
  return `<div class="card"><b>🏞️ Your land</b> <span class="muted">· work features with no travel (+${D.world.parcelBonus * 100}%)</span>${(s.land || [])
    .map(id => `<div class="muted">${(E.findId(D.estate.lands, id) || { name: id }).name}: ${(D.world.landFeatures[id] || []).map(f => E.featureDef(f).icon + " " + E.featureDef(f).name).join(", ") || "no features"}</div>`)
    .join("")}
 ${fs
   .map(f => {
     const fd = E.featureDef(f),
       on = m.action && m.action.type === "parcel" && m.action.target === f;
     return `<div class="row"><span>${fd.icon} ${fd.name} <span class="muted">${Object.entries(fd.res).map(([k, v]) => `+${v}${RI[k] || k}/day`).join(" ")} · ${sk(fd.skill).name}</span></span><button class="b ${on ? "sel" : ""}" data-a="parcel" data-v="${f}" ${busy && !on ? "disabled" : ""}>${on ? "Working" : "Work"}</button></div>`;
   })
   .join("")}</div>`;
}

// R30: each town sells the map of its quarter of the world
function quadBtn(tid) {
  const q = E.townQuad(tid);
  if (!q || !D.map.quadrantMaps) return "";
  const nm = D.map.quadrantMaps.quads[q].name;
  if (E.quadOwned(s, q)) return `<div class="muted">🗺️ ${nm} map owned</div>`;
  const iss = E.quadMapIssue(s, tid);
  return `<div class="row" style="justify-content:flex-start;gap:6px;margin:4px 0"><button class="b" data-a="buyquad" data-v="${tid}" ${iss ? "disabled" : ""}>🗺️ Buy ${nm} map · ${E.quadPrice(q)}🪙</button><span class="muted">charts terrain, towns, dungeons and landmarks; quests and resources still need exploring</span></div>`;
}
export function mapDetail(m) {
  if (!U.mapSel) return '<div class="muted">Tap a marker on the map for details.</div>';
  const [k, ...idp] = U.mapSel.split(":"), id = idp.join(":");
  const busy = E.isBusy(m);
  let h = "";
  const trav = `${E.travelDays(id)} days each way (~${dur(E.travelDays(id))})`;
  if (k === "g") {
    // R31.2: grouped quest badge → small list with Go buttons
    const qs = id.split(",").map(x => E.findId(D.quests, x)).filter(Boolean);
    return `<div class="card"><b>📜 ${qs.length} quests here</b>${qs
      .map(q => {
        const kd = qKind(q), iss = E.questIssue(s, m, q) || E.questAgeIssue(m, q, s), on = m.action && m.action.type === "quest" && m.action.target === q.id;
        return `<div class="row" style="margin:4px 0"><span style="flex:1">${kd[0]} <b>${q.name}</b><br><span class="muted">CP ${q.cp} · ${q.days}d · ${Object.entries(q.reward).map(([a, v]) => v + " " + a).join(", ")}${iss ? " · 🔒 " + iss : ""}</span></span><button class="b" data-a="mapsel" data-v="q:${q.id}">ℹ️</button><button class="b ${on ? "sel" : ""}" data-a="quest" data-v="${q.id}" ${iss || on || busy ? "disabled" : ""}>${on ? "On it" : "Go"}</button></div>`;
      })
      .join("")}</div>`;
  }
  if (k === "q") {
    const q = E.findId(D.quests, id),
      kd = qKind(q),
      iss = E.questIssue(s, m, q) || E.questAgeIssue(m, q, s),
      on = m.action && m.action.type === "quest" && m.action.target === id;
    h = `<div class="card"><b>${kd[0]} ${q.name}</b> <span class="tb" style="border-color:${kd[1]}">${kd[2]}${q.story ? " · ch. " + q.story : ""}</span> <span class="risk-${q.risk}">[${q.risk}]</span>${q.desc ? `<div class="muted">${q.desc}</div>` : ""}
  <div class="muted">CP ${q.cp} · task ${q.days}d · 🚶 ${trav} · reward ${Object.entries(q.reward)
    .map(([k, v]) => v + (RI[k] || k))
    .join(" ")}${
    q.grants && Object.keys(q.grants).some(k => k !== "item")
      ? " · 🎁 " +
        Object.entries(q.grants).filter(([k]) => k !== "item") // items show as "(guaranteed)" on the Loot line
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
    const n = E.findId(D.nodes, id),
      on = m.action && m.action.type === "gather" && m.action.target === id,
      ok = E.actionAllowed(s, m, { type: "gather", target: id });
    h = `<div class="card"><b>${n.icon} ${n.name}</b> <span class="tb">🔁 Resource node</span>${edgeNote(n)}<div class="muted">${Object.entries(
      n.res,
    )
      .map(([k, v]) => `+${v}${RI[k] || k}/day`)
      .join(" ")} · ${sk(n.skill).name} · trip ${D.map.gatherTripDays}d gathering · 🚶 ${trav}</div>
  <div class="muted">${routeLine(id)} · stock ${Math.round(E.nodeStock(s, n))}/${E.nodeMax(n)}${E.nodeStock(s, n) > 0 ? "" : " 🪫 worked out (regrows day by day)"} · haul ${E.haulTier(s).carry}/trip</div>
  <div class="bar"><i style="width:${(E.nodeStock(s, n) / E.nodeMax(n)) * 100}%"></i></div>
  ${on && m.action.trip ? `<div class="muted">🎒 Load ${Math.round(Object.values(m.action.load || {}).reduce((a, b) => a + b, 0))}/${E.haulTier(s).carry}</div>${pbar(m.action.progress || 0, m.action.days || 1)}` : ""}${rareLine(n)}
  <div class="row"><span class="muted">${ok ? (busy && !on ? "🚶 busy" : "") : "🔒 age 10+ / region"}</span><button class="b ${on ? "sel" : ""}" data-a="gather" data-v="${id}" ${!ok || (busy && !on) ? "disabled" : ""}>${on ? "Gathering" : "Gather"}</button></div></div>`;
  }
  if (k === "l") {
    const l = E.locDef(id),
      ty = D.world.locTypes[l.type];
    h = `<div class="card"><b>${ty.icon} ${E.locName(s, l)}</b> <span class="tb">${ty.name}${E.locLocked(s, l) ? " · 🔒 sealed" : ""}</span>${E.locDesc(s, l) ? `<div class="muted">${E.locDesc(s, l)}</div>` : ""}<div class="muted">${routeLine(null, l)}</div>${E.locLocked(s, l) ? '<div class="muted">The gates stay shut. Perhaps one day…</div>' : ""}${l.sea ? '<div class="muted">⚓ Ships and sea trade are not open yet.</div>' : ""}</div>`;
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
          `${i + 1}. ${f.boat ? "⛵ " : ""}${f.name} (CP ${f.cp}, ${f.days}d, ${Object.entries(f.reward)
            .map(([k, v]) => v + (RI[k] || k))
            .join(" ")})${f.boat ? (E.hasSeaBoat(s) ? " · your Sea Boat gets through" : " · 🔒 needs your own Sea Boat (skipped until then)") : ""}`,
      )
      .join(
        " → ",
      )}</div><div class="muted">Fail a floor and you retreat home injured. Final floor: treasure + rare roll.</div>${rareLine(d)}
  <div class="row"><span class="muted">${iss ? "🔒 " + iss : busy && !on ? "🚶 busy" : ""}</span><button class="b ${on ? "sel" : ""}" data-a="dungeon" data-v="${id}" ${iss || (busy && !on) ? "disabled" : ""}>${on ? "Delving" : "Delve"}</button></div></div>`;
  }
  if (k === "h") {
    const hs = hintSpots().find(x => x.id === U.mapSel.slice(2));
    const te = hs && D.world.terrain[hs.terrain];
    h = `<div class="card"><b>❔ Rumored place</b><div class="muted">${te ? `Something ${te.edge ? te.edge.replace(/^at the |^on the /, "near the ") : "in the " + te.name.toLowerCase()}, somewhere about here.` : "Something lies about here."} Explore nearby or pay for tavern rumors to find it.</div></div>`;
    return h;
  }
  if (k === "u") {
    // undiscovered major place (greyed pin): no details, just how to find it
    const [kk, uid] = [id.split(":")[0], id.split(":").slice(1).join(":")];
    const nm = kk === "t" ? "a town" : kk === "d" ? "a dungeon" : "a landmark";
    return `<div class="card"><b>❔ Undiscovered</b><div class="muted">There is ${nm} here. Travel or explore nearby to find it, or buy this quarter's map in a town.</div></div>`;
  }
  if (k === "t") {
    const t = E.findId(D.towns, id);
    const ev = E.eventsAtTown(s, t.id);
    h = `<div class="card"><b>${t.icon} ${t.name}</b><div class="muted">Town · trade, rumors, hiring and guilds below · 🚶 ${trav}</div>${townTagsHtml(t.id)}${quadBtn(t.id)}${ev.map(e => `<div>${E.eventType(e.type).icon} ${E.eventText(e)}${pbar(e.from != null ? (s.day - e.from) / Math.max(1, e.until - e.from) : 0.5, `${e.until - s.day}d left`, (e.until - s.day) * secPerDay())}</div>`).join("")}</div>`;
    h += boardCard(t.id, m); // R45
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
        return `<div class="card row" style="padding:5px 8px;margin:3px 0;${done ? "opacity:.6" : ""}"><span>${done ? "✅" : nxt ? "📖" : "🔒"} Ch. ${q.story}: ${done || nxt ? q.name : "???"}<br><span class="muted">${done ? "complete" : iss ? "🔒 " + iss : "ready · " + E.findId(D.regions, q.region).name}</span></span>${nxt && !iss ? `<button class="b" data-a="mapsel" data-v="q:${q.id}">Show</button>` : ""}</div>`;
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
  let h = busyBanner(m) + marketBoardCard() + mapSvg(m) + `<div id="mapdetail">` + mapDetail(m) + `</div>` + parcelCard(m) + haulCard() + seaCard() + tradeCard() + worldEventsCard() + standingv(m) + linesCard(m); // R30: story quests moved to the Quests tab
  h += E.isAdult(m) ? "" : (E.isTeen(m) ? `<div class="card muted">Teens can run safe errands, hunt, and take low-risk fights. Exploring waits for adulthood.</div>` : `<div class="card muted">Children can gather but not quest or explore.</div>`);
  for (const rg of D.regions.filter(r => E.regionKnown(s, r.id))) {
    const open = E.regionOpen(s, rg.id);
    h += `<h3>${rg.icon} ${rg.name} ${open ? "" : `🔒 (needs CP ${rg.cp})`}</h3>`;
    if (!open) continue;
    const hidden = [...D.quests, ...D.nodes].filter(x => x.region === rg.id && !E.known(s, x)).length;
    for (const t of D.towns.filter(t => t.region === rg.id && E.townKnown(s, t)))
      h += `<div class="card"><b>${t.icon} ${t.name}</b> <span class="muted">· trade</span>${townTagsHtml(t.id)}<div class="row" style="flex-wrap:wrap;margin-top:4px">${Object.entries(
        t.prices,
      )
        .map(
          ([k, p]) =>
            `<button class="b" data-a="sellres" data-v="${t.id}" data-w="${k}" ${s.res[k] >= 10 ? "" : "disabled"} title="${priceTipOf(t.id, k)}">Sell 10${RI[k] || " " + k} → ${fmt(E.townSellPrice(s, t.id, k) * 10)}🪙${priceTagHtml(t.id, k)}</button>`,
        )
        .join("")}</div>${
        E.marketOf(t.id, s).length
          ? `<div class="muted" style="margin-top:4px">Makes: ${(t.produces || []).map(k => (RI[k] || "") + k).join(", ") || "—"} · Wants: ${(t.wants || []).map(k => (RI[k] || "") + k).join(", ") || "—"}</div><div class="row" style="flex-wrap:wrap;margin-top:4px"><span class="muted">Market:</span>${E.marketOf(t.id, s)
              .map(k => {
                const p = E.townBuyPrice(s, t.id, k);
                return `<button class="b" data-a="buyres" data-v="${t.id}" data-w="${k}" ${s.res.coin >= p * 10 ? "" : "disabled"} title="${priceTipOf(t.id, k, "buy")}">Buy 10${RI[k] || k} ← ${fmt(p * 10)}🪙${priceTagHtml(t.id, k, "buy")}</button>`;
              })
              .join("")}</div>`
          : ""
      }
   ${E.breweryOf(t.id) ? `<div id="brewery-${t.id}" style="margin-top:4px"><span class="muted">🍺 ${E.breweryOf(t.id).name || "Brewery"} · a few casks a month (your own Brewery is cheaper):</span>${E.brewRefused(s, t.id) ? `<div class="muted">🐟 ${E.brewRefused(s, t.id)}</div>` : ""}<div class="row" style="flex-wrap:wrap">${Object.keys(E.brewsOf(t.id)).map(k => { const left = E.brewLeft(s, t.id, k), p = E.brewPrice(s, t.id, k), n = Math.min(4, left); return `<button class="b" data-a="buybrew" data-v="${t.id}" data-w="${k}" ${n > 0 && s.res.coin >= p * n && !E.brewRefused(s, t.id) ? "" : "disabled"} title="${left} left this month">Buy ${n || 4}${RI[k] || " " + k} ← ${fmt(p * (n || 4))}🪙 · ${left} left</button>`; }).join("")}</div></div>` : ""}
   ${landShop(t.id) ? '<div class="muted" style="margin-top:4px">📜 LAND FOR SALE</div>' + landShop(t.id) : ""}
   ${D.guilds.guilds
     .filter(g => g.town === t.id)
     .map(g => guildHall(m, g))
     .join("")}
   ${boardCard(t.id, m)}
   <div class="muted" style="margin-top:4px">⚔️ Adventurers' Guild branch here (see Guilds tab)</div>
   <div class="row" style="margin-top:6px"><span class="muted">🗣️ Tavern rumors (${hidden} secrets left)</span><button class="b" data-a="rumor" data-v="${rg.id}" ${s.res.coin >= D.tuning.rumorCost && hidden ? "" : "disabled"}>Listen ${D.tuning.rumorCost}🪙</button></div></div>`;
    h +=
      `<div class="muted">RESOURCE NODES</div>` +
      D.nodes
        .filter(n => n.region === rg.id && E.known(s, n))
        .map(n => {
          const on = m.action && m.action.type === "gather" && m.action.target === n.id;
          return `<div class="card row"><span>${n.icon} ${n.name}<br><span class="muted">${Object.entries(n.res)
            .map(([k, v]) => `+${v}${RI[k] || " " + k}/day`)
            .join(
              " ",
            )} · ${sk(n.skill).name}</span><div class="bar" style="width:120px"><i style="width:${(E.nodeStock(s, n) / E.nodeMax(n)) * 100}%"></i></div></span><button class="b ${on ? "sel" : ""}" data-a="gather" data-v="${n.id}">Gather</button></div>`;
        })
        .join("");
    h += `<div class="muted">QUESTS</div>`;
    for (const q of D.quests.filter(x => x.region === rg.id && E.known(s, x) && !x.story)) {
      const on = m.action && m.action.type === "quest" && m.action.target === q.id;
      h += `<div class="card row"><span>${qKind(q)[0]} ${q.name} <span class="muted" style="font-size:11px">${qKind(q)[2]}</span> <span class="risk-${q.risk}">[${q.risk}]</span><br><span class="muted">CP ${q.cp} · ${q.days}d · ${Object.entries(
        q.reward,
      )
        .map(([k, v]) => v + (RI[k] || " " + k))
        .join(
          " ",
        )} · ${Math.round(E.successChance(s, m, q) * 100)}%${q.risk === "deadly" ? " · ☠️ death risk" : ""}${q.unlocks ? ` · 🔓 ${s.unlocks.includes(q.unlocks) ? "unlocked" : "unlocks"} ${unlockName(q.unlocks)}` : ""}</span>${on ? `<div class="bar"><i style="width:${(m.action.progress / q.days) * 100}%"></i></div>` : ""}</span><button class="b ${on ? "sel" : ""}" data-a="quest" data-v="${q.id}" ${E.canQuest(m, q, s) ? "" : "disabled"}>Go</button></div>`;
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

