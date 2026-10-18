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
      ? `<div class="row" style="gap:6px;justify-content:flex-start">${u.icon} <b>${nm[k]}</b>${btn("fam_" + k, E.faOn(s, k))}${k === "court" ? ` <span class="muted">Head:</span><button class="b ${s.faCourtHead ? "sel" : ""}" data-a="fahead">${s.faCourtHead ? "Included" : "Off"}</button>` : ""}</div>`
      : "";
  }).join("");
  const any = E.FA_KEYS.some(k => E.faOwned(s, k));
  const evoNames = m => D.classes.filter(c => c.from && c.from === m.cls);
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
  const btn = (key, on) => `<button class="b ${on ? "sel" : ""}" data-a="autotog" data-v="${key}">${on ? "On" : "Off"}</button>`;
  const at = E.atCats().map(k => {
    const x = E.atStatus(s, k), nm = k[0].toUpperCase() + k.slice(1);
    const st = x.locked ? `🔒 ${x.why}` : !x.on ? "off" : x.manned ? "paused: someone is doing it by hand" : x.target ? `running at ${Math.round(x.rate * 100)}%: ${x.target}` : "idle: nothing to repeat yet";
    return `<div class="row" data-atstatus="${k}" style="gap:6px;justify-content:flex-start"><b>${nm}</b> <span class="muted">${st}</span>${x.locked ? "" : btn("at_" + k, x.on)}</div>`;
  }).join("");
  const eq = [["gear", "Weapons, armor, offhands", "build the Armory (Guardhouse upgrade)"], ["tools", "Follower tools", "build a Workshop"]]
    .map(([k, nm, need]) => `<div class="row" style="gap:6px;justify-content:flex-start"><b>${nm}</b>${E.autoEqUnlocked(s, k) ? btn("eq_" + k, E.autoEqOn(s, k)) : `<span class="muted">locked: ${need}</span>`}</div>`).join("");
  return `<h3>⚙️ Automation status</h3>${statusCard()}<h4>🌱 Auto Tend <span class="muted">(free ${Math.round(E.legacyDef("at_tend").free * 100)}%; Workshop → Gather &amp; Refine Rate in 🏛️ Legacy raises it)</span></h4><div class="muted">Status of every skill. Free once the skill and its building are unlocked; repeats the last thing done by hand and pauses while someone does it.</div><div class="card" style="padding:6px 8px">${at}</div><h4>🛡️ Auto Equip</h4><div class="muted">Once a day, puts better vault gear on family (first) and followers. Hand-equipped slots are never swapped.</div><div class="card" style="padding:6px 8px">${eq}</div>${familyCard(btn)}${ascendCard(btn)}${holdsCard()}<h4>🏭 Refining</h4><div class="muted">Refining: switch a building off, idle it while its output storage is full (cap ${E.matCap(s)}), or only refine while each input is above 50% / 75% of storage.</div>${list}`;
}

// R37: one-glance summary of what is running
function statusCard() {
  const st = E.atCats().map(k => E.atStatus(s, k)), run = st.filter(x => x.on && !x.locked && x.target && !x.manned).length, lock = st.filter(x => x.locked).length;
  const fam = E.FA_KEYS.filter(k => E.faOn(s, k)).length, q = E.quotaList(s).filter(x => !x.parent), off = (s.autoOff || {}).quotas;
  return `<div class="card" id="autostatus"><div>🌱 Auto Tend: <b>${run}</b> running · ${st.length - run - lock} idle/off · ${lock} locked</div><div>👪 Family automation: <b>${fam}</b>/${E.FA_KEYS.length} on</div><div>📋 Quotas: ${off ? "off" : `${q.length}/${E.quotaSlots(s) > 99 ? "∞" : E.quotaSlots(s)} slots used`}</div><div>🎓 Auto Ascend: ${E.ascendOn(s) ? "on" : "off"} · Auto Recruit: ${E.recruitOn(s) ? "on" : "off"}</div><div class="muted">Toggle each where it works (⚙ chips on buildings, Family, Minions, Quotas). Upgrades live in the 🏛️ Legacy panel.</div></div>`;
}
