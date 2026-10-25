// R77: the sub-tab views. Each old tab is split into named parts (see the *Parts() functions in the tab files); a sub-tab is a
// composition of those parts, drawn as collapsible sections (sect.js). Every old card appears in exactly one sub-tab.
import { questGround, ledgerCard, groundCard } from "./coach-ui.js";
import * as E from "../engine.js";
import { D, s } from "../main.js";
import { U } from "./state.js";
import { sect } from "./sect.js";
import { mainParts, jobsv, jmjobsv, buyItemsPart } from "./main-tab.js";
import { mapParts } from "./map-tab.js";
import { questParts } from "./quests-tab.js";
import { housesParts } from "./houses-tab.js";
import { estateParts, landlessCard, stageCard, estViewToggle, estMapPart, membersOrdersParts, quotasv, landShop } from "./estate-tab.js";
import { invParts } from "./inventory-tab.js";
import { marketSummaryCard } from "./market-ui.js";
import { guildsv } from "./guilds-tab.js";
import { craftingv } from "./crafting-tab.js";
import { minionsv } from "./minions-tab.js";
import { automationv } from "./automation-tab.js";
import { characterv } from "./character-tab.js";
import { familyv } from "./family-tab.js";
import { chroniclev } from "./chronicle-tab.js";
import { legacyv } from "./legacy-tab.js";
import { fieldsCard } from "./fields-ui.js";
import { unionCard } from "./union-ui.js";
import { ordersCard } from "./orders-ui.js";

// land gate: the Estate sub-tabs show the old "Landless" card (plus the Starting Plot shop on Overview / Land) until the family owns land
const landless = shop => (E.hasLand(s) ? "" : landlessCard() + (shop ? landShop() : ""));
const gate = (shop, f) => landless(shop) || f();
// a pointer card on Today when someone is courting-age and suitors are waiting (the list itself lives on Family → Courtship)
const suitorPointer = () => (s.suitors.length ? `<div class="card row" style="padding:6px 8px"><span>💌 <b>${s.suitors.length}</b> suitor${s.suitors.length === 1 ? "" : "s"} in town</span><button class="b" data-tab="courtship">See Courtship</button></div>` : "");

export const VIEW_FN = {
  // ---- Play
  main: () => { const P = mainParts(); return P.head + ledgerCard() + groundCard() + suitorPointer() + sect("main.tasks", P.tasks) + sect("main.paths", P.paths) + sect("main.class", P.cls) + sect("main.recent", P.recent); },
  jobs: () => { const P = mainParts(); return sect("jobs.jobs", jobsv()) + sect("jobs.journeyman", jmjobsv()) + sect("jobs.training", P.training, { open: P.trainingOn }); },
  craft: () => craftingv(),
  market: () => sect("market.buy", buyItemsPart()) + sect("market.best", marketSummaryCard()),
  // ---- World
  map: () => { const P = mapParts(); return P.head + P.note + P.regions.map(r => r[1]).join(""); },
  quests: () => { const P = questParts(); return P.top + questGround() + sect("quests.requests", P.requests) + sect("quests.chains", P.chains) + sect("quests.active", P.active) + sect("quests.available", P.available) + sect("quests.done", P.done); },
  story: () => questParts().story,
  guilds: () => guildsv(),
  houses: () => { const P = housesParts(); return sect("houses.realm", P.realm) + sect("houses.major", P.major) + sect("houses.minor", P.minor) + sect("houses.usurper", P.usurper); },
  events: () => { const P = mapParts().events; return sect("events.haul", P.haul) + sect("events.trade", P.trade) + sect("events.world", P.world) + sect("events.lines", P.lines); },
  // ---- Estate
  estate: () => gate(true, () => { const P = estateParts(); return stageCard() + sect("estate.food", P.food) + sect("estate.capacity", P.capacity) + sect("estate.village", P.village) + sect("estate.endgame", P.endgame); }),
  buildings: () => gate(false, () => { const P = estateParts(); return sect("buildings.synergies", P.synergies) + sect("buildings.rooms", P.rooms) + sect("buildings.outdoor", P.outdoor); }),
  land: () => gate(true, () => { const P = estateParts(); return estViewToggle() + (U.estView === "map" ? estMapPart() : "") + sect("land.owned", P.land) + sect("land.shop", `<h3>📜 Land for sale</h3>` + (P.shop || '<div class="muted">You own every parcel.</div>')); }),
  fields: () => gate(false, () => sect("fields.fields", fieldsCard())),
  union: () => gate(false, () => sect("union.hall", unionCard())),
  minions: () => minionsv(),
  auto: () => automationv() + (E.hasLand(s) ? sect("auto.quotas", quotasv()) + (E.craftingUnlocked(s) ? "" : sect("auto.orders", ordersCard())) : ""),
  // ---- Family
  char: () => characterv(),
  members: () => { const P = membersOrdersParts(); return sect("members.members", P.members) + sect("members.ancestors", P.ancestors); },
  family: () => familyv(),
  courtship: () => sect("courtship.suitors", housesParts().courtship),
  chron: () => chroniclev(),
  legacy: () => legacyv(),
  // ---- Bag
  inv: () => { const P = invParts(); return sect("inv.gear", P.gear + P.sets); },
  materials: () => sect("materials.mats", invParts().mats),
  pack: () => { const P = invParts(); return sect("pack.pack", P.pack) + sect("pack.vault", P.vault); },
  sell: () => sect("sell.stock", invParts().sell),
  enchant: () => sect("enchant.enchant", invParts().enchant),
};
