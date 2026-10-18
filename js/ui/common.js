import { testerBadge } from "./playpass-ui.js";
import { gearTags } from "./gear-ui.js";
import { bellv } from "./progress.js";
import * as E from "../engine.js";
import { D, invF, s } from "../main.js";
import { U } from "./state.js";

export const $ = q => document.querySelector(q);

export const fmt = n => Math.floor(n).toLocaleString();

export const mmss = sec => `${Math.floor(sec / 60)}m ${String(Math.floor(sec % 60)).padStart(2, "0")}s`;

export const hm = sec => `${Math.floor(sec / 3600)}h ${String(Math.floor((sec % 3600) / 60)).padStart(2, "0")}m`;

export const sk = id => E.findId(D.skills, id),
  it = id => E.itemDef(id),
  cl = id => E.findId(D.classes, id);

export const yr = d => Math.floor(d / D.tuning.daysPerYear);

export function top() {
  const t = s.turbo,
    cap = E.turboCapSec(s);
  return `${U.saveErr ? `<div class="card" id="saveerr" style="border-color:#e77;color:#e77">⚠️ ${U.saveErr}</div>` : ""}<div class="row"><b>🏰 Family Legacy</b>${E.devOn() ? '<span class="devbadge">DEV</span>' : ""}${testerBadge()}<button class="b fbbtn" data-fb="open" title="Playtest feedback">💬 Feedback</button><button class="b" data-tab="saves" id="savesbtn" title="Save slots">📂</button><button class="b" data-tab="legacy" id="legacybtn" title="Legacy upgrades (renown)">🏛️ ${fmt(E.legacyState(s).renown)}${s.legacyRefund && !s.legacyRefund.seen ? " ❗" : ""}</button>${bellv()}<span class="muted">${E.season(s).icon} ${E.season(s).name} · ${E.todLabel(s)} · ${E.estateStage(s)} · Y${yr(s.day) + 1}, day ${(s.day % D.tuning.daysPerYear) + 1} · Renown ${fmt(s.renown)}</span></div><div class="muted" title="${E.nextEraHint(s)} Phases only add systems; questing, crafting, jobs and training stay available forever.">${E.era(s).icon} Phase ${E.era(s).n}/${E.phaseCount()}: ${E.era(s).name} <span class="hint" style="font-size:11px">· ${E.nextEraHint(s)}</span></div>
 <div class="res"><span>🪙 <b>${fmt(s.res.coin)}</b></span>${foodSpan()}<span>🪵 <b>${fmt(s.res.wood)}</b></span><span>🪨 <b>${fmt(s.res.stone)}</b></span><span title="Thyme (common herb)">🌿 <b>${fmt(s.res.thyme || 0)}</b></span>${s.meal ? `<span title="Contentment (food variety, rations, shortages)">${s.morale >= 0 ? "🙂" : "😟"} <b>${s.morale >= 0 ? "+" : ""}${(s.morale || 0).toFixed(1)}</b></span>` : ""}${s.res.planks ? `<span>🪚 <b>${fmt(s.res.planks)}</b></span>` : ""}${s.res.ingots ? `<span>⛓️ <b>${fmt(s.res.ingots)}</b></span>` : ""}${s.res.potions ? `<span>🧪 <b>${fmt(s.res.potions)}</b></span>` : ""}</div>
 <div class="row"><div style="flex:1"><div class="bar t"><i style="width:${(t.charge / cap) * 100}%"></i></div><span class="muted">⚡ Turbo ${mmss(t.charge)} / ${cap / 60}m<span class="hint"> · charges only while away (1h → 6m)</span></span></div>
 <label class="muted" title="Game speed (Legacy unlocks faster tiers); separate from Turbo">⏱ <select data-a="speed">${E.speedOptions(
   s,
 )
   .map(v => `<option value="${v}" ${(s.speed || 1) === v ? "selected" : ""}>${v}×</option>`)
   .join("")}</select> tick ×${E.globalTick(s).toFixed(2)}</label>
 <button class="b ${t.on ? "sel" : ""}" data-a="turbo" ${!t.on && t.charge < 60 ? "disabled" : ""}>${t.on ? "⏸ Turbo 3×" : "⚡ Turbo"}</button></div>`;
}

export function memberLine(m) {
  const c = cl(m.cls);
  return `${m.gender === "f" ? "👩" : "👨"} <b>${m.name}</b> · ${E.ageY(m)}y · ${c ? c.icon + " " + c.name : E.isAdult(m) ? "Commoner" : E.isTeen(m) ? "Teen" : "Child"}${E.mainPath(m) ? " + " + E.pathDef(E.mainPath(m).id).icon + " " + E.pathRankName(E.mainPath(m).rank) + " " + E.pathDef(E.mainPath(m).id).name : ""}${E.pendingPathChoices(m) ? " 🎯" : ""}${m.appr ? ` · 🎓 ${E.masterDef(m.appr.id)?.name || ""}` : ""} · CP ${E.cp(s, m)} · ⭐ ${fmt(m.renown || 0)}`;
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
  return a < 12 ? "Child" : a < D.tuning.adultAge ? "Teen" : a < 50 ? "Adult" : a < 65 ? "Veteran" : "Elder";
};

export const LOCK = { guild: "🔒 guild", quest: "🔒 quest", age12: "🔒 age 12", age14: "🔒 age 14" };

export const RI = {
  bread: "🍞",
  stew: "🍲",
  smokedmeat: "🥓",
  cheese: "🧀",
  preserves: "🫙",
  sage: "🍃",
  thyme: "🌿",
  wheat: "🌾",
  hay: "🪹",
  barley: "🌱",
  vegetables: "🥕",
  berries: "🫐",
  milk: "🥛",
  salt: "🧂",
  flax: "🪢",
  flour: "🥡",
  butter: "🧈",
  ale: "🍺",
  wine: "🍷",
  spirits: "🥃",
  pie: "🥧",
  porridge: "🥣",
  draught: "😴",
  manatonic: "🔮",
  mandrake: "🫚",
  moonpetal: "🌸",
  coin: "🪙",
  wood: "🪵",
  stone: "🪨",
  food: "🍞",
  planks: "🪚",
  ingots: "⛓️",
  potions: "🧪",
  ore: "⚫",
  copperore: "🟤",
  copper: "🟠",
  tinore: "🪨",
  tin: "⚪",
  bronze: "🟫",
  coal: "⬛",
  steel: "🔩",
  silverore: "🩶",
  silver: "🥈",
  gems: "💎",
  cutgems: "💠",
  bandages: "🩹",
  goldore: "🟨",
  gold: "🥇",
  mithrilore: "🔹",
  mithril: "💠",
  adamantore: "🔵",
  adamantium: "🔷",
  hides: "🟫",
  cloth: "🧵",
  blocks: "🧱",
  limestone: "🪨",
  granite: "🪨",
  marble: "🏛️",
  limeblocks: "🧱",
  graniteblocks: "🧱",
  marbleblocks: "🏛️",
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
    `<h3>Save</h3><div class="row"><button class="b" data-a="export">Export</button><button class="b" data-a="import">Import</button><button class="b" data-a="reset">New Lineage</button><button class="b" data-fb="save">Copy save</button></div>`
  );
}

export function doing(a) {
  if (!a) return "nothing";
  const n = {
    quest: () => E.findId(D.quests, a.target).name,
    train: () => sk(a.target).name,
    court: () => (E.findId(s.suitors, a.target) || {}).name,
    gather: () => E.findId(D.nodes, a.target).name,
    job: () => E.findId(D.jobs, a.target).name,
    activity: () => E.findId(D.activities, a.target).name,
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
  "porridge",
  "stew",
  "pie",
  "smokedmeat",
  "cheese",
  "butter",
  "preserves",
  "ale",
  "wine",
  "spirits",
  "wheat",
  "barley",
  "flour",
  "vegetables",
  "berries",
  "milk",
  "salt",
  "thyme",
  "sage",
  "mandrake",
  "moonpetal",
  "draught",
  "manatonic",
  "flax",
  "wood",
  "planks",
  "stone",
  "ore",
  "ingots",
  "tinore",
  "tin",
  "bronze",
  "coal",
  "steel",
  "silverore",
  "silver",
  "goldore",
  "gold",
  "mithrilore",
  "mithril",
  "adamantore",
  "adamantium",
  "cloth",
  "hides",
  "potions",
  "gems",
  "cutgems",
  "bandages",
];

// compact stat line for an item (power role, quality, enchants, set, follower effects...) + optional comparison
// with what member/minion equip holds in that slot now
// who: the member (or a bare equip map); with a member the card shows class fit, proficiency, dodge and spell failure for them
export function itemStatsHtml(x, who, cmpOn = true) {
  const m = who && who.equip ? who : null;
  const L = E.itemStats(x, m).map(l => l.t);
  const c = cmpOn && who && x.slot && x.slot !== "gift" ? E.itemCompare(who, x.id) : null;
  const cmp = c && c.dcp !== undefined && (c.cur || c.dcp) ? ` <span class="${c.dcp > 0 ? "up" : c.dcp < 0 ? "down" : "muted"}">${c.dcp > 0 ? "▲+" : c.dcp < 0 ? "▼" : "="}${c.dcp ? c.dcp : ""} CP vs ${c.cur || "empty"}</span>` : "";
  return L.length || cmp ? `<div class="istats">${L.join(" · ")}${cmp}</div>` : "";
}
export function itemRow(x, btns, equip) { // equip: member or equip map
  return `<div class="card row" style="padding:6px 8px;margin:4px 0"><span><span style="color:${QC[x.rarity] || "#ccc"}">${x.name}</span> <span class="muted">${x.slot} · ${x.value}🪙</span>${gearTags(x)}${itemStatsHtml(x, equip)}</span><span style="text-align:right">${btns}</span></div>`;
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
        ? "recipe: " + (E.findId(D.crafting.recipes, id) || {}).name
        : "a secret recipe"
      : "activity: " + ((E.findId(D.activities, id) || {}).name || id);
}

export const curList = () =>
  s.vault.filter(id => {
    const x = it(id);
    return x && (invF.type === "all" || x.slot === invF.type) && (invF.q === "all" || x.rarity === invF.q);
  });

// injury tags for member cards: current tier, lasting injuries, untreated-wounds warning
export function injuryTags(m) {
  const i = m.inj && E.injTier(m.inj.tier),
    perm = (m.perm || []).map(id => E.permDef(id)).filter(Boolean);
  const bits = [
    ...(i ? [`<span class="tb" title="${m.inj.treated ? "treated" : "untreated"}">${i.icon} ${i.name}${m.inj.treated ? "" : " (untreated)"}</span>`] : []),
    ...perm.map(p => `<span class="tb" title="${p.desc}">${p.icon} ${p.name}</span>`),
    ...(m.load > 0 ? [`<span class="tb" style="border-color:#e77">⚠️ ${E.loadWarn(m)}</span>`] : []),
  ];
  return bits.length ? `<div>${bits.join("")}</div>` : "";
}

// R31: food in the header shows days left; amber under 14 days
export function foodSpan() {
  const d = E.daysOfStock(s), low = d < 14;
  return `<span class="${low ? "foodlow" : ""}" title="Food: about ${isFinite(d) ? Math.floor(d) : "∞"} days left at today's eating">🍞 <b>${fmt(s.res.food)}</b> <small>${isFinite(d) ? Math.floor(d) + "d" : "∞"}</small></span>`;
}

// R37 ⚙ Auto chip: toggles s.autoOff[key]; locked shows what's missing (never a price)
export function autoChip(key, label, on, why) {
  if (why) return `<span class="tb muted" data-auto="${key}" title="${why}">🔒 ${label}: ${why}</span>`;
  return `<button class="b ${on ? "sel" : ""}" style="font-size:12px;padding:2px 8px" data-a="autotog" data-v="${key}" data-auto="${key}">⚙ Auto ${label} ${on ? "On" : "Off"}</button>`;
}
