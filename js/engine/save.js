import { backfillMilestones } from "./minionups.js";
import { migratePaths } from "./paths.js";
import { introsMigrate } from "./intros.js";
import { ensureSuitor } from "./courtship.js";
import { startTutorial } from "./tutorial.js";
import { devOn } from "./dev.js";
import { LG } from "./legacy.js";
const LG_CAP = () => Math.max(...(LG().speedTiers || [1]));
import { noteBloodline } from "./traits.js";
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
  startTutorial(_s);
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
    res: { coin: 50, food: 60, wood: 0, stone: 0, thyme: 0 },
    ration: "normal",
    morale: 0,
    diet: {},
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
    houses: {},
    weary: 0,
    renown: 0,
    deeds: [],
    acc: 0,
    pendingClass: [],
  };
  for (const b of D.buildings) s.buildings[b.id] = b.start;
  const f = newMember(s, { age: D.tuning.founderAge ?? 15 });
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

// Save migrations. Saves stay at SAVE_VERSION 1 (so FL1 codes keep working); s.schema records which
// one-time steps ran. Steps run in this exact order; `once` steps are skipped when s.schema >= their n,
// the rest are repairs that run on every load (data may have changed: new skills, removed items...).
const STEPS = [
  {
    n: 1,
    once: true,
    name: "core fields (legacy, food quality, bloodline, chronicle, achievements)",
    run: s => {
      if (!s.unlocks) s.unlocks = [];
      legacyState(s);
      if (!s.foodQ) s.foodQ = {};
      if (s.bloodline === undefined) {
        s.bloodline = null;
        for (const m of s.members || []) noteBloodline(s, m);
      }
      for (const k of ["chronicle", "wevents", "buffs"]) if (!Array.isArray(s[k])) s[k] = [];
      if (!s.ach) s.ach = {};
      if (!s.counts) s.counts = {};
      if (s.pendingEnc === undefined) s.pendingEnc = null;
      if (!s.encPolicy) s.encPolicy = "kind";
      if (!s.speed) s.speed = 1;
      if (!s.tut) s.tut = { step: 0, done: [], skipped: s.day > 0, flags: {}, tourSeen: s.day > 0, started: s.day > 0 };
    },
  },
  {
    n: 0,
    name: "speed within unlocked tiers",
    run: s => {
      if (!s.speed || (s.speed > LG_CAP() && !devOn())) s.speed = 1;
    },
  },
  {
    n: 0,
    name: "member skills, renown, craft queues",
    run: s => {
      for (const m of s.members || []) {
        if (m.renown == null) m.renown = 0;
        if (!m.craftQueue) m.craftQueue = [];
        for (const sk of D.skills) if (m.skills && !m.skills[sk.id]) m.skills[sk.id] = { lvl: 0, xp: 0 };
      }
    },
  },
  {
    n: 0,
    name: "actions point at existing activities",
    run: s => {
      for (const m of s.members || []) {
        const a = m.action;
        if (a && a.type === "train" && m.skills) {
          const t = themedFor(s, m, a.target);
          m.action = t ? { type: "activity", target: t, progress: 0 } : null;
        } else if (a && a.type === "activity" && !(D.activities || []).some(x => x.id === a.target)) m.action = null;
        if (m.order && m.order.type === "activity" && !(D.activities || []).some(x => x.id === m.order.target))
          m.order = { type: "rest" };
      }
    },
  },
  {
    n: 0,
    name: "map discovery lists, minion classes, structure upgrades",
    run: s => {
      for (const k of ["explored", "discovered", "found", "cleared"]) if (!Array.isArray(s[k])) s[k] = [];
      for (const mi of s.minions || []) {
        if (!mi.special && !mi.cls) mi.cls = "n_peasant";
      }
      for (const st of s.structures || []) if (st.up == null) st.up = 0;
    },
  },
  {
    n: 0,
    name: "minion class renames",
    run: s => {
      for (const mi of s.minions || []) {
        const mg = (D.minions.npcClassMigrate || {})[mi.cls];
        if (mg) mi.cls = mg;
      }
    },
  },
  {
    n: 0,
    name: "reserve, paused, pending class",
    run: s => {
      s.reserve = { ...DEFAULT_RESERVE, ...(s.reserve || {}) };
      if (!Array.isArray(s.paused)) s.paused = [];
      s.pendingClass = [];
    },
  },
  {
    n: 2,
    once: true, // was re-run on every load, handing classed members a free guild seat after a reload
    name: "legacy guild conversion (hearth → craft guild; pre-guild classes enroll once)",
    run: s => {
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
    },
  },
  {
    n: 0,
    name: "market and minion equipment",
    run: s => {
      if (!s.forSale) s.forSale = [];
      if (s.saleProg == null) s.saleProg = 0;
      for (const mi of s.minions || []) if (!mi.equip) mi.equip = {};
    },
  },
  {
    n: 0,
    name: "building levels for new buildings",
    run: s => {
      for (const b of D.buildings) if (s.buildings[b.id] === undefined) s.buildings[b.id] = 0;
    },
  },
  {
    n: 4,
    once: true,
    name: "estate: houses/rooms/furniture → land, structures and pieces",
    run: s => {
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
    },
  },
  {
    n: 0,
    name: "member repairs (traits, skills, guild, items)",
    run: s => {
      for (const m of s.members) {
        if (fixTraits(m))
          log(s, `🔧 ${m.name}'s conflicting traits were resolved: ${m.traits.map(t => traitDef(t).name).join(", ")}.`);
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
    },
  },
  {
    n: 5,
    once: true,
    name: "minions list",
    run: s => {
      if (!s.minions) {
        s.minions = [];
        s.repLevel = 0;
      }
    },
  },
  {
    n: 6,
    once: true,
    name: "food chains: generic herbs → thyme; ration, morale and menu",
    run: s => {
      const r = s.res || (s.res = {});
      if (r.herbs) r.thyme = (r.thyme || 0) + r.herbs;
      delete r.herbs;
      if (s.foodQ && s.foodQ.herbs) delete s.foodQ.herbs;
      if (s.reserve && "herbs" in s.reserve) {
        s.reserve.thyme = s.reserve.herbs;
        delete s.reserve.herbs;
      }
      if (!s.ration) s.ration = "normal";
      if (s.morale == null) s.morale = 0;
      if (!s.diet) s.diet = {};
    },
  },
  {
    n: 7,
    once: true,
    name: "marriage depth: suitor personalities/houses/dowries, house rapport, war weariness",
    run: s => {
      if (!s.houses) s.houses = {};
      if (s.weary == null) s.weary = 0;
      for (const su of s.suitors || []) ensureSuitor(s, su);
      for (const m of s.members || []) {
        if (m.persona === undefined) m.persona = null;
        if (m.house === undefined) m.house = null;
      }
    },
  },
  {
    n: 8,
    once: true,
    name: "four phases + unlock intros: old saves keep their phase and skip intros for systems they already have",
    run: s => {
      s.phaseSeen = null;
      introsMigrate(s); // systems this save already unlocked are marked done quietly (no spam)
    },
  },
  {
    n: 9,
    once: true,
    name: "gear sets & enchanting: enchant jobs; tiered furniture that now takes more slots is grandfathered",
    run: s => {
      if (!s.enchants) s.enchants = [];
      for (const st of s.structures || []) {
        const over = -freeSlots(s, st);
        if (over > 0) st.bonusSlots = (st.bonusSlots || 0) + over;
      }
      introsMigrate(s);
    },
  },
  {
    n: 10,
    once: true,
    name: "follower milestone upgrades: backfill earned milestones (auto, quiet), default Auto mode",
    run: s => backfillMilestones(s),
  },
  {
    n: 11,
    once: true,
    name: "craft paths: Crafter classes (m.prof) become path ranks; Couturier → Master Tailor (Leatherworker); Architect → Carpenter/Mason/Scribe + Architect combo",
    run: s => migratePaths(s),
  },
];
export const SCHEMA = Math.max(...STEPS.map(x => x.n));
export const migrationSteps = () => STEPS.map(({ n, once, name }) => ({ n, once: !!once, name }));

export function normalize(s) {
  const from = s.schema || 0;
  for (const st of STEPS) if (!(st.once && from >= st.n)) st.run(s);
  s.schema = SCHEMA;
  s._norm = true;
}
