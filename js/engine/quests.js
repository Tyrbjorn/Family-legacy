import { addRenown } from "./legacy.js";
import { successChance } from "./actions.js";
import { ES } from "./estate.js";
import { era, kill, level } from "./family.js";
import { cls, guildDef, guildsOf, questOk } from "./guilds.js";
import { addToVault, itemDef, recipeDef } from "./inventory.js";
import { regionOpen } from "./map.js";
import { addMinion, minionPower, mtype } from "./minions.js";
import { gainXp } from "./skills.js";
import { D, T, isAdult, known, log, r, rng } from "./state.js";

export function resolveQuest(s, m, q, eff) {
  const ok = rng() < successChance(s, m, q);
  if (!ok) {
    log(s, `❌ ${m.name} failed ${q.name}.`);
    if (q.risk !== "safe") {
      m.injured = minionPower(s, "guard") > 0 ? 3 : 5;
      log(s, `🤕 ${m.name} was injured and rests.`);
    }
    if (q.risk === "deadly" && rng() < T.deadlyDeathChance * 4) {
      kill(s, m, `fell during ${q.name}`);
    }
    return;
  }
  const scale = eff >= 1 ? 1 : Math.max(eff, 0.2) * (1 / Math.max(eff, 0.2)) * eff; // eff already applied via time; loot scaled
  const gain = [];
  for (const [k, v] of Object.entries(q.reward)) {
    const n = Math.round(v * (eff >= 1 ? 1 : Math.max(eff * 2, 0.4)));
    s.res[k] = (s.res[k] || 0) + n;
    gain.push(`+${n} ${k}`);
  }
  gainXp(s, m, q.skill, T.xpPerDay * 2);
  if (q.loot.length && rng() < 0.35 + ((cls(m) || {}).lootBonus || 0)) {
    const id = r(q.loot);
    if (addToVault(s, id)) gain.push(itemDef(id).name);
    else gain.push("(vault full – loot lost)");
  }
  addRenown(s, m, Math.ceil(q.cp / 20));
  m.questsDone = (m.questsDone || 0) + 1;
  if (!s.doneQuests.includes(q.id)) s.doneQuests.push(q.id);
  gain.push(...grantRewards(s, m, q));
  rollRare(s, q, m);
  if (q.story) s.deeds.push(`Story ch. ${q.story}: ${q.name}.`);
  if (q.unlocks && !s.unlocks.includes(q.unlocks)) {
    s.unlocks.push(q.unlocks);
    const [k, id] = q.unlocks.split(":");
    log(
      s,
      `🔓 ${q.name} unlocked ${k === "skill" ? "training: " + D.skills.find(x => x.id === id).name : k === "recipe" ? "recipe: " + recipeDef(id).name : "activity: " + D.activities.find(x => x.id === id).name}!`,
    );
  }
  if (m.adv) m.adv.rep += Math.ceil(q.cp / 10) + 1;
  for (const mg of guildsOf(m)) {
    const g = guildDef(mg.id);
    if (q.guild === g.id) mg.rep += D.guilds.repPerGuildQuest;
    else if (g.skills.includes(q.skill)) mg.rep += D.guilds.repPerQuestSkill;
  }
  const rc = D.minions.rescueQuests[q.id];
  if (rc && rng() < rc) addMinion(s, "refugee", `rescued on ${q.name}`);
  log(s, `✅ ${m.name} finished ${q.name}: ${gain.join(", ")}`);
  if (q.risk === "deadly" && rng() < T.deadlyDeathChance) kill(s, m, `was slain on ${q.name}`);
}

export const dungeonDef = id => (D.dungeons || []).find(d => d.id === id);

// ---- quests: story / one-time / rare drops
export function questIssue(s, m, q) {
  if (!q) return "missing";
  if (!known(s, q)) return "hear a rumor or explore";
  if (q.once && s.doneQuests.includes(q.id)) return "done";
  if (!regionOpen(s, q.region)) return "region locked";
  if (!questOk(m, q)) return "guild rank";
  if (q.story) {
    const prev = D.quests.find(x => x.story === q.story - 1);
    if (prev && !s.doneQuests.includes(prev.id)) return "finish chapter " + (q.story - 1);
    if (q.req?.lvl && level(m) < q.req.lvl) return "Lv " + q.req.lvl;
    if (q.req?.era && era(s).n < q.req.era) return "Era " + q.req.era;
  }
  return null;
}

export const storyQuests = () => D.quests.filter(q => q.story).sort((a, b) => a.story - b.story);

export const storyProgress = s => storyQuests().filter(q => s.doneQuests.includes(q.id)).length;

export const dropName = id =>
  id.startsWith("recipe:")
    ? "Recipe: " + (recipeDef(id.slice(7)) || { name: id }).name
    : (itemDef(id) || { name: id }).name;

export const dropFound = (s, id) => (s.found || []).includes(id);

export function rollRare(s, src, m) {
  for (const d of src.rare || [])
    if (rng() < d.chance * (1 + (((m && cls(m)) || {}).lootBonus || 0))) {
      if (d.id.startsWith("recipe:")) {
        if (s.unlocks.includes(d.id)) continue;
        s.unlocks.push(d.id);
      } else if (!addToVault(s, d.id)) continue;
      if (!s.found.includes(d.id)) s.found.push(d.id);
      log(s, `🌟 RARE DROP from ${src.name}: ${dropName(d.id)}!`);
    }
}

export function dungeonFloor(s, m, dg, i) {
  const f = dg.floors[i],
    ok = rng() < successChance(s, m, { cp: f.cp });
  if (!ok) {
    m.injured = 3;
    log(s, `❌ ${m.name} was driven out of ${dg.name} at ${f.name} (floor ${i + 1}/${dg.floors.length}).`);
    return false;
  }
  for (const [k, v] of Object.entries(f.reward)) s.res[k] = (s.res[k] || 0) + v;
  log(s, `🗝️ ${m.name} cleared ${dg.name}: ${f.name} (${i + 1}/${dg.floors.length}).`);
  return true;
}

export function dungeonClear(s, m, dg) {
  const first = !(s.cleared || []).includes(dg.id);
  if (first) s.cleared.push(dg.id);
  addRenown(s, m, first ? 15 : 4);
  if (dg.loot.length && rng() < 0.6 && addToVault(s, r(dg.loot))) log(s, `🎁 ${dg.name} treasure claimed.`);
  rollRare(s, dg, m);
  if (m.adv) m.adv.rep += 8;
  log(s, `🏆 ${m.name} conquered ${dg.name}${first ? " for the first time" : ""}!`);
}

export const dungeonIssue = (s, m, dg) =>
  !dg
    ? "missing"
    : !known(s, dg)
      ? "undiscovered"
      : !isAdult(m)
        ? "adults only"
        : !regionOpen(s, dg.region)
          ? "region locked"
          : null;

export function grantRewards(s, m, q) {
  const g = q.grants || {};
  const out = [];
  if (g.item) {
    if (addToVault(s, g.item)) {
      out.push(itemDef(g.item).name);
      if (!s.found.includes(g.item)) s.found.push(g.item);
    }
  }
  if (g.minion) {
    if (addMinion(s, g.minion, `joined after ${q.name}`)) out.push(mtype(g.minion).name + " joins");
  }
  if (g.land) {
    if (!s.land.includes(g.land)) {
      s.land.push(g.land);
      out.push("deed: " + ES().lands.find(l => l.id === g.land).name);
    } else {
      const c = ES().lands.find(l => l.id === g.land).cost.coin;
      s.res.coin += c;
      out.push(c + " coin (deed already held)");
    }
  }
  if (g.renown) {
    addRenown(s, m, g.renown);
    out.push("+" + g.renown + " renown");
  }
  return out;
}
