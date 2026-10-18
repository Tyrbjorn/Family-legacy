import { findId } from "./lookup.js";
// R30 special maps (data/map.json specialMaps): map items found as dungeon/quest drops and read from the Bag.
// They reveal what quadrant maps never do: hidden quests (caches), hidden resource nodes, secret dungeons, hidden spots.
// Data-driven: add a map = an items.json entry (slot "map") + a specialMaps.maps entry + a mapDrop on a source.
import { addToVault } from "./inventory.js";
import { revealAt } from "./map.js";
import { D, log, rng } from "./state.js";

const SM = () => (D.map && D.map.specialMaps) || { maps: {} };
export const mapDef = id => SM().maps[String(id).split("|")[0]];
export const isSpecialMap = id => !!mapDef(id);
const have = (s, id) => (s.mapsRead || []).includes(id) || (s.vault || []).includes(id);

// on a quest done / dungeon cleared: maybe drop its map (each map only once per lineage: not while held or after reading)
export function mapDrop(s, src, first) {
  const md = src && src.mapDrop;
  if (!md || !mapDef(md.item) || have(s, md.item)) return null;
  const p = first && md.firstClear != null ? md.firstClear : md.chance;
  if (rng() >= p) return null;
  if (!addToVault(s, md.item)) return null;
  log(s, `🗺️ Found a special map: ${findId(D.items, md.item).name} (read it from the Bag).`);
  return md.item;
}

function applyEffect(s, e) {
  const out = [];
  if (e.type === "reveal")
    for (const id of e.ids || []) {
      if (id.startsWith("loc:")) {
        const l = D.world && D.world.locations.find(x => x.id === id.slice(4));
        if (l && !(s.discovered || []).includes(id)) (s.discovered = s.discovered || []).push(id), out.push(l.name);
        continue;
      }
      const x = [...D.quests, ...D.nodes, ...(D.dungeons || [])].find(y => y.id === id);
      if (!x) continue;
      if (!s.revealed.includes(id)) s.revealed.push(id);
      revealAt(s, id);
      out.push(x.name);
    }
  if (e.type === "nodes")
    for (const n of D.nodes.filter(n => n.hidden && n.region === e.region && Object.keys(n.res || {}).some(r => (e.res || []).includes(r)))) {
      if (!s.revealed.includes(n.id)) s.revealed.push(n.id);
      revealAt(s, n.id);
      out.push(n.name);
    }
  return out;
}

export function readMapIssue(s, itemId) {
  if (!mapDef(itemId)) return "not a special map";
  if (!(s.vault || []).includes(itemId)) return "not in the vault";
  return null;
}
// read a map: it is used up, its targets are revealed (pins appear) and the find is logged
export function readMap(s, itemId) {
  if (readMapIssue(s, itemId)) return null;
  const d = mapDef(itemId), it = findId(D.items, itemId);
  s.vault.splice(s.vault.indexOf(itemId), 1);
  (s.mapsRead = s.mapsRead || []).push(itemId);
  const found = d.effects.flatMap(e => applyEffect(s, e));
  log(s, `🗺️ Read the ${it.name}: ${d.text}${found.length ? " Marked: " + found.join(", ") + "." : " Nothing new."}`);
  return found;
}
