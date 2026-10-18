// R48 (fl-stub-regions-proposal round 1): Gull's Landing port town (market, 3 villagers, 6 coast jobs, Act 1 beat
// "Lights on the Rocks"), Salted Fish + Rope, the Dock → Slipway → Sea Boat, the harbour ferry, coast hauls, deep sea,
// and data/families.json (6 old houses enriched + Corwen, Dawnward, Ormond, Sallow; temperaments, perks, threads), save step 44.
import fs from "fs"; import * as E from "../js/engine.js"; import { BUILD } from "../js/config.js";
const R=new URL("../data/",import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const Y=D.tuning.daysPerYear, G=D.map.towns.gullport;
const base=()=>{const s=E.newGame(1);E.normalize(s);E.skipTutorial&&E.skipTutorial(s);const m=s.members[0];m.ageDays=25*Y;s.res.coin=1e5;for(const k of ['wood','stone','planks','blocks','ingots','cloth','flax','fish','salt','ale','rope'])s.res[k]=1e3;return s;};
const findGull=s=>{E.reveal(s,G.x,G.y,60);E.locationsDay(s);};
// ---- build + save
ok(BUILD==='R48'&&E.SCHEMA===44,'R48, save step 44');
// ---- families.json
const F=D.families, H=F.list, ids=H.map(h=>h.id);
ok(!D.marriage.houses&&F.status&&F.tiers&&F.war&&F.feud,'house rules moved to families.json; marriage.json keeps only marriage rules');
ok(['ashbrook','tallow','vey','marlowe','corran','skye'].every(id=>ids.includes(id))&&['corwen','dawnward','ormond','sallow'].every(id=>ids.includes(id))&&H.length===10,'the 6 old houses keep their ids; R48 adds Corwen, Dawnward, Ormond, Sallow (10)');
ok(!ids.includes('vael')&&F.player.id==='vael'&&!ids.some(id=>['gilmane','crane','brokka'].includes(id)),"House Vael is the player's house (not a rival); Gilmane/Crane/Brokka wait for later rounds");
ok(H.filter(h=>h.major).map(h=>h.id).sort().join()==='ashbrook,corwen,marlowe,skye,vey'&&H.every(h=>D.towns.some(t=>t.id===h.seat)),'major house per town (Millbrook, Thornwick, Ashford, Eyrie, Gull\'s Landing); every seat is a town');
ok(H.every(h=>h.goal&&F.temperaments[h.temperament]&&h.thread&&h.thread.quests.length===3&&h.thread.quests.every(q=>E.findId(D.quests,q)&&D.map.points[q])&&h.perks&&h.perks.friendly&&h.marriage!==undefined),'every house: goal, temperament, a 3-quest thread on the map, a Friendly perk, marriage flag');
ok(H.filter(h=>h.major).every(h=>h.perks.allied&&h.perks.allied.length),'major houses also have an Allied perk');
ok(['honest','scheming','pious','ruthless','idealistic','proud','secretive'].every(t=>F.temperaments[t]&&F.temperaments[t].text),'7 temperaments with rules');
ok(E.houseDef('sallow').rival==='corran'&&E.houseDef('corran').rival==='sallow','Sallow ⇄ Corran sworn rivals');
ok(H.every(h=>D.quests.some(q=>q.needsFeud&&q.against===h.id)),'every house has a feud raid quest');
// temperament scaling
{ const s=base(); E.addRapport(s,'ashbrook',10,'t','quest'); ok(Math.abs(E.rapport(s,'ashbrook')-12)<1e-9,'honest: gains ×1.2');
  E.addRapport(s,'skye',10,'t','quest'); ok(Math.abs(E.rapport(s,'skye')-6)<1e-9,'proud: slow to warm (×0.6)');
  E.addRapport(s,'skye',-10,'t','event'); ok(Math.abs(E.rapport(s,'skye')-(6-15))<1e-9,'proud: quick to take offence (×1.5)');
  E.addRapport(s,'marlowe',-10,'t','against'); ok(E.rapport(s,'marlowe')<=-16,'honest: a broken deal (quest against them) costs a lot');
  const r0=E.rapport(s,'corran'); E.sendGift(s,'corran'); ok(Math.abs(E.rapport(s,'corran')-r0-F.giftStanding*0.5)<1e-9,'ruthless: gifts at half value');
  const v0=E.rapport(s,'vey'); E.sendGift(s,'vey'); ok(E.rapport(s,'vey')-v0===F.giftStanding,'idealistic: gifts as normal');
  const c0=E.rapport(s,'corran'); E.houseQuestDone(s,{name:'x',house:'sallow'}); ok(E.rapport(s,'corran')<c0,'helping Sallow angers Corran'); }
{ const s=base(); const v0=E.rapport(s,'vey'),a0=E.rapport(s,'ashbrook'); E.houseQuestDone(s,{name:'x',against:'tallow'}); E.questEvents(s,{id:'z',name:'x',against:'tallow'});
  ok(E.rapport(s,'vey')<v0&&E.rapport(s,'ashbrook')===a0,'idealistic houses hate cruelty to other houses; honest ones don\'t care');
  const k0=E.rapport(s,'corran'); E.houseEvent(s,'raidWon'); ok(E.rapport(s,'corran')>k0,'ruthless respects a raid won');
  const d0=E.rapport(s,'dawnward'); E.houseEvent(s,'charity',{town:'millbrook'}); ok(E.rapport(s,'dawnward')>d0,'pious likes charity');
  const m=s.members[0]; m.guild={id:'rogues',rank:0,rep:0}; s.day=30; const d1=E.rapport(s,'dawnward'); E.temperMonth(s,E.houseDef('dawnward')); ok(E.rapport(s,'dawnward')<d1,'pious dislikes Rogues\' Guild members');
  const o0=E.rapport(s,'ashbrook'),w0=E.rapport(s,'marlowe'); E.houseEvent(s,'request',{town:'millbrook'}); ok(E.rapport(s,'ashbrook')>o0&&E.rapport(s,'marlowe')===w0,'honest likes requests filled in its seat'); }
{ const s=base(); s.houses.skye={r:80,state:'peace'}; ok(E.tierOf(s,'skye')==='allied'&&E.driftFloor(s,'skye')===60,'proud: loyal once Allied (drift floor)'); s.day=30; for(let i=0;i<20;i++){s.day+=30;E.housesDay(s);} ok(E.rapport(s,'skye')>=60,'an Allied proud house never drifts below its floor'); }
{ const s=base(); s.houses.tallow={r:-30,state:'peace'}; const T=E.temperDef('scheming'); ok(T.betray&&T.betray.chance>0,'scheming may betray when Cold'); s.phaseN=3; let hit=0; for(let i=0;i<200;i++){const c=s.res.coin; if(E.era(s).n>=2){E.temperMonth(s,E.houseDef('tallow')); if(s.res.coin<c)hit++;}} ok(hit>0||E.era(s).n<2,'…and does (when troubles are open)'); }
// perks
{ const s=base(); const p0=E.townBuyPrice(s,'millbrook','wheat'); s.houses.ashbrook={r:30,state:'peace'}; ok(E.townBuyPrice(s,'millbrook','wheat')<p0,'Ashbrook Friendly: −5% buying grain');
  const f0=E.perkField(s); s.houses.ashbrook.r=70; ok(E.perkField(s)>f0&&E.perkBuy(s,'wheat')<1,'Ashbrook Allied: +3% field yield and keeps the Friendly perk');
  const sp=E.townSellPrice(s,'ashford','wheat'); s.houses.marlowe={r:30,state:'peace'}; ok(E.townSellPrice(s,'ashford','wheat')>sp,'Marlowe Friendly: +3% selling in Ashford');
  s.houses.marlowe.r=70; ok(E.perkRoutes(s)===1&&E.routeSlotParts(s).houses!==undefined,'Marlowe Allied: +1 trade route');
  s.houses.ormond={r:30,state:'peace'}; ok(E.perkXp(s,'reading')>0&&E.shopOf(s,'thornwick').includes('ward_scroll'),'Ormond: Reading XP and rare scrolls in Thornwick');
  s.houses.dawnward={r:30,state:'peace'}; ok(E.perkRep(s,'church')===0.1,'Dawnward: Healers\' Guild rep +10%');
  s.houses.skye={r:70,state:'peace'}; ok(E.perkTravel(s,'highlands')>1&&E.perkDiscover(s,'highlands')>0,'Skye: Eyrie scouting / Highland travel');
  s.houses.corwen={r:70,state:'peace'}; ok(E.perkFerry(s)===0.25&&E.perkCargo(s,'seaboat')===1,'Corwen: ferry −25% / +1 Sea Boat cargo tier');
  s.houses.corwen.state='feud'; ok(E.perkFerry(s)===0,'no perks while feuding'); }
// threads
{ const s=base(); const q1=E.findId(D.quests,'ht_ashbrook1'); ok(!E.known(s,q1),'a thread starts hidden (keeps day 1 short)');
  s.day=30; E.housesDay(s); ok(E.known(s,q1),'…and opens on the monthly tick once the seat is known and they are Neutral+');
  ok(!E.threadOpenCheck(s,E.houseDef('corwen')),'Corwen\'s thread waits for Gull\'s Landing');
  const m=s.members[0]; for(const id of ['ht_ashbrook1','ht_ashbrook2','ht_ashbrook3']){ s.doneQuests.push(id); }
  const r0=E.rapport(s,'ashbrook'); ok(E.threadQuestDone(s,E.findId(D.quests,'ht_ashbrook3'),m)==='ashbrook'&&E.rapport(s,'ashbrook')>r0&&s.threads.includes('ashbrook'),'finishing a thread pays extra standing once');
  ok(E.findId(D.quests,'ht_ashbrook2').after==='ht_ashbrook1'&&E.findId(D.quests,'ht_skye2').after==='h_eyrie','thread steps reveal in order (Skye\'s starts with The Eyrie Oath)');
  ok(E.findId(D.quests,'ht_sallow3').against==='corran'&&E.findId(D.quests,'ht_corran3').against==='sallow','Old Debts / Forge Rights: pick a side'); }
{ const s=base(); const m=s.members[0]; for(const k in m.stats)m.stats[k]=40; s.revealed.push('ht_ashbrook1'); E.revealAt(s,'ht_ashbrook1'); E.reveal(s,D.map.points.ht_ashbrook1.x,D.map.points.ht_ashbrook1.y,60);
  const a=E.pickAdventure(s,m); ok(a&&E.findId(D.quests,a.target).once,'Auto (standing adventure) takes a house-thread step first: '+(a&&a.target)); }
// ---- Gull's Landing
const gt=E.findId(D.towns,'gullport');
ok(gt&&gt.port&&gt.coast&&gt.region==='outskirts'&&gt.prices.fish===1.5&&gt.prices.salt===2.5&&gt.prices.saltedfish===6,'Gull\'s Landing: port town, produces fish 1.5 / salt 2.5 / salted fish 6');
ok(gt.produces.join()==='fish,salt,saltedfish'&&gt.wants.join()==='planks,flax,ale'&&['planks','flax','ale'].every(k=>Math.abs(gt.prices[k]/E.findId(D.towns,'millbrook').prices[k]-1.2)<0.01),'wants planks, flax, ale (+20%)');
ok(['fishnet','seaboat_plans'].every(i=>gt.shop.includes(i))&&E.marketOf('gullport').includes('rope'),'shop: nets and the Sea Boat Plans; rope at the market');
ok(D.world.locations.find(l=>l.id==='l_gullport').town==='gullport'&&!D.world.locations.find(l=>l.id==='l_gullport').sea,'the jetty pin is now the town');
ok(D.towns.every(t=>t.prices.saltedfish>0&&t.prices.rope>0),'salted fish and rope priced everywhere');
const NP=D.requests.npcs.filter(n=>n.town==='gullport');
ok(NP.map(n=>n.id).join()==='odile,pell,merrow'&&NP.every(n=>n.requests.length===3),'3 villagers with 3 requests each');
ok(NP[0].requests[2].extra.type==='ferry'&&NP[1].requests.some(r=>r.extra&&r.extra.type==='bonus'&&r.extra.task==='fishing')&&NP[2].requests[2].extra.type==='chart','Odile: ferry discount · Pell: fishing boost · Merrow: sea chart');
{ const s=base(); ok(!E.npcOpen(s,NP[0]),'Gull\'s folk appear once the port is found'); findGull(s); ok(E.npcOpen(s,NP[0])&&/visit/.test(E.deliverIssue(s,'odile')),'…and take deliveries after a visit');
  ok(E.sellRes(s,'gullport','fish',2)&&E.visited(s,'gullport')&&!E.deliverIssue(s,'odile'),'trading there counts as a visit');
  ok(s.discovered.includes('loc:l_gullport')||s.locSeen.includes('l_gullport'),'the jetty is discovered (sea shore fishing, jetty dish)'); }
const GQ=D.quests.filter(q=>q.town==='gullport'&&q.id.startsWith('q_gull'));
ok(GQ.length===6&&GQ.every(q=>q.act===1&&q.band===1&&D.map.points[q.id]&&!q.once),'6 repeatable coast jobs (act 1, band 1), on the map');
const B=E.findId(D.quests,'b_lights'); ok(B&&B.beat&&B.act===1&&B.req.story===2&&B.grants.unlock.key==='ferry:gullport','Act 1 beat “Lights on the Rocks”: after chapter 2, gives the harbour ferry');
{ const s=base(); const m=s.members[0]; for(const k in m.stats)m.stats[k]=40; ok(/find/.test(E.questIssue(s,m,B)),'the beat needs Gull\'s Landing found'); findGull(s);
  ok(/chapter 2/.test(E.questIssue(s,m,B)),'…and chapter 2'); s.doneQuests.push('st1','st2'); ok(!E.questIssue(s,m,B),'then it opens');
  ok(!E.ferryOpen(s),'no ferry before the beat'); E.grantRewards(s,m,B); ok(E.ferryOpen(s),'the beat opens the ferry'); }
// pieces + recipes
{ const s=base(); const st=E.pieceDef?E.pieceDef('saltingtub'):D.estate.pieces.find(p=>p.id==='saltingtub'); ok(/find/.test(E.pieceLock(s,st)||''),'Salting Tub learned at Gull\'s Landing'); findGull(s); ok(!E.pieceLock(s,st),'…unlocks once found');
  const pr=D.estate.pieces.find(p=>p.id==='saltingtub').bonus.processes[0], rp=D.estate.pieces.find(p=>p.id==='ropewalk').bonus.processes[0];
  ok(pr.in.fish&&pr.in.salt&&pr.out==='saltedfish'&&pr.food&&rp.in.flax&&rp.out==='rope','Salted Fish (fish + salt, a food) and Rope (flax)');
  ok(D.estate.meals.menu.saltedfish>0&&D.estate.caps.capped.includes('rope'),'salted fish is a meal; rope is stored'); }
// ---- Dock → Slipway → Sea Boat
{ const s=base(); s.land=[...s.land, ...D.estate.lands.map(l=>l.id)]; const m=s.members[0];
  const rc=D.crafting.recipes.find(r=>r.id==='r_seaboat'); ok(rc.needsStruct==='slipway'&&rc.mats.planks&&rc.mats.rope&&rc.mats.cloth&&rc.hidden,'Sea Boat: planks, rope, cloth at a Slipway, recipe hidden');
  ok(/not found/.test(E.recipeIssue(s,m,rc)||''),'needs the plans'); findGull(s); ok(E.buyItem(s,'gullport','seaboat_plans')&&s.unlocks.includes('recipe:r_seaboat')&&!s.vault.includes('seaboat_plans'),'buying the plans teaches the recipe (no vault slot)');
  ok(!E.buyItem(s,'gullport','seaboat_plans'),'plans only once');
  ok(!E.hasStructType(s,'slipway')&&!!E.recipeIssue(s,m,rc),'not buildable yet (no Slipway): '+E.recipeIssue(s,m,rc));
  const dk=E.buildStructure(s,'dock'); ok(dk&&E.upgradeOptions('dock')[0].id==='slipway','the Dock upgrades to a Slipway');
  const smr=D.crafting.recipes.find(r=>r.id==='r_smallboat'); const before=E.recipeIssue(s,m,smr);
  ok(E.upgradeStructure(s,dk.uid,'slipway')&&s.structures.find(x=>x.uid===dk.uid).type==='slipway','Slipway built');
  ok(E.hasStructType(s,'dock')&&E.recipeIssue(s,m,smr)===before,'a Slipway still counts as a Dock (Small Boat still buildable)');
  ok(!/Slipway/.test(E.recipeIssue(s,m,rc)||''),'Sea Boat recipe now only needs a Carpenter/skill: '+E.recipeIssue(s,m,rc)); }
// sea travel, ferry, haul, deep sea
{ const s=base(); findGull(s); const m=s.members[0]; const far='q_gull_skiff';
  ok(E.isCoastal(far)&&!E.isCoastal('wolves'),'coast jobs are coastal; inland quests are not');
  ok(E.seaOption(s,far)===null,'no boat, no ferry: walk');
  s.unlocks.push('ferry:gullport'); const fo=E.seaOption(s,far); ok(fo&&fo.mode==='ferry'&&fo.fare>0&&fo.days<E.travelDays(far),'ferry: quicker, for a fare ('+fo.days+'d vs '+E.travelDays(far)+'d, '+fo.fare+' coin)');
  const t=E.newTrip({type:'quest',target:far},s); ok(t.sea==='ferry'&&t.ferry===fo.fare*2&&t.walkOut>t.out,'a ferry trip costs the fare both ways');
  const c0=s.res.coin; const a={type:'quest',target:far,trip:t}; ok(E.payFerry(s,m,a)&&s.res.coin===c0-t.ferry&&s.ferryTrips===1,'fare paid on the first day');
  const t2=E.newTrip({type:'quest',target:far},s); s.res.coin=1; ok(!E.payFerry(s,m,{trip:t2})&&t2.out===t2.walkOut&&!t2.ferry,'can\'t pay: walk after all'); s.res.coin=1e5;
  s.reqPerks=[{type:'ferry',pct:0.2}]; ok(E.ferryFare(s,1)<fo.fare||E.ferryFare(s,1)<E.ferryFare({unlocks:[]},1),'Odile\'s pass cuts the fare');
  s.ferryAuto=false; ok(E.seaOption(s,far)===null,'ferry can be switched off'); s.ferryAuto=true;
  const h0=E.haulTier(s,{coast:true}).carry; s.vault.push('seaboat'); ok(E.hasSeaBoat(s)&&E.seaOption(s,far).mode==='boat'&&E.seaOption(s,far).fare===0,'own Sea Boat: free sailing');
  ok(E.haulTier(s).id!=='seaboat'&&E.haulTier(s,{coast:true}).id==='seaboat'&&E.haulTier(s,{coast:true}).carry>h0,'Sea Boat is a haul tier only for coast hauls');
  s.houses.corwen={r:70,state:'peace'}; ok(E.haulTier(s,{coast:true}).carry>E.findId(D.world.haul.tiers,'seaboat').carry,'Corwen Allied: +1 cargo tier');
  ok(E.cartCarry(s,{mode:'sell',town:'gullport'})>E.cartCarry(s,{mode:'sell',town:'millbrook'}),'trade routes to Gull\'s Landing use the Sea Boat');
  ok(!E.spotIssue(s,D.fish.spots.find(x=>x.id==='deepsea')),'deep sea fishing opens with a Sea Boat');
  ok(E.ferryRoutes(s).some(r=>r.region==='saltmere'&&!r.open),'the Saltmere ferry route is listed, closed until the coast opens (R49)'); }
// ---- save step 44
{ const s=base(); findGull(s); s.discovered=s.discovered.filter(x=>x!=='gullport'); delete s.houses.corwen; s.schema=43; delete s.townsVisited;
  const st=(await import('../js/engine/save-steps.js')).STEPS.find(x=>x.n===44); st.run(s);
  ok(s.discovered.includes('gullport')&&s.townsVisited&&s.houses.corwen.r===0&&s.houses.corwen.state==='peace'&&Array.isArray(s.threads),'step 44: known jetty → known town; new houses Neutral; nothing given');
  ok(!s.unlocks.includes('ferry:gullport')&&!s.vault.includes('seaboat'),'step 44 gives no ferry or boat'); }
// Vey allied: Deadfall node +20% when gathering
{ const s=base(); const n=D.nodes.find(x=>x.id==='deadfall'); const g=()=>{const t={};E.gatherInto(s,t,n,1,()=>0);return Object.values(t.load).reduce((a,b)=>a+b,0);};
  const a=g(); s.houses.vey={r:70,state:'peace'}; const b=g(); ok(E.perkNode(s,'deadfall')>0&&b>a*1.15,'Vey Allied: Deadfall yields +20% ('+a.toFixed(1)+'→'+b.toFixed(1)+')'); }
// villager requests: free repeats, then a growing cooldown per repeat of the same request (data/requests.json repeat)
{ const R=D.requests.repeat; ok(R&&R.free===3&&R.base>0&&R.grow>1&&R.max>=R.base,'repeat rule is data');
  ok(E.repeatDelay(1)===0&&E.repeatDelay(3)===0&&E.repeatDelay(4)===R.base&&E.repeatDelay(5)===Math.round(R.base*R.grow)&&E.repeatDelay(50)===R.max,'no delay for the first 3, then base, growing, capped');
  const s=base(); s.townsVisited=['gullport']; s.discovered.push('gullport'); const n=D.requests.npcs.find(x=>x.id==='odile'); s.res.coin=1e6; s.res.planks=1e5; s.res.blocks=1e5; s.res.stone=1e5;
  for(const k of Object.keys(s.res)) if(typeof s.res[k]==='number') s.res[k]=Math.max(s.res[k],1e5);
  const gaps=[]; let done=0;
  for(let i=0;i<20;i++){ const x=s.req&&s.req.odile; if(x) s.day=Math.max(s.day,x.at); if(E.deliverIssue(s,'odile')) break; const d0=s.day; E.deliverRequest(s,'odile'); done++; gaps.push(s.req.odile.at-d0); }
  ok(done>=12,'Odile repeats ('+done+')');
  const L=n.requests.length; ok(gaps.slice(0,3*L).every(g=>g<=7)&&gaps[3*L]>=R.base&&gaps[3*L+L]>gaps[3*L],'cooldowns: short for 3 rounds, then growing ('+gaps.join(',')+')');
  ok(E.reqDone(s,'odile',n.requests[0].id)>=4,'completions counted per request'); }
// changelog
ok(D.changelog.entries[0].build==='R48','changelog R48');
console.log(pass+' R48 checks passed');
