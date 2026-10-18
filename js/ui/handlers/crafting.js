import * as E from "../../engine.js";
import { s } from "../../main.js";

// Click actions for the crafting area. ctx = { v, w, b, m } from the clicked element.
export const craftingActions = ({ v, b, m }) => ({
  cqueue: () =>
    E.queueCraft(
      s,
      E.findId(s.members, +v),
      b.dataset.w,
    ),
  cunq: () =>
    E.unqueueCraft(
      E.findId(s.members, +v),
      +b.dataset.w,
    ),
  mcraft: () => {
    const mi = s.minions.find(x => x.uid === v);
    E.setMinionCraft(s, mi, mi && mi.craftOrder === b.dataset.w ? null : b.dataset.w);
  },
  craft: () => E.setAction(s, { type: "craft", target: v }),
});
