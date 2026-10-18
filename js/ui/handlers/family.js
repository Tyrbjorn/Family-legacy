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
  foodgift: () => E.giveFoodGift(s, v, b.dataset.w),
  hquest: () => E.setAction(s, { type: "quest", target: v }),
  hgift: () => E.sendGift(s, v),
  war: () => E.declareWar(s, v),
  truce: () => E.offerTruce(s, v),
  marryout: () => {
    const sel = b.parentElement.querySelector('select[data-a="mosel"]');
    return sel ? E.marryOut(s, +sel.value, v) : false;
  },
  evolve: () => E.evolve(s, m, v),
  evolve2: () => E.evolve2(s, m, v),
  clsall: () => {
    U.clsAll = U.clsAll === +v ? null : +v;
  },
  openpath: () => E.openPath(s, m, v),
  pickspec: () => E.chooseSpec(s, m, v, b.dataset.w),
  pickspec2: () => E.chooseSpec2(s, m, v, b.dataset.w),
  setchal: () => E.setChallenge(s, +v, +b.dataset.w),
});
