import { isHeld } from "./holds.js";
import { inlaidDef } from "./inlay.js";
import { permFx } from "./injuries.js";
import { metalQuality } from "./metals.js";
import { upPacks } from "./minionups.js";
import { famFx, memberFx, recipePathIssue } from "./paths.js";
import { introNote } from "./intros.js";
import { houseSellMult } from "./houses.js";
import { patronBuy, patronSell } from "./endgame.js";
import { seasonPrice } from "./seasons.js";
import { inc } from "./achievements.js";
import { buyMult, priceMult, sellMult } from "./worldevents.js";
import { LG, addRenown, hasLegacy } from "./legacy.js";
import { className, craftQuality, eff, hasPiece, pieceDef } from "./estate.js";
import { enchCp, noteSets, splitId, stationCraftQ } from "./gear.js";
import { hasService } from "./guilds.js";
import { gainXp, inLine } from "./skills.js";
import { D, T, afford, log, pay, rng } from "./state.js";
import { tutNote } from "./tutorial.js";

export function equip(s, m, itemId, from = "vault") {
  const src = from === "bag" ? m.bag : s.vault;
  const i = src.indexOf(itemId);
  const it = itemDef(itemId);
  if (i < 0 || !["weapon", "offhand", "armor", "accessory"].includes(it.slot)) return false;
  src.splice(i, 1);
  if (m.autoEq) delete m.autoEq[it.slot]; // a hand-equipped slot is never swapped by Auto Equip
  if (m.equip[it.slot]) m.bag.push(m.equip[it.slot]);
  m.equip[it.slot] = itemId;
  noteSets(s, m);
  return true;
}

export const sellValue = (s, it) =>
  Math.round(it.value * Math.min(SELL_CAP, (hasService(s, "appraisal") ? 0.8 : 0.5) * (1 + eff(s, "saleBonus"))));

export function sell(s, itemId) {
  const i = s.vault.indexOf(itemId);
  if (i < 0) return;
  s.vault.splice(i, 1);
  s.res.coin += sellValue(s, itemDef(itemId));
  tutNote(s, "traded");
}

export function unequip(s, m, slot) {
  if (m.autoEq) delete m.autoEq[slot];
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

// Trade round: per-town supply drives demand pricing. supply 1 = normal; selling raises it (price falls),
// buying lowers it (price rises); it drifts back each day as the town produces and consumes (trade.js).
const TR = () => T.trade || {};
// Town specialties (towns.json produces / wants) set where a good's supply rests: plenty = cheaper, scarce = dearer.
export const baseSupply = (townId, res) => {
  const t = D.towns.find(x => x.id === townId) || {};
  return (t.produces || []).includes(res) ? TR().produceSupply || 1 : (t.wants || []).includes(res) ? TR().wantSupply || 1 : 1;
};
export const townSupply = (s, townId, res) => ((s.trade && s.trade.supply[townId]) || {})[res] ?? baseSupply(townId, res);
export const demandMult = (s, townId, res, lo, hi) => Math.min(hi, Math.max(lo, Math.pow(townSupply(s, townId, res), -(TR().elasticity || 0.6))));
export const sellDemand = (s, townId, res) => demandMult(s, townId, res, TR().sellMin || 0.6, TR().sellMax || 1.6);
export const buyDemand = (s, townId, res) => demandMult(s, townId, res, TR().buyMin || 0.8, TR().buyMax || 1.6);
export function shiftSupply(s, townId, res, n) {
  if (!s.trade) return;
  const sp = (s.trade.supply[townId] = s.trade.supply[townId] || {});
  sp[res] = Math.max(0.2, Math.min(3, (sp[res] ?? baseSupply(townId, res)) + n / (TR().depth || 200)));
}

export const townSellPrice = (s, townId, res) => {
  const t = D.towns.find(x => x.id === townId);
  return (
    Math.round(
      t.prices[res] *
        sellDemand(s, townId, res) * (1 + eff(s, "tradeSell")) * priceMult(s, townId, res) * sellMult(s, townId) * houseSellMult(s, townId) * patronSell(s, townId) * seasonPrice(s, res) * 100,
    ) / 100
  );
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
export const marketOf = townId => {
  const t = D.towns.find(x => x.id === townId) || {};
  return [...new Set([...(t.market || []), ...(t.produces || [])])];
};
export const townBuyPrice = (s, townId, res) => {
  const t = D.towns.find(x => x.id === townId);
  return (
    Math.round(
      t.prices[res] *
        (((D.towns.find(x => x.id === townId) || {}).produces || []).includes(res) ? TR().produceMarkup || 1.2 : (T.resBuyMarkupBy || {})[res] || T.resBuyMarkup || 2.5) *
        Math.max(BUY_MULT_FLOOR, buyMult(s, townId)) *
        Math.max(1, priceMult(s, townId, res)) *
        seasonPrice(s, res) *
        buyDemand(s, townId, res) *
        patronBuy(s, townId) *
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
  shiftSupply(s, townId, res, -n);
  return true;
}

export function sellRes(s, townId, res, n) {
  const t = D.towns.find(x => x.id === townId);
  n = Math.min(n, Math.floor(s.res[res]));
  if (n <= 0) return false;
  s.res[res] -= n;
  s.res.coin += n * townSellPrice(s, townId, res);
  shiftSupply(s, townId, res, n);
  tutNote(s, "traded");
  return true;
}

// ---- items, crafting & inventory
export const CR = () => D.crafting;

export const qualities = () => CR().qualities;

export function itemDef(id) {
  if (typeof id !== "string") return null;
  if (id.includes("#")) {
    const { base, ench } = splitId(id),
      b = itemDef(base);
    if (!b) return null;
    const ec = enchCp(ench);
    return { ...b, id, baseId: base, enchants: ench, name: b.name + " ✨", cp: (b.cp || 0) + ec, value: Math.round(b.value * (1 + 0.2 * ench.length)) };
  }
  if (id.includes("~")) return inlaidDef(id);
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

export const vaultCap = s => CR().vaultBase + Math.floor((eff(s, "matCap") / 400) * CR().vaultPerStorage + 1e-9) + upPacks(s) + Math.floor(famFx(s, "vault"));

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
  if (rc.requiresClass && !(m && inLine(m, rc.requiresClass))) return `${className(rc.requiresClass)} only`;
  const pi = rc.forClass && recipePathIssue(m, rc, inLine);
  if (pi) return pi;
  if (rc.station !== "mentor" && !hasPiece(s, rc.station)) return `needs ${pieceDef(rc.station).name}`;
  if (rc.needsStruct && !(s.structures || []).some(st => st.type === rc.needsStruct)) return `needs a ${(D.estate.structures.find(x => x.id === rc.needsStruct) || { name: rc.needsStruct }).name}`;
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
  return m ? memberFx(m, "craft", null, rc, itemDef) : 0;
}

export function qualityScore(s, m, rc, mi, apt = 1) {
  const sk = m ? m.skills[rc.skill].lvl : 10 * apt;
  return sk / 50 + craftQuality(s) + profBonus(m, rc) + stationCraftQ(s, rc.station) + metalQuality(s, rc) + permFx(m, "craftQ");
}

export function rollQuality(score) {
  const x = score + rng() * 0.5;
  let q = CR().qualities[0];
  for (const Q of CR().qualities) if (x >= Q.score) q = Q;
  return q.id;
}

export function craftItem(s, m, rc, mi, apt = 1) {
  if (recipeIssue(s, m, rc)) return null;
  introNote(s, "crafted");
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
    if (s.vault.includes(id) && !isHeld(s, id)) {
      sell(s, id);
      n++;
    }
  }
  return n;
}

export function sellAllRes(s, townId, res) {
  return sellRes(s, townId, res, Math.floor(s.res[res] || 0));
}
