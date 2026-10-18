import { findId } from "./lookup.js";
import { classIssues, moveCost, moveKind } from "./guildtiers.js";
import { apprFee, apprRep } from "./apprentice.js";
import { addRenown } from "./legacy.js";
import { structDef } from "./estate.js";
import { statVal } from "./family.js";
import { buyPrice, itemDef, vaultRoom } from "./inventory.js";
import { D, ageY, isAdult, log } from "./state.js";
import { markSecond, rep2Need, capRank } from "./guild2.js";

export const cls = m => findId(D.classes, m.cls);

export function lineBonus(m) {
  let c = cls(m);
  while (c) {
    if (c.gatherBonus) return c.gatherBonus;
    c = c.from && findId(D.classes, c.from);
  }
  return {};
}

export function chooseClass(s, mid, cid) {
  const m = findId(s.members, mid);
  m.cls = cid;
  s.pendingClass = s.pendingClass.filter(x => x !== mid);
  log(s, `🎓 ${m.name} became a ${cls(m).name}.`);
}

export const structReqOk = (s, reqs) =>
  (reqs || []).every(r => (s.structures || []).some(st => r.buildings.includes(st.type) && (st.up || 0) >= r.up));

export const structReqText = reqs =>
  (reqs || []).map(r => r.buildings.map(id => structDef(id).name).join("/") + (r.up ? " upg " + r.up : "")).join(" + ");

export function canEvolve(s, m, c) {
  if (c.retired) return false;
  if (!c.profession) return !classIssues(s, m, c).length; // R46: guild tiers
  if (c.needsBuildings && !structReqOk(s, c.needsBuildings)) return false;
  const mg = c.guild && memberGuild(m, c.guild);
  return (
    c.from === (c.profession ? m.prof : m.cls) &&
    (!c.guild || (mg && mg.rank >= c.guildRank)) &&
    (c.advRank == null || (m.adv && m.adv.rank >= c.advRank)) &&
    (c.crafterRank == null || (m.craft && m.craft.rank >= c.crafterRank)) &&
    Object.entries(c.req).every(([k, v]) => m.skills[k].lvl >= v) &&
    s.res.coin >= c.cost
  );
}

export function evolve(s, m, cid) {
  const c = findId(D.classes, cid);
  if (!canEvolve(s, m, c)) return false;
  const kind = c.profession ? "up" : moveKind(m, c);
  s.res.coin -= c.profession ? c.cost : moveCost(m, c);
  if (c.profession) m.prof = cid;
  else {
    if (m.cls && !(m.clsHist || (m.clsHist = [])).includes(m.cls)) m.clsHist.push(m.cls);
    if (kind === "side") m.sideDay = s.day;
    m.cls = cid;
  }
  log(s, `🌟 ${m.name} evolved into a ${c.name}!`);
  s.deeds.push(`${m.name} became a ${c.name}.`);
  markSecond(s, m); // R47: tier 3 opens a second guild
  return true;
}

// ---- guilds
export function classGuild(cid) {
  let c = findId(D.classes, cid);
  while (c && c.from) c = findId(D.classes, c.from);
  return (
    c &&
    (D.guilds.guilds.find(g => g.grantsClass === c.id || g.profession === c.id) ||
      (D.guilds.adventurers.grantsClass === c.id ? D.guilds.adventurers : null))
  );
}

export const guildDef = id => findId(D.guilds.guilds, id);

export const rankName = r => D.guilds.ranks[r].name;

export function memberGuild(m, gid) {
  const g = guildDef(gid);
  if (!g) return null;
  if (g.open) return m.craft && gid === "hearth" ? { id: gid, ...m.craft, _ref: m.craft } : null;
  if (m.guild2 && m.guild2.id === gid) return m.guild2; // R47 second guild
  return m.guild && m.guild.id === gid ? m.guild : null;
}

export function guildsOf(m) {
  return [m.guild, m.guild2, m.craft ? Object.assign(m.craft, { id: "hearth" }) : null].filter(Boolean);
}

export function questOk(m, q) {
  const mg = q && q.guild && memberGuild(m, q.guild);
  return !!q && (!q.adv || (m.adv && m.adv.rank >= q.adv)) && (!q.guild || (mg && mg.rank >= (q.rank || 0)));
}

export function joinIssues(s, m, gid) {
  const g = guildDef(gid),
    q = g.req,
    out = [];
  if (memberGuild(m, gid)) out.push("already a member");
  else if (!g.open && m.guild) out.push(`sworn to ${guildDef(m.guild.id).name}`);
  if (!isAdult(m)) out.push("must be an adult");
  if (ageY(m) < (D.guilds.minJoinAge || 16)) out.push("age " + (D.guilds.minJoinAge || 16) + "+");
  for (const [k, v] of Object.entries(q.stats || {})) if (statVal(m, k) < v) out.push(`${k} ${statVal(m, k)}/${v}`);
  for (const [k, v] of Object.entries(q.skills || {}))
    if (m.skills[k].lvl < v) out.push(`${findId(D.skills, k).name} ${m.skills[k].lvl}/${v}`);
  const fee = Math.round((q.coin || 0) * apprFee(m, gid)); // R35 apprenticeship reward
  if (s.res.coin < fee) out.push(`${fee} coin`);
  return out;
}

export function joinGuild(s, m, gid) {
  if (joinIssues(s, m, gid).length) return false;
  const g = guildDef(gid);
  s.res.coin -= Math.round((g.req.coin || 0) * apprFee(m, gid));
  if (g.open) {
    m.craft = { id: gid, rank: 0, rep: apprRep(m, gid) };
    if (!m.paths) m.paths = [];
  } else {
    m.guild = { id: gid, rank: 0, rep: apprRep(m, gid) };
    const cur = m.cls && findId(D.classes, m.cls);
    if (g.grantsClass && cur && !cur.tier && m.cls !== "adventurer" && m.cls !== g.grantsClass && (classGuild(m.cls) || {}).id !== gid) {
      // R46: an entry class from another guild is retrained as this guild's entry class (tiers only advance within one guild)
      if (!(m.clsHist || (m.clsHist = [])).includes(m.cls)) m.clsHist.push(m.cls);
      const was = cur.name;
      m.cls = g.grantsClass;
      log(s, `🎓 ${m.name} retrained from ${was} to ${cls(m).name} on joining the ${g.name}.`);
    } else if (g.grantsClass && (!m.cls || m.cls === "adventurer")) {
      const was = m.cls;
      m.cls = g.grantsClass;
      log(
        s,
        `🎓 ${m.name} was trained as a ${cls(m).name}${was ? " (Adventurer becomes their rank track only)" : ""}.`,
      );
    }
  }
  log(s, `${g.icon} ${m.name} joined the ${g.name} as ${rankName(0)}.`);
  s.deeds.push(`${m.name} joined the ${g.name}.`);
  return true;
}

export const mgOf = (m, gid) => (gid ? memberGuild(m, gid) : m.guild);

export const store = (m, gid) => (gid === "hearth" ? m.craft : m.guild2 && m.guild2.id === gid ? m.guild2 : m.guild);

export function nextRank(m, gid) {
  const g = mgOf(m, gid);
  return g && D.guilds.ranks[g.rank + 1];
}

export function canRankUp(s, m, gid) {
  const g = mgOf(m, gid),
    n = nextRank(m, gid);
  if (g && guildDef(g.id || gid) && guildDef(g.id || gid).pathRanks) return false; // Crafters' rank follows the main path
  if (g && g === m.guild2) return !!n && g.rank + 1 <= capRank() && g.rep >= rep2Need(n) && s.res.coin >= n.cost; // R47 second guild: capped, half rep
  return !!n && g.rep >= n.rep && s.res.coin >= n.cost;
}

export function rankUp(s, m, gid) {
  if (!canRankUp(s, m, gid)) return false;
  const n = nextRank(m, gid),
    st = store(m, gid || m.guild.id);
  s.res.coin -= n.cost;
  st.rank++;
  addRenown(s, m, 10 * st.rank);
  const gn = guildDef(gid || m.guild.id).name;
  log(s, `🎖️ ${m.name} rose to ${n.name} of the ${gn}.`);
  s.deeds.push(`${m.name} became ${n.name} of the ${gn}.`);
  return true;
}

export const guildShop = gid => D.items.filter(i => i.guild === gid);

export function buyGuildItem(s, m, itemId) {
  const it = itemDef(itemId);
  const mg = it && it.guild && memberGuild(m, it.guild);
  if (!mg || mg.rank < it.rank || s.res.coin < buyPrice(it) || !vaultRoom(s)) return false;
  s.res.coin -= buyPrice(it);
  s.vault.push(it.id);
  log(s, `🛒 Bought ${it.name} from the guild.`);
  return true;
}

// ---- Adventurers' Guild (open to everyone; separate from the one-guild lock)
export const AG = () => D.guilds.adventurers;

export const advRankName = r => AG().ranks[r].name;

export function hasService(s, svc) {
  const need = AG().ranks.findIndex(r => r.unlocks === svc);
  return (s.members || []).some(m => m.alive && m.adv && m.adv.rank >= need);
}

export function services(s) {
  return Object.keys(AG().services).filter(k => hasService(s, k));
}

export function joinAdventurers(s, m) {
  if (m.adv || !isAdult(m) || s.res.coin < AG().joinCost) return false;
  s.res.coin -= AG().joinCost;
  m.adv = { rank: 0, rep: 0 };
  if (!m.cls) {
    m.cls = "adventurer";
    log(s, `🧭 ${m.name} becomes an Adventurer (their primary class).`);
  }
  log(s, `⚔️ ${m.name} registered with the Adventurers' Guild (Rank F).`);
  return true;
}

export const advNext = m => m.adv && AG().ranks[m.adv.rank + 1];

export function canAdvRankUp(s, m) {
  const n = advNext(m);
  return !!n && m.adv.rep >= n.rep && s.res.coin >= n.cost;
}

export function advRankUp(s, m) {
  if (!canAdvRankUp(s, m)) return false;
  const n = advNext(m);
  s.res.coin -= n.cost;
  m.adv.rank++;
  addRenown(s, m, 5 * m.adv.rank);
  log(s, `⚔️ ${m.name} is now Rank ${n.name} in the Adventurers' Guild${n.unlocks ? " – unlocked " + n.unlocks : ""}.`);
  return true;
}

export const advShop = () => D.items.filter(i => i.adv);

export function buyAdvItem(s, m, id) {
  const it = itemDef(id);
  if (!it || !it.adv || !m.adv || m.adv.rank < it.adv || s.res.coin < buyPrice(it) || !vaultRoom(s)) return false;
  s.res.coin -= buyPrice(it);
  s.vault.push(id);
  log(s, `🛒 Bought ${it.name} from the Adventurers' Guild.`);
  return true;
}
