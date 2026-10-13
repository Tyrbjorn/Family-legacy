import { bellv } from "./progress.js";
import * as E from "../engine.js";
import { D, invF, s } from "../main.js";

export const $ = q => document.querySelector(q);

export const fmt = n => Math.floor(n).toLocaleString();

export const mmss = sec => `${Math.floor(sec / 60)}m ${String(Math.floor(sec % 60)).padStart(2, "0")}s`;

export const hm = sec => `${Math.floor(sec / 3600)}h ${String(Math.floor((sec % 3600) / 60)).padStart(2, "0")}m`;

export const sk = id => D.skills.find(x => x.id === id),
  it = id => E.itemDef(id),
  cl = id => D.classes.find(x => x.id === id);

export const yr = d => Math.floor(d / D.tuning.daysPerYear);

export function top() {
  const t = s.turbo,
    cap = E.turboCapSec(s);
  return `<div class="row"><b>🏰 Family Legacy</b>${E.devOn() ? '<span class="devbadge">DEV</span>' : ""}${bellv()}<span class="muted">${E.season(s).icon} ${E.season(s).name} · ${E.estateStage(s)} · Y${yr(s.day) + 1}, day ${(s.day % D.tuning.daysPerYear) + 1} · Renown ${fmt(s.renown)}</span></div><div class="muted" title="${E.nextEraHint(s)} Eras only add systems; questing, crafting, jobs and training stay available forever.">${E.era(s).icon} Era ${E.era(s).n}: ${E.era(s).name} · <span style="font-size:11px">${E.nextEraHint(s)}</span></div>
 <div class="res"><span>🪙 <b>${fmt(s.res.coin)}</b></span><span>🍞 <b>${fmt(s.res.food)}</b></span><span>🪵 <b>${fmt(s.res.wood)}</b></span><span>🪨 <b>${fmt(s.res.stone)}</b></span><span>🌱 <b>${fmt(s.res.herbs || 0)}</b></span>${s.res.planks ? `<span>🪚 <b>${fmt(s.res.planks)}</b></span>` : ""}${s.res.ingots ? `<span>⛓️ <b>${fmt(s.res.ingots)}</b></span>` : ""}${s.res.potions ? `<span>🧪 <b>${fmt(s.res.potions)}</b></span>` : ""}</div>
 <div class="row"><div style="flex:1"><div class="bar t"><i style="width:${(t.charge / cap) * 100}%"></i></div><span class="muted">⚡ Turbo ${mmss(t.charge)} / ${cap / 60}m · charges only while away (1h → 6m)</span></div>
 <label class="muted" title="Game speed (Legacy unlocks faster tiers); separate from Turbo">⏱ <select data-a="speed">${E.speedOptions(
   s,
 )
   .map(v => `<option value="${v}" ${(s.speed || 1) === v ? "selected" : ""}>${v}×</option>`)
   .join("")}</select> tick ×${E.globalTick(s).toFixed(2)}</label>
 <button class="b ${t.on ? "sel" : ""}" data-a="turbo" ${!t.on && t.charge < 60 ? "disabled" : ""}>${t.on ? "⏸ Turbo 3×" : "⚡ Turbo"}</button></div>`;
}

export function memberLine(m) {
  const c = cl(m.cls);
  return `${m.gender === "f" ? "👩" : "👨"} <b>${m.name}</b> · ${E.ageY(m)}y · ${c ? c.icon + " " + c.name : E.isAdult(m) ? "Commoner" : "Child"}${m.prof ? " + " + cl(m.prof).icon + " " + cl(m.prof).name : ""} · CP ${E.cp(s, m)} · ⭐ ${fmt(m.renown || 0)}`;
}

export function badges(m) {
  return m.traits
    .map(t => {
      const d = E.traitDef(t);
      return d
        ? `<span class="tb" style="border-color:${E.rarityColor(t)};color:${E.rarityColor(t)}" title="${d.rarity || "common"} · ${d.desc}">${d.icon} ${d.name}</span>`
        : "";
    })
    .join("");
}

export const stage = m => {
  const a = E.ageY(m);
  return a < 12 ? "Child" : a < 16 ? "Teen" : a < 50 ? "Adult" : a < 65 ? "Veteran" : "Elder";
};

export const LOCK = { guild: "🔒 guild", quest: "🔒 quest", age12: "🔒 age 12", age14: "🔒 age 14" };

export const RI = {
  bread: "🍞",
  stew: "🍲",
  smokedmeat: "🥓",
  cheese: "🧀",
  preserves: "🫙",
  sage: "🌿",
  mandrake: "🫚",
  moonpetal: "🌸",
  coin: "🪙",
  wood: "🪵",
  stone: "🪨",
  food: "🍞",
  herbs: "🌱",
  planks: "🪚",
  ingots: "⛓️",
  potions: "🧪",
  ore: "⚫",
  copperore: "🟤",
  copper: "🟠",
  hides: "🟫",
  cloth: "🧵",
  blocks: "🧱",
  leather: "👞",
  meat: "🍖",
  fish: "🐟",
  honey: "🍯",
  eggs: "🥚",
  remedies: "🩹",
  dust: "✨",
};

export const costStr = c =>
  Object.entries(c)
    .map(([k, v]) => `${fmt(v)} ${RI[k] || k}`)
    .join(" ");

export function logv() {
  return (
    `<h3>Activity Log</h3>` +
    s.log
      .map(
        l =>
          `<div class="card" style="padding:5px 8px"><span class="muted">Y${yr(l.d) + 1} D${(l.d % D.tuning.daysPerYear) + 1}</span> ${l.msg}</div>`,
      )
      .join("") +
    `<h3>Save</h3><div class="row"><button class="b" data-a="export">Export</button><button class="b" data-a="import">Import</button><button class="b" data-a="reset">New Lineage</button></div>`
  );
}

export function doing(a) {
  if (!a) return "nothing";
  const n = {
    quest: () => D.quests.find(q => q.id === a.target).name,
    train: () => sk(a.target).name,
    court: () => (s.suitors.find(x => x.id === a.target) || {}).name,
    gather: () => D.nodes.find(x => x.id === a.target).name,
    job: () => D.jobs.find(x => x.id === a.target).name,
    activity: () => D.activities.find(x => x.id === a.target).name,
  }[a.type];
  return a.type + (n ? " – " + n() : "");
}

export const QC = {
  Crude: "#9a8f86",
  Common: "#ccc",
  Fine: "#7bc47f",
  Superior: "#6fb3ff",
  Masterwork: "#f4b13d",
  Rare: "#6fb3ff",
  Epic: "#c58bf2",
};

export const MATS = [
  "food",
  "bread",
  "stew",
  "smokedmeat",
  "cheese",
  "preserves",
  "sage",
  "mandrake",
  "moonpetal",
  "wood",
  "planks",
  "stone",
  "ore",
  "ingots",
  "herbs",
  "cloth",
  "hides",
  "potions",
];

export function itemRow(x, btns) {
  return `<div class="card row" style="padding:6px 8px;margin:4px 0"><span><span style="color:${QC[x.rarity] || "#ccc"}">${x.name}</span> <span class="muted">${x.slot}${x.cp ? " +" + x.cp + " CP" : ""}${x.toolFor ? " · tool: " + x.toolFor : ""}${x.affinity ? " +" + x.affinity + "❤️" : ""} · ${x.value}🪙</span></span><span style="text-align:right">${btns}</span></div>`;
}

export const secDay = () => D.tuning.secPerDayActive / (s.turbo.on ? D.tuning.turboMult : 1);

export const dur = d => {
  const t = Math.ceil(d * secDay());
  return t >= 60 ? Math.floor(t / 60) + "m " + (t % 60) + "s" : t + "s";
};

export function unlockName(u) {
  const [k, id] = u.split(":");
  return k === "skill"
    ? "training: " + sk(id).name
    : k === "recipe"
      ? s.unlocks.includes(u)
        ? "recipe: " + (D.crafting.recipes.find(r => r.id === id) || {}).name
        : "a secret recipe"
      : "activity: " + ((D.activities.find(x => x.id === id) || {}).name || id);
}

export const curList = () =>
  s.vault.filter(id => {
    const x = it(id);
    return x && (invF.type === "all" || x.slot === invF.type) && (invF.q === "all" || x.rarity === invF.q);
  });
