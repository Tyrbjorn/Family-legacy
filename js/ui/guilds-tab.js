import * as E from "../engine.js";
import { cl, itemStatsHtml } from "./common.js";
import { D, s } from "../main.js";

export function guildHall(m, g) {
  const mg = E.memberGuild(m, g.id),
    mine = !!mg;
  const iss = E.joinIssues(s, m, g.id);
  let h = `<div class="card" style="margin:6px 0"><div class="row"><b>${g.icon} ${g.name}</b>${mine ? `<span>🎖️ ${E.rankName(mg.rank)}</span>` : `<button class="b" data-a="join" data-v="${g.id}" ${iss.length ? "disabled" : ""}>Join ${g.req.coin}🪙</button>`}</div><div class="muted">${g.desc} ${g.grantsClass ? `Joining grants: <b>${cl(g.grantsClass).icon} ${cl(g.grantsClass).name}</b>.` : g.pathRanks ? "Your rank follows your main craft path." : g.profession ? `Open to all. Grants the <b>${cl(g.profession).icon} ${cl(g.profession).name}</b> profession track.` : ""} Paths: ${g.path.join(", ")}.</div>`;
  if (!mine) h += `<div class="muted">${iss.length ? "Needs: " + iss.join(" · ") : "Requirements met."}</div>`;
  else {
    const n = E.nextRank(m, g.id);
    h += n
      ? `<div class="row"><span class="muted">${mg.rep >= n.rep ? "✓ Rep " + n.rep + " reached" : "Rep " + mg.rep + "/" + n.rep} → ${n.name} (${n.cost}🪙)</span><button class="b" data-a="rankup" data-v="${g.id}" ${E.canRankUp(s, m, g.id) ? "" : "disabled"}>Rank up</button></div>`
      : "";
  }
  if (mine)
    h += E.guildShop(g.id)
      .map(
        x =>
          `<div class="row" style="margin-top:4px"><span>${x.name} <span class="muted">${x.rarity} · ${E.rankName(x.rank)}</span>${itemStatsHtml(x, m && m.equip)}</span><button class="b" data-a="gbuy" data-v="${x.id}" ${mg.rank >= x.rank && s.res.coin >= E.buyPrice(x) ? "" : "disabled"}>${E.buyPrice(x)}🪙</button></div>`,
      )
      .join("");
  return h + `</div>`;
}

export function guildsv() {
  const m = E.active(s),
    A = D.guilds.adventurers;
  let h = `<div class="muted">Showing guild standing for <b>${m.name}</b> (switch members on Main).</div>`;
  h += `<h3>${A.icon} ${A.name}</h3><div class="card"><div class="muted">${A.desc} Branches: ${A.towns.map(t => D.towns.find(x => x.id === t).name).join(", ")}.</div>`;
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
          `<div>${E.questOk(m, q) ? "📌" : "🔒"} ${q.name} <span class="muted">Rank ${E.advRankName(q.adv)} · CP ${q.cp} · on Map: ${D.regions.find(r => r.id === q.region).name}</span></div>`,
      )
      .join("");
  h +=
    `<div class="muted" style="margin-top:6px">GUILD STORE</div>` +
    E.advShop()
      .map(
        x =>
          `<div class="row" style="margin-top:4px"><span>${x.name} <span class="muted">${x.rarity} · Rank ${E.advRankName(x.adv)}</span>${itemStatsHtml(x, m && m.equip)}</span><button class="b" data-a="advbuy" data-v="${x.id}" ${m.adv && m.adv.rank >= x.adv && s.res.coin >= E.buyPrice(x) ? "" : "disabled"}>${E.buyPrice(x)}🪙</button></div>`,
      )
      .join("") +
    `</div>`;
  h +=
    `<h3>🏛️ Class & Craft Guilds <span class="muted">(Warriors/Rangers/Magic/Healers/Rogues: one per member for life · Crafters: open to all)</span></h3>` +
    D.guilds.guilds
      .map(
        g =>
          `<div class="muted">📍 ${D.towns.find(t => t.id === g.town).name}${E.regionOpen(s, D.towns.find(t => t.id === g.town).region) ? "" : " 🔒 region locked"}</div>` +
          guildHall(m, g),
      )
      .join("");
  const ranksTxt = D.guilds.ranks.map(r => r.name).join(" → ");
  h += `<div class="muted">Ranks: ${ranksTxt}. Rep from guild quests and quests using guild skills. Adept unlocks Tier 2 classes (Warriors: Blademaster/Warlord · Rangers: Beastmaster/Warden · Magic: Pyromancer/Archmage · Healers: Paladin/Priest · Rogues: Assassin/Master Thief).</div>`;
  return h;
}
