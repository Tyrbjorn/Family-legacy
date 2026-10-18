// R37 Legacy panel: every renown upgrade in one place (opened from the 🏛️ button in the top bar), grouped by data legacy.groups.
// Automation upgrades show what's free now and what each tier adds.
import * as E from "../engine.js";
import { D, s } from "../main.js";
import { fmt } from "./common.js";

export function legacyv() {
  const L = E.legacyState(s), rate = E.captureRate(s), G = D.legacy.groups || { auto: "Automation", family: "Family", world: "World" };
  let h = `<div class="card" id="legacyhead"><div class="row"><b>🏛️ Legacy</b><span>⭐ <b>${fmt(L.renown)}</b> renown <span class="muted">(earned ${fmt(L.earned)})</span></span></div>
 <div class="muted">${rate ? `🪦 Graveyard: ${Math.round(E.titheRate(s) * 100)}% of each renown gain goes to Legacy now (Ancestors' Tithe, ${fmt(s.tithed || 0)} so far); at death it captures ${Math.round(rate * 100)}% of the renown not already tithed.` : "🪦 Build a Graveyard (1 land slot) to bank fallen members' renown."} Upgrades are permanent across generations. Basic automation is free; upgrades make it faster or smarter.</div></div>`;
  const R = s.legacyRefund;
  if (R && !R.seen) h += `<div class="card" id="refundnote" style="border-color:#d9b44a"><b>🏛️ Legacy reworked</b><div>Automation is now free once its building and skill are unlocked. You were refunded <b>${fmt(R.amt)}⭐</b> renown for automation upgrades you'd bought.${R.suggest ? " You used Auto Tend a lot: <b>Tireless Hands</b> tier 1 (55%) or tier 2 (75%) gets your old rate back." : ""}</div><button class="b" data-a="refundok">OK</button></div>`;
  for (const [g, title] of Object.entries(G)) {
    const ups = D.legacy.upgrades.filter(u => (u.group || "world") === g);
    if (!ups.length) continue;
    h += `<h3>${title}</h3><div class="card">`;
    for (const u of ups) {
      const t = E.legacyTier(s, u.id), nx = u.tiers[t], iss = E.legacyUpIssue(s, u.id);
      const dots = `<span class="muted">${"●".repeat(t)}${"○".repeat(u.tiers.length - t)}</span>`;
      const now = u.free !== undefined ? (t ? "tier " + t : "free basic") : t ? (u.id === "speed" ? u.tiers[t - 1].value + "× max speed" : "tier " + t) : "—";
      h += `<div class="row" data-leg="${u.id}" style="margin:4px 0"><span>${u.icon} <b>${u.name}</b> ${dots}<br><span class="muted">${u.desc} · now: ${now}</span></span><button class="b" data-a="legacy" data-v="${u.id}" ${iss ? "disabled" : ""}>${nx ? (u.id === "speed" ? nx.value + "× · " : "") + E.legacyCost(s, u.id) + "⭐" : "Max"}</button></div>`;
    }
    h += `</div>`;
  }
  return h;
}
