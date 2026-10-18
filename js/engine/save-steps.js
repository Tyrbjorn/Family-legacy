import { refundV40 } from "./legacy.js";
import { migrateOrders } from "./orders.js";
import { migrateAnimals } from "./animals.js";
import { refundV37 } from "./legacy.js";
import { migrateFields } from "./fields.js";
import { talentMigrate } from "./talents.js";
import { leanMigrate } from "./apprentice.js";
import { learnDishes } from "./cooking.js";
import { DEFAULT_RESERVE } from "./production.js";
import { backfillMilestones } from "./minionups.js";
import { migratePaths, migrateJewelers, renameSpecs } from "./paths.js";
import { fogBase, fogInit, reveal } from "./world.js";
import { introsMigrate } from "./intros.js";
import { ensureSuitor } from "./courtship.js";
import { devOn } from "./dev.js";
import { LG } from "./legacy.js";
const LG_CAP = () => Math.max(...(LG().speedTiers || [1]));
import { noteBloodline } from "./traits.js";
import { legacyState } from "./legacy.js";
import { ES, freeSlots, landSlots, landUsed, migrateFurniture } from "./estate.js";
import { fixTraits, traitDef } from "./family.js";
import { classGuild, cls, guildDef } from "./guilds.js";
import { itemDef } from "./inventory.js";
import { clash, famFit, gstats, profFromSkills } from "./geartypes.js";
import { themedFor } from "./skills.js";
import { D, SAVE_VERSION, bl, log } from "./state.js";

// Save migrations. Saves stay at SAVE_VERSION 1 (so FL1 codes keep working); s.schema records which
// one-time steps ran. Steps run in this exact order; `once` steps are skipped when s.schema >= their n,
// the rest are repairs that run on every load (data may have changed: new skills, removed items...).
export const STEPS = [
  {
    n: 18,
    once: true,
    name: "(runs first, before unknown items are dropped) metals: item ids carry their metal (Steel Sword, Iron Longsword, Iron Mace, Mithril Bow, Iron Chainmail/Scalemail) in vault, gear, crafted ids, found list and unlocks",
    run: s => renameIds(s, ITEM_RENAMES),
  },
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
  {
    n: 12,
    once: true,
    name: "map round: fog of war (home, known towns, explored areas and everything already found stay charted), node stock, hauling state",
    run: s => {
      if (!D.world) return;
      fogInit(s);
      fogBase(s);
      for (const id of [...(s.revealed || []), ...(s.doneQuests || [])]) {
        const p = D.map.points[id];
        if (p) reveal(s, p.x, p.y, 60);
      }
      for (const m of s.members || []) {
        const p = m.action && m.action.target && D.map.points[m.action.target];
        if (p) reveal(s, p.x, p.y, 60);
      }
      s.locSeen = s.locSeen || [];
      s.nodeStock = s.nodeStock || {};
      s.animals = s.animals || {};
    },
  },
  {
    n: 13,
    name: "trade round: town supply, trade routes",
    run: s => {
      s.trade = s.trade || {};
      s.trade.supply = s.trade.supply || {};
      s.trade.routes = s.trade.routes || [];
      s.trade.patrols = s.trade.patrols || [];
      s.trade.nextId = s.trade.nextId || 1;
    },
  },
  {
    n: 14,
    once: true,
    name: "furniture redo: merged items replaced (Cradle/Feather Bed/Bunk → Bed, Cold Cellar → Larder, Bookshelf/Desk → Study Corner), stat bumps → slot-free fittings, trimmed building lists",
    run: s => migrateFurniture(s),
  },
  {
    n: 15,
    once: true,
    name: "thin buildings + small items slot-free: Study Corner, Shrine, Perch, Brazier, Reagent Shelf, Glyph Lectern become fittings; reshuffled building lists",
    run: s => migrateFurniture(s),
  },
  {
    n: 16,
    once: true,
    name: "thin-building items, Hall of Ancestors upgrade line, Shopfront auto-sell, day/night (no data change: gated items stay placed)",
    run: () => {},
  },
  {
    n: 17,
    once: true,
    name: "production tiers (st.tier, st.keptUps; absent = tier 1) and building data split into data/structures/*.json (no data change)",
    run: () => {},
  },
  {
    n: 19,
    once: true,
    name: "difficulty (absent = level 3), Remedist/Forest Sense renames (names only); Farmer's Brewer specialty cut: it is cleared so the member can pick again",
    run: s => {
      for (const m of s.members || [])
        for (const p of m.paths || [])
          if (p.id === "farmer" && p.spec === "brewer") Object.assign(p, { spec: null, srank: 0, sxp: 0 });
    },
  },
  {
    n: 20,
    once: true,
    name: "tiered injuries: an injury in progress becomes Wounded (treated, same days left); permanent injuries and untreated load start empty",
    run: s => {
      for (const m of s.members || []) if (m.injured > 0 && !m.inj) m.inj = { tier: 2, day: s.day || 0, treated: true, counted: true };
    },
  },
  {
    n: 21,
    once: true,
    name: "map round 2: unfed draft animals carry an unfed-day count; tutorial step re-pointed after the 2 new intro steps",
    run: s => {
      s.unfed = s.unfed || {};
      if (s.animalsFed === false) for (const id of Object.keys(s.animals || {})) s.unfed[id] = 1;
      if (s.tut && D.tutorial && s.tut.done) {
        // a new intro step counts as done when a later step is already done (no backtracking)
        const ids = D.tutorial.steps.map(x => x.id);
        for (const id of ["scout", "trade"]) if (!s.tut.done.includes(id) && [...ids.slice(ids.indexOf(id) + 1), ...(id === "trade" ? ["activity"] : [])].some(x => s.tut.done.includes(x))) s.tut.done.push(id);
        const i = ids.findIndex(id => !s.tut.done.includes(id));
        s.tut.step = i < 0 ? ids.length : i;
      }
    },
  },
  {
    n: 22,
    once: true,
    name: "heirlooms moved to DLC: refund Heirloom Smithing, drop the Ancestral Blade recipe and heirloom flags",
    run: s => {
      const L = s.legacy;
      if (L && L.ups && L.ups.heirloom) {
        L.renown = (L.renown || 0) + 120 * L.ups.heirloom;
        delete L.ups.heirloom;
        log(s, "🔁 Heirloom Smithing left the base game; its 120 Legacy Renown was refunded.");
      }
      const drop = v => v !== "recipe:r_heirloom" && v !== "r_heirloom";
      if (Array.isArray(s.unlocks)) s.unlocks = s.unlocks.filter(drop);
      for (const m of s.members || []) if (m.craft && m.craft.rc === "r_heirloom") m.craft = null;
      if (s.autoCraft) for (const k of Object.keys(s.autoCraft)) if (s.autoCraft[k] === "r_heirloom") delete s.autoCraft[k];
    },
  },
  {
    n: 23,
    once: true,
    name: "craft ladder: Bookbinder → Loremaster, Healer-brewer → Herbalist (specialty ids)",
    run: s => renameSpecs(s),
  },
  {
    n: 24,
    once: true,
    name: "Smithing Goldsmith + Gemcutter = Jeweler: old Jeweler specialists become Goldsmiths; old Grandmaster Jewelers also get Grandmaster Gemcutter (still Jewelers)",
    run: s => (renameSpecs(s), migrateJewelers(s)),
  },
  {
    n: 25,
    name: "village (Era 3): no charter = no village buildings (strays go back to the estate); village tier kept in range",
    run: s => {
      for (const st of s.structures || []) if (!s.village && st.site) delete st.site, delete st.vcost, delete st.unpaid;
      if (s.village) s.village.tier = Math.max(0, Math.min(D.estate.village.tiers.length - 1, s.village.tier | 0));
    },
  },
  {
    n: 26,
    once: true,
    name: "stone ranks: stone/blocks stay as Sandstone; Deep Quarries get a Limestone Face, Quarry Works a Granite Face",
    run: s => {
      for (const st of s.structures || [])
        if (st.type === "quarry") for (const [k, id] of [[1, "limecut"], [2, "granitecut"]]) if ((st.tier || 0) >= k && !st.pieces.includes(id)) st.pieces.unshift(id);
    },
  },
  {
    n: 27,
    name: "late game: endgame state (mount, patronage, quarries, defenses, raid timer); followers get an age (old hands 18-40, none die at once); living members keep their lifespan",
    run: s => {
      s.eg = { quarries: {}, defs: {}, funded: [], mount: 0, ...(s.eg || {}) };
      for (const mi of s.minions || []) if (!mi.special && mi.age == null) mi.age = 18 + ((mi.since || 0) % 23);
    },
  },
  {
    n: 28,
    once: true,
    name: "item types: proficiency starts from matching skills (capped by class); a two-handed weapon frees a blocked offhand (to the vault); off-class gear stays equipped at −50% with a one-time note. Item ids are unchanged (types/stats come from data).",
    run: s => {
      const off = [];
      for (const m of s.members || []) {
        if (!m.alive) continue;
        m.skills = m.skills || {};
        profFromSkills(m);
        m.equip = m.equip || {};
        if (m.equip.weapon && m.equip.offhand && clash(m.equip.weapon, m.equip.offhand)) {
          s.vault.push(m.equip.offhand);
          delete m.equip.offhand;
        }
        for (const id of Object.values(m.equip)) {
          const st = gstats(id);
          if (st && famFit(m, st.fam) === "off") off.push(`${m.name}: ${itemDef(id).name}`);
        }
      }
      if (s.day > 0 && !s.gearTypesNoted) (s.gearTypesNoted = true), log(s, "⚔️ Gear now has types: damage, speed, defense, dodge and weight. Class fit and proficiency matter" + (off.length ? ` (off-class at −50%: ${off.slice(0, 4).join(", ")}${off.length > 4 ? "…" : ""})` : "") + ".");
    },
  },
  {
    n: 29,
    once: true,
    name: "family automation: orders the player already set are pinned (Auto Orders / Courtship never override them); nothing else changes until a fa_* Legacy upgrade is bought",
    run: s => {
      for (const m of s.members || []) if (m.alive && m.order && m.order.type !== "work") (m.pins = m.pins || {}).order = true;
      // the Auto Tend "Whole Estate" buy-all bundle was removed: its tier becomes that tier of every single Auto Tend
      const U = s.legacy && s.legacy.ups, b = U && U.at_all;
      if (b) {
        for (const [id, c] of Object.entries((D.legacy.v37Refund || { costs: {} }).costs)) if (id.startsWith("at_")) U[id] = Math.max(U[id] || 0, Math.min(b, c.length)); // R37: old per-skill ids (refunded at v37)
        delete U.at_all;
      }
    },
  },
  {
    n: 30,
    once: true,
    name: "R30: map x1.5 (fog re-projected so every revealed cell stays revealed; travel days unchanged), Gear Up tutorial step removed (blade given and equipped)",
    run: s => {
      if (s.fog) {
        fogInit(s); // re-projects an old 20x18 fog string onto the new grid
        fogBase(s);
      }
      if (s.tut && D.tutorial) {
        const t = s.tut, newIds = D.tutorial.steps.map(x => x.id);
        t.done = t.done || [];
        // mid-tutorial on Gear Up = started, not skipped, gear not done and nothing later done
        if (t.started && !t.skipped && !t.done.includes("gear") && !newIds.some(id => t.done.includes(id))) {
          const m = s.members.find(x => x.id === s.activeId) || s.members[0];
          if (m && m.equip && !m.equip.weapon && (s.vault || []).includes("rusty_sword")) {
            s.vault.splice(s.vault.indexOf("rusty_sword"), 1);
            m.equip.weapon = "rusty_sword";
          }
          s.res.coin = (s.res.coin || 0) + 20; // Gear Up's old reward
          s.res.wood = (s.res.wood || 0) + 4;
          t.done.push("gear"); // kept in done so a re-run never pays twice
        }
        if (t.started) {
          const i = newIds.findIndex(id => !t.done.includes(id));
          t.step = i < 0 ? newIds.length : i;
        }
      }
    },
  },  {
    n: 31,
    once: true,
    name: "R31 tasks + villager requests (request state; tutorial Feed step credits earlier activity days)",
    run(s) {
      s.req = s.req || {};
      s.reqPerks = s.reqPerks || [];
      // R31 tutorial: food/chop/hunt/cook steps now come before rats. A save already in the prologue skips them
      // (no rewards), so a save on rats stays on rats and anyone past rats keeps their place; "Stretch Your Legs" is gone.
      const t = s.tut;
      const pristine = !(s.day > 0) && !(t && t.done && t.done.length) && !(s.doneQuests || []).length; // a brand-new game
      if (t && t.started && !pristine) {
        const ids = D.tutorial.steps.map(x => x.id);
        for (const id of ["food", "chop", "hunt", "cook"]) if (ids.includes(id) && !t.done.includes(id)) t.done.push(id);
        if (!t.skipped) {
          const i = ids.findIndex(id => !t.done.includes(id));
          t.step = i < 0 ? ids.length : i;
        }
      }
    },
  },
  {
    n: 32,
    once: true,
    name: "R31.3 fishing spots: spot choice (Auto) and an empty species record; fish already in store count as Creek Fish",
    run(s) {
      s.fishSpot = s.fishSpot || "auto";
      s.fishBag = s.fishBag || {};
    },
  },
  {
    n: 33,
    once: true,
    name: "R33 fish dishes: learned-dish list (starting dishes plus anything already earned: Anne's 3rd request, Gull's Landing, trout/sturgeon caught, quest done), luxury fish off",
    run(s) {
      s.dishes = s.dishes || [];
      s.cookLuxury = !!s.cookLuxury;
      if (s.diet) for (const k of ["butter", "flour", "milk"]) delete s.diet[k]; // cooking-only now
      learnDishes(s, true);
    },
  },
  {
    n: 34,
    once: true,
    name: "R34 quotas (Steward's Ledger): empty quota list",
    run(s) {
      s.quotas = s.quotas || [];
      s.quotaSeq = s.quotaSeq || 0;
    },
  },
  {
    n: 35,
    once: true,
    name: "R35 leans + apprenticeships + inheritance: lean for every living member, no placements, inherited skill boosts for kids (no retroactive stat change)",
    run(s) {
      leanMigrate(s);
    },
  },
  {
    n: 36,
    once: true,
    name: "R36 talents: empty talents for all, class/guild talents from current class line and ranks, head gets quest talents from doneQuests; no shrines",
    run(s) {
      talentMigrate(s);
    },
  },
  {
    n: 37,
    once: true,
    name: "R37 free automation: full refund of renown spent on Auto Tend / Family Auto / Steward's Ledger to banked renown; old upgrade keys cleared; Matchmaker off unless it was bought; quotas beyond 2 slots pause",
    run(s) {
      refundV37(s);
    },
  },
  {
    n: 38,
    once: true,
    name: "R40 per-crop fields: old Farm/Garden plain food becomes a Kitchen Plot (>= 90% of the old food), Farm 3+ adds a Wheat Field, old Crop Fields become one field per crop; Farm/Garden kept for follower spots and storage",
    run(s) {
      migrateFields(s);
    },
  },
  {
    n: 39,
    once: true,
    name: "R41 simple coop & cow pen: old buildings keep the animals they have; new ones start empty (buy hens/cows)",
    run(s) {
      migrateAnimals(s);
    },
  },
  {
    n: 40,
    once: true,
    name: "R43 full auto + Work Orders: Steward's Ledger -> Workshop Quotas, Tireless Hands -> Gather & Refine Rate (renown above the new price refunded); per-person craft queues become Work Orders; quotas kept",
    run(s) {
      refundV40(s);
      migrateOrders(s);
    },
  },
  {
    n: 41,
    once: true,
    name: "R45 town quest boards + quest lines: old saves start with fresh boards (rolled on the next day), no lines in progress and no town favour",
    run(s) {
      s.boards = s.boards || { towns: {}, seq: 0 };
      s.lines = s.lines || {};
      s.townFav = s.townFav || {};
    },
  },
];
const ITEM_RENAMES = {
  steel_blade: "steel_sword",
  bastard_sword: "iron_longsword",
  sunsteel_mace: "iron_mace",
  moonsilver_bow: "mithril_bow",
  chain_shirt: "iron_chainmail",
  scale_mail: "iron_scalemail",
  r_bastard_sword: "r_iron_longsword",
  r_sunsteel_mace: "r_iron_mace",
};
// rename id tokens anywhere in the save, including inside "c|base|q", "base#ench" and "recipe:id" strings and object keys
const renTok = (v, map) => (typeof v === "string" ? v.split(/([|#:])/).map(t => map[t] || t).join("") : v);
export function renameIds(o, map) {
  if (Array.isArray(o)) return o.forEach((v, i) => (typeof v === "object" && v ? renameIds(v, map) : (o[i] = renTok(v, map))));
  for (const k of Object.keys(o || {})) {
    const v = o[k],
      nk = renTok(k, map);
    if (typeof v === "object" && v) renameIds(v, map);
    else o[k] = renTok(v, map);
    if (nk !== k) (o[nk] = o[k]), delete o[k];
  }
}
