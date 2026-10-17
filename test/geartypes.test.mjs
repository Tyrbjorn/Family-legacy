// Item types: base stats, materials (strength + weight), weight → speed, armor classes + dodge, class fit,
// proficiency, spell failure, Battle Mage, Auto Equip, two-handed, enemy armor, old-save migration, item cards.
import fs from "fs";
import * as E from "../js/engine.js";
const root = new URL("..", import.meta.url).pathname;
const D = {};
for (const f of fs.readdirSync(root + "data").filter(f => f.endsWith(".json"))) D[f.replace(".json", "")] = JSON.parse(fs.readFileSync(root + "data/" + f));
for (const f of D.estate.structureFiles) D["structures/" + f] = JSON.parse(fs.readFileSync(root + "data/structures/" + f + ".json"));
E.setData(D);
let pass = 0, fail = 0;
const ok = (c, m) => (c ? pass++ : (fail++, console.log("FAIL " + m)));
const G = id => E.gstats(id), it = id => E.itemDef(id);
// 1 base stats per type
ok(G("iron_greatsword").hit > 2 * G("iron_dagger").hit, "greatsword hits far harder than a dagger");
ok(G("iron_greatsword").spd < G("iron_dagger").spd / 2, "…but swings at less than half the rate");
const dps = ["dagger", "spear", "sword", "mace", "longsword", "pike", "greatsword"].map(t => G("iron_" + t).dps);
ok(Math.max(...dps) / Math.min(...dps) < 1.3, "iron DPS comparable across types (<30% spread)");
ok(it("hunting_knife").cp < it("iron_sword").cp, "knife below sword (audit fix)");
ok(it("hearth_apron").cp < it("plate_cuirass").cp / 2, "apron is clothing, not plate (audit fix)");
ok(it("stormglass_orb").cp <= 26 && D.items.filter(i => i.slot === "accessory").every(i => (i.cp || 0) <= 18), "orb / accessories capped (audit fix)");
ok(D.items.filter(i => ["weapon", "offhand", "armor"].includes(i.slot)).every(i => i.type && D.gear.kinds.types[i.type]), "every weapon/offhand/armor has a type");
ok(["throwing", "shortspear", "longspear"].every(t => D.items.some(i => i.type === t)), "throwing, short and long spear items exist");
// 2 materials: strength and weight
ok(G("mithril_longsword").hit > G("steel_longsword").hit && G("mithril_longsword").wt < G("steel_longsword").wt, "mithril stronger and lighter than steel");
ok(G("adamantium_sword").hit > G("mithril_sword").hit && G("adamantium_sword").wt > G("iron_sword").wt, "adamantium strongest but heavy");
// 3 weight → speed
ok(G("adamantium_sword").spd < G("mithril_sword").spd && Math.abs(G("mithril_greatsword").dps / G("adamantium_greatsword").dps - 1) < 0.1, "adamantium swings slower; DPS close to mithril unarmored");
ok(G("adamantium_sword").pierce === 0.3 && G("iron_mace").pierce > 0, "adamantium ignores 30% armor; maces pierce");
{ const f = { ...E.newGame(1).members[0], cls: "fighter" }, v = (w, A) => ((f.equip = { weapon: w }), E.itemCpFor(f, w) - E.armorLoss(f, A));
  ok(v("c|adamantium_greatsword|masterwork", 10) > v("c|mithril_greatsword|masterwork", 10) && v("c|adamantium_greatsword|masterwork", 30) > v("c|mithril_greatsword|masterwork", 30), "adamantium beats mithril against armored foes (A 10+)"); }
// 4 armor classes
const s = E.newGame(1_700_000_000_000);
const m = s.members[0];
m.ageDays = 25 * 360; m.stats.AGI = 0;
ok(G("travelers_pack_coat").cls === "unarmored" && G("leather_jerkin").cls === "light" && G("iron_chainmail").cls === "medium" && G("iron_plate").cls === "heavy", "armor classes assigned");
ok(G("travelers_pack_coat").dodge > G("leather_jerkin").dodge && G("leather_jerkin").dodge > 0 && G("iron_plate").dodge === 0, "unarmored dodge > light > heavy (0)");
ok(G("iron_plate").def > G("iron_chainmail").def && G("iron_chainmail").def > G("green_leathers").def && G("green_leathers").def > G("travelers_pack_coat").def, "defense heavy > medium > light > unarmored");
const d0 = E.memberDodge(m, "leather_jerkin");
m.stats.AGI = 30; m.skills.evasion.lvl = 30; m.traits = ["nimble"];
const d1 = E.memberDodge(m, "leather_jerkin");
ok(d1 > d0 * 2 && d1 <= 0.35 + 1e-9, "AGI, Evasion and Nimble scale light dodge, capped 35%");
ok(E.memberDodge(m, "iron_plate") === 0, "heavy armor has no dodge");
// heavy armor: no attack-speed penalty (only weapon weight drives speed)
m.cls = "fighter"; m.equip = { weapon: "iron_sword" };
const pw0 = E.cp(s, m) - E.itemCpFor(m, "iron_sword");
m.equip.armor = "iron_plate";
ok(Math.abs(E.cp(s, m) - pw0 - E.itemCpFor(m, "iron_sword") - E.itemCpFor(m, "iron_plate")) <= 1, "plate adds its own CP only, no weapon slowdown");
// 5 class fit
ok(E.famFit(m, "blade") === "primary" && E.famFit(m, "arcane") === "off", "fighter: blades primary, staves off-class");
m.cls = "archmage";
ok(Math.abs(E.itemCpFor(m, "iron_plate") - it("iron_plate").cp * 0.5) < 1, "off-class at −50%");
ok(E.famFit(m, "unarmored") !== "off" && E.famFit(m, "kit") !== "off", "unarmored and kits usable by every class");
m.cls = "fighter";
ok(E.itemCpFor(m, "mage_robe") < E.itemCpFor({ ...m, cls: "archmage" }, "mage_robe"), "robes keep their caster bonus for casters only");
// 6 proficiency
m.wprof = {}; m.equip = { weapon: "iron_spear", armor: "iron_chainmail" };
const c0 = E.itemCpFor(m, "iron_spear");
for (let i = 0; i < 200; i++) E.gainProf(m);
ok(m.wprof.spear === 100 && m.wprof.medium === 100, "proficiency grows with use, to the class cap (primary 100)");
ok(E.itemCpFor(m, "iron_spear") > c0 * 1.25, "proficiency raises the item's power (up to +30%)");
m.equip = { weapon: "iron_javelins" }; for (let i = 0; i < 200; i++) E.gainProf(m);
ok(m.wprof.throwing === 60, "secondary cap 60 (fighter throwing)");
m.cls = "archmage"; m.equip = { weapon: "iron_pike" }; m.wprof = {}; for (let i = 0; i < 200; i++) E.gainProf(m);
ok(m.wprof.polearm === 25, "off-class cap 25 (archmage long spear)");
// spell failure
m.cls = "archmage"; m.wprof = {};
ok(E.spellFail(m, "mage_robe") === 0 && E.spellFail(m, "leather_jerkin") === 0.1 && E.spellFail(m, "iron_chainmail") === 0.25 && E.spellFail(m, "iron_plate") === 0.4, "spell failure 0 / 10 / 25 / 40%");
ok(E.spellFail(m, "mithril_plate") === 0.2, "mithril halves it");
m.wprof = { heavy: 25 };
ok(E.spellFail(m, "iron_plate") < 0.4, "armor proficiency reduces it");
m.cls = "fighter"; m.equip = { armor: "iron_plate" };
ok(E.memberFail(m) === 0, "non-casters never fail");
m.cls = "archmage";
const q = { cp: 10, skill: "arcana" };
const sOk = E.successChance(s, m, q);
m.equip = {};
ok(E.successChance(s, m, q) > sOk, "spell failure lowers a caster's fight odds");
// Battle Mage
const bm = D.classes.find(c => c.id === "battlemage"), am = D.classes.find(c => c.id === "archmage");
ok(bm && bm.tier === am.tier && bm.from === am.from, "Battle Mage: Archmage-tier alternative");
m.cls = "battlemage"; m.equip = { armor: "iron_plate" };
ok(E.spellFail(m) === 0 && E.famFit(m, "heavy") === "primary" && ["blade", "blunt", "spear", "shield"].every(f => E.famFit(m, f) === "primary"), "Battle Mage: all armor, no spell failure, swords/maces/spears/shields");
ok(E.itemCpFor(m, "mage_robe") < E.itemCpFor({ ...m, cls: "archmage" }, "mage_robe"), "Battle Mage: no robe caster bonus");
m.equip = {};
const gain = c => { m.cls = c; m.skills.arcana.lvl = 75; const lo = E.cp(s, m); m.skills.arcana.lvl = 99; return E.cp(s, m) - lo; };
ok(gain("battlemage") < gain("archmage") / 3, "Battle Mage: limited spell list (magic counts to level 75; top-tier spells Archmage-only)");
// 7 Auto Equip
const A = E.newGame(1_700_000_000_000), a = A.members[0];
a.ageDays = 25 * 360; a.cls = "archmage"; a.equip = {}; a.autoEq = {};
A.vault = ["iron_plate", "mage_robe", "iron_greatsword", "oak_staff", "runed_orb", "kite_shield"];
E.autoEquipMember(A, a);
ok(a.equip.armor === "mage_robe", "Auto Equip: caster prefers robe over off-class, miscasting plate");
ok(a.equip.weapon === "oak_staff" && a.equip.offhand === "runed_orb", "Auto Equip: in-class staff + orb over off-class greatsword/shield");
a.cls = "fighter"; a.autoEq = { weapon: true, armor: true, offhand: true }; A.vault.push(...Object.values(a.equip)); a.equip = {};
A.vault = A.vault.filter(x => x !== undefined);
E.autoEquipMember(A, a);
ok(a.equip.armor === "iron_plate" && a.equip.weapon !== "oak_staff", "Auto Equip: fighter takes plate and a martial weapon");
ok(!(a.equip.weapon && a.equip.offhand && E.clash(a.equip.weapon, a.equip.offhand)), "Auto Equip never pairs a 2H weapon with a blocked offhand");
// two-handed
const B = E.newGame(1_700_000_000_000), b = B.members[0];
b.equip = { offhand: "kite_shield" }; B.vault.push("iron_greatsword");
E.equip(B, b, "iron_greatsword");
ok(!b.equip.offhand && b.bag.includes("kite_shield"), "greatsword frees the shield");
// enemy armor
b.cls = "fighter"; b.equip = { weapon: "iron_dagger" };
const ld = E.armorLoss(b, 8) / E.itemCpFor(b, "iron_dagger");
b.equip = { weapon: "adamantium_greatsword" };
ok(E.armorLoss(b, 8) / E.itemCpFor(b, "adamantium_greatsword") < ld, "armor hurts daggers more than adamantium greatswords");
// 8 old save
const O = E.newGame(1_700_000_000_000), o = O.members[0];
o.cls = "fighter"; o.skills.swordsmanship.lvl = 20; o.equip = { weapon: "vanguard_greatsword", offhand: "tower_shield" }; delete o.wprof; O.day = 100;
O.schema = 27; E.normalize(O);
ok(o.wprof.blade === 40 && !o.equip.offhand && O.vault.includes("tower_shield") && O.schema >= 28, "migration: proficiency from skills, 2H frees the offhand");
// cards
const L = E.itemStats("adamantium_greatsword", o).map(x => x.t).join(" | ");
ok(/dmg/.test(L) && /\/s/.test(L) && /DPS/.test(L) && /⚖️/.test(L) && /ignores 30% armor/.test(L) && /Blade/.test(L), "card: damage, speed, DPS, weight, pierce, proficiency");
const L2 = E.itemStats("mithril_plate").map(x => x.t).join(" | ");
ok(/Heavy/.test(L2) && /def/.test(L2) && /dodge 0%/.test(L2) && /spell failure 20%/.test(L2), "card: armor class, defense, dodge, spell failure");
// woods: strength + weight like metals; ironwood strong but heavy; elderwood light with a caster bonus
const W = D.gear.kinds.mats;
ok(["pine", "ash", "oak", "greenwood", "rowan", "yew", "heartwood", "ironwood", "elderwood"].every(k => W[k] && W[k].wood && W[k].str && W[k].wt), "wood table: strength + weight");
ok(W.ironwood.str > W.yew.str && W.ironwood.wt > W.oak.wt && W.elderwood.wt < W.oak.wt && W.elderwood.caster > 0, "ironwood strong/heavy, elderwood light + caster");
const st1 = E.baseStats(D.gear.kinds, { type: "staff", mat: "ironwood" }), st2 = E.baseStats(D.gear.kinds, { type: "staff", mat: "pine" });
ok(st1.hit > st2.hit && st1.spd < st2.spd, "wood changes staff hit and speed");
ok(D.items.filter(i => ["bow", "longbow", "staff", "wand", "buckler", "tower"].includes(i.type) && i.mat && W[i.mat].wood).length >= 12, "wooden items carry a wood");
const cm = { ...m, cls: "archmage", equip: {} }, fm = { ...m, cls: "fighter", equip: {} };
ok(E.itemCpFor(cm, "collegium_staff") > E.itemCpFor({ ...cm, cls: "battlemage" }, "collegium_staff") * 1.0 && G("collegium_staff").caster === 0.15, "elderwood caster bonus for casters (not Battle Mage)");
ok(/🌳 elderwood/.test(E.itemStats("collegium_staff").map(x => x.t).join(" ")) && /caster \+15%/.test(E.itemStats("collegium_staff").map(x => x.t).join(" ")), "card shows wood + caster bonus");
console.log(`geartypes: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
