// R76 Encyclopedia: a catalog built from the game data + a read-only "what has the player encountered" observer + the profile memory (fl_enc_v1).
// The observer only READS state (no helper that writes is called), so it can never change the simulation. The catalog and the observer
// are pure functions of (D, s); the UI never shows an entry's name or text until its id is in the discovered set (no spoiler toggle).
//   fl_enc_v1 = { v:1, seen:{section:[id,...]}, slots:{ "1":{section:[id,...]}, ... } }
//   seen = union of everything ever encountered on this device (profile-wide); slots[n] = what slot n's dynasty has encountered ("this save").
import { ENC_KEY } from "./profile-store.js";
import { regionKnown, townKnown, nodeVisible, questVisible } from "./map.js";
import { locKnown } from "./world.js";
import { townKnownId } from "./sea.js";
import { respectList } from "./r60.js";

export const ENC_SECTIONS = [
  ["items", "Items", "🎒"], ["buildings", "Buildings", "🏠"], ["classes", "Classes", "🛡️"], ["factions", "Factions", "🏳️"],
  ["places", "Places", "🗺️"], ["quests", "Quests", "📜"], ["creatures", "Creatures", "🐾"], ["lore", "Lore", "📖"],
];
const arr = x => (Array.isArray(x) ? x : []);
const num = n => (+n || 0).toLocaleString("en-US");
const cap = x => (x ? String(x).charAt(0).toUpperCase() + String(x).slice(1) : "");
const E = (id, name, icon, sub, text) => ({ id, name: name || id, icon: icon || "", sub: sub || "", text: text || "" });
const costTxt = c => Object.entries(c || {}).map(([k, v]) => `${num(v)} ${k}`).join(", ");
const rewardTxt = r => Object.entries(r || {}).map(([k, v]) => `${num(v)} ${k}`).join(", ");

// every structure definition in D (data/structures/*.json, keyed "structures/<file>")
const structDefs = D => Object.keys(D).filter(k => k.startsWith("structures/")).flatMap(k => arr(D[k]));

export function encCatalog(D) {
  const C = {};
  C.items = arr(D.items).map(i => E(i.id, i.name, "", `${i.rarity || ""} ${i.slot || ""}`.trim(), [i.type && cap(i.type) + (i.mat ? ` (${i.mat})` : ""), i.cp ? `Power ${i.cp}` : "", i.value ? `Worth ${num(i.value)} coin` : "", i.desc || ""].filter(Boolean).join(" · ")));
  C.buildings = [
    ...arr(D.buildings).map(b => E("b:" + b.id, b.name, b.icon, "Estate building", [b.desc, b.max ? `Up to level ${b.max}` : "", b.cost ? "Costs " + costTxt(b.cost) : ""].filter(Boolean).join(". "))),
    ...structDefs(D).map(b => E("st:" + b.id, b.name, b.icon, "Estate structure", [b.desc, b.slots ? `${b.slots} slots` : "", b.cost ? "Costs " + costTxt(b.cost) : ""].filter(Boolean).join(". "))),
  ];
  C.classes = [
    ...arr(D.classes).map(c => E("c:" + c.id, c.name, c.icon, c.tier ? `Tier ${c.tier} class` : "Starting class", [c.desc, arr(c.stats).length ? "Stats: " + c.stats.join(", ") : ""].filter(Boolean).join(". "))),
    ...arr((D.minions || {}).types).map(t => E("f:" + t.id, t.name, t.icon, "Follower", [`Hire ${num(t.hire)} coin`, t.wage ? `wage ${num(t.wage)}` : ""].filter(Boolean).join(", "))),
  ];
  const fl = (D.factions || {}).list;
  C.factions = [
    ...arr(fl).map(f => E("g:" + f.id, f.name, f.icon, "Faction", arr(f.rivals).length || arr(f.allies).length ? [arr(f.allies).length ? "Friendly with " + f.allies.map(a => (arr(fl).find(x => x.id === a) || {}).name || a).join(", ") : "", arr(f.rivals).length ? "at odds with " + f.rivals.map(a => (arr(fl).find(x => x.id === a) || {}).name || a).join(", ") : ""].filter(Boolean).join("; ") : "")),
    ...arr((D.families || {}).list).map(h => E("h:" + h.id, h.name, h.icon, `${cap(h.rank || "")} ${h.kind || "house"}`.trim(), [h.known, h.goal ? "Wants: " + h.goal : "", h.thread && h.thread.name ? `Story: ${h.thread.name}` : ""].filter(Boolean).join(". "))),
  ];
  C.places = [
    ...arr(D.regions).map(r => E("r:" + r.id, r.name, r.icon, "Region", r.cp ? `Recommended power ${r.cp}` : "")),
    ...arr(D.towns).map(t => E("t:" + t.id, t.name, t.icon, "Town", "")),
    ...arr(D.nodes).map(n => E("n:" + n.id, n.name, n.icon, "Gathering place", n.skill ? `Skill: ${n.skill}` : "")),
    ...arr(D.dungeons).map(d => E("d:" + d.id, d.name, d.icon, "Dungeon", arr(d.floors).length ? `${d.floors.length} floors` : "")),
    ...arr((D.world || {}).locations).filter(l => l.name && l.type !== "town").map(l => E("l:" + l.id, l.name, "", cap(l.type || "Landmark"), "")),
  ];
  C.quests = arr(D.quests).map(q => E(q.id, q.name, "", `${cap(q.type || "quest")}${q.risk ? " · " + q.risk + " risk" : ""}`, [q.days ? `${q.days} day${q.days > 1 ? "s" : ""}` : "", q.cp ? `Power ${q.cp}` : "", q.reward && Object.keys(q.reward).length ? "Reward: " + rewardTxt(q.reward) : ""].filter(Boolean).join(" · ")));
  const A = ((D.fields || {}).animals || {}).types || {};
  C.creatures = [
    ...Object.entries(A).map(([id, a]) => E("a:" + id, a.name, a.icon, "Livestock", a.out ? `Gives ${a.out}` : "")),
    ...arr((D.fish || {}).species).map(f => E("fi:" + f.id, f.name, f.icon, `Fish${f.tier ? " · " + f.tier : ""}`, f.value ? `Worth ${num(f.value)} coin` : "")),
    ...arr((D.fish || {}).rare).map(f => E("fi:" + f.id, f.name, f.icon, "Rare catch", f.value ? `Worth ${num(f.value)} coin` : "")),
  ];
  const R = D.r60 || {};
  C.lore = [
    ...arr(R.endings).map(e => E("e:" + e.id, e.name, "", "How a line is remembered", e.text)),
    ...arr(R.branches).map(b => E("br:" + b.id, b.name, b.icon, "A choice that split the realm", b.text)),
    ...arr(Object.values((D.intros || {}).lines || {})).map(l => E("i:" + l.id, l.name, l.icon, "A story begins", l.intro)),
  ];
  return C;
}
export const encTotals = C => Object.fromEntries(Object.keys(C).map(k => [k, C[k].length]));

// what this game state has encountered: { section: [ids] } (read-only)
export function encObserve(D, s) {
  const F = {}; for (const [k] of ENC_SECTIONS) F[k] = [];
  const add = (k, id) => F[k].push(id);
  const mem = arr(s.members);
  const has = (a, id) => arr(a).includes(id);
  // items: anything ever held (vault, a bag, worn) or found as a rare drop
  const held = new Set([...arr(s.vault), ...arr(s.found), ...arr(s.forSale && s.forSale.map && s.forSale.map(x => x && (x.id || x)))]);
  for (const m of mem) { for (const v of Object.values(m.equip || {})) if (v) held.add(v); for (const v of arr(m.bag)) held.add(v); }
  for (const i of arr(D.items)) if (held.has(i.id)) add("items", i.id);
  // buildings and structures: owned now or built before
  for (const b of arr(D.buildings)) if ((s.buildings || {})[b.id] > 0) add("buildings", "b:" + b.id);
  const built = new Set(arr(s.structures).map(x => x && x.type));
  for (const b of structDefs(D)) if (built.has(b.id)) add("buildings", "st:" + b.id);
  // classes: held by a family member (or earned as a story class); followers: hired once
  const cl = new Set([...mem.map(m => m.cls), ...arr(s.clsEarned)].filter(Boolean));
  for (const c of arr(D.classes)) if (cl.has(c.id)) add("classes", "c:" + c.id);
  const ft = new Set(arr(s.minions).map(m => m && m.type));
  for (const t of arr((D.minions || {}).types)) if (ft.has(t.id)) add("classes", "f:" + t.id);
  // factions met; noble houses once their seat town is known or they have been dealt with
  const met = new Set();
  try { for (const r of respectList(s)) if (r.met) met.add(r.id); } catch (e) { /* data without factions */ }
  for (const f of arr((D.factions || {}).list)) if (met.has(f.id)) add("factions", "g:" + f.id);
  for (const h of arr((D.families || {}).list)) {
    const st = (s.houses || {})[h.id] || {};
    let known = !!st.r || (st.state && st.state !== "peace");
    if (!known && h.seat) { try { known = !!townKnownId(s, h.seat); } catch (e) { known = false; } }
    if (known) add("factions", "h:" + h.id);
  }
  // places: what the map shows (the same tests the game uses), plus anything explored or cleared
  for (const r of arr(D.regions)) if (regionKnown(s, r.id)) add("places", "r:" + r.id);
  for (const t of arr(D.towns)) if (regionKnown(s, t.region) && townKnown(s, t)) add("places", "t:" + t.id);
  for (const n of arr(D.nodes)) if (nodeVisible(s, n)) add("places", "n:" + n.id);
  for (const d of arr(D.dungeons)) if (has(s.cleared, d.id) || nodeVisible(s, d)) add("places", "d:" + d.id);
  for (const l of arr((D.world || {}).locations)) if (l.name && l.type !== "town" && locKnown(s, l)) add("places", "l:" + l.id);
  // quests: finished, or listed on the map
  const done = new Set(arr(s.doneQuests));
  for (const q of arr(D.quests)) if (done.has(q.id) || questVisible(s, q)) add("quests", q.id);
  // creatures: fish caught, livestock kept
  for (const f of [...arr((D.fish || {}).species), ...arr((D.fish || {}).rare)]) if (((s.fishBag || {})[f.id] || 0) > 0) add("creatures", "fi:" + f.id);
  for (const id of Object.keys(((D.fields || {}).animals || {}).types || {})) if (built.has(id)) add("creatures", "a:" + id);
  // lore: an ending only once the line has ended; a branch once it came up; an intro once it started
  if (s.gameOver) {
    const a = s.align || {}, hi = (a.honor || 0) >= 0 ? "true" : "low", fa = (a.faith || 0) >= 0 ? "new" : "old";
    const e = arr((D.r60 || {}).endings).find(x => x.honor === hi && x.faith === fa);
    if (e) add("lore", "e:" + e.id);
  }
  for (const b of arr((D.r60 || {}).branches)) if ((s.branches || {})[b.id]) add("lore", "br:" + b.id);
  for (const l of Object.values((D.intros || {}).lines || {})) if (((s.intros || {}).lines || {})[l.id]) add("lore", "i:" + l.id);
  return F;
}

// ---- profile memory
const blank = () => ({ v: 1, seen: {}, slots: {} });
export function encLoad(st) {
  let r = null;
  try { r = JSON.parse(st.getItem(ENC_KEY) || "null"); } catch (e) { r = null; }
  if (!r || typeof r !== "object" || r.v !== 1) return blank();
  r.seen = r.seen && typeof r.seen === "object" ? r.seen : {}; r.slots = r.slots && typeof r.slots === "object" ? r.slots : {};
  return r;
}
export function encSave(st, enc) { try { st.setItem(ENC_KEY, JSON.stringify(enc)); return true; } catch (e) { return false; } }
// merge what slot n has found into the memory; returns true if anything new was added
export function encRecord(enc, n, found) {
  let changed = false;
  const slot = (enc.slots[n] ||= {});
  for (const [k, ids] of Object.entries(found)) {
    const a = (enc.seen[k] ||= []), b = (slot[k] ||= []), sa = new Set(a), sb = new Set(b);
    for (const id of ids) { if (!sa.has(id)) { a.push(id); sa.add(id); changed = true; } if (!sb.has(id)) { b.push(id); sb.add(id); changed = true; } }
  }
  return changed;
}
// a new dynasty / deleted / overwritten slot starts its "this save" memory again (the profile-wide memory stays)
export function encResetSlot(enc, n) { if (enc.slots[n]) { delete enc.slots[n]; return true; } return false; }
export const encSet = (enc, scope, n, section) => new Set(scope === "save" ? ((enc.slots[n] || {})[section] || []) : ((enc.seen || {})[section] || []));
