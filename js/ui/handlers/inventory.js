import * as E from "../../engine.js";
import { s } from "../../main.js";
import { curList } from "../common.js";

// Click actions for the inventory area. ctx = { v, w, b, m } from the clicked element.
export const inventoryActions = ({ v, b, m }) => ({
  equip: () => E.equip(s, m, v),
  readmap: () => E.readMap(s, v),
  equipbag: () => E.equip(s, m, v, "bag"),
  unequip: () => E.unequip(s, m, v),
  tobag: () => E.moveItem(s, m, v, true),
  tovault: () => E.moveItem(s, m, v, false),
  buy: () => E.buyItem(s, v, b.dataset.w),
  sellres: () => E.sellRes(s, v, b.dataset.w, 10),
  buyres: () => E.buyRes(s, v, b.dataset.w, 10),
  buybrew: () => E.buyBrew(s, v, b.dataset.w, 4),
  sellallres: () => E.sellAllRes(s, v, b.dataset.w),
  bulksell: () => E.sellMany(s, curList()),
  bulklist: () => curList().filter(id => !E.isHeld(s, id)).forEach(id => E.listForSale(s, id)),
  inlay: () => E.inlay(s, v, b.dataset.w),
  hold: () => E.toggleHold(s, b.dataset.w, v),
  noautoeq: () => E.toggleNoAutoEq(m),
  list: () => E.listForSale(s, v),
  unlist: () => E.unlist(s, v),
  sell: () => E.sell(s, v),
});
