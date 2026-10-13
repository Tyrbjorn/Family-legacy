import { metaActions } from "./meta.js";
import { familyActions } from "./family.js";
import { mapActions } from "./map.js";
import { estateActions } from "./estate.js";
import { inventoryActions } from "./inventory.js";
import { guildsActions } from "./guilds.js";
import { craftingActions } from "./crafting.js";

const GROUPS = [
  metaActions,
  familyActions,
  mapActions,
  estateActions,
  inventoryActions,
  guildsActions,
  craftingActions,
];

// Find and run the handler for data-a; returns false when no group owns it.
export function runAction(a, ctx) {
  for (const g of GROUPS) {
    const h = g(ctx)[a];
    if (h) {
      h();
      return true;
    }
  }
  return false;
}
