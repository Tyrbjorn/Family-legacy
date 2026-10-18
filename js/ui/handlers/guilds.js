import * as E from "../../engine.js";
import { s } from "../../main.js";

// Click actions for the guilds area. ctx = { v, w, b, m } from the clicked element.
export const guildsActions = ({ v, b, m }) => ({
  join: () => E.joinGuild(s, m, v),
  join2: () => E.joinSecond(s, m, v),
  pref2: () => E.setPref2(s, m.id, m.pref2 === v ? null : v),
  rankup: () => E.rankUp(s, m, v || undefined),
  gbuy: () => E.buyGuildItem(s, m, v),
});
