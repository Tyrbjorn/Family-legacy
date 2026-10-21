import { findId } from "./lookup.js";
// Crafting paths for family members (data/paths.json). Followers keep their NPC classes.
// A member has m.paths = [{ id, xp, rank, spec, sxp, srank }]; paths[0] is the main path.
import { D, isAdult, living, log, xpNeed } from "./state.js";

const PD = () => D.paths;
const allDefs = () => (PD() ? [...PD().paths, ...(PD().comboPaths || []).map(c => ({ ...c, advanced: true }))] : []);
export const pathDefs = () => cached();
let _inLine = null;
export const setPathInLine = f => (_inLine = f);
let _pd = null, _pdSrc = null;
const cached = () => (_pdSrc === PD() ? _pd : ((_pdSrc = PD()), (_pd = allDefs())));
export const pathDef = id => cached().find(p => p.id === id);
export const pathRanks = () => PD().ranks;
export const pathRankName = r => (PD().ranks[r] || PD().ranks[0]).name;
export const pathSpecDef = (pid, sid) => ((pathDef(pid) || {}).specs || []).find(x => x.id === sid);
// ladder stage 3: a specialty at spec rank artisanAt with an `artisan` block takes the artisan title and fx ×artisanMult
export const isArtisan = e => {
  const sp = e && e.spec && pathSpecDef(e.id, e.spec);
  return !!(sp && sp.artisan && e.srank >= (PD().artisanAt ?? 3));
};
export const specName = e => {
  const sp = e && e.spec && pathSpecDef(e.id, e.spec);
  const g = mergedTitle(e);
  return g ? g.name : sp ? (isArtisan(e) ? sp.artisan.name : sp.name) + (e.spec2 ? " + " + pathSpecDef(e.id, e.spec2).name : "") : "";
};
// merged title (path.merges, e.g. Goldsmith + Gemcutter = Jeweler): Grandmaster in a merge specialty opens the other as spec2
const top = () => PD().artisanAt ?? 3;
const mergeOf = e => e && e.spec && ((pathDef(e.id) || {}).merges || []).find(x => x.specs.includes(e.spec));
export const mergedTitle = e => {
  const g = mergeOf(e);
  return g && e.spec2 && e.srank >= top() && e.s2rank >= top() ? g : null;
};
export const spec2Choices = (m, pid) => {
  const e = pathOf(m, pid),
    g = mergeOf(e);
  return g && !e.spec2 && e.srank >= top() ? g.specs.filter(x => x !== e.spec).map(x => pathSpecDef(pid, x)) : [];
};
export function chooseSpec2(s, m, pid, sid) {
  if (!spec2Choices(m, pid).some(x => x.id === sid)) return false;
  Object.assign(pathOf(m, pid), { spec2: sid, s2xp: 0, s2rank: 0 });
  log(s, `🔨 ${m.name} took up ${pathSpecDef(pid, sid).name} as a second specialty.`);
  return true;
}
const specMult = e => (isArtisan(e) || mergedTitle(e) ? PD().artisanMult || 1 : 1);
// [spec def, spec rank] pairs of a path entry (spec and spec2)
const specsOf = e => [[e.spec && pathSpecDef(e.id, e.spec), e.srank], [e.spec2 && pathSpecDef(e.id, e.spec2), e.s2rank]].filter(x => x[0]);
export const memberPaths = m => (m && m.paths) || [];
export const pathOf = (m, id) => memberPaths(m).find(e => e.id === id);
export const mainPath = m => (SL() ? memberPaths(m).find(e => pathSlotOf(m, e) === "main") || memberPaths(m)[0] : memberPaths(m)[0]) || null; // R46: the main slot

// ---- R46 crafter slots (paths.json slots): 1 main + 1 secondary crafting, 2 gathering, the rest dabbled
const SL = () => (PD() || {}).slots || null;
export const SLOT_IDS = ["main", "second", "gather", "dabble"];
export const pathKind = id => (pathDef(id) || {}).kind || "crafting";
export const slotDef = id => (SL() || {})[id] || {};
export const slotName = id => slotDef(id).name || id;
export const slotCapOf = id => (id === "main" && (SL() || {}).expansionTiers ? slotDef(id).capExpansion ?? slotDef(id).cap : slotDef(id).cap) ?? 0;
const basic = m => memberPaths(m).filter(e => !(pathDef(e.id) || {}).advanced);
const slotFits = (id, e) => id === "dabble" || slotDef(id).kind === pathKind(e.id);
// give every basic path a slot: keep valid ones, then fill main → secondary → gathering in path order; the rest dabble
// Until the person picks slots themselves (m.slotChosen), the highest-ranked crafting trade is main and the next highest
// secondary (ties keep the current main, then path order), so nobody loses rank or bonuses.
export function assignSlots(m, order) {
  if (!SL()) return;
  const left = { main: slotDef("main").n || 1, second: slotDef("second").n || 1, gather: slotDef("gather").n || 2 };
  if (!m.slotChosen) {
    const P = basic(m), cur = P.find(e => e.slot === "main");
    for (const e of P) delete e.slot;
    order = [...P].sort((a, b) => b.rank - a.rank || (b === cur) - (a === cur) || P.indexOf(a) - P.indexOf(b));
  }
  const B = order || basic(m);
  for (const e of B) if (e.slot && e.slot !== "dabble" && slotFits(e.slot, e) && left[e.slot] > 0) left[e.slot]--; else delete e.slot;
  for (const e of B) {
    if (e.slot) continue;
    e.slot = ["main", "second", "gather"].find(k => left[k] > 0 && slotFits(k, e)) || "dabble";
    if (left[e.slot] > 0) left[e.slot]--;
  }
}
// the slot a newly opened path would take (dabble when its kind's slots are full)
export function nextSlotFor(m, id) {
  if (!SL()) return "main";
  const used = k => basic(m).filter(e => e.slot === k).length;
  const kind = pathKind(id);
  return ["main", "second", "gather"].find(k => slotDef(k).kind === kind && used(k) < (slotDef(k).n || 1)) || "dabble";
}
export const pathSlotOf = (m, e) => {
  if (e && (pathDef(e.id) || {}).advanced) return "combo";
  if (e && !e.slot && m && SL() && memberPaths(m).includes(e)) assignSlots(m); // lazy: paths set without slots
  return (e && e.slot) || "dabble";
};
export const slotPath = (m, id) => basic(m).find(e => e.slot === id) || null;

// highest rank a path may hold (rank index): combos uncapped; otherwise its slot's cap. Older saves without slots: main uncapped, secondaries one below.
export function pathCap(m, e) {
  const top = PD().ranks.length - 1;
  if (e && pathDef(e.id) && pathDef(e.id).advanced) return top;
  if (!SL()) { const mp = mainPath(m); return !mp || e === mp ? top : Math.max(0, Math.min(top, mp.rank - (PD().secondaryGap || 1))); }
  const sl = pathSlotOf(m, e), d = slotDef(sl);
  let cap = sl === "main" && SL().expansionTiers ? d.capExpansion ?? d.cap : d.cap ?? 0;
  if (d.belowMain) { const mp = slotPath(m, "main"); cap = Math.min(cap, mp ? effRank(m, mp) - d.belowMain : 0); }
  return Math.max(0, Math.min(top, cap));
}
// the rank whose bonuses count: grandfathered ranks above a cap count at the cap
export const effRank = (m, e) => Math.min(e.rank, pathCap(m, e));
export const pathSlots = m => (SL() ? Infinity : Math.min(PD().maxPaths, 1 + basic(m).reduce((a, e) => a + e.rank + (e.spec ? e.srank : 0), 0)));
export const slotSwitchIssue = (s, m, pid, to) => {
  const e = pathOf(m, pid);
  if (!e || (pathDef(pid) || {}).advanced) return "not a craft path";
  if (!SLOT_IDS.includes(to) || e.slot === to) return "same slot";
  if (!slotFits(to, e)) return `${slotName(to)} takes ${slotDef(to).kind} trades`;
  if (m.slotDay != null && s.day - m.slotDay < (SL().switchDays || 360)) return "switch once a year";
  return null;
};
// move a path into a slot (once a year, free); a full slot sends its path back to the mover's old slot (or dabbling)
export function setPathSlot(s, m, pid, to) {
  if (slotSwitchIssue(s, m, pid, to)) return false;
  const e = pathOf(m, pid), from = e.slot || "dabble";
  const full = to !== "dabble" && basic(m).filter(x => x.slot === to).length >= (slotDef(to).n || 1);
  if (full) { const out = basic(m).find(x => x.slot === to); out.slot = slotFits(from, out) ? from : "dabble"; }
  e.slot = to;
  m.slotDay = s.day;
  m.slotChosen = true; // from now on the player's own slot choice holds
  log(s, `🔨 ${m.name}: ${pathDef(pid).name} is now their ${slotName(to).toLowerCase()} trade.`);
  refreshPaths(s, m);
  return true;
}
// advanced paths (e.g. Architect): requirement list with have/need for the locked view
export const advancedReqs = (m, id) =>
  (pathDef(id).requires || []).map(q => {
    const e = q.path && pathOf(m, q.path);
    if (q.classLine) {
      const c = findId(D.classes, q.classLine) || { name: q.classLine };
      return { text: q.name || `${c.name}-line class`, ok: !!_inLine && _inLine(m, q.classLine) };
    }
    if (q.skill) {
      const lvl = (m.skills[q.skill] || { lvl: 0 }).lvl;
      return { text: `${(findId(D.skills, q.skill) || { name: q.skill }).name} ${q.skill && lvl}/${q.lvl}`, ok: lvl >= q.lvl };
    }
    if (q.spec) return { text: `${pathSpecDef(q.path, q.spec).name} (${pathDef(q.path).name} specialty)`, ok: !!e && e.spec === q.spec };
    return { text: `${pathRankName(q.rank)} ${pathDef(q.path).name}${e ? ` (now ${pathRankName(e.rank)})` : ""}`, ok: !!e && e.rank >= q.rank };
  });

const rankFor = (xp, lvl) => {
  let r = 0;
  PD().ranks.forEach((k, i) => {
    if (xp >= k.xp && lvl >= k.skill) r = i;
  });
  return r;
};
const bestLvl = (m, p) => Math.max(0, ...p.skills.map(k => (m.skills[k] || { lvl: 0 }).lvl));

// next-rank progress 0..1 (xp and skill gates both count) for the UI bars
export function pathProgress(m, e, spec = false) {
  const r = spec ? e.srank : e.rank,
    nx = PD().ranks[r + 1];
  if (!nx) return { pct: 1, next: null };
  const cur = PD().ranks[r],
    xp = spec ? e.sxp : e.xp,
    lvl = bestLvl(m, pathDef(e.id));
  const a = Math.min(1, (xp - cur.xp) / Math.max(1, nx.xp - cur.xp)),
    b = Math.min(1, lvl / Math.max(1, nx.skill));
  const capped = spec ? r >= e.rank : r >= pathCap(m, e);
  return { pct: Math.max(0, Math.min(a, b)), next: nx, capped, xp, lvl };
}

export function refreshPaths(s, m) {
  for (const e of memberPaths(m)) {
    const p = pathDef(e.id);
    if (!p) continue;
    const lvl = bestLvl(m, p);
    const r = Math.min(pathCap(m, e), rankFor(e.xp, lvl));
    if (r > e.rank) {
      e.rank = r;
      log(s, `🔨 ${m.name} is now a ${pathRankName(r)} ${p.name}${SL() ? (e.slot && e.slot !== "main" ? " (" + slotName(e.slot).toLowerCase() + ")" : "") : e === mainPath(m) ? "" : " (secondary)"}.`);
      s.deeds && s.deeds.push(`${m.name} became a ${pathRankName(r)} ${p.name}.`);
      if (r >= PD().specAt && !e.spec) log(s, `🔨 ${m.name} can choose a ${p.name} specialty.`);
      masterGuildCheck(s, m, e);
      if (!SL() && basic(m).length < pathSlots(m) && pathDefs().some(x => !x.advanced && !pathOf(m, x.id)))
        log(s, `🔨 ${m.name} can open another craft path.`);
      for (const x of pathDefs().filter(x => x.advanced && !pathOf(m, x.id)))
        if (!openPathIssue(s, m, x.id) && !(m._advNote || []).includes(x.id)) {
          (m._advNote = m._advNote || []).push(x.id);
          log(s, `🔨 ${m.name} qualifies for the ${x.name} path.`);
        }
    }
    if (e.spec) {
      const sr = Math.min(e.rank, rankFor(e.sxp, lvl));
      if (sr > e.srank) {
        e.srank = sr;
        log(s, isArtisan(e) ? `🔨 ${m.name} became a ${specName(e)} (artisan).` : `🔨 ${m.name} is now a ${pathRankName(sr)} ${specName(e)}.`);
        if (isArtisan(e) && s.deeds) s.deeds.push(`${m.name} became a ${specName(e)}.`);
      }
      if (e.spec2) {
        const r2 = Math.min(e.rank, rankFor(e.s2xp, lvl));
        if (r2 > e.s2rank) {
          e.s2rank = r2;
          const g = mergedTitle(e);
          log(s, g ? `🔨 ${m.name} became a ${g.name}!` : `🔨 ${m.name} is now a ${pathRankName(r2)} ${pathSpecDef(e.id, e.spec2).name}.`);
          if (g && s.deeds) s.deeds.push(`${m.name} became a ${g.name}.`);
        }
      }
    }
  }
  if (m.craft && mainPath(m)) m.craft.rank = Math.min(D.guilds.ranks.length - 1, mainPath(m).rank);
}

// R46 → R47: reaching Master (slots.masterOpensGuild) in a slotted trade opens a second guild for that person.
// Recorded now (m.secondGuild); R47 builds the second guild and honours it alongside the tier-3 class rule.
export function masterGuildCheck(s, m, e) {
  const at = (SL() || {}).masterOpensGuild;
  if (at == null || m.secondGuild || !e || e.rank < at || pathSlotOf(m, e) === "dabble" || (pathDef(e.id) || {}).advanced) return false;
  m.secondGuild = { via: "craft", path: e.id, day: s ? s.day : 0 };
  if (s) log(s, `🎓 ${m.name} reached ${pathRankName(e.rank)} ${pathDef(e.id).name}: a second guild opens for them in a coming update.`);
  return true;
}
// called from gainXp: XP in a path's skills feeds that path (and its specialty)
export function pathXp(s, m, skill, amt) {
  if (!PD() || !m.paths || !m.paths.length || !(amt > 0)) return;
  let hit = false;
  for (const e of m.paths) {
    const p = pathDef(e.id);
    if (!p || !p.skills.includes(skill)) continue;
    e.xp += amt * PD().xpRate;
    if (e.spec) e.sxp += amt * PD().xpRate;
    if (e.spec2) e.s2xp += amt * PD().xpRate;
    hit = true;
  }
  if (hit) refreshPaths(s, m);
}

export function openPathIssue(s, m, id) {
  if (!pathDef(id)) return "unknown path";
  if (!isAdult(m)) return "must be an adult";
  if (!m.craft) return "join the Crafters' Guild first";
  if (!memberPaths(m).length && pathDef(id).advanced) return "pick a main path first";
  if (pathOf(m, id)) return "already on this path";
  const pu = pathDef(id).unlock; // R52 Runecarver: taught by Runesmith Hild
  if (pu && pu.reqPerk && !(s.reqPerks || []).some(p => p.from === pu.reqPerk)) return "learn it first: " + (pu.text || pu.reqPerk);
  if (pathDef(id).advanced) {
    const miss = advancedReqs(m, id).filter(x => !x.ok);
    return miss.length ? "needs " + miss.map(x => x.text).join(" + ") : null;
  }
  if (basic(m).length >= pathSlots(m))
    return basic(m).length >= PD().maxPaths ? `at most ${PD().maxPaths} paths` : "gain a rank to open another path"; // pre-R46 rule (no slots data)
  return null;
}

export function openPath(s, m, id) {
  if (openPathIssue(s, m, id)) return false;
  m.paths = m.paths || [];
  const p = pathDef(id);
  // credit part of what the member already learned in the path's best skill
  let cum = 0;
  for (let l = 0; l < bestLvl(m, p); l++) cum += xpNeed(l);
  m.paths.push({ id, xp: Math.round(cum * (PD().openCredit || 0)), rank: 0, spec: null, sxp: 0, srank: 0 });
  assignSlots(m);
  const e = pathOf(m, id);
  log(s, `🔨 ${m.name} took up ${p.name} as ${p.advanced ? "an advanced" : SL() ? (e.slot === "dabble" ? "a dabbling (Apprentice-only)" : "their " + slotName(e.slot).toLowerCase()) : m.paths.length === 1 ? "their main" : "a secondary"} path.`);
  refreshPaths(s, m);
  return true;
}

export const specChoices = (m, pid) => {
  const e = pathOf(m, pid);
  return e && !e.spec && e.rank >= PD().specAt ? pathDef(pid).specs : [];
};
export const pendingPathChoices = m =>
  (isAdult(m) && m.craft && !memberPaths(m).length ? 1 : 0) +
  memberPaths(m).filter(e => specChoices(m, e.id).length || spec2Choices(m, e.id).length).length +
  (!SL() && basic(m).length && basic(m).length < pathSlots(m) && pathDefs().some(x => !x.advanced && !pathOf(m, x.id)) ? 1 : 0) +
  pathDefs().filter(x => x.advanced && !pathOf(m, x.id) && memberPaths(m).length && !advancedReqs(m, x.id).some(r => !r.ok)).length;

export function chooseSpec(s, m, pid, sid) {
  const e = pathOf(m, pid);
  if (!specChoices(m, pid).some(x => x.id === sid)) return false;
  e.spec = sid;
  e.sxp = 0;
  e.srank = 0;
  log(s, `🔨 ${m.name} specialised as a ${pathSpecDef(pid, sid).name}.`);
  return true;
}

// ---- effects. fx values scale by (rank+1); specialties add theirs by (srank+1)
const fxMatch = (f, key, rc, itemDef) => {
  if (f.res) return f.res.includes("*") || f.res.includes(key);
  if (!rc) return true;
  const it = itemDef ? itemDef(rc.base) : null;
  if (f.slots && !(it && f.slots.includes(it.slot))) return false;
  if (f.bases && !f.bases.includes(rc.base)) return false;
  if (f.mats && !f.mats.some(k => (rc.mats || {})[k])) return false;
  return true;
};
export function memberFx(m, kind, key, rc, itemDef) {
  let v = 0;
  for (const e of memberPaths(m)) {
    const p = pathDef(e.id);
    if (!p || (kind === "craft" && rc && rc.path !== p.id)) continue;
    const er = effRank(m, e);
    for (const f of p.fx) if (f.kind === kind && fxMatch(f, key, rc, itemDef)) v += f.flat ? f.v : Math.min(f.max ?? Infinity, f.v * (er + 1));
    for (const [sp, r] of specsOf(e)) for (const f of sp.fx) if (f.kind === kind && fxMatch(f, key, rc, itemDef)) v += f.flat ? f.v * specMult(e) : f.v * (Math.min(r, er) + 1) * specMult(e);
    // R47: an artisan title's own fx (e.g. Seneschal +1 route) count once the title is effective (slot cap included)
    if (isArtisan(e) && er >= (PD().artisanAt ?? 3)) for (const f of pathSpecDef(e.id, e.spec).artisan.fx || []) if (f.kind === kind && fxMatch(f, key, rc, itemDef)) v += f.flat ? f.v : f.v * (er + 1);
  }
  return v;
}
// family-wide effects use the best adult (no stacking across members)
export const famFx = (s, kind, key) =>
  Math.max(0, ...living(s).filter(isAdult).map(m => memberFx(m, kind, key)));

// "find" fx: extra resources (e.g. mushrooms) found while gathering on matching skills
export function pathFinds(m, skill) {
  const out = {};
  for (const e of memberPaths(m)) {
    const p = pathDef(e.id);
    const er = effRank(m, e);
    for (const [f, r, mul] of [...(p ? p.fx : []).map(f => [f, er]), ...specsOf(e).flatMap(([sp, sr]) => sp.fx.map(f => [f, Math.min(sr, er), specMult(e)]))])
      if (f.kind === "find" && f.skills.includes(skill)) out[f.res] = (out[f.res] || 0) + f.v * (r + 1) * (mul || 1);
  }
  return out;
}

// old crafter class ids (requiresClass, classPerks) → path requirements (data/paths.json classMap)
export function pathReqOk(m, cid) {
  const q = PD() && PD().classMap[cid];
  if (!q) return false;
  return memberPaths(m).some(
    e =>
      (q.paths === "*" || q.paths.includes(e.id)) &&
      (q.spec ? e.spec === q.spec : e.rank >= (q.rank || 0)),
  );
}
export const pathReqName = cid => (PD() && PD().classMap[cid] ? PD().classMap[cid].name : null);

// recipe gate for class recipes: path + rank + adventuring class line
export function recipePathIssue(m, rc, inLine) {
  if (!rc.forClass) return null;
  const e = m && pathOf(m, rc.path);
  if (!e || e.rank < (rc.pathRank || 0)) return `${pathRankName(rc.pathRank || 0)} ${pathDef(rc.path).name}`;
  if (!inLine(m, rc.forClass)) return `${(findId(D.classes, rc.forClass) || { name: rc.forClass }).name}s only`;
  return null;
}

// save migration: crafter classes (m.prof) → path ranks
export function migratePaths(s) {
  const P = PD();
  for (const m of s.members || []) {
    if (m.paths) continue;
    m.paths = [];
    const prof = m.prof;
    if (!prof && !m.craft) continue;
    const plan = (P.migrate[prof] || []).slice();
    if (!plan.length && (prof || m.craft)) {
      // plain Artisan: main path from their best crafting skill
      const best = P.paths.slice().sort((a, b) => bestLvl(m, b) - bestLvl(m, a))[0];
      plan.push([best.id, 0]);
    }
    for (const [id, r, spec] of plan) {
      const xp = P.ranks[r].xp;
      m.paths.push({ id, xp, rank: r, spec: spec || null, sxp: 0, srank: 0 });
    }
    if (!m.craft) m.craft = { id: "hearth", rank: 0, rep: 0 };
    delete m.prof;
    if (m.craft) m.craft.rank = Math.min(D.guilds.ranks.length - 1, m.paths[0] ? m.paths[0].rank : 0);
  }
}
export const pathCapMax = () => (SL() ? Infinity : PD().maxPaths);
// save step 42: slots for every member; Scribe-Stewards move onto the Clerk path at the same rank (they keep everything)
export function migrateCraftSlots(s) {
  for (const m of s.members || []) {
    const sc = pathOf(m, "scribe");
    if (sc && sc.spec === "steward" && pathDef("clerk")) {
      const cl = pathOf(m, "clerk");
      const moved = { id: "clerk", xp: Math.max(sc.xp, (cl || {}).xp || 0), rank: Math.max(sc.rank, (cl || {}).rank || 0), spec: "steward", sxp: sc.sxp, srank: sc.srank };
      if (cl) Object.assign(cl, moved); else m.paths.splice(m.paths.indexOf(sc) + 1, 0, moved);
      Object.assign(sc, { spec: null, sxp: 0, srank: 0 });
      delete sc.spec2;
    }
    // highest-ranked other crafting path goes second, gathering paths by rank (main stays first)
    const B = basic(m);
    for (const e of B) delete e.slot;
    delete m.slotChosen;
    assignSlots(m); // highest crafting rank = main, next = secondary; path order unchanged
    for (const e of memberPaths(m)) masterGuildCheck(null, m, e);
  }
}

// daily "make" fx (specialties): Herbalist bandages, Gemcutter cuts gems (`from` is consumed 1:1)
export function pathsDay(s) {
  for (const m of living(s).filter(isAdult))
    for (const e of memberPaths(m)) {
      for (const [sp, r] of specsOf(e))
      for (const f of sp.fx) {
        if (f.kind !== "make") continue;
        let n = f.v * (Math.min(r, effRank(m, e)) + 1) * specMult(e);
        if (f.from) n = Math.min(n, s.res[f.from] || 0), (s.res[f.from] -= n);
        if (n > 0) s.res[f.res] = (s.res[f.res] || 0) + n;
      }
    }
}

// save step: renamed specialty ids (paths.json specRenames)
export function renameSpecs(s) {
  const R = (PD() || {}).specRenames || {};
  for (const m of s.members || []) for (const e of m.paths || []) if (e.id === "smithing" && e.spec === "jeweler") e.wasJeweler = true;
  for (const m of s.members || []) for (const e of m.paths || []) if (e.spec && (R[e.id] || {})[e.spec]) e.spec = R[e.id][e.spec];
}
// save step: an old Grandmaster Jeweler (one specialty did both) becomes Goldsmith + Grandmaster Gemcutter = Jeweler
export function migrateJewelers(s) {
  for (const m of s.members || [])
    for (const e of m.paths || [])
      if (e.id === "smithing" && e.spec === "goldsmith" && e.wasJeweler && e.srank >= top() && !e.spec2)
        Object.assign(e, { spec2: "gemcutter", s2xp: e.sxp, s2rank: e.srank });
  for (const m of s.members || []) for (const e of m.paths || []) delete e.wasJeweler;
}
