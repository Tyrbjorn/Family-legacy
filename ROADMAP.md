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

## Oct 15, 2026 rounds (live through 840e2c4, save v24)
- [x] Difficulty (e8b0ecd), combat (3047da2), injuries (e4a87ce), refactor (250140f), map round 2 (dd63904)
- [x] e33b21f: Auto Tend (original prices, 50/75%), Auto Equip, Automation tab, deeds (renown from worthy deeds), scout renown fix, Wyrmfire Caldera dragon (tier 5, 300 renown), heirlooms moved to data/dlc-heirlooms.json (refund 120)
- [x] f115cb3: item holds + per-member Auto Equip exclusion, Ancestors' Tithe (10%; Legacy tiers 150/400/900 → 15/20/25%; no double count), Extraction travel scaling, baseline bot builds the Graveyard early ("big" = 3,000)
- [x] 840e2c4: craft ladder (specialist → artisan; Scribe branches; Goldsmith + Gemcutter → Jeweler; inlays; Herbalist → Apothecary bandages; Steward route slot fix), Auto Ascend, Auto Recruit
- Rule agreed (not built): followers who lose their job resettle in the nearest town.
- Open: Remedist vs Legacy Physician/Mycologist (Remedist kept); hiring back resettled followers; follower town-work wage.
- Next candidates: pacing check (year-10 building dip, bot runs dungeons), Mason roads and map buildings, Port sea trade, Runecarver.


## Oct 16, 2026 round: village, Tithe 20%, stone ranks, estate stages (local, not deployed; save schema 26)
- **Ancestors' Tithe:** base 20% (was 10%); upgrades unchanged at 150/400/900 for +5% each (25/30/35%). Auto Tend prices unchanged.
- **Village charter:** "The Baron's Charter" is a resource request quest: needs the Greenvale (Valley) deed and the Dynasty phase; deliver 25,000 coin, 300 sandstone blocks and 200 planks to found a Hamlet.
- **Village tiers:** Hamlet 8 slots → Village 12 (60,000 coin + 100 limestone blocks) → Market Village 16 (150,000 coin + 150 granite blocks).
- **Village buildings, one at a time:** every village building is a construction project. Pick it, deliver its coin and materials in parts (or switch on Auto Deliver: surplus coin above 5,000 and materials above their keep-in-reserve), and it rises when everything is in; cancel refunds deliveries.
- **Village production:** any production building (not mines) at 2 village slots, 3× output, 2× follower spots, 40× the estate coin + 10× its materials, 1% of that coin as monthly upkeep (unpaid = idle). Any tier the family has already raised can be built directly (tier 1 adds 40 limestone blocks, tier 2 adds 40 granite blocks).
- **Relocate or keep both:** an estate production building can be moved (a project at the village price; half its estate cost refunded; pieces, tier and workers move; its land is freed) or kept alongside a new village copy.
- **Village Cottage:** village only, 1 slot, houses 4 followers. Auto Recruit and Auto Ascend work unchanged. No population, markets or Town tab (Expanded Economy DLC).
- **Stone ranks:** Sandstone (the old stone/blocks), Limestone (Deep Quarry face or Thornwick market), Granite (Quarry Works face or the Eyrie market), Marble (Eyrie market only, prestige). The Mason's Table cuts each into its own blocks. Fine buildings need marble blocks: Hall 40, Mansion/Fort/Tower Keep/Abbey 60, Ancestor Hall 30.
- **Estate stages retuned:** Scrub Plot 0, Homestead 10, Farmstead 30, Manor 60, Prosperous Estate 80 (was 0/1/6/12/20); Manor lands about year 10, Prosperous about when the village grows (years 20–26).
- **Test bot:** runs dungeons and one-time quests, founds the village, relocates production, builds cottages, grows the village, buys stone ranks; fixed its rebuild loop (it re-built Shacks/Warehouses after upgrading them) and tries every manor branch.
- **Planned (not built): town resource requests** (towns post goods requests for coin and modest renown; Auto Fulfill from surplus). See the handoff for the proposal.

## Oct 16, 2026 late-game round (local, not deployed; save schema 27, built on the village round)
- **Auto Tend bundles (REMOVED in R29, see below):** "Auto Tend: Whole Estate" tier 1 = 900 Legacy (every Auto Tend at 50%), tier 2 = 2,500 (75%). Singles still sell; single tiers already bought are credited against the bundle price (never below 0), so old saves lose nothing.
- **Coin sinks:** follower wages scale with title tier (×1/1.4/2.5/4.5/7.5, trimmed Oct 16 from ×1/1.5/3/6/10) and +2% per job-skill level (was 3%); diplomacy gifts cost 150 × phase (1/4/20/40) × (1 + 0.25 × house wealth); town patronage (six one-time town buildings, 30k–120k plus stone, +5–8% sell or −10% market buys in that town, phase-gated); stable mounts (Pony 5k / Courser 25k / Warhorse 80k; travel ×1.15/1.3/1.5).
- **Stone nodes + quarries:** Limestone Cliffs near Thornwick and Granite Scarp near the Eyrie (gather nodes, fogged), each with its own 3-tier quarry (limestone 1.5/3/5 a day, granite 1/2/3.5 a day). Marble stays buy-only.
- **Manor branches:** gate is now a Manor-stage estate + Established phase (+ the branch's class line and its building at any level); the Haggling 30 / upgrade-3 gates are gone.
- **Dragon:** Stormhold and Wyrmfire Caldera floor power −15% (Stormhold stays a tier-4 dungeon).
- **Generations (option g3):** lifespan 55, a child every 270 days, up to 5 per couple; the Head hands over at 35 to the oldest adult child 15+ years younger; yearly illness risk (0.2% child, 0.4% under 30, 0.8% from 30 rising after 40) cut by VIT ×3% and the family's best Healing/Herbalism ×1% (floor 25%); a Head's death banks at least 35% of their untithed renown; kids inherit 10% more of their parents' skills. Living members of old saves keep their lifespans.
- **Followers:** Auto Ascend spreads peasants over every tier-1 title (fewest holders first, closest-qualifying peasant; the branch priority only breaks ties); Auto Recruit modes Cheapest / Best fit / Strongest / Balanced, and it replaces a follower who died of age the next day; followers join at 18–32, and past 55 each month risks death of old age.
- **Late game:** repeat quests and repeat dungeon runs (never first clears) scale ×1.25 in Dynasty and ×1.5 in Titles; ~10% are elites (×1.5 power, ×2 coin). A feud that hits rapport −100 becomes a house war at once (Dynasty only). From Dynasty, a raid every 2–3 years: strength grows with coin and estate score (×1.5 while at war); defense is family power + garrison (guards) + defenses; a loss steals 5–10% coin plus 5% of stores, or burns a village building for a month. Defenses: Estate Walls in four stone ranks (Sandstone 20k → Marble Bastion 200k), Watchtower (raid warning), Village Palisade (protects village buildings) (all one-time purchases; Jeremy removed their 1%/month upkeep Oct 16; village building upkeep unchanged). UI: Holdings & defense card on the Estate tab; Auto Recruit mode buttons on Automation.

- **Gear types (built Oct 16, not deployed):** every weapon/offhand/armor has a type (dagger, throwing, short spear, sword, mace, longsword, long spear/pike, greatsword, maul, bow, longbow, staff, wand, rod; buckler/kite/tower; focus, quiver, kit; clothes, robe, padded, leather, chain, brigandine, scale, plate) and a material with strength × and weight × (mithril 1.6/0.6, adamantium 2.2/1.1 + ignores 30% enemy armor (retuned Oct 17; was 1.9/1.5/20%), silver +25% vs undead). Item CP is derived: weapons = DPS (hit × swings/s, swings = 1.6/(1+0.25×weapon weight)); armor = defense + dodge×50 (+ robe caster bonus). Armor classes: Unarmored (clothes/robes, any class, 14% dodge, 0% spell failure), Light (10% dodge, 10%), Medium (25%), Heavy (most defense, 40%, no speed penalty). Dodge scales with AGI, Evasion (new skill, Footwork & Tumbling activity) and the Nimble trait, cap 35%; Bulwark trait +10% heavy defense. Class gear groups: off-class gear works at −50%; proficiency per weapon family and armor class grows +1 per dungeon fight won (caps primary 100 / secondary 60 / off 25, +0.3%/pt); arcane spell failure (cut by armor proficiency, halved by mithril) makes caster blows fizzle and lowers caster quest odds and magic dungeon checks. Battle Mage (tier 2 from Scholar, Archmage alternative): all armor and martial weapons, no spell failure, combat spells at any range; magic counts only to level 75 (top-tier spells stay Archmage-only). Auto Equip scores per member (fit, proficiency, dodge, spell failure) and handles two-handed weapons. New forge templates: dagger, javelins, spear, pike, greatsword, plate. Save schema 28 (proficiency from skills, 2H clash fix, one-time note). Woods have strength × / weight × like metals (pine 0.8/0.8, ash 1.1/0.9, oak 1/1, greenwood 1.1/0.85, rowan 1.15/0.9 +5% caster, yew 1.25/0.95, heartwood 1.4/1.0, ironwood 1.5/1.4, elderwood 1.4/0.7 +15% caster on staves/wands). Proficiency also follows matching skills. Audit fixes: knife < sword, apron is clothing, Stormglass Orb 26, accessories capped 18, Runed Gauntlets → Runed Hauberk.

## Oct 17, 2026 round R29: family automation (local, not deployed; save schema 29, on top of R28)
- **Four Legacy upgrades** (js/engine/family-auto.js, data legacy.json `familyAuto`), on by default once bought, switches in the Automation tab (👪 Family automation card):
  - 🧭 Steward 40: **Auto Orders**. Monthly, idle unpinned adults get the order that fits: artisans craft (best recipe), combat classes quest in the open region with the strongest real quest, others work.
  - 📜 Mentor's Ledger 60: **Auto Advance**. Monthly: join the track/best-fit guild, rank up, evolve one step; keeps 25% of coin in reserve; branch = optional preference, else the class whose requirement + CP skills the member is best at.
  - 🧸 Family Tutor 40: **Auto Upbringing**. Children's daily lessons cycle their track's 3 skills (track = higher-level parent's guild, else best skills; hand-pick pins it).
  - 💞 Matchmaker 50: **Auto Courtship**. Weekly: unmarried adults 18-35 court the best free suitor (one courter per suitor, never a feuding/war house), propose at 100 affinity when the wedding is affordable inside the reserve and a bed is free. Marry in only. Head opt-in (off by default).
- Rules: the active member is never automated; hand-set orders/tracks are pinned (📌, unpin per member); one per-member switch (the existing Auto Equip exclude now covers family automation too); every automatic choice logged with 🤖. Marrying out, succession, politics stay manual.
- **Removed the Auto Tend "Whole Estate" buy-all bundle** (900 / 2,500 Legacy): Auto Tend is bought per skill only. Save step 29 gives bundle owners that tier of every single Auto Tend (nothing lost) and pins existing non-work orders.

## R29.1 playtest feedback (local, not deployed)
- 💬 Feedback button in the header opens a panel: fun 1-5, confused / bored / too much (cut or simplify), keep playing tomorrow (yes/maybe/no), notes, plus read-only context (build, save version, year, generation, play time, user agent). `js/config.js` FEEDBACK_FORM: if formUrl is set, opens a prefilled Google Form in a new tab; empty → Copy feedback (clipboard). Copy save in the panel and the Save settings row. No tracking; play time = visible-tab seconds stored as s.playSec.

## DLC and monetization (planned)
- Expanded Economy: rent/buy town buildings (shack, stall, workshop, cookery, warehouse), open markets, town growth (food > pop > zones, trade > wealth), control vs non-control towns, Town tab, Landholder deed (first non-royal title, quest line), resettled followers bring skills.
- Heirlooms (cheap): one super item per family, any non-consumable item; choose it at the start of a lineage or title an existing item once; Artifact > per-stat upgrades > new function by type.
- Royalty and Conquest: princess marriage, kingdoms, conquest. Region packs.
- Ideas: The Deep (Dwarfhold/Runecarver), Seafaring (Port/Shipyard), Restoration Magic (limbs, prosthetics, raising the dead except old age).
- Cosmetics 99¢–$2: flags, banners, crests, sprites, estate skins, portrait frames, decorative doodads for the estate/village, and a flag/crest maker. No gameplay edge.
- **Graphics upgrade (v1.5 bundle):** a full art refresh shipped as a v1.5 bundle, released well after the DLCs.

## Future game ideas (separate games, not Family Legacy)
- **BattleCry-style army battler (no name yet):** a separate game about raising and commanding armies in fast real-time battles, inspired by BattleCry.
- **Majesty-style city simulator / deep life sim (no name yet):** the player has no character and oversees the whole settlement; residents act autonomously (live, learn and inherit on their own), but the overseer can command that things get done. Alternative mode: play a royal line from the start. Main inspiration: Majesty (classic): the player only orders buildings and places bounty flags to motivate action; everything else is fully automated (simple yet complex). Everyone grows and learns month by month; villages upgrade themselves from their residents' prosperity; life gets better or worse (harvests, illness, raids, wages, contentment); strong inheritance of traits and skills shaped by parents' wealth, skill and discipline; visible routines, likes and inherited traits. Family Legacy keeps only a light on-paper slice (a modest inheritance boost for kids of skilled or wealthy parents; no per-follower life sim). Retainer families (sworn retainers who marry, have kids and hold office) stay in Family Legacy's base game.
