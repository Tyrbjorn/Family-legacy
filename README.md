# Family Legacy – web prototype
Run: `python3 -m http.server 8080` → http://localhost:8080 (it needs a server because the JSON is loaded with fetch).
Tabs: Main (stats, actions, training, courtship, shop, log/save) · Inventory (personal pack + shared vault, equip) · Estate (scrub land → estate, buildings, furniture, standing orders) · Map (regions, quests, resource nodes, towns/trade, rumors) · Minions (followers: hire, rescue, rumor, reputation; assign to estate jobs; monthly wages). Guilds: 6 halls in towns (Warriors, Rangers, Magic, Healers/Church, Rogues, Crafters) (Map), one per member for life, ranks Initiate→Master, guild skills/quests/items, Tier 2 classes need Adept rank; membership card on Main. Guilds tab: Adventurers' Guild (open to all, ranks F→S, services questBoard/appraisal/storage/healer, bounties, store) + the 6 class/craft guild halls.
Tests: `node test/engine.test.mjs` · UI smoke: `test/ui-smoke.mjs` (Playwright with system Chrome, server on :8137).
Content: data/*.json (seeded by gen-data.mjs; hand edits to the JSON are now authoritative).

Round 5: trait badges (opposed pairs never co-roll; saves migrated), Jobs tab (8 apprentice/adult jobs), Activities (10; age/quest/building-gated), character sheet on Main, Estate/Minions/Guilds tabs hidden until the active member is 18, 7 quests that unlock trainings/activities, 15 special minions (class/guild-rank/quest).
Round 6: land system (data/estate.json) — estate locked until land is bought (Map towns / Main / Estate); buildings use land slots; Shack→Manor interior rooms (living/workshop/resource post/study/nursery/shrine); furniture & minion job spots come from rooms/buildings; old saves get deeded land + rooms.
Round 7: rooms replaced by buildings (Shack/Cabin/House/Workshop Hall/Bunkhouse) on land slots, each holding slotted stations/furniture (data/estate.json pieces) with processing chains (wood→planks, stone→ingots, herbs→potions), food/material caps, crafting quality, minion job spots; synergies for related pieces in the same building; minion housing (Bunk/Bunkhouse, Kennel/Perch/Brazier for specials) and daily food with hunger morale loss. Old saves migrate.

## Eras
The header shows your era (Solo Adventurer → Established Family → Ruling Power) and a hint for the next one. Eras only add systems; nothing earlier is ever locked. See ROADMAP.md.

## Metals & furniture tiers
- **Ore:** iron ore (Abandoned Mine) and copper ore (Creek, new Copper Vein node, and followers on the new **Mining** job using Ore Cart spots). The Forge smelts iron ore → iron ingots and copper ore → copper. Ingots go into gear recipes and furniture; copper goes into tools and charms, and into the Sturdy furniture upgrade.
- **Building level:** Shack/Bunkhouse Lv1, Cabin Lv2, House/Hall Lv3: +5% per level above 1 to every piece inside.
- **Furniture tiers:** Crude ×1 → Sturdy ×1.15 (planks+copper) → Fine ×1.3 → Masterwork ×1.5 (planks+ingots+coin). Pieces keep their tier in storage.
- **Unlockable furniture:** Feather Bed (estate tier Farmstead), Cold Cellar (quest), Steel Anvil (Crafters rank 2), Alchemist's Bench (Magic rank 2), Ore Cart.

## Resource tiers
- **T1 Raw:** wood, stone, iron ore, copper ore, herbs, hides. **T2 Processed:** planks (Saw Table), blocks (new Mason's Table), iron ingots + copper (Forge), potions, leather (new Tanning Rack), cloth. **T3 Refined:** reserved (fine lumber, dressed stone, steel).
- Stations process automatically, and the best operator's skill scales them (each skill level adds +3% speed and +1% yield). The operator is the best family member aged 12+ in the station's skill (Carpentry for the Saw Table, Masonry for the Mason's Table, Smithing for the Forge, Alchemy, Tailoring), or a Crafting minion (aptitude ×10 levels).
- Costs climb by tier: Shack/Bunkhouse use wood+stone, Cabin planks+blocks, House/Hall planks+blocks+ingots. Furniture: Sturdy uses planks, Fine and Masterwork blocks+ingots.
- **Reserves and pausing:** the Capacity card sets a per-resource reserve for raw materials (wood and stone default to 50, others 0). Stations never consume below it. Each processing station has a Pause/Resume button; a paused station neither consumes nor produces. A station stays paused when its furniture is upgraded.

## Map, travel and exploration
- The **Map** tab is a drawn SVG world (drag to pan, pinch, scroll or ＋/－ to zoom, tap markers): home, towns, quests (📖 story · ⭐ one-time · 🔁 repeatable), resource nodes, dungeons and fogged areas (🌫️). Locked regions are greyed and undiscovered ones show as "Uncharted". Coordinates live in `data/map.json`.
- **Travel:** quests, gathering, exploring and dungeons travel out, do the task, then travel back. Travel time depends on distance. The member is **locked** until home: a busy banner shows the phase and time left, and a dotted path with a moving dot appears on the map for every travelling member. Travel runs with offline progress and turbo.
- **Explore** fogged areas to reveal hidden towns (Ashford Crossing, Eagle's Eyrie), a hidden region (Stormcrest Highlands), secret quests and nodes, caches, rare encounters and **dungeons**.
- **Dungeons** (`data/dungeons.json`) run floor by floor (each floor has its own CP check and reward). Failing a floor sends the member home injured; the final floor gives treasure plus a rare roll.
- **Standing orders:** Auto-Explore and Auto-Adventure, for the active member (Map tab), idle members (estate orders `explore`/`adventure`) and minions (jobs Scouting/Adventuring).
- **Story:** "The Lost House", 10 chained chapters across regions, gated by level, era and rumors, with unique rewards (heirlooms, a land deed, followers, a recipe, a training).
- **One-time side quests** are marked ⭐. Quests, nodes, dungeons and encounters have **rare drops** (≤5%), shown as "Rare drops: ???" until found.
- **Minion levels:** every working minion gains XP from its job. Levels add +5% output each, and perks at Lv 5 and Lv 10 add more. The Minions tab shows level, an XP bar and perks.

## Follower classes, land and special buildings
- Every hired follower starts as a **Peasant** and can evolve at Lv 5/10/15 into NPC classes in four branches, chosen by the player on the Minions tab: Military (Militia → Soldier → Sergeant, or Outrider), Economic (Laborer → Artisan → Master Artisan, or Foreman), Magic (Hedge Mage → Adept → Magus), Divine (Acolyte → Village Priest → Curate). NPC classes only boost job output (max +70%), so they stay weaker than family classes. Followers also build per-job skills (+2% per skill level). Special companions keep their own path.
- **Land:** 9 parcels with rising cost (Riverbank, Woodlot, Ridge, Greenvale, plus a Highland Claim once the highlands are discovered), sold in every town. Locked parcels show what they need.
- **Special 1-land buildings:** Quarry, Mine Shaft, Herb Garden (passive output), Smithy, Saw Mill, Mason Yard (built-in station). Each has one slot for its own attached furniture and a 3-step upgrade line that takes no slot (+25%/+25%/+50%). The existing Lumber Camp building stays. The Bunkhouse is unchanged.
