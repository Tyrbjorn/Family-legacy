import { legacyState } from "./legacy.js";
import { DEFAULT_RESERVE, ES, freeSlots, landSlots, landUsed } from "./estate.js";
import { fixTraits, newMember, traitDef } from "./family.js";
import { classGuild, cls, guildDef } from "./guilds.js";
import { itemDef } from "./inventory.js";
import { themedFor } from "./skills.js";
import { D, SAVE_VERSION, bl, log } from "./state.js";

export function newGame(now = Date.now()) {
  const _s = _newGame(now);
  _s.land = [];
  _s.structures = [];
  _s.pieceStore = [];
  normalize(_s);
  return _s;
}

export function _newGame(now) {
  const s = {
    v: SAVE_VERSION,
    day: 0,
    nextId: 1,
    members: [],
    activeId: 1,
    head: 1,
    res: { coin: 50, food: 60, wood: 0, stone: 0, herbs: 0 },
    revealed: [],
    buildings: {},
    furniture: [],
    vault: ["rusty_sword", "padded_vest"],
    log: [],
    turbo: { charge: 0, on: false },
    lastSave: now,
    cleared: [],
    explored: [],
    discovered: [],
    found: [],
    reserve: { ...DEFAULT_RESERVE },
    paused: [],
    forSale: [],
    saleProg: 0,
    unlocks: [],
    doneQuests: [],
    specialGranted: [],
    minions: [],
    repLevel: 0,
    gameOver: false,
    suitors: [],
    renown: 0,
    deeds: [],
    acc: 0,
    pendingClass: [],
  };
  for (const b of D.buildings) s.buildings[b.id] = b.start;
  const f = newMember(s, { age: 15 });
  s.members.push(f);
  f.action = { type: "activity", target: "hiking", progress: 0 };
  log(s, `🏡 ${f.name} founds the family estate.`);
  return s;
}

export function serialize(s, now = Date.now()) {
  s.lastSave = now;
  return JSON.stringify(s);
}

export function deserialize(str) {
  const s = JSON.parse(str);
  if (!s || s.v !== SAVE_VERSION) throw new Error("bad save version");
  return s;
}

export function normalize(s) {
  if (!s.unlocks) s.unlocks = [];
  legacyState(s);
  if (!s.speed) s.speed = 1;
  for (const m of s.members || []) {
    if (m.renown == null) m.renown = 0;
    if (!m.craftQueue) m.craftQueue = [];
    for (const sk of D.skills) if (m.skills && !m.skills[sk.id]) m.skills[sk.id] = { lvl: 0, xp: 0 };
  }
  for (const m of s.members || []) {
    const a = m.action;
    if (a && a.type === "train" && m.skills) {
      const t = themedFor(s, m, a.target);
      m.action = t ? { type: "activity", target: t, progress: 0 } : null;
    } else if (a && a.type === "activity" && !(D.activities || []).some(x => x.id === a.target))
      m.action = null;
    if (m.order && m.order.type === "activity" && !(D.activities || []).some(x => x.id === m.order.target))
      m.order = { type: "rest" };
  }
  for (const k of ["explored", "discovered", "found", "cleared"]) if (!Array.isArray(s[k])) s[k] = [];
  for (const mi of s.minions || []) {
    if (!mi.special && !mi.cls) mi.cls = "n_peasant";
    const mg = (D.minions.npcClassMigrate || {})[mi.cls];
    if (mg) mi.cls = mg;
  }
  for (const st of s.structures || []) if (st.up == null) st.up = 0;
  s.reserve = { ...DEFAULT_RESERVE, ...(s.reserve || {}) };
  if (!Array.isArray(s.paused)) s.paused = [];
  s.pendingClass = [];
  for (const m of s.members) {
    if (m.guild && m.guild.id === "hearth") {
      m.craft = { id: "hearth", rank: m.guild.rank, rep: m.guild.rep };
      m.guild = null;
      if (!m.prof) m.prof = "artisan";
      delete m.title;
    }
    if (m.cls && !m.guild && (D.classes.find(c => c.id === m.cls) || {}).line === "adventurer") {
      if (!m.adv) m.adv = { rank: 0, rep: 0 };
    } else if (m.cls && !m.guild) {
      const g = classGuild(m.cls);
      if (g) {
        m.guild = { id: g.id, rank: 0, rep: 0 };
        log(s, `📜 ${m.name} (${cls(m).name}) was enrolled in the ${g.name}.`);
      }
    }
  }
  if (!s.forSale) s.forSale = [];
  if (s.saleProg == null) s.saleProg = 0;
  for (const mi of s.minions || []) if (!mi.equip) mi.equip = {};
  for (const b of D.buildings) if (s.buildings[b.id] === undefined) s.buildings[b.id] = 0;
  if (!s.land) s.land = [];
  if (!s.structures) {
    s.structures = [];
    s.pieceStore = []; // migrate house/room/furniture saves
    const hlv = s.buildings.house || 0,
      oldRooms = s.rooms || [],
      oldF = s.furniture || [];
    const any = hlv > 0 || D.buildings.some(b => bl(s, b.id) > 0);
    if (any && !s.land.length) s.land.push("plot");
    if (hlv > 0) {
      const st = {
        uid: "st" + s.nextId++,
        type: hlv >= 3 ? "house" : hlv === 2 ? "cabin" : "shack",
        pieces: [],
      };
      s.structures.push(st);
      const map = {
        living: "bunk",
        workshop: "workbench",
        post: "toolrack",
        study: "studydesk",
        nursery: "cradle",
        shrine: "shrine",
      };
      let want = oldRooms.length ? oldRooms.map(r => map[r]).filter(Boolean) : ["bunk", "workbench"];
      if (!want.includes("bunk")) want.unshift("bunk");
      if (s.minions && s.minions.length) want.push("minionbunk");
      want = [...want, ...oldF];
      for (const pid of want) {
        if (freeSlots(s, st) > 0 && !st.pieces.includes(pid)) st.pieces.push(pid);
        else s.pieceStore.push(pid);
      }
    } else s.pieceStore.push(...oldF);
    for (const l of ES().lands) {
      if (landSlots(s) >= landUsed(s)) break;
      if (!s.land.includes(l.id)) s.land.push(l.id);
    }
    delete s.buildings.house;
    delete s.rooms;
    s.furniture = [];
    if (any)
      log(
        s,
        `📜 Estate converted to buildings & stations: ${s.structures.length} building(s), ${s.pieceStore.length} piece(s) in storage.`,
      );
  }
  if (!s.doneQuests) s.doneQuests = [];
  if (!s.specialGranted) s.specialGranted = [];
  for (const m of s.members) {
    if (fixTraits(m))
      log(
        s,
        `🔧 ${m.name}'s conflicting traits were resolved: ${m.traits.map(t => traitDef(t).name).join(", ")}.`,
      );
    for (const sk of D.skills) if (!m.skills[sk.id]) m.skills[sk.id] = { lvl: 0, xp: 0 };
    if (m.guild === undefined) m.guild = null;
    if (m.guild && !guildDef(m.guild.id)) m.guild = null;
    const okI = id => !!itemDef(id);
    m.bag = (m.bag || []).filter(okI);
    for (const k in m.equip) if (!okI(m.equip[k])) delete m.equip[k];
    if (m.adv === undefined) m.adv = null;
    if (!m.bag) m.bag = [];
  }
  s.vault = s.vault.filter(id => !!itemDef(id));
  if (!s.minions) {
    s.minions = [];
    s.repLevel = 0;
  }
  s._norm = true;
}
