import { questInjury } from "./injuries.js";
import { tutActive } from "./tutorial.js";
import { questLineNext } from "./requests.js";
import { actLvl } from "./difficulty.js";
import { houseQuestDone, houseQuestIssue } from "./houses.js";
import { chron } from "./chronicle.js";
import { rollLoot, rollOre } from "./loot.js";
import { mapDrop } from "./specialmaps.js";
import { dungeonFloorRun, dungeonTier } from "./combat.js";
import { LG, addRenown } from "./legacy.js";
import { successChance } from "./actions.js";
import { threat } from "./endgame.js";
import { ES } from "./estate.js";
import { era, kill, level } from "./family.js";
import { cls, guildDef, guildsOf, questOk } from "./guilds.js";
import { addToVault, itemDef, recipeDef } from "./inventory.js";
import { regionOpen } from "./map.js";
import { addMinion, minionPower, mtype } from "./minions.js";
import { gainXp } from "./skills.js";
import { D, T, afford, isAdult, known, log, pay, r, rng } from "./state.js";

export function resolveQuest(s, m, q, eff) {
  // repeat fights scale with the phase; ~10% are elites (endgame.creatures)
  const th = threat(s, q.cp > 0 && !q.once && !q.story && !q.deliver && s.doneQuests.includes(q.id));
  if (th.mult !== 1) q = { ...q, cp: q.cp * th.mult };
  const ok = (q.apprentice && (!isAdult(m) || tutActive(s))) || rng() < successChance(s, m, q); // the mentor watches the apprentice
  if (!ok) {
    log(s, `❌ ${m.name} failed ${q.name}.`);
    questInjury(s, m, q, false, minionPower(s, "guard") > 0);
    return;
  }
  // resource request quests: the goods are handed over at the end (kept if they ran short meanwhile)
  if (q.deliver) {
    if (!afford(s, q.deliver)) return void log(s, `📦 ${m.name} reached ${q.name} without the goods to deliver; try again when stocked.`);
    pay(s, q.deliver);
  }
  const scale = eff >= 1 ? 1 : Math.max(eff, 0.2) * (1 / Math.max(eff, 0.2)) * eff; // eff already applied via time; loot scaled
  const gain = [];
  for (const [k, v] of Object.entries(q.reward)) {
    const n = Math.round(v * (eff >= 1 ? 1 : Math.max(eff * 2, 0.4)) * (k === "coin" ? th.coin : 1));
    s.res[k] = (s.res[k] || 0) + n;
    gain.push(`+${n} ${k}`);
  }
  gainXp(s, m, q.skill, T.xpPerDay * 2);
  const id = rollLoot(q, (cls(m) || {}).lootBonus || 0, actLvl(s, m));
  if (id) gain.push(addToVault(s, id) ? itemDef(id).name : "(vault full – loot lost)");
  const ore = rollOre(q);
  if (ore) (s.res[ore.res] = (s.res[ore.res] || 0) + ore.n), gain.push(`+${ore.n} ${ore.res}`);
  const firstOnce = (q.once || q.story) && !s.doneQuests.includes(q.id);
  addRenown(s, m, Math.ceil(q.cp / 20) + (firstOnce ? LG().renown.questFirstOnce || 0 : 0));
  m.questsDone = (m.questsDone || 0) + 1;
  const firstDone = !s.doneQuests.includes(q.id);
  if (!s.doneQuests.includes(q.id)) s.doneQuests.push(q.id);
  gain.push(...grantRewards(s, m, q));
  const mp = mapDrop(s, q, firstDone);
  if (mp) gain.push(itemDef(mp).name);
  rollRare(s, q, m);
  if (q.house || q.against) houseQuestDone(s, q);
  questLineNext(s, q);
  if (q.story) s.deeds.push(`Story ch. ${q.story}: ${q.name}.`);
  if (q.story) chron(s, "story", `📖 Chapter ${q.story}: ${m.name} completed ${q.name}.`, m.name);
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
  log(s, `✅ ${m.name} finished ${q.name}${th.elite ? " against an elite foe" : ""}: ${gain.join(", ")}`);
  questInjury(s, m, q, true);
}

export const dungeonDef = id => (D.dungeons || []).find(d => d.id === id);

// ---- quests: story / one-time / rare drops
export function questIssue(s, m, q) {
  if (!q) return "missing";
  if (!known(s, q)) return "hear a rumor or explore";
  if (q.once && s.doneQuests.includes(q.id)) return "done";
  if (!regionOpen(s, q.region)) return "region locked";
  if (!questOk(m, q)) return "guild rank";
  const hi = houseQuestIssue(s, q);
  if (hi) return hi;
  if (q.req?.land && !s.land.includes(q.req.land)) return "needs the " + (ES().lands.find(l => l.id === q.req.land) || {}).name + " deed";
  if (!q.story && q.req?.era && era(s).n < q.req.era) return "Era " + q.req.era;
  if (q.deliver && !afford(s, q.deliver)) return "deliver " + Object.entries(q.deliver).map(([k, v]) => v + " " + k).join(", ");
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
  id.startsWith("res:")
    ? id.slice(4)
    : id.startsWith("recipe:")
    ? "Recipe: " + (recipeDef(id.slice(7)) || { name: id }).name
    : (itemDef(id) || { name: id }).name;

export const dropFound = (s, id) => (s.found || []).includes(id);

export function rollRare(s, src, m) {
  for (const d of src.rare || [])
    if (rng() < d.chance * (1 + (((m && cls(m)) || {}).lootBonus || 0))) {
      if (d.id.startsWith("res:")) {
        const k = d.id.slice(4);
        s.res[k] = (s.res[k] || 0) + (d.n || 1);
      } else if (d.id.startsWith("recipe:")) {
        if (s.unlocks.includes(d.id)) continue;
        s.unlocks.push(d.id);
      } else if (!addToVault(s, d.id)) continue;
      if (!s.found.includes(d.id)) s.found.push(d.id);
      log(s, `🌟 RARE DROP from ${src.name}: ${dropName(d.id)}!`);
    }
}

export function dungeonFloor(s, m, dg, i, t = {}) {
  const f = dg.floors[i];
  if (!i || !t.th) t.th = threat(s, (s.cleared || []).includes(dg.id)); // repeat runs only: scaled, maybe elite
  if (!i && t.th.elite) log(s, `💀 An elite brood stirs in ${dg.name}.`);
  if (!dungeonFloorRun(s, m, dg, i, t)) return false;
  for (const [k, v] of Object.entries(f.reward)) s.res[k] = (s.res[k] || 0) + Math.round(v * (k === "coin" ? t.th.coin : 1));
  log(s, `🗝️ ${m.name} cleared ${dg.name}: ${f.name} (${i + 1}/${dg.floors.length}).`);
  return true;
}

export function dungeonClear(s, m, dg) {
  const first = !(s.cleared || []).includes(dg.id);
  if (first) s.cleared.push(dg.id);
  const R = LG().renown, full = R.dungeonTier[dg.deedTier || 1] || 20;
  addRenown(s, m, first ? full : Math.max(1, Math.round(full * R.dungeonRepeat)));
  if (first && dg.dragon) {
    s.deeds.push(`Slew the wyrm of ${dg.name}.`);
    log(s, `🐉 ${m.name} slew the dragon of ${dg.name}! The whole realm will remember this house.`);
  }
  // one loot roll per tier at the last floor's power; the dungeon's list are the favorites
  const lq = { cp: dg.floors[dg.floors.length - 1].cp, risk: "deadly", type: "dungeon", loot: dg.loot };
  for (let k = 0; k < dungeonTier(dg); k++) {
    const id = rollLoot(lq, (cls(m) || {}).lootBonus || 0, actLvl(s, m));
    if (id && addToVault(s, id)) log(s, `🎁 ${dg.name} treasure: ${itemDef(id).name}.`);
  }
  if (dg.onClear && dg.onClear.unlock && !s.unlocks.includes(dg.onClear.unlock)) {
    s.unlocks.push(dg.onClear.unlock);
    if (dg.onClear.text) log(s, `📜 ${dg.onClear.text}`);
  }
  rollRare(s, dg, m);
  mapDrop(s, dg, first);
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
  if (g.village && !s.village) {
    s.village = { tier: 0 };
    s.deeds.push("Founded a village by the Baron's charter.");
    out.push("village founded");
  }
  if (g.renown) {
    addRenown(s, m, g.renown);
    out.push("+" + g.renown + " renown");
  }
  return out;
}
