// Late-game round (Oct 16): Auto Tend bundles, coin sinks (wages, gifts, mounts, patronage, quarries), stone nodes,
// manor gate, dragon floors, generations (handover, illness risk, head bank), Auto Ascend spread, Auto Recruit modes,
// follower aging, creatures/elites, raids, defenses, house war at -100, save step 27.
import fs from 'fs'; import * as E from '../js/engine.js'; import { STEPS } from '../js/engine/save-steps.js';
const L=n=>JSON.parse(fs.readFileSync(new URL('../data/'+n+'.json',import.meta.url)));
const D={};for(const f of fs.readdirSync(new URL('../data/',import.meta.url)).filter(f=>f.endsWith('.json')))D[f.replace('.json','')]=L(f.replace('.json',''));
for(const f of D.estate.structureFiles)D['structures/'+f]=L('structures/'+f);
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
let R=0.5; E.setRng(()=>R);
const G=D.endgame;
const fresh=()=>{const s=E.newGame(1); E.normalize(s); E.skipTutorial&&E.skipTutorial(s); return s;};
// 1) the Auto Tend "buy all" bundle (at_all) was removed (R29): singles only; old saves get its tiers as singles (save step 29)
{ const s=fresh(); s.legacy={renown:5000,earned:0,ups:{}};
  ok(!E.legacyDef('at_all'),'no buy-all bundle');
  ok(E.legacyCost(s,'at_arcane')===200&&E.buyLegacy(s,'at_arcane')&&E.atRate(s,'arcane')===0.5&&E.legacyCost(s,'at_arcane')===600,'single purchases still work');
  ok(D.legacy.renown.tithe===0.2&&D.legacy.renown.headBank===0.35,'tithe 20%, head bank 35%'); }
// 2) wages / gifts
{ const s=fresh(); const mi={uid:'a',type:'laborer',cls:'n_peasant',skills:{},job:'farm'}; const base=E.mtype('laborer').wage;
  ok(E.wageOf(mi)===base,'peasant pays base wage');
  const t2=D.minions.npcClasses.find(c=>c.needs&&c.needs.tier===2); mi.cls=t2.id; mi.skills.farm=4*100; // skill 10
  ok(E.wageOf(mi)===Math.round(base*G.wages.tierMult[2]*(1+G.wages.perSkill*10)),'tier-2 title + skill 10 wage');
  const h=D.marriage.houses.list[0]; ok(E.giftCost(s,h.id)===Math.round(150*(1+h.wealth*G.giftEra.perWealth)),'gift cost early ~base'); }
// 3) mounts, patronage, quarries, nodes
{ const s=fresh(); s.res.coin=1e6; s.res.hay=1e4; s.res.ingots=1e4;
  const a={type:'quest',target:D.quests.find(q=>!q.story).id}; const d0=E.newTrip(a,s).out;
  ok(E.buyMount(s)&&E.mountTier(s)===1&&s.res.coin===1e6-5000,'pony bought');
  ok(E.newTrip(a,s).out<=Math.round(d0/1.15*10)/10+0.05,'mount speeds travel');
  const p0=E.townSellPrice(s,'millbrook','wood'); ok(/phase/.test(E.patronIssue(s,'p_millmarket')),'patronage needs the phase');
  s.renown=1000; ok(E.fundTown(s,'p_millmarket')&&E.townSellPrice(s,'millbrook','wood')>p0,'covered market raises Millbrook sell prices');
  ok(D.nodes.some(n=>n.id==='n_limestone'&&n.res.limestone)&&D.nodes.some(n=>n.id==='n_granite'&&n.res.granite)&&D.map.points.n_limestone&&D.map.points.n_granite,'limestone + granite nodes on the map');
  const fog0=s.fog; s.fog='0'.repeat(100000); ok(/find/.test(E.quarryIssue(s,'q_lime')||''),'quarry needs the node found'); s.fog=fog0; E.revealAt(s,'n_limestone'); s.res.planks=1e4;
  ok(E.buildQuarry(s,'q_lime')&&E.quarryTier(s,'q_lime')===1,'limestone quarry opened');
  const l0=s.res.limestone||0; E.endgameDay(s); ok((s.res.limestone||0)-l0===G.quarries[0].tiers[0].rate,'limestone quarry digs daily');
  ok(!D.nodes.some(n=>n.res.marble),'marble stays buy-only'); }
// 4/5) manor gate data + dragon floors
{ const m=D['structures/home'].find(x=>x.id==='mansion'); ok(m.req.stage==='Manor'&&m.req.phase===2&&!m.req.skill,'manor gate: Manor stage + Established');
  const sh=D.dungeons.find(d=>d.id==='d_stormhold'), dr=D.dungeons.find(d=>d.id==='d_dragonlair');
  ok(sh.floors.map(f=>f.cp).join()==='94,110,128'&&dr.floors.map(f=>f.cp).join()==='144,166,196','Stormhold/dragon floors -15%'); }
// 6) generations
{ const s=fresh(); const T=D.tuning; ok(T.baseLifespan===55&&T.childEvery===270&&T.maxKidsPerCouple===5&&T.generations.retireAge===35,'g3 numbers');
  const hd=E.active(s); hd.ageDays=36*360; const kid=E.newMember(s,{age:19,parents:[hd.id]}); s.members.push(kid); s.head=hd.id;
  ok(E.handoverHeir(s)===kid&&s.head===kid.id&&s.activeId===kid.id,'head hands over at 35 to an adult child');
  const y=E.newMember(s,{age:22}); y.stats.VIT=5; const o=E.newMember(s,{age:50}); o.stats.VIT=5;
  ok(E.illnessRisk(s,y,0)<E.illnessRisk(s,o,0)/2,'risk rises with age; young adults rarely die');
  const tough={...y,stats:{...y.stats,VIT:20}}; ok(E.illnessRisk(s,tough,20)<E.illnessRisk(s,y,0),'VIT and healing cut risk');
  s.structures.push({uid:'gy',type:'graveyard',pieces:[],up:0}); hd.renown=1000; hd.tithed=0; s.legacy={renown:0,earned:0,ups:{}};
  ok(E.bankRenown(s,hd)===350,'former head banks 35% at death'); }
// 7) Auto Ascend spread, recruit modes, aging
{ const s=fresh(); s.renown=1e4; s.buildings.farm=80; for(let i=0;i<3;i++) s.members.push(E.newMember(s,{age:25}));
  s.land=['plot']; s.structures.push({uid:'h',type:'house',pieces:['bunk','larder','storage','workbench'],up:0},{uid:'q',type:'quarry',pieces:['quarrypit'],up:0},{uid:'b',type:'barracks',pieces:[],up:0});
  s.minions=[]; for(let i=0;i<8;i++) s.minions.push({uid:'m'+i,type:'laborer',cls:'n_peasant',name:'M'+i,job:'idle',loyalty:100,since:i,skills:{},equip:{},lvl:1});
  E.autoAscendDay(s); const tg=new Set(s.minions.map(x=>x.trainFor).filter(Boolean));
  const t1=D.minions.npcClasses.filter(c=>c.from==='n_peasant');
  ok(s.minions.every(x=>x.trainFor)&&(tg.size>1||t1.length<2),'peasants spread over several tier-1 titles ('+[...tg].join()+')');
  const ty=D.minions.types.filter(t=>!t.special&&t.hire>0);
  const best=mode=>ty.sort((a,b)=>E.recruitValue(s,b,mode)-E.recruitValue(s,a,mode))[0].id;
  ok(best('cheap')==='laborer','Cheapest = laborer'); ok(E.setRecruitMode(s,'strong')&&E.recruitMode(s)==='strong'&&!E.setRecruitMode(s,'x'),'mode switch');
  ok(E.recruitValue(s,E.mtype('woodsman'),'strong')>E.recruitValue(s,E.mtype('laborer'),'strong'),'Strongest prefers higher aptitude');
  const old={uid:'old',type:'laborer',cls:'n_peasant',name:'Old',job:'idle',loyalty:100,since:0,skills:{},equip:{},age:80};
  s.minions.push(old); s.day=30*1000; R=0.001; E.minionAgeDay(s); R=0.5;
  ok(!s.minions.includes(old)&&s.recruitNow,'old follower dies; Auto Recruit replaces next day');
  ok(D.tuning.inheritBoost===0.1,'kids inheritance +10%'); }
// 8) creatures, raids, defenses, war
{ const s=fresh(); ok(E.threat(s,false).mult===1,'first fights never scale');
  R=0.05; const t=E.threat(s,true); ok(t.elite&&t.mult===G.creatures.elitePower&&t.coin===2,'elite: x1.5 power, x2 coin'); R=0.5;
  ok(!E.threat(s,true).elite,'most repeat fights are not elite');
  s.res.coin=1e6; s.res.blocks=1e4; s.res.planks=1e4;
  ok(E.buildDefense(s,'wall')&&E.defensePower(s)===G.defenses.wall.tiers[0].power,'sandstone wall');
  ok(/limeblocks/.test(E.defIssue(s,'wall')),'next wall rank needs limestone blocks');
  ok(/village/.test(E.defIssue(s,'palisade')),'palisade needs the village');
  ok(E.buildDefense(s,'tower')&&E.hasWarning(s),'watchtower warns');
  ok(E.endgameUpkeep===undefined,'no upkeep on coin-sink purchases');
  const d0=E.raidDefense(s); ok(d0>=E.defensePower(s),'walls add to raid defense');
  const c0=s.res.coin; R=0.99; ok(!E.raid(s)&&s.res.coin<c0,'lost raid steals coin'); R=0.001; const c1=s.res.coin; ok(E.raid(s)&&s.res.coin>=c1,'won raid'); R=0.5;
  s.res.coin=0; s.day=30*500; E.endgameDay(s); ok(E.defensePower(s)>0&&s.res.coin===0,'no monthly fee: defenses stay up with an empty purse');
  const h=D.marriage.houses.list[0], hs=E.houseState(s,h.id); hs.state='feud'; hs.r=-100;
  s.renown=1e4; s.buildings.farm=80; for(let i=0;i<3;i++) s.members.push(E.newMember(s,{age:25}));
  s.land=['plot']; s.structures.push({uid:'h2',type:'house',pieces:['bunk','larder','storage','workbench'],up:0});
  if(E.era(s).n>=3){ E.warEscalate(s,h,hs); ok(hs.state==='war','feud at -100 becomes a house war (Dynasty)'); } else { console.error('war test skipped, era', E.era(s).n); process.exit(1); }
  const z={minions:[{uid:'a',type:'laborer',since:5}]}; STEPS.find(x=>x.n===27).run(z); ok(z.eg&&z.minions[0].age>=18&&z.minions[0].age<=40,'save step 27'); }
console.log(pass+' tests passed');
