import { seasonPrice } from "./seasons.js";
import { inc } from "./achievements.js";
import { buyMult, priceMult, sellMult } from "./worldevents.js";
import { LG, addRenown, hasLegacy } from "./legacy.js";
import { craftQuality, eff, hasPiece, pieceDef } from "./estate.js";
import { hasService } from "./guilds.js";
import { gainXp } from "./skills.js";
import { D, T, afford, log, pay, rng } from "./state.js";

export function equip(s, m, itemId, from = "vault") {
  const src = from === "bag" ? m.bag : s.vault;
  const i = src.indexOf(itemId);
  const it = itemDef(itemId);
  if (i < 0 || !["weapon", "offhand", "armor", "accessory"].includes(it.slot)) return false;
  src.splice(i, 1);
  if (m.equip[it.slot]) m.bag.push(m.equip[it.slot]);
  m.equip[it.slot] = itemId;
  return true;
}

export const sellValue = (s, it) =>
  Math.round(it.value * Math.min(SELL_CAP, (hasService(s, "appraisal") ? 0.8 : 0.5) * (1 + eff(s, "saleBonus"))));

export function sell(s, itemId) {
  const i = s.vault.indexOf(itemId);
  if (i < 0) return;
  s.vault.splice(i, 1);
  s.res.coin += sellValue(s, itemDef(itemId));
}

export function unequip(s, m, slot) {
  if (m.equip[slot]) {
    m.bag.push(m.equip[slot]);
    delete m.equip[slot];
  }
}

export function moveItem(s, m, id, toBag) {
  if (toBag ? m.bag.length >= packCap() : !vaultRoom(s)) return false;
  const a = toBag ? s.vault : m.bag,
    b = toBag ? m.bag : s.vault;
  const i = a.indexOf(id);
  if (i < 0) return false;
  a.splice(i, 1);
  b.push(id);
  return true;
}

// Stacked event discounts (caravan × festival) are floored so shop prices never drop under the best
// sell-back value (appraisal + sale bonuses) — that stack used to allow buy-and-resell arbitrage.
export const BUY_MULT_FLOOR = 0.8;
export const SELL_CAP = 0.95;
export const buyPrice = (it, s, townId) =>
  Math.round(it.value * T.buyMarkup * (s && townId ? Math.max(BUY_MULT_FLOOR, buyMult(s, townId)) : 1));

export const townSellPrice = (s, townId, res) => {
  const t = D.towns.find(x => x.id === townId);
  return Math.round(t.prices[res] * priceMult(s, townId, res) * sellMult(s, townId) * seasonPrice(s, res) * 100) / 100;
};

export function buyItem(s, townId, itemId) {
  const t = D.towns.find(x => x.id === townId);
  const it = itemDef(itemId);
  if (!t.shop.includes(itemId) || s.res.coin < buyPrice(it, s, townId) || !vaultRoom(s)) return false;
  s.res.coin -= buyPrice(it, s, townId);
  s.vault.push(itemId);
  log(s, `🛒 Bought ${it.name}.`);
  return true;
}

// Town markets sell staple goods (salt, grain, milk...). Buying costs resBuyMarkup × the town's base price,
// with the same event/season multipliers as selling, so resale can never profit (see data.test).
export const marketOf = townId => (D.towns.find(x => x.id === townId) || {}).market || [];
export const townBuyPrice = (s, townId, res) => {
  const t = D.towns.find(x => x.id === townId);
  return (
    Math.round(
      t.prices[res] *
        ((T.resBuyMarkupBy || {})[res] || T.resBuyMarkup || 2.5) *
        Math.max(BUY_MULT_FLOOR, buyMult(s, townId)) *
        Math.max(1, priceMult(s, townId, res)) *
        seasonPrice(s, res) *
        100,
    ) / 100
  );
};
export function buyRes(s, townId, res, n) {
  if (!marketOf(townId).includes(res)) return false;
  const c = townBuyPrice(s, townId, res) * n;
  if (n <= 0 || s.res.coin < c) return false;
  s.res.coin -= c;
  s.res[res] = (s.res[res] || 0) + n;
  return true;
}

export function sellRes(s, townId, res, n) {
  const t = D.towns.find(x => x.id === townId);
  n = Math.min(n, Math.floor(s.res[res]));
  if (n <= 0) return false;
  s.res[res] -= n;
  s.res.coin += n * townSellPrice(s, townId, res);
  return true;
}

// ---- items, crafting & inventory
export const CR = () => D.crafting;

export const qualities = () => CR().qualities;

export function itemDef(id) {
  if (typeof id !== "string") return null;
  if (id.startsWith("c|")) {
    const [, b, q] = id.split("|");
    const base = D.items.find(i => i.id === b),
      Q = CR().qualities.find(x => x.id === q);
    if (!base || !Q) return null;
    return {
      ...base,
      id,
      name: `${Q.name} ${base.name}`,
      rarity: Q.name,
      quality: q,
      crafted: true,
      cp: Math.round((base.cp || 0) * Q.mult),
      value: Math.round(base.value * Q.mult * CR().craftedValueMult),
      affinity: base.affinity ? Math.round(base.affinity * Q.mult) : undefined,
    };
  }
  return D.items.find(i => i.id === id) || null;
}

export const vaultCap = s => CR().vaultBase + Math.floor((eff(s, "matCap") / 400) * CR().vaultPerStorage + 1e-9);

export const vaultRoom = s => s.vault.length < vaultCap(s);

export const packCap = () => CR().packCap;

export function addToVault(s, id) {
  if (!vaultRoom(s)) return false;
  s.vault.push(id);
  return true;
}

export const recipeDef = id => CR().recipes.find(r => r.id === id);

export function recipeIssue(s, m, rc) {
  if (rc.hidden && !s.unlocks.includes("recipe:" + rc.id)) return "recipe not found";
  if (rc.legacy && !hasLegacy(s, rc.legacy)) return "needs Legacy upgrade";
  if (rc.station !== "mentor" && !hasPiece(s, rc.station)) return `needs ${pieceDef(rc.station).name}`;
  if (m && m.skills[rc.skill].lvl < (rc.minSkill || 0))
    return `${D.skills.find(k => k.id === rc.skill).name} ${rc.minSkill}`;
  if (!afford(s, rc.mats)) return "missing materials";
  if (!vaultRoom(s)) return "vault full";
  return null;
}

export function bestRecipe(s, m) {
  return (
    CR()
      .recipes.filter(r => !recipeIssue(s, m, r))
      .sort((a, b) => itemDef(b.base).value - itemDef(a.base).value)[0] || null
  );
}

export function profBonus(m, rc) {
  const p = m && m.prof && D.classes.find(c => c.id === m.prof);
  if (!p) return 0;
  return p.craftBonus + (p.spec && p.spec === rc.line ? 0.15 : 0);
}

export function qualityScore(s, m, rc, mi, apt = 1) {
  const sk = m ? m.skills[rc.skill].lvl : 10 * apt;
  return sk / 50 + craftQuality(s) + profBonus(m, rc);
}

export function rollQuality(score) {
  const x = score + rng() * 0.5;
  let q = CR().qualities[0];
  for (const Q of CR().qualities) if (x >= Q.score) q = Q;
  return q.id;
}

export function craftItem(s, m, rc, mi, apt = 1) {
  if (recipeIssue(s, m, rc)) return null;
  pay(s, rc.mats);
  const q = rollQuality(qualityScore(s, m, rc, mi, apt));
  const id = `c|${rc.base}|${q}`;
  s.vault.push(id);
  if (m) {
    gainXp(s, m, rc.skill, T.xpPerDay * 3);
    if (m.craft) m.craft.rep += 2 + CR().qualities.findIndex(x => x.id === q);
    if (q === CR().qualities[CR().qualities.length - 1].id) addRenown(s, m, LG().renown.masterwork || 5);
  }
  if (q === CR().qualities[CR().qualities.length - 1].id) inc(s, "masterworks");
  log(s, `🔨 ${(m || mi).name} crafted ${itemDef(id).name}.`);
  return id;
}

export const stallValue = (s, it) => Math.round(it.value * CR().stallSellRate);

export function listForSale(s, id) {
  const i = s.vault.indexOf(id);
  if (i < 0) return false;
  s.vault.splice(i, 1);
  s.forSale.push(id);
  return true;
}

export function unlist(s, id) {
  const i = s.forSale.indexOf(id);
  if (i < 0 || !vaultRoom(s)) return false;
  s.forSale.splice(i, 1);
  s.vault.push(id);
  return true;
}

export function sellTick(s, power = 1) {
  if (!s.forSale.length) return;
  s.saleProg = (s.saleProg || 0) + power;
  if (s.saleProg >= CR().stallDaysPerItem) {
    s.saleProg = 0;
    const id = s.forSale.shift();
    const it = itemDef(id);
    const v = stallValue(s, it);
    s.res.coin += v;
    log(s, `🏷️ Sold ${it.name} for ${v}🪙.`);
  }
}

export function sellMany(s, ids) {
  let n = 0;
  for (const id of ids) {
    if (s.vault.includes(id)) {
      sell(s, id);
      n++;
    }
  }
  return n;
}

export function sellAllRes(s, townId, res) {
  return sellRes(s, townId, res, Math.floor(s.res[res] || 0));
}
