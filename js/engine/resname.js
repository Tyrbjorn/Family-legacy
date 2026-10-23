// R64: one central display-name lookup for resource/material ids (data/resnames.json), with a fallback
// that splits known word endings and title-cases the id ("copperore" -> "Copper ore"). Save keys never change.
import { D } from "./state.js";
const ENDS = ["ore", "blocks", "fish", "meat", "gems", "egg", "scale", "stone", "ale", "gold", "pearl", "petal", "band", "crest", "idol", "tonic"];
export function resName(k) {
  if (k == null) return "";
  k = String(k);
  const n = D && D.resnames && D.resnames.names && D.resnames.names[k];
  if (n) return n;
  if (D && D.items) { const it = D.items.find(x => x.id === k); if (it) return it.name; }
  let w = k.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  if (!w.includes(" ")) for (const e of ENDS) if (w.length > e.length + 2 && w.endsWith(e)) { w = w.slice(0, -e.length) + " " + e; break; }
  return w.charAt(0).toUpperCase() + w.slice(1);
}
// "12 Copper ore" style list for a {id: amount} map
export const resList = (o, sep = ", ") => Object.entries(o || {}).map(([k, v]) => `${v} ${resName(k)}`).join(sep);
