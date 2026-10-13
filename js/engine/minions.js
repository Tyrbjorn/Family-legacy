import { seasonYield } from "./seasons.js";
import { pickExplore } from "./actions.js";
import { ES, buildingReqMet, eff, established, hasStruct, jobCap, scaledPiece, specDef, structDef } from "./estate.js";
import { cls, guildDef, hasService, rankName, structReqOk, structReqText } from "./guilds.js";
import { CR, bestRecipe, craftItem, itemDef, recipeDef, recipeIssue, sellTick, vaultRoom } from "./inventory.js";
import { resGain } from "./legacy.js";
import { exploreArea, regionOpen } from "./map.js";
import { rollRare } from "./quests.js";
import { D, bl, known, living, log, r } from "./state.js";

// ---- minions (followers, hired help, retainers)
export const minionCap = s =>
  D.minions.baseCap + (s.structures || []).length * D.minions.capPerHouse + (hasService(s, "storage") ? 2 : 0);

// other foods (meat, fish, eggs, honey) top up the food pool when it runs short
export function pantry(s, need) {
  const fv = ES().foodValue || {};
  const fq = s.foodQ || {};
  for (const [k, v] of Object.entries(fv)) {
    if (s.res.food >= need) break;
    const have = s.res[k] || 0;
    if (have <= 0) continue;
    const val = v * (fq[k] || 1);
    const use = Math.min(have, (need - s.res.food) / val);
    s.res[k] -= use;
    s.res.food += use * val;
  }
}

export const foodTypes = s => ["food", ...Object.keys(ES().foodValue || {})].filter(k => (s.res[k] || 0) >= 1).length;

// class housing: special buildings house followers of matching NPC classes (like a Bunkhouse)
export function classHomeCap(st) {
  const d = structDef(st.type);
  if (!d.houses) return 0;
  return (
    d.houses.cap + (specDef(st) ? 2 : 0) + (d.upgrades || []).slice(0, st.up || 0).reduce((a, u) => a + (u.cap || 0), 0)
  );
}

export function homeMap(s) {
  const out = {};
  const pool = (s.minions || []).filter(x => !x.special);
  for (const st of s.structures || []) {
    const d = structDef(st.type);
    if (!d.houses) continue;
    let n = classHomeCap(st);
    for (const mi of pool)
      if (
        n > 0 &&
        !out[mi.uid] &&
        (d.houses.classes.includes(mi.cls) ||
          (specDef(st)?.houses || []).includes(mi.cls) ||
          (d.houses.jobs || []).includes(mi.job))
      ) {
        out[mi.uid] = st.uid;
        n--;
      }
  }
  return out;
}

export const classResidents = (s, st) =>
  Object.entries(homeMap(s))
    .filter(([, u]) => u === st.uid)
    .map(([id]) => s.minions.find(x => x.uid === id));

export function housingCap(s, kind) {
  if (kind === "none") return Infinity;
  if (kind === "garden") return bl(s, "garden") > 0 ? Infinity : 0;
  return (s.structures || []).reduce(
    (a, st) =>
      a +
      (((structDef(st.type).builtin || {}).housing || {})[kind] || 0) +
      st.pieces.map(id => scaledPiece(st, id)).reduce((b, p) => b + (((p && p.bonus.housing) || {})[kind] || 0), 0),
    0,
  );
}

export const housingKind = mi => (D.minions.types.find(t => t.id === (mi.type || mi.id)) || {}).housing || "bunk";

export function isHoused(s, mi) {
  const hm = homeMap(s);
  if (hm[mi.uid]) return true;
  const k = housingKind(mi);
  const same = s.minions.filter(x => housingKind(x) === k && !hm[x.uid]);
  return same.indexOf(mi) < housingCap(s, k);
}

export const housingUsed = (s, kind) => {
  const hm = homeMap(s);
  return Math.min(s.minions.filter(x => housingKind(x) === kind && !hm[x.uid]).length, housingCap(s, kind));
};

export const freeHousing = (s, kind = "bunk") => {
  const hm = homeMap(s);
  return housingCap(s, kind) - s.minions.filter(x => housingKind(x) === kind && !hm[x.uid]).length;
};

export const minionFood = s => s.minions.length * ES().minionFoodPerDay;

export const minionRoom = s => s.minions.filter(x => !x.special).length < minionCap(s) && freeHousing(s, "bunk") > 0;

export const mtype = id => D.minions.types.find(t => t.id === id);

export const MLV = () => D.minions.leveling;

export const minionLvl = mi => mi.lvl || 1;

export const minionXpNeed = lv => Math.round(MLV().xpBase * Math.pow(lv, MLV().xpGrowth));

export function minionPerks(mi, job = mi.job) {
  const p = (D.minions.perks || {})[job] || {};
  return Object.entries(p)
    .filter(([l]) => minionLvl(mi) >= +l)
    .map(([l, t]) => ({ lvl: +l, text: t }));
}

export const npcClass = id => (D.minions.npcClasses || []).find(c => c.id === id);

export const minionSkillLvl = (mi, job = mi.job) => Math.floor(Math.sqrt(((mi.skills || {})[job] || 0) / 4));

export const minionLvlMult = (mi, job = mi.job) =>
  (1 + MLV().aptPerLvl * (minionLvl(mi) - 1)) *
  (1 + minionPerks(mi, job).length * 0.1) *
  (1 + ((npcClass(mi.cls) || { bonus: {} }).bonus[job] || 0)) *
  (1 + 0.02 * minionSkillLvl(mi, job)) *
  (mi.home ? 1.15 : 1);

export const evolveOptions = mi =>
  mi.special ? [] : (D.minions.npcClasses || []).filter(c => c.from === (mi.cls || "n_peasant"));

export function minionEvolveIssue(s, mi, cid) {
  const c = npcClass(cid);
  if (!c || mi.special) return "not possible";
  if (c.from !== (mi.cls || "n_peasant")) return "wrong path";
  if (minionLvl(mi) < c.lvl) return "Lv " + c.lvl;
  const nd = c.needs;
  if (nd && nd.all && !structReqOk(s, nd.all)) return "needs " + structReqText(nd.all);
  if (
    nd &&
    nd.buildings.length &&
    !(s.structures || []).some(
      st => nd.buildings.includes(st.type) && (st.up || 0) >= nd.up && (!nd.spec || st.spec === nd.spec),
    )
  )
    return (
      "needs " +
      (nd.spec
        ? structDef(nd.buildings[0]).specs.find(x => x.id === nd.spec).name + " specialty"
        : nd.buildings.map(id => structDef(id).name).join(" or ") + (nd.up ? " (upgrade " + nd.up + ")" : ""))
    );
  return null;
}

export function evolveMinion(s, uid, cid) {
  const mi = s.minions.find(x => x.uid === uid);
  if (!mi || minionEvolveIssue(s, mi, cid)) return false;
  mi.cls = cid;
  log(s, `🌟 ${mi.name} became a ${npcClass(cid).name}.`);
  return true;
}

export function minionGainXp(s, mi, n) {
  if (!mi.job || mi.job === "idle") return;
  mi.skills = mi.skills || {};
  mi.skills[mi.job] = (mi.skills[mi.job] || 0) + n;
  mi.xp = (mi.xp || 0) + n;
  mi.lvl = mi.lvl || 1;
  while (mi.lvl < MLV().maxLvl && mi.xp >= minionXpNeed(mi.lvl)) {
    mi.xp -= minionXpNeed(mi.lvl);
    mi.lvl++;
    log(
      s,
      `⬆️ ${mi.name} reached level ${mi.lvl}${minionPerks(mi).find(p => p.lvl === mi.lvl) ? " – perk: " + minionPerks(mi).find(p => p.lvl === mi.lvl).text : ""}.`,
    );
  }
}

export function minionPower(s, job) {
  return (
    (job === "guard" ? 1 + eff(s, "guardPower") : 1) *
    (s.minions || [])
      .filter(x => x.job === job)
      .reduce((a, x) => a + (mtype(x.type).apt[job] || 1) * minionGearMult(x, job) * minionLvlMult(x, job), 0)
  );
}

export function addMinion(s, type, why) {
  if (!mtype(type).special && !minionRoom(s)) {
    log(s, `🚪 No room or no bunk for a new follower (${why}).`);
    return null;
  }
  const t = mtype(type);
  const mi = {
    uid: "mi" + s.nextId++,
    type,
    equip: {},
    name: t.special ? t.name : r(D.minions.names),
    job: "idle",
    loyalty: 100,
    since: s.day,
  };
  if (t.special) {
    mi.special = true;
    mi.source = why;
  } else mi.cls = "n_peasant";
  s.minions.push(mi);
  log(s, `🤝 ${mi.name} the ${t.name} joined (${why}).`);
  return mi;
}

export const hireable = (s, townId) => (D.minions.hireAt[townId] || []).map(mtype);

export function hire(s, townId, type) {
  const t = mtype(type);
  if (!(D.minions.hireAt[townId] || []).includes(type) || s.res.coin < t.hire || !minionRoom(s)) return null;
  s.res.coin -= t.hire;
  return addMinion(s, type, "hired in town");
}

export function jobOpen(s, jobId) {
  const j = D.minions.jobs.find(x => x.id === jobId);
  return !!j && (jobId === "idle" || (established(s) && jobCap(s, jobId) > 0));
}

export const jobUsed = (s, job, except) => s.minions.filter(x => x.job === job && x.uid !== except).length;

export function assignMinion(s, uid, job) {
  const mi = s.minions.find(x => x.uid === uid);
  if (!mi || !jobOpen(s, job) || (job !== "idle" && !isHoused(s, mi)) || jobUsed(s, job, uid) >= jobCap(s, job))
    return false;
  mi.job = job;
  return true;
}

export function dismiss(s, uid) {
  const i = s.minions.findIndex(x => x.uid === uid);
  if (i < 0) return false;
  for (const id of Object.values(s.minions[i].equip || {})) s.vault.push(id);
  log(s, `👋 ${s.minions[i].name} was dismissed.`);
  s.minions.splice(i, 1);
  return true;
}

export const monthlyWages = s => s.minions.reduce((a, x) => a + mtype(x.type).wage, 0);

// Per-job daily output: (s, mi, a = output multiplier, rg = resource gain bonus)
export const ADVENTURE_SHARE = 0.3; // balance: was 0.6 (then 0.5) of the quest reward

export const MINION_JOBS = {
  farm: (s, mi, a, rg) => {
    s.res.food += 3 * a * rg * seasonYield(s, "food") * (1 + bl(s, "farm") * 0.2);
  },
  gather: (s, mi, a, rg) => {
    s.res.wood += 2 * a * rg;
    s.res.stone += 1 * a * rg;
  },
  mine: (s, mi, a, rg) => {
    s.res.ore = (s.res.ore || 0) + 1 * a * rg;
    s.res.copperore = (s.res.copperore || 0) + 0.8 * a * rg;
    s.res.stone += 0.5 * a * rg;
  },
  scout: (s, mi, a, rg) => {
    mi.prog = (mi.prog || 0) + a;
    if (mi.prog >= 6) {
      mi.prog = 0;
      const pm = { name: mi.name + " (scout)", minion: true, skills: { tracking: { lvl: 5 } } };
      const ar = pickExplore(s, pm);
      if (ar) exploreArea(s, pm, ar);
    }
  },
  adventure: (s, mi, a, rg) => {
    // Balance/bug fix: minions no longer run guild/adventurer-rank quests (they paid out 200-coin guild
    // jobs every ~2 days), power no longer NaN-falls back, and a run takes as long as the quest does.
    const pw = 8 * (mtype(mi.type).apt.adventure || 1);
    const q = D.quests
      .filter(
        q =>
          !q.story &&
          !q.once &&
          !q.guild &&
          !q.adv &&
          known(s, q) &&
          regionOpen(s, q.region) &&
          q.risk === "safe" &&
          q.cp <= pw * 3,
      )
      .sort((a, b) => b.cp - a.cp)[0];
    mi.prog = (mi.prog || 0) + a;
    if (q && mi.prog >= (q.days || 3) + 2) {
      mi.prog = 0;
      for (const [k, v] of Object.entries(q.reward))
        s.res[k] = (s.res[k] || 0) + Math.round(v * ADVENTURE_SHARE * minionGearMult(mi, "adventure"));
      rollRare(s, q, null);
    }
  },
  hunt: (s, mi, a, rg) => {
    s.res.meat = (s.res.meat || 0) + 1.5 * a * rg;
    s.res.hides = (s.res.hides || 0) + 0.5 * a * rg;
  },
  fish: (s, mi, a, rg) => {
    s.res.fish = (s.res.fish || 0) + 2 * a * rg;
  },
  herbs: (s, mi, a, rg) => {
    s.res.herbs = (s.res.herbs || 0) + 1.5 * a * rg * seasonYield(s, "herbs");
    s.res.sage = (s.res.sage || 0) + 0.3 * a * rg * seasonYield(s, "sage");
    s.res.mandrake = (s.res.mandrake || 0) + 0.1 * a * rg * seasonYield(s, "mandrake");
    s.res.moonpetal = (s.res.moonpetal || 0) + 0.05 * a * rg * seasonYield(s, "moonpetal");
  },
  craft: (s, mi, a, rg) => {
    mi.prog = (mi.prog || 0) + 0.2 * a;
    const ord = mi.craftOrder && recipeDef(mi.craftOrder);
    const rc = ord && !recipeIssue(s, null, ord) ? ord : bestRecipe(s, null);
    if (rc && mi.prog >= rc.days) {
      mi.prog = 0;
      craftItem(s, null, rc, mi, a);
    }
  },
  merchant: (s, mi, a, rg) => {
    sellTick(s, a);
  },
};

export function minionDay(s) {
  if (!s.minions) {
    s.minions = [];
    s.repLevel = 0;
  }
  checkSpecialMinions(s);
  const fed = s.res.food >= minionFood(s);
  const hm = homeMap(s);
  const mor = eff(s, "morale");
  if (mor) for (const mi of s.minions) mi.loyalty = Math.min(100, mi.loyalty + mor);
  for (const mi of s.minions) mi.home = hm[mi.uid] || null;
  for (const mi of s.minions) {
    if (!fed) {
      mi.hunger = (mi.hunger || 0) + 1;
      mi.loyalty -= D.minions.hungerLoyaltyLoss * minionSurvival(mi);
    } else mi.hunger = 0;
    if (!isHoused(s, mi)) {
      mi.unhoused = true;
      continue;
    }
    mi.unhoused = false;
    const a =
      (mtype(mi.type).apt[mi.job] || 1) *
      (fed ? 1 : D.minions.hungryOutput) *
      minionGearMult(mi, mi.job) *
      minionLvlMult(mi);
    const rg = resGain(s);
    minionGainXp(s, mi, MLV().xpPerDay * (fed ? 1 : 0.5));
    MINION_JOBS[mi.job]?.(s, mi, a, rg);
  }
  s.res.food = Math.max(0, s.res.food - minionFood(s));
  for (const mi of [...s.minions])
    if (mi.loyalty <= 0) {
      s.minions = s.minions.filter(x => x !== mi);
      log(s, `🍽️ ${mi.name} left: ${mi.hunger ? "not enough food" : "unhappy"}.`);
    }
  minionWages(s);
  minionReputation(s);
}

function minionWages(s) {
  if (s.day % 30 === 0 && s.minions.length) {
    const w = monthlyWages(s);
    if (s.res.coin >= w) {
      s.res.coin -= w;
      for (const mi of s.minions) mi.loyalty = Math.min(100, mi.loyalty + 10);
    } else {
      s.res.coin = 0;
      for (const mi of [...s.minions]) {
        mi.loyalty -= D.minions.loyaltyLossUnpaid;
        if (mi.loyalty <= 0) {
          s.minions = s.minions.filter(x => x !== mi);
          log(s, `💸 ${mi.name} left over unpaid wages.`);
        }
      }
      log(s, "💸 Wages went unpaid; loyalty fell.");
    }
  }
}

function minionReputation(s) {
  const lvl = Math.floor(s.renown / D.minions.reputationEveryRenown);
  if (lvl > s.repLevel) {
    s.repLevel = lvl;
    if (established(s) && minionRoom(s))
      addMinion(
        s,
        r(D.minions.types.filter(t => !t.special && t.id !== "refugee" && t.id !== "tutor")).id,
        "drawn by the estate's reputation",
      );
  }
}

// ---- special minions (from classes, guild ranks, quests)
export function specialSource(s, t) {
  const src = t.source,
    L = living(s);
  if (src.class) {
    const m = L.find(x => x.cls === src.class);
    return m ? `${cls(m).name} ${m.name}` : null;
  }
  if (src.guild) {
    const m = L.find(x => x.guild && x.guild.id === src.guild && x.guild.rank >= src.rank);
    return m ? `${rankName(src.rank)} of ${guildDef(src.guild).name}` : null;
  }
  if (src.quest)
    return (s.doneQuests || []).includes(src.quest) ? `quest: ${D.quests.find(q => q.id === src.quest).name}` : null;
  if (src.buildings)
    return buildingReqMet(s, src.buildings)
      ? "drawn by your " + src.buildings.map(g => structDef(g.find(id => hasStruct(s, id))).name).join(" + ")
      : null;
  return null;
}

export function sourceLabel(t) {
  const src = t.source;
  if (src.buildings)
    return "Estate: " + src.buildings.map(g => g.map(id => structDef(id).name).join(" or ")).join(" + ");
  if (src.class) return `Class: ${D.classes.find(c => c.id === src.class).name}`;
  if (src.guild) return `${guildDef(src.guild).name} – ${rankName(src.rank)}`;
  return `Quest: ${D.quests.find(q => q.id === src.quest).name}`;
}

export function checkSpecialMinions(s) {
  for (const t of D.minions.types.filter(x => x.special)) {
    if (s.specialGranted.includes(t.id)) continue;
    const why = specialSource(s, t);
    if (why) {
      s.specialGranted.push(t.id);
      addMinion(s, t.id, why);
    }
  }
}

export function minionGearMult(mi, job) {
  const g = mi.equip || {},
    cp = sl => (itemDef(g[sl]) || {}).cp || 0;
  let m = 1 + cp("charm") / 100;
  if (job === "guard") m += (cp("weapon") + cp("armor")) / 50;
  const t = itemDef(g.tool);
  if (t && t.toolFor === job) m += t.cp / 40;
  return m;
}

export const minionSurvival = mi => 1 / (1 + ((itemDef((mi.equip || {}).armor) || {}).cp || 0) / 20);

export function equipMinion(s, uid, id) {
  const mi = s.minions.find(x => x.uid === uid);
  const it = itemDef(id);
  const i = s.vault.indexOf(id);
  if (
    !mi ||
    !it ||
    i < 0 ||
    !CR().minionSlots.includes(it.slot) ||
    (it.companion && !["kennel", "perch", "brazier"].includes(housingKind(mi)))
  )
    return false;
  mi.equip = mi.equip || {};
  s.vault.splice(i, 1);
  if (mi.equip[it.slot]) s.vault.push(mi.equip[it.slot]);
  mi.equip[it.slot] = id;
  return true;
}

export function unequipMinion(s, uid, slot) {
  const mi = s.minions.find(x => x.uid === uid);
  if (!mi || !mi.equip || !mi.equip[slot] || !vaultRoom(s)) return false;
  s.vault.push(mi.equip[slot]);
  delete mi.equip[slot];
  return true;
}
