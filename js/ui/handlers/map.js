import * as E from "../../engine.js";
import { D, s } from "../../main.js";
import { U } from "../state.js";

// Click actions for the map area. ctx = { v, w, b, m } from the clicked element.
export const mapActions = ({ v, w, b, m }) => ({
  quest: () => {
    E.setAction(s, { type: "quest", target: v });
  },
  dungeon: () => E.setAction(s, { type: "dungeon", target: v }),
  auto: () => E.setAction(s, { type: "auto", target: v }),
  stopauto: () => E.setAction(s, { type: "stopauto" }),
  explore: () => E.setAction(s, { type: "explore", target: v }),
  mapsel: () => {
    U.mapSel = v;
  },
  zoom: () => {
    const f = +v,
      W = D.map.size.w,
      H = D.map.size.h;
    if (!f) {
      U.mv = { x: 0, y: 0, w: W, h: H };
    } else {
      const cx = U.mv.x + U.mv.w / 2,
        cy = U.mv.y + U.mv.h / 2;
      U.mv.w = Math.min(W * 1.2, Math.max(180, U.mv.w * f));
      U.mv.h = (U.mv.w * H) / W;
      U.mv.x = cx - U.mv.w / 2;
      U.mv.y = cy - U.mv.h / 2;
    }
  },
  gather: () => E.setAction(s, { type: "gather", target: v }),
  parcel: () => E.setAction(s, { type: "parcel", target: v }),
  buyanimal: () => E.buyAnimal(s, v, w),
  rumor: () => E.rumor(s, v),
  advjoin: () => E.joinAdventurers(s, m),
  advrank: () => E.advRankUp(s, m),
  advbuy: () => E.buyAdvItem(s, m, v),
});
