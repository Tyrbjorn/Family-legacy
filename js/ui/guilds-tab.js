import * as E from "../engine.js";
import { cl, itemStatsHtml } from "./common.js";
import { D, s } from "../main.js";

export function guildHall(m, g) {
  const mg = E.memberGuild(m, g.id),
    mine = !!mg;
  const iss = E.joinIssues(s, m, g.id);
  const two = mine && m.guild2 === mg, can2 = !mine && !g.open && m.guild && E.secondVia(m) && !m.guild2, iss2 = can2 ? E.join2Issues(s, m, g.id) : [];
  let h = `<div class="card" style="margin:6px 0" data-guild="${g.id}"><div class="row"><b>${g.icon} ${g.name}</b>${mine ? `<span>🎖️ ${E.rankName(mg.rank)}</span>` : can2 ? `<button class="b" data-a="join2" data-v="${g.id}" ${iss2.length ? "disabled" : ""}>Join as second guild ${E.join2Fee(s, m, g.id)}🪙</button>` : `<button class="b" data-a="join" data-v="${g.id}" ${iss.length ? "disabled" : ""}>Join ${g.req.coin}🪙</button>`}</div>${two ? `<div class="muted">Second guild · capped at tier 2 · Journeyman needs half the rep</div>` : ""}<div class="muted">${g.desc} ${g.grantsClass ? `Joining grants: <b>${cl(g.grantsClass).icon} ${cl(g.grantsClass).name}</b>.` : g.pathRanks ? "Your rank follows your main craft path." : g.profession ? `Open to all. Grants the <b>${cl(g.profession).icon} ${cl(g.profession).name}</b> profession track.` : ""} Paths: ${g.path.map(id => (E.findId(D.classes, id) || E.pathDef(id) || { name: id }).name).join(", ")}.</div>`;
  if (can2) h += `<div class="muted">${iss2.length ? "Needs: " + iss2.join(" · ") : "Requirements met (second guild)."}${E.bloodline(s, m, g.id) ? " · 🩸 bloodline: no fee" : ""} <button class="b" data-a="pref2" data-v="${g.id}">${m.pref2 === g.id ? "📌 Auto's pick" : "Prefer for Auto"}</button></div>`;
  else if (!mine) h += `<div class="muted">${iss.length ? "Needs: " + iss.join(" · ") : "Requirements met."}</div>`;
  else {
    const n = E.nextRank(m, g.id), need = n && (two ? E.rep2Need(n) : n.rep);
    h += two && n && mg.rank + 1 > E.capRank()
      ? `<div class="muted">Second guild capped at tier 2 (${E.rankName(mg.rank)}).</div>`
      : n
      ? `<div class="row"><span class="muted">${mg.rep >= need ? "✓ Rep " + need + " reached" : "Rep " + mg.rep + "/" + need} → ${n.name} (${n.cost}🪙)</span><button class="b" data-a="rankup" data-v="${g.id}" ${E.canRankUp(s, m, g.id) ? "" : "disabled"}>Rank up</button></div>`
      : "";
  }
  if (mine)
    h += E.guildShop(g.id)
      .map(
        x =>
          `<div class="row" style="margin-top:4px"><span>${x.name} <span class="muted">${x.rarity} · ${E.rankName(x.rank)}</span>${itemStatsHtml(x, m)}</span><button class="b" data-a="gbuy" data-v="${x.id}" ${mg.rank >= x.rank && s.res.coin >= E.buyPrice(x) ? "" : "disabled"}>${E.buyPrice(x)}🪙</button></div>`,
      )
      .join("");
  return h + `</div>`;
}

export function guildsv() {
  const m = E.active(s),
    A = D.guilds.adventurers;
  let h = `<div class="muted">Showing guild standing for <b>${m.name}</b> (switch members on Main).</div>`;
  // R86 (Jeremy: "joined the adventurers guild and now can only join the rangers guild"): the rules were only implied by greyed buttons
  h += `<div class="card muted" id="guild-rules">📜 <b>How guilds work:</b> the Adventurers' Guild is open to everyone and never blocks another guild. Each person can swear to <b>one</b> of the other guilds (the Crafters' Guild can be joined alongside it). Each guild's Join button stays grey until its listed stats and skills are met, so early on usually only the guild matching your master's trade and traits is open. Train stats and skills to open the others. A second guild opens later (tier 3, or Master in a trade).${m.guild ? ` <b>${m.name}</b> is sworn to the ${E.guildDef(m.guild.id).name}.` : ""}</div>`;
  h += `<h3>${A.icon} ${A.name}</h3><div class="card"><div class="muted">${A.desc} Branches: ${A.towns.map(t => E.findId(D.towns, t).name).join(", ")}.</div>`;
  if (!m.adv)
    h += `<div class="row" style="margin-top:6px"><span class="muted">Not registered</span><button class="b" data-a="advjoin" ${E.isAdult(m) && s.res.coin >= A.joinCost ? "" : "disabled"}>Register ${A.joinCost}🪙</button></div>`;
  else {
    const n = E.advNext(m);
    h +=
      `<div class="row" style="margin-top:6px"><b>Rank ${E.advRankName(m.adv.rank)}</b><span class="muted">${A.ranks.map((r, i) => (i <= m.adv.rank ? `<b>${r.name}</b>` : r.name)).join(" ")}</span></div>` +
      (n
        ? `<div class="bar"><i style="width:${Math.min(100, (m.adv.rep / n.rep) * 100)}%;background:#d9b44a"></i></div><div class="row"><span class="muted">${m.adv.rep >= n.rep ? "✓ Rep " + n.rep + " reached" : "Rep " + m.adv.rep + "/" + n.rep} → ${n.name} (${n.cost}🪙)${n.unlocks ? " · unlocks " + n.unlocks : ""}</span><button class="b" data-a="advrank" ${E.canAdvRankUp(s, m) ? "" : "disabled"}>Rank up</button></div>`
        : '<div class="muted">S-Rank legend.</div>') +
      `<div class="muted">Every completed quest earns guild rep.</div>`;
  }
  h +=
    `<div class="muted" style="margin-top:6px">SERVICES (family-wide, unlocked by any member's rank)</div>` +
    Object.entries(A.services)
      .map(([k, d]) => {
        const r = A.ranks.find(x => x.unlocks === k);
        return `<div>${E.hasService(s, k) ? "✅" : "🔒"} <b>${k}</b> <span class="muted">(Rank ${r.name}) ${d}</span></div>`;
      })
      .join("");
  h +=
    `<div class="muted" style="margin-top:6px">BOUNTIES</div>` +
    D.quests
      .filter(q => q.adv)
      .map(
        q =>
          `<div>${E.questOk(m, q) ? "📌" : "🔒"} ${q.name} <span class="muted">Rank ${E.advRankName(q.adv)} · CP ${q.cp} · on Map: ${E.findId(D.regions, q.region).name}</span></div>`,
      )
      .join("");
  h +=
    `<div class="muted" style="margin-top:6px">GUILD STORE</div>` +
    E.advShop()
      .map(
        x =>
          `<div class="row" style="margin-top:4px"><span>${x.name} <span class="muted">${x.rarity} · Rank ${E.advRankName(x.adv)}</span>${itemStatsHtml(x, m)}</span><button class="b" data-a="advbuy" data-v="${x.id}" ${m.adv && m.adv.rank >= x.adv && s.res.coin >= E.buyPrice(x) ? "" : "disabled"}>${E.buyPrice(x)}🪙</button></div>`,
      )
      .join("") +
    `</div>`;
  h +=
    `<h3>🏛️ Class & Craft Guilds <span class="muted">(Warriors/Rangers/Magic/Healers/Rogues/Architects: one per member for life, plus one second guild after tier 3 or Master in a trade · Crafters: open to all)</span></h3>` +
    D.guilds.guilds
      .map(
        g =>
          `<div class="muted">📍 ${E.findId(D.towns, g.town).name}${E.regionOpen(s, E.findId(D.towns, g.town).region) ? "" : " 🔒 region locked"}</div>` +
          guildHall(m, g),
      )
      .join("");
  const ranksTxt = D.guilds.ranks.map(r => r.name).join(" → ");
  h += `<div class="muted">Ranks: ${ranksTxt}. Rep from guild quests and quests using guild skills. Adept unlocks Tier 2 classes (Warriors: Blademaster/Warlord · Rangers: Beastmaster/Warden · Magic: Pyromancer/Archmage · Healers: Paladin/Priest · Rogues: Assassin/Master Thief).</div>`;
  return h;
}
