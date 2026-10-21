// R52 (fl-stub-regions-proposal round 3b, rest): Dwarfhold — Clan Ironbrow as a house, 3 villagers (Thane, Hild, Ottar),
// the Runecarver path + runes, the Old Deeps → the Deep Door, dwarf retainers, the War-Chariot, Oath of the Thane, save step 48.
import fs from "fs"; import * as E from "../js/engine.js"; import { BUILD } from "../js/config.js";
import { STEPS } from "../js/engine/save-steps.js";
const R=new URL("../data/",import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const Y=D.tuning.daysPerYear, Q=id=>D.quests.find(q=>q.id===id);
const base=()=>{const s=E.newGame(1);E.normalize(s);E.skipTutorial&&E.skipTutorial(s);const m=s.members[0];m.ageDays=25*Y;s.res.coin=1e5;for(const k of ['ale','barley','silver','gems','bread','preserves','runestone'])s.res[k]=1e3;return s;};
ok(BUILD==='R52'&&E.SCHEMA===48,'R52, save step 48');
ok(D.changelog.entries[0].build==='R52','changelog R52');
// house
const H=D.families.list.find(h=>h.id==='ironbrow');
ok(H&&H.town==='dwarfhold'&&H.start===0,'Clan Ironbrow seated at Dwarfhold, Neutral');
{ const s=base(); ok(E.tierOf(s,'ironbrow')==='neutral','starts Neutral'); E.chooseOption?0:0; }
ok(Q('gate7').choice.options.find(o=>o.id==='sell').fx.cold==='ironbrow','selling the secret makes the clan Cold');
{ const s=base(); s.flags={soldGate:true}; delete s.houses.ironbrow; STEPS.find(x=>x.n===48).run(s); ok(E.tierOf(s,'ironbrow')==='cold','step 48: sold → Cold'); }
{ const s=base(); s.flags={}; delete s.houses.ironbrow; s.gateOpen=3; STEPS.find(x=>x.n===48).run(s); ok(E.tierOf(s,'ironbrow')==='neutral'&&s.revealed.includes('d_olddeeps'),'step 48: kept → Neutral; open gate sees the Old Deeps'); }
// villagers
for(const v of ['thane','hild','ottar'])ok(D.requests.npcs.some(x=>x.id===v&&x.town==='dwarfhold'),'villager '+v);
// paths & pieces
{ const s=base(); const m=s.members[0]; m.craft={id:'hearth',rank:0,rep:0}; ok(/learn/.test(E.openPathIssue(s,m,'runecarver')||''),'Runecarver needs Hild');
  s.reqPerks=[...(s.reqPerks||[]),{from:'hild3'}]; ok(!/learn/.test(E.openPathIssue(s,m,'runecarver')||''),"Hild's lessons open it");
  ok(E.pieceLock(s,E.pieceDef('runeanvil'))==null||!/villager/.test(E.pieceLock(s,E.pieceDef('runeanvil'))),'anvil unlocked by Hild'); }
{ const s=base(); ok(/villager/.test(E.pieceLock(s,E.pieceDef('dwarfcask'))||''),'cask locked before Ottar'); }
// runes
{ const s=base(); s.vault.push('steel_sword'); ok(/Runecarver/.test(E.inlayIssue(s,'steel_sword','runestone')||''),'runes need a Runecarver');
  const d=E.inlaidDef('steel_sword~runestone'), b=D.items.find(i=>i.id==='steel_sword'); ok(d&&(!b.cp||d.cp>b.cp),'a rune raises an item'); }
// retainers
{ const s=base(); s.flags={}; s.houses.ironbrow={r:-25,state:'peace'}; ok(E.hireLock(s,E.mtype('dwarfminer')),'Cold clan: no dwarf miners');
  s.houses.ironbrow.r=0; ok(!E.hireLock(s,E.mtype('dwarfminer'))&&E.hireLock(s,E.mtype('dwarfshield')),'Neutral: miners, not shieldbearers');
  s.houses.ironbrow.r=40; ok(!E.hireLock(s,E.mtype('dwarfshield')),'Friendly: shieldbearers'); }
// oath
{ const s=base(); const c0=E.minionCap(s); ok(E.swearOath(s)&&E.minionCap(s)===c0+2&&s.unlocks.includes('recipe:r_warchariot')&&s.boons.some(b=>b.quest==='st10'),'Oath: +2 retainers, War-Chariot, chapter 10 help'); ok(!E.swearOath(s),'once'); }
ok(Q('b_oath')&&Q('b_oath').oath,'Oath of the Thane quest');
ok(D.world.haul.tiers.some(t=>t.id==='warchariot'),'War-Chariot haul tier');
// deeps
{ const s=base(); E.openGate(s); ok(['d_olddeeps','n_deepiron','n_dwarfcoal'].every(x=>s.revealed.includes(x)),'opening the gate reveals the Old Deeps and the lodes'); }
ok(D.dungeons.find(d=>d.id==='d_olddeeps').reveals==='l_deepdoor'&&D.world.locations.find(l=>l.id==='l_deepdoor'),'the Old Deeps end at the Deep Door');
{ const s=base(); s.gateOpen=1; const l=E.deserialize(E.serialize(s)); ok(l.schema===48,'save/load'); }
console.log('r52 ok',pass);
ok(/FATHER/.test(D.world.locations.find(l=>l.id==='l_deepdoor').desc)&&/Saltmere/.test(D.world.locations.find(l=>l.id==='l_deepdoor').desc),'the Deep Door foreshadows Dagon and Saltmere');
