// Houses view (Family group): courtship, household personalities, diplomacy, feuds and wars. Mobile-first cards.
import * as E from "../engine.js";
import { D, s } from "../main.js";
import { RI, cl, fmt, it } from "./common.js";
import { U } from "./state.js";

const bar = (p, col = "#e66") => `<div class="bar"><i style="width:${Math.max(0, Math.min(100, p * 100))}%;background:${col}"></i></div>`;
const tcol = { feud: "#e44", rival: "#e77", cold: "#8ab", neutral: "#bbb", friendly: "#7c7", allied: "#d9b44a" };
const traitChip = id => {
  const d = E.traitDef(id);
  return d ? `<span class="tb" style="border-color:${E.rarityColor(id)};color:${E.rarityColor(id)}" title="${d.desc}">${d.icon} ${d.name}</span>` : "";
};
const dowryStr = d =>
  [d.coin ? fmt(d.coin) + "🪙" : "", ...Object.entries(d.res || {}).map(([k, v]) => v + (RI[k] || E.resName(k)))].filter(Boolean).join(" ") || "none";

// R81 heritage preview: words only, the odds are in the tooltip (placeholder text)
const bloodLine = (m, su) => { const b = E.bloodPreview(m, su); return b ? `<div class="muted" title="${b.tip}">⛏️ ${b.text}</div>` : ""; };
export function suitorCard(su) {
  const m = E.active(s);
  E.ensureSuitor(s, su);
  const p = E.personaDef(su.persona),
    h = su.house && E.houseDef(su.house),
    st = E.stageOf(su.affinity),
    left = E.leavesIn(s, su);
  const canCourt = E.ageY(m) >= D.tuning.courtAge && !m.spouse;
  const gifts = [...new Set(s.vault.filter(i => it(i)?.slot === "gift"))];
  const foods = Object.keys(D.estate.meals.menu).filter(k => k !== "food" && (s.res[k] || 0) >= D.marriage.foodGift.units);
  const issue = E.proposeIssue(s, su.id);
  return `<div class="card suitor"><div class="row"><span><b>${su.name}</b>, ${su.age} · ${cl(su.cls)?.name || ""}${h ? ` · ${h.icon} ${h.name}` : " · commoner"}</span><span>${st.icon} ${st.name}</span></div>
${bar(su.affinity / 100)}<div class="muted">❤️ ${Math.floor(su.affinity)}/100${p ? ` · ${p.icon} ${p.name}: ${p.desc} · likes ${p.likesStat} and ${it(p.likesGift)?.name || E.resName(p.likesGift)}` : ""}</div>
${(D.marriage.classGifts || {})[su.cls] ? `<div class="muted">⭐ ${cl(su.cls)?.name || su.cls}s like ${it(D.marriage.classGifts[su.cls])?.name || D.marriage.classGifts[su.cls]} (x${D.marriage.classGiftMult})</div>` : ""}
<div>${(su.traits || []).map(traitChip).join("")} <span class="muted">· dowry ${dowryStr(su.dowry || { coin: 0 })}</span></div>
${bloodLine(m, su)}${left !== Infinity ? `<div class="muted">Leaves in ${left}d${su.house && su.affinity >= D.marriage.jiltAt ? " (jilting sours their house)" : ""}</div>${bar(1 - left / D.marriage.stayDays, "#88a")}` : ""}
<div class="row" style="flex-wrap:wrap;gap:4px;justify-content:flex-start"><button class="b" data-a="court" data-v="${su.id}" ${canCourt ? "" : "disabled"}>Court</button>
${gifts.map(g => `<button class="b" data-a="gift" data-v="${su.id}" data-w="${g}">🎁 ${it(g).name}${E.likedGift(su, g) ? " ❤️" : ""}${E.classLiked(su, g) ? " ⭐" : ""}</button>`).join("")}
${foods.map(k => `<button class="b" data-a="foodgift" data-v="${su.id}" data-w="${k}">${RI[k] || E.resName(k)} ${D.marriage.foodGift.units}${E.likedGift(su, k) ? " ❤️" : ""}</button>`).join("")}
<button class="b" data-a="propose" data-v="${su.id}" ${!issue ? "" : "disabled"}>💍 Propose (${E.PROPOSE_COST}🪙)</button></div>${su.affinity >= 100 && issue ? `<div class="muted">Needs ${issue}</div>` : ""}</div>`;
}

function householdCard() {
  const hl = E.householdList(s);
  if (!hl.length) return `<div class="card muted">🏠 Household: married-in spouses bring their personality to the home (contentment, food, children's XP, healing, renown).</div>`;
  return `<div class="card"><b>🏠 Household</b>${hl.map(x => `<div>${x.p.icon} <b>${x.who}</b> · ${x.p.name}: <span class="muted">${x.p.desc}</span></div>`).join("")}</div>`;
}

function warCard(hd) {
  const w = E.warTimer(s, hd.id),
    our = Math.round(E.familyPower(s) + E.allyPower(s)),
    foe = Math.round(E.enemyPower(s, hd.id));
  const ti = E.truceIssue(s, hd.id);
  return `<div class="war"><b>🏴 War</b> <span class="muted">score ${w.score} (±${E.WAR().decisive} ends it) · next battle in ${w.left}d · your power ${our} vs ${foe} (≈${Math.round((our / Math.max(1, our + foe)) * 100)}% per battle)</span>${bar(w.p, "#c55")}
<div class="row" style="flex-wrap:wrap;gap:4px;justify-content:flex-start"><button class="b" data-a="truce" data-v="${hd.id}" ${ti ? "disabled" : ""}>🕊️ Truce: pay ${E.tributeCost(s, hd.id)}🪙</button><span class="muted">or marry into them, or win ${E.WAR().decisive} battles</span></div></div>`;
}

// R48 families.json: seat, goal, temperament, perks (✅ when active), the 3-quest thread, marriage, sworn rival
function famLines(hd) {
  const tp = E.temperDef(hd.temperament), act = E.activePerks(s, hd.id).map(p => p.text);
  const pk = Object.entries(hd.perks || {}).map(([k, L]) => `${k === "allied" ? "🤝 Allied" : "🙂 Friendly"}: ${L.map(p => `${act.includes(p.text) ? "✅ " : ""}${p.text}`).join("; ")}`).join(" · ");
  const th = hd.thread, n = th ? E.threadQuests(hd.id).length : 0, k = th ? E.threadStep(s, hd.id) : 0;
  const mm = hd.marriage === "allied" ? "marriage once Allied" : hd.marriage === false ? "no marriages" : "offers marriage";
  return `<div class="muted" style="font-size:12px">${hd.major ? "⭐ Major house" : "Minor house"} · seat ${(E.findId(D.towns, hd.seat) || {}).name || hd.seat} · goal: ${hd.goal || "?"} · <span title="${tp.text || ""}">${tp.icon || ""} ${tp.name || hd.temperament || ""}</span> · ${mm}${hd.rival ? ` · ⚔️ sworn rival of ${(E.houseDef(hd.rival) || {}).name}` : ""}</div>
<div class="muted" style="font-size:12px">${tp.text || ""}</div>
${pk ? `<div class="muted" style="font-size:12px">Perks · ${pk}</div>` : ""}
${th ? `<div class="muted" style="font-size:12px">📜 Thread “${th.name}”: ${E.threadDone(s, hd.id) ? "✅ complete" : `${k}/${n}${k === 0 && !E.threadQuests(hd.id).some(q => E.known(s, q)) ? (hd.id === "dagon" ? " (an investigation: opens after “What the Reef Keeps”)" : " (opens once you know their seat and they're Neutral or better)") : ""}`}</div>` : ""}
${th && th.also ? `<div class="muted" style="font-size:12px">🪸 Also: “${E.questChainName(th.also)}” ${E.questChainStep(s, th.also)}/${E.questChain(th.also).length}${E.choiceMade(s, th.also) ? (E.choiceMade(s, th.also) === "keep" ? " · you kept their secret" : " · you told the Church") : ""}</div>` : ""}
${hd.marriageTrait ? `<div class="muted" style="font-size:12px">💍 Marrying in: ${hd.marriageTrait.text || hd.marriageTrait.id}</div>` : ""}`;
}

function houseCard(hd) {
  const st = E.houseState(s, hd.id),
    tier = E.tierOf(s, hd.id),
    td = E.tierDef(tier),
    fx = E.tierFx(s, hd.id);
  const [lo, hi] = E.HC().range;
  const perks = [
    fx.sellMult && fx.sellMult !== 1 ? `sell ${fx.sellMult > 1 ? "+" : ""}${Math.round((fx.sellMult - 1) * 100)}% in ${E.findId(D.towns, hd.town).name}` : "",
    fx.courtMult ? `+${Math.round(fx.courtMult * 100)}% courting their suitors` : "",
    fx.renownMonth ? `+${fx.renownMonth} renown/month` : "",
    fx.giftChance ? "occasional gifts" : "",
    fx.suitors ? `suitors (dowry ×${fx.dowryMult})` : "no marriage offers",
    fx.troubleChance ? "⚠️ trouble events" : "",
  ].filter(Boolean);
  const qs = E.houseQuests(s, hd.id).filter(q => !q.thread || E.known(s, q)); // R48: later thread steps stay hidden until reached
  const m = E.active(s);
  const gi = E.giftIssue(s, hd.id);
  const wi = E.declareWarIssue(s, hd.id);
  const cands = E.living(s).filter(x => x.id !== s.activeId && !x.spouse && E.isAdult(x));
  const pick = cands.find(x => String(x.id) === (U.moSel || {})[hd.id]) || cands[0];
  return `<div class="card house" id="house-${hd.id}"><div class="row"><b>${hd.icon} ${hd.name}</b><span style="color:${tcol[tier]}">${td.icon} ${td.name}${st.state === "war" ? " · AT WAR" : ""}</span></div>
<div class="muted">${hd.desc} · ${E.findId(D.towns, hd.town).name} · wealth ${"🪙".repeat(hd.wealth)} · rapport ${Math.round(st.r)}${E.ties(s, hd.id) ? ` · 💍 ${E.ties(s, hd.id)} tie(s)` : ""}</div>
${famLines(hd)}
${bar((st.r - lo) / (hi - lo), tcol[tier])}<div class="muted">${perks.join(" · ")}</div>
${st.state === "feud" && st.warned != null ? `<div style="color:#e77">🔥 Mustering for war: ${Math.max(0, E.FEUD().warnDays - (s.day - st.warned))}d left to cool the feud.</div>` : ""}
${st.state === "war" ? warCard(hd) : ""}
${qs.length ? `<div class="hq">${qs.map(q => { const iss = E.questIssue(s, m, q); return `<div class="row"><span>📜 ${q.name}<br><span class="muted">${q.against ? `vs ${E.houseDef(q.against).name} · ` : ""}CP ${q.cp} · ${q.days}d · ${Object.entries(q.reward).map(([k, v]) => v + (RI[k] || E.resName(k))).join(" ")}</span></span><button class="b" data-a="hquest" data-v="${q.id}" ${!iss && E.actionAllowed(s, m, { type: "quest", target: q.id }) && !E.isBusy(m) ? "" : "disabled"} title="${iss || ""}">${iss ? "🔒" : "Take"}</button></div>`; }).join("")}</div>` : ""}
<div class="row" style="flex-wrap:wrap;gap:4px;justify-content:flex-start;margin-top:4px"><button class="b" data-a="hgift" data-v="${hd.id}" ${gi ? "disabled" : ""} title="${gi || ""}">🎁 Gift ${E.giftCost(s, hd.id)}🪙</button>
${st.state === "feud" ? `<button class="b" data-a="war" data-v="${hd.id}" ${wi ? "disabled" : ""}>🏴 Declare war</button>` : ""}
${cands.length ? `<select data-a="mosel" data-v="${hd.id}" aria-label="Marry out">${cands.map(x => `<option value="${x.id}" ${x === pick ? "selected" : ""}>${x.name} (${E.ageY(x)})</option>`).join("")}</select><button class="b" data-a="marryout" data-v="${hd.id}">💍 Marry into them</button>` : ""}</div>
${pick ? `<div class="muted">Dowry ${E.marryOutDowry(pick)}🪙 · ${pick.name} leaves home; rapport +${D.marriage.marryOut.rapport}${E.marryOutIssue(s, pick.id, hd.id) ? ` · needs: ${E.marryOutIssue(s, pick.id, hd.id)}` : ""}</div>` : ""}</div>`;
}

export function housesParts() {
  const m = E.active(s);
  const P = {};
  let h = `<h3>💌 Courtship</h3>`;
  if (E.ageY(m) < D.tuning.courtAge) h += `<div class="muted">The active member must be ${D.tuning.courtAge}+ to court.</div>`;
  h += s.suitors.length ? s.suitors.map(suitorCard).join("") : `<div class="muted">No suitors yet. They arrive every ~45 days (only from neutral or friendlier houses, plus commoners).</div>`;
  h += householdCard();
  P.courtship = h;
  h = "";
  const ws = E.wars(s);
  h += `<h3>🏰 Families of the realm</h3><div class="muted">Each house has a seat, a goal and a temperament that changes how standing moves. Quests for a house build rapport; quests against a house lower it. Below Rival a house feuds; feuds can escalate to war (you are warned first). Rapport drifts back toward neutral over time.${!E.phaseOk(s, "againstQuests") ? " <b>Rivalry quests and trouble events unlock in the Established phase; feuds and war in the Dynasty phase.</b>" : !E.phaseOk(s, "feud") ? ` <b>Feuds and war unlock in the Dynasty phase (${E.nextEraHint(s)})</b>` : ""}${s.weary ? ` War weariness: contentment ${E.wearyMorale(s).toFixed(1)}.` : ""}</div>`;
  if (ws.length) h += `<div class="card" style="border-color:#c55">🏴 At war with ${ws.map(x => x.name).join(", ")}</div>`;
  const ph = E.playerHouse();
  h += `<div class="card" id="famvael"><b>${ph.icon || "🛡️"} ${ph.name}</b> <span class="muted">· your family</span><div class="muted">${ph.text || ""}</div></div>`;
  P.realm = h;
  h = "";
  const maj = E.houseList().filter(x => x.major), mnr = E.houseList().filter(x => !x.major);
  P.major = `<h3>⭐ Major houses (one per town)</h3>` + maj.map(houseCard).join("");
  P.minor = mnr.length ? `<h3>🏠 Minor houses</h3>` + mnr.map(houseCard).join("") : "";
  h = "";
  const u = E.usurperDef && E.usurperDef(); // R50 House Crane, the usurper's house (exiled; outside the house list)
  if (u) {
    const gone = E.usurperGone(s), t = E.usurperTier(s), td = gone ? { icon: "🪶", name: "Disgraced" } : E.tierDef(t);
    h += `<h3>🦩 The usurper</h3><div class="card" id="famcrane"><b>${u.icon} ${u.name}</b> <span class="muted">· exiled · ${td.icon} ${td.name}</span><div class="muted">${u.known}. Goal: ${u.goal}. ${gone ? "Disgraced after chapter 10; it has left the realm." : u.text}</div></div>`;
  }
  P.usurper = h;
  return P;
}
export const housesv = () => { const P = housesParts(); return P.courtship + P.realm + P.major + P.minor + P.usurper; };
