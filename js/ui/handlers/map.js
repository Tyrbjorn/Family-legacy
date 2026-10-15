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
  buyanimal: () => E.buyAnimal(s, v, b.dataset.w),
  rumor: () => E.rumor(s, v),
  advjoin: () => E.joinAdventurers(s, m),
  advrank: () => E.advRankUp(s, m),
  advbuy: () => E.buyAdvItem(s, m, v),
  trq: () => tradeAdj(v, "qty", +b.dataset.w, 10),
  trk: () => tradeAdj(v, "keep", +b.dataset.w, 0),
  trb: () => tradeAdj(v, "below", +b.dataset.w, 0),
  trauto: () => {
    const r = route(v);
    if (r) r.auto = !r.auto;
  },
  trdel: () => E.removeRoute(s, v),
  trnew: () => {
    const T2 = (U.tr = U.tr || { t: 0, mode: "sell", r: 0 });
    if (v === "t") (T2.t++, (T2.r = 0));
    else if (v === "mode") (T2.mode = T2.mode === "sell" ? "buy" : "sell"), (T2.r = 0);
    else T2.r++;
  },
  tradd: () => {
    const T2 = U.tr || { t: 0, mode: "sell", r: 0 },
      towns = E.tradeTowns(s),
      town = towns[T2.t % towns.length];
    const goods = T2.mode === "buy" ? E.marketOf(town.id) : Object.keys(town.prices).filter(k => (s.res[k] || 0) > 0 || !E.marketOf(town.id).includes(k));
    if (goods.length) E.addRoute(s, town.id, T2.mode, goods[T2.r % goods.length]);
  },
  trcrew: () => {
    const r = route(v);
    if (!r) return;
    const w = b.dataset.w;
    const cur = w === "escort" ? null : r[w];
    const pool = s.minions.filter(x => x.job !== "trade" && (w !== "escort" || E.isEscort(x)));
    const i = pool.findIndex(x => x.uid === cur);
    const nx = pool[(i + 1) % pool.length];
    if (nx) E.setCrew(s, v, w, nx.uid);
  },
});

const route = id => ((s.trade || {}).routes || []).find(x => x.id === id);
function tradeAdj(id, k, d, min) {
  const r = route(id);
  if (r) r[k] = Math.max(min, (r[k] || 0) + d);
}
