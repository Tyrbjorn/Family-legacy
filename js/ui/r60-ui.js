// R60 legacy branches: Honor, faith, Respect, branch choices, special classes, carry-over bonuses.
import * as E from "../engine.js";
import { D, s, getLegacyRec } from "../main.js";
import { U } from "./state.js";

const pct = v => Math.round((v + 100) / 2); // -100..100 -> 0..100
const sign = n => (n > 0 ? "+" + n : "" + n);

export function alignPanel() {
  const a = E.alignOf(s), hb = E.honorBand(s), end = E.endingOf(s);
  const shifts = (s.alignLog || []).slice(0, 5).map(x => `<div class="muted">Y${Math.floor((x.d || 0) / D.tuning.daysPerYear) + 1}: ${x.why} (${[x.h ? "Honor " + sign(x.h) : "", x.f ? (x.f > 0 ? "New Faith " + sign(x.f) : "Old Ways +" + -x.f) : ""].filter(Boolean).join(", ")})</div>`).join("") || `<div class="muted">No shifts yet.</div>`;
  const rows = E.respectList(s).map(r => {
    const hn = r.hon ? ` <span class="muted">(${sign(r.hon)} from your Honor)</span>` : "";
    return `<div class="row r60resp${r.met ? "" : " muted"}" style="gap:6px;opacity:${r.met ? 1 : 0.5}"><span>${r.icon || "🏳️"} ${r.name}</span><span style="flex:1"></span><b>${r.met ? r.word.name : "not met"}</b>${r.met ? ` <span class="muted">${r.v}</span>${hn}` : ""}</div>`;
  }).join("");
  return `<div class="card" id="r60align"><h3>⚖️ Honor &amp; Faith</h3>
<div class="row" style="gap:6px"><span>Honor</span><span style="flex:1"></span><b>${hb.name}</b> <span class="muted">${a.honor}</span></div>
<div class="bar"><i style="width:${pct(a.honor)}%"></i></div>
<div class="row" style="gap:6px"><span class="muted">Old Ways</span><span style="flex:1;text-align:center"><b>${E.faithWord(s)}</b> <span class="muted">${a.faith}</span></span><span class="muted">New Faith</span></div>
<div class="bar t" style="position:relative"><i style="width:${pct(a.faith)}%"></i></div>
<details><summary>Last shifts</summary>${shifts}</details>
${end ? `<div>Heading for: <b>${end.name}</b> <span class="muted">${end.text}</span></div>` : ""}
<h3 style="margin-top:8px">🤝 Respect</h3>${rows}</div>`;
}

export function branchCards() {
  return E.openBranches(s).map(b => {
    const r = E.raceState(s, b);
    const side = k => {
      const x = b[k], lk = E.isLocked(s, "side:" + b.id + "." + k);
      return `<button class="b${lk ? " off" : ""}" data-a="r60branch" data-v="${b.id}:${k}" ${lk ? "disabled" : ""} style="flex:1;min-width:140px;text-align:left"><b>${x.name}</b><br><span class="muted">${x.text || ""}</span></button>`;
    };
    return `<div class="card r60branch"><b>${b.icon} ${b.name}</b> <span class="muted">${b.text}</span>
${r ? `<div class="muted">Race to ${r.at}: ${b.a.name} ${r.a} · ${b.b.name} ${r.b} (or choose now)</div>` : ""}
<div class="row" style="flex-wrap:wrap;gap:6px;margin-top:6px">${side("a")}${side("b")}</div>
<div class="muted">Choosing locks the other side's quests and classes for this dynasty.</div></div>`;
  }).join("");
}

export function specialCard() {
  const m = s.members.find(x => x.id === s.activeId);
  if (!m) return "";
  const list = E.specialClasses().filter(c => !E.isLocked(s, "cls:" + c.id) && (!E.classKeyIssue(s, c) || (s.clsEarned || []).includes(c.id)));
  if (!list.length) return "";
  return `<div class="card"><h3>🌟 Story classes <span class="muted">for ${m.name}</span></h3>${list.map(c => {
    const is = E.specialIssues(s, m, c);
    return `<div class="row" style="gap:6px;flex-wrap:wrap"><span>${c.icon} <b>${c.name}</b></span><span class="muted" style="flex:1">${is.length ? "needs " + is.join(", ") : c.desc || ""}</span><button class="b" data-a="r60special" data-v="${c.id}" ${is.length ? "disabled" : ""}>Become (${c.cost}🪙)</button></div>`;
  }).join("")}</div>`;
}

export function familyR60() {
  return branchCards() + alignPanel() + specialCard();
}

export function bonusRow() {
  const rec = getLegacyRec(), off = E.bonusesOff(rec), lb = E.legacyBonuses(rec, true);
  const names = lb.list.map(id => (D.r60.bonuses.find(b => b.id === id) || {}).name || id);
  return `<div class="row" style="flex-wrap:wrap;gap:4px"><label class="chip"><input type="checkbox" data-a="r60bonus" ${off ? "" : "checked"}> 🌳 Legacy bonuses for new dynasties</label><span class="muted">${off ? "Off: clean run." : names.length ? names.join(", ") : "none earned yet"}${s.lb ? " · this run has " + s.lb.ids.length : ""}</span></div>`;
}
