// R77 intro / tutorial / Orrin copy and registries. UI-only data: lives in a JS module (not data/coach.json) so no sim-read data/*.json changes.
// Every line below is a DRAFT from /workspace/handoffs/fl-intro-tutorial-proposal.md (section 9 / 5f / 5g) or invented to fill a gap (marked INV).
// Pure: no DOM, no engine imports.

export const INTRO_CARDS = [
  { icon: "🔥", title: "The lost name", text: "Long ago the Hold of House Vael stood above the river. Then House Crane took it, in one night, and the name was struck from every ledger. You were a child, and a village took you in." },
  { icon: "🏰", title: "What this is", text: "Heirs of the Hold is a quiet idle game about a family. Your people work, learn and grow whether you are watching or not. You steer: what they do, what they build, who they marry." },
  { icon: "⏳", title: "What to expect", text: "Time passes on its own. Days become years, and your heirs grow up to carry the house. Most of what you do is a choice between useful things. Nothing is lost if you walk away." },
  { icon: "🚪", title: "Your first week", text: "Master Orrin finishes your apprenticeship today. Fill the larder, learn a trade, claim ground of your own. He will tell you the rest when you are ready." },
];
export const INTRO_PLAYED = "I've played before: skip the intro and tours";

// "Who made you?" row (flavor only: stored in fl_ui_v1, never in the save)
export const CREATION_HEAD = "Your apprenticeship is ending. Who made you?";
export const CREATION_HINT = "They taught you what they knew. The guild remembers.";
export const MASTERS = [
  { id: "orrin", name: "Master Orrin", trade: "Hearthwright", add: "" },
  { id: "brann", name: "Brann the Smith", trade: "Smith", add: "Iron forgives nothing, and neither will I." },
  { id: "wenna", name: "Old Wenna the Huntress", trade: "Hunter", add: "Quiet feet. Quieter bow." },
  { id: "holt", name: "Sergeant Holt", trade: "Soldier", add: "Stand straight. You carry the name." },
  { id: "maren", name: "Sister Maren", trade: "Healer", add: "Heal first. Argue later." },
];
export const masterOf = id => MASTERS.find(m => m.id === id) || MASTERS[0];

// Tour chapters. A stop: { sel: css selector(s) of the spotlight target (none = a centred card), tab: view to open first, text, need?: key }.
// A stop whose tab is hidden or whose target is not on screen is silently skipped (same rule as the old tab tour).
export const CHAPTERS = [
  { id: "t1", icon: "🧭", name: "The way around", stops: [
    { sel: "#tabs", text: "Five doors: Play, World, Estate, Family, Bag. The sixth is the book." },
    { sel: "#subtabs", text: "Each door has rooms. Swipe the strip." },
    { sel: "#allbtn", tab: "inv", text: "Too many to fit? The little arrow lists them all, with dots where something waits." },
    { sel: "#gotobtn", text: "Can't find it? Ask the finder. Type 'wheat', 'wage', 'heir'." },
    { sel: "#tabs .ndot, #tabs .nbadge, #subtabs .ndot, #subtabs .nbadge", text: "A dot means something wants you. A number says how many." },
  ] },
  { id: "t2", icon: "⏱️", name: "Dock and timers", stops: [
    { sel: "#dock", text: "Down here, what's running: tasks, crafts, trips." },
    { sel: "#dock .bar", text: "Each bar is a job. Full means done." },
    { sel: "#top .res", soft: true, text: "Coin, food and wood are the three to watch." },
    { sel: "#toasts > *", soft: true, text: "News pops up and goes away. The log keeps it." },
  ] },
  { id: "t3", icon: "🏠", name: "Today (Play)", stops: [
    { sel: '[data-tour="hero"]', tab: "main", text: "That's you: your face, your doing, your timer." },
    { sel: '[data-sec="main.tasks"]', tab: "main", text: "The Tasks list: tap one and it runs by itself." },
    { sel: '#view [data-a="rest"]', tab: "main", text: "Rest when someone's hurt. The full sheet has every number." },
    { sel: '#view [data-a="market"]', tab: "main", text: "The Market buys what you can spare." },
  ] },
  { id: "t4", icon: "🏡", name: "Estate and rooms", stops: [
    { sel: "#view > .card, #view > details", tab: "estate", text: "Your estate's stage and score. Build more and it grows." },
    { sel: '[data-sec="land.owned"]', tab: "land", text: "Your plot and how many slots it holds." },
    { sel: '[data-sec="buildings.rooms"]', tab: "buildings", text: "A building card and its upgrade button." },
    { sel: "#view .estroom", tab: "land", text: "Tap a room to see who works there and what it makes." },
    { sel: '[data-sec="estate.capacity"]', tab: "estate", text: "Capacity: how much the larder and the beds can hold." },
  ] },
  { id: "t5", icon: "🎒", name: "The Bag", stops: [
    { sel: '[data-sec="inv.gear"]', tab: "inv", text: "Equipment slots: what each of you wears and carries." },
    { sel: '[data-sec="pack.vault"]', tab: "pack", text: "The pack is yours; the vault is the family's." },
    { sel: '[data-sec="materials.mats"]', tab: "materials", text: "Materials and goods, counted." },
    { sel: '[data-sec="sell.stock"]', tab: "sell", text: "Mark what to sell, and the market does the rest." },
  ] },
  { id: "t6", icon: "👪", name: "Family, guilds and quests", stops: [
    { sel: '[data-sec="members.members"]', tab: "members", text: "Your people, and the head of the house." },
    { sel: '[data-sec="members.members"]', tab: "members", text: "Heirs work from {teen} and can wed from {court}.", needs: ["teen", "court"] },
    { sel: '[data-sec="courtship.suitors"]', tab: "courtship", text: "Suitors come calling. Gifts help; so does patience." },
    { sel: "#view > .card", tab: "guilds", text: "Join a guild here, and rise through its ranks." },
    { sel: '[data-sec="quests.available"]', tab: "quests", text: "Quests are trips. Locked ones say why." },
  ] },
  { id: "t7", icon: "🗺️", name: "World and map", stops: [
    { sel: '#subtabs [data-tab="map"]', tab: "map", text: "The map lives under World." },
    { sel: "#worldmap", tab: "map", text: "Gold rings are quests. Drag to look around." },
    { sel: '#view [data-a="explore"]', tab: "map", text: "Explore walks the grey away." },
  ] },
  { id: "t8", icon: "📖", name: "The book (menu)", menu: true, stops: [
    { icon: "📖", title: "Title", text: "Resume, or begin another house." },
    { icon: "💾", title: "Load game", text: "Each slot is a house. Names are yours to change." },
    { icon: "⚙️", title: "Settings", text: "Text, motion, and the skip-title switch." },
    { icon: "📚", title: "Encyclopedia", text: "Everything you have met, and silhouettes of what you haven't." },
    { icon: "🏆", title: "Unlocks", text: "What each house has earned for the next." },
    { icon: "✍️", title: "Credits", text: "Who made it." },
  ] },
];
export const chapterOf = id => CHAPTERS.find(c => c.id === id);
export const OFFER = { title: "Orrin's walk", text: "Walk with me. I'll show you where everything is. Skip any time.", yes: "Walk with me", no: "I'll find my way" };

// Orrin Explains (two sentences each). `after` is a read-only check named in coach-logic.js.
export const EXPLAINERS = [
  { id: "e1", icon: "🧺", title: "Gathering", text: "Tasks run by themselves. Coin, food and wood come in each day, whether you watch or not.", after: "food", go: "main" },
  { id: "e2", icon: "📈", title: "Skills and XP", text: "Every task teaches a little. Skills level, and levels open better work.", after: "cook", go: "jobs" },
  { id: "e3", icon: "⬆️", title: "Upgrading", text: "Better tools and bigger rooms mean more for the same day. Spend a little on both.", after: "craft", go: "buildings" },
  { id: "e4", icon: "🏡", title: "The estate", text: "Land holds buildings, and buildings hold workers. A full estate pays you back in the dark months.", after: "estate", go: "estate" },
  { id: "e5", icon: "🏛️", title: "Guilds and rank", text: "A guild gives skills you can't learn alone. Rank comes from work, not coin.", after: "path", go: "guilds" },
  { id: "e6", icon: "📜", title: "Heirs, generations and saving", text: "You will not live forever, and that is the point. Heirs carry the name and the land. The book saves itself, but you can save it yourself from the ☰ menu.", after: "finale", go: "legacy" },
];
// Orrin's added line for each tutorial step (shown under the step) and the chapter its Show me opens
export const STEP_LINES = {
  food: ["That bread icon up top: days of food left. Keep it green.", "t3"],
  chop: ["Tools matter. No axe, no chopping.", "t5"],
  hunt: ["Furs sell. Meat feeds.", ""],
  cook: ["One meat, one stew. That's refining.", "t3"],
  rats: ["Quests are trips. You'll walk there and back. Tasks wait.", "t7"],
  scout: ["The grey is fog. Walk it away.", "t7"],
  craft: ["Good hands outlast good steel.", "t3"],
  trade: ["Sell a little, never everything.", "t3"],
  estate: ["That's the plot. It isn't yours yet. We'll fix that.", "t4"],
  path: ["Pick a road. You can walk another later.", "t6"],
};
export const FINALE_LINE = "That's the whole of the yard. The rest you'll learn by doing.";

// Ledger of Firsts: 10 rows. `done` names a check in coach-logic.js (reads the save, or a UI "first" flag recorded in fl_ui_v1).
export const LEDGER = [
  { id: "larder", label: "Fill the larder", line: "A full larder beats a full purse.", go: "main", ch: "t3" },
  { id: "train", label: "Sharpen what you've got", line: "Practice is the cheapest coin there is. Train something. Watch the bar.", go: "jobs", ch: "t3" },
  { id: "tools", label: "Mind your tools", line: "A good hand makes a better tool, a good tool makes a better hand.", go: "inv", ch: "t5" },
  { id: "refine", label: "Turn raw into worth", line: "Raw goods are half a thought. Finish it.", go: "craft", ch: "t3" },
  { id: "sell", label: "Sell a little", line: "Sell a little. Learn what Millbrook will pay.", go: "market", ch: "t5" },
  { id: "ground", label: "Ground of your own", line: "Every family needs ground of its own.", go: "land", ch: "t4" },
  { id: "build", label: "Build something", line: "A post in the ground is a promise. Raise one.", go: "buildings", ch: "t4" },
  { id: "heirs", label: "A name needs heirs", line: "A name needs more than one hand to hold it.", go: "courtship", ch: "t6" },
  { id: "guild", label: "Put your name on a guild roll", line: "The guilds remember who trained you. Put your name on a roll.", go: "guilds", ch: "t6" },
  { id: "save", label: "Save the Ledger", line: "Mind the book. Save it before you close it.", go: "@menu", ch: "t8" },
];
export const LEDGER_TITLE = "📒 Ledger of Firsts";
export const LEDGER_REACT = "Well done.";

// Ground Ledger (Orrin's hand-off): rows built from existing quests and state. No new quest, reward or gate.
export const GROUND_NOTE = "One more thing before I let you go. Ground first, then walls, then hands to work them. I've written it in the Ground Ledger. Start where you like.";
export const GROUND_TITLE = "📒 Ground Ledger";
export const GROUND = [
  { id: "plot", label: "Pay the reeve and take the plot", note: "The Starting Plot, from the Land page: 150 coin and a name on the roll. No renown needed.", go: "land", ch: "t4", quest: "st3" },
  { id: "bounds", label: "Walk the bounds", note: "Scout the land around home.", go: "map", ch: "t7" },
  { id: "bram", label: "Lend a hand to Bram", note: "A hauling errand. You keep his handcart.", go: "quests", quest: "haul_bram" },
  { id: "raise", label: "Raise something", note: "Your first building or field.", go: "buildings", ch: "t4" },
  { id: "hands", label: "Hire a pair of hands", note: "A hired minion works while you do other things.", go: "minions" },
  { id: "granary", label: "Shore up a granary", note: "A rank-0 guild job: the Leaning Granary or the Mill Bridge.", go: "guilds", quest: ["g_arch_granary", "g_hearth_bridge"] },
  { id: "market", label: "Make a first run to market", note: "A merchant's errand. You keep the wagon.", go: "quests", quest: "merchant_run" },
  { id: "hall", label: "A hall for the carters", note: "The Union Hall needs a Cart Shed, a second wagon and a teamster.", go: "union" },
  { id: "village", label: "A village of your own (far off)", note: "The Treant's Oath and the Baron's Charter. Greenvale needs renown 1,200.", go: "quests", quest: ["st8", "q_charter"], later: true },
];

// Orrin chimes in: one note per newly opened part. `kind:"intro"` rows are voiced over the existing unlock-intro lines (data/intros.json, read only).
export const CHIMES = [
  { id: "craft", kind: "intro", icon: "🔨", title: "Crafting", line: "Someone's got hands for it now. Open the Crafting tab, make something, however small.", go: "craft", steps: ["Open Crafting", "Make something"], ch: "t3" },
  { id: "guilds", kind: "intro", icon: "🏛️", title: "Guild access", line: "Guilds teach what I can't. Pick one that fits your hands.", go: "guilds", steps: ["Open Guilds", "Join one", "Take a rank-0 guild job"], quests: ["g_hearth_bridge", "g_vanguard_patrol", "g_lodge_hunt", "g_church_plague", "g_collegium_notes", "g_rogues_heist", "g_arch_survey"], ch: "t6" },
  { id: "food", kind: "intro", icon: "🍲", title: "Food and meals", line: "The land's yours; now feed it. Rations and the menu set how content the house is.", go: "estate", steps: ["Open Estate", "Pick a ration"] },
  { id: "minions", kind: "intro", icon: "🧑‍🤝‍🧑", title: "Workers", line: "Hands cost coin and food, and pay in time.", go: "minions", steps: ["Open Minions", "Hire one"], quests: ["st2"] },
  { id: "houses", kind: "intro", icon: "💌", title: "Courtship", line: "A suitor's at the door. Court slowly; gifts help, but so does patience.", go: "courtship", steps: ["Open Courtship", "Start courting"], quests: ["rq_manor_letter", "rq_manor_gala"], ch: "t6" },
  { id: "dynasty", kind: "intro", icon: "🏰", title: "Houses and dynasty", line: "Other houses are watching now. Be kind, or be careful.", go: "houses", steps: ["Open Houses", "Reach Friendly with one house"] },
  { id: "enchanting", kind: "intro", icon: "✨", title: "Enchanting", line: "Runes bind to steel if you ask the right way.", go: "enchant", steps: ["Place a Rune Desk", "Enchant a piece"], quests: ["g_collegium_notes"] },
  { id: "paths", kind: "intro", icon: "🧭", title: "Craft paths", line: "The Crafters' Guild ranks you by what you make, not what you owe.", go: "main", steps: ["Pick a craft path", "Make its goods"] },
  { id: "farmstead", icon: "🌾", title: "Farmstead", line: "That's a farmstead now. Fields, a granary, a second pair of hands.", go: "fields", steps: ["Open Fields", "Shore up a granary"], quests: ["g_arch_granary"] },
  { id: "union", icon: "🤝", title: "Union Hall", line: "Carters keep a hall in towns this size. Yours could too.", go: "union", steps: ["Haul for Bram", "Make a first run to market", "Buy the Warehouse tier"], quests: ["haul_bram", "merchant_run"] },
  { id: "automation", icon: "⚙️", title: "Automation", line: "Once the work's steady, let the hands run it. Set orders; watch the dock.", go: "auto", steps: ["Open Automation", "Set one order or quota", "Check the dock"], ch: "t2" },
  { id: "landgate", icon: "📜", title: "Land and renown", line: "The reeve asks for a name first. Bigger ground costs more than coin; it wants renown too.", go: "quests", steps: ["Open Quests", "Finish a quest or a board job", "Come back to the Land page"] }, // R79 placeholder text (Jeremy's OK)
  { id: "heirs", icon: "🎓", title: "Heirs and journeyman work", line: "At 14 an heir can take a master. At the half-way mark they are a journeyman and earn a little.", go: "members", steps: ["Open Family", "Place your heir with a master", "Later: a journeyman job on the Jobs tab"] }, // R78: line is a placeholder for Jeremy's OK
  { id: "legacy", icon: "🪦", title: "Legacy", line: "The Graveyard remembers. What the dead earned, the living can spend.", go: "legacy", steps: ["Open Legacy", "Buy a first permanent upgrade"] },
  { id: "sea", icon: "🌊", title: "The sea", line: "Salt air. Old Tobiah knows the reef; go and listen.", go: "quests", steps: ["Follow the reef chain"], quests: ["reef1", "reef2", "reef3", "reef4"] },
  { id: "economy", icon: "🪙", title: "The Gilded Hall", line: "That's a great deal of gold to be sitting on. Somebody's counting it.", go: "quests", steps: ["Follow the Gilded Hall chain"], quests: ["inv1", "inv2", "inv3", "inv4", "inv5"] },
  { id: "highlands", icon: "⛰️", title: "The highlands", line: "The dwarves keep their own counsel. Earn it.", go: "quests", steps: ["Bread for the Deep Halls", "Take the Thane's Oath"], quests: ["ht_ironbrow1", "ht_ironbrow2", "b_oath"] },
  { id: "oldones", icon: "🌀", title: "The old ones", line: "Something older lives below the tide line. Do not shout at it.", go: "quests", steps: ["Seek an audience"], quests: ["hy_audience", "hy_fight"] },
];
export const GROUND_NOTE_ID = "ground";
export const NOTE_ID = /^[a-z][a-z0-9]{1,14}$/;

// Pack hook: an expansion adds { id, icon, title, line, go, steps?, quests?, when:{town,story,done,item,lvl,era,land} } (same keys as a quest req).
export const PACKS = [];
export function registerOrrinPack(entry) {
  if (!entry || !NOTE_ID.test(String(entry.id)) || PACKS.some(p => p.id === entry.id) || CHIMES.some(c => c.id === entry.id)) return false;
  PACKS.push(Object.assign({ kind: "pack", icon: "📜", steps: [], quests: [] }, entry));
  return true;
}
export const allChimes = () => CHIMES.concat(PACKS);
