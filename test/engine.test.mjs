import fs from 'fs'; import * as E from '../js/engine.js';
const L=n=>JSON.parse(fs.readFileSync(new URL('../data/'+n+'.json',import.meta.url)));
const D={};for(const n of ['skills','classes','traits','buildings','furniture','items','quests','regions','tuning','nodes','towns','minions','guilds','jobs','activities','estate','crafting','map','dungeons'])D[n]=L(n);
E.setData(D); let seed=42; E.setRng(()=>{seed=(seed*16807)%2147483647;return seed/2147483647;});
let pass=0; const estate=(g,pieces=['bunk'],type='house')=>{g.res.coin+=5000;g.res.wood+=500;g.res.stone+=500;g.res.planks=(g.res.planks||0)+100;g.res.blocks=(g.res.blocks||0)+200;['plot','acre','meadow'].forEach(l=>E.buyLand(g,l));const st=E.buildStructure(g,'shack');st.type=type;st.pieces=[...pieces];return st;}; const setRngOK=()=>{};const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;console.log('ok',m);};
ok(D.skills.length>=20&&D.quests.length>=25&&D.items.length>=40&&D.furniture.length===10&&D.buildings.length===6,'content counts');
const t0=1_700_000_000_000; let s=E.newGame(t0);
const f=E.active(s); E.advanceReal(s,10*120); ok(s.day===120,'active ticks: 120 days in 1200s');
ok(f.skills.swordsmanship.lvl>0,'training gains levels ('+f.skills.swordsmanship.lvl+')');
ok(s.turbo.charge===0,'active play does not charge turbo');
E.advanceReal(s,10*400); ok(E.isAdult(f)&&!f.cls&&!s.pendingClass.length,'founder comes of age still classless (no auto pick at 16)');
E.chooseClass(s,f.id,'fighter'); E.setAction(s,{type:'quest',target:'rats'}); const c0=s.res.coin; E.advanceReal(s,10*30); ok(s.res.coin>c0,'quests pay coin');
// offline 14h
const str=E.serialize(s,t0); const s2=E.deserialize(str); const d0=s2.day; const rep=E.applyOffline(s2,t0+14*3600e3);
ok(rep.days===Math.floor(8*3600/20)&&s2.day-d0===rep.days,'offline capped at 8h → '+rep.days+' days');
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
ok(E.setAction(G,{type:'train',target:'tactics'})===false,'guild skill locked before joining');
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
ok(E.joinAdventurers(G2,am)&&E.joinGuild(G2,am,'lodge'),'joining Adventurers does not block other guilds');
ok(!E.questOk(am,D.quests.find(q=>q.id==='b_boars')),'bounties locked at rank F');
am.adv.rep=30; ok(E.advRankUp(G2,am)&&E.hasService(G2,'questBoard')&&E.questOk(am,D.quests.find(q=>q.id==='b_boars')),'rank E unlocks quest board + bounty');
const sv0=E.sellValue(G2,D.items[0]); am.adv.rep=1e4; while(E.advRankUp(G2,am)); ok(am.adv.rank===6&&E.services(G2).length===4&&E.sellValue(G2,D.items[0])===Math.round(D.items[0].value*0.8)&&sv0<D.items[0].value,'rank S, all services (appraisal doubles sale)');
ok(E.buyAdvItem(G2,am,'adv_blade'),'rank-gated adventurer items');
// guild roster rework
const ids=D.guilds.guilds.map(g=>g.id).sort().join(); ok(ids==='church,collegium,hearth,lodge,rogues,vanguard','six guilds: Warriors/Rangers/Magic/Healers/Rogues/Crafters');
ok(D.guilds.guilds.every(g=>D.skills.some(k=>k.guild===g.id)&&D.quests.some(q=>q.guild===g.id)&&D.items.some(i=>i.guild===g.id)),'every guild has skill, quest and items');
ok(D.classes.filter(c=>c.tier===2).every(c=>(c.guild&&D.guilds.guilds.some(g=>g.id===c.guild))||c.advRank!=null||c.crafterRank!=null),'every tier 2 class gated by guild, adventurer or crafter rank');
ok(D.classes.find(c=>c.id==='paladin').guild==='church'&&D.classes.find(c=>c.id==='assassin').guild==='rogues','Paladin→Healers, Assassin→Rogues');
const H=E.newGame(t0); const hm=H.members[0]; hm.ageDays=20*360; hm.cls='fighter'; hm.skills.healing.lvl=10; hm.skills.etiquette.lvl=5; H.res.coin=1e5;
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
km.ageDays=12*360; ok(E.setAction(kd,{type:'train',target:'swordsmanship'})!==false&&E.setAction(kd,{type:'train',target:'fire'})===false,'teens train; magic waits till 14');
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
const grants={lodge:'scout',collegium:'apprentice',church:'acolyte',rogues:'cutpurse'};
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
ER.members[0].ageDays=20*360; ok(E.actionAllowed(ER,ER.members[0],{type:'quest',target:'rats'})&&E.setAction(ER,{type:'job',target:'shop'})!==false&&E.setAction(ER,{type:'train',target:'archery'})!==false&&E.setAction(ER,{type:'quest',target:'rats'})!==false,'later eras keep questing, jobs and training open');
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
 const O=E.newGame(t0); const om=O.members[0]; om.ageDays=20*360; for(const k in om.skills) om.skills[k].lvl=10; E.setAction(O,{type:'quest',target:'rats'}); E.applyOffline(O,O.lastSave+3*3600*1000); ok(O.doneQuests.includes('rats'),'travel completes during offline progress');
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
 ok(E.evolveOptions(a).map(c=>c.branch).sort().join()==='divine,economic,magic,military','Peasant branches into Military/Economic/Magic/Divine');
 ok(E.minionEvolveIssue(N,a,'n_militia')==='Lv 5','evolution needs a level threshold'); a.lvl=5; ok(E.evolveMinion(N,a.uid,'n_militia')&&a.cls==='n_militia','player picks the path');
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
console.log(pass,'tests passed');
