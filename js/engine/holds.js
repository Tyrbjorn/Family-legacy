// Item holds: keep an item type (all copies of a base item) or one exact item out of bulk selling/stocking and Auto Equip.
// s.holds = { types: [base ids], items: [exact item ids] }. A member with m.noAutoEq is skipped by Auto Equip.
const H = s => (s.holds = s.holds || { types: [], items: [] });
// "c|iron_sword|fine#ench" → "iron_sword"; "rusty_sword" → "rusty_sword"
export const itemType = id => {
  const p = String(id).split("#")[0].split("|");
  return p[0] === "c" ? p[1] : p[0];
};
export const heldType = (s, id) => H(s).types.includes(itemType(id));
export const heldItem = (s, id) => H(s).items.includes(id);
export const isHeld = (s, id) => heldType(s, id) || heldItem(s, id);
export function toggleHold(s, kind, id) {
  const l = H(s)[kind === "type" ? "types" : "items"],
    k = kind === "type" ? itemType(id) : id,
    i = l.indexOf(k);
  if (i < 0) l.push(k);
  else l.splice(i, 1);
}
export const toggleNoAutoEq = m => (m.noAutoEq = !m.noAutoEq);
