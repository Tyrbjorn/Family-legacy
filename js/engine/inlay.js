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
// R52 runes: a Runecarver (path) or Runemaster (its specialty) carves at the Runestone Anvil
const rpath = m => (m.paths || []).find(e => e.id === "runecarver");
export const runecarver = s => living(s).find(m => rpath(m));
export const runemaster = s => living(s).find(m => rpath(m)?.spec === "runemaster");
const worker = (s, need) => (need === "jeweler" ? jeweler(s) : need === "runecarver" ? runecarver(s) : need === "runemaster" ? runemaster(s) : goldsmith(s));
const NEED_TXT = { jeweler: "needs a Jeweler (Grandmaster Goldsmith + Gemcutter)", runecarver: "needs a Runecarver", runemaster: "needs a Runemaster (Runecarver specialty)" };
const matRes = mat => [IN().mats[mat].res || mat, IN().mats[mat].n || 1];

export function inlaidDef(id) {
  const i = id.lastIndexOf("~"),
    b = itemDef(id.slice(0, i)),
    mat = IN().mats[id.slice(i + 1)];
  if (!b || !mat) return null;
  return { ...b, id, inlay: id.slice(i + 1), inlaySlot: mat.enchSlot || 0, name: `${b.name} (${mat.name}${mat.cp ? "" : " inlay"})`, value: Math.round(b.value * (1 + mat.value)), ...(mat.cp ? { cp: Math.round((b.cp || 0) * (1 + mat.cp)) } : {}) };
}

export function inlayIssue(s, id, mat) {
  const it = itemDef(id);
  if (!it || !s.vault.includes(id)) return "not in the vault";
  if (!IN().mats[mat]) return "unknown inlay";
  const M = IN().mats[mat];
  if (!(M.slots || IN().slots).includes(it.slot)) return M.slots ? "weapons, armor and offhands only" : "accessories and charms only";
  if (id.includes("~") || id.includes("#")) return "already inlaid or enchanted";
  if (!worker(s, M.needs)) return NEED_TXT[M.needs] || "needs a Goldsmith (Smithing specialty)";
  if (!hasPiece(s, M.station || IN().station)) return M.station ? "needs a Runestone Anvil" : "needs a Forge";
  const [r, n] = matRes(mat);
  if ((s.res[r] || 0) < n) return "needs " + n + " " + (M.res ? r : M.name);
  return null;
}

export function inlay(s, id, mat) {
  if (inlayIssue(s, id, mat)) return null;
  const [r, n] = matRes(mat);
  s.res[r] -= n;
  const nid = id + "~" + mat;
  s.vault[s.vault.indexOf(id)] = nid;
  log(s, `💍 ${worker(s, IN().mats[mat].needs).name} inlaid ${itemDef(id).name} with ${IN().mats[mat].name}.`);
  return nid;
}
