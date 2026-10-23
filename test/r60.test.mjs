// R60: legacy branches, Honor/faith, Respect, quest tiers, rival locks, special classes, carry-over bonuses, step 55
import fs from 'fs'; import * as E from '../js/engine.js'; import { BUILD } from '../js/config.js'; import { STEPS } from '../js/engine/save-steps.js';
const root=new URL('../',import.meta.url).pathname; const D={};
for(const f of fs.readdirSync(root+'data').filter(f=>f.endsWith('.json'))) D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(root+'data/'+f));
for(const f of D.estate.structureFiles) D['structures/'+f]=JSON.parse(fs.readFileSync(root+'data/structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const Y=D.tuning.daysPerYear;
const fresh=()=>{const s=E.newGame(1);E.normalize(s);E.skipTutorial&&E.skipTutorial(s);s.res.coin=1e5;return s;};
const strong=s=>{const m=s.members[0];m.ageDays=30*Y;for(const k in m.stats)m.stats[k]=900;for(const k in m.skills)m.skills[k].lvl=99;return s;};
ok(BUILD==='R60'&&E.SCHEMA===55&&STEPS.at(-1).n===55,'R60, save step 55'); ok(JSON.parse(fs.readFileSync(root+'data/changelog.json')).entries[0].build==='R60','changelog first');
// data shape
ok(D.factions.list.length===19,'19 factions'); for(const f of D.factions.list){ok(typeof f.honorWeight==='number','honorWeight '+f.id); for(const r of [...(f.rivals||[]),...(f.allies||[])]) ok(E.factionDef(r),'rel exists '+f.id+'>'+r);}
ok(D.r60.branches.length===6&&D.r60.endings.length===4,'6 branches, 4 endings'); ok(D.r60.branches.some(b=>b.id==='br_highland'&&/Rowan/.test(b.a.name)),'Clan Rowan branch');
for(const b of D.r60.branches) for(const k of ['a','b']){const x=b[k]; for(const q of [...(x.lockQ||[]),...(x.reveal||[])]) ok(D.quests.some(z=>z.id===q),'quest '+q); for(const c of x.lockC||[]) ok(D.classes.some(z=>z.id===c),'class '+c); if(x.item) ok(E.itemDef(x.item),'item '+x.item); if(x.minion) ok((D.minions.types||D.minions).some?.(t=>t.id===x.minion)??true,'minion '+x.minion);}
const sp=D.classes.filter(c=>c.special); ok(sp.length===11,'11 special classes');
for(const b of D.r60.bonuses) for(const k of ['ach']) if(b[k]) ok(JSON.stringify(D.achievements).includes('"'+b[k]+'"'),'bonus ach exists '+b[k]);
// Honor, faith, log cap, bands
{ const s=fresh(); ok(E.alignOf(s).honor===0&&E.honorBand(s).id==='steady','start Steady'); for(let i=0;i<8;i++) E.shiftAlign(s,{honor:-10},'t'+i); ok(s.alignLog.length===5,'log keeps 5'); ok(E.alignOf(s).honor===-80&&E.honorBand(s).id==='oathbreaker','Oathbreaker band'); E.shiftAlign(s,{honor:-500}); ok(E.alignOf(s).honor===-100,'clamped');
  E.shiftAlign(s,{faith:-30}); ok(E.faithWord(s)==='Old Ways','Old Ways word'); }
// Respect: honorWeight, read-only base, words
{ const s=fresh(); s.houses=s.houses||{}; const before=JSON.stringify(s.houses);
  const f=D.factions.list.find(x=>x.honorWeight>0); const r0=E.respect(s,f.id).v; E.shiftAlign(s,{honor:40}); const r1=E.respect(s,f.id); ok(r1.v>r0&&r1.hon===Math.round(f.honorWeight*20),'Honor adds by honorWeight');
  E.respectList(s); ok(JSON.stringify(s.houses)===before,'respect reads houses only'); ok(E.respectWord(-60).id==='hostile'&&E.respectWord(70).id==='revered'&&E.respectWord(0).id==='neutral','words');
  E.adjRespect(s,'church',30); ok(E.respect(s,'church').met&&E.respect(s,'church').adj===30,'adj marks met'); }
// quest tiers and spill-over
{ const s=fresh(); const q=D.quests.find(x=>x.guild==='rogues'&&x.rank>=1)||{id:'x',guild:'rogues',rank:1,name:'x'}; ok(E.questTier(q)==='major','guild rank quest is major');
  const riv=E.rivalsOf('rogues'); E.questSpill(s,q); ok(riv.length&&riv.every(r=>(s.respectAdj[r]||0)<0),'major spills onto rivals');
  const fq={id:'zz',name:'zz',giver:'church',againstF:'rogues'}; ok(E.questTier(fq)==='against','against tier'); const s2=fresh(); E.questSpill(s2,fq); ok((s2.respectAdj.rogues||0)<=-15,'against hits target'); }
// branches: choice, locks, race, reveal
{ const s=fresh(); strong(s);s.discovered=[...(s.discovered||[]),'highlands']; s.usurper={r:0}; ok(E.openBranches(s).some(b=>b.id==='br_highland'),'highland branch open');
  ok(E.chooseBranch(s,'br_highland','b')===null,'take Crane'); ok(E.isLocked(s,'r60_rowan1')&&E.isLocked(s,'cls:highland_chief'),'Crane locks Rowan quests and Chief');
  s.revealed.push('r60_rowan1'); ok(/Locked/.test(E.questIssue(s,s.members[0],D.quests.find(q=>q.id==='r60_rowan1'))||''),'locked quest says Locked '+E.questIssue(s,s.members[0],D.quests.find(q=>q.id==='r60_rowan1'))); ok(E.chooseBranch(s,'br_highland','a')==='already decided','one side only'); ok(E.alignOf(s).honor===-15,'Crane costs Honor');
  const t=fresh(); strong(t);t.discovered=[...(t.discovered||[]),'highlands']; t.usurper={r:0}; E.chooseBranch(t,'br_highland','a'); ok(t.revealed.includes('r60_rowan1')&&!E.isLocked(t,'r60_rowan1'),'Rowan reveals chain');
  ok(E.respect(t,'rowan').adj===25&&E.respect(t,'crane').adj===-25,'pair respect'); }
{ const s=strong(fresh()); s.branches={}; const b=E.branchDef('br_saltmere'); b._w=b.when; b.when=null; s.r60c={convoy:5}; E.r60Day(s); b.when=b._w; ok(s.branches.br_saltmere==='b','race auto-decides at 5'); }
{ const s=fresh(); s.branches={}; s.r60c={convoy:5}; const b=E.branchDef('br_saltmere'); const r=E.raceState(s,b); ok(r.b===5&&r.at===5,'race counter'); }
// rival quest lock
{ const s=fresh(); strong(s);s.discovered=[...(s.discovered||[]),'highlands']; s.usurper={r:0}; E.chooseBranch(s,'br_highland','a'); E.rivalLockCheck(s,{id:'r60_rowan3',rivals:['side:br_highland.b'],lockAt:3}); ok(E.isLocked(s,'side:br_highland.b'),'rival side locked'); }
// Honor gates: envoy
{ const s=fresh(); const env=D.quests.find(q=>q.envoy); E.r60Day(s); ok(!(s.revealed||[]).includes(env.id),'no envoy at Steady'); E.shiftAlign(s,{honor:60}); E.r60Day(s); ok(s.revealed.includes(env.id),'envoy at Honor 50+'); }
// special classes and light keys
{ const s=fresh(); const m=s.members[0]; m.ageDays=30*Y; const c=sp[0]; ok(!E.canEvolve(s,m,c),'special shut without key'); ok(!E.classMoves(s,m).some?.(x=>(x.id||x.c?.id||x)===c.id)??true,'specials not in class moves');
  E.setR60Rec({classUnlocks:{[c.id]:1}}); ok(!E.classKeyIssue(s,c),'earned key waives story'); E.setR60Rec(null);
  const hero=D.classes.find(x=>x.id==='hero'); ok(hero.key&&E.classKeyIssue(s,hero),'hero needs a light key'); }
// carry-over bonuses, caps and toggle
{ const all={ach:Object.fromEntries((D.achievements.list||D.achievements).map?.(a=>[a.id,1])||[]),flags:{thaneOath:1,seaHeir:1,hydra_slain:1,craneDisgraced:1},bonuses:{}};
  const lb=E.legacyBonuses(all); ok(lb.list.length<=D.r60.bonusCaps.pips,'pip cap'); ok((lb.fx.coin||0)<=D.r60.bonusCaps.coin&&(lb.fx.xp||0)<=D.r60.bonusCaps.xp&&(lb.fx.picks||0)<=D.r60.bonusCaps.picks,'caps hold');
  ok(E.legacyBonuses({...all,bonuses:{off:true}}).list.length===0,'clean-run toggle'); ok(E.legacyBonuses({...all,bonuses:{off:true}},true).list.length>0,'list still shows when off');
  const s=fresh(); const c0=s.res.coin; const got=E.applyLegacyBonuses(s,all); ok(got.length&&s.lb&&s.res.coin>=c0,'bonuses applied to fresh game');
  const n=fresh(); ok(!n.lb,'newGame alone gives nothing'); ok(E.creationOptions(all).maxPicks>E.creationOptions({ach:{},flags:{},bonuses:{off:true},unlocks:[],classUnlocks:{}}).maxPicks,'extra picks'); }
// endings
{ const s=fresh(); ok(E.endingOf(s).id==='lampkeepers','Steady+between = Lamp-Keepers'); E.shiftAlign(s,{honor:-60,faith:-60}); ok(E.endingOf(s).id==='drowned','low/old = drowned'); }
// save step 55
{ const s=fresh(); s.dagonPact='join'; s.flags={thaneOath:3}; delete s.align; const O=JSON.parse(E.serialize(s,1)); O.schema=54; delete O.align; delete O.branches; E.normalize(O);
  ok(O.align&&O.align.faith===-20&&O.align.honor===20,'step 55 back-fills ('+JSON.stringify(O.align)+')'); ok(O.branches&&O.locked&&O.respectAdj,'step 55 empties'); ok(!O.lb,'no bonus to running game'); }
// bonuses off is the R59 game: no lb, nothing multiplied
{ const s=fresh(); ok(E.lbOf(s,'coin')===0&&E.dagonFishMult(s)===1,'neutral when off'); }
console.log('r60 ok',pass);
