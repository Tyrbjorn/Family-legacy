// R59 character creation screen (modal over a fresh dynasty). Form on the left, live portrait on the right.
import * as E from "../engine.js";
import { D, s, getLegacyRec } from "../main.js";
import { U } from "./state.js";
import { dollHtml } from "../doll.js";
import { MASTERS, CREATION_HEAD, CREATION_HINT } from "./coach-data.js";

const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const ch = (k, id, label, on, ok = true, how = "") =>
  `<button class="b ch ${on ? "on" : ""} ${ok ? "" : "lk"}" data-a="cre" data-v="${k}:${id}" ${ok ? "" : `disabled title="🔒 ${esc(how)}"`}>${ok ? "" : "🔒 "}${label}</button>`;
const sw = (k, i, col, on, name) => `<button class="sw ${on ? "on" : ""}" style="background:${col}" data-a="cre" data-v="${k}:${i}" title="${esc(name)}" aria-label="${esc(name)}"></button>`;

export function creationDoll(c, size, crop) {
  const C = D.creation, base = `${c.race === "dwarf" ? "dwarf" : "human"}-${c.gender === "f" ? "female" : "male"}`;
  const fr = (C.frames || {})[c.frame || "open"];
  return dollHtml(D.doll, C, { base, look: c.look, sea: c.blood === "seatouched", house: (C.houseCols.find(h => h.id === c.house) || C.houseCols[0]).col, size, crop, frame: fr, classic: !!s.classicEmoji, emoji: c.gender === "f" ? "👩" : "👨" });
}
// backdrop with its banners tinted: grey/95 × house colour × 0.85 (batch2b index)
export function backdropHtml(col) {
  const DL = D.doll || {}, bg = DL.backdrop, bn = DL.banners;
  if (!bg) return "";
  const m = bn ? `-webkit-mask-image:url(${bn});mask-image:url(${bn});` : "";
  return `<div class="bd" style="background-image:url(${bg})"></div>${bn ? `<div class="bd bdb"><div class="bd" style="background-image:url(${bn});filter:brightness(2.28)"></div><div class="bd" style="background:${col};mix-blend-mode:multiply;${m}"></div></div>` : ""}<div class="bd" style="background:linear-gradient(90deg,#000c,#0004)"></div>`;
}
export function creationv() {
  const c = U.create; if (!c) return "";
  const C = D.creation, O = E.creationOptions(getLegacyRec()), rec = getLegacyRec();
  const bad = c.traits.filter(t => (E.traitDef(t) || {}).rarity === "bad").length, cap = O.maxPicks + (bad ? O.bonusForBad : 0);
  const row = (lbl, h) => `<div class="opt"><div class="muted">${lbl}</div>${h}</div>`;
  const traits = O.traits.map(t => { const d = E.traitDef(t.id); return ch("trait", t.id, `${d.icon} ${d.name}${t.bad ? " ⚠️" : ""}`, c.traits.includes(t.id), t.ok, t.how).replace("<button ", `<button title="${esc(d.desc)}" `.replace('title=""', "")); }).join("");
  const sty = C.hairStyles[c.gender];
  const form = [
    row("Name", `<input id="crename" maxlength="24" value="${esc(c.name)}" style="width:100%;max-width:260px">`),
    row(`<b>${esc(CREATION_HEAD)}</b> <span class="muted">${esc(CREATION_HINT)} (flavor only)</span>`, MASTERS.map(m => ch("master", m.id, `${esc(m.name)} <span class="muted">· ${esc(m.trade)}</span>`, (c.master || "orrin") === m.id)).join("")),
    row("Sex", O.sexes.map(x => ch("gender", x.id, x.name, c.gender === x.id)).join("")),
    row("Race", O.races.map(x => ch("race", x.id, x.name, c.race === x.id, x.ok, x.how)).join("")),
    row("Bloodline", O.bloodlines.map(x => ch("blood", x.id, x.name, (c.blood || "") === x.id, x.ok, x.how)).join("")),
    row(`Traits <b>${c.traits.length}/${cap}</b> · ${O.freeGood} good trait${O.freeGood === 1 ? "" : "s"} free; a bad trait (⚠️) earns one more good pick (up to ${O.maxPicks + O.bonusForBad})`, traits),
    row("Starting class" + (O.classes.some(x => x.ok) ? "" : ` <span class="muted">🔒 ${esc(O.classes[0] && O.classes[0].how)}</span>`), ch("cls", "", "None", !c.cls) + O.classes.map(x => ch("cls", x.id, x.icon + " " + x.name, c.cls === x.id, x.ok, x.how)).join("")),
    row("Hair", sty.map(([id, n]) => ch("hair", id, n, c.look.hair === id)).join("") + (c.gender === "f" ? ch("bun", "1", "Bun", !!c.look.bun) : "")),
    row("Hair colour", C.hairCols.map((h, i) => sw("hairCol", i, h.col, (c.look.hairCol | 0) === i, h.name)).join("")),
    row("Skin tone", C.skins.map((h, i) => sw("skin", i, h.col, (c.look.skin | 0) === i, h.name)).join("")),
    c.race === "dwarf" && c.gender === "m" ? row("Beard", C.beards.map(([id, n]) => ch("beard", id, n, (c.look.beard || "") === id)).join("")) : "",
    row("House colour", C.houseCols.map(h => sw("house", h.id, h.col, c.house === h.id, h.name)).join("")),
    row("Portrait frame", O.frames.map(f => ch("frame", f.id, { open: "Wood", stone: "Stone", hydra: "Hydra-scale" }[f.id] || f.id, (c.frame || "open") === f.id, f.ok, (C.unlocks.find(u => u.frame === f.id) || {}).how)).join("")),
  ].join("");
  const nUn = rec.unlocks.length, tot = C.unlocks.length;
  return `<div class="card cre-card"><div class="crehead">${backdropHtml((C.houseCols.find(h => h.id === c.house) || C.houseCols[0]).col)}<div class="crehead-t"><h3 style="margin:0">🛡️ Found your house</h3><div>Make your founder, or take <b>Quick start</b> to keep the one fate gave you.</div><div class="muted" style="color:#ddd">Legacy unlocks on this device: ${nUn}/${tot}</div></div></div>
<div class="cre"><div>${form}${U.createErr ? `<div style="color:#e77">⚠️ ${esc(U.createErr)}</div>` : ""}</div>
<div class="pv">${creationDoll(c, 96)}${creationDoll(c, 230, "full")}</div></div>
<div class="row" style="gap:6px;flex-wrap:wrap;margin-top:8px"><button class="b sel" data-a="crestart">✅ Begin</button><button class="b" data-a="crerandom">🎲 Random</button><button class="b" data-a="crequick">⏩ Quick start</button></div></div>`;
}
