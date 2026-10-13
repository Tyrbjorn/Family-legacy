import * as E from "../../engine.js";
import { s } from "../../main.js";
import { U } from "../state.js";

// Click actions for the family area. ctx = { v, w, b, m } from the clicked element.
export const familyActions = ({ v, b, m }) => ({
  treesel: () => {
    U.treeSel = v ? +v : null;
  },
  train: () => E.setAction(s, { type: "train", target: v }),
  job: () => E.setAction(s, { type: "job", target: v }),
  activity: () => E.setAction(s, { type: "activity", target: v }),
  rest: () => E.setAction(s, { type: "rest" }),
  court: () => E.setAction(s, { type: "court", target: v }),
  gift: () => E.giveGift(s, v, b.dataset.w),
  propose: () => E.propose(s, v),
  evolve: () => E.evolve(s, m, v),
});
