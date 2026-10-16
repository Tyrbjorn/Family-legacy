// Inlays: a Smithing Goldsmith sets gold or silver, and a Jeweler (Grandmaster Goldsmith + Gemcutter) a cut gem, into an accessory or charm at the forge.
// The inlaid item id is "<item>~<mat>" (enchants are added after: "<item>~<mat>#e1.e2"). Gold/silver add value; a gem adds an enchant slot.
import { CR, itemDef } from "./inventory.js";
import { hasPiece } from "./estate.js";
import { mergedTitle } from "./paths.js";
import { living, log } from "./state.js";

const IN = () => CR().inlays;
const smith = m => (m.paths || []).find(e => e.id === "smithing");
export const goldsmith = s => living(s).find(m => [smith(m)?.spec, smith(m)?.spec2].includes("goldsmith"));
export const jeweler = s => living(s).find(m => (mergedTitle(smith(m)) || {}).name === "Jeweler");
const worker = (s, need) => (need === "jeweler" ? jeweler(s) : goldsmith(s));

export function inlaidDef(id) {
  const i = id.lastIndexOf("~"),
    b = itemDef(id.slice(0, i)),
    mat = IN().mats[id.slice(i + 1)];
  if (!b || !mat) return null;
  return { ...b, id, inlay: id.slice(i + 1), inlaySlot: mat.enchSlot || 0, name: `${b.name} (${mat.name} inlay)`, value: Math.round(b.value * (1 + mat.value)) };
}

export function inlayIssue(s, id, mat) {
  const it = itemDef(id);
  if (!it || !s.vault.includes(id)) return "not in the vault";
  if (!IN().slots.includes(it.slot)) return "accessories and charms only";
  if (id.includes("~") || id.includes("#")) return "already inlaid or enchanted";
  if (!IN().mats[mat]) return "unknown inlay";
  if (!worker(s, IN().mats[mat].needs)) return IN().mats[mat].needs === "jeweler" ? "needs a Jeweler (Grandmaster Goldsmith + Gemcutter)" : "needs a Goldsmith (Smithing specialty)";
  if (!hasPiece(s, IN().station)) return "needs a Forge";
  if ((s.res[mat] || 0) < 1) return "needs 1 " + IN().mats[mat].name;
  return null;
}

export function inlay(s, id, mat) {
  if (inlayIssue(s, id, mat)) return null;
  s.res[mat] -= 1;
  const nid = id + "~" + mat;
  s.vault[s.vault.indexOf(id)] = nid;
  log(s, `💍 ${worker(s, IN().mats[mat].needs).name} inlaid ${itemDef(id).name} with ${IN().mats[mat].name}.`);
  return nid;
}
