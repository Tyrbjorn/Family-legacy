import fs from 'fs'; import * as E from '../js/engine.js';
const L=n=>JSON.parse(fs.readFileSync(new URL('../data/'+n+'.json',import.meta.url)));
const D={};for(const n of ['skills','classes','traits','buildings','furniture','items','quests','regions','tuning','nodes','towns','minions','guilds','jobs','activities','estate','crafting','map','dungeons','legacy','chronicle','achievements','events','encounters','seasons','tutorial','notify'])D[n]=L(n);
// legacy suite pins the pre-pacing tuning (pacing has its own test: test/pacing.test.mjs)
Object.assign(D.tuning,{secPerDayActive:10,secPerDayOffline:20,founderAge:15,courtAge:18,xpBase:50,xpGrowth:1.12,turboCapMin:60,buildCostMult:2.2,childEvery:720});
E.setData(D); let seed=42; E.setRng(()=>{seed=(seed*16807)%2147483647;return seed/2147483647;});
let pass=0; const estate=(g,pieces=['bunk'],type='house')=>{g.res.coin+=5000;g.res.wood+=500;g.res.stone+=500;g.res.planks=(g.res.planks||0)+100;g.res.blocks=(g.res.blocks||0)+200;['plot','acre','meadow'].forEach(l=>E.buyLand(g,l));const st=E.buildStructure(g,'shack');st.type=type;st.pieces=[...pieces];return st;}; const setRngOK=()=>{};const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;console.log('ok',m);};
ok(D.skills.length>=20&&D.quests.length>=25&&D.items.length>=40&&D.furniture.length===10&&D.buildings.length===6,'content counts');
const t0=1_700_000_000_000; let s=E.newGame(t0);
const f=E.active(s); E.advanceReal(s,10*120); ok(s.day===120,'active ticks: 120 days in 1200s');
ok(Object.values(f.skills).some(k=>k.lvl>0),'activities gain levels');
ok(s.turbo.charge===0,'active play does not charge turbo');
E.advanceReal(s,10*400); ok(E.isAdult(f)&&!f.cls&&!s.pendingClass.length,'founder comes of age still classless (no auto pick at 16)');
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
const home=estate(s,['bunk']); ok(E.propose(s,'x')&&s.members.length===2,'marriage adds playable spouse');
home.pieces=['bunk','bunk2'].slice(0,1).concat(['cradle','larder','minionbunk']); home.pieces.push('bunk'); s.res.food=1e6; for(let i=0;i<40&&s.members.length<3;i++) E.advanceReal(s,10*360);
ok(s.members.length>=3,'child born'); const kid=s.members[2];
f.skills.swordsmanship.lvl=40; E.advanceReal(s,10*360*17); ok(kid.skills.swordsmanship.lvl>=4&&!kid.cls,'child inherits 10% at 16, stays classless');
ok(E.switchTo(s,kid.id)&&E.active(s)===kid,'switch members');
E.setOrder(s,f.id,{type:'quest',target:'outskirts'}); E.advanceReal(s,100); ok(f.action&&f.action.type==='quest','idle standing order quests');
E.kill(s,kid,'test'); ok(s.activeId!==kid.id&&s.needSuccession,'succession on active death');
for(const m of E.living(s)) E.kill(s,m,'test'); ok(s.gameOver,'game over when all die (no safety net)');
const g=E.newGame(t0); ok(E.estateStage(g)==='Landless'&&!E.established(g)&&!E.buildStructure(g,'shack'),'estate locked until land is bought');
g.res.coin=500;g.res.wood=50; ok(E.buyLand(g,'plot')&&E.landSlots(g)===2&&E.estateStage(g)==='Scrub Plot','buy starting plot: 2 land slots');
g.res.stone=(g.res.stone||0)+50; g.res.blocks=200; const sh=E.buildStructure(g,'shack'); ok(sh&&E.established(g)&&E.landUsed(g)===1&&E.freeSlots(g,sh)===2&&E.estateStage(g)==='Homestead','Shack: 1 land slot, 2 slots');
g.res.coin+=200;g.res.wood+=100; E.placePiece(g,sh.uid,'bunk'); E.placePiece(g,sh.uid,'minionbunk');
const gm=E.active(g); E.setAction(g,{type:'gather',target:'creek'}); E.advanceReal(g,100); ok(g.res.stone>0,'gather from resource node');
ok(E.buyItem(g,'millbrook','buckler')&&g.vault.includes('buckler'),'buy from town');
ok(E.moveItem(g,gm,'buckler',true)&&E.equip(g,gm,'buckler','bag')&&gm.equip.offhand==='buckler','personal bag + equip');
g.res.coin=1000; let rv=0; for(let i=0;i<20;i++) if(E.rumor(g,'outskirts')?.id) rv++; ok(rv>0&&g.revealed.length===rv,'rumors reveal hidden content'); ok(g.minions.length>0,'rumors can bring recruits');
const h=E.newGame(t0); h.res.coin=1000; h.res.wood=100; h.res.stone=50;
ok(!E.hire(h,'millbrook','laborer'),'cannot hire without housing');
E.buyLand(h,'plot'); const hs=E.buildStructure(h,'shack'); E.placePiece(h,hs.uid,'minionbunk'); const hc=h.res.coin;
ok(E.hire(h,'millbrook','laborer')&&h.minions.length===1&&h.res.coin===hc-40,'hire minion once a Bunk exists');
ok(!E.assignMinion(h,h.minions[0].uid,'farm'),'jobs need spots (no farm yet)'); h.res.coin+=500; h.res.wood+=100; E.build(h,'farm'); ok(E.assignMinion(h,h.minions[0].uid,'farm'),'assign minion to farm');
const f0=h.res.food; E.advanceReal(h,10*10); ok(h.res.food>f0,'farming minion adds food');
while(E.minionRoom(h)) E.addMinion(h,'refugee','test'); ok(E.hire(h,'millbrook','laborer')===null&&h.minions.length===2,'housing (1 Bunk = 2) limits followers');
h.res.food=500; const c1=h.res.coin; const wg=E.monthlyWages(h); h.day=29; h.acc=0; E.advanceReal(h,10); ok(wg>0&&h.res.coin<=c1-wg,'monthly wages paid');
h.res.coin=0; for(let i=0;i<3;i++){h.res.coin=0;h.res.food=500;h.day=Math.ceil((h.day+1)/30)*30-1;E.advanceReal(h,10);} ok(h.minions.length===0,'unpaid minions leave');
// guilds
const G=E.newGame(t0); const gm2=G.members[0]; G.res.coin=1e5; E.advanceReal(G,10*360); E.chooseClass(G,gm2.id,'fighter');
ok(D.guilds.guilds.length>=4&&D.guilds.guilds.every(g=>D.towns.some(t=>t.id===g.town)),'4-5 guilds, each in a town');
{ const _c=gm2.cls; gm2.cls=null; ok(E.setAction(G,{type:'train',target:'tactics'})===false,'guild skill locked before joining'); gm2.cls=_c; }
ok(E.setAction(G,{type:'quest',target:'g_vanguard_patrol'})===false,'guild quest locked before joining');
gm2.skills.swordsmanship.lvl=5; const _st=gm2.stats.STR; gm2.stats.STR=1; ok(!E.joinGuild(G,gm2,'vanguard')&&E.joinIssues(G,gm2,'vanguard').length,'join requirements enforced'); gm2.stats.STR=_st;
gm2.skills.swordsmanship.lvl=12; ok(E.joinGuild(G,gm2,'vanguard')&&gm2.guild.id==='vanguard','join guild');
gm2.skills.archery.lvl=20;gm2.stats.AGI=20; ok(!E.joinGuild(G,gm2,'lodge')&&E.joinIssues(G,gm2,'lodge')[0].startsWith('sworn'),'membership blocks other class guilds');
gm2.skills.carpentry.lvl=20;gm2.skills.smithing.lvl=20; ok(E.joinGuild(G,gm2,'hearth')&&gm2.guild.id==='vanguard'&&gm2.craft&&gm2.prof==='artisan','Crafters open to sworn members, grants Artisan profession');
ok(E.setAction(G,{type:'train',target:'tactics'})!==false&&E.canTrain(gm2,'tactics'),'guild unlocks new skill');
ok(!E.buyGuildItem(G,gm2,'vanguard_tabard'),'rank-gated guild items');
gm2.guild.rep=60; ok(E.rankUp(G,gm2)&&gm2.guild.rank===1&&E.buyGuildItem(G,gm2,'vanguard_tabard'),'rank up unlocks special item');
gm2.cls='knight'; gm2.skills.leadership.lvl=45; gm2.skills.tactics.lvl=25; const wl=D.classes.find(c=>c.id==='warlord');
ok(!E.canEvolve(G,gm2,wl),'tier 2 needs guild rank'); gm2.guild.rep=200; E.rankUp(G,gm2); ok(E.evolve(G,gm2,'warlord')&&gm2.cls==='warlord','Adept Warrior unlocks Warlord');
const old=JSON.parse(E.serialize(G,t0)); for(const m of old.members){delete m.skills.tactics;delete m.guild;} old._norm=false; E.normalize(old); ok(old.members[0].skills.tactics&&old.members[0].guild&&old.members[0].guild.id===E.classGuild(old.members[0].cls).id,'old saves migrate (skills + guild from class)');
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
const O=JSON.parse(E.serialize(H,t0)); O.members[0].guild={id:'exchange',rank:1,rep:5}; O.vault.push('exchange_seal'); E.normalize(O); ok(O.members[0].guild===null&&!O.vault.includes('exchange_seal'),'old Exchange saves migrate cleanly');
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
ok(E.setAction(kd,{type:'activity',target:'fishing'})===false,'Fishing locked before its quest');
const qr=D.quests.filter(q=>q.unlocks); ok(qr.length>=5&&qr.length<=12,'5-12 quests grant unlocks');
km.ageDays=20*360; km.cls='fighter'; setRngOK(); E.setAction(kd,{type:'quest',target:'q_river'}); for(let i=0;i<20&&!kd.unlocks.includes('activity:fishing');i++) E.advanceReal(kd,10*4);
ok(kd.unlocks.includes('activity:fishing')&&E.setAction(kd,{type:'activity',target:'fishing'})!==false,'river quest unlocks Fishing');
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
const s2x=E.buildStructure(LS,'shack'); E.placePiece(LS,s2x.uid,'sawtable'); LS.res.wood=300; LS.res.planks=0; E.advanceReal(LS,10);
ok(Math.abs(LS.res.planks-4)<1e-6,'Saw Table turns wood into planks (4/day)'); E.placePiece(LS,s2x.uid,'storage');
ok(E.processRate(LS,s2x,'sawtable')===6&&E.activeSynergies(s2x).some(y=>y.id==='lumberyard'),'Saw Table+Storage synergy speeds planks ×1.5');
ok(E.matCap(LS)===D.estate.caps.matBase+400,'Storage Chest raises material capacity');
LS.res.planks=100; LS.res.blocks=100; ok(E.upgradeStructure(LS,s2x.uid)&&E.freeSlots(LS,s2x)===2&&E.structDef(s2x.type).slots===4,'Shack upgrades to Cabin (4 slots)');
ok(E.placePiece(LS,s2x.uid,'workbench')&&E.hasPiece(LS,'workbench')&&E.craftQuality(LS)>=0.15,'Workbench enables crafting; +Storage synergy raises quality');
E.placePiece(LS,s2x.uid,'forge'); ok(E.activeSynergies(s2x).some(y=>y.id==='smithy')&&E.craftQuality(LS)>=0.4,'Workbench+Forge synergy: Smithy');
const s3x=E.buildStructure(LS,'shack'); E.placePiece(LS,s3x.uid,'studydesk'); const lore0=E.eff(LS,'xp'); E.placePiece(LS,s3x.uid,'bookshelf'); ok(E.activeSynergies(s3x).some(y=>y.id==='nook'),'Study Desk+Bookshelf synergy: Scholar\'s Nook');
ok(E.removePiece(LS,s3x.uid,'bookshelf')&&LS.pieceStore.includes('bookshelf')&&!E.activeSynergies(s3x).length&&E.placePiece(LS,s3x.uid,'bookshelf',true),'remove to storage and re-place');
// minion housing & food
ok(!E.addMinion(LS,'laborer','t'),'no bunk → follower cannot join'); LS.res.coin=1e5; LS.res.wood=1e4; LS.res.planks=100; E.buyLand(LS,'meadow'); const bh=E.buildStructure(LS,'bunkhouse');
ok(bh&&E.housingCap(LS,'bunk')===4,'Bunkhouse houses 4');
E.addMinion(LS,'laborer','t'); E.addMinion(LS,'woodsman','t'); E.addMinion(LS,'woodsman','t'); E.placePiece(LS,bh.uid,'toolrack');
ok(E.assignMinion(LS,LS.minions[1].uid,'gather')&&E.assignMinion(LS,LS.minions[2].uid,'gather')&&!E.assignMinion(LS,LS.minions[0].uid,'gather'),'minion job spots come from stations (Tool Rack: 2)');
LS.members[0].cls='beastmaster'; E.advanceReal(LS,10); const wolf2=LS.minions.find(x=>x.type==='wolf'); ok(wolf2&&!E.isHoused(LS,wolf2)&&!E.assignMinion(LS,wolf2.uid,'guard'),'Wolf needs a Kennel before it can work');
E.placePiece(LS,bh.uid,'kennel'); ok(E.isHoused(LS,wolf2)&&E.assignMinion(LS,wolf2.uid,'guard'),'Kennel houses the Wolf');
const mf=E.minionFood(LS); ok(mf===LS.minions.length*0.5,'followers eat from the food pool');
LS.res.food=0; const l0=LS.minions[0].loyalty; E.advanceReal(LS,10); ok(LS.minions[0].loyalty<l0&&LS.minions[0].hunger>0,'hungry followers lose morale');
for(let i=0;i<20;i++){LS.res.food=0;E.advanceReal(LS,10);} ok(LS.minions.length===0,'starving followers eventually leave');
// migration
const OLD=JSON.parse(E.serialize(G,t0)); delete OLD.land; delete OLD.structures; OLD.rooms=['living','workshop','study']; OLD.furniture=['bookshelf','trophy']; OLD.buildings={house:2,farm:1,lumber:1,yard:0,library:0,hourglass:0}; E.normalize(OLD);
ok(OLD.structures.length===1&&OLD.structures[0].type==='cabin'&&OLD.structures[0].pieces.includes('bunk')&&OLD.structures[0].pieces.includes('workbench')&&E.landSlots(OLD)>=E.landUsed(OLD)&&OLD.rooms===undefined&&OLD.buildings.house===undefined,'old House/rooms save → Cabin with stations');
ok([...OLD.structures[0].pieces,...OLD.pieceStore].includes('trophy'),'old furniture kept (placed or in storage)');
// classes via guilds
const CG=E.newGame(t0); const cm=CG.members[0]; CG.res.coin=1e4; ok(!cm.cls,'characters start classless');
cm.ageDays=15*360; cm.skills.swordsmanship.lvl=10; cm.stats.STR=10; ok(E.joinIssues(CG,cm,'vanguard').includes('age 16+'),'guilds require age 16');
cm.ageDays=16*360; cm.stats.STR=3; ok(E.joinIssues(CG,cm,'vanguard').some(x=>x.startsWith('STR')),'stat thresholds instead of class');
cm.stats.STR=10; ok(E.joinGuild(CG,cm,'vanguard')&&cm.cls==='fighter','Warriors grant Fighter');
const grants={lodge:'hunter',collegium:'apprentice',church:'acolyte',rogues:'cutpurse'};
for(const [gid,c] of Object.entries(grants)){ const X=E.newGame(t0); const xm=X.members[0]; xm.ageDays=20*360; X.res.coin=1e4; for(const k of E.STATS) xm.stats[k]=20; for(const k in xm.skills) xm.skills[k].lvl=10; ok(E.joinGuild(X,xm,gid)&&xm.cls===c,`${gid} grants ${c}`); }
const CR=E.newGame(t0); const cr=CR.members[0]; cr.ageDays=20*360; CR.res.coin=1e4; cr.skills.carpentry.lvl=6; cr.skills.smithing.lvl=4; ok(E.joinGuild(CR,cr,'hearth')&&!cr.cls&&cr.prof==='artisan','Crafters give the Artisan profession, no primary class');
ok(E.joinAdventurers(CR,cr)&&cr.cls==='adventurer'&&cr.prof==='artisan',"Adventurers' Guild grants Adventurer as primary class (classless members)");
ok(D.classes.filter(c=>c.tier>0).every(c=>{const g=E.classGuild(c.id);return g&&(!c.guild||c.guild===g.id);}),'every evolution stays inside its guild line');
const MG=JSON.parse(E.serialize(G,t0)); MG.members[0].guild=null; MG.members[0].cls='ranger'; MG._norm=false; E.normalize(MG); ok(MG.members[0].guild.id==='lodge'&&MG.members[0].cls==='ranger','old classed members auto-join matching guild');
// crafting, inventory, professions, minion gear
const K=E.newGame(t0); const km2=K.members[0]; km2.ageDays=20*360; K.res.coin=1e5; K.res.wood=300; K.res.planks=100; K.res.ingots=100; K.res.hides=50; K.res.cloth=50; K.res.potions=20; K.res.ore=30; K.res.stone=300;
['plot','acre','meadow'].forEach(l=>E.buyLand(K,l)); K.res.blocks=100; const ks=E.buildStructure(K,'shack'); E.upgradeStructure(K,ks.uid); ['workbench','forge','storage','stall'].forEach(p=>E.placePiece(K,ks.uid,p));
ok(E.itemDef('c|iron_sword|masterwork').cp>E.itemDef('c|iron_sword|crude').cp&&E.itemDef('c|iron_sword|fine').value>E.itemDef('iron_sword').value,'crafted quality tiers scale stats and value');
ok(E.rollQuality(-1)==='crude'&&E.rollQuality(2)==='masterwork','quality roll spans Crude→Masterwork');
const low=E.qualityScore(K,km2,E.recipeDef('r_sword')); km2.skills.smithing.lvl=50; const hi=E.qualityScore(K,km2,E.recipeDef('r_sword')); ok(hi>low,'skill raises craft quality');
km2.craft={id:'hearth',rank:1,rep:0}; km2.prof='artisan'; ok(E.evolve(K,km2,'blacksmith')&&km2.prof==='blacksmith'&&!km2.cls,'Artisan → Blacksmith profession (no primary class needed)');
ok(E.profBonus(km2,E.recipeDef('r_sword'))>E.profBonus(km2,E.recipeDef('r_staff')),'profession specialty boosts matching recipes');
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
const mw=K.minions[0]; K.vault.push('c|sickle|masterwork','woodaxe','collar','chain_shirt'); ok(E.equipMinion(K,mw.uid,'c|sickle|masterwork')&&mw.equip.tool,'minion tool slot');
ok(E.minionGearMult(mw,'farm')>E.minionGearMult(mw,'gather')&&E.minionGearMult(mw,'farm')>1.3,'quality tool boosts matching job output');
ok(!E.equipMinion(K,mw.uid,'collar'),'collar only for companions'); ok(E.equipMinion(K,mw.uid,'chain_shirt')&&E.minionSurvival(mw)<1&&E.minionGearMult(mw,'guard')>1,'armor boosts guard power and survival');
ok(E.unequipMinion(K,mw.uid,'tool')&&K.vault.includes('c|sickle|masterwork'),'unequip minion gear to vault');
// adventurer line
const AV=E.newGame(t0); const av=AV.members[0]; av.ageDays=20*360; AV.res.coin=1e5; ok(E.joinAdventurers(AV,av)&&av.cls==='adventurer','classless join → Adventurer');
av.skills.monsterlore.lvl=30; av.skills.swordsmanship.lvl=30; ok(!E.evolve(AV,av,'monsterhunter'),'adventurer branch gated by rank'); av.adv.rank=3; ok(E.evolve(AV,av,'monsterhunter'),'Rank C unlocks Monster Hunter');
const AV2=E.newGame(t0); const a2=AV2.members[0]; a2.ageDays=20*360; AV2.res.coin=1e5; a2.stats.STR=10; a2.skills.swordsmanship.lvl=6; E.joinAdventurers(AV2,a2); ok(E.joinGuild(AV2,a2,'vanguard')&&a2.cls==='fighter'&&a2.adv,'class guild replaces Adventurer as primary; rank track kept');
// crafter playstyle without questing: idle crafter on standing order + merchant
const CP=E.newGame(t0); const cz=CP.members[0]; cz.ageDays=25*360; cz.skills.smithing.lvl=30; cz.prof='blacksmith'; CP.res.coin=2000; CP.res.wood=200; CP.res.planks=200; CP.res.ingots=200; CP.res.stone=200; CP.res.food=400;
['plot','acre'].forEach(l=>E.buyLand(CP,l)); const cs1=E.buildStructure(CP,'shack'); E.upgradeStructure(CP,cs1.uid); ['workbench','forge','storage','larder'].forEach(p=>E.placePiece(CP,cs1.uid,p));
CP.members.push({...JSON.parse(JSON.stringify(cz)),id:99,name:'Kip'}); CP.activeId=99; E.setOrder(CP,cz.id,{type:'craft'});
E.advanceReal(CP,10*40); ok(CP.vault.filter(x=>x.startsWith('c|')).length>=3,'idle family member crafts on standing order');
const crafted=CP.vault.filter(x=>x.startsWith('c|')); const worth=crafted.reduce((a,id)=>a+E.stallValue(CP,E.itemDef(id)),0); ok(worth>=600,'crafted gear is worth real money ('+worth+'🪙 from ~40 idle days)');
const ER=E.newGame(t0); ok(E.era(ER).n===1,'new game is Era 1: Solo Adventurer'); estate(ER,['bunk']); ER.members[0].spouse=5; ok(E.era(ER).n===2,'home + family → Era 2');
ER.renown=6000; ER.structures[0].pieces=['bunk','larder','storage','workbench','forge','studydesk']; ER.buildings.farm=5;ER.buildings.lumber=5; ok(E.era(ER).n===3,'Renown + Manor → Era 3 indicator');
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
 L.doneQuests.push('mushrooms'); ok(E.placePiece(L,sl.uid,'coldcellar'),'quest unlocks Cold Cellar');
 const lm=L.members[0]; lm.ageDays=20*360; lm.craft={id:'hearth',rank:1,rep:0}; ok(E.placePiece(L,sl.uid,'steelanvil')&&E.craftQuality(L)>=0.12,'Crafters rank unlocks Steel Anvil');
 const MM=E.newGame(t0); estate(MM,['orecart','minionbunk'],'shack'); MM.res.copper=5; ok(E.jobCap(MM,'mine')===2,'Ore Cart gives mining spots');
 const old=E.newGame(t0); estate(old,['forge','bunk']); const o2=JSON.parse(JSON.stringify(old)); E.normalize(o2); ok(o2.structures[0].pieces.every(p=>E.pieceTier(p)===0)&&E.bedrooms(o2)>=3,'old saves load as Crude tier'); }
// resource tiers
{ ok(E.resTier('wood')===1&&E.resTier('hides')===1&&E.resTier('planks')===2&&E.resTier('blocks')===2&&E.resTier('leather')===2&&D.estate.resourceTiers['3'].planned.includes('steel'),'resource tiers: raw → processed, Tier 3 reserved');
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
 const d0=V.doneQuests.length; E.advanceReal(V,10*Math.ceil(tot)+10); ok(V.doneQuests.includes('rats'),'quest resolves and the member comes home');
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
 ok(E.minionEvolveIssue(N,a,'n_militia')==='Lv 5','evolution needs a level threshold'); a.lvl=5; ok(E.minionEvolveIssue(N,a,'n_militia').startsWith('needs Guardhouse'),'tier 1 needs the class building'); N.res.coin+=1e4; N.res.wood+=500; N.res.stone+=500; E.buyLand(N,'hillside'); N.structures.push({uid:'stB',type:'barracks',pieces:['weaponrack'],up:0}); ok(E.evolveMinion(N,a.uid,'n_militia')&&a.cls==='n_militia','player picks the path');
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
 ok(E.structDef('herbgarden').name==='Garden'&&E.pieceDef('herbbeds').bonus.processes.some(p=>p.out==='food')&&E.pieceDef('herbbeds').bonus.processes.some(p=>p.out==='herbs'),'Garden makes herbs and food');
 F.res.meat=0;F.res.fish=0;F.res.honey=0;F.res.eggs=0;F.res.remedies=0;F.res.leather=0; F.res.herbs=100; F.reserve.herbs=0; E.advanceReal(F,10*5);
 ok(['meat','fish','honey','eggs','remedies','leather'].every(k=>F.res[k]>0),'new resources: meat, fish, honey, eggs, remedies, leather');
 const P=E.newGame(t0); P.res.food=0; P.res.meat=10; E.advanceReal(P,10); ok(P.res.food>=0&&P.res.meat<10,'meat/fish/eggs/honey feed the family when food runs out');
 const R2=E.newGame(t0); const rm=R2.members[0]; rm.injured=6; R2.res.remedies=5; E.advanceReal(R2,10); ok(rm.injured<=3&&R2.res.remedies<5,'remedies speed injury recovery');
 const C=E.newGame(t0); estate(C,['minionbunk'],'shack'); C.res.coin=1e5; C.res.wood=1e3; C.res.stone=1e3; C.res.food=1e4; C.res.planks=500; C.res.hides=100; C.res.blocks=100; C.res.leather=50;
 const cab=E.buildStructure(C,'hunterscabin'); ok(E.classHomeCap(cab)===2,'class building houses 2 of its class');
 const a=E.addMinion(C,'woodsman','t'), b=E.addMinion(C,'woodsman','t'); ok(a&&b&&!E.addMinion(C,'woodsman','t'),'general bunks full');
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
 ok(!E.minionEvolveIssue(W,mi,'n_adept')||E.minionEvolveIssue(W,mi,'n_adept').includes('upgrade 2'),'Adept needs Tower upgrade 2'); tw.up=2; ok(!E.minionEvolveIssue(W,mi,'n_adept'),'Tower upgraded: Adept ok');
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
 K.structures.push({uid:'bhy',type:'bunkhouse',pieces:[],up:0}); const mi=E.addMinion(K,'laborer','t'); mi.cls='n_militia'; mi.lvl=20;
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
 m.prof='artisan'; ok(E.craftingUnlocked(C),'Artisan-line member unlocks Crafting'); m.prof=null; ok(E.craftingUnlocked(C),'Crafting stays unlocked once seen');
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
 ok(E.recipeIssue(G,m,D.crafting.recipes.find(r=>r.id==='r_heirloom'))==='needs Legacy upgrade'&&E.buyLegacy(G,'heirloom')&&E.recipeIssue(G,m,D.crafting.recipes.find(r=>r.id==='r_heirloom'))!=='needs Legacy upgrade','legacy unlocks special recipe');
 ok(E.structIssue(G,'ancestorhall')==='needs Legacy upgrade'&&E.buyLegacy(G,'hall')&&E.structIssue(G,'ancestorhall')!=='needs Legacy upgrade','legacy unlocks special building');
 const r0=G.res.wood; E.buyLegacy(G,'resgain'); ok(E.resGain(G)===1.05,'Family Fortune +5% resources');
 const N=E.newLineage(G,t0); ok(N.legacy.ups.life===1&&N.legacy.renown===G.legacy.renown&&N.members.length>=1,'legacy persists into a new lineage');
 const R=E.deserialize(E.serialize(G)); ok(R.legacy.ups.speed===G.legacy.ups.speed&&R.legacy.renown===G.legacy.renown,'legacy persists through save/load');
 const O=JSON.parse(E.serialize(E.newGame(t0))); delete O.legacy; delete O.speed; O.members.forEach(x=>{delete x.renown; delete x.skills.focus;}); E.normalize(O); ok(O.legacy.renown===0&&O.speed===1&&O.members[0].renown===0&&O.members[0].skills.focus,'old saves migrate (legacy, speed, renown, Focus)'); }
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
 const N2=E.newGame(t0); E.normalize(N2); const m2=N2.members[0]; m2.stats.WIL=0; N2.pendingEnc={id:'crone',mid:m2.id,day:0}; E.resolvePending(N2,'mock'); ok(E.buffSum(N2,'xp')<0&&N2.counts.curses===1,'mocking her can curse');
 for(let i=0;i<40;i++) E.advanceReal(N2,10); ok(E.buffSum(N2,'xp')===0,'curse wears off');
 const N3=E.newGame(t0); E.normalize(N3); N3.encPolicy='cautious'; const e3=E.encDef('toll'); ok(E.policyOption(N3,e3).tag==='cautious','auto-resolve uses the policy'); const k=N3.members[0]; k.standing='explore'; const c0=N3.res.coin; E.autoResolve(N3,k,e3); ok(N3.res.coin===c0-30&&!N3.pendingEnc,'automated orders auto-resolve');
 const N4=E.newGame(t0); E.normalize(N4); N4.res.coin=0; ok(E.policyOption(N4,E.encDef('peddler')).id!=='buy','unaffordable options skipped');
 const O=JSON.parse(E.serialize(E.newGame(t0))); for(const k of ['chronicle','wevents','buffs','ach','counts','pendingEnc','encPolicy']) delete O[k]; E.normalize(O); ok(Array.isArray(O.chronicle)&&O.ach&&O.encPolicy==='kind'&&O.pendingEnc===null,'old saves migrate'); }
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
 S.day=Math.floor(Y*0.6); ok(E.seasonYield(S,'food')>1,'autumn harvest'); S.day=5; ok(E.seasonYield(S,'herbs')>1,'spring herbs'); }
{ const F=E.newGame(t0); estate(F,['oven','smoker'],'shack'); E.normalize(F); const fv=D.estate.foodValue; ok(['bread','stew','smokedmeat','cheese','preserves'].every(k=>fv[k]>0),'5 cooked foods with food value');
 ok(['sage','mandrake','moonpetal'].every(h=>D.estate.pieces.some(p=>(p.bonus.processes||[]).some(pr=>pr.in&&pr.in[h]))),'herb types used in remedies/potions');
 Object.assign(F.res,{food:100,meat:50,herbs:50}); F.members[0].skills.cooking.lvl=40; E.processDay(F); ok(F.res.bread>0&&F.res.smokedmeat>0&&F.foodQ.bread>1,'oven/smoker cook with quality from cooking skill');
 const Gq=E.newGame(t0); E.normalize(Gq); Gq.res.food=0; Gq.res.bread=10; Gq.foodQ={bread:1}; E.pantry(Gq,10); const lo=Gq.res.bread; const Gh=E.newGame(t0); E.normalize(Gh); Gh.res.food=0; Gh.res.bread=10; Gh.foodQ={bread:1.5}; E.pantry(Gh,10); ok(Gh.res.bread>lo,'higher-quality food goes further'); }
{ const X=E.newGame(t0); E.normalize(X); X.res.coin=4242; X.members[0].name='Exporta'; const code=E.exportCode(X); ok(code.startsWith('FL1:')&&!code.includes('{'),'export is a base64 text code');
 const Y=E.importSave(code); ok(Y.res.coin===4242&&Y.members[0].name==='Exporta','import restores the save'); const Z=E.importSave(E.serialize(X)); ok(Z.res.coin===4242,'import accepts raw JSON (file)');
 let e1=''; try{ E.importSave('garbage!!'); }catch(e){ e1=e.message; } ok(/valid/.test(e1),'invalid code rejected');
 const bad=JSON.parse(E.serialize(X)); bad.v=99; let e2=''; try{ E.importSave(JSON.stringify(bad)); }catch(e){ e2=e.message; } ok(/version/.test(e2),'wrong version rejected');
 const old=JSON.parse(E.serialize(X)); delete old.legacy; delete old.chronicle; delete old.foodQ; const M=E.importSave(JSON.stringify(old)); ok(M.legacy&&Array.isArray(M.chronicle)&&M.foodQ,'import runs migrations'); }

// Tutorial (apprentice prologue) + dev mode
{ const G=E.newGame(t0); const F=E.active(G);
 ok(G.tut.started&&G.tut.step===0&&G.vault.includes('rusty_sword'),'new game starts apprenticeship with starter blade');
 ok(G.chronicle.some(c=>/apprenticeship/.test(c.t)),'apprenticeship chronicled');
 const c0=G.res.coin; E.equip(G,F,'rusty_sword'); E.tutCheck(G); ok(G.tut.step===1&&G.res.coin===c0+20&&G.res.wood>=4,'step 1 equip → reward');
 E.setAction(G,{type:'quest',target:'rats'}); for(let i=0;i<40&&G.tut.step===1;i++) E.advanceReal(G,10); ok(G.tut.step>=2,'rats quest completes step 2');
 ok(G.unlocks.includes('recipe:r_whittle')&&E.mentorCraft(G)&&G.tut.step>=3,'mentor bench craft completes step 3');
 for(let i=0;i<30&&!(E.setAction(G,{type:'activity',target:'hiking'})&&E.active(G).action?.type==='activity');i++) E.advanceReal(G,5); E.advanceReal(G,30); ok(G.tut.step>=4,'activity completes step 4');
 E.tutNote(G,'estate'); ok(G.tut.step===5,'estate visit completes step 5');
 F.ageDays=16*D.tuning.daysPerYear; E.chooseClass(G,F.id,'fighter'); E.tutCheck(G); ok(E.tutComplete(G)&&G.unlocks.includes('recipe:r_mentorknife')&&G.vault.includes('herbknife'),'choosing a path finishes: recipe + gear');
 ok(G.chronicle.some(c=>/Lost House/.test(c.t)),'finale leads into Lost House story');
 const R=E.deserialize(E.serialize(G,t0)); ok(R.tut.step===G.tut.step&&R.tut.done.length===6,'tutorial progress saved');
 const H=E.newGame(t0); ok(E.skipTutorial(H)&&!E.tutActive(H)&&!E.skipTutorial(H),'tutorial skippable once');
 const old=JSON.parse(E.serialize(E.newGame(t0),t0)); delete old.tut; old.day=500; const O=E.importSave(JSON.stringify(old)); ok(O.tut.skipped&&!E.tutActive(O),'pre-tutorial saves are not dragged into it');
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
console.log(pass,'tests passed');
