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
