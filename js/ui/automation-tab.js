// Automation tab: one place for automation options. Today: refining settings for every refining building
// (same controls as the building card), R37: a status page (what runs, why something is idle or locked) plus Auto Equip; upgrades live in the Legacy panel.
import * as E from "../engine.js";
import { D, s } from "../main.js";
import { cardRefine } from "./estate-card.js";

function ascendCard(btn) {
  const A = D.minions.autoAscend,
    titles = (D.minions.npcClasses || []).filter(c => c.from);
  const br = b =>
    `<div style="margin:3px 0"><b>${b}</b> ${titles
      .filter(c => c.branch === b)
      .map(c => {
        const on = E.titleOn(s, c.id),
          held = s.minions.filter(x => x.cls === c.id).length,
          tr = s.minions.filter(x => x.trainFor === c.id).length;
        return `<button class="b ${on ? "sel" : ""}" data-a="autotog" data-v="asc_${c.id}" title="tier ${c.needs.tier} · key job ${E.keyJob(c)} · skill ${E.titleSkill(c)} · Lv ${c.lvl}">${c.icon} ${c.name} ${held}${E.titleSlots(c) < Infinity ? "/" + E.titleSlots(c) : ""}${tr ? " +" + tr + "🎓" : ""}</button>`;
      })
      .join("")}</div>`;
  const pr = E.ascPriority(s);
  return `<h4>🎓 Auto Ascend & Recruit</h4><div class="muted">Titles of tier 2/3/4 have ${A.slots[2]}/${A.slots[3]}/${A.slots[4]} slots. The follower closest to qualifying trains in the title's key job and evolves on its own; its old slot is then refilled the same way. Peasants aim for tier-1 titles in branch priority. Followers marked "keep job" (Minions tab) are left alone.</div>
<div class="card" style="padding:6px 8px"><div class="row" style="gap:6px;justify-content:flex-start"><b>Auto Ascend</b>${btn("ascend", E.ascendOn(s))}</div>
<div class="row" style="gap:4px;justify-content:flex-start;flex-wrap:wrap"><span class="muted">Tier-1 priority:</span>${pr.map((b, i) => `<button class="b" data-a="ascup" data-v="${b}" ${i ? "" : "disabled"} title="Move up">${i + 1}. ${b}${i ? " ↑" : ""}</button>`).join("")}</div>
${pr.map(br).join("")}
<div class="row" style="gap:6px;justify-content:flex-start;margin-top:4px"><b>Auto Recruit</b><button class="b ${E.recruitOn(s) ? "sel" : ""}" data-a="autorecruit">${E.recruitOn(s) ? "On" : "Off"}</button>${E.RECRUIT_MODES.map(x => `<button class="b ${E.recruitMode(s) === x.id ? "sel" : ""}" data-a="recruitmode" data-v="${x.id}">${x.name}</button>`).join("")}<span class="muted">monthly (and after a follower dies of age), in a known town; keeps hire + ${A.recruitMonths} months of wages + reserve</span><label class="muted">reserve <input type="number" min="0" step="100" style="width:64px" data-a="recruitres" value="${s.recruitReserve ?? A.recruitReserve}"></label></div></div>`;
}

function holdsCard() {
  const h = s.holds || { types: [], items: [] },
    ex = E.living(s).filter(m => m.noAutoEq).map(m => m.name);
  const nm = id => (E.itemDef(id) || {}).name || id;
  return `<h4>📌 Holds</h4><div class="card" style="padding:6px 8px"><div class="muted">Held items skip bulk Sell / Stock and Auto Equip. Set them on the Bag tab (📌 buttons) and each member's gear card.</div>
<div>Types: ${h.types.length ? h.types.map(nm).join(", ") : "none"}</div><div>Items: ${h.items.length ? h.items.map(nm).join(", ") : "none"}</div><div>Excluded from Auto Equip and family automation: ${ex.length ? ex.join(", ") : "nobody"}</div></div>`;
}

function familyCard(btn) {
  const F = E.FA(), nm = { orders: "Auto Orders", advance: "Auto Advance", kids: "Auto Upbringing", court: "Auto Courtship" };
  const rows = E.FA_KEYS.map(k => {
    const u = E.LG().upgrades.find(x => x.id === "fa_" + k);
    return E.faOwned(s, k)
      ? `<div class="row" style="gap:6px;justify-content:flex-start">${u.icon} <b>${nm[k]}</b>${btn("fam_" + k, E.faOn(s, k))}${k === "advance" && D.guilds.second ? ` <span class="muted">Second guild pick:</span>${btn("fam_second", !(s.autoOff || {}).fam_second)}` : ""}${k === "court" ? ` <span class="muted">Head:</span><button class="b ${s.faCourtHead ? "sel" : ""}" data-a="fahead">${s.faCourtHead ? "Included" : "Off"}</button>` : ""}</div>`
      : "";
  }).join("");
  const any = E.FA_KEYS.some(k => E.faOwned(s, k));
  const evoNames = m => E.classMoves(s, m).filter(c => E.moveKind(m, c) === "up"); // R46 tiers
  const mem = any
    ? E.living(s).map(m => {
        const act = m.id === s.activeId, ad = E.isAdult(m);
        const pins = Object.keys(m.pins || {}).filter(k => m.pins[k]).map(k => `<button class="b" data-a="faunpin" data-v="${m.id}" data-w="${k}" title="Unpin: automation may change it again">📌 ${k} ✕</button>`).join("");
        const tr = !ad ? `<select data-a="fatrack" data-v="${m.id}"><option value="">track: auto${m.track ? " (" + m.track + ")" : ""}</option>${Object.keys(F.tracks).map(g => `<option value="${g}" ${m.pins && m.pins.track && m.track === g ? "selected" : ""}>${E.guildDef(g).name}</option>`).join("")}</select>` : "";
        const ev = ad && evoNames(m).length ? `<select data-a="fapref" data-v="${m.id}"><option value="">next class: best fit</option>${evoNames(m).map(c => `<option value="${c.id}" ${m.prefCls === c.id ? "selected" : ""}>${c.name}</option>`).join("")}</select>` : "";
        return `<div class="row" style="gap:6px;justify-content:flex-start;flex-wrap:wrap"><b>${m.name}</b>${act ? '<span class="muted">active: never automated</span>' : `<button class="b ${m.noAutoEq ? "" : "sel"}" data-a="faex" data-v="${m.id}">${m.noAutoEq ? "Excluded" : "Included"}</button>`}${pins}${tr}${ev}</div>`;
      }).join("")
    : "";
  return `<h4>👪 Family automation</h4><div class="muted">Never touches the member you are playing. Orders you set by hand are pinned (📌) until you unpin them. Auto Advance keeps ${Math.round(F.reserve * 100)}% of coin in reserve. Courtship only marries in (never out, never a feuding house). Marrying out, succession and politics stay manual. The member switch also covers Auto Equip. Every automatic choice is logged with 🤖.</div><div class="card" style="padding:6px 8px">${rows}${mem}</div>`;
}

export function automationv() {
  const rs = (s.structures || []).filter(st => E.isRefiner(s, st));
  const list = rs.length
    ? rs.map(st => `<div class="card" style="padding:6px 8px"><b>${E.structDef(st.type).icon} ${E.structName(st)}</b>${cardRefine(st)}</div>`).join("")
    : '<div class="card muted">No refining buildings yet (sawmill, mason yard, smithy, kitchen…). Their settings will appear here.</div>';
  const pwdBtn = (key, on) => `<button class="b ${on ? "sel" : ""}" style="font-size:11px" data-a="apwd" data-v="${key}" title="Switch off after the task in hand">⏹ when done</button>`;
  const btn = (key, on) => `<button class="b ${on ? "sel" : ""}" data-a="autotog" data-v="${key}">${on ? "On" : "Off"}</button>`;
  const at = E.atCats().map(k => {
    const x = E.atStatus(s, k), nm = k[0].toUpperCase() + k.slice(1);
    const st = x.locked ? `🔒 ${x.why}` : !x.on ? "off" : x.manned ? "paused: someone is doing it by hand" : x.target ? `running at ${Math.round(x.rate * 100)}%: ${x.target}${x.dflt ? " (default)" : ""}` : "idle: nothing to repeat yet";
    return `<div class="row" data-atstatus="${k}" style="gap:6px;justify-content:flex-start;flex-wrap:wrap"><b>${nm}</b> <span class="muted">${st}${x.pwd ? " · pauses when done" : ""}</span>${x.locked ? "" : btn("at_" + k, x.on)}${x.locked || !x.on ? "" : pwdBtn("at_" + k, x.pwd)}</div>`;
  }).join("");
  const eq = [["gear", "Weapons, armor, offhands", "build the Armory (Guardhouse upgrade)"], ["tools", "Follower tools", "build a Workshop"]]
    .map(([k, nm, need]) => `<div class="row" style="gap:6px;justify-content:flex-start"><b>${nm}</b>${E.autoEqUnlocked(s, k) ? btn("eq_" + k, E.autoEqOn(s, k)) : `<span class="muted">locked: ${need}</span>`}</div>`).join("");
  return `<h3>⚙️ Automation status</h3>${statusCard()}${autoCraftCard(btn, pwdBtn)}${peopleCard()}<h4>🌱 Auto Tend <span class="muted">(free ${Math.round(E.legacyDef("at_tend").free * 100)}%; Workshop → Gather &amp; Refine Rate in 🏛️ Legacy raises it)</span></h4><div class="muted">Status of every skill. On from day 1 once the skill and its building are unlocked: starts on a default recipe, then repeats the last thing done by hand, and pauses while someone does it.</div><div class="card" style="padding:6px 8px">${at}</div><h4>🛡️ Auto Equip</h4><div class="muted">Once a day, puts better vault gear on family (first) and followers. Hand-equipped slots are never swapped.</div><div class="card" style="padding:6px 8px">${eq}</div>${familyCard(btn)}${ascendCard(btn)}${holdsCard()}<h4>🏭 Refining</h4><div class="muted">Refining: switch a building off, idle it while its output storage is full (cap ${E.matCap(s)}), or only refine while each input is above 50% / 75% of storage.</div>${list}`;
}

// R44: 🤖 Auto-craft line (Workshop): what it wants and the auto orders it placed
function autoCraftCard(btn, pwdBtn) {
  const st = E.acStatus(s), T = E.acTier(s);
  const tiers = ["basic tools for followers", "refits family and followers", "keeps 1 spare of each gear type"];
  const wants = st.on ? E.acWants(s).slice(0, 4).map(w => `${E.orderName(w.item)} (${w.why})`).join(" · ") : "";
  return `<h4>🤖 Auto-craft</h4><div class="card" id="autocraft" style="padding:6px 8px"><div class="row" style="gap:6px;justify-content:flex-start;flex-wrap:wrap"><b>Tier ${T}/3</b><span class="muted">${st.text}${st.pwd ? " · pauses when done" : ""}</span>${T ? btn("ac", st.on) : ""}${st.on ? pwdBtn("ac", st.pwd) : ""}</div>` +
    `<div class="muted" style="font-size:12px">${tiers.map((t, i) => `${i < T ? "✅" : "▫️"} ${t}`).join("<br>")}</div>` +
    (st.on ? `<div style="font-size:12px">Auto orders: ${st.open}/${st.slots} slots${wants ? ` · next: ${wants}` : ""}</div>` : "") + `</div>`;
}
// R44: ⏸️ pause when done for people (family adults and followers with a job)
function peopleCard() {
  const row = (id, name, sub, p) => `<div class="row" data-person="${id}" style="gap:6px;justify-content:flex-start;flex-wrap:wrap"><b>${name}</b><span class="muted">${p.paused ? "⏸️ paused (resting)" : p.pwd ? "pauses when the task in hand is done" : sub}</span>` +
    (p.paused ? `<button class="b sel" data-a="presume" data-v="${id}">▶️ Resume</button>` : `<button class="b ${p.pwd ? "sel" : ""}" style="font-size:11px" data-a="ppwd" data-v="${id}">⏹ when done</button>`) + `</div>`;
  const fam = E.living(s).filter(E.isAdult).map(m => row(m.id, m.name, m.action ? m.action.type + (m.action.target ? ": " + m.action.target : "") : "idle", m));
  const fol = (s.minions || []).filter(mi => mi.job && !mi.special).slice(0, 12).map(mi => row(mi.uid, mi.name, mi.job, mi));
  return `<h4>⏸️ Pause when done: people</h4><div class="card" id="peoplepwd" style="padding:6px 8px"><div class="muted" style="font-size:12px">They finish the task in hand (the item being made, the trip under way, or today's shift), then rest until you resume them or give them a new task.</div>${fam.join("")}${fol.length ? `<div class="muted" style="margin-top:4px">Followers</div>${fol.join("")}` : ""}</div>`;
}
// R37: one-glance summary of what is running
function statusCard() {
  const st = E.atCats().map(k => E.atStatus(s, k)), run = st.filter(x => x.on && !x.locked && x.target && !x.manned).length, lock = st.filter(x => x.locked).length;
  const pz = [...E.living(s), ...(s.minions || [])].filter(p => p.paused).length, fam = E.FA_KEYS.filter(k => E.faOn(s, k)).length, q = E.quotaList(s).filter(x => !x.parent), off = (s.autoOff || {}).quotas;
  return `<div class="card" id="autostatus"><div>🌱 Auto Tend: <b>${run}</b> running · ${st.length - run - lock} idle/off · ${lock} locked</div><div>👪 Family automation: <b>${fam}</b>/${E.FA_KEYS.length} on</div><div>🤖 Auto-craft: ${E.acStatus(s).text}</div>${pz ? `<div>⏸️ Paused people: <b>${pz}</b></div>` : ""}<div>📋 Quotas: ${off ? "off" : `${q.length}/${E.quotaSlots(s) > 99 ? "∞" : E.quotaSlots(s)} slots used`}</div><div>🎓 Auto Ascend: ${E.ascendOn(s) ? "on" : "off"} · Auto Recruit: ${E.recruitOn(s) ? "on" : "off"}</div><div class="muted">Toggle each where it works (⚙ chips on buildings, Family, Minions, Quotas). Upgrades live in the 🏛️ Legacy panel.</div></div>`;
}
