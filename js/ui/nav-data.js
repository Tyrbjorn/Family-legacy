// R77 navigation data (pure: no imports, no DOM, so node tests can load it).
// VIEWS: every sub-tab (the old tab ids are all kept) -> [icon, label, group, one-line help, search words].
// GROUPS: the five bottom-bar groups, in order. The menu button (☰) is a sixth slot drawn by render.js.
// SECTIONS: every collapsible card group -> [view it lives in, icon, title, search words, open by default].
//   A section id has exactly one home. sect() (sect.js) draws it; "Go to…" and the tests read this table.
export const VIEWS = {
  main: ["🧝", "Today", "play", "What to do right now: tasks, chores and your hero", "home today tasks chores hero doing ledger"],
  jobs: ["💼", "Jobs & training", "play", "Earn coin, or train a skill", "work coin pay job training xp drills"],
  craft: ["🔨", "Craft", "play", "Recipes, queues, stations and craft paths", "crafting recipes quality stations queue paths"],
  market: ["🛒", "Market", "play", "Buy gear and see where goods sell best", "buy shop items prices best places sell"],
  map: ["🗺️", "Map", "world", "Travel, towns, resource nodes and areas", "travel regions towns explore nodes fog"],
  quests: ["📜", "Quests", "world", "Active, available and finished quests", "quests requests chains rumours active available"],
  story: ["📖", "Story", "world", "The Lost House, chapter by chapter", "lost house chapters main story"],
  guilds: ["⚔️", "Guilds", "world", "Guild halls, ranks and perks", "guild halls ranks adventurers crafters warriors"],
  houses: ["🏰", "Houses", "world", "Families of the realm, standing and rivals", "realm standing rapport rivals usurper alliances"],
  events: ["🌍", "Events & hauling", "world", "World events, caravans, sea and trade routes", "world events caravans hauling sea trade routes encounters"],
  estate: ["🏡", "Overview", "home", "Your holdings at a glance: food, land, capacity", "estate holdings food land capacity village"],
  buildings: ["🛖", "Buildings", "home", "Rooms, stations, outdoor buildings and upkeep", "buildings stations rooms synergies build upkeep outdoor"],
  land: ["🗾", "Land & map", "home", "Buy land and see your estate on a map", "land parcels estate map plots"],
  fields: ["🌾", "Fields & animals", "home", "Crops, pens, bees and chores", "fields wheat crops farm animals pens bees chores"],
  union: ["🤝", "Union Hall", "home", "Trade union dealings", "union hall guild trade"],
  minions: ["🧑‍🤝‍🧑", "Workers", "home", "Followers, jobs and hiring", "minions followers workers hire wage wages pay jobs upgrades eggs"],
  auto: ["⚙️", "Production", "home", "Automation, quotas and work orders", "automation production quotas orders auto tend"],
  char: ["🧑", "Character", "kin", "Stats, proficiency, leans and talents", "character sheet stats combat proficiency leans talents"],
  members: ["👪", "Members & orders", "kin", "Everyone at home and their standing orders", "members heirs family orders beds ancestors standing"],
  family: ["🌳", "Tree", "kin", "The family tree", "family tree generations"],
  courtship: ["💌", "Courtship", "kin", "Suitors and marriage", "courtship heirs suitors marriage spouse"],
  chron: ["📖", "Chronicle", "kin", "Deeds and achievements", "chronicle deeds achievements history"],
  legacy: ["🏛️", "Legacy", "kin", "Legacy renown and upgrades", "legacy renown upgrades tithe"],
  inv: ["⚔️", "Gear", "inv", "Who wears what", "inventory gear equipment equipped"],
  materials: ["🧱", "Materials", "inv", "Resources and goods in store", "materials resources goods stock caps"],
  pack: ["🎒", "Pack & vault", "inv", "Personal pack and the family vault", "pack bag vault items filter"],
  sell: ["🏷️", "Sell", "inv", "Stock for sale and sellers", "sell stock for sale stall sellers"],
  enchant: ["✨", "Enchant", "inv", "Enchanting and gear sets", "enchant sets gear inlay"],
};
export const GROUPS = [
  ["play", "🧝", "Play", ["main", "jobs", "craft", "market"]],
  ["world", "🗺️", "World", ["map", "quests", "story", "guilds", "houses", "events"]],
  ["home", "🏰", "Estate", ["estate", "buildings", "land", "fields", "union", "minions", "auto"]],
  ["kin", "🌳", "Family", ["char", "members", "family", "courtship", "chron", "legacy"]],
  ["inv", "🎒", "Bag", ["inv", "materials", "pack", "sell", "enchant"]],
];
export const SHEET_MIN = 5; // the "▾ All" button and sheet appear when a group has more than 4 visible sub-tabs
export const groupOfView = t => (GROUPS.find(g => g[3].includes(t)) || GROUPS[0])[0];

// [view, icon, title, words, open by default]
export const SECTIONS = {
  "main.ledger": ["main", "📒", "Ledger of Firsts", "ledger firsts checklist first hour orrin", true],
  "main.ground": ["main", "📒", "Ground Ledger", "ground ledger plot land orrin hand-off", true],
  "main.tasks": ["main", "🧺", "Tasks", "tasks resources chores fields orders", true],
  "main.paths": ["main", "🛠️", "Craft paths", "paths craft rank specialty", true],
  "main.class": ["main", "🎖️", "Guild tiers", "class guild tier", true],
  "main.recent": ["main", "📜", "Recent", "log recent news", true],
  "jobs.jobs": ["jobs", "💼", "Jobs", "jobs pay work", true],
  "jobs.journeyman": ["jobs", "🎓", "Journeyman jobs", "journeyman teen apprentice master jobs wage", true],
  "jobs.training": ["jobs", "🎯", "Training", "training xp drills skills", true],
  "market.buy": ["market", "🛒", "Buy items", "buy shop gear", true],
  "market.best": ["market", "💱", "Best places to sell", "sell prices market summary", true],
  "quests.ground": ["quests", "📒", "Ground Ledger", "ground ledger plot land orrin", true],
  "quests.requests": ["quests", "📮", "Requests", "requests deliver", true],
  "quests.chains": ["quests", "⛓️", "Chains", "chains", true],
  "quests.active": ["quests", "⚔️", "Active", "active", true],
  "quests.available": ["quests", "📜", "Available", "available", true],
  "quests.done": ["quests", "✅", "Completed", "completed done", false],
  "events.haul": ["events", "🚚", "Hauling & sea", "haul wagon sea", true],
  "events.trade": ["events", "💱", "Trade routes", "trade routes", true],
  "events.world": ["events", "🌍", "World events", "events encounters buffs", true],
  "events.lines": ["events", "🧵", "Trade lines", "lines", true],
  "houses.realm": ["houses", "🏰", "Families of the realm", "houses realm", true],
  "houses.major": ["houses", "⭐", "Major houses", "major houses", true],
  "houses.minor": ["houses", "🏠", "Minor houses", "minor houses", true],
  "houses.usurper": ["houses", "🦩", "The usurper", "usurper", true],
  "estate.food": ["estate", "🍞", "Food", "food larder recipes meals", true],
  "estate.village": ["estate", "🏘️", "Village", "village", true],
  "estate.endgame": ["estate", "🏆", "Endgame", "endgame", true],
  "estate.capacity": ["estate", "📦", "Capacity", "capacity food materials cap beds", true],
  "buildings.synergies": ["buildings", "✨", "Active synergies", "synergies pieces", true],
  "buildings.rooms": ["buildings", "🛖", "Buildings & stations", "rooms stations pieces build new", true],
  "buildings.outdoor": ["buildings", "🌾", "Outdoor buildings", "outdoor upkeep", true],
  "land.owned": ["land", "🗺️", "Your land", "land owned slots", true],
  "land.shop": ["land", "📜", "Land for sale", "land buy parcel", true],
  "fields.fields": ["fields", "🌾", "Fields & animals", "fields pens", true],
  "union.hall": ["union", "🤝", "Union Hall", "union", true],
  "auto.quotas": ["auto", "📋", "Quotas", "quotas steward ledger", true],
  "auto.orders": ["auto", "📦", "Work orders", "orders", true],
  "members.members": ["members", "👪", "Family & standing orders", "members orders", true],
  "members.ancestors": ["members", "🕯️", "Ancestors", "ancestors dead", false],
  "courtship.suitors": ["courtship", "💌", "Suitors", "suitors", true],
  "inv.gear": ["inv", "⚔️", "Gear", "gear equipped", true],
  "materials.mats": ["materials", "🧱", "Materials & goods", "materials goods", true],
  "pack.pack": ["pack", "🎒", "Personal pack", "pack bag", true],
  "pack.vault": ["pack", "🏛️", "Family vault", "vault", true],
  "sell.stock": ["sell", "🏷️", "Stock for sale", "for sale stock", true],
  "enchant.enchant": ["enchant", "✨", "Enchanting & sets", "enchant sets", true],
};

// Go to… index: every sub-tab, every registered section, and a few extra phrases that name a place
export const ALIASES = [
  ["save", "💾 Save, export & import", "menu", "export import backup code file"],
  ["settings", "⚙️ Settings", "menu", "settings options difficulty notifications"],
  ["encyclopedia", "📚 Encyclopedia", "menu", "encyclopedia help codex"],
  ["rest", "🛌 Rest", "main", "rest sleep heal"],
];
export function jumpIndex() {
  const out = [];
  for (const [g, gi, gn, ids] of GROUPS)
    for (const id of ids) { const v = VIEWS[id]; out.push({ kind: "view", id, view: id, icon: v[0], label: v[1], path: gn, words: v[4] + " " + v[3] + " " + gn }); }
  for (const [id, [view, icon, title, words]] of Object.entries(SECTIONS)) {
    const v = VIEWS[view], g = GROUPS.find(x => x[0] === groupOfView(view));
    out.push({ kind: "sec", id, view, icon, label: title, path: g[2] + " › " + v[1], words: words + " " + v[4] });
  }
  for (const [id, label, view, words] of ALIASES) out.push({ kind: view === "menu" ? "menu" : "view", id, view, icon: "", label, path: view === "menu" ? "☰ Menu" : "Play", words });
  return out;
}
const norm = x => String(x || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
export function jumpSearch(q, idx = jumpIndex(), limit = 12) {
  const t = norm(q).split(" ").filter(Boolean);
  if (!t.length) return [];
  const score = e => {
    const lab = norm(e.label), wd = norm(e.words); let sc = 0;
    for (const w of t) {
      if (lab.startsWith(w)) sc += 5; else if (lab.split(" ").some(x => x.startsWith(w))) sc += 4; else if (lab.includes(w)) sc += 3;
      else if (wd.split(" ").some(x => x.startsWith(w))) sc += 2; else if (wd.includes(w)) sc += 1; else return 0;
    }
    return sc + (e.kind === "view" ? 0.5 : 0);
  };
  return idx.map(e => [score(e), e]).filter(x => x[0] > 0).sort((a, b) => b[0] - a[0]).slice(0, limit).map(x => x[1]);
}
