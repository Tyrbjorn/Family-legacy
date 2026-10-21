import { perkBuy, perkShop, perkShopItems } from "./families.js";
import { marketClosed } from "./worldevents.js";
import { hasStructType, markVisited } from "./sea.js";
import { roleBonus } from "./guildtiers.js";
import { findId } from "./lookup.js";
import { choreFx } from "./chores.js";
import { talentBuy } from "./talents.js";
import { fishPriceMult } from "./fish.js";
import { isHeld } from "./holds.js";
import { reqDiscount } from "./requests.js";
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
import { LG, addRenown, hasLegacy, legacyValue } from "./legacy.js";
import { className, craftQuality, eff, hasPiece, pieceDef } from "./estate.js";
import { enchCp, noteSets, splitId, stationCraftQ } from "./gear.js";
import { hasService } from "./guilds.js";
import { gainXp, inLine } from "./skills.js";
import { D, T, afford, log, pay, rng } from "./state.js";
import { tutNote } from "./tutorial.js";

import { clash } from "./geartypes.js";
export function equip(s, m, itemId, from = "vault") {
  const src = from === "bag" ? m.bag : s.vault;
  const i = src.indexOf(itemId);
  const it = itemDef(itemId);
  if (i < 0 || !["weapon", "offhand", "armor", "accessory"].includes(it.slot)) return false;
  src.splice(i, 1);
  if (m.autoEq) delete m.autoEq[it.slot]; // a hand-equipped slot is never swapped by Auto Equip
  if (m.equip[it.slot]) m.bag.push(m.equip[it.slot]);
  m.equip[it.slot] = itemId;
  // two-handed: a greatsword/pike/maul frees the offhand, bows and staves free a shield (the other piece goes to the bag)
  const other = it.slot === "weapon" ? "offhand" : it.slot === "offhand" ? "weapon" : null;
  if (other && m.equip[other] && clash(m.equip.weapon, m.equip.offhand)) {
    m.bag.push(m.equip[other]);
    delete m.equip[other];
    if (m.autoEq) delete m.autoEq[other];
  }
  noteSets(s, m);
  return true;
}

export const sellValue = (s, it) =>
  Math.round(it.value * Math.max(roleBonus(s, "sellPct"), Math.min(SELL_CAP, (hasService(s, "appraisal") ? 0.8 : 0.5) * (1 + eff(s, "saleBonus"))))); // R46 Fence

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
  Math.round(it.value * T.buyMarkup * (s && townId ? Math.max(BUY_MULT_FLOOR, buyMult(s, townId)) : 1) * (1 - reqDiscount(s, townId, it) - perkShop(s, townId)) * (1 + talentBuy(s)) * (1 - roleBonus(s, "buyDisc"))); // R36 Haggler; R46 Swindler

// Trade round: per-town supply drives demand pricing. supply 1 = normal; selling raises it (price falls),
// buying lowers it (price rises); it drifts back each day as the town produces and consumes (trade.js).
const TR = () => T.trade || {};
// Town specialties (towns.json produces / wants) set where a good's supply rests: plenty = cheaper, scarce = dearer.
export const baseSupply = (townId, res) => {
  const t = findId(D.towns, townId) || {};
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
  const t = findId(D.towns, townId);
  return (
    Math.round(
      t.prices[res] * (res === "fish" ? fishPriceMult(s) : 1) * // R31.3: the species mix sets the fish price
        sellDemand(s, townId, res) * (1 + eff(s, "tradeSell") + choreFx(s, "tradeSell") + famFx(s, "trade")) * priceMult(s, townId, res) * sellMult(s, townId) * houseSellMult(s, townId) * patronSell(s, townId) * seasonPrice(s, res) * 100,
    ) / 100
  );
};

// R48: a town's shop plus items a friendly house adds (Ormond scrolls in Thornwick)
export const shopOf = (s, townId) => [...new Set([...((findId(D.towns, townId) || {}).shop || []), ...perkShopItems(s, townId)])];
export function buyItem(s, townId, itemId) {
  const t = findId(D.towns, townId);
  const it = itemDef(itemId);
  if (!shopOf(s, townId).includes(itemId) || s.res.coin < buyPrice(it, s, townId) || (!it.teaches && !vaultRoom(s))) return false;
  if (it.teaches && (s.unlocks || []).includes(it.teaches)) return false; // R48 plans: already learned
  s.res.coin -= buyPrice(it, s, townId);
  markVisited(s, townId);
  if (it.teaches) {
    s.unlocks.push(it.teaches); // R48: Sea Boat Plans teach the recipe instead of taking a vault slot
    log(s, `📜 Bought ${it.name}: learned ${(recipeDef(it.teaches.split(":")[1]) || { name: it.teaches }).name}.`);
    return true;
  }
  s.vault.push(itemId);
  log(s, `🛒 Bought ${it.name}.`);
  return true;
}

// Town markets sell staple goods (salt, grain, milk...). Buying costs resBuyMarkup × the town's base price,
// with the same event/season multipliers as selling, so resale can never profit (see data.test).
export const marketOf = (townId, s) => {
  const t = findId(D.towns, townId) || {};
  const more = Object.entries(t.marketSteps || {}).filter(([q]) => s && (s.doneQuests || []).includes(q)).flatMap(([, g]) => g); // R51 Thrain's market grows with trust
  return [...new Set([...(t.market || []), ...(t.produces || []), ...more])];
};
export const townBuyPrice = (s, townId, res) => {
  const t = findId(D.towns, townId);
  return (
    Math.round(
      t.prices[res] *
        (((findId(D.towns, townId) || {}).produces || []).includes(res) ? TR().produceMarkup || 1.2 : (T.resBuyMarkupBy || {})[res] || T.resBuyMarkup || 2.5) *
        Math.max(BUY_MULT_FLOOR, buyMult(s, townId)) *
        Math.max(1, priceMult(s, townId, res)) *
        seasonPrice(s, res) *
        buyDemand(s, townId, res) *
        patronBuy(s, townId) *
        perkBuy(s, res, townId) * // R48 Ashbrook grain/milk, Vey wood, Corran ingots; R49 Gilmane reef-gold / Saltmere salt, Hask
        100,
    ) / 100
  );
};
export function buyRes(s, townId, res, n) {
  if (!marketOf(townId, s).includes(res)) return false;
  if (marketClosed(s, townId)) return false; // R49 Lodge procession
  const c = townBuyPrice(s, townId, res) * n;
  if (n <= 0 || s.res.coin < c) return false;
  s.res.coin -= c;
  s.res[res] = (s.res[res] || 0) + n;
  shiftSupply(s, townId, res, -n);
  markVisited(s, townId);
  return true;
}

// R49: town breweries (towns[].brewery): each sells a few brews a month at a markup over the town price; stock refills every 30 days
export const breweryOf = townId => (findId(D.towns, townId) || {}).brewery || null;
export const brewsOf = townId => Object.fromEntries(Object.entries((breweryOf(townId) || {}).brews || {}).filter(([k]) => k[0] !== "_"));
export function brewLeft(s, townId, res) {
  const d = brewsOf(townId)[res];
  if (!d) return 0;
  const b = ((s.brewBought || {})[townId] || {})[res];
  return Math.max(0, d.n - (b && b.mo === Math.floor((s.day || 0) / 30) ? b.n : 0));
}
export const brewPrice = (s, townId, res) => Math.round((findId(D.towns, townId).prices[res] || 0) * ((brewsOf(townId)[res] || {}).mult || 1) * perkBuy(s, res, townId) * 100) / 100;
export function buyBrew(s, townId, res, n) {
  n = Math.min(n, brewLeft(s, townId, res));
  const c = brewPrice(s, townId, res) * n;
  if (n <= 0 || s.res.coin < c || marketClosed(s, townId)) return false;
  s.res.coin -= c;
  s.res[res] = (s.res[res] || 0) + n;
  const mo = Math.floor((s.day || 0) / 30), tb = ((s.brewBought ||= {})[townId] ||= {});
  tb[res] = tb[res] && tb[res].mo === mo ? { mo, n: tb[res].n + n } : { mo, n };
  markVisited(s, townId);
  return n;
}

export function sellRes(s, townId, res, n) {
  const t = findId(D.towns, townId);
  n = Math.min(n, Math.floor(s.res[res]));
  if (n <= 0 || marketClosed(s, townId)) return false; // R49 Lodge procession
  s.res[res] -= n;
  s.res.coin += n * townSellPrice(s, townId, res);
  shiftSupply(s, townId, res, n);
  markVisited(s, townId);
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
    const base = findId(D.items, b),
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
  return findId(D.items, id) || null;
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
  if (rc.needsStruct && !hasStructType(s, rc.needsStruct)) return `needs a ${(findId(D.estate.structures, rc.needsStruct) || { name: rc.needsStruct }).name}`;
  if (m && m.skills[rc.skill].lvl < (rc.minSkill || 0))
    return `${findId(D.skills, rc.skill).name} ${rc.minSkill}`;
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

// R43: a craft that lands one step below masterwork gets the Workshop's extra chance to become masterwork
export function masterworkBump(s, qid) {
  const Q = CR().qualities, i = Q.findIndex(x => x.id === qid), p = legacyValue(s, "mwork") || 0;
  return p > 0 && i === Q.length - 2 && rng() < p ? Q[Q.length - 1].id : qid;
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
  const q = masterworkBump(s, rollQuality(qualityScore(s, m, rc, mi, apt))); // R43 Workshop: Masterwork Chance
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
