import { classCard } from "./classes-ui.js";
// R30 Character tab (Family group, first sub-tab): the full sheet for one member.
import * as E from "../engine.js";
import { D, s } from "../main.js";
import { U } from "./state.js";
import { itemIco } from "./common.js";
import { badges, itemStatsHtml, memberLine, portrait, weaponBeside } from "./common.js";
import { sheet } from "./main-tab.js";

const pct = v => Math.round(v * (v <= 1 ? 100 : 1)) + "%";
export function characterv() {
  const all = E.living(s);
  const m = E.findId(all, U.charId) || E.active(s);
  if (!m) return "";
  const K = D.gear.kinds, eq = m.equip || {};
  let h = `<div class="row" style="flex-wrap:wrap;gap:4px;justify-content:flex-start">${all.map(x => `<button class="b ${x.id === m.id ? "sel" : ""}" data-a="charpick" data-v="${x.id}">${x.name} (${E.ageY(x)})</button>`).join("")}</div>`;
  h += `<div class="card"><div class="mrow">${portrait(m, 96)}${weaponBeside(m)}<div style="flex:1;min-width:0">${memberLine(m)}<div style="margin:4px 0">${badges(m)}</div></div></div><div class="muted">Lv ${E.level(m)} · CP <b>${E.cp(s, m)}</b>${m.id === s.head ? " · 👑 Head" : ""}${m.id === s.activeId ? " · ▶ playing" : ""}</div></div>`;
  // combat
  const dodge = E.memberDodge(m, eq.armor), fail = E.memberFail(m);
  h += `<h3>⚔️ Combat</h3><div class="card"><div class="grid"><span>CP <b>${E.cp(s, m)}</b></span><span>Dodge <b>${pct(dodge)}</b> <span class="muted">(cap ${pct(K.dodge.cap)})</span></span><span>Spell failure <b>${pct(fail)}</b></span><span>Armor class <b>${(E.gstats && eq.armor && (E.gstats(eq.armor) || {}).cls) || "none"}</b></span></div></div>`;
  // gear
  h += `<h3>🛡️ Gear</h3>` + ["weapon", "offhand", "armor", "accessory"].map(sl => {
    const id = eq[sl], x = id && E.itemDef(id);
    return `<div class="card" style="padding:5px 8px;margin:3px 0"><div class="row"><span><span class="muted">${sl}:</span> ${x ? itemIco(id, x, 22) + " " : ""}<b>${x ? x.name : "—"}</b>${x ? ` <span class="muted">+${Math.round(E.itemCpFor(m, id))} CP</span>` : ""}</span><button class="b" data-a="chargear" title="Change in the Bag">Change</button></div>${x ? itemStatsHtml(x, m, false) : ""}</div>`;
  }).join("");
  // proficiency
  const fams = Object.entries(K.famNames).map(([f, n]) => [n, E.prof(m, f), E.profCap(m, f)]).filter(([, v, c]) => v > 0 || c > 0);
  h += `<h3>🎯 Proficiency</h3><div class="card"><div class="muted">Grows with use (and from related skills) up to the class cap.</div><div class="grid">${fams.map(([n, v, c]) => `<span>${n} <b>${Math.round(v)}</b>/${c}</span>`).join("")}</div></div>`;
  // advancement
  h += classCard(m) + (m.prefCls ? `<div class="muted">Auto Advance preference: ${m.prefCls}</div>` : ""); // R46 guild tiers
  // R35 leans, inheritance, apprenticeship
  h += apprv(m);
  h += talentsv(m); // R36
  // family
  const nm = id => (E.findId(s.members, id) || {}).name || "?";
  const kids = s.members.filter(x => (x.parents || []).includes(m.id));
  h += `<h3>🌳 Family</h3><div class="card"><div>Spouse: <b>${m.spouse ? nm(m.spouse) : "—"}</b></div><div>Parents: ${(m.parents || []).map(nm).join(" & ") || "—"}</div><div>Children: ${kids.map(x => x.name + (x.alive ? "" : " †")).join(", ") || "—"}</div></div>`;
  h += `<h3>⚙️ Automation</h3><div class="card"><button class="b ${m.noAutoEq ? "" : "sel"}" data-a="faex" data-v="${m.id}">${m.noAutoEq ? "Excluded" : "Included"}</button> <span class="muted">Auto Equip + family automation${Object.keys(m.pins || {}).length ? " · pinned: " + Object.keys(m.pins).join(", ") : ""}</span></div>`;
  return h + sheet(m);
}

// R35: Leans line, From parents line, apprenticeship picker (14-17)
function apprv(m) {
  const A = E.AP(), age = E.ageY(m), why = m.leanWhy || {};
  const tip = `From ${[(why.traits || []).length ? "traits: " + why.traits.join(", ") : "", (why.parents || []).length ? "parents: " + why.parents.map(E.leanName).join(", ") : "", "a little luck"].filter(Boolean).join(" · ")}. +10% XP on these guilds' skills; Family Tutor and apprenticeships follow them.`;
  let h = `<h3>🧭 Leans & upbringing</h3><div class="card" id="leans">`;
  h += `<div title="${tip}">Leans: <b>${(m.lean || []).map(E.leanName).join(", ") || "—"}</b> <span class="muted">ⓘ +10% XP</span></div>`;
  const inh = m.inh || {}, st = Object.entries(inh.stats || {}), sk = Object.entries(inh.skills || {});
  if (st.length || sk.length) h += `<div>From parents: ${st.map(([k, v]) => `${k} +${v}`).join(", ") || ""}${st.length && sk.length ? " · " : ""}${sk.map(([k, v]) => `${(E.findId(D.skills, k) || { name: k }).name} +${Math.round(v * 100)}% XP`).join(", ")}${sk.length && age >= 18 ? ' <span class="muted">(skill boost ended at 18)</span>' : ""}</div>`;
  if (age < A.minAge) h += `<div class="muted">Can apprentice at ${A.minAge}.</div>`;
  else if (age <= A.maxAge) {
    if (m.appr) {
      const M = E.masterDef(m.appr.id), p = E.apprProgress(s, m);
      h += `<div>🎓 Apprentice to <b>${M.icon} ${M.name}</b> · ${M.skills.map(k => (E.findId(D.skills, k) || { name: k }).name).join(", ")} ×${A.xpMult} · ${M.wage}🪙/day</div><div class="bar"><i style="width:${Math.round(p * 100)}%"></i></div><div class="muted">${Math.round(p * A.serveDays)}/${A.serveDays} days · finishing: ${E.guildDef(M.track)?.name || M.track} fee ½, +${A.reward.rep} rep</div><button class="b" data-a="apprset" data-v="" data-w="${m.id}">Leave</button>`;
    }
    h += `<div class="muted" style="margin-top:4px">Masters (one place each; switching restarts):</div>`;
    for (const M of A.masters) {
      const iss = E.apprIssue(s, m, M.id), on = m.appr && m.appr.id === M.id, lean = (m.lean || []).includes(M.track);
      h += `<div class="row" style="margin:2px 0"><span>${M.icon} <b>${M.name}</b>${lean ? " 🧭" : ""}<br><span class="muted">${(E.findId(D.towns, M.town) || {}).name} · ${M.skills.map(k => (E.findId(D.skills, k) || { name: k }).name).join(", ")} · ${M.wage}🪙/day${iss && !on ? " · " + iss : ""}</span></span><button class="b ${on ? "sel" : ""}" data-a="apprset" data-v="${M.id}" data-w="${m.id}" ${iss || on ? "disabled" : ""}>${on ? "Placed" : "Apprentice"}</button></div>`;
    }
    if ((m.apprDone || []).length) h += `<div class="muted">Trained: ${m.apprDone.map(id => E.masterDef(id)?.name).join(", ")}</div>`;
  } else if ((m.apprDone || []).length) h += `<div class="muted">🎓 Trained under ${m.apprDone.map(id => E.masterDef(id)?.name).join(", ")}</div>`;
  return h + `</div>`;
}

// R36: talents panel (slots, chips, learned list, next hint, shrines)
function talentsv(m) {
  const x = m.talents || { own: [], on: [] }, n = E.talentSlots(m), L = E.TL();
  const card = (t, on) => `<div class="card" style="padding:5px 8px;margin:3px 0" data-talent="${t.id}"><div class="row"><span>${t.icon} <b>${t.name}</b>${on ? " ✅" : ""}<br><span class="muted">${t.desc} · from ${t.from.class ? (E.findId(D.classes, t.from.class) || {}).name : t.from.guild ? t.from.rank + " " + (E.findId(D.guilds.guilds, t.from.guild) || {}).name : t.from.tutorial ? "the prologue" : "a quest"}</span></span><button class="b ${on ? "sel" : ""}" data-a="talenttog" data-v="${t.id}" data-w="${m.id}" ${!on && x.on.length >= n || on && t.fx.slots ? "disabled" : ""}>${on ? "Active" : "Use"}</button></div></div>`;
  let h = `<h3>⭐ Talents ${x.on.length}/${n}</h3><div id="talents">`;
  if (!E.isAdult(m)) h += `<div class="card muted">Talents are earned as an adult: class picks, evolutions, guild ranks and notable quests.</div>`;
  else {
    h += `<div class="card"><div>${[...Array(n)].map((_, i) => { const t = E.talentDef(x.on[i]); return t ? `<span class="tb" title="${t.desc}">${t.icon} ${t.name}</span>` : `<span class="tb muted">empty slot</span>`; }).join(" ")}</div><div class="muted">Slots: ${L.slots.base} + 1 per class tier (max ${L.slots.cap}; Heir of Vael +1).${m.pins && m.pins.talents ? " Loadout pinned." : ""}</div></div>`;
    for (const id of x.own) h += card(E.talentDef(id), x.on.includes(id));
  }
  const nx = E.nextTalents(s, m), hid = E.hiddenTalents(m);
  if (nx.length || hid) h += `<div class="card muted" id="talentnext">${nx.map(({ t, how }) => `Next: ${how} → ${t.icon} ${t.name}`).join("<br>")}${nx.length && hid ? "<br>" : ""}${hid ? `❔ ${hid} hidden talent${hid > 1 ? "s" : ""} from notable quests` : ""}</div>`;
  if (E.hasHall(s) || (s.shrines || []).length) {
    h += `<div class="card"><div>🏛️ Family shrines ${(s.shrines || []).length}/${L.shrines.max}: ${(s.shrines || []).map(id => E.talentDef(id).icon + " " + E.talentDef(id).name).join(", ") || "—"}</div><div class="muted">Descendants learn shrined talents free at ${L.shrines.learnAge}.</div>`;
    if (s.shrineOffer) h += `<div>${s.shrineOffer.name}'s talents (replace a shrine): ${s.shrineOffer.ids.map(id => (s.shrines || []).map(r => `<button class="b" data-a="enshrine" data-v="${id}" data-w="${r}">${E.talentDef(id).name} ⇄ ${E.talentDef(r).name}</button>`).join("")).join("")}</div>`;
    h += `</div>`;
  }
  return h + `</div>`;
}
