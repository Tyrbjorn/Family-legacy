// R60: hand r60.js the engine helpers it needs, after every module has loaded.
import { setR60Deps } from "./r60.js";
import { regionOpen } from "./map.js";
import { townKnownId } from "./sea.js";
import { guildsOf, cls } from "./guilds.js";
import { addToVault } from "./inventory.js";
import { addMinion } from "./minions.js";
import { metric } from "./achievements.js";
import { statVal } from "./family.js";
import { dungeonTier } from "./combat.js";
setR60Deps({ regionOpen, townKnownId, guildsOf, cls, addToVault, addMinion, metric, statVal, dungeonTier });
