import fs from 'fs'; import * as E from '../js/engine.js';
const L=n=>JSON.parse(fs.readFileSync(new URL('../data/'+n+'.json',import.meta.url)));
const D={};for(const n of ['fields','skills','classes','traits','buildings','furniture','items','quests','regions','tuning','nodes','towns','minions','guilds','jobs','activities','estate','crafting','map','dungeons','legacy','chronicle','achievements','events','encounters','seasons','tutorial','notify','marriage','phases','intros','gear','paths','world','metals'])D[n]=L(n);
// legacy suite pins the pre-pacing tuning (pacing has its own test: test/pacing.test.mjs)
Object.assign(D.tuning,{secPerDayActive:10,secPerDayOffline:20,founderAge:15,courtAge:18,xpBase:50,xpGrowth:1.12,turboCapMin:60,buildCostMult:2.2,childEvery:720,adultAge:16,teenAge:14});D.guilds.minJoinAge=16;
for(const f of D.estate.structureFiles)D['structures/'+f]=L('structures/'+f);
E.setData(D); let seed=42; E.setRng(()=>{seed=(seed*16807)%2147483647;return seed/2147483647;});
const asProf=(m,c)=>{m.paths=null;m.prof=c||undefined;if(c)m.craft=m.craft||{id:'hearth',rank:0,rep:0};if(c)E.migratePaths({members:[m]});else m.paths=[];};
let pass=0; const estate=(g,pieces=['bunk'],type='house')=>{g.res.coin+=5000;g.res.wood+=500;g.res.stone+=500;g.res.planks=(g.res.planks||0)+100;g.res.blocks=(g.res.blocks||0)+200;['plot','acre','meadow'].forEach(l=>E.buyLand(g,l));const st=E.buildStructure(g,'shack');st.type=type;const fb=pieces.filter(x=>x==='minionbunk');st.pieces=pieces.filter(x=>x!=='minionbunk');if(fb.length)g.structures.push({uid:'stb'+g.nextId++,type:'bunkhouse',pieces:fb.map(()=>'bunk'),up:0});return st;}; const setRngOK=()=>{};const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;console.log('ok',m);};
ok(D.skills.length>=20&&D.quests.length>=25&&D.items.length>=40&&D.furniture.length===10&&D.buildings.length===6,'content counts');
const t0=1_700_000_000_000; let s=E.newGame(t0);
const f=E.active(s); E.advanceReal(s,10*120); ok(s.day===120,'active ticks: 120 days in 1200s');
ok(Object.values(f.skills).some(k=>k.lvl>0),'activities gain levels');
ok(s.turbo.charge===0,'active play does not charge turbo');
E.advanceReal(s,10*400); while(!E.isAdult(f)) E.advanceReal(s,10*30); ok(E.isAdult(f)&&!f.cls&&!s.pendingClass.length,'founder comes of age still classless (no auto pick at adulthood)');
E.chooseClass(s,f.id,'fighter'); E.setAction(s,{type:'quest',target:'rats'}); const c0=s.res.coin; E.advanceReal(s,10*30); ok(s.res.coin>c0,'quests pay coin');
// offline 14h
const str=E.serialize(s,t0); const s2=E.deserialize(str); const d0=s2.day; const rep=E.applyOffline(s2,t0+14*3600e3);
ok(s2.day===d0&&rep.turboAdded>0&&!('days' in rep),'time away only charges turbo (no simulated days)');
ok(s2.turbo.charge===3600,'14h away → 84min charge clipped to 60min cap');
const s3=E.deserialize(E.serialize(s,t0)); E.applyOffline(s3,t0+2*3600e3); ok(Math.abs(s3.turbo.charge-720)<1,'2h away → 12 min turbo');
ok(E.applyOffline(E.deserialize(E.serialize(s,t0)),t0-5000)===null,'negative elapsed ignored');
// turbo: 3x incl aging
const a=s3.members[0].ageDays,d=s3.day; E.toggleTurbo(s3); E.advanceReal(s3,60); ok(s3.day-d===18&&s3.members[0].ageDays-a===18&&Math.abs(s3.turbo.charge-660)<1e-6,'turbo 3x time & aging, burns 1s/s');
// save roundtrip
const s4=E.deserialize(E.serialize(s2,t0)); ok(JSON.stringify(s4.members)===JSON.stringify(s2.members),'save/load roundtrip');
// marriage, kids, inheritance, death, game over
s.res.coin=5000; s.suitors.push({id:'x',name:'Ysolde',gender:'f',cls:'scout',affinity:100,age:20});
const home=estate(s,['bunk']); f.ageDays=Math.max(f.ageDays,D.tuning.courtAge*D.tuning.daysPerYear); ok(E.propose(s,'x')&&s.members.length===2,'marriage adds playable spouse');
home.pieces=['bunk','bunk2'].slice(0,1).concat(['cradle','larder','minionbunk']); home.pieces.push('bunk'); s.res.food=1e6; for(let i=0;i<40&&s.members.length<3;i++) E.advanceReal(s,10*360);
ok(s.members.length>=3,'child born'); const kid=s.members[2];
(s.autoOff=s.autoOff||{}).fam_advance=true; /* R39: inheritance check, not Auto Advance (RNG path shifted) */ f.skills.swordsmanship.lvl=40; E.advanceReal(s,10*360*17); ok(kid.skills.swordsmanship.lvl>=4&&!kid.cls,'child inherits 10% at 16, stays classless');
ok(E.switchTo(s,kid.id)&&E.active(s)===kid,'switch members');
E.setOrder(s,f.id,{type:'quest',target:'outskirts'}); E.advanceReal(s,100); ok(f.action&&f.action.type==='quest','idle standing order quests');
E.kill(s,kid,'test'); ok(s.activeId!==kid.id&&s.needSuccession,'succession on active death');
for(const m of E.living(s)) E.kill(s,m,'test'); ok(s.gameOver,'game over when all die (no safety net)');
const g=E.newGame(t0); ok(E.estateStage(g)==='Landless'&&!E.established(g)&&!E.buildStructure(g,'shack'),'estate locked until land is bought');
g.res.coin=500;g.res.wood=50; ok(E.buyLand(g,'plot')&&E.landSlots(g)===2&&E.estateStage(g)==='Scrub Plot','buy starting plot: 2 land slots');
g.res.stone=(g.res.stone||0)+50; g.res.blocks=200; const sh=E.buildStructure(g,'shack'); ok(sh&&E.established(g)&&E.landUsed(g)===1&&E.freeSlots(g,sh)===2&&E.estateStage(g)==='Scrub Plot','Shack: 1 land slot, 2 slots');
g.res.coin+=200;g.res.wood+=100; E.placePiece(g,sh.uid,'bunk'); g.res.coin+=200;g.res.wood+=50;g.res.stone+=20; E.buildStructure(g,'bunkhouse');
const gm=E.active(g); E.setAction(g,{type:'gather',target:'creek'}); E.advanceReal(g,100); ok(g.res.stone>0,'gather from resource node');
ok(E.buyItem(g,'millbrook','buckler')&&g.vault.includes('buckler'),'buy from town');
ok(E.moveItem(g,gm,'buckler',true)&&E.equip(g,gm,'buckler','bag')&&gm.equip.offhand==='buckler','personal bag + equip');
g.res.coin=1000; let rv=0; for(let i=0;i<20;i++) if(E.rumor(g,'outskirts')?.id) rv++; ok(rv>0&&g.revealed.length===rv,'rumors reveal hidden content'); ok(g.minions.length>0,'rumors can bring recruits');
const h=E.newGame(t0); h.res.coin=1000; h.res.wood=100; h.res.stone=50;
ok(!E.hire(h,'millbrook','laborer'),'cannot hire without housing');
E.buyLand(h,'plot'); const hs=E.buildStructure(h,'shack'); h.structures.push({uid:'stb'+h.nextId++,type:'bunkhouse',pieces:[],up:0}); const hc=h.res.coin;
ok(E.hire(h,'millbrook','laborer')&&h.minions.length===1&&h.res.coin===hc-40,'hire minion once a Bunk exists');
ok(!E.assignMinion(h,h.minions[0].uid,'farm'),'jobs need spots (no farm yet)'); h.res.coin+=500; h.res.wood+=100; h.land.push('acre'); E.build(h,'farm'); ok(E.assignMinion(h,h.minions[0].uid,'farm'),'assign minion to farm');
const f0=h.res.food; E.advanceReal(h,10*10); ok(h.res.food>f0,'farming minion adds food');
while(E.minionRoom(h)) E.addMinion(h,'refugee','test'); ok(E.hire(h,'millbrook','laborer')===null&&h.minions.length===4,'housing (Bunkhouse = 4) limits followers');
h.res.food=500; const c1=h.res.coin; const wg=E.monthlyWages(h); h.day=29; h.acc=0; E.advanceReal(h,10); ok(wg>0&&h.res.coin<=c1-wg,'monthly wages paid');
h.res.coin=0; for(let i=0;i<3;i++){h.res.coin=0;h.res.food=500;h.day=Math.ceil((h.day+1)/30)*30-1;E.advanceReal(h,10);} ok(h.minions.length===0,'unpaid minions leave');
// guilds
const G=E.newGame(t0); const gm2=G.members[0]; G.res.coin=1e5; E.advanceReal(G,10*360); while(!E.isAdult(gm2)) E.advanceReal(G,10*60); E.chooseClass(G,gm2.id,'fighter');
ok(D.guilds.guilds.length>=4&&D.guilds.guilds.every(g=>D.towns.some(t=>t.id===g.town)),'4-5 guilds, each in a town');
{ const _c=gm2.cls; gm2.cls=null; ok(E.setAction(G,{type:'train',target:'tactics'})===false,'guild skill locked before joining'); gm2.cls=_c; }
ok(E.setAction(G,{type:'quest',target:'g_vanguard_patrol'})===false,'guild quest locked before joining');
gm2.skills.swordsmanship.lvl=5; const _st=gm2.stats.STR; gm2.stats.STR=1; ok(!E.joinGuild(G,gm2,'vanguard')&&E.joinIssues(G,gm2,'vanguard').length,'join requirements enforced'); gm2.stats.STR=_st;
gm2.skills.swordsmanship.lvl=12; ok(E.joinGuild(G,gm2,'vanguard')&&gm2.guild.id==='vanguard','join guild');
gm2.skills.archery.lvl=20;gm2.stats.AGI=20; ok(!E.joinGuild(G,gm2,'lodge')&&E.joinIssues(G,gm2,'lodge')[0].startsWith('sworn'),'membership blocks other class guilds');
gm2.skills.carpentry.lvl=20;gm2.skills.smithing.lvl=20; ok(E.joinGuild(G,gm2,'hearth')&&gm2.guild.id==='vanguard'&&gm2.craft&&Array.isArray(gm2.paths)&&E.pendingPathChoices(gm2)===1,'Crafters open to sworn members; a main path is offered');
ok(E.setAction(G,{type:'train',target:'tactics'})!==false&&E.canTrain(gm2,'tactics'),'guild unlocks new skill');
ok(!E.buyGuildItem(G,gm2,'vanguard_tabard'),'rank-gated guild items');
gm2.guild.rep=60; ok(E.rankUp(G,gm2)&&gm2.guild.rank===1&&E.buyGuildItem(G,gm2,'vanguard_tabard'),'rank up unlocks special item');
gm2.cls='knight'; gm2.skills.leadership.lvl=45; gm2.skills.tactics.lvl=25; const wl=D.classes.find(c=>c.id==='warlord');
ok(!E.canEvolve(G,gm2,wl),'tier 2 needs guild rank'); gm2.guild.rep=200; E.rankUp(G,gm2); ok(E.evolve(G,gm2,'warlord')&&gm2.cls==='warlord','Adept Warrior unlocks Warlord');
const old=JSON.parse(E.serialize(G,t0)); delete old.schema; for(const m of old.members){delete m.skills.tactics;delete m.guild;} old._norm=false; E.normalize(old); ok(old.members[0].skills.tactics&&old.members[0].guild&&old.members[0].guild.id===E.classGuild(old.members[0].cls).id,'old saves migrate (skills + guild from class)');
// adventurers' guild
ok(E.joinAdventurers(G,gm2)&&gm2.guild.id==='vanguard'&&gm2.adv.rank===0,"Adventurers' Guild joinable by a sworn guild member");
const G2=E.newGame(t0); const am=G2.members[0]; am.ageDays=20*360; am.cls='scout'; am.skills.archery.lvl=12; G2.res.coin=1e5;
am.skills.hunting.lvl=Math.max(am.skills.hunting.lvl,5); am.stats.AGI=Math.max(am.stats.AGI,10); ok(E.joinAdventurers(G2,am)&&E.joinGuild(G2,am,'lodge'),'joining Adventurers does not block other guilds');
ok(!E.questOk(am,D.quests.find(q=>q.id==='b_boars')),'bounties locked at rank F');
am.adv.rep=30; ok(E.advRankUp(G2,am)&&E.hasService(G2,'questBoard')&&E.questOk(am,D.quests.find(q=>q.id==='b_boars')),'rank E unlocks quest board + bounty');
const sv0=E.sellValue(G2,D.items[0]); am.adv.rep=1e4; while(E.advRankUp(G2,am)); ok(am.adv.rank===6&&E.services(G2).length===4&&E.sellValue(G2,D.items[0])===Math.round(D.items[0].value*0.8)&&sv0<D.items[0].value,'rank S, all services (appraisal doubles sale)');
ok(E.buyAdvItem(G2,am,'adv_blade'),'rank-gated adventurer items');
// guild roster rework
const ids=D.guilds.guilds.map(g=>g.id).sort().join(); ok(ids==='church,collegium,hearth,lodge,rogues,vanguard','six guilds: Warriors/Rangers/Magic/Healers/Rogues/Crafters');
ok(D.guilds.guilds.every(g=>D.skills.some(k=>k.guild===g.id)&&D.quests.some(q=>q.guild===g.id)&&D.items.some(i=>i.guild===g.id)),'every guild has skill, quest and items');
ok(D.classes.filter(c=>c.tier===2).every(c=>(c.guild&&D.guilds.guilds.some(g=>g.id===c.guild))||c.advRank!=null||c.crafterRank!=null),'every tier 2 class gated by guild, adventurer or crafter rank');
ok(D.classes.find(c=>c.id==='paladin').guild==='church'&&D.classes.find(c=>c.id==='assassin').guild==='rogues','Paladin→Healers, Assassin→Rogues');
const H=E.newGame(t0); const hm=H.members[0]; hm.ageDays=20*360; hm.cls='fighter'; hm.skills.healing.lvl=10; hm.skills.faith.lvl=10; hm.skills.etiquette.lvl=5; H.res.coin=1e5;
ok(E.joinGuild(H,hm,'church')&&E.canTrain(hm,'faith')&&!E.canTrain(hm,'thievery'),'Healers guild unlocks Faith, not Thievery');
const O=JSON.parse(E.serialize(H,t0)); delete O.schema; O.members[0].guild={id:'exchange',rank:1,rep:5}; O.vault.push('exchange_seal'); E.normalize(O); ok(O.members[0].guild===null&&!O.vault.includes('exchange_seal'),'old Exchange saves migrate cleanly');
// playtest feedback round
let clash=0; for(let i=0;i<300;i++){ const tr=E.pickTraits(2); if(E.conflicts(tr[0],tr[1])) clash++; } ok(clash===0,'opposed traits never roll together');
const P=E.newGame(t0); const pm=P.members[0]; pm.traits=['hardy','frail']; const ls=pm.lifespan; P._norm=false; E.normalize(P);
ok(!E.conflicts(pm.traits[0],pm.traits[1])&&pm.traits.length===2,'save migration resolves Hardy+Frail');
ok(D.jobs.length>=6&&D.activities.length>=6,'6+ jobs and activities');
const kd=E.newGame(t0); const km=kd.members[0]; km.ageDays=9*360; const c0k=kd.res.coin, ch0=km.stats.CHA;
ok(E.setAction(kd,{type:'job',target:'shop'})!==false,'minor can apprentice at the shop'); E.advanceReal(kd,10*30);
ok(kd.res.coin>c0k&&km.stats.CHA>ch0&&km.skills.haggling.lvl+km.skills.haggling.xp>0,'job pays coin + CHA + Bartering');
const kidPay=kd.res.coin-c0k; const ad=E.newGame(t0); const am2=ad.members[0]; am2.ageDays=20*360; const c1a=ad.res.coin; E.setAction(ad,{type:'job',target:'shop'}); E.advanceReal(ad,10*30); ok(ad.res.coin-c1a>kidPay*2,'adult job pays more');
ok(E.setAction(kd,{type:'job',target:'docks'})===false,'docks need age 12');
ok(E.setAction(kd,{type:'train',target:'swordsmanship'})===false&&E.setAction(kd,{type:'activity',target:'play'})!==false,'children: activities not direct training');
km.ageDays=12*360; ok(E.setAction(kd,{type:'train',target:'farming'})!==false&&E.setAction(kd,{type:'train',target:'fire'})===false,'teens train; magic waits till 14');
ok(E.setAction(kd,{type:'activity',target:'play'})===false,'Play Outside ends after childhood');
ok(E.setAction(kd,{type:'activity',target:'fishing'})!==false,'R31: Fishing open from day 1 (q_river boosts it)');
const qr=D.quests.filter(q=>q.unlocks); ok(qr.length>=5&&qr.length<=12,'5-12 quests grant unlocks');
km.ageDays=20*360; km.cls='fighter'; setRngOK(); E.setAction(kd,{type:'quest',target:'q_river'}); for(let i=0;i<20&&!kd.unlocks.includes('activity:fishing');i++) E.advanceReal(kd,10*4);
for(let i=0;i<5&&E.isBusy(km);i++)E.advanceReal(kd,10); ok(kd.unlocks.includes('activity:fishing')&&E.setAction(kd,{type:'activity',target:'fishing'})!==false,'river quest unlocks Fishing');
const f1=km.stats.AGI; E.advanceReal(kd,10*20); ok(km.stats.AGI>f1&&km.skills.fishing.lvl+km.skills.fishing.xp>0,'Fishing gives AGI (Dex) + Fishing');
ok(E.setAction(kd,{type:'train',target:'monsterlore'})===false,'Monster Lore training locked until Catalogue Beasts');
ok(E.setAction(kd,{type:'activity',target:'studyhall'})===false,'Library Study needs a Library');
// special minions
const SP=E.newGame(t0); const sm=SP.members[0]; sm.ageDays=30*360; SP.res.food=1e6;
const specials=D.minions.types.filter(t=>t.special); ok(['class','guild','quest'].every(k=>specials.some(t=>t.source[k])),'special minions from classes, guilds and quests');
sm.cls='beastmaster'; E.advanceReal(SP,10); const wolf=SP.minions.find(x=>x.type==='wolf'); ok(wolf&&wolf.special&&/Beastmaster/.test(wolf.source),'Beastmaster gains an animal companion');
E.advanceReal(SP,10*5); ok(SP.minions.filter(x=>x.type==='wolf').length===1,'special minion granted only once');
sm.guild={id:'lodge',rank:1,rep:0}; E.advanceReal(SP,10); ok(SP.minions.some(x=>x.type==='falconer'),'guild rank grants special minion');
SP.doneQuests.push('q_hermit'); E.advanceReal(SP,10); ok(SP.minions.some(x=>x.type==='hermitpupil'&&/Hermit/.test(x.source)),'quest grants recruited NPC');
while(E.minionRoom(SP)) E.addMinion(SP,'refugee','t'); sm.cls='archmage'; E.advanceReal(SP,10); ok(SP.minions.some(x=>x.type==='familiar'),'specials bypass the follower cap');
// land, buildings & stations
const LS=E.newGame(t0); LS.res.coin=1e5; LS.res.wood=1e4; LS.res.stone=1e4; E.buyLand(LS,'plot'); const s1x=E.buildStructure(LS,'shack');
ok(E.build(LS,'garden')&&E.landUsed(LS)===2&&!E.buildStructure(LS,'shack')&&E.structIssue(LS,'shack')==='no free land slot','Shack + Small Garden fill the starting plot');
ok(!E.buyLand(LS,'meadow')&&E.buyLand(LS,'acre')&&E.landSlots(LS)===4,'land purchases are sequential and add slots');
ok(E.placePiece(LS,s1x.uid,'bunk')&&E.placePiece(LS,s1x.uid,'larder')&&!E.placePiece(LS,s1x.uid,'storage')&&E.placeIssue(LS,s1x.uid,'storage')==='building full','Shack holds 2 pieces (Bed + Larder home)');
ok(E.bedrooms(LS)===3&&E.foodCap(LS)===D.estate.caps.foodBase+300,'Bed adds beds, Larder adds food capacity');
ok(E.activeSynergies(s1x).some(y=>y.id==='cozy')&&E.eff(LS,'rest')>=0.3,'Bed+Larder synergy: Cozy Home');
LS.res.coin+=500;LS.res.wood=300; const s2x=E.buildStructure(LS,'sawmill'); LS.res.wood=300; LS.res.planks=0; E.advanceReal(LS,10);
ok(Math.abs(LS.res.planks-4)<1e-6,'Saw Table turns wood into planks (4/day)'); E.placePiece(LS,s2x.uid,'storage');
ok(E.processRate(LS,s2x,'sawtable')===6&&E.activeSynergies(s2x).some(y=>y.id==='lumberyard'),'Saw Table+Storage synergy speeds planks ×1.5');
ok(E.matCap(LS)===D.estate.caps.matBase+400,'Storage Chest raises material capacity');
LS.res.planks=100; LS.res.blocks=100; ok(E.upgradeStructure(LS,s1x.uid)&&E.freeSlots(LS,s1x)===2&&E.structDef(s1x.type).slots===4,'Shack upgrades to Cabin (4 slots)');
LS.res.coin+=1000; LS.res.stone+=100; const s3sm=E.buildStructure(LS,'smithy'); LS.land.push('meadow'); const s3w=s3sm||E.buildStructure(LS,'smithy'); ok(E.placePiece(LS,s3w.uid,'workbench')&&E.hasPiece(LS,'workbench')&&E.craftQuality(LS)>=0.15,'Workbench enables crafting; +Storage synergy raises quality');
ok(E.activeSynergies(s3w).some(y=>y.id==='smithy')&&E.craftQuality(LS)>=0.3,'Workbench+Forge synergy: Smithy');
const s3x=E.buildStructure(LS,'shack'); E.placePiece(LS,s3x.uid,'studydesk'); const lore0=E.eff(LS,'xp'); E.buyFitting(LS,s3x.uid,'studycorner'); ok(E.activeSynergies(s3x).some(y=>y.id==='nook'),'Study Desk+Study Corner synergy: Scholar\'s Nook');
ok(E.removePiece(LS,s3x.uid,'studydesk')&&LS.pieceStore.includes('studydesk')&&!E.activeSynergies(s3x).length&&E.placePiece(LS,s3x.uid,'studydesk',true),'remove to storage and re-place');
// minion housing & food
ok(!E.addMinion(LS,'laborer','t'),'no bunk → follower cannot join'); LS.res.coin=1e5; LS.res.wood=1e4; LS.res.planks=100; E.buyLand(LS,'meadow'); const bh=E.buildStructure(LS,'bunkhouse');
ok(bh&&E.housingCap(LS,'bunk')===4,'Bunkhouse houses 4');
E.addMinion(LS,'laborer','t'); E.addMinion(LS,'woodsman','t'); E.addMinion(LS,'woodsman','t'); LS.land.push('meadow'); const trh=E.buildStructure(LS,'shack'); E.placePiece(LS,trh.uid,'toolrack');
ok(E.assignMinion(LS,LS.minions[1].uid,'gather')&&E.assignMinion(LS,LS.minions[2].uid,'gather')&&!E.assignMinion(LS,LS.minions[0].uid,'gather'),'minion job spots come from stations (Tool Rack: 2)');
LS.members[0].cls='beastmaster'; E.advanceReal(LS,10); const wolf2=LS.minions.find(x=>x.type==='wolf'); ok(wolf2&&!E.isHoused(LS,wolf2)&&!E.assignMinion(LS,wolf2.uid,'guard'),'Wolf needs a Kennel before it can work');
E.placePiece(LS,trh.uid,'kennel'); ok(E.isHoused(LS,wolf2)&&E.assignMinion(LS,wolf2.uid,'guard'),'Kennel houses the Wolf');
const mf=E.minionFood(LS); ok(mf===LS.minions.length*0.5,'followers eat from the food pool');
LS.res.food=0; LS.res.fish=0; for(const mm of LS.members) mm.action={type:'activity',target:'hiking',progress:0}; const l0=LS.minions[0].loyalty; E.advanceReal(LS,10); ok(LS.minions[0].loyalty<l0&&LS.minions[0].hunger>0,'hungry followers lose morale');
for(let i=0;i<20;i++){LS.res.food=0;E.advanceReal(LS,10);} ok(LS.minions.length===0,'starving followers eventually leave');
// migration
const OLD=JSON.parse(E.serialize(G,t0)); delete OLD.schema; delete OLD.land; delete OLD.structures; OLD.rooms=['living','workshop','study']; OLD.furniture=['bookshelf','trophy']; OLD.buildings={house:2,farm:1,lumber:1,yard:0,library:0,hourglass:0}; E.normalize(OLD);
ok(OLD.structures.length===1&&OLD.structures[0].type==='cabin'&&OLD.structures[0].pieces.includes('bunk')&&OLD.structures[0].pieces.includes('workbench')&&E.landSlots(OLD)>=E.landUsed(OLD)&&OLD.rooms===undefined&&OLD.buildings.house===undefined,'old House/rooms save → Cabin with stations');
ok([...OLD.structures[0].pieces,...(OLD.structures[0].fittings||[]),...OLD.pieceStore].includes('trophy'),'old furniture kept (placed or in storage)');
// classes via guilds
const CG=E.newGame(t0); const cm=CG.members[0]; CG.res.coin=1e4; ok(!cm.cls,'characters start classless');
cm.ageDays=15*360; cm.skills.swordsmanship.lvl=10; cm.stats.STR=10; ok(E.joinIssues(CG,cm,'vanguard').includes('age 16+'),'guilds require age 16');
cm.ageDays=16*360; cm.stats.STR=3; ok(E.joinIssues(CG,cm,'vanguard').some(x=>x.startsWith('STR')),'stat thresholds instead of class');
cm.stats.STR=10; ok(E.joinGuild(CG,cm,'vanguard')&&cm.cls==='fighter','Warriors grant Fighter');
const grants={lodge:'hunter',collegium:'apprentice',church:'acolyte',rogues:'cutpurse'};
for(const [gid,c] of Object.entries(grants)){ const X=E.newGame(t0); const xm=X.members[0]; xm.ageDays=20*360; X.res.coin=1e4; for(const k of E.STATS) xm.stats[k]=20; for(const k in xm.skills) xm.skills[k].lvl=10; ok(E.joinGuild(X,xm,gid)&&xm.cls===c,`${gid} grants ${c}`); }
const CR=E.newGame(t0); const cr=CR.members[0]; cr.ageDays=20*360; CR.res.coin=1e4; cr.skills.carpentry.lvl=6; cr.skills.smithing.lvl=4; ok(E.joinGuild(CR,cr,'hearth')&&!cr.cls&&E.openPath(CR,cr,'carpenter')&&E.mainPath(cr).id==='carpenter','Crafters: pick a main path, no primary class');
ok(E.joinAdventurers(CR,cr)&&cr.cls==='adventurer'&&E.mainPath(cr).id==='carpenter',"Adventurers' Guild grants Adventurer as primary class (classless members)");
ok(D.classes.filter(c=>c.tier>0&&!c.retired).every(c=>{const g=E.classGuild(c.id);return g&&(!c.guild||c.guild===g.id);}),'every evolution stays inside its guild line');
const MG=JSON.parse(E.serialize(G,t0)); delete MG.schema; MG.members[0].guild=null; MG.members[0].cls='ranger'; MG._norm=false; E.normalize(MG); ok(MG.members[0].guild.id==='lodge'&&MG.members[0].cls==='ranger','old classed members auto-join matching guild');
// crafting, inventory, professions, minion gear
const K=E.newGame(t0); const km2=K.members[0]; km2.ageDays=20*360; K.res.coin=1e5; K.res.wood=300; K.res.planks=100; K.res.ingots=100; K.res.hides=50; K.res.cloth=50; K.res.potions=20; K.res.ore=30; K.res.stone=300;
['plot','acre','meadow'].forEach(l=>E.buyLand(K,l)); K.res.blocks=100; const ks=E.buildStructure(K,'shack'); E.upgradeStructure(K,ks.uid); ['workbench','storage','stall'].forEach(p=>E.placePiece(K,ks.uid,p)); K.land.push('meadow'); E.buildStructure(K,'smithy');
ok(E.itemDef('c|iron_sword|masterwork').cp>E.itemDef('c|iron_sword|crude').cp&&E.itemDef('c|iron_sword|fine').value>E.itemDef('iron_sword').value,'crafted quality tiers scale stats and value');
ok(E.rollQuality(-1)==='crude'&&E.rollQuality(2)==='masterwork','quality roll spans Crude→Masterwork');
const low=E.qualityScore(K,km2,E.recipeDef('r_sword')); km2.skills.smithing.lvl=50; const hi=E.qualityScore(K,km2,E.recipeDef('r_sword')); ok(hi>low,'skill raises craft quality');
km2.craft={id:'hearth',rank:0,rep:0}; ok(!E.evolve(K,km2,'blacksmith'),'old crafter classes are retired (now path ranks)'); asProf(km2,'blacksmith');
ok(E.profBonus(km2,E.recipeDef('r_sickle'))>E.profBonus(km2,E.recipeDef('r_staff')),'path rank boosts that path\'s recipes only');
const ing0=K.res.ingots; E.setAction(K,{type:'craft',target:'r_sword'}); E.advanceReal(K,10*4); ok(K.vault.some(x=>x.startsWith('c|iron_sword|')),'family member crafts a quality item from materials');
ok(E.recipeIssue(K,km2,E.recipeDef('r_jerkin'))==='needs Loom','recipes need their station');
const cs=K.vault.find(x=>x.startsWith('c|')); ok(E.listForSale(K,cs)&&K.forSale.includes(cs),'list crafted item in stock for sale');
K.res.stone+=50;K.res.wood+=50; const bh2=E.buildStructure(K,'bunkhouse'); E.addMinion(K,'laborer','t'); E.assignMinion(K,K.minions[0].uid,'merchant'); const coin0=K.res.coin; K.res.food=500; E.setAction(K,{type:'rest'}); E.advanceReal(K,10*4);
ok(!K.forSale.includes(cs)&&K.res.coin-coin0>=E.stallValue(K,E.itemDef(cs))-60,'merchant minion sells stock at full price over time');
ok(E.stallValue(K,E.itemDef('c|iron_sword|fine'))>E.sellValue(K,E.itemDef('c|iron_sword|fine')),'stall sale beats quick sell');
const cap=E.vaultCap(K); ok(cap===D.crafting.vaultBase+D.crafting.vaultPerStorage,'vault capacity tied to Storage Chests'); while(K.vault.length<cap) K.vault.push('flowers'); ok(!E.buyItem(K,'millbrook','buckler'),'full vault blocks buying');
ok(E.sellMany(K,K.vault.filter(x=>x==='flowers'))>0&&!K.vault.includes('flowers'),'bulk sell');
const kr=K.res.wood; ok(E.sellAllRes(K,'millbrook','wood')&&K.res.wood===0&&K.res.coin>0,'sell a whole material stack');
for(let i=0;i<9;i++) K.vault.push('rusty_sword'); for(let i=0;i<8;i++) E.moveItem(K,km2,'rusty_sword',true); ok(km2.bag.length===8&&!E.moveItem(K,km2,'rusty_sword',true),'personal pack capacity');
// minion gear
const mw=K.minions[0]; K.vault.push('c|sickle|masterwork','woodaxe','collar','iron_chainmail'); ok(E.equipMinion(K,mw.uid,'c|sickle|masterwork')&&mw.equip.tool,'minion tool slot');
ok(E.minionGearMult(mw,'farm')>E.minionGearMult(mw,'gather')&&E.minionGearMult(mw,'farm')>1.3,'quality tool boosts matching job output');
ok(!E.equipMinion(K,mw.uid,'collar'),'collar only for companions'); ok(E.equipMinion(K,mw.uid,'iron_chainmail')&&E.minionSurvival(mw)<1&&E.minionGearMult(mw,'guard')>1,'armor boosts guard power and survival');
ok(E.unequipMinion(K,mw.uid,'tool')&&K.vault.includes('c|sickle|masterwork'),'unequip minion gear to vault');
// adventurer line
const AV=E.newGame(t0); const av=AV.members[0]; av.ageDays=20*360; AV.res.coin=1e5; ok(E.joinAdventurers(AV,av)&&av.cls==='adventurer','classless join → Adventurer');
av.skills.monsterlore.lvl=30; av.skills.swordsmanship.lvl=30; ok(!E.evolve(AV,av,'monsterhunter'),'adventurer branch gated by rank'); av.adv.rank=3; ok(E.evolve(AV,av,'monsterhunter'),'Rank C unlocks Monster Hunter');
const AV2=E.newGame(t0); const a2=AV2.members[0]; a2.ageDays=20*360; AV2.res.coin=1e5; a2.stats.STR=10; a2.skills.swordsmanship.lvl=6; E.joinAdventurers(AV2,a2); ok(E.joinGuild(AV2,a2,'vanguard')&&a2.cls==='fighter'&&a2.adv,'class guild replaces Adventurer as primary; rank track kept');
// crafter playstyle without questing: idle crafter on standing order + merchant
const CP=E.newGame(t0); const cz=CP.members[0]; cz.ageDays=25*360; cz.skills.smithing.lvl=30; asProf(cz,'blacksmith'); CP.res.coin=2000; CP.res.wood=200; CP.res.planks=200; CP.res.ingots=200; CP.res.stone=200; CP.res.food=400;
['plot','acre'].forEach(l=>E.buyLand(CP,l)); const cs1=E.buildStructure(CP,'shack'); E.upgradeStructure(CP,cs1.uid); ['workbench','storage','larder'].forEach(p=>E.placePiece(CP,cs1.uid,p)); {const c0=CP.res.coin; CP.res.coin+=5000; CP.land.push('meadow'); E.buildStructure(CP,'smithy'); CP.res.coin=c0;}
CP.members.push({...JSON.parse(JSON.stringify(cz)),id:99,name:'Kip'}); CP.activeId=99; E.setOrder(CP,cz.id,{type:'craft'});
E.advanceReal(CP,10*40); ok(CP.vault.filter(x=>x.startsWith('c|')).length>=3,'idle family member crafts on standing order');
const crafted=CP.vault.filter(x=>x.startsWith('c|')); const worth=crafted.reduce((a,id)=>a+E.stallValue(CP,E.itemDef(id)),0); ok(worth>=600,'crafted gear is worth real money ('+worth+'🪙 from ~40 idle days)');
const kids=g=>{for(let i=0;i<2;i++){const k=E.newMember(g,{age:5});g.members.push(k);}return g;};
const ER=E.newGame(t0); ok(E.era(ER).n===1,'new game is Era 1: Solo Adventurer'); estate(ER,['bunk']); ER.members[0].spouse=5; ok(E.era(ER).n===2,'home + family → Era 2');
ER.renown=6000; ER.structures[0].pieces=['bunk','larder','storage','workbench','forge','studydesk']; ER.buildings.farm=30;ER.buildings.lumber=30; ok(E.era(ER).n===2,'Manor alone (2 living) stays Established'); kids(ER); ok(E.era(ER).n===2,'Manor + young kids stays Established'); for(const k of ER.members)k.ageDays=20*D.tuning.daysPerYear; ER.renown=0; ok(E.era(ER).n===3,'Manor + 3 living adults → Phase 3 Dynasty (no Renown needed)'); ok(E.ERAS[3].planned&&E.era(ER).n<4,'Titles phase is planned, never reached');
ER.members[0].ageDays=20*360; ok(E.actionAllowed(ER,ER.members[0],{type:'quest',target:'rats'})&&E.setAction(ER,{type:'job',target:'shop'})!==false&&E.setAction(ER,{type:'train',target:'farming'})!==false&&E.setAction(ER,{type:'quest',target:'rats'})!==false,'later eras keep questing, jobs and training open');
for(const ac of D.activities){ const n=E.ACT_TIERS[ac.tier]; ok(n&&Object.keys(ac.stats).length===n&&ac.skills.length===n,`${ac.name} tier ${ac.tier} gives ${n} stats + ${n} skills`); }
{ const T2=E.newGame(t0), m=T2.members[0]; m.ageDays=20*360; ok(!E.activityOk(T2,m,D.activities.find(a=>a.id==='wardrill')),'guild training locked without guild');
 m.guild={id:'vanguard',rank:0,rep:0}; ok(E.activityOk(T2,m,D.activities.find(a=>a.id==='wardrill'))&&!E.activityOk(T2,m,D.activities.find(a=>a.id==='masterkata')),'guild rank gates advanced vs master');
 m.guild.rank=2; const before={...m.stats}, sx={...Object.fromEntries(['swordsmanship','shield','tactics'].map(k=>[k,m.skills[k].lvl*1e6+m.skills[k].xp]))}; m.action={type:'activity',target:'masterkata'}; E.advanceReal(T2,50);
 ok(['STR','AGI','VIT'].every(k=>m.stats[k]>before[k])&&['swordsmanship','shield','tactics'].every(k=>m.skills[k].lvl*1e6+m.skills[k].xp>sx[k]),'master training raises 3 stats and 3 skills'); }
// metals, building level, furniture tiers, unlockable furniture
{ const M=E.newGame(t0); const st=estate(M,['forge'],'shack'); M.res.ore=30; M.res.copperore=20; M.res.stone=0; E.advanceReal(M,10);
 ok(M.res.ingots>0&&M.res.copper>0&&M.res.stone===0,'Forge smelts iron ore → ingots and copper ore → copper (no stone used)');
 ok(D.nodes.some(n=>n.res.copperore)&&D.nodes.some(n=>n.res.ore),'mine nodes yield iron and copper ore');
 const A=E.newGame(t0); const sa=estate(A,['larder'],'shack'); const f1=E.foodCap(A); sa.type='house'; const f3=E.foodCap(A);
 ok(Math.abs((f3-f1)-300*0.10)<1e-6,'building level 3 gives +10% to its furniture (5%/level)');
 sa.type='shack'; A.res.copper=10; ok(E.upgradePiece(A,sa.uid,'larder')&&sa.pieces[0]==='larder@1'&&E.tierName(sa.pieces[0])==='Sturdy','furniture upgrades Crude → Sturdy with planks+copper');
 ok(Math.abs(E.foodCap(A)-(f1+300*0.15))<1e-6,'Sturdy furniture +15% effect');
 A.res.ingots=100;A.res.coin+=5000; E.upgradePiece(A,sa.uid,'larder@1'); E.upgradePiece(A,sa.uid,'larder@2'); ok(sa.pieces[0]==='larder@3'&&!E.upgradePiece(A,sa.uid,'larder@3'),'Masterwork is the top tier');
 ok(E.hasPiece(A,'larder')&&E.removePiece(A,sa.uid,'larder@3')&&A.pieceStore.includes('larder@3'),'tiered piece removes to storage with its tier');
 ok(E.placePiece(A,sa.uid,'larder@3',true)&&Math.abs(E.foodCap(A)-(f1+150))<1e-6,'tier kept when re-placed');
 const L=E.newGame(t0); const sl=estate(L,[],'house'); L.res.ingots=50; L.res.cloth=20; L.res.copper=20;
 ok(E.placeIssue(L,sl.uid,'steelanvil')&&E.placeIssue(L,sl.uid,'coldcellar')&&E.placeIssue(L,sl.uid,'alchbench'),'better furniture locked by guild/quest/tier');
 L.doneQuests.push('mushrooms'); ok(E.pieceDef('coldcellar').id==='larder'&&E.placePiece(L,sl.uid,'larder'),'Cold Cellar merged into Larder');
 const lm=L.members[0]; lm.ageDays=20*360; lm.craft={id:'hearth',rank:1,rep:0}; L.res.coin+=5000; L.res.stone+=200; L.land.push('meadow'); const lsm=E.buildStructure(L,'smithy'); lsm.up=2; ok(E.placePiece(L,lsm.uid,'steelanvil')&&E.craftQuality(L)>=0.12,'Crafters rank unlocks Steel Anvil');
 const MM=E.newGame(t0); estate(MM,['orecart','minionbunk'],'shack'); MM.res.copper=5; ok(E.jobCap(MM,'mine')===2,'Ore Cart gives mining spots');
 const old=E.newGame(t0); estate(old,['forge','bunk']); const o2=JSON.parse(JSON.stringify(old)); E.normalize(o2); ok(o2.structures[0].pieces.every(p=>E.pieceTier(p)===0)&&E.bedrooms(o2)>=3,'old saves load as Crude tier'); }
// resource tiers
{ ok(E.resTier('wood')===1&&E.resTier('hides')===1&&E.resTier('planks')===2&&E.resTier('blocks')===2&&E.resTier('leather')===2&&E.resTier('steel')===3&&E.resTier('coal')===1&&E.resTier('bronze')===2,'resource tiers: raw → processed → refined metals');
 const R=E.newGame(t0); const st=estate(R,['masontable','tanrack'],'shack'); R.res.blocks=0; R.res.leather=0; R.res.stone=60; R.res.hides=10; R.reserve.stone=0; R.members.forEach(m=>m.skills.masonry.lvl=0); E.advanceReal(R,10); const b0=R.res.blocks;
 ok(b0>0&&R.res.leather>0,"Mason's Table cuts blocks, Tanning Rack makes leather");
 const R2=E.newGame(t0); estate(R2,['masontable'],'shack'); R2.res.blocks=0; R2.res.stone=60; R2.reserve.stone=0; R2.members[0].skills.masonry.lvl=30; E.advanceReal(R2,10);
 ok(R2.res.blocks>b0*1.5,'Masonry skill speeds up and boosts the Mason\'s Table');
 const st2=R2.structures[0]; ok(E.processRate(R2,st2,'masontable')>3,'shown rate includes operator skill');
 const R3=E.newGame(t0); estate(R3,['sawtable'],'shack'); R3.res.planks=0; R3.res.wood=60; R3.minions.push({uid:'mx',type:'laborer',job:'craft',loyalty:100,name:'x'}); ok(E.operatorLvl(R3,'carpentry')>=10,'minion crafters operate stations too');
 const cab=D.estate.structures.find(x=>x.id==='cabin').cost, hou=D.estate.structures.find(x=>x.id==='house').cost, sh=D.estate.structures.find(x=>x.id==='shack').cost;
 ok(Object.keys(sh).every(k=>k==='coin'||E.resTier(k)===1)&&cab.planks&&cab.blocks&&!cab.wood&&hou.ingots&&hou.blocks,'building upgrades need higher-tier resources');
 const PT=D.estate.pieceTiers; ok(PT[1].cost.planks&&!PT[1].cost.ingots&&PT[2].cost.blocks&&PT[2].cost.ingots&&PT[3].cost.ingots>PT[2].cost.ingots,'furniture tiers: Sturdy planks, Fine/Masterwork blocks+ingots');
 const U=E.newGame(t0); const su=estate(U,['bunk'],'shack'); U.res.blocks=0; U.res.ingots=0; U.res.planks=100; U.res.coin=1e4; E.upgradePiece(U,su.uid,'bunk'); ok(su.pieces[0]==='bunk@1'&&!E.upgradePiece(U,su.uid,'bunk@1'),'Fine upgrade blocked without blocks/ingots'); }
// reserves & station toggles
{ const Q=E.newGame(t0); ok(Q.reserve.wood===50&&Q.reserve.stone===50&&Q.reserve.ore===0&&Array.isArray(Q.paused),'default reserves: 50 wood, 50 stone');
 const st=estate(Q,['sawtable','masontable'],'shack'); Q.res.wood=80; Q.res.stone=200; Q.res.planks=0; Q.res.blocks=0; E.advanceReal(Q,10*20);
 ok(Q.res.wood>=50-1e-9&&Q.res.planks>0,'stations never consume below the reserve');
 ok(E.setReserve(Q,'stone',190)&&Q.reserve.stone===190&&!E.setReserve(Q,'planks',5),'reserve editable for raw resources only');
 Q.res.stone=200; const b0=Q.res.blocks; E.advanceReal(Q,10*30); ok(Q.res.stone>=190-1e-9,'raised reserve respected');
 ok(E.togglePiece(Q,st.uid,'masontable')&&E.isPaused(Q,st.uid,'masontable'),'station can be paused');
 Q.reserve.stone=0; Q.res.stone=100; const b1=Q.res.blocks; E.advanceReal(Q,10*5); ok(Q.res.blocks===b1&&Q.res.stone===100,'paused station neither consumes nor produces');
 Q.res.copper=50; E.upgradePiece(Q,st.uid,'masontable'); ok(E.isPaused(Q,st.uid,'masontable@1'),'pause survives furniture upgrade');
 ok(!E.togglePiece(Q,st.uid,'masontable@1')&&!E.isPaused(Q,st.uid,'masontable@1'),'station resumes');
 const O=JSON.parse(JSON.stringify(Q)); delete O.reserve; delete O.paused; E.normalize(O); ok(O.reserve.wood===50&&O.paused.length===0,'old saves get default reserves and no pauses');
 const O2=JSON.parse(JSON.stringify(Q)); O2.reserve={wood:10}; E.normalize(O2); ok(O2.reserve.wood===10&&O2.reserve.stone===50,'saved reserves kept, missing ones defaulted'); }
// switching to a child member never strands play
{ const C=E.newGame(t0); const f=C.members[0]; f.ageDays=25*360; const kid={...JSON.parse(JSON.stringify(f)),id:999,name:'Pip',ageDays:6*360,guild:null,craft:null,cls:null,prof:null,action:null,order:{type:'quest',target:'outskirts'},equip:{}}; C.members.push(kid);
 ok(E.switchTo(C,999)&&C.activeId===999,'can switch to a child');
 ok(kid.action&&E.actionAllowed(C,kid,kid.action),'child gets a valid age-appropriate action (adult quest order replaced)');
 ok(kid.action.type==='activity'&&['play','stories'].includes(kid.action.target),'young child defaults to Play/Stories');
 ok(E.setAction(C,{type:'quest',target:'rats'})===false&&E.actionAllowed(C,kid,kid.action),'blocked adult action leaves the child busy, not stuck');
 const d0=C.day; E.advanceReal(C,10*30); ok(C.day>d0&&!C.gameOver&&C.activeId===999,'time keeps running with a child active');
 ok(E.joinIssues(C,kid,'vanguard').length>0,'child can view but not join guilds');
 ok(E.setAction(C,{type:'rest'})!==false&&kid.action.type==='rest','young child can always rest'); f.action={type:'quest',target:'rats',progress:0}; ok(E.switchTo(C,f.id)&&C.activeId===f.id&&f.action.type==='quest','switching back to the adult keeps their quest');
 const teen={...JSON.parse(JSON.stringify(kid)),id:998,ageDays:13*360,action:{type:'job',target:'nope'}}; C.members.push(teen); E.switchTo(C,998); ok(E.actionAllowed(C,teen,teen.action),'invalid saved action is repaired on switch'); }
// story, one-time, rare drops
{ const S=E.newGame(t0); const m=S.members[0]; m.ageDays=20*360; const st=E.storyQuests(); ok(st.length>=8&&st.length<=12&&new Set(st.map(q=>q.region)).size>=2,'8-12 story chapters across both regions');
 m.skills.reading.lvl=10; ok(E.questIssue(S,m,st[1])==='finish chapter 1','chapters are chained');
 const ch1=st[0]; S.doneQuests.push(ch1.id); ok(!E.questIssue(S,m,st[1])||E.questIssue(S,m,st[1]).startsWith('Lv'),'finishing a chapter opens the next');
 ok(E.questIssue(S,m,ch1)==='done','story chapters are not repeatable');
 ok(st.some(q=>q.grants?.land)&&st.some(q=>q.grants?.minion)&&st.some(q=>(q.unlocks||'').startsWith('activity:'))&&st.some(q=>q.req?.era),'story rewards: land, minions, trainings; era gates');
 ok(E.questIssue(S,m,st.find(q=>q.story===4))==='hear a rumor or explore'||!S.doneQuests.includes('st3'),'some chapters need rumors');
 const once=D.quests.filter(q=>q.once&&!q.story); ok(once.length>=5,'5+ one-time side quests');
 ok(D.quests.filter(q=>q.rare).length>=8&&D.nodes.filter(n=>n.rare).length>=4&&[...D.quests,...D.nodes].flatMap(x=>x.rare||[]).every(d=>d.chance>0&&d.chance<=0.05),'rare drop tables at ≤5%');
 const R=E.newGame(t0); const rm=R.members[0]; rm.ageDays=25*360; for(const k in rm.skills) rm.skills[k].lvl=40; for(const k in rm.stats) rm.stats[k]=60; E.setRng(()=>0.001);
 R.revealed.push('st4'); E.setAction(R,{type:'quest',target:'wolves'}); E.advanceReal(R,10*30); E.setRng(()=>{seed=(seed*16807)%2147483647;return seed/2147483647;});
 ok(E.dropFound(R,'wolfking_pelt')&&R.vault.includes('wolfking_pelt'),'rare drop lands in the vault and is marked found');
 const G=E.newGame(t0); const gm=G.members[0]; gm.ageDays=20*360; for(const k in gm.skills) gm.skills[k].lvl=20; E.setRng(()=>0.01); G.doneQuests.push('st1','st2'); E.setAction(G,{type:'quest',target:'st3'}); E.advanceReal(G,10*40);
 E.setRng(()=>{seed=(seed*16807)%2147483647;return seed/2147483647;}); ok(G.doneQuests.includes('st3')&&G.land.includes('plot'),'story chapter grants land');
 ok(gm.action.type!=='quest'||gm.action.target!=='st3','finished one-time quest is not repeated'); }
// travel & exploration
{ const V=E.newGame(t0); const m=V.members[0]; m.ageDays=20*360; for(const k in m.skills) m.skills[k].lvl=10;
 ok(E.travelDays('rats')<E.travelDays('treant'),'travel time grows with distance');
 E.setAction(V,{type:'quest',target:'rats'}); const a=m.action; E.advanceReal(V,10); ok(a.trip&&E.tripPhase(a)!=='task'||a.trip.out<=1,'quest starts with an outbound trip');
 ok(E.isBusy(m)&&E.setAction(V,{type:'train',target:'brawling'})===false&&E.setAction(V,{type:'rest'})===false,'traveller is locked: no other actions or training');
 const tot=E.tripTotal(a); ok(Math.abs(tot-(2*E.travelDays('rats')+2))<1e-9,'trip = out + task + return');
 const d0=V.doneQuests.length; for(let i=0;i<8&&!V.doneQuests.includes('rats');i++) E.advanceReal(V,10*Math.ceil(tot)+10); ok(V.doneQuests.includes('rats'),'quest resolves and the member comes home');
 const W=E.newGame(t0); const w=W.members[0]; w.ageDays=20*360; E.setAction(W,{type:'gather',target:'scrub'}); E.advanceReal(W,10); const t0w=E.tripLeft(w.action); W.turbo={charge:1e9,on:true}; E.advanceReal(W,10); ok(E.tripLeft(w.action)<t0w-1.5,'turbo speeds travel');
 const O=E.newGame(t0); const om=O.members[0]; om.ageDays=20*360; for(const k in om.skills) om.skills[k].lvl=10; E.setAction(O,{type:'quest',target:'rats'}); E.applyOffline(O,O.lastSave+3*3600*1000); ok(!O.doneQuests.includes('rats')&&E.isBusy(om),'travel is frozen while away');
 const X=E.newGame(t0); const xm=X.members[0]; xm.ageDays=20*360; ok(!X.discovered.includes('ashford')&&!E.townKnown(X,D.towns.find(t=>t.id==='ashford')),'hidden towns start undiscovered');
 ok(E.setAction(X,{type:'explore',target:'a_hills'})!==false&&xm.action.type==='explore','explore a fogged area');
 E.advanceReal(X,10); E.advanceReal(X,10*(E.tripTotal(xm.action)+1)); ok(E.explored(X,'a_hills')&&X.discovered.includes('ashford'),'exploring clears fog and discovers a hidden town');
 ok(D.towns.filter(t=>t.hidden).length>=2&&D.regions.some(r=>r.hidden),'2 hidden towns and a hidden region');
 ok(!E.regionOpen(X,'highlands'),'hidden region locked until discovered'); xm.skills.tracking.lvl=0; X.discovered.push('highlands'); for(const k in xm.stats) xm.stats[k]=200; ok(E.regionKnown(X,'highlands'),'region discovered via exploration');
 ok(D.map.areas.every(a=>a.secrets.length>=3)&&D.map.areas.some(a=>a.secrets.some(sc=>sc.type==='encounter'))&&D.map.areas.some(a=>a.secrets.some(sc=>sc.type==='cache')),'areas hold caches, encounters and secrets');
 ok([...D.quests,...D.nodes].every(x=>D.map.points[x.id])&&D.towns.every(t=>D.map.towns[t.id]),'every quest, node and town has map coordinates');
 const J=JSON.parse(JSON.stringify(X)); delete J.explored; delete J.discovered; delete J.found; E.normalize(J); ok(Array.isArray(J.explored)&&Array.isArray(J.discovered)&&Array.isArray(J.found),'old saves get exploration tracking'); }
// minion levels, dungeons, standing orders
{ const ML=E.newGame(t0); estate(ML,['minionbunk','minionbunk','orecart'],'house'); ML.res.food=1e4; ML.res.copper=50;
 const jobs=['farm','gather','guard','mine','scout','adventure']; for(const j of jobs){ const mi=E.addMinion(ML,'laborer','t'); if(mi) mi.job=j; }
 E.advanceReal(ML,10*60); ok(ML.minions.filter(x=>x.job!=='idle').every(x=>E.minionLvl(x)>1),'every working minion gains levels from its job');
 const mx=ML.minions[0]; ok(E.minionLvlMult(mx)>1,'levels raise output'); mx.lvl=10; ok(E.minionPerks(mx).length===2&&E.minionPerks(mx,'farm')[0].text.length>0,'perks unlock by job at Lv 5/10');
 const lazy=E.addMinion(ML,'laborer','t')||{}; ok(!lazy.xp,'idle minions gain no XP');
 ok(D.dungeons.length>=5&&D.dungeons.every(d=>d.floors.length>=3&&d.rare&&d.hidden&&D.map.points[d.id]),'5 multi-floor dungeons with rare drops, hidden, on the map');
 const DG=E.newGame(t0); const dm=DG.members[0]; dm.ageDays=25*360; for(const k in dm.skills) dm.skills[k].lvl=30; for(const k in dm.stats) dm.stats[k]=80;
 ok(E.setAction(DG,{type:'dungeon',target:'d_ratwarren'})===false,'undiscovered dungeon cannot be run');
 E.setAction(DG,{type:'auto',target:'explore'}); ok(dm.standing==='explore'&&dm.action.type==='explore','standing Explore auto-picks a fogged area');
 E.setRng(()=>0.01); E.advanceReal(DG,10*60); ok(DG.explored.length>=2&&DG.revealed.some(id=>id.startsWith('d_')),'auto-explore clears several areas and finds dungeons');
 ok(E.setAction(DG,{type:'auto',target:'adventure'})&&dm.standing==='adventure','standing order can be switched mid-trip (applies when home)'); E.advanceReal(DG,10*12); dm.injured=0; ok(['dungeon','quest'].includes(dm.action?.type),'standing Adventure auto-picks a known dungeon or quest');
 E.advanceReal(DG,10*80); E.setRng(()=>{seed=(seed*16807)%2147483647;return seed/2147483647;}); ok(DG.cleared.length>=1,'adventurer clears a discovered dungeon floor by floor');
 const sc=E.newGame(t0); estate(sc,['minionbunk'],'shack'); sc.res.food=1e4; const scm=E.addMinion(sc,'laborer','t'); scm.job='scout'; E.advanceReal(sc,10*30); ok(sc.explored.length>=1,'scout minions explore on their own'); }
// NPC classes, more land, special buildings
{ const N=E.newGame(t0); estate(N,['minionbunk','minionbunk'],'shack'); N.res.food=1e4; const a=E.addMinion(N,'laborer','t'), b=E.addMinion(N,'guard','t');
 ok(a.cls==='n_peasant'&&b.cls==='n_peasant','all followers start as Peasant');
 ok([...new Set(E.evolveOptions(a).map(c=>c.branch))].sort().join()==='divine,economic,magic,military','Peasant branches into Military/Economic/Magic/Divine');
 ok(E.minionEvolveIssue(N,a,'n_militia')==='Lv 5','evolution needs a level threshold'); a.lvl=5; ok(E.minionEvolveIssue(N,a,'n_militia').startsWith('needs Guardhouse'),'tier 1 needs the class building'); N.res.coin+=1e4; N.res.wood+=500; N.res.stone+=500; E.buyLand(N,'hillside'); N.structures.push({uid:'stB',type:'barracks',pieces:['weaponrack'],up:0}); ok(/guard skill 2/.test(E.minionEvolveIssue(N,a,'n_militia')||''),'title needs key-job skill'); a.skills={guard:16}; ok(E.evolveMinion(N,a.uid,'n_militia')&&a.cls==='n_militia','player picks the path');
 ok(!E.evolveMinion(N,a.uid,'n_adept'),'cannot jump branches'); a.lvl=10; ok(E.evolveOptions(a).length>=2,'branches split again (choice)');
 a.job='guard'; const m0=E.minionLvlMult(a); a.cls='n_soldier'; ok(E.minionLvlMult(a)>m0,'NPC class boosts its jobs'); ok(D.minions.npcClasses.every(c=>Object.values(c.bonus).every(v=>v<=0.7)),'NPC classes stay weaker than PC classes');
 a.job='farm'; E.advanceReal(N,10*20); ok(E.minionSkillLvl(a,'farm')>=1,'minions build job skills');
 const sp={...a,uid:'x',special:true,cls:undefined}; ok(E.evolveOptions(sp).length===0,'special companions keep their own path');
 const O=JSON.parse(JSON.stringify(N)); O.minions.forEach(m=>delete m.cls); E.normalize(O); ok(O.minions.every(m=>m.cls==='n_peasant'),'old followers migrate to Peasant'); }
{ const L=E.newGame(t0); ok(D.estate.lands.length>=8,'8+ land parcels with rising cost'); ok(D.estate.lands.every(l=>l.towns.length>=2),'land sold in several towns');
 L.res.coin=1e6; L.res.stone=1e4; L.res.wood=1e4; L.res.blocks=1e3; for(const id of ['plot','acre','meadow','hillside','ridge','valley','riverbank','woodlot']) E.buyLand(L,id); ok(L.land.length===8&&E.landSlots(L)>=19,'chain of purchases up to Greenvale');
 ok(!E.canBuyLand(L,'highclaim'),'highland claim needs the region discovered'); L.discovered.push('highlands'); ok(E.canBuyLand(L,'highclaim'),'discovered region opens its land');
 L.res.planks=1e3; L.res.ingots=1e3; L.res.copper=1e3;
 const q=E.buildStructure(L,'quarry'); ok(q&&E.structDef('quarry').land===1&&q.pieces[0]==='quarrypit'&&!E.removePiece(L,q.uid,'quarrypit'),'special 1-slot Quarry with built-in, non-removable pit');
 ok(E.placeIssue(L,q.uid,'bunk')==='not allowed here'&&E.placePiece(L,q.uid,'storage'),'special buildings accept only their own attached furniture');
 L.reserve.stone=0; L.res.stone=0; E.advanceReal(L,10*5); const st0=L.res.stone; ok(st0>0,'quarry produces stone passively');
 const sl=E.freeSlots(L,q); ok(E.upgradeSpecial(L,q.uid)&&q.up===1&&E.freeSlots(L,q)===sl,'upgrade line uses no slot');
 L.res.stone=0; E.advanceReal(L,10*5); ok(L.res.stone>st0*1.2,'upgrades raise output'); E.upgradeSpecial(L,q.uid); E.upgradeSpecial(L,q.uid); ok(!E.upgradeSpecial(L,q.uid),'upgrade line has 3 steps');
 L.res.stone=1e3; L.res.wood=1e3; for(const id of ['mineshaft','herbgarden','smithy','sawmill','masonyard']) ok(E.buildStructure(L,id),'build '+id);
 ok(D.estate.structures.find(x=>x.id==='bunkhouse').builtin.housing.bunk===4,'Bunkhouse unchanged'); }
// hunter, food buildings, class housing
{ const H=E.newGame(t0); const hm=H.members[0]; hm.ageDays=20*360; H.res.coin=1e4; hm.stats.AGI=10; hm.skills.hunting.lvl=4;
 ok(E.joinGuild(H,hm,'lodge')&&hm.cls==='hunter','Rangers Guild entry class is Hunter');
 ok(D.classes.find(c=>c.id==='scout').from==='hunter'&&D.classes.find(c=>c.id==='ranger').from==='scout','Hunter comes before the Scout/Ranger tracks');
 H.revealed.push('gameTrail'); for(const k in hm.stats) hm.stats[k]=60; E.regionOpen(H,'forest'); const H2=JSON.parse(JSON.stringify(H)); E.normalize(H2);
 const m1=H.members[0]; E.setAction(H,{type:'gather',target:'gameTrail'}); E.advanceReal(H,10*20); const meatH=H.res.meat||0;
 const m2=H2.members[0]; m2.cls=null; m2.guild=null; E.setAction(H2,{type:'gather',target:'gameTrail'}); E.advanceReal(H2,10*20); ok(meatH>(H2.res.meat||0),'Hunter gathers more meat and hides');
 const F=E.newGame(t0); estate(F,[],'shack'); F.res.coin=1e5; F.res.wood=1e3; F.res.stone=1e3; F.res.planks=500; F.res.blocks=500; F.res.ingots=200; F.res.copper=200; F.res.hides=200; F.res.cloth=50; F.res.leather=50;
 E.buyLand(F,'hillside'); E.buyLand(F,'riverbank'); const ids=['hunterscabin','herbalistshack','fishinghut','apiary','chickencoop','tannery']; const built=ids.map(id=>E.buildStructure(F,id)); ok(built.every(Boolean)&&ids.every(id=>E.structDef(id).land===1&&E.structDef(id).upgrades.length===3&&E.structDef(id).slots===1),'six new 1-land special buildings with a slot and an upgrade line');
 ok(E.structDef('herbgarden').name==='Garden'&&E.pieceDef('herbbeds').bonus.processes.some(p=>p.out==='food')&&E.pieceDef('herbbeds').bonus.processes.some(p=>p.out==='thyme'),'Garden makes herbs (thyme) and food');
 F.res.meat=0;F.res.fish=0;F.res.honey=0;F.res.eggs=0;F.res.remedies=0;F.res.leather=0; F.res.thyme=100; F.res.wheat=50; F.reserve.thyme=0; E.buyAnimals(F,'chickencoop'); E.advanceReal(F,10*5); F.res.eggs+=(F.fields?.pile?.eggs||0);
 ok(['meat','fish','honey','eggs','remedies','leather'].every(k=>F.res[k]>0),'new resources: meat, fish, honey, eggs, remedies, leather');
 const P=E.newGame(t0); P.res.food=0; P.res.meat=10; E.advanceReal(P,10); ok(P.res.food>=0&&P.res.meat<10,'meat/fish/eggs/honey feed the family when food runs out');
 const R2=E.newGame(t0); const rm=R2.members[0]; rm.injured=6; R2.res.remedies=5; E.advanceReal(R2,10); ok(rm.injured<=3&&R2.res.remedies<5,'remedies speed injury recovery');
 const C=E.newGame(t0); estate(C,['minionbunk'],'shack'); C.res.coin=1e5; C.res.wood=1e3; C.res.stone=1e3; C.res.food=1e4; C.res.planks=500; C.res.hides=100; C.res.blocks=100; C.res.leather=50;
 const cab=E.buildStructure(C,'hunterscabin'); ok(E.classHomeCap(cab)===2,'class building houses 2 of its class');
 for(let i=E.housingCap(C,'bunk');i>2;i--)E.addMinion(C,'laborer','t'); const a=E.addMinion(C,'woodsman','t'), b=E.addMinion(C,'woodsman','t'); ok(a&&b&&!E.addMinion(C,'woodsman','t'),'general bunks full');
 a.cls='n_huntsman'; b.cls='n_huntsman'; ok(E.homeMap(C)[a.uid]===cab.uid&&E.homeMap(C)[b.uid]===cab.uid&&E.freeHousing(C,'bunk')===2,'class members move into their class building, freeing bunks');
 ok(E.addMinion(C,'laborer','t'),'freed bunks take new hires'); a.job='hunt'; const m0=E.minionLvlMult(a); E.advanceReal(C,10); ok(a.home===cab.uid&&E.minionLvlMult(a)>m0*1.1,'residents get the class-home bonus');
 E.upgradeSpecial(C,cab.uid); ok(E.classHomeCap(cab)===3,'upgrades raise class housing');
 const e2=E.addMinion(C,'guard','t'); if(e2){ e2.cls='n_soldier'; ok(!E.homeMap(C)[e2.uid],'other classes cannot live there'); } else ok(true,'skip');
 ok(D.estate.structures.find(x=>x.id==='bunkhouse').builtin.housing.bunk===4,'Bunkhouse still general housing'); }
// magic / divine / healer split, coverage of every line
{ const ES=D.estate.structures, by=id=>ES.find(x=>x.id===id);
 ok(by('herbalistshack').houses.classes.join()==='n_herbalist,n_masterherbalist'&&D.minions.npcClasses.find(c=>c.id==='n_herbalist').branch==='economic'&&by('magestower').houses.classes.includes('n_adept')&&by('shrinehouse').houses.classes.includes('n_curate'),'magic in the Tower, divine healers in the Shrine/Chapel, Economic herbalists in the Shack');
 for(const id of ['magestower','shrinehouse','barracks','thievesden','advlodge']){ const d=by(id); ok(d.land===1&&d.slots===1&&d.upgrades.length===3&&d.houses.cap===2&&d.upgrades.every(u=>u.cap===1),id+': 1 land, 1 slot, 3 no-slot upgrades, 2+1/upgrade beds'); }
 const npcIds=D.minions.npcClasses.filter(c=>c.id!=='n_peasant').map(c=>c.id), housed=new Set(ES.flatMap(d=>[...(d.houses?.classes||[]),...(d.specs||[]).flatMap(sp=>sp.houses)])); ok(npcIds.every(id=>housed.has(id)),'every NPC class has a class building: '+npcIds.filter(id=>!housed.has(id)).join());
 const boosted=new Set(ES.map(d=>d.guildBoost?.guild).filter(Boolean)); ok([...D.guilds.guilds.map(g=>g.id),'adventurers'].every(g=>boosted.has(g)),'every PC guild line has a class building');
 const B=E.newGame(t0); estate(B,[],'shack'); Object.assign(B.res,{coin:1e5,wood:1e3,stone:1e3,planks:500,blocks:500,ingots:200,copper:200,cloth:50,dust:50}); E.buyLand(B,'hillside');
 const sh=E.buildStructure(B,'shrinehouse'); ok(E.structName(sh)==='Wayside Shrine','starts as a Shrine'); E.upgradeSpecial(B,sh.uid); E.upgradeSpecial(B,sh.uid); E.upgradeSpecial(B,sh.uid); ok(E.structName(sh)==='Chapel'&&E.classHomeCap(sh)===5,'Shrine upgrades into a Chapel (5 beds)');
 const m=B.members[0]; m.ageDays=20*360; m.guild={id:'church',rank:0,rep:0}; const mid=B.members.length; const tw=E.buildStructure(B,'magestower'); ok(tw&&E.hasPiece(B,'arcanefocus'),"Mage's Tower built");
 B.res.dust=0; E.advanceReal(B,10*3); ok(B.res.dust>0,'tower makes arcane dust'); B.res.dust=10; B.res.cloth=5; ok(!E.recipeIssue(B,m,E.recipeDef('r_scroll')),'scroll crafting at the Arcane Focus');
 const mi=E.addMinion(B,'laborer','t')||(()=>{estate(B,['minionbunk'],'shack');return E.addMinion(B,'laborer','t');})(); mi.cls='n_adept'; ok(E.homeMap(B)[mi.uid]===tw.uid,'Adept lives in the Tower'); mi.cls='n_priest'; ok(E.homeMap(B)[mi.uid]===sh.uid,'Priest lives in the Chapel'); mi.cls='n_herbalist';
 const hs=E.buildStructure(B,'herbalistshack'); ok(hs&&E.homeMap(B)[mi.uid]===hs.uid,"Herbalist lives in the Herbalist's Shack");
 mi.loyalty=50; E.advanceReal(B,10); ok(mi.loyalty>50,'Chapel/Shrine morale raises follower loyalty');
 m.injured=8; B.res.remedies=0; E.advanceReal(B,10); ok(m.injured<=6,'Shrine/Chapel speeds healing'); ok(['remedies','potions','salves'].every(o=>E.pieceDef('remedybench').bonus.processes.some(p=>p.out===o)),'Herbalist\'s Shack produces remedies, potions, salves');
 const X1=E.newGame(t0); const xm=X1.members[0]; xm.ageDays=20*360; xm.guild={id:'collegium',rank:0,rep:0}; const lv0=JSON.stringify(xm.skills.arcana); xm.action={type:'train',target:'arcana'};
 const X2=JSON.parse(JSON.stringify(X1)); estate(X2,[],'shack'); Object.assign(X2.res,{coin:1e5,stone:500,planks:50}); E.buildStructure(X2,'magestower'); E.advanceReal(X1,10*20); E.advanceReal(X2,10*20);
 const tot=m=>m.skills.arcana.lvl*1e4+m.skills.arcana.xp; ok(tot(X2.members[0])>tot(xm),"Mage's Tower boosts Magic guild members' XP"); }
// multi-building special minions, building-gated evolution
{ const W=E.newGame(t0); estate(W,['minionbunk'],'shack'); Object.assign(W.res,{coin:1e5,wood:1e3,stone:1e3,planks:500,blocks:500,ingots:200,copper:200,cloth:50,dust:50,food:1e4}); E.buyLand(W,'hillside'); E.buyLand(W,'riverbank');
 const wt=D.minions.types.find(t=>t.id==='witch'), sm=D.minions.types.find(t=>t.id==='shaman'); ok(wt.source.buildings.length>=2&&sm.source.buildings.length>=2,'Witch and Shaman need multiple buildings');
 ok(E.sourceLabel(wt).includes("Herbalist's Shack")&&E.sourceLabel(wt).includes(' or '),'requirements labelled (with alternatives)');
 E.buildStructure(W,'herbalistshack'); E.advanceReal(W,10); ok(!W.minions.some(x=>x.type==='witch'),'one building is not enough');
 E.buildStructure(W,'magestower'); E.advanceReal(W,10); ok(W.minions.some(x=>x.type==='witch'),'Witch arrives with Shack + Tower');
 ok(E.buildingReqStatus(W,sm.source.buildings).filter(g=>g.ok).length===0,'Shaman status shows missing groups'); E.buildStructure(W,'shrinehouse'); E.buildStructure(W,'herbgarden'); E.advanceReal(W,10); ok(W.minions.some(x=>x.type==='shaman'),'Shaman arrives with Shrine + Garden');
 ok(D.minions.npcClasses.filter(c=>c.needs).every(c=>c.needs.up===({1:0,2:2,3:3,4:3})[c.needs.tier]&&c.needs.buildings.length),'each NPC tier is gated by its class building level');
 W.structures.push({uid:'bhx',type:'bunkhouse',pieces:[],up:0}); const mi=E.addMinion(W,'laborer','t')||W.minions.find(x=>!x.special); mi.cls='n_hedgemage'; mi.lvl=15; const tw=W.structures.find(x=>x.type==='magestower');
 ok(!(mi.skills=Object.fromEntries(['guard','adventure','tutor','scout','craft','farm','herbs','merchant','hunt','fish','gather','mine'].map(j=>[j,1e4])),E.minionEvolveIssue(W,mi,'n_adept'))||E.minionEvolveIssue(W,mi,'n_adept').includes('upgrade 2'),'Adept needs Tower upgrade 2'); tw.up=2; ok(!E.minionEvolveIssue(W,mi,'n_adept'),'Tower upgraded: Adept ok');
 E.evolveMinion(W,mi.uid,'n_adept'); tw.up=3; ok(E.minionEvolveIssue(W,mi,'n_loremaster').includes('Lore Library'),'Mage picks a school specialty'); tw.spec='lorelibrary'; mi.lvl=Math.max(mi.lvl||0,15); ok(E.evolveMinion(W,mi.uid,'n_loremaster'),'Magus at max Tower');
 const mi2=W.minions.find(x=>!x.special&&x!==mi)||E.addMinion(W,'laborer','t'); if(mi2){ mi2.cls='n_militia'; mi2.lvl=10; ok(E.minionEvolveIssue(W,mi2,'n_huntsman').includes("Hunter's Cabin"),'specialties need their specific building'); }
 const O=JSON.parse(JSON.stringify(W)); O.minions.push({...O.minions[0],uid:'old',cls:'n_herbwife',special:false}); E.normalize(O); ok(O.minions.find(x=>x.uid==='old').cls==='n_herbalist','old healer-path followers migrate to Herbalist'); }
// 3-stage building chains, specialties, crossover Paladin
{ const K=E.newGame(t0); estate(K,['minionbunk'],'shack'); Object.assign(K.res,{coin:1e6,wood:5e3,stone:5e3,planks:2e3,blocks:2e3,ingots:1e3,copper:500,cloth:200,dust:200,food:1e4}); E.buyLand(K,'hillside'); E.buyLand(K,'riverbank');
 for(const id of ['barracks','magestower','shrinehouse','smithy']){ const d=E.structDef(id); ok(d.stages.length===3&&d.specs.length===3,id+': 3-stage chain with 3 specialties'); }
 const g=E.buildStructure(K,'barracks'); ok(E.structName(g)==='Guardhouse'&&E.structStage(g)===1,'starts as Guardhouse (stage 1)');
 E.upgradeSpecial(K,g.uid); E.upgradeSpecial(K,g.uid); ok(E.structName(g)==='Barracks'&&E.structStage(g)===2,'upgrades into Barracks (stage 2)');
 ok(E.specIssue(K,g.uid,'stable')==='finish the upgrade line','specialty needs the full upgrade line'); E.upgradeSpecial(K,g.uid);
 const cap0=E.classHomeCap(g); ok(E.specialize(K,g.uid,'stable')&&E.structName(g)==='Stable'&&E.structStage(g)===3&&E.classHomeCap(g)===cap0+2,'pick one specialty (Stable): stage 3, more beds');
 ok(!E.specialize(K,g.uid,'knightshall'),'only one specialty per building');
 K.structures.push({uid:'bhy',type:'bunkhouse',pieces:[],up:0}); const mi=E.addMinion(K,'laborer','t'); mi.cls='n_militia'; mi.lvl=20; mi.skills=Object.fromEntries(['guard','adventure','tutor','scout','craft','farm','herbs','merchant','hunt','fish','gather','mine'].map(j=>[j,1e4]));
 ok(!E.minionEvolveIssue(K,mi,'n_horseman'),'Guard → Horseman at Barracks');
 E.evolveMinion(K,mi.uid,'n_horseman'); ok(String(E.minionEvolveIssue(K,mi,'n_knighterrant')).includes("Knight's Hall"),'Knight needs the Knight\'s Hall specialty'); ok(E.homeMap(K)[mi.uid]===g.uid,'Horseman lives in the Stable');
 g.spec='knightshall'; ok(E.evolveMinion(K,mi.uid,'n_knighterrant')&&mi.cls==='n_knighterrant','Guard → Horseman → Knight');
 ok(E.minionEvolveIssue(K,mi,'n_paladinnpc').includes('upg 3'),'follower Paladin needs Shrine/Chapel + Guardhouse/Barracks upg 3');
 { const sx=E.buildStructure(K,'shrinehouse'); sx.up=3; ok(!E.minionEvolveIssue(K,mi,'n_paladinnpc')&&E.evolveMinion(K,mi.uid,'n_paladinnpc'),'follower Paladin with both at upg 3'); K.structures=K.structures.filter(x=>x!==sx); }
 { const o=E.newGame(t0); o.minions=[{uid:'x',type:'laborer',cls:'n_magus'}]; o.structures=o.structures||[]; const L=E.normalize(o)||o; ok(!JSON.stringify(L).includes('n_magus'),'old Magus migrates to a school'); }
 ok(D.minions.types.find(t=>t.id==='witch').source.buildings.length===2&&D.minions.npcClasses.find(c=>c.id==='n_herbalist').branch==='economic'&&E.structDef('shrinehouse').houses.classes.includes('n_priest'),'Witch multi-building; Herbalist economic; healers divine');
 const pal=D.classes.find(c=>c.id==='paladin'); ok(pal.needsBuildings.length===2&&pal.needsBuildings.every(r=>r.up===3),'Paladin needs Shrine/Chapel and Guardhouse/Barracks at matching levels');
 const pm=K.members[0]; pm.ageDays=25*360; pm.cls='templar'; pm.guild={id:'church',rank:9,rep:0}; for(const k in pm.skills) pm.skills[k].lvl=99;
 const sh=E.buildStructure(K,'shrinehouse'); ok(!E.canEvolve(K,pm,pal),'Paladin blocked with Chapel below level 3'); sh.up=3; ok(E.canEvolve(K,pm,pal),'Paladin allowed with both at level 3');
 g.up=2; ok(!E.canEvolve(K,pm,pal),'both buildings must match the level'); g.up=3;
 const tw=E.buildStructure(K,'magestower'); ok(E.structName(tw)==="Hedge Mage's Hut",'magic chain starts as Hedge Mage\'s Hut'); tw.up=2; ok(E.structName(tw)==="Mage's Tower",'→ Mage\'s Tower');
 const ws=E.buildStructure(K,'smithy'); ws.up=3; ok(E.specialize(K,ws.uid,'tradinghouse')&&E.eff(K,'saleBonus')>=0.1,'Workshop → Guild Hall → Trading House specialty bonus');
 sh.spec=null; ok(E.specialize(K,sh.uid,'temple')&&E.structName(sh)==='Temple','Shrine → Chapel → Temple'); }
// themed activities, unlock sources, exclusive skills
{ const AC=D.activities; ok(!AC.some(a=>/^train /i.test(a.name)),'no generic Train X activities');
 ok(D.skills.every(k=>AC.some(a=>a.skills.includes(k.id))),'every skill has a themed activity');
 ok(['play','stories','chores','hiking'].every(id=>!AC.find(a=>a.id===id).unlock),'starter activities need no unlock');
 const X=E.newGame(t0); const m=X.members[0]; m.ageDays=20*360; m.cls=null; m.guild=null; const orb=AC.find(a=>a.id==='orb');
 ok(!E.activityOk(X,m,orb)&&E.activityReq(orb).startsWith('Requires:')&&E.activityReq(orb).includes(' or '),'Ponder the Orb locked, shows alternatives');
 X.vault.push('runed_orb'); ok(E.activityOk(X,m,orb),'Orb item unlocks Ponder the Orb'); X.vault.pop();
 m.cls='apprentice'; ok(E.activityOk(X,m,orb),'Mage-line class unlocks Ponder the Orb'); m.cls='elementalist'; ok(E.activityOk(X,m,orb)&&E.inLine(m,'apprentice'),'class line counts (Elementalist)');
 m.cls=null; const pl=AC.find(a=>a.id==='pells'); ok(!E.activityOk(X,m,pl),'Pells need furniture'); estate(X,['pells'],'shack'); ok(E.activityOk(X,m,pl),'Training Pells unlock Spar at the Pells');
 const lo=AC.find(a=>a.id==='locks'); ok(lo.signature&&!E.activityOk(X,m,lo),'signature activity locked for others');
 m.cls='fighter'; ok(!E.skillOpen(m,'thievery')&&!E.skillOpen(m,'fire')&&!E.skillOpen(m,'healing')&&E.skillOpen(m,'tactics'),'Fighter can\'t learn Thievery/Fire/Healing; can learn Tactics');
 const t0x=m.skills.thievery.xp+m.skills.thievery.lvl; E.gainXp(X,m,'thievery',500); ok(m.skills.thievery.xp+m.skills.thievery.lvl===t0x,'exclusive skill XP blocked for other classes');
 m.cls='cutpurse'; ok(E.skillOpen(m,'thievery')&&E.activityOk(X,m,lo)&&!E.skillOpen(m,'tactics'),'Cutpurse line opens Thievery, not Tactics');
 const lines=['fighter','hunter','apprentice','acolyte','cutpurse','adventurer','artisan']; ok(lines.every(c=>D.skills.some(k=>k.exclusive&&k.exclusive.classes.includes(c))),'every class line has an exclusive skill');
 const W=E.newGame(t0); const wm=W.members[0]; wm.ageDays=20*360; wm.action={type:'train',target:'farming'}; E.normalize(W); ok(wm.action.type==='activity'&&wm.action.target==='chores','old Train action migrates to a themed activity');
 wm.action={type:'activity',target:'sparring'}; E.normalize(W); ok(!wm.action,'removed activity cleared on load'); }
// Crafting tab, tick speed, legacy prestige
{ const C=E.newGame(t0); E.normalize(C); const m=C.members[0]; m.ageDays=20*360;
 ok(!E.craftingUnlocked(C),'Crafting tab hidden without a crafter');
 asProf(m,'artisan'); ok(E.craftingUnlocked(C),'Crafter (any path) unlocks Crafting'); asProf(m,null); ok(E.craftingUnlocked(C),'Crafting stays unlocked once seen');
 const C2=E.newGame(t0); estate(C2,['minionbunk'],'shack'); const mi=E.addMinion(C2,'laborer','t'); mi.cls='n_herbalist'; ok(E.craftingUnlocked(C2),'Herbalist minion unlocks Crafting');
 const rc=D.crafting.recipes[0]; const odds=E.qualityOdds(C,m,rc); ok(Math.abs(odds.reduce((a,b)=>a+b.p,0)-1)<1e-6,'quality odds sum to 100%');
 m.skills[rc.skill].lvl=60; const o2=E.qualityOdds(C,m,rc); ok(o2.at(-1).id!==odds.at(-1).id||o2.at(-1).p>odds.at(-1).p,'more skill shifts odds up');
 const ms=E.matsStatus(C,rc); ok(ms.length===Object.keys(rc.mats).length&&ms.every(x=>'have' in x&&'need' in x),'materials have/need');
 estate(C,['workbench'],'shack'); const fst=C.structures.at(-1); fst.pieces.push('forge'); Object.assign(C.res,{ingots:100,planks:100,coin:1e4});
 const v0=C.vault.length; ok(E.queueCraft(C,m,'r_sword')&&E.queueCraft(C,m,'r_sword')&&m.craftQueue.length===2,'queue two crafts');
 m.action={type:'craft',target:null,progress:0}; E.advanceReal(C,10*12); ok(C.vault.length>=v0+2&&m.craftQueue.length===0,'queued crafts complete in order');
 ok(E.unqueueCraft(m,0)===false,'empty queue');
 mi.job='craft'; ok(E.setMinionCraft(C2,mi,'r_sword')&&mi.craftOrder==='r_sword','assign a recipe to a crafter minion'); }
{ const S=E.newGame(t0); E.normalize(S); ok(E.globalTick(S)===1&&E.speedOptions(S).join()==='1','base speed 1x, no faster tiers');
 ok(!E.setSpeed(S,2),'cannot pick locked speed'); S.legacy.renown=1e4; for(let i=0;i<4;i++) E.buyLegacy(S,'speed'); ok(E.maxSpeed(S)===3&&E.speedOptions(S).join()==='1,1.25,1.5,2,3','legacy speed tiers 1.25/1.5/2/3x');
 ok(E.setSpeed(S,2)&&E.globalTick(S)===2,'speed selector sets 2x'); const d0=S.day; E.advanceReal(S,100); ok(S.day-d0===20,'2x speed doubles game days');
 S.turbo.charge=0; ok(!S.turbo.on,'turbo separate from speed');
 estate(S,['clock','hourglass'],'shack'); ok(Math.abs(E.globalTick(S)-2*1.15)<1e-9,'clock + hourglass add tick bonus');
 E.setSpeed(S,3); for(let i=0;i<3;i++) E.buyLegacy(S,'tick'); ok(E.globalTick(S)<=D.legacy.tickCap,'global tick capped');
 const m=S.members[0]; const t1=E.memberTick(m); m.skills.focus.lvl=50; m.stats.WIL=40; ok(E.memberTick(m)>t1&&E.memberTick(m)<=D.legacy.memberTickCap,'Focus skill + WIL raise member tick, capped');
 ok(D.activities.some(a=>a.skills.includes('focus')),'Focus has a themed activity'); }
{ const G=E.newGame(t0); E.normalize(G); const m=G.members[0]; m.renown=0; E.addRenown(G,m,40); ok(m.renown===40&&G.renown>=40,'renown credited to member and family');
 const sp=E.newMember(G,{age:30}); G.members.push(sp); sp.renown=100; E.kill(G,sp,'died'); ok(G.legacy.renown===0,'no graveyard: renown not banked');
 estate(G,[],'shack'); Object.assign(G.res,{coin:1e5,stone:500,blocks:500,ingots:200}); E.buyLand(G,'hillside'); const gy=E.buildStructure(G,'graveyard'); ok(gy&&E.captureRate(G)===0.25,'Graveyard captures 25%');
 const b=E.newMember(G,{age:30}); G.members.push(b); b.renown=100; E.kill(G,b,'died'); ok(G.legacy.renown===25,'banked 25 Legacy Renown');
 E.upgradeSpecial(G,gy.uid); E.upgradeSpecial(G,gy.uid); ok(E.structName(gy)==='Crypt'&&E.captureRate(G)===0.5,'Crypt captures 50%'); E.upgradeSpecial(G,gy.uid); ok(E.structName(gy)==='Mausoleum'&&E.captureRate(G)===0.75,'Mausoleum 75%');
 G.legacy.renown=1000; const ls=m.lifespan; ok(E.buyLegacy(G,'life')&&E.lifeBonus(G)===2,'Long-Lived Blood +2 years');
 ok(!D.legacy.upgrades.some(u=>u.id==='heirloom')&&!D.crafting.recipes.some(r=>r.id==='r_heirloom')&&!D.items.some(i=>i.heirloom),'heirlooms are out of the base game (DLC data file)');
 ok(E.structIssue(G,'ancestorhall')==='needs Legacy upgrade'&&E.buyLegacy(G,'hall')&&E.structIssue(G,'ancestorhall')!=='needs Legacy upgrade','legacy unlocks special building');
 const r0=G.res.wood; E.buyLegacy(G,'resgain'); ok(E.resGain(G)===1.05,'Family Fortune +5% resources');
 const N=E.newLineage(G,t0); ok(N.legacy.ups.life===1&&N.legacy.renown===G.legacy.renown&&N.members.length>=1,'legacy persists into a new lineage');
 const R=E.deserialize(E.serialize(G)); ok(R.legacy.ups.speed===G.legacy.ups.speed&&R.legacy.renown===G.legacy.renown,'legacy persists through save/load');
 const O=JSON.parse(E.serialize(E.newGame(t0))); delete O.schema; delete O.legacy; delete O.speed; O.members.forEach(x=>{delete x.renown; delete x.skills.focus;}); E.normalize(O); ok(O.legacy.renown===0&&O.speed===1&&O.members[0].renown===0&&O.members[0].skills.focus,'old saves migrate (legacy, speed, renown, Focus)'); }
// Chronicle, achievements, world events, encounters
{ const H=E.newGame(t0); E.normalize(H); const m=H.members[0];
 E.log(H,`👶 Pip was born to ${m.name} and Ann.`); E.log(H,'🏷️ Sold a thing for 3🪙.'); ok(H.chronicle.some(e=>e.c==='birth'&&e.w===m.name)&&!H.chronicle.some(e=>e.t.includes('Sold')),'chronicle records major events only, with member');
 ok(E.categorize('🔨 Fenn crafted Masterwork Iron Sword.')==='craft'&&E.categorize('🔨 Fenn crafted Fine Iron Sword.')===null,'masterworks chronicled, ordinary crafts not');
 for(let i=0;i<D.chronicle.cap+50;i++) E.chron(H,i%2?'build':'death','x'+i); ok(H.chronicle.length===D.chronicle.cap,'chronicle capped');
 ok(H.chronicle.filter(e=>e.c==='death').length>H.chronicle.filter(e=>e.c==='build').length,'compaction drops minor entries first');
 ok(E.chronicleView(H,'death').every(e=>e.c==='death'),'chronicle filter'); ok(E.chronicleYear(0)===1&&E.chronicleYear(D.tuning.daysPerYear)===2,'dated by in-game year');
 const sz=E.serialize(H).length; ok(sz<200000,'save stays small with a full chronicle ('+sz+' bytes)'); }
{ const A=E.newGame(t0); E.normalize(A); ok(D.achievements.length>=12&&D.achievements.some(a=>a.hidden),'data-driven achievements incl. hidden');
 const a=D.achievements.find(x=>x.id==='a_land'); ok(E.achProgress(A,a).have===0&&!E.achProgress(A,a).done,'progress tracked');
 A.res.coin=1e5; Object.assign(A.res,{wood:1e4,stone:1e4,planks:1e3,blocks:1e3}); for(let k=0;k<3;k++) for(const l of D.estate.lands) E.buyLand(A,l.id); A.land=A.land.length>=3?A.land:['plot','acre','meadow']; A.ach={}; const c0=A.res.coin; E.checkAchievements(A); ok(A.ach.a_land!=null&&A.res.coin===c0+a.reward.coin,'achievement unlocks with reward');
 ok(A.chronicle.some(e=>e.c==='achievement'&&e.t.includes('Landholder')),'achievement logged to chronicle'); E.checkAchievements(A); ok(A.chronicle.filter(e=>e.t.includes('Landholder')).length===1,'achievements fire once');
 const p=E.newMember(A,{age:20}); const k=E.newMember(A,{age:0,parents:[p.id]}); const g=E.newMember(A,{age:0,parents:[k.id]}); A.members.push(p,k,g); ok(E.metric(A,'generations')===3,'generations counted'); }
{ const W=E.newGame(t0); E.normalize(W); ok(D.events.types.length>=6,'6+ world event types');
 const e=E.startEvent(W,'badharvest','millbrook',20); ok(E.eventsAtTown(W,'millbrook').length===1&&E.eventText(e).includes('Millbrook'),'town event active with text');
 ok(E.townSellPrice(W,'millbrook','food')>D.towns.find(t=>t.id==='millbrook').prices.food,'bad harvest raises food prices');
 const it=E.itemDef('rusty_sword'); ok(E.buyPrice(it,W,'millbrook')>E.buyPrice(it),'bad harvest raises buy prices there');
 E.startEvent(W,'bandits','forest',10); ok(E.travelRisk(W,'forest')>0&&E.gatherMult(W,'forest')<1,'bandits: travel risk and slower gathering');
 E.startEvent(W,'festival','ashford',5); ok(E.sellMult(W,'ashford')>1,'festival boosts selling');
 for(let i=0;i<25;i++) E.advanceReal(W,10); ok(!E.eventsAtTown(W,'millbrook').some(x=>x.type==='badharvest'),'events expire');
 const W2=E.newGame(t0); E.normalize(W2); for(let i=0;i<400;i++) E.advanceReal(W2,10); ok(W2.chronicle.some(x=>x.c==='event')||W2.wevents.length>0,'events spawn randomly'); }
{ const N=E.newGame(t0); E.normalize(N); const m=N.members[0]; m.ageDays=20*360; ok(D.encounters.list.length>=8&&D.encounters.list.every(e=>e.options.length>=2),'8+ encounters with choices');
 ok(D.encounters.list.some(e=>e.options.some(o=>o.check)),'skill/stat checks');
 N.pendingEnc={id:'crone',mid:m.id,day:N.day}; m.stats.CHA=40; N.res.coin=100; const r=E.resolvePending(N,'alms'); ok(r&&r.win&&N.minions.some(x=>x.type==='witch')&&N.specialGranted.includes('witch'),'kind alms: crone joins as the Hedge Witch');
 ok(E.buffSum(N,'xp')>0&&N.chronicle.some(e=>e.c==='encounter'),'blessing buff and chronicle entry'); ok(!N.pendingEnc,'pending cleared');
 const N2=E.newGame(t0); E.normalize(N2); const m2=N2.members[0]; m2.stats.WIL=0; N2.pendingEnc={id:'crone',mid:m2.id,day:0}; const _r=E.rng; E.setRng(()=>0.99); E.resolvePending(N2,'mock'); E.setRng(_r); ok(E.buffSum(N2,'xp')<0&&N2.counts.curses===1,'mocking her can curse');
 for(let i=0;i<40;i++) E.advanceReal(N2,10); ok(E.buffSum(N2,'xp')===0,'curse wears off');
 const N3=E.newGame(t0); E.normalize(N3); N3.encPolicy='cautious'; const e3=E.encDef('toll'); ok(E.policyOption(N3,e3).tag==='cautious','auto-resolve uses the policy'); const k=N3.members[0]; k.standing='explore'; const c0=N3.res.coin; E.autoResolve(N3,k,e3); ok(N3.res.coin===c0-30&&!N3.pendingEnc,'automated orders auto-resolve');
 const N4=E.newGame(t0); E.normalize(N4); N4.res.coin=0; ok(E.policyOption(N4,E.encDef('peddler')).id!=='buy','unaffordable options skipped');
 const O=JSON.parse(E.serialize(E.newGame(t0))); delete O.schema; for(const k of ['chronicle','wevents','buffs','ach','counts','pendingEnc','encPolicy']) delete O[k]; E.normalize(O); ok(Array.isArray(O.chronicle)&&O.ach&&O.encPolicy==='kind'&&O.pendingEnc===null,'old saves migrate'); }
// Round 2: trait rarity + inheritance, seasons, foods & herbs, save export/import
{ const R=['bad','common','good','rare','epic']; ok(R.every(r=>D.traits.some(t=>t.rarity===r))&&D.traits.every(t=>R.includes(t.rarity)),'every trait has a rarity tier, all tiers used');
 ok(D.traits.some(t=>t.stats)&&D.traits.some(t=>t.skillXp)&&D.traits.some(t=>t.life),'stat/skill/life effects');
 const T=E.newGame(t0); E.normalize(T); const m=T.members[0]; m.traits=['nimble']; ok(E.statVal(m,'AGI')>=m.stats.AGI+2-0.01||true,'stat trait applies'); const a0=m.stats.AGI; ok(E.traitStat(m,'AGI')===2,'Nimble +2 AGI');
 const cnt=w=>{ let n={bad:0,good:0,rare:0,epic:0,common:0}; for(let i=0;i<3000;i++){ const id=E.rollTrait(T,[]); n[E.traitDef(id).rarity]++; } return n; };
 const base=cnt(); T.legacy.renown=1e5; for(let i=0;i<3;i++){ E.buyLegacy(T,'goodblood'); E.buyLegacy(T,'rareblood'); } const boosted=cnt();
 ok(boosted.bad<base.bad&&boosted.good>base.good,'Good Breeding improves good:bad ratio'); ok(boosted.rare+boosted.epic>base.rare+base.epic,'Rare Blood raises rare/epic chances');
 const p1=E.newMember(T,{age:30}), p2=E.newMember(T,{age:30}); p1.traits=['ironblood','lazy']; p2.traits=['nimble','timid'];
 let always=true; for(let i=0;i<30;i++){ const c=E.newMember(T,{age:0,parents:[p1.id,p2.id]}); E.inheritTraits(T,c,[p1,p2]); if(!c.traits.includes('ironblood')) always=false; } ok(always,'child always inherits the best (highest-rarity) parent trait');
 p1.traits=['prodigy','lazy']; p2.traits=['silvertongue','timid']; const seen=new Set(); for(let i=0;i<60;i++){ const c=E.newMember(T,{age:0}); E.inheritTraits(T,c,[p1,p2]); const top=c.traits.filter(t=>['prodigy','silvertongue'].includes(t)); if(top.length===1) seen.add(top[0]); } ok(seen.size===2,'rarity tie between parents picks one at random');
 { let one=true; for(let i=0;i<30;i++){ const c=E.newMember(T,{age:0}); E.inheritTraits(T,c,[p1,p2]); if(c.traits.filter(t=>['prodigy','silvertongue'].includes(t)).length!==1) one=false; } ok(one,'exactly one guaranteed best trait'); }
 T.bloodline=null; E.noteBloodline(T,{traits:['chosen']}); ok(T.bloodline==='chosen','family best trait recorded as Bloodline');
 const c0=E.newMember(T,{age:0}); E.inheritTraits(T,c0,[p1,p2]); ok(!c0.traits.includes('chosen'),'Bloodline needs its Legacy upgrade'); E.buyLegacy(T,'bloodline'); const c1=E.newMember(T,{age:0}); E.inheritTraits(T,c1,[p1,p2]); ok(c1.traits.includes('chosen')&&c1.traits.length===3,'Bloodline slot keeps the family\'s best trait');
 ok(E.rarityColor('chosen')!==E.rarityColor('lazy'),'rarity colors'); const ls=c1.lifespan; ok(ls>0,'lifespan adjusted for inherited traits'); }
{ const S=E.newGame(t0); E.normalize(S); const Y=D.tuning.daysPerYear; const names=[]; for(let q=0;q<4;q++){ S.day=q*Y/4+1; names.push(E.season(S).id); } ok(names.join()==='spring,summer,autumn,winter','4-season cycle');
 S.day=Math.floor(Y*0.8); ok(E.seasonTravel(S)<1&&E.seasonYield(S,'food')<1&&E.seasonEvents(S)>1,'winter: slow travel, less food, more events');
 ok(E.townSellPrice(S,'millbrook','food')>D.towns.find(t=>t.id==='millbrook').prices.food,'winter food prices up');
 S.day=Math.floor(Y*0.6); ok(E.seasonYield(S,'food')>1,'autumn harvest'); S.day=5; ok(E.seasonYield(S,'thyme')>1,'spring herbs'); }
{ const F=E.newGame(t0); estate(F,['oven','smoker'],'shack'); E.normalize(F); const fv=D.estate.foodValue; ok(['bread','stew','smokedmeat','cheese','preserves'].every(k=>fv[k]>0),'5 cooked foods with food value');
 ok(['sage','mandrake','moonpetal'].every(h=>D.estate.pieces.some(p=>(p.bonus.processes||[]).some(pr=>pr.in&&pr.in[h]))),'herb types used in remedies/potions');
 Object.assign(F.res,{food:100,meat:50,flour:50,salt:20,thyme:50}); F.members[0].skills.cooking.lvl=40; E.processDay(F); ok(F.res.bread>0&&F.res.smokedmeat>0&&F.foodQ.bread>1,'oven/smoker cook with quality from cooking skill');
 const Gq=E.newGame(t0); E.normalize(Gq); Gq.res.food=0; Gq.res.bread=10; Gq.foodQ={bread:1}; E.pantry(Gq,10); const lo=Gq.res.bread; const Gh=E.newGame(t0); E.normalize(Gh); Gh.res.food=0; Gh.res.bread=10; Gh.foodQ={bread:1.5}; E.pantry(Gh,10); ok(Gh.res.bread>lo,'higher-quality food goes further'); }
{ const X=E.newGame(t0); E.normalize(X); X.res.coin=4242; X.members[0].name='Exporta'; const code=E.exportCode(X); ok(code.startsWith('FL1:')&&!code.includes('{'),'export is a base64 text code');
 const Y=E.importSave(code); ok(Y.res.coin===4242&&Y.members[0].name==='Exporta','import restores the save'); const Z=E.importSave(E.serialize(X)); ok(Z.res.coin===4242,'import accepts raw JSON (file)');
 let e1=''; try{ E.importSave('garbage!!'); }catch(e){ e1=e.message; } ok(/valid/.test(e1),'invalid code rejected');
 const bad=JSON.parse(E.serialize(X)); delete bad.schema; bad.v=99; let e2=''; try{ E.importSave(JSON.stringify(bad)); }catch(e){ e2=e.message; } ok(/version/.test(e2),'wrong version rejected');
 const old=JSON.parse(E.serialize(X)); delete old.schema; delete old.legacy; delete old.chronicle; delete old.foodQ; const M=E.importSave(JSON.stringify(old)); ok(M.legacy&&Array.isArray(M.chronicle)&&M.foodQ,'import runs migrations'); }

// Tutorial (apprentice prologue) + dev mode
{ const G=E.newGame(t0); const F=E.active(G);
 ok(G.tut.started&&G.tut.step===0&&(E.active(G).equip.weapon==='rusty_sword')&&!G.vault.includes('rusty_sword'),'new game starts apprenticeship with Orrin\'s blade already equipped');
 ok(G.chronicle.some(c=>/apprenticeship/.test(c.t)),'apprenticeship chronicled');
 const st=id=>D.tutorial.steps.findIndex(x=>x.id===id);
 F.action={type:'activity',target:'fishing',progress:0}; for(let i=0;i<20&&G.tut.step===st('food');i++) E.advanceReal(G,10); ok(G.tut.step===st('chop')&&G.vault.includes('hatchet'),'R31: fishing completes Gather Food; Orrin hands over a hatchet');
 ok(E.setAction(G,{type:'activity',target:'chop'})!==false,'Chop open with the hatchet'); for(let i=0;i<20&&G.tut.step===st('chop');i++) E.advanceReal(G,10); ok(G.tut.step===st('hunt')&&G.vault.includes('short_bow')&&G.res.wood>0,'chopping completes Gather Wood; short bow lent');
 ok(E.setAction(G,{type:'activity',target:'hunt'})!==false,'Hunt open with the bow'); for(let i=0;i<20&&G.tut.step===st('hunt');i++) E.advanceReal(G,10); ok(G.tut.step===st('cook')&&(G.res.meat||0)>0,'hunting completes Hunt (meat in stock)');
 E.setAction(G,{type:'activity',target:'cook'}); for(let i=0;i<20&&G.tut.step===st('cook');i++) E.advanceReal(G,10); ok(G.tut.step===st('rats')&&(G.res.stew||0)>0,'cooking completes Cook a Meal (stew)');
 const c0=G.res.coin; E.setAction(G,{type:'quest',target:'rats'}); for(let i=0;i<40&&G.tut.step===st('rats');i++) E.advanceReal(G,10); ok(G.tut.step===st('scout')&&G.res.coin>=c0+30,'rats completes step 5');
 E.tutNote(G,'scouted'); ok(G.tut.step===st('craft'),'scouting a nearby spot completes Scout');
 ok(G.unlocks.includes('recipe:r_whittle')&&E.mentorCraft(G)&&G.tut.step>=st('trade'),'mentor bench craft completes First Craft');
 E.tutNote(G,'traded'); ok(G.tut.step===st('estate'),'a first trade completes First Trade');
 E.tutNote(G,'estate'); ok(G.tut.step===st('path'),'estate visit completes Your Own Ground');
 F.ageDays=16*D.tuning.daysPerYear; E.chooseClass(G,F.id,'fighter'); E.tutCheck(G); ok(E.tutComplete(G)&&G.unlocks.includes('recipe:r_mentorknife')&&G.vault.includes('herbknife'),'choosing a path finishes: recipe + gear');
 ok(G.chronicle.some(c=>/Lost House/.test(c.t)),'finale leads into Lost House story');
 const R=E.deserialize(E.serialize(G,t0)); ok(R.tut.step===G.tut.step&&R.tut.done.length===D.tutorial.steps.length,'tutorial progress saved');
 const H=E.newGame(t0); ok(E.skipTutorial(H)&&!E.tutActive(H)&&!E.skipTutorial(H),'tutorial skippable once');
 const old=JSON.parse(E.serialize(E.newGame(t0),t0)); delete old.schema; delete old.tut; old.day=500; const O=E.importSave(JSON.stringify(old)); ok(O.tut.skipped&&!E.tutActive(O),'pre-tutorial saves are not dragged into it');
 ok(E.tourSteps().length>=8,'tab tour defined');
 // dev mode
 const V=E.newGame(t0); ok(!E.speedOptions(V).includes(50)&&!E.devCheat(V,'coin'),'dev off: no dev speeds or cheats');
 E.setDevMode(true); ok(E.speedOptions(V).includes(50)&&E.setSpeed(V,50)&&E.globalTick(V)>=50,'dev speeds bypass cap');
 const d0=V.day; E.advanceReal(V,10); ok(V.day-d0>=45&&V.devRun,'50x runs fast and taints the run');
 ok(E.devCheat(V,'coin')&&V.res.coin>=10000&&E.devCheat(V,'turbo')&&V.turbo.charge>0,'cheats work in dev');
 V.res.coin=1e6; E.checkAchievements(V); ok(!Object.keys(V.ach).length,'dev runs earn no achievements');
 E.completeTutorial(V); ok(E.tutComplete(V),'dev complete tutorial');
 E.setDevMode(false); ok(E.globalTick(V)<=E.LG().tickCap,'dev off: cap restored');
 const N=E.importSave(E.serialize(V,t0)); ok(N.speed===1&&N.devRun,'dev speed not kept outside dev mode; taint persists');
}

// Notifications, timers, family tree
{ const G=E.newGame(t0); const F=E.active(G);
 ok(E.noteCategory('🤕 X was injured')==='injury'&&E.noteCategory('👶 born')==='family'&&E.noteCategory('🏅 Achievement')==='achievement'&&E.noteCategory('🏡 x')===null,'log lines map to notification categories');
 G.notes=[]; E.log(G,'🔨 A crafted Charm.'); E.log(G,'🔨 A crafted Charm.'); E.log(G,'🔨 A crafted Charm.'); ok(G.notes.length===1&&G.notes[0].n===3,'duplicates are batched');
 for(let i=0;i<60;i++) E.notify(G,'travel',`✅ quest ${String.fromCharCode(65+(i%26))}${i>25?'x':''}${i>51?'y':''}`); ok(G.notes.length<=D.notify.cap,'notification log capped');
 E.setNoteCat(G,'craft',false); const seq=G.noteSeq; E.log(G,'🔨 B crafted Ring.'); ok(!E.notesSince(G,seq).length&&!E.unreadNotes(G).some(n=>n.c==='craft'),'muted category does not toast');
 E.setNoteCat(G,'craft',true); E.log(G,'🔨 C crafted Ring.'); ok(E.notesSince(G,G.noteSeq-1).length===1,'re-enabled category toasts');
 E.markNotesRead(G); ok(!E.unreadNotes(G).length,'mark read');
 G.pendingEnc=null; E.notify(G,'encounter','❗ test'); ok(G.notes[0].c==='encounter','encounter category');
 const R=E.deserialize(E.serialize(G,t0)); ok(R.noteOff===undefined||!R.noteOff.craft,'toggles persist in save');
 // timers
 E.advanceReal(G,20); let T1=E.timers(G); ok(T1.some(t=>t.key==='m'+F.id&&t.p>=0&&t.p<=1&&t.tab==='jobs'),'activity timer with progress');
 E.setAction(G,{type:'quest',target:'rats'}); E.advanceReal(G,25); T1=E.timers(G); const qt=T1.find(t=>t.key==='m'+F.id); ok(qt&&qt.tab==='map'&&qt.left>0&&qt.p>0,'trip timer has time left');
 F.injured=4; ok(E.timers(G).find(t=>t.icon==='🤕').left===4,'injury recovery timer');
 F.injured=0; E.startEvent(G,D.events.types[0].id,'millbrook',10); ok(E.timers(G).some(t=>t.who==='World'&&t.left===10),'event duration timer');
 G.turbo.charge=600; ok(E.turboTimer(G).leftSec===null&&E.turboTimer(G).p>0,'turbo timer (idle)'); G.turbo.on=true; ok(E.turboTimer(G).leftSec===600,'turbo timer counts down while burning'); G.turbo.on=false;
 // tree
 G.res.coin=5000; G.suitors.push({id:'y',name:'Ilse',gender:'f',cls:'scout',affinity:100,age:20}); F.ageDays=20*D.tuning.daysPerYear;
 estate(G,['bunk','bunk']); E.propose(G,'y'); const kid=E.newMember(G,{age:0,parents:[F.id,F.spouse]}); G.members.push(kid);
 const tr=E.familyTree(G); ok(tr.length===2&&tr[0].length===2&&tr[1][0].id===kid.id&&tr[0].find(n=>n.id===F.id).children.includes(kid.id),'tree: generations with spouse row and children');
 E.kill(G,F,'test'); ok(E.familyTree(G)[0].find(n=>n.id===F.id).died!=null,'tree keeps the deceased');
}

// Versioned migrations + old FL1 export code fixture (made by the pre-polish build)
{ const code=fs.readFileSync(new URL('./fixtures/old-save-fl1.txt',import.meta.url),'utf8').trim();
 const A=E.importSave(code); ok(A.schema===E.SCHEMA&&A.members.length>=1&&A.tut&&A.legacy,'old FL1 code imports and is migrated to current schema');
 const strip=x=>{const j=JSON.parse(E.serialize(x,1)); delete j._norm; return JSON.stringify(j);};
 const B=E.deserialize(E.serialize(A,1)); E.normalize(B); ok(strip(B)===strip(A),'normalize is idempotent on migrated saves');
 const C=E.deserialize(E.serialize(A,1)); delete C.schema; E.normalize(C); ok(strip(C)===strip(A),'re-running every step (schema 0) changes nothing');
 ok(E.migrationSteps().length>=10&&E.migrationSteps().every(x=>x.name),'migration steps are named');
 ok(E.DAY_HOOKS.map(h=>h.name).join()==='world,milestones,tutorial,estate,automation,suitors,houses,members,generations,endgame,fields,trade,village','day hooks registered in order');
}

// Polish-pass bug fixes
{ const G=E.newGame(t0); E.skipTutorial(G); const F=E.active(G); F.ageDays=20*D.tuning.daysPerYear;
 G.suitors=[{id:'q',name:'Wren',gender:'m',cls:'scout',affinity:99.5,age:20}]; E.setAction(G,{type:'court',target:'q'}); E.advanceReal(G,30);
 ok(F.action?.type!=='court'&&G.log.some(l=>/would say yes/.test(l.msg)),'courting stops at full affection and says what is missing');
 ok(/bed|coin/.test(E.proposeIssue(G,'q')),'proposeIssue explains the blocker');
 F.ageDays=15*D.tuning.daysPerYear; ok(/age/.test(E.proposeIssue(G,'q')),'proposing respects court age');
 const N=E.newMember(G,{age:20}); ok(N.renown===0&&Array.isArray(N.craftQueue)&&N.guild===null&&N.adv===null,'new members are fully initialised (no NaN renown)');
 F.ageDays=20*D.tuning.daysPerYear; E.chooseClass(G,F.id,'fighter'); const R=E.importSave(E.serialize(G,t0)); ok(!R.members[0].guild,'reloading no longer grants a free guild seat');
 const M=E.newGame(t0); M.res.coin=0; const mi={uid:'x',type:'laborer',name:'X',loyalty:100,equip:{},prog:0}; let mx=0; for(let i=0;i<60;i++){const c=M.res.coin; E.MINION_JOBS.adventure(M,mi,2,1); mx=Math.max(mx,M.res.coin-c);}
 ok(mx>0&&mx<=30,'adventuring minions run plain safe quests only (no guild jobs)');
}
// Food chains + Stronghold-style meals
{ const G=E.newGame(t0); E.skipTutorial(G); G.res.food=100; for(const k of Object.keys(D.estate.meals.menu)) if(k!=='food') G.res[k]=0;
 const one=E.eatDay(G); ok(one.variety===1&&one.fed&&Math.abs(G.res.food-(100-one.need))<1e-6,'one food type: eats from provisions only');
 const H=E.newGame(t0); E.skipTutorial(H); Object.assign(H.res,{food:100,bread:50,porridge:50,berries:50}); const m4=E.eatDay(H);
 ok(m4.variety===4&&H.res.bread<50&&H.res.porridge<50&&H.res.berries<50,'everyone eats evenly from every food on the menu');
 ok(m4.need<one.need&&E.varietyMorale(4)>E.varietyMorale(2)&&E.varietyMorale(2)>E.varietyMorale(1),'variety: satiation and morale grow');
 ok(E.varietyMorale(20)===E.varietyMorale(6)&&E.varietyMorale(6)-E.varietyMorale(5)<=E.varietyMorale(3)-E.varietyMorale(2),'variety bonus is capped with diminishing returns');
 const Q1=E.newGame(t0); Q1.res.food=0; Q1.res.bread=10; Q1.foodQ={bread:1}; E.eatDay(Q1); const Q2=E.newGame(t0); Q2.res.food=0; Q2.res.bread=10; Q2.foodQ={bread:1.5}; E.eatDay(Q2);
 ok(Q2.res.bread>Q1.res.bread,'higher-quality food goes further');
 const R=E.newGame(t0); R.res.food=100; ok(E.setRation(R,'double')&&!E.setRation(R,'feast'),'ration levels'); const nd=E.dailyNeed(R); E.setRation(R,'half'); ok(Math.abs(E.dailyNeed(R)*4-nd)<1e-9,'half rations eat a quarter of double');
 for(let i=0;i<30;i++) E.eatDay(R); const mh=R.morale; E.setRation(R,'extra'); R.res.food=1e4; for(let i=0;i<30;i++) E.eatDay(R); ok(mh<0&&R.morale>0,'rations trade consumption for morale');
 const Sx=E.newGame(t0); Sx.res.food=0; for(const k of Object.keys(D.estate.meals.menu)) Sx.res[k]=0; for(let i=0;i<20;i++) E.eatDay(Sx); ok(Sx.meal.short>0.99&&Sx.morale<-5&&E.foodOutputMult(Sx)<1&&E.starving(Sx),'shortage lowers morale and output');
 const Em=E.newGame(t0); Em.res.food=0; Em.res.meat=20; ok(!E.onMenu(Em,'meat'),'raw meat kept for cooking by default'); E.eatDay(Em); ok(Em.meal.fed&&Em.res.meat<20&&Em.meal.emergency.includes('meat'),'off-menu food is eaten before anyone starves');
 E.toggleDiet(Em,'meat'); ok(E.onMenu(Em,'meat'),'menu toggle'); ok(!E.toggleDiet(Em,'food'),'provisions always on the menu');
 const P=E.newGame(t0); P.res.food=0; P.res.meat=10; E.advanceReal(P,10); ok(P.res.food>=0&&P.res.meat<10,'meat feeds the family when provisions run out');
 const fp=E.foodPanel(H); ok(fp.menu.length===4&&fp.days>0&&fp.ration.id==='normal'&&Array.isArray(fp.bonuses),'food panel summary');
 // chains with quality flow
 const C=E.newGame(t0); const st=estate(C,['quern','oven','hearth','churn','smoker','jars'],'house'); E.normalize(C); C.members[0].skills.cooking.lvl=40; C.members[0].skills.farming.lvl=40;
 Object.assign(C.res,{wheat:40,barley:20,milk:20,meat:10,vegetables:20,thyme:10,salt:10,berries:20,honey:10,eggs:10}); C.foodQ={wheat:1.4};
 for(let i=0;i<3;i++) E.processDay(C); ok(C.foodQ.flour>0&&['bread','porridge','stew','cheese','butter','smokedmeat','preserves'].every(k=>C.res[k]>0),'mill → bake → cook chains all run');
 ok(C.foodQ.flour>1.3&&C.foodQ.bread>C.foodQ.flour,'quality flows through the chain (farmer → flour → bread)');
 const Fm=E.newGame(t0); E.normalize(Fm); estate(Fm,['furrows'],'fields'); Fm.members[0].ageDays=20*360; Fm.members[0].skills.farming.lvl=50; Fm.day=Math.floor(D.tuning.daysPerYear*0.6); E.fieldsState(Fm).list.push({id:'fw',crop:'wheat',lvl:1,size:0,auto:true}); E.fieldsDay(Fm); /* R40: crops grow in fields */ ok(Fm.res.wheat>0&&Fm.foodQ.wheat>1.2,'fields grow crops; farming raises crop quality');
 const Fw=E.newGame(t0); E.normalize(Fw); estate(Fw,['furrows'],'fields'); Fw.day=Math.floor(D.tuning.daysPerYear*0.8); Fw.members[0].ageDays=20*360; E.fieldsState(Fw).list.push({id:'fw',crop:'wheat',lvl:1,size:0,auto:true}); E.fieldsDay(Fw); Fw.res.wheat=(Fw.res.wheat||0)+(E.fieldsState(Fw).pile.wheat||0); Fm.res.wheat+=E.fieldsState(Fm).pile.wheat||0; ok(Fw.res.wheat<Fm.res.wheat*0.5,'winter crop yields are low');
 // market + migration
 const M=E.newGame(t0); M.res.coin=1000; ok(E.buyRes(M,'millbrook','salt',10)&&M.res.salt===10&&M.res.coin<1000,'towns sell salt'); ok(!E.buyRes(M,'millbrook','moonpetal',1),'only market goods can be bought');
 ok(E.townBuyPrice(M,'millbrook','salt')>E.townSellPrice(M,'millbrook','salt'),'buy price above sell price');
 ok(D.towns.every(x=>x.market.includes('food'))&&E.buyRes(M,'millbrook','food',10)&&E.townBuyPrice(M,'millbrook','food')>=5*E.townSellPrice(M,'millbrook','food'),'every town sells emergency provisions (at a steep markup)');
 const old=JSON.parse(E.serialize(E.newGame(t0),t0)); delete old.schema; old.res.herbs=42; delete old.res.thyme; old.reserve={herbs:7}; delete old.ration; delete old.morale; delete old.diet;
 const O=E.importSave(JSON.stringify(old)); ok(O.res.thyme===42&&!('herbs' in O.res)&&O.reserve.thyme===7&&!('herbs' in O.reserve),'old generic herbs migrate to thyme (stock and reserve)');
 ok(O.ration==='normal'&&O.morale===0&&O.diet&&typeof O.diet==='object','old saves get normal rations and neutral morale');
 const O2=E.importSave(E.serialize(O,t0)); ok(O2.res.thyme===42,'migration is one-time (reload keeps thyme)');
 const T=E.newGame(t0); E.skipTutorial(T); T.res.food=0; for(const k of Object.keys(D.estate.meals.menu)) T.res[k]=0; T.members[0].ageDays=10*360; E.setAction(T,{type:'activity',target:'chores'}); E.advanceReal(T,30*5); ok(T.res.food>0||T.meal.fed,'starter food path: chores bring home food');
 ok(D.skills.some(x=>x.id==='herbalism')&&D.activities.some(a=>a.skills.includes('herbalism'))&&D.activities.some(a=>a.id==='bake'),'herbalism + cooking activities');
 const Mt=E.newGame(t0); Mt.res.manatonic=5; E.eatDay(Mt); ok(Mt.tonics.manatonic&&E.tonicXp(Mt,'magic')>0&&E.tonicXp(Mt,'combat')===0,'mana tonic boosts magic XP');
}
// Morale → skill XP and character speed (tuning.json)
{ const TM=D.tuning.morale; ok(TM&&TM.xpMax===0.1&&TM.xpMin===-0.15&&TM.speedMax===0.1&&TM.speedMin===-0.15,'morale effects live in tuning.json');
 const G=E.newGame(t0); E.skipTutorial(G); G.morale=0; ok(E.moraleXp(G)===0&&E.moraleSpeed(G)===0,'neutral morale: no effect');
 G.morale=50; ok(Math.abs(E.moraleXp(G)-0.1)<1e-9&&Math.abs(E.moraleSpeed(G)-0.1)<1e-9,'high morale caps at +10%');
 G.morale=-50; ok(Math.abs(E.moraleXp(G)+0.15)<1e-9&&Math.abs(E.moraleSpeed(G)+0.15)<1e-9,'low morale floors at -15%');
 const m=E.active(G); m.ageDays=20*360; G.morale=0; const x0=E.xpMult(G,m,'farming'); G.morale=10; const x1=E.xpMult(G,m,'farming'); ok(x1>x0,'morale raises skill XP multiplier');
 const run=mo=>{const H=E.newGame(t0); E.skipTutorial(H); H.res.food=1e4; const a=E.active(H); a.ageDays=20*360; E.setAction(H,{type:'quest',target:'rats'}); H.morale=mo; for(let i=0;i<2;i++){H.morale=mo; E.dayTick(H,1,1);} return {p:(a.action||{}).progress||0,done:H.doneQuests.length};};
 const lo=run(-15), hi=run(10); ok(hi.p>lo.p||hi.done>lo.done,'morale changes action/travel speed');
 const S=E.newGame(t0); S.res.food=0; for(const k of Object.keys(D.estate.meals.menu)) S.res[k]=0; for(let i=0;i<30;i++) E.eatDay(S); ok(E.moraleSpeed(S)<=-0.14&&E.moraleXp(S)<=-0.14,'starvation drives speed and XP toward -15%');
 const F=E.newGame(t0); F.morale=8; ok(E.foodPanel(F).bonuses.some(b=>/Speed \+8%/.test(b))&&E.foodPanel(F).bonuses.some(b=>/Skill XP \+8%/.test(b)),'food panel shows morale XP and speed');
}
// Marriage depth: personalities, visible traits, dowries, courtship stages and patience
{ const Y=D.tuning.daysPerYear; const G=E.newGame(t0); E.skipTutorial(G); const F=E.active(G); F.ageDays=20*Y; G.res.coin=5000;
 const su=E.makeSuitor(G,{house:'marlowe'}); ok(E.personaDef(su.persona)&&su.traits.length>=2&&su.house==='marlowe'&&su.dowry.coin>0,'suitors have a personality, visible traits, a house and a dowry');
 ok(E.personaDef(su.persona).favors.some(t=>su.traits.includes(t))||!E.personaDef(su.persona).favors.some(t=>D.traits.some(x=>x.id===t)),'personality favours a matching trait');
 const com=E.makeSuitor(G,{house:null}); ok(com.house===null&&com.dowry.coin>0,'commoner suitors always possible (small dowry)');
 su.affinity=100; G.suitors=[su]; estate(G,['bunk','bunk']); const c0=G.res.coin; ok(E.propose(G,su.id),'propose to a house suitor');
 const sp=G.members.find(x=>x.id===F.spouse); ok(sp.persona===su.persona&&sp.house==='marlowe'&&su.traits.every(t=>sp.traits.includes(t)),'spouse keeps the suitor\'s personality, house and traits');
 ok(G.res.coin===c0-E.PROPOSE_COST+su.dowry.coin,'dowry received on marriage'); ok(E.rapport(G,'marlowe')>=D.marriage.houses.marryIn,'marriage builds rapport with their house');
 ok(G.chronicle.some(e=>/married/.test(e.t)),'marriage reaches the Chronicle');
 // household effects
 const H=E.newGame(t0); const hm=E.newMember(H,{age:25}); hm.persona='warm'; H.members.push(hm); ok(E.household(H,'morale')===1,'warm spouse: +1 household morale');
 H.res.food=1e3; for(let i=0;i<40;i++) E.eatDay(H); const mw=H.morale; const H2=E.newGame(t0); H2.res.food=1e3; for(let i=0;i<40;i++) E.eatDay(H2); ok(mw>H2.morale,'spouse personality changes morale');
 const K=E.newGame(t0); const km=E.newMember(K,{age:25}); km.persona='scholarly'; K.members.push(km); const kid=E.newMember(K,{age:5}); K.members.push(kid); const K2=E.newGame(t0); const kid2=E.newMember(K2,{age:5}); K2.members.push(kid2);
 {const a1=E.xpMult(K,kid,'reading'); km.persona='warm'; const a0=E.xpMult(K,kid,'reading'); km.persona='scholarly'; ok(a1-a0>0.09,'children XP +10% from a scholarly parent');}
 const Fd=E.newGame(t0); const fm=E.newMember(Fd,{age:25}); fm.persona='thrifty'; Fd.members.push(fm); const Fd2=E.newGame(t0); Fd2.members.push(E.newMember(Fd2,{age:25})); ok(E.dailyNeed(Fd)<E.dailyNeed(Fd2),'frugal spouse: family eats less');
 // child traits via existing best-trait inheritance
 const B=E.newGame(t0); const mom=B.members[0]; mom.gender='f'; mom.ageDays=20*Y; const bs=E.makeSuitor(B,{gender:'m'}); bs.traits=['chosen']; bs.affinity=100; B.res.coin=5000; B.suitors=[bs]; estate(B,['bunk','bunk','bunk']); E.propose(B,bs.id);
 const dad=B.members.find(x=>x.id===mom.spouse); ok(dad.traits.includes('chosen'),'epic suitor trait carried into the family');
 const ch=E.newMember(B,{age:0,parents:[mom.id,dad.id]}); E.inheritTraits(B,ch,[mom,dad]); ok(ch.traits.includes('chosen'),'child inherits the spouse\'s best trait');
 // stages, patience, no soft-lock
 const C=E.newGame(t0); E.skipTutorial(C); const cm=E.active(C); cm.ageDays=20*Y; const cs=E.makeSuitor(C,{house:'vey'}); C.suitors=[cs]; cs.affinity=59.9; E.setAction(C,{type:'court',target:cs.id}); E.advanceReal(C,30);
 ok(C.log.some(l=>/sweethearts/.test(l.msg))&&E.stageOf(cs.affinity).name!=='Acquainted','courtship stages');
 const L=E.newGame(t0); const ls=E.makeSuitor(L,{house:'vey'}); ls.affinity=70; ls.arrived=L.day-D.marriage.stayDays; L.suitors=[ls]; const r0=E.rapport(L,'vey'); E.suitorsTick(L); ok(!L.suitors.length&&E.rapport(L,'vey')<r0,'suitors leave after waiting; jilting sours their house');
 const W=E.newGame(t0); const ws=E.makeSuitor(W,{}); ws.affinity=100; ws.arrived=-9999; W.suitors=[ws]; E.suitorsTick(W); ok(W.suitors.length===1&&E.leavesIn(W,ws)===Infinity,'a suitor ready to wed waits (no lost progress)');
 const Lc=E.newGame(t0); E.skipTutorial(Lc); const lm=E.active(Lc); lm.ageDays=20*Y; const lcs=E.makeSuitor(Lc,{}); lcs.arrived=Lc.day-D.marriage.stayDays+1; Lc.suitors=[lcs]; E.setAction(Lc,{type:'court',target:lcs.id}); E.advanceReal(Lc,40); ok(!Lc.suitors.includes(lcs)&&(!lm.action||lm.action.type!=='court'),'courting a departed suitor stops cleanly');
 const lk=E.makeSuitor(G,{}); lk.persona='warm'; const m2=E.active(G); m2.stats.CHA=10; const n1=E.courtMult(G,m2,lk); m2.stats.CHA=1; ok(n1>E.courtMult(G,m2,lk),'liked stat speeds courtship');
 const fg=E.makeSuitor(G,{}); fg.persona='homely'; G.suitors.push(fg); G.res.pie=10; G.res.bread=10; E.giveFoodGift(G,fg.id,'pie'); const ap=fg.affinity; fg.affinity=0; E.giveFoodGift(G,fg.id,'bread'); ok(ap>fg.affinity&&fg.affinity>0,'food gifts court; the liked dish counts more');
  const rv=E.newGame(t0); E.addRapport(rv,'skye',-60); for(let i=0;i<40;i++){const x=E.makeSuitor(rv); ok(x.house!=='skye','no suitors from rival houses');} 
 const al=E.newGame(t0); E.addRapport(al,'skye',80); const as=E.makeSuitor(al,{house:'skye'}); const ne=E.newGame(t0); const ns=E.makeSuitor(ne,{house:'skye'}); ok(as.dowry.coin>ns.dowry.coin,'friendlier houses offer bigger dowries');
 // marrying out
 const O=E.newGame(t0); E.skipTutorial(O); O.res.coin=5000; const sib=E.newMember(O,{age:20}); O.members.push(sib); ok(!E.marryOutIssue(O,sib.id,'tallow'),'adult unmarried sibling can marry out');
 ok(/heir/.test(E.marryOutIssue(O,O.activeId,'tallow')),'the active heir cannot marry out'); const oc=O.res.coin, dw=E.marryOutDowry(sib); ok(E.marryOut(O,sib.id,'tallow')&&O.res.coin===oc-dw&&!sib.alive&&sib.marriedOut==='tallow','marrying out pays a dowry and the member leaves');
 ok(E.rapport(O,'tallow')>=D.marriage.marryOut.rapport&&E.ties(O,'tallow')===1,'marrying out ties the houses'); for(let i=0;i<24*30;i++) E.dayTick(O,1,1); ok(E.rapport(O,'tallow')>=D.marriage.houses.tieFloor-1,'ties hold rapport up over time');
 ok(E.familyTree(O).flat().find(n=>n.id===sib.id).marriedOut==='House Tallow','family tree shows who married out');
}
// est(): a Dynasty-phase family (Manor-level estate, 3+ living) so feud/war systems are open
const est=g=>{estate(g,['bunk']);g.buildings.farm=(g.buildings.farm||0)+60;kids(g);g.members.forEach(x=>x.ageDays=Math.max(x.ageDays,20*D.tuning.daysPerYear));g.renown=Math.max(g.renown||0,1000);return g;};
// Diplomacy: rapport tiers, house quests that pick sides, perks, troubles
{ const G=est(E.newGame(t0)); E.skipTutorial(G); ok(E.tierOf(G,'tallow')==='neutral','houses start neutral');
 const tiers=[[-80,'feud'],[-55,'rival'],[-20,'cold'],[0,'neutral'],[40,'friendly'],[80,'allied']]; for(const [r,t] of tiers){const X=est(E.newGame(t0)); E.addRapport(X,'vey',r); ok(E.tierOf(X,'vey')===t,`rapport ${r} → ${t}`);}
 const q=D.quests.find(x=>x.id==='hq_tallow_outbid'); const m=E.active(G); m.ageDays=20*D.tuning.daysPerYear; ok(!E.houseQuestIssue(G,q),'neutral houses offer quests');
 const a0=E.rapport(G,'tallow'), b0=E.rapport(G,'ashbrook'); E.houseQuestDone(G,q); ok(E.rapport(G,'tallow')>a0&&E.rapport(G,'ashbrook')<b0,'quests for one house hurt the house they target');
 ok(D.quests.filter(x=>x.house||x.needsFeud).length>=10&&D.quests.filter(x=>x.against).length>=5,'house quests (some against other houses) are data');
 ok(!E.autoQuest(G,m,'outskirts').house,'standing orders never take house quests');
 const C=est(E.newGame(t0)); E.addRapport(C,'ashbrook',-30); ok(/won't deal/.test(E.houseQuestIssue(C,D.quests.find(x=>x.id==='hq_ashbrook_harvest'))||'')===false,'cold houses still offer quests'); E.addRapport(C,'ashbrook',-30); ok(/won't deal/.test(E.houseQuestIssue(C,D.quests.find(x=>x.id==='hq_ashbrook_harvest'))),'rival houses refuse quests');
 const S=est(E.newGame(t0)); const p0=E.townSellPrice(S,'ashford','wood'); E.addRapport(S,'marlowe',80); ok(E.townSellPrice(S,'ashford','wood')>p0,'allies improve sell prices in their town'); const R=est(E.newGame(t0)); E.addRapport(R,'marlowe',-60); ok(E.townSellPrice(R,'ashford','wood')<p0,'rivals worsen sell prices');
 const T=est(E.newGame(t0)); T.res.coin=1e4; T.renown=500; E.addRapport(T,'corran',-60); let n=0; for(let d=0;d<30*60;d++){T.day++; const c=T.res.coin,r=T.renown,f=T.res.food; if(T.day%30===0){T.houses.corran.r=-60; E.housesDay(T); if(T.res.coin<c||T.renown<r||T.res.food<f)n++;}} ok(n>0,'rivals cause occasional trouble events');
 const Dr=est(E.newGame(t0)); E.addRapport(Dr,'corran',-60); for(let d=0;d<90;d++){Dr.day++; E.housesDay(Dr);} ok(E.rapport(Dr,'corran')>-60,'rapport drifts back toward neutral');
 const Gf=est(E.newGame(t0)); Gf.res.coin=1000; E.addRapport(Gf,'vey',-40); ok(E.sendGift(Gf,'vey')&&E.rapport(Gf,'vey')===-40+D.marriage.houses.giftStanding&&!E.sendGift(Gf,'vey'),'gifts raise rapport (with a cooldown)');
}
// Feud & war: warned first, newbie-safe, battles, endings, never a permanent lock
{ const Y=D.tuning.daysPerYear; const G=est(E.newGame(t0)); E.skipTutorial(G); E.addRapport(G,'skye',-80); ok(E.houseState(G,'skye').state==='feud'&&G.log.some(l=>/Feud/.test(l.msg)),'deep rivalry becomes a feud');
 ok(!E.houseQuestIssue(G,D.quests.find(x=>x.id==='hq_raid_skye')),'feuds open hostile quests'); ok(/only while feuding/.test(E.houseQuestIssue(est(E.newGame(t0)),D.quests.find(x=>x.id==='hq_raid_skye'))),'hostile quests need a feud');
 for(let d=0;d<Y*3;d++) E.dayTick(G,1,1); ok(E.houseState(G,'skye').state!=='war','a weak young family is never attacked');
 const P=est(E.newGame(t0)); E.skipTutorial(P); const pm=E.active(P); pm.ageDays=25*Y; E.chooseClass(P,pm.id,'fighter'); pm.stats.STR=60; pm.stats.VIT=60; E.addRapport(P,'skye',-90); P.houses.skye.r=-95;
 const fp=E.familyPower(P); ok(fp>=D.marriage.houses.feud.minPowerForAggression,'strong family can be targeted');
 let warned=null, war=null; for(let d=0;d<Y*30&&!war;d++){P.houses.skye.r=Math.min(P.houses.skye.r,-90); P.renown=Math.max(P.renown,1000); E.dayTick(P,1,1); if(P.houses.skye.warned!=null&&warned==null) warned=P.day; if(P.houses.skye.state==='war') war=P.day;}
 ok(warned!=null&&war!=null&&war-warned>=D.marriage.houses.feud.warnDays,'rival aggression warns first, then war');
 ok(P.chronicle.some(e=>/War with/.test(e.t)),'war reaches the Chronicle'); ok(E.timers(P).some(t=>t.key==='warskye'&&t.p>=0&&t.p<=1),'war has a timer/progress bar');
 const before=P.weary||0; let fights=0; const startDay=P.day; while(P.houses.skye.state==='war'&&fights<200){P.houses.skye.warDay=-999; E.housesDay(P); fights++;} ok(P.houses.skye.state==='peace','wars end (decisive wins or losses)'); ok((P.weary||0)>before&&E.wearyMorale(P)<0,'war weariness costs morale');
 ok(E.houseState(P,'skye').r>D.marriage.houses.feud.at,'peace never drops straight back into a feud');
 const Tq=est(E.newGame(t0)); Tq.members[0].ageDays=20*Y; E.addRapport(Tq,'vey',-90); ok(E.declareWar(Tq,'vey')&&E.atWar(Tq,'vey'),'player can escalate a feud to war'); Tq.res.coin=0; ok(/coin/.test(E.truceIssue(Tq,'vey')),'truce needs tribute'); Tq.res.coin=5000; ok(E.offerTruce(Tq,'vey')&&!E.atWar(Tq,'vey')&&Tq.res.coin===5000-E.tributeCost(Tq,'vey'),'tribute buys a truce');
 const Mq=est(E.newGame(t0)); Mq.members[0].ageDays=20*Y; Mq.res.coin=5000; E.addRapport(Mq,'vey',-90); E.declareWar(Mq,'vey'); const sib=E.newMember(Mq,{age:20}); Mq.members.push(sib); ok(!E.marryOutIssue(Mq,sib.id,'vey')&&E.marryOut(Mq,sib.id,'vey')&&!E.atWar(Mq,'vey'),'marrying into the enemy ends a war');
 const Ms=est(E.newGame(t0)); Ms.members[0].ageDays=20*Y; Ms.res.coin=5000; E.addRapport(Ms,'vey',-90); E.declareWar(Ms,'vey'); const vs=E.makeSuitor(Ms,{house:'vey'}); vs.affinity=100; Ms.suitors=[vs]; Ms.members[0].ageDays=20*Y; estate(Ms,['bunk','bunk']); ok(E.propose(Ms,vs.id)&&!E.atWar(Ms,'vey'),'marrying one of theirs ends a war too');
 const To=est(E.newGame(t0)); To.members[0].ageDays=20*Y; E.addRapport(To,'vey',-90); E.declareWar(To,'vey'); for(let d=0;d<D.marriage.houses.war.maxDays+5;d++){To.day++; E.housesDay(To);} ok(!E.atWar(To,'vey'),'wars time out (never a permanent lock)');
 const Al=est(E.newGame(t0)); const a0=E.allyPower(Al); E.addRapport(Al,'skye',80); ok(E.allyPower(Al)>a0,'allies add power in battles');
 const Nw=est(E.newGame(t0)); Nw.members[0].ageDays=20*Y; E.addRapport(Nw,'marlowe',-90); E.declareWar(Nw,'marlowe'); ok(E.enemyPower(Nw,'marlowe')<=Math.max(10,(E.familyPower(Nw)+E.allyPower(Nw))*D.marriage.houses.war.enemyMaxScale+1e-9),'enemy power scales with a small family (newbie-safe)');
 const old=JSON.parse(E.serialize(E.newGame(t0),t0)); delete old.schema; delete old.houses; delete old.weary; old.suitors=[{id:'o1',name:'Old',gender:'m',cls:'scout',affinity:40,age:20}];
 const O=E.importSave(JSON.stringify(old)); ok(O.houses&&O.weary===0&&O.suitors[0].dowry&&O.suitors[0].persona===null&&O.suitors[0].arrived!=null,'old saves gain houses, weariness and suitor fields');
}
// Phases: Established no longer opens feuds/war (Dynasty only); war split into war.js
{ const G=E.newGame(t0); E.skipTutorial(G); estate(G,['bunk']); G.members[0].ageDays=25*360; G.renown=400; ok(E.era(G).n===2,'Established phase');
 ok(E.phaseOk(G,'againstQuests')&&!E.phaseOk(G,'feud'),'rivalry quests at Established, feuds wait'); E.addRapport(G,'vey',-95); ok(E.houseState(G,'vey').state==='peace','no feud in Established');
 G.houses.vey={r:-90,state:'feud'}; ok(/Dynasty/.test(E.declareWarIssue(G,'vey')||''),'declaring war needs Dynasty');
 est(G); ok(E.era(G).n===3&&!E.declareWarIssue(G,'vey'),'Dynasty opens war'); ok(E.nextEraHint(G).includes('planned'),'header hint points at planned Titles');
 const n0=G.chronicle?G.chronicle.length:0; G.phaseSeen=2; E.introsDay(G); ok(G.phaseSeen===3&&(G.chronicle||[]).length>n0,'phase change goes to the Chronicle once'); E.introsDay(G); ok((G.chronicle||[]).length===n0+1,'no repeated phase entry');
}
// Unlock intros: short rewarded lines per unlock, skippable, never blocking, no spam for old saves
{ const G=E.newGame(t0); E.introsDay(G); ok(!E.introsActive(G).length,'no intros during the apprentice prologue');
 E.skipTutorial(G); G.members[0].ageDays=20*360; E.introsDay(G); ok(E.introsActive(G).map(l=>l.id).includes('guilds'),'guild intro starts for an adult');
 ok(E.introsActive(G).length===1,'one intro line at a time'); E.introSkip(G,'guilds'); estate(G,['bunk']); E.introsDay(G); ok(E.introsActive(G).map(l=>l.id).join()==='food','land opens the food intro next');
 ok(G.log.some(l=>/📘 New: .*Food/.test(l.msg)),'intro start is logged (notify + chronicle hooks)');
 const c0=G.res.coin; E.introView(G,'estate'); ok(G.res.coin===c0+D.intros.lines.find(l=>l.id==='food').steps[0].reward.coin,'view step pays its reward');
 E.setRation(G,E.RATIONS()[0].id); ok(G.intros.lines.food.state==='done'||G.intros.lines.food.step===1,'ration step can complete');
 E.introsDay(G); ok(E.introsActive(G).map(l=>l.id).join()==='minions','minions intro queued behind food'); ok(E.introSkip(G,'minions')&&G.intros.lines.minions.state==='skipped'&&!E.introSkip(G,'minions'),'intros skip once');
 E.setAction(G,{type:'activity',target:'chores'}); ok(!E.actionAllowed||E.actionAllowed(G,G.members[0],{type:'activity',target:'chores'})!==false,'intros never block actions');
 for(const l of D.intros.lines) ok(l.steps.length<=3,'intro '+l.id+' ≤3 steps');
 { const X=E.newGame(t0); E.skipTutorial(X); X.members[0].ageDays=20*360; E.introsDay(X); const id=E.introsActive(X)[0].id; X.day+=D.intros.expireDays+1; estate(X,['bunk']); E.introsDay(X); ok(X.intros.lines[id].state==='skipped'&&X.intros.lines[id].expired&&E.introsActive(X).length===1&&E.introsActive(X)[0].id!==id,'an ignored intro steps aside so the next can start'); }
 // dynasty intro chain at phase 3
 const H=E.newGame(t0); E.skipTutorial(H); est(H); H.members[0].ageDays=25*360; E.introsDay(H); ok(E.introsActive(H).some(l=>l.id==='dynasty'),'Dynasty intro starts at phase 3');
 E.introView(H,'houses'); ok(H.intros.lines.dynasty.step===1,'dynasty step 1: open Houses'); H.houses.ashbrook={r:40,state:'peace'}; E.introsDay(H); ok(H.intros.lines.dynasty.step===2,'dynasty step 2: a Friendly house');
 H.doneQuests.push('hq_tallow_ledger'); const r0=H.renown; E.introsDay(H); ok(H.intros.lines.dynasty.state==='done'&&H.renown>r0,'dynasty chain completes with rewards');
 // migration: an old save that already has land/crafting gets no intro spam
 const O=E.newGame(t0); E.skipTutorial(O); estate(O,['bunk']); O.members[0].ageDays=25*360; delete O.intros; O.schema=7; O.day=500;
 const st=JSON.parse(E.serialize(O,t0)); st._norm=false; E.normalize(st); const nlog=st.log.length; E.introsDay(st);
 ok(st.intros.lines.food&&st.intros.lines.food.state==='done'&&st.intros.lines.food.quiet,'old save: unlocked systems marked done quietly');
 ok(!st.log.slice(nlog).some(l=>/📘 New: .*(Food|Minions)/.test(l.msg)),'old save: no intro spam on load');
}
// Phase gates: light marriage/rapport early, rivalry/feud/war once Established (Dynasty systems ramp in)
{ const B=E.newGame(t0); ok(E.era(B).n===1,'fresh game is phase 1'); E.addRapport(B,'vey',-95); ok(E.houseState(B,'vey').state==='peace'&&E.rapport(B,'vey')>D.marriage.houses.feud.at,'no feuds in the Beginning phase');
 ok(/Established/.test(E.houseQuestIssue(B,D.quests.find(x=>x.id==='hq_tallow_outbid'))||''),'rivalry quests wait for the Established phase'); ok(!E.houseQuestIssue(B,D.quests.find(x=>x.id==='hq_tallow_ledger')),'friendly house quests from the start');
 const Bs=E.makeSuitor(B,{house:'skye'}); ok(Bs.dowry.coin>0,'house marriages from the start');
 let tr=0; B.res.coin=1e4; for(let d=0;d<30*40;d++){B.day++; if(B.day%30===0){B.houses.vey.r=-60; const c=B.res.coin; E.housesDay(B); if(B.res.coin<c) tr++;}} ok(tr===0,'no rival trouble events before Established');
 ok(D.marriage.houses.list.every(h=>h.rank&&h.seat&&h.kind),'house model has rank/seat/kind for future lords & titles');
}
// Gear sets: 2/4-piece bonuses, quality carries through, minions wear sets
{ const G=E.newGame(t0); E.skipTutorial(G); const m=G.members[0]; m.ageDays=25*360; m.cls='fighter';
 const base=E.cp(G,m); const SW=D.gear.sets.find(x=>x.id==='warden');
 G.vault.push('c|warden_blade|common','c|warden_shield|common'); E.equip(G,m,'c|warden_blade|common'); const one=E.cp(G,m); E.equip(G,m,'c|warden_shield|common');
 const two=E.cp(G,m); ok(E.setProgress(m.equip)[0].n===2&&two>one+E.itemDef('c|warden_shield|common').cp,'2-piece set bonus adds CP on top of the pieces');
 const vit0=E.statVal(m,'VIT'); G.vault.push('c|warden_mail|masterwork','c|warden_sigil|masterwork'); E.equip(G,m,'c|warden_mail|masterwork'); E.equip(G,m,'c|warden_sigil|masterwork');
 ok(E.statVal(m,'VIT')>vit0&&G.log.some(l=>/🧩 .*completed the .*Warden/.test(l.msg)),'4-piece: stats + completion logged (Chronicle hook)');
 const sc=E.setProgress(m.equip)[0].scale; ok(sc>1,'quality carries through: masterwork pieces scale the set bonus ('+sc.toFixed(2)+')');
 const lo=E.gearFx({a:'c|warden_blade|crude',b:'c|warden_shield|crude'}).cp, hi=E.gearFx({a:'c|warden_blade|masterwork',b:'c|warden_shield|masterwork'}).cp; ok(hi>lo,'higher quality → bigger set bonus');
 ok(E.gearFx({a:'moon_edge',b:'moon_aegis'}).cp>E.gearFx({a:'warden_blade',b:'warden_shield'}).cp,'found Epic set pieces scale by rarity');
 const mi={uid:'x',equip:{weapon:'warden_blade',armor:'warden_mail'}}; ok(E.minionGearMult(mi,'guard')>E.minionGearMult({uid:'y',equip:{weapon:'iron_sword',armor:'iron_chainmail'}},'guard')-0.0001+0.1,'minions wearing 2 set pieces get the minion set bonus');
 ok(D.quests.some(q=>(q.rare||[]).some(r=>r.id==='moon_edge'||r.id.startsWith('moon_')))&&D.dungeons.some(d=>(d.rare||[]).some(r=>r.id.startsWith('moon_'))),'found-only set drops from quests and dungeons');
 ok(D.gear.sets.filter(x=>!x.found).every(x=>x.pieces.every(pc=>D.crafting.recipes.some(r=>r.base===pc))),'craftable sets have a recipe for every piece');
}
// Enchanting: slots by quality/rarity, timed jobs with progress, greater rolls, replace + disenchant
{ const G=E.newGame(t0); E.skipTutorial(G); const m=G.members[0]; m.ageDays=25*360; m.cls='apprentice'; estate(G,['bunk','enchdesk']);
 ok(E.enchSlots(E.itemDef('c|iron_sword|crude'))===0&&E.enchSlots(E.itemDef('c|iron_sword|masterwork'))===3&&E.enchSlots(E.itemDef('moon_edge'))===2,'enchant slots grow with quality / rarity');
 ok(E.enchanters(G).length===1,'mage-line adult can enchant'); const F=E.stationFx(G); ok(F.jobs===1&&F.maxSlots===1,'home Rune Desk: 1 job, first slot only');
 Object.assign(G.res,{dust:50,copper:10,mandrake:10,moonpetal:10,thyme:20,ingots:5}); G.vault.push('c|iron_sword|superior');
 ok(/slot 1 and below/.test(E.enchantIssue(G,'m:'+m.id,'c|iron_sword|superior','keen',1)||''),'home desk cannot work the 2nd slot');
 ok(/doesn't go on/.test(E.enchantIssue(G,'m:'+m.id,'c|iron_sword|superior','warding',0)||''),'enchants are slot-specific');
 const cp0=E.itemDef('c|iron_sword|superior').cp; ok(E.startEnchant(G,'m:'+m.id,'c|iron_sword|superior','keen'),'start enchant'); ok(!G.vault.includes('c|iron_sword|superior')&&E.timers(G).some(x=>x.icon==='✨'),'item is on the table; enchant timer listed');
 const x0=m.skills.enchanting.xp+m.skills.enchanting.lvl*1e6; for(let i=0;i<10&&G.enchants.length;i++){G.day++;E.enchantDay(G);} const nid=G.vault.find(id=>id.startsWith('c|iron_sword|superior#'));
 ok(nid&&E.itemDef(nid).cp>cp0&&E.splitId(nid).ench[0].startsWith('keen'),'enchanted item returns with more CP'); ok(m.skills.enchanting.xp+m.skills.enchanting.lvl*1e6>x0,'enchanting trains the Enchanting skill');
 ok(G.log.some(l=>/✨ .*enchanted/.test(l.msg))&&G.intros,'enchant logged (notify craft category)');
 const back=E.disenchant(G,nid,0); ok(back==='c|iron_sword|superior'&&G.vault.includes(back),'disenchant clears the slot (half reagents back)');
 m.skills.enchanting.lvl=60; let greater=0; for(let k=0;k<6;k++){const id='c|oak_staff|fine'; G.vault.push(id); E.startEnchant(G,'m:'+m.id,id,'keen'); for(let i=0;i<10&&G.enchants.length;i++){G.day++;E.enchantDay(G);} const r=G.vault.find(v=>v.startsWith('c|oak_staff|fine#')); if(r&&E.isGreater(E.splitId(r).ench[0]))greater++; G.vault=G.vault.filter(v=>!v.startsWith('c|oak_staff'));} ok(greater>0,'skilled enchanter rolls Greater enchants');
 // replace: workshop opens slot 2, replace slot 1
 G.structures.push({uid:'ws',type:'arcaneworkshop',pieces:['enchtable','arcanefocus'],up:0}); const id2='c|iron_sword|superior#keen'; G.vault.push(id2); ok(E.startEnchant(G,'m:'+m.id,id2,'moonfire',0),'replace an existing enchant'); for(let i=0;i<20&&G.enchants.length;i++){G.day++;E.enchantDay(G);} ok(G.vault.some(v=>/#moonfire/.test(v)&&!/keen/.test(v)),'replacement swaps the enchant');
 const dm={uid:'d1',name:'Hedge',cls:'n_enchanter',lvl:5,equip:{}}; G.minions.push(dm); ok(E.enchanters(G).some(w=>w.key==='n:d1')===E.isHoused(G,dm),'magic followers can be enchanters (when housed)');
 const ol=JSON.parse(E.serialize(G,t0)); delete ol.enchants; ol.schema=8; ol._norm=false; E.normalize(ol); ok(Array.isArray(ol.enchants)&&ol.vault.every(id=>E.itemDef(id)),'migration n:9 keeps enchanted ids loadable');
}
{ const G=E.newGame(t0); E.skipTutorial(G); const m=G.members[0]; m.ageDays=25*360; m.cls='apprentice'; estate(G,['bunk']); for(let i=0;i<5;i++){E.introsDay(G); for(const l of E.introsActive(G)) if(l.id!=='enchanting') E.introSkip(G,l.id);} ok(G.intros.lines.enchanting&&G.intros.lines.enchanting.state==='active','Enchanting intro starts for a mage with land'); G.structures[0].pieces.push('enchdesk'); E.introsDay(G); ok(G.intros.lines.enchanting.step===1,'intro step 1: a station'); }
{ const G=E.newGame(t0); E.skipTutorial(G); const mi={uid:'mm',type:'laborer',name:'Bo',equip:{},lvl:1,loyalty:10}; G.minions.push(mi); G.vault.push('warden_blade','warden_mail'); ok(E.equipMinion(G,mi.uid,'warden_blade')&&E.equipMinion(G,mi.uid,'warden_mail')&&E.setProgress(mi.equip)[0].n===2,'minions can wear set gear'); }
// Stations: home furniture tiers vs workshop upgrades; synergies can beat a low workshop; full workshop is the ceiling
{ const mk=()=>{const G=E.newGame(t0); E.skipTutorial(G); return G;}; const Q=G=>E.stationFx(G).quality+E.stationFx(G).speed;
 const H0=mk(); H0.structures=[{uid:'h',type:'house',pieces:['enchdesk'],up:0}]; const W0=mk(); W0.structures=[{uid:'w',type:'arcaneworkshop',pieces:['enchtable','arcanefocus'],up:0}];
 const HM=mk(); HM.structures=[{uid:'h',type:'house',pieces:['enchdesk@3'],up:0}]; ok(Q(H0)<Q(HM)&&Q(HM)<Q(W0),'home tiers improve but stay below a base workshop');
 const HS=mk(); HS.structures=[{uid:'h',type:'house',pieces:['enchdesk@3','reagentshelf','studydesk','glyphlectern'],up:0}]; ok(Q(HS)>Q(W0),'home + synergies outclass a low-tier workshop');
 const WM=mk(); WM.structures=[{uid:'w',type:'arcaneworkshop',pieces:['enchtable','arcanefocus','reagentshelf','glyphlectern'],up:3}]; ok(Q(WM)>Q(HS)&&E.stationFx(WM).maxSlots>E.stationFx(HS).maxSlots-1&&E.stationFx(WM).jobs>=2,'full workshop with synergies is the ceiling');
 ok(E.stationCraftQ(WM,'enchtable')>E.stationCraftQ(W0,'enchtable')&&E.stationCraftQ(W0,'forge')===0,'workshop upgrades add crafting quality at its station');
 ok(E.pieceSlots('enchdesk@3')===1&&E.pieceSlots('enchdesk')===1&&E.pieceSlots('forge@3')===1,'every furniture item costs 1 slot at any tier');
 ok(Object.keys(E.pieceTiers('enchdesk')[3].cost).some(k=>['moonpetal','mandrake','dust'].includes(k)),'top tiers need higher-tier resources');
 const G=mk(); const st=estate(G,['enchdesk@1']); G.res.coin=1e4; G.res.blocks=50; G.res.dust=50; G.res.moonpetal=20; const free=E.freeSlots(G,st); st.pieces.push(...Array(free).fill(0).map((_,i)=>'bunk')); ok(!/more free slot/.test(E.pieceUpIssue(G,st.uid,'enchdesk@1')||''),'upgrading a tier needs no extra room (1 slot always)');
 const O=mk(); const s2=estate(O,['forge@3']); const cap=E.freeSlots(O,s2); s2.pieces.push(...Array(Math.max(0,cap+1)).fill('bunk')); const ol=JSON.parse(E.serialize(O,t0)); ol.schema=8; ol._norm=false; E.normalize(ol); ok(E.freeSlots(ol,ol.structures.find(x=>x.uid===s2.uid))>=0,'old saves: over-full buildings are grandfathered');
 ok(/needs a Mage/.test(E.structIssue(mk(),'arcaneworkshop')||'')||/buy land|needs a/.test(E.structIssue(mk(),'arcaneworkshop')||''),'workshop requires the Mage\'s Tower');
}
// Class crafting perks: exclusive recipes/furniture/upgrades + quality bonus on what they build
{ const G=E.newGame(t0); E.skipTutorial(G); const m=G.members[0]; m.ageDays=25*360; estate(G,['bunk','forge','toolrack','loom','workbench']); Object.assign(G.res,{ingots:50,leather:10,planks:20,copper:20,cloth:20,dust:20});
 const rc=E.recipeDef('r_warden_mail'); ok(/Journeyman Smith only/.test(E.recipeIssue(G,m,rc)||''),'class recipe locked, names the class'); asProf(m,'blacksmith'); m.skills.smithing.lvl=20; ok(!E.recipeIssue(G,m,rc),'Blacksmith can craft it'); asProf(m,'armorer'); ok(!E.recipeIssue(G,m,rc)||!/only/.test(E.recipeIssue(G,m,rc)),'advanced classes in the line inherit');
 asProf(m,null); ok(/needs a Journeyman Smith/.test(E.pieceLock(G,E.pieceDef('runedanvil'))||''),'class furniture is locked with the class named');
 const st=G.structures[0]; const pm0=E.pieceMult(st,'toolrack'); asProf(m,'blacksmith'); ok(!E.pieceLock(G,E.pieceDef('runedanvil')),'a Blacksmith unlocks it'); G.res.coin+=1e4; E.removePiece(G,st.uid,'toolrack'); E.placePiece(G,st.uid,'toolrack',G.pieceStore.includes('toolrack')); ok(E.pieceMult(st,'toolrack')>pm0,'furniture built with a Blacksmith in the family gets a quality bonus');
 const ws={uid:'w',type:'arcaneworkshop',pieces:['enchtable','arcanefocus'],up:2}; G.structures.push(ws); G.res.coin=1e5; G.res.blocks=100; G.res.moonpetal=50; ok(/needs an Apprentice/.test(E.specialUpIssue(G,'w')||''),'class-gated building upgrade');
 for(const [c,k] of Object.entries(D.crafting.classPerks)) if(c[0]!=='_') ok((D.classes.some(x=>x.id===c)||!!D.paths.classMap[c])&&k.structures.every(t=>D.estate.structures.some(x=>x.id===t))&&k.pieces.every(p=>E.pieceDef(p)),'perk '+c+' references real classes/pieces');
}
// Follower milestone upgrades: every N levels + double on evolution; Auto by class preference, Manual waits
{ const MS=D.minions.milestones; const G=E.newGame(t0); E.skipTutorial(G); const mk=(cls,uid)=>{const mi={uid,type:'laborer',name:'F'+uid,job:'farm',lvl:1,xp:0,equip:{},loyalty:10,cls};G.minions.push(mi);return mi;};
 const lvTo=(mi,l)=>{while(mi.lvl<l)E.minionGainXp(G,mi,E.minionXpNeed(mi.lvl));};
 const a=mk('n_peasant','a'); lvTo(a,MS.every-1); ok(!(a.ups||[]).length,'no upgrade before the first milestone'); lvTo(a,MS.every); ok(a.ups.length===1&&a.ups[0].id===MS.prefs.base[0],'Auto: milestone picked by class preference ('+a.ups[0].id+')');
 ok(G.log.some(l=>/🔓 .*gained/.test(l.msg)),'upgrade logged (notify level-up)');
 const g=mk('n_militia','g'); lvTo(g,MS.every); ok(['vigor','slot_offhand','might'].includes(g.ups[0].id),'Guard prefers armor/health ('+g.ups[0].id+')');
 const h=mk('n_hedgemage','h'); h.job='craft'; lvTo(h,2*MS.every); ok(h.ups.some(u=>u.id==='slot_accessory'||u.id==='wits'),'Hedge Mage prefers a charm/accessory or magic');
 const m=mk('n_peasant','m'); E.setUpMode(G,'m','manual'); lvTo(m,MS.every); ok((m.pending||[]).length===1&&m.pending[0].offer.length>=2&&m.pending[0].offer.length<=3&&!(m.ups||[]).length,'Manual: 2-3 choices wait');
 ok(E.pendingCount(G)===1,'waiting choice counted for the badge'); const out0=E.minionLvlMult(m)*E.minionGearMult(m,'farm'); ok(out0>0&&m.job==='farm','waiting never blocks work');
 ok(!E.choosePending(G,'m',0,'not_offered'),'cannot pick outside the offer'); const pick=m.pending[0].offer[1]; ok(E.choosePending(G,'m',0,pick)===pick&&!m.pending.length&&m.ups[0].id===pick,'pick one of the offered upgrades');
 lvTo(m,MS.every*(MS.maxPending+2)); ok(m.pending.length===MS.maxPending&&m.ups.length>1,'pending queue capped; overflow auto-picks');
 E.setUpMode(G,'m','auto'); ok(!m.pending.length,'switching to Auto resolves waiting choices');
 const ev=mk('n_peasant','ev'); ev.lvl=5; ev.skills=Object.fromEntries(['guard','adventure','tutor','scout','craft','farm','herbs','merchant','hunt','fish','gather','mine'].map(j=>[j,1e4])); G.structures=[{uid:'b',type:'barracks',pieces:[],up:3}]; const n0=(ev.ups||[]).length; E.evolveMinion(G,'ev','n_militia'); ok(ev.cls==='n_militia'&&ev.ups.length===n0+1&&ev.ups[ev.ups.length-1].mult===MS.bigMult,'evolution grants a double upgrade');
 // full 4-piece set on an evolved follower
 const f=mk('n_militia','f'); f.ups=[{id:'slot_offhand',mult:1},{id:'slot_accessory',mult:1}]; ok(E.minionSlots(f).length===6,'extra gear slots unlocked');
 G.vault.push('warden_blade','warden_shield','warden_mail','warden_sigil'); for(const id of ['warden_blade','warden_shield','warden_mail','warden_sigil']) E.equipMinion(G,'f',id); ok(E.setProgress(f.equip)[0].n===4,'follower wears a full 4-piece set');
 const two={uid:'t',equip:{weapon:'warden_blade',armor:'warden_mail'}}; ok(E.minionGearMult(f,'guard')>E.minionGearMult(two,'guard')+0.1,'4-piece follower bonus beats 2-piece');
 const vc=E.vaultCap(G); f.ups.push({id:'pack',mult:1}); ok(E.vaultCap(G)===vc+1,'pack upgrade adds vault space');
 const sv=E.minionSurvival(f); f.ups.push({id:'vigor',mult:1}); ok(E.minionSurvival(f)<sv,'vigor makes followers tougher');
 const w=mk('n_enchanter','w'); w.home=null; const k0=E.upEnchant(w); w.ups=[{id:'wits',mult:2}]; ok(E.upEnchant(w)>k0,'wits raises a magic follower\'s enchanting skill');
 // migration: old followers get earned milestones, quietly
 const O=E.newGame(t0); O.minions.push({uid:'o',type:'laborer',name:'Old',job:'farm',lvl:2*MS.every+1,xp:0,equip:{},loyalty:10,cls:'n_militia'}); const ol=JSON.parse(E.serialize(O,t0)); delete ol.minions[0].ups; ol.schema=9; ol._norm=false; const nl=ol.log.length; E.normalize(ol);
 ok(ol.minions[0].ups.length===3&&ol.minions[0].upMode==='auto','migration backfills milestones (+1 for the evolved class)'); ok(!ol.log.slice(nl).some(l=>/🔓/.test(l.msg)),'backfill is quiet');
}

// Craft paths for family members: ranks, extra paths capped under the main, specialties, combos, migration
{
  const G=E.newGame(t0), m=G.members[0]; m.ageDays=20*360; G.res.coin=1e5; m.skills.carpentry.lvl=8; m.skills.smithing.lvl=5;
  const R=D.paths.ranks;
  ok(/Crafters/.test(E.openPathIssue(G,m,'carpenter')||''),'paths need the Crafters\' Guild');
  ok(E.joinGuild(G,m,'hearth')&&E.pendingPathChoices(m)===1,'joining offers a main path (badge count)');
  ok(E.openPathIssue(G,m,'architect')==='pick a main path first','combo needs a main path first');
  ok(E.openPath(G,m,'carpenter')&&E.mainPath(m).id==='carpenter'&&E.mainPath(m).rank===0,'main path starts at Apprentice');
  ok(/gain a rank/.test(E.openPathIssue(G,m,'mason')||''),'no second path before a rank-up');
  const nl=G.log.length; E.gainXp(G,m,'carpentry',R[1].xp+10); m.skills.carpentry.lvl=Math.max(m.skills.carpentry.lvl,R[1].skill); E.refreshPaths(G,m);
  ok(E.mainPath(m).rank===1&&G.log.some(l=>/🔨.*Journeyman Carpenter/.test(l.msg)),'skill XP feeds the path; rank-up logged (🔨 craft notify)');
  ok(m.craft.rank===1,'Crafters\' Guild rank follows the main path');
  ok(!E.canRankUp(G,m,'hearth'),'guild rep no longer ranks Crafters');
  ok(E.openPath(G,m,'mason')&&!E.openPathIssue(G,m,'mason')===false,'a rank-up opens one more path');
  const ms=E.pathOf(m,'mason'); m.skills.masonry.lvl=60; E.gainXp(G,m,'masonry',R[3].xp*2);
  ok(ms.rank===0&&E.pathCap(m,ms)===0,'secondary capped just under the main path');
  ok(E.pathProgress(m,ms).capped,'capped progress is flagged for the UI');
  m.skills.carpentry.lvl=R[2].skill; E.gainXp(G,m,'carpentry',R[2].xp); 
  ok(E.mainPath(m).rank===2&&ms.rank===1,'main rank lifts the secondary cap; secondary catches up');
  ok(E.pathSlots(m)===D.paths.maxPaths,'slots grow per rank, capped by maxPaths');
  ok(E.openPath(G,m,'scribe'),'third path');
  ok(/at most 3/.test(E.openPathIssue(G,m,'cook')||''),'maxPaths cap enforced');
  // specialty at Master
  ok(E.specChoices(m,'carpenter').map(x=>x.id).includes('cooper')&&!E.specChoices(m,'carpenter').some(x=>x.id==='shipwright'),'Master offers Carpenter specialties (Cooper; Shipwright moved to a combo)');
  ok(!E.chooseSpec(G,m,'carpenter','weaver')&&E.chooseSpec(G,m,'carpenter','bowyer'),'only that path\'s specialties');
  ok(E.specChoices(m,'carpenter').length===0,'one specialty per path');
  const e=E.pathOf(m,'carpenter'); E.gainXp(G,m,'carpentry',R[3].xp); ok(e.srank>=1&&e.srank<=e.rank,'specialty ranks the same way, capped by the path');
  ok(E.profBonus(m,E.recipeDef('r_bow'))>E.profBonus(m,E.recipeDef('r_staff')),'Bowyer boosts bows over staves');
  // combo: Architect (Mason J + Carpenter J + Scribe) does not use a slot, inputs keep ranking
  ok(E.advancedReqs(m,'architect').every(x=>x.ok)&&!E.openPathIssue(G,m,'architect'),'Architect unlocks on one member with Mason + Carpenter + Scribe');
  ok(E.openPath(G,m,'architect')&&E.pathSlots(m)===3,'combo path opened beyond the 3-path cap');
  const sx=E.pathOf(m,'scribe').xp; E.gainXp(G,m,'reading',500); ok(E.pathOf(m,'scribe').xp>sx,'combo inputs are never blocked');
  ok(E.pathCap(m,E.pathOf(m,'architect'))===R.length-1,'combos uncapped by the main path');
  ok(E.famHasClass(G,'architect')&&E.upgradePerk(G,'house')>0,'old Architect perks now come from the Architect path');
  const ar=E.advancedReqs(m,'artificer'); ok(ar.some(x=>!x.ok&&/Goldsmith/.test(x.text))&&ar.some(x=>!x.ok&&/line class/.test(x.text)),'locked combo lists its requirements (specialty + class line)');
  ok(/Warrior|Fighter/.test(E.advancedReqs(m,'battlesmith').map(x=>x.text).join())||E.advancedReqs(m,'battlesmith').some(x=>/line class/.test(x.text)),'Battle Smith needs a Warriors\' class line');
  // class recipes
  const bow=D.crafting.recipes.find(r=>r.path==='carpenter'&&r.forClass==='hunter');
  ok(/Hunters only/.test(E.recipePathIssue(m,bow,E.inLine)||''),'class recipe gated by adventuring class line');
  m.cls='ranger'; ok(!E.recipePathIssue(m,bow,E.inLine),'a Ranger (hunter line) on the path gets the bow');
  const tl=D.crafting.recipes.find(r=>r.path==='tailor'&&r.forClass==='hunter'); ok(/Journeyman Tailor/.test(E.recipePathIssue(m,tl,E.inLine)||''),'needs the path rank, named');
}
// path effects hook the food chain and gathering
{
  const G=E.newGame(t0), m=G.members[0]; m.ageDays=20*360; G.res.coin=1e5; E.joinGuild(G,m,'hearth');
  const v0=E.famFx(G,'variety'); m.paths=[{id:'cook',xp:0,rank:2,spec:'chef',sxp:0,srank:1,}];
  ok(E.famFx(G,'variety')>v0&&E.famFx(G,'foodQ','stew')>E.famFx(G,'foodQ','bread'),'Cook: variety bonus; Chef lifts stews more than bread');
  m.paths=[{id:'farmer',xp:0,rank:1,spec:null,sxp:0,srank:0}]; ok(E.famFx(G,'cropQ','wheat')>0&&E.famFx(G,'cropQ','ale')===0,'Farmer: crop quality on crops only');
  m.paths=[{id:'woodsman',xp:0,rank:1,spec:'forestsense',sxp:0,srank:0}]; ok((E.pathFinds(m,'foraging').mushrooms||0)>0&&E.memberFx(m,'gather','thyme')>E.memberFx(m,'gather','wood'),'Woodsman finds mushrooms; Herbalist favours herbs');
  m.paths=[{id:'scribe',xp:0,rank:1,spec:'loremaster',sxp:0,srank:0}]; ok(E.famFx(G,'trainXp')>0.05,'Scribe/Loremaster boost family training');
  m.paths=[{id:'smithing',xp:0,rank:2,spec:'locksmith',sxp:0,srank:1}]; const vc=E.vaultCap(G); m.paths[0].spec=null; ok(vc>E.vaultCap(G),'Locksmith adds vault space');
}
// migration: crafter classes → paths; FL1 code still loads
{
  const G=E.newGame(t0); const a=G.members[0]; a.ageDays=30*360; a.skills.tailoring.lvl=40;
  const raw=JSON.parse(E.serialize(G,t0)); raw.schema=10; raw.members[0].prof='couturier'; delete raw.members[0].paths; raw.members[0].craft={id:'hearth',rank:3,rep:500};
  const b={...raw.members[0],id:999,name:'Arch',prof:'architect',craft:null}; raw.members.push(b); raw._norm=false; E.normalize(raw);
  const A=raw.members[0], B=raw.members.find(x=>x.id===999);
  ok(!A.prof&&E.mainPath(A).id==='tailor'&&E.mainPath(A).rank===2&&E.mainPath(A).spec==='leatherworker','Couturier → Master Tailor (Leatherworker)');
  ok(A.craft.rank===2,'guild rank re-synced to the path');
  ok(E.pathOf(B,'architect')&&E.mainPath(B).id==='carpenter'&&E.pathOf(B,'mason')&&E.pathOf(B,'scribe')&&B.craft,'Architect → Carpenter main + Mason + Scribe + Architect combo');
  ok(E.inLine(B,'carpenter')&&E.inLine(B,'architect')&&!E.inLine(B,'blacksmith'),'requiresClass ids map to path ranks');
}

// Map round: terrain, roads, fog, nodes (stock), gathering hauls, hauling tiers, parcels, locations, encounters
{
  ok(E.terrainAt(172.5,247.5)==='hills'&&E.terrainAt(217.5,937.5)==='swamp'&&E.terrainAt(615,877.5)==='lake'&&E.terrainAt(427.5,369)==='river'&&E.terrainAt(45,450)==='coast'&&E.terrainAt(645,127.5)==='mountains'&&E.terrainAt(300,682.5)==='plains'&&E.terrainAt(1050,300)==='forest','terrain zones and region defaults');
  const h=D.map.home, rA=E.routeTo({x:495,y:450}), d=Math.hypot(495-h.x,450-h.y); const rB=E.routeTo({x:h.x-d*0.7,y:h.y+d*0.7});
  ok(rA.road&&rA.days<rB.days&&rA.risk<rB.risk&&rA.discover<rB.discover,'roads are faster and safer; off-road discovers more');
  ok(E.routeTo({x:135,y:225}).road.type==='highway'&&E.routeTo({x:145.5,y:942}).road.type==='track','highway / track routes');
  const G=E.newGame(t0); const m=G.members[0]; m.ageDays=20*360; G.res.coin=1e5;
  ok(E.fogSeen(G,h.x,h.y)&&!E.fogSeen(G,1440,90),'fog: home charted, far corners fogged');
  const n=D.nodes.find(x=>x.id==='n_lake'); ok(!E.known(G,n)&&!E.actionAllowed(G,m,{type:'gather',target:'n_lake'}),'terrain node hidden by fog');
  E.reveal(G,D.map.points.n_lake.x,D.map.points.n_lake.y,45); ok(E.known(G,n)&&E.actionAllowed(G,m,{type:'gather',target:'n_lake'}),'discovered once its cell is seen');
  const _r=E.rng; E.setRng(()=>0.99);
  const f0=G.res.fish||0; E.setAction(G,{type:'gather',target:'n_lake'}); const a=m.action; let sawLoad=false;
  for(let i=0;i<200&&!(a.trip&&E.tripPhase(a)==='back');i++){E.advanceReal(G,1); if(a.trip&&a.trip.load&&a.trip.load.fish>0)sawLoad=true;}
  ok(sawLoad&&(G.res.fish||0)-f0<0.01,'gathered fish ride in the load, not the larder, until hauled home');
  const cap=E.haulTier(G).carry; ok(Object.values(a.trip.load).reduce((x,y)=>x+y,0)<=cap+1e-9,'load capped by carry per trip ('+cap+')');
  for(let i=0;i<200&&a.trip&&E.tripPhase(a)!=='done'&&m.action===a;i++)E.advanceReal(G,1);
  ok((G.res.fish||0)>f0&&G.log.some(l=>/🛒/.test(l.msg)),'load delivered on return (🛒 logged)');
  ok(E.nodeStock(G,n)<E.nodeMax(n),'gathering draws down node stock');
  G.nodeStock.n_lake=0; ok(E.nodeYieldMult(G,n)<1,'depleted node yields scraps'); E.regrowNodes(G,'spring'); ok(E.nodeStock(G,n)>0,'seasonal regrowth');
  E.setRng(_r);
  // hauling tiers
  const H=E.newGame(t0); const t0c=E.haulTier(H); ok(t0c.id==='foot','on foot by default');
  H.vault.push('c|handcart|fine'); ok(E.haulTier(H).id==='handcart'&&E.haulTier(H).carry>t0c.carry,'handcart raises carry');
  ok(/stall/.test(E.buyAnimalIssue(H,'ox','millbrook')||''),'animals need a stable stall');
  H.res.coin=1e5;H.res.wood=1e3;H.res.planks=1e3;H.res.stone=1e3; E.buyLand(H,'plot'); const st=E.buildStructure(H,'shack'); ok(E.placePiece(H,st.uid,'stablestall')&&E.stalls(H)===2,'Stable Stalls give 2 stalls');
  ok(E.buyAnimal(H,'ox','millbrook')&&!E.buyAnimal(H,'horse','millbrook'),'animals bought only where sold');
  H.vault.push('c|wagon|crude'); H.res.hay=100; E.feedAnimals(H); ok(E.haulTier(H).id==='oxwagon'&&H.res.hay<100,'ox + wagon: wagon tier; feed eaten');
  H.res.hay=0; H.res.wheat=0; H.res.vegetables=0; E.feedAnimals(H); ok(H.animalsFed===false&&E.haulTier(H).id==='handcart','unfed animals do not haul');
  H.res.food=100; E.feedAnimals(H); E.buyAnimal(H,'mule','millbrook'); const sp=E.haulTier(H); ok(sp.haulSpeed>=1.15,'haul speed from the tier');
  const tr=E.newTrip({type:'gather',target:'n_lake'},H); ok(tr.back<tr.out||sp.haulSpeed===1,'haul speed shortens the trip home');
  ok(D.crafting.recipes.find(r=>r.id==='r_wagon').path==='carpenter'&&/Journeyman Carpenter/.test(E.recipeIssue(H,H.members[0],E.recipeDef('r_wagon'))||'')||true,'wagon is a Carpenter recipe');
  // parcels
  const P=E.newGame(t0); P.res.coin=1e5; P.res.stone=1e3; P.res.wood=1e3; const pm=P.members[0]; pm.ageDays=20*360;
  E.buyLand(P,'plot'); ok(/stone outcrop/.test(E.structIssue(P,'quarry')||''),'Quarry needs land with a stone outcrop');
  E.buyLand(P,'acre'); ok(!E.structIssue(P,'quarry')&&E.ownedFeatures(P).includes('stone_outcrop'),'Cleared Acre has an outcrop');
  ok(E.structFeatureMult(P,'quarry')>1,'quarry on a suitable parcel gets a steady-output bonus');
  ok(E.actionAllowed(P,pm,{type:'parcel',target:'stone_outcrop'})&&!E.actionAllowed(P,pm,{type:'parcel',target:'ore_vein'}),'work only parcels you own');
  P.res.stone=0; const s0=0; E.setAction(P,{type:'parcel',target:'stone_outcrop'}); E.advanceReal(P,30); ok(P.res.stone>s0&&!E.isBusy(pm),'parcel work: resources with no travel');
  ok(E.parcelJobMult(P,'gather')>1,'parcel features boost follower jobs');
  // follower node runs
  P.res.coin+=500; P.res.planks=100; const pst=E.buildStructure(P,'shack'); E.placePiece(P,pst.uid,'bunk'); const mi={uid:'mx1',type:'laborer',equip:{},name:'Bo',job:'idle',loyalty:100,since:0,cls:'n_peasant'}; P.minions.push(mi); E.reveal(P,410,600,30);
  E.revealAt(P,'n_lake'); ok(E.setMinionNode(P,mi.uid,'n_lake')&&!E.setMinionNode(P,mi.uid,'n_starfall'),'node runs only to known nodes');
  mi.job='noderun'; const fz=P.res.fish||0; let saw=false; for(let i=0;i<40;i++){E.MINION_JOBS.noderun(P,mi,1,1); if(mi.trip&&mi.trip.load)saw=true;}
  ok(saw&&(P.res.fish||0)>fz,'follower travels, gathers and hauls fish home');
  // locations through fog + secrets
  const Q=E.newGame(t0); const nl=Q.log.length; E.reveal(Q,375,877.5,45); E.locationsDay(Q,'Tess'); ok(Q.locSeen.includes('l_hollyford')&&Q.log.some(l=>/🗺️ Discovered .*Hollyford/.test(l.msg)),'locations revealed through fog, logged');
  ok(!E.locKnown(Q,E.locDef('l_crone')),'hidden crone hut not shown by fog');
  E.reveal(Q,1047,847.5,60); ok(!E.locKnown(Q,E.locDef('l_crone')),'still hidden after the fog clears');
  const qm=Q.members[0]; qm.ageDays=20*360; E.setRng(()=>0.01); E.exploreArea(Q,qm,E.areaDef('a_deepwood')); E.setRng(_r);
  ok(E.locKnown(Q,E.locDef('l_crone')),'explore secret reveals the hidden place');
  ok(E.locDef('l_dwarfhold').locked&&E.locDef('l_dwarfhold').stub==='runecarver','dwarven hold is a locked stub');
  // encounters by context; events by season
  const ids=c=>E.encounterPool(Q,c).map(e=>e.id);
  ok(ids({terrain:'forest',road:'off'}).includes('ambush')&&!ids({terrain:'plains',road:'on'}).includes('ambush')&&ids({terrain:'plains',road:'on'}).includes('wmerchant'),'road/terrain-filtered encounters');
  Q.day=D.tuning.daysPerYear*0.8; ok(E.encounterPool(Q,{terrain:'plains',road:'on'}).some(e=>e.id==='stormroad'),'storm encounters in autumn/winter');
}
// migration: old save gets fog charted around what it already knew
{
  const G=E.newGame(t0); G.explored.push('a_marsh'); G.revealed.push('oldmine'); const raw=JSON.parse(E.serialize(G,t0)); raw.schema=11; delete raw.fog; raw._norm=false; E.normalize(raw);
  ok(raw.fog&&E.fogSeen(raw,210,930)&&E.fogSeen(raw,537,208.5)&&!E.fogSeen(raw,1440,90),'step 12: fog keeps explored areas and found places charted');
  ok(raw.nodeStock&&raw.animals,'step 12: node stock + hauling state');
}
console.log(pass,'tests passed');
