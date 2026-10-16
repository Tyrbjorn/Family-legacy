# Family Legacy — Roadmap

The game grows from one adventurer into a dynasty in three eras. The header shows the current era and what reaches the next one.

> **Core rule: eras only ADD systems. They never lock earlier ones.**
> Solo questing, crafting, jobs, activities, training, guilds and the Map stay fully usable in every era. A Ruling Power family can still send one member out to clear rats, apprentice a child at the stables, or spend a season at the forge.

## Phases (replace the three eras; data/phases.json, header shows "Phase n/4")
Each phase only ADDS systems; nothing earlier is ever locked. Thresholds are data-driven.
1. **Beginning**: first character, adventuring, a house, kids. Light marriage (suitors with personalities/houses/dowries), rapport, friendly house quests.
2. **Established** (home + family, or 300 Renown): a nice house, working family and minions, estate economy, food and meals. Rivalry quests (against a house) and rival trouble events.
3. **Dynasty** (Manor-level estate + 1,000 Renown + 3+ living family; about year 20 / the second generation in longsim): rival families, **feuds and wars** (`houses.gates`), and a short rewarded and skippable "Rise of a Dynasty" intro (3 steps). *Planned:* mansion/fort, estate village.
4. **Titles** (planned, not built): barony with land, towns and cities, lords, roads, court, taxes. The house model (`id`, `seat`, `wealth`, `rank`, `kind`) and `houses.ranks` are where lords and titles plug in.

**Unlock intros** (`data/intros.json`): each new system (Crafting, Food, Minions, Guilds, Houses, Dynasty) starts a 1-3 step do-it line with small rewards, after the apprentice prologue. Every line is skippable and never blocks play. Old saves mark already-unlocked systems done quietly.

**Gear sets & enchanting** (shipped): sets, enchanting, the home-furniture + workshop station pattern, furniture tiers that take slots, and crafter class perks. Next in the backlog: town trading, party system, map detail.

*The "Era" sections below are the historical design notes; read "Era 3" as Dynasty + Titles.*

## Era 1 — Solo Adventurer 🧭 (built)
One young adventurer making a name.
- Jobs and apprenticeships, activities, age-gated training, quest-unlocked trainings
- Map: quests, resource nodes, towns, rumors
- Guilds: one class guild, plus the open Adventurers' and Crafters' Guilds (Adventurer / Artisan tracks)
- Crafting with quality tiers, the vault and pack, selling and the market stall
- Buying the first plot of land

## Era 2 — Established Family 🏡 (built)
**Reached by:** a home on your land plus a family (a spouse or a second living member), *or* 300 Renown.
- Marriage, children, inheritance and succession; switch between members; idle members keep training and questing
- Estate: land slots, structures, slotted furniture and stations, synergies, processing chains
- Minions: hiring, housing, food, wages, loyalty, gear, special minions
- Estate direction of idle members and minions

## Next: Parties 🤝 (planned, not built)
**Unlocks at** Adventurers' Guild rank C, or with a Barracks or Guild Hall estate building.
- Form a party of family members plus minions; it travels as one dot and runs dungeons and quests with **combined power** (sum of CP with diminishing returns).
- Roles (front, support, scout) use member classes and minion jobs; loot and XP are split between members.
- The standing Explore and Adventure orders, dungeons and travel are already built; parties will reuse them.

## Era 3 — Ruling Power 👑 (planned, not built)
**Reached by:** 5,000 Renown and a Manor-tier estate. Right now the indicator just shows that you've reached it.
Planned additions:
- **Titles and nobility:** knight, baron, count; title upkeep and privileges
- **Land holdings and villages:** charter villages on the Map, each with population and production
- **Vassals:** sworn families or retainers who hold land for you and owe service
- **Taxes:** income from holdings, with rates that trade against loyalty and unrest
- **Politics and alliances:** rival houses, favor, feuds, councils
- **Armies and guards:** garrisons from minions, defense events, campaigns
- **Marriages for alliances:** arranged matches between houses that grant alliances or land

Everything from Eras 1–2 keeps working alongside these.

- [x] Follower milestone upgrades (Auto/Manual, extra slots → 4-piece follower sets, save step 10)
- [x] estate.js split: production.js
- [x] Craft paths for family members (10 paths, specialties, 6 combo paths, class recipes, save step 11)
- [ ] Jeweler as its own path? (now a Smithing specialty); more combos
- [x] Map round: parchment terrain map, roads, fog of war, locations, terrain nodes with stock/regrowth, gather-and-haul trips, hauling tiers and animals, land features and parcel work, region requirements and coast stub (save step 12)
- [x] Trade round: per-town supply and demand pricing, Warehouse > Trading Post > Counting House, trade routes with route slots (building, upgrades, haggling, Steward/Seneschal hook, Trade Factors), carts with driver + guard + Horseman escorts, bandits, auto-trade rules, Peddler > Travelling Merchant > Trade Factor (save step 13)
- [x] Adulthood at 18. Teens (14–17) can quest: safe errands, hunting, combat at CP ≤ 15 or injury chance < 10%; never deadly or dungeons
- [x] Trade pass 2: town-to-town haul routes, town specialties (produces/wants), bandit fights (win = cart continues; lose = goods lost, guards flee or die), road patrols
- [x] Building tiers round 1: House branches into Mansion / Fort / Tower Keep / Abbey (tier 4, 3 land, 8 slots, one-member unlocks), branch respec (half refund of old, full new cost), estate demolish (half refund of the whole tier chain). Production-building tiers: proposed, not built
- [ ] Mason road building/repair (data hook `world.roadWorks` only); boats and sea trade (Gullport stub); the Runecarver and the Dwarfhold (locked stub)

## Furniture redo (2026-10-14)
- estate.js split: tiers/branches/respec/demolish → js/engine/tiers.js; fittings + save migration → js/engine/furnish.js.
- Home line (Shack→Cabin→House→branches) keeps the broad furniture set; every other building offers ≤4 slot items. Every item = 1 slot at any tier and shows a one-line effect.
- Merged: Cradle/Featherbed/Follower Bunk → Bed; Cold Cellar → Larder; Bookshelf/Desk → Study Corner.
- Bed by placement: home = family beds; Bunkhouse/Guardhouse/Adventurers' Lodge/Fort = follower beds.
- Stat-bump items → slot-free Fittings (bought once per building).
- Save migration step 14 remaps merged items (tier kept), moves stat items to fittings, sends disallowed items to storage.
- Tests: test/furniture.test.mjs; screenshot test/shot-furniture.mjs.
- Follow-up: specialty buildings keep 1 slot with ≤4 distinct picks, each with a tradeoff line (structure.picks). Root Cellar (mushroom quest) and Nursery are home fittings; Bed + Nursery combo; item one-liners list combos; bed-block reason names the shortfall.
- Thin buildings round: Cask Rack (Cellared Ale), Loading Dock (wagonSpeed stat), Guard Post, Splitting Bench (Stoneworks), Depot, Shopfront; Lanterns fitting; Counting House desk teaches Haggling (structure.pieceBonus).
- Small items slot-free (all buildings): Study Corner, Shrine, Perch, Brazier, Reagent Shelf, Glyph Lectern → fittings (save step 15).
- Rank gating for non-manor buildings: estate.rankSlots by upgrade level, structure.unlockUp per item.
- UI: building card split into js/ui/estate-card.js.
- Five thin buildings filled (Moonpetal Planter, Infirmary Beds/Hospice, Yew Grove, Feast Table/Remembrance Feast); Hall of Ancestors upgrade line; Shopfront = auto-sell own output; minimal day/night (js/engine/daynight.js, tuning.dayNight) with night-only Lanterns; save step 16.
- Counting House: Shopfront replaced by Ledger Hall combo (Study Desk + Stall: +10% trade sell); synergy only/except fields.
- Production tiers: 17 buildings × 3 tiers (structure.tiers; st.tier/st.keptUps), tier upgrade lines with slot bonuses; data split into data/structures/{home,production,trade,civic}.json; save step 17.
- Brewery > Vintners (Wine Press: berries→wine) > Distillery (Copper Still: ale→spirits; alchemists +10% speed/potency). New resources wine/spirits (prices, drinks). Tier fixed pieces (tier.fixed), tier bonus (tier.bonus).

## Metals & loot (unreleased, on top of Brewery)
- data/metals.json: copper, bronze, iron, steel, mithril, adamantium (+ silver, gold as precious resources). Template × metal generates items + recipes (metaldata.js, run in setData); hand-made iron items kept.
- One mine per vein type (st.vein; old saves = iron vein); silver/gold/mithril/gems need Deep Mine, adamantium Ore Gallery. Each ore has its own map node (new: Tin Diggings, Coal Seam, Gold Wash). Coal also from the Charcoal Kiln (Workshop, Saw Mill). Iron items sit between bronze and steel.
- Forge smelts tin/bronze/silver/gold; Forge Hall adds Steel Furnace, Foundry adds Crucible. Upgrades carry metalQ (+.02 / +.03) on top of each metal's quality step.
- loot.js: drop chance and rarity curve from difficulty and quest risk/type (tuning.loot); quest loot lists are favorites; rare ore finds; nodes can drop "res:" rare ore.
- Save step 18 renames old item ids. Smokehouse Curing House offers a Cask Rack instead of the Smoker.
- On hold: Jeweler building (inlays work at the forge for now).
- [x] Auto Ascend (title slots 3/2/1 for tiers 2–4, closest-to-qualifying trainee, key-job skill gates 2/4/6/8, cascade, auto-evolve, keep-job switch) and Auto Recruit (monthly, cheapest follower, hire + 3 months wages + reserve). Town work for followers: open question.
- [x] Craft ladder: specialist → artisan titles, Scribe branches (Loremaster/Draftsman/Steward/Cartographer), Gemcutter + Jeweler inlays, Herbalist → Apothecary bandages, Pastry Chef / Smoker renames, Steward route slot fix; save step 23.

## Difficulty + path cleanup (unreleased)
- js/engine/difficulty.js, tuning.difficulty. Game difficulty (global, Settings): Hearthside / Settled / Steady / Hard Times / Grim Age. Personal challenge (family only, picked in the first year of life, shown on the member card): Sheltered / Ordinary / Driven / Ironwilled / Doomsworn. Level 3 = base game; game level snapshotted on each action at start; loot reads base quest power; combined renown ≤ ×1.8.
- Hooks: successChance, encounter option checks + travel encounter chance, resGain, craft days, bandit segRisk, bad world-event weighting (events.types[].bad), loot drop/tilt, addRenown, gainXp.
- Apothecary combo shown as Remedist (id kept); Woodsman Herbalist → Forest Sense; Farmer Brewer specialty cut (save step 19 clears it).
- Dynasty: Manor stage (estate level 12) + 3 living adults; no Renown requirement.

## Combat (unreleased)
- js/engine/combat.js + tuning.combat: HP and Morale per fighter; each round every fighter trades a blow (odds from (pow+20)/(foe+20), calibrated to the old success formula); HP loss drains morale; below 25% a fighter rolls to flee (0.5 + game difficulty flee); groups of 2+ flee together below 25% average; 10 rounds max.
- Morale skills: Rally (leadership), War Shout (brawling), Hold the Line (tactics), Field Dressing (healing), Know Your Foe (monsterlore).
- Bandits fight turn-based (guard + escorts vs bandits). Dungeons: tier 1–4 by first-floor power, 2·tier+2 events (fights + stat checks), +15 morale/+30% HP between events, pack fights at 0.7×; loot rolls = tier; optional dg.story / dg.onClear. Normal quests stay a single roll.
- Fleeing causes no injury; beaten = 5-day injury (3 with guards); ending badly hurt (<30% HP) = 2 days.
- UI: household morale is shown as "Contentment". Difficulty flee adjust removed from encounter checks.

## Injuries (unreleased)
- js/engine/injuries.js + tuning.injuries: Bruised (2d, works −10%), Wounded (5d/3 with guards), Maimed (15d, 25% lasting), Crippling (40d, always lasting). Deadly fail → Maimed or 20% Crippling; deadly success 5% Crippling. Hard Times/Grim Age upgrade Wounded → Maimed 25%/40%.
- Treated = care within 3 days (remedies, potions, Infirmary/Shrine, healer, Field Dressing, bandages); Field Dressing and bandages lower the tier.
- Death: Crippling roll 2/2/2/4/6% by difficulty (×2 Doomsworn); untreated load (tier points, −1 per 30 days) ≥6 → 25% infection on a new untreated Maimed/Crippling. Old age unchanged.
- 5 lasting injuries (max 2, not inherited). Hooks: permanent entries take minTier/weight; removePerm() for restoration/prosthetics. Save step 20.

## Map round 2 (save v21)
- Mountains and lakes are impassable; routes detour around them (data/world.json `routing`). Highlands use 3-step elevation: hills (0.8) → highlands terrain (0.6, ore ×1.25, gems ×1.3) → four tall mountain ranges (impassable); the spots that were inside a mountain or lake moved to its edge and keep that terrain's gathering bonus.
- Boats: build a Dock (trade building, needs stream or clay-bank land); then a Carpenter can make a Small Boat. With both, routes may cross lakes (whichever way is quicker). Later: Port + Shipyard for larger ships on the coast (add a `ship` terrain flag and a ship item the same way).
- Livestock feed (`world.feed`): grazers eat hay→wheat→vegetables, hens and pigs eat wheat→vegetables. Unfed animals stop working; after 10 unfed days one runs off; herds regrow one head per 20 fed days. Sheep, goats and pigs have diets but no building yet.
- A wagon with no animal is pulled by hand (half cargo, ×0.6 speed). Nodes regrow daily. Follower convoy drivers: loyalty under 30 won't go, 30–59 skim 10%, +1% edge per level (max +10%), +1 loyalty per run. Faint '?' hints for unfound places in the fog. Intro gained Scout Nearby and First Trade steps.
