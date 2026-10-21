// R49 (fl-stub-regions-proposal round 2): the Saltmere Coast — Saltmere (the Innsmouth nod: gloomy, never horror), the
// Lodge of the Drowned Light, Blackwater Reef, Hask / Kelda / Old Tobiah, reef-gold, 4 nodes, the Smugglers' Grotto
// (with the Sea Gate boat floor deferred from R48), 10 jobs + 2 Act 2 beats, the optional chain "What the Reef Keeps"
// (skill checks, prying, the keep/tell choice), events, pearl/amber inlays, the Salt Works, kelp fertiliser,
// House Gilmane (secretive; Sea-touched children), the ferry's Saltmere route, Merrow's chart, save step 45.
import fs from "fs"; import * as E from "../js/engine.js"; import { BUILD } from "../js/config.js";
const R=new URL("../data/",import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const Y=D.tuning.daysPerYear, G=D.map.towns.gullport, SM=D.map.towns.saltmere;
const base=()=>{const s=E.newGame(1);E.normalize(s);E.skipTutorial&&E.skipTutorial(s);const m=s.members[0];m.ageDays=25*Y;s.res.coin=1e5;for(const k of ['wood','stone','planks','blocks','ingots','cloth','flax','fish','salt','ale','rope','flour','kelp','milk','saltedfish'])s.res[k]=1e3;for(const k in m.stats)m.stats[k]=60;return s;};
const findGull=s=>{E.reveal(s,G.x,G.y,60);E.locationsDay(s);};
const findSalt=s=>{findGull(s);for(const id of ['saltcoast','saltmere'])if(!s.discovered.includes(id))s.discovered.push(id);E.reveal(s,SM.x,SM.y,200);E.locationsDay(s);};
const story=(s,n)=>{for(let i=1;i<=n;i++)if(!s.doneQuests.includes('st'+i))s.doneQuests.push('st'+i);};
const strong=s=>{const m=s.members[0];for(const k in m.skills)m.skills[k].lvl=40;s.vault.push('steel_sword');return m;};
// ---- build + save
ok(/^R\d/.test(BUILD)&&E.SCHEMA>=45,'R49+, save step 45+');
// ---- region, map, town
const rg=D.regions.find(r=>r.id==='saltcoast');
ok(rg&&!rg.future&&rg.hidden&&rg.cp===80,'the Saltmere Coast is a real (hidden) region, power 80');
ok(D.map.regions.some(r=>r.id==='saltcoast')&&D.map.size.w===1600&&D.map.size.h>1400&&E.regionAt(SM.x,SM.y)==='saltcoast','the map grows south for the coast; Saltmere sits in it');
const T=D.towns.find(t=>t.id==='saltmere');
ok(T&&T.region==='saltcoast'&&T.coast&&/fog/i.test(T.desc)&&/stare/i.test(T.desc)&&/lodge/i.test(T.desc)&&/reef/i.test(T.desc),'Saltmere: fog, closed shutters, staring locals, the Lodge, the reef nobody talks about');
ok(['salt','kelp','pearls','amber','reefgold'].every(k=>T.produces.includes(k))&&['flour','wood','ale'].every(k=>T.wants.includes(k)),'produces salt, kelp, pearls, amber, reef-gold; wants flour, timber, ale');
ok(T.prices.salt===2&&D.towns.every(t=>t.id==='saltmere'||t.prices.salt>2),'Saltmere salt is the cheapest (2.0)');
{ const s=base(); const sp=D.towns.map(t=>[t.id,E.townSellPrice(s,t.id,'reefgold')]); const sm=sp.find(x=>x[0]==='saltmere')[1];
  ok(sp.every(([id,v])=>id==='saltmere'||v>sm*1.3),'reef-gold sells high everywhere except Saltmere'); }
ok(D.world.locations.some(l=>l.id==='l_lodge'&&/Drowned Light/.test(l.name))&&D.world.locations.some(l=>l.id==='l_reef'&&/Blackwater/.test(l.name))&&D.world.locations.some(l=>l.id==='l_saltmere'&&l.town==='saltmere'),'the Lodge of the Drowned Light and Blackwater Reef are on the map');
ok(D.world.roads.some(r=>r.id==='coastroad')&&E.terrainDef(E.terrainAt(62,1200)).sea,'the slow coast road runs south along the shore');
// ---- how it opens: exploring the strand, or Merrow's chart
{ const st=D.map.areas.find(a=>a.id==='a_strand'); ok(st&&st.region==='outskirts'&&st.secrets.some(x=>x.type==='region'&&x.id==='saltcoast'),'exploring the Southern Strand can find the coast');
  const s=base(); findGull(s); const m=strong(s); let n=0; while(!E.regionKnown(s,'saltcoast')&&n++<60){s.discovered=s.discovered.filter(x=>x!=='region:saltcoast');E.exploreArea(s,m,st);} ok(E.regionKnown(s,'saltcoast'),'…and does ('+n+' tries)'); }
{ const s=base(); findGull(s); s.townsVisited=['gullport']; ok(!E.regionKnown(s,'saltcoast'),'coast unknown at first');
  for(let i=0;i<3;i++){ s.day=Math.max(s.day,(s.req.merrow||{}).at||0); ok(!E.deliverIssue(s,'merrow'),'Merrow open '+i+': '+E.deliverIssue(s,'merrow')); E.deliverRequest(s,'merrow'); }
  ok(E.regionKnown(s,'saltcoast')&&s.discovered.includes('saltmere')&&E.townKnownId(s,'saltmere')&&s.charts.includes('saltcoast'),"Merrow's chart finds the Saltmere Coast and marks Saltmere"); }
// ---- quarter maps stop at the old map edge; old fog survives the taller map
ok(E.quadOf(SM.x,SM.y)===null&&E.quadOf(100,1200)==='sw','quarter maps do not chart the Saltmere Coast');
{ const s=base(); const c=Math.ceil(D.map.size.w/50); s.fog='1'.repeat(c*28); E.reveal(s,10,10,1); ok(s.fog.length===c*Math.ceil(D.map.size.h/50)&&s.fog.slice(0,c*28)==='1'.repeat(c*28),'an old save keeps its fog on the taller map'); }
// ---- ferry: the Saltmere route
{ const s=base(); findGull(s); s.unlocks.push('ferry:gullport'); const r0=E.ferryRoutes(s).find(r=>r.id==='saltmere');
  ok(r0&&!r0.open,'Saltmere route closed until the coast is found'); findSalt(s); ok(E.ferryRoutes(s).find(r=>r.id==='saltmere').open,'…open once it is');
  const q='q_salt_raiders', so=E.seaOption(s,q); ok(so&&so.mode==='ferry'&&so.route==='saltmere'&&so.days<E.travelDays(q),'Saltmere jobs: by ferry on the Saltmere route ('+(so&&so.days)+'d vs '+E.travelDays(q)+'d walking)');
  const t=E.newTrip({type:'quest',target:q},s); ok(t.route==='saltmere'&&t.ferry>0,'the trip books the Saltmere route');
  ok(E.payFerry(s,s.members[0],{trip:t})&&s.ferryRoutesUsed.saltmere===1,'Saltmere ferry trips are counted');
  ok(E.ferryRouteFor(s,'q_gull_skiff').id==='coast','Gull\'s jobs still use the coast run'); }
// ---- villagers
{ const N=id=>D.requests.npcs.find(n=>n.id===id); ok(['hask','kelda','tobiah'].every(id=>N(id)&&N(id).town==='saltmere'&&N(id).requests.length===3),'Hask, Kelda and Old Tobiah: 3 requests each');
  const s=base(); findSalt(s); s.townsVisited=['saltmere','gullport']; const p0=E.townBuyPrice(s,'gullport','salt');
  for(let i=0;i<3;i++){ s.day=Math.max(s.day,(s.req.hask||{}).at||0); E.deliverRequest(s,'hask'); }
  ok(E.townBuyPrice(s,'gullport','salt')<p0,"Hask's salt deal: salt costs less");
  for(let i=0;i<3;i++){ s.day=Math.max(s.day,(s.req.kelda||{}).at||0); E.deliverRequest(s,'kelda'); }
  ok((s.dishes||[]).includes('kelpchowder'),"Kelda's recipe: kelp chowder"); }
// ---- the chain
{ const Q=id=>D.quests.find(q=>q.id===id); const s=base(); findSalt(s); s.townsVisited=['saltmere']; const m=strong(s);
  ok(['reef1','reef2','reef3','reef4'].every((id,i)=>Q(id).chain==='reef'&&Q(id).step===i+1&&Q(id).act===2),'“What the Reef Keeps”: 4 steps, Act 2');
  ok(E.questIssue(s,m,Q('reef1'))==='after chapter 4','step 1 waits for Act 2 (after chapter 4)'); story(s,4);
  ok(!E.questIssue(s,m,Q('reef1'))&&Q('reef1').deliver.ale,"step 1: Old Tobiah's stories (deliver ale)");
  ok(!E.questVisible(s,Q('reef2')),'step 2 hidden until Tobiah tells you');
  s.day=Math.max(s.day,(s.req.tobiah||{}).at||0); E.deliverRequest(s,'tobiah'); ok(s.revealed.includes('reef2'),'Tobiah\'s 1st telling reveals step 2');
  ok(/first:/.test(E.questIssue(s,m,Q('reef2'))),'steps go in order: '+E.questIssue(s,m,Q('reef2')));
  E.resolveQuest(s,m,Q('reef1'),1); ok(s.doneQuests.includes('reef1'),'step 1 done');
  ok(/Sea Boat/.test(E.questIssue(s,m,Q('reef2'))||''),'step 2 needs your own boat: '+E.questIssue(s,m,Q('reef2')));
  s.vault.push('seaboat'); ok(!E.questIssue(s,m,Q('reef2')),'with a Sea Boat it opens');
  ok(Q('reef2').check.skills.join()==='sailing,tracking'&&Q('reef3').check.skills.join()==='etiquette,thievery','Sailing or Scouting; Etiquette or Thievery');
  const lo=E.successChance(s,{...m,skills:Object.fromEntries(Object.keys(m.skills).map(k=>[k,{lvl:1,xp:0}]))},Q('reef2'));
  m.skills.sailing.lvl=40; m.skills.tracking.lvl=5; ok(E.checkSkill(m,Q('reef2'))==='sailing'&&E.checkBonus(m,Q('reef2'))>0&&E.successChance(s,m,Q('reef2'))>lo,'the best of the two skills makes the check');
  const g0=E.houseState(s,'gilmane').r; for(let i=0;i<30&&!s.doneQuests.includes('reef2');i++) E.resolveQuest(s,m,Q('reef2'),1);
  ok(s.doneQuests.includes('reef2')&&E.houseState(s,'gilmane').r<g0,'watching the reef is prying: secretive Gilmane dislikes it');
  s.day=Math.max(s.day,(s.req.tobiah||{}).at||0); E.deliverRequest(s,'tobiah'); ok(s.revealed.includes('reef3'),'2nd telling: step 3');
  for(let i=0;i<30&&!s.doneQuests.includes('reef3');i++) E.resolveQuest(s,m,Q('reef3'),1);
  s.day=Math.max(s.day,(s.req.tobiah||{}).at||0); E.deliverRequest(s,'tobiah'); ok(s.revealed.includes('reef4'),'3rd telling: step 4');
  for(let i=0;i<30&&!s.doneQuests.includes('reef4');i++) E.resolveQuest(s,m,Q('reef4'),1);
  ok(s.doneQuests.includes('reef4')&&E.pendingChoices(s).length===1&&E.pendingChoices(s)[0].id==='reef','the low-tide wade ends with a choice that waits');
  const t=JSON.parse(JSON.stringify(s)); E.normalize(t);
  const rg0=E.townBuyPrice(s,'saltmere','reefgold'), h0=E.houseState(s,'gilmane').r;
  ok(E.makeChoice(s,'reef','keep')&&E.houseState(s,'gilmane').r>h0&&E.townBuyPrice(s,'saltmere','reefgold')<rg0&&!E.pendingChoices(s).length,'keep the secret: Gilmane warms, reef-gold gets cheaper');
  ok(!E.makeChoice(s,'reef','tell'),'the choice is made once');
  t.houses.gilmane={r:40,state:'peace'}; ok(E.makeChoice(t,'reef','tell')&&E.tierOf(t,'gilmane')==='cold'&&t.guildFavour.church>0,'tell the Church: Gilmane turns Cold, the Church remembers (rep for the first to join)');
  ok(D.quests.every(q=>!/sea-cave/i.test(q.name))&&/sealed/.test(Q('reef4').choice.text),'the sea-cave stays sealed (Seafaring hook)'); }
// ---- Grotto + boat floor
{ const dg=D.dungeons.find(d=>d.id==='d_grotto'); ok(dg&&dg.floors.length===4&&dg.floors.slice(0,3).map(f=>f.cp).join()==='80,95,110'&&dg.floors[3].boat,"Smugglers' Grotto: 80/95/110 and a boat floor at the end");
  const s=base(); ok(E.dungeonRun(s,'d_grotto').floors.length===3&&E.taskDays({type:'dungeon',target:'d_grotto'},s)===8,'no boat: the run stops before the Sea Gate');
  s.vault.push('seaboat'); ok(E.dungeonRun(s,'d_grotto').floors.length===4&&E.taskDays({type:'dungeon',target:'d_grotto'},s)===10,'own Sea Boat: the Sea Gate floor too');
  ok(dg.loot.length&&dg.floors.some(f=>f.reward.pearls)&&dg.floors.some(f=>f.reward.amber),'drops pearls, amber and smugglers\' loot'); }
// ---- nodes, quests, beats, board
{ const N=id=>D.nodes.find(n=>n.id===id); ok(N('n_saltpans').res.salt===4&&N('n_kelpbeds').res.kelp&&N('n_tidalpools').rare.some(r=>r.id==='res:pearls')&&N('n_amberdunes').res.amber&&N('n_amberdunes').res.wood,'4 nodes: salt pans (4 salt), kelp, tidal pools (rare pearl), amber dunes (+driftwood)');
  const jobs=D.quests.filter(q=>q.id.startsWith('q_salt_')); ok(jobs.length===10&&jobs.every(q=>q.region==='saltcoast'&&D.map.points[q.id]),'10 coast jobs, each on the map');
  const s=base(); findSalt(s); const m=strong(s);
  ok(/chapter 4/.test(E.questIssue(s,m,D.quests.find(q=>q.id==='b_bell')))&&/chapter 6/.test(E.questIssue(s,m,D.quests.find(q=>q.id==='b_vaelsmugglers'))),'Act 2 beats: The Drowned Bell (after ch. 4), Vael\'s Smugglers (after ch. 6, leads to ch. 7)');
  ok(D.boards.pools.saltmere&&[1,2,3].every(b=>D.boards.pools.saltmere.some(j=>j.band===b)),'Saltmere job board'); }
// ---- events
{ const s=base(); findSalt(s); E.startEvent(s,'procession','saltmere'); ok(E.marketClosed(s,'saltmere')&&!E.buyRes(s,'saltmere','food',1)&&!E.sellRes(s,'saltmere','fish',1)&&E.buyRes(s,'gullport','food',1),'Lodge procession: the Saltmere market shuts for a day');
  E.startEvent(s,'reeffog','saltcoast'); ok(Math.abs(E.coastFishMult(s)-0.8)<1e-9,'reef fog: coast fishing ×0.8');
  s.fishSpot='seashore'; s.res.fish=0; findGull(s); E.landFish(s,10); ok(s.res.fish<10,'…on the coast spots');
  const p0=E.townSellPrice(s,'gullport','fish'); E.startEvent(s,'stranger','gullport'); ok(E.townSellPrice(s,'gullport','fish')>p0*1.8,'a wide-eyed stranger pays double for fish');
  ok(['reeffog','stranger','procession'].every(id=>D.events.types.find(t=>t.id===id).weight<1),'all three are rare'); }
// ---- reef-gold circlet, inlays
{ const it=D.items.find(i=>i.id==='reefgold_circlet'); ok(it&&it.slot==='accessory'&&it.fx.stats.CHA===1&&/faintly cold/.test(it.desc)&&T.shop.includes(it.id),'Reef-Gold Circlet at Saltmere: +1 CHA, "always faintly cold"');
  const s=base(); const m=s.members[0]; const c0=E.statVal(m,'CHA'); m.equip.accessory='reefgold_circlet'; ok(E.statVal(m,'CHA')===c0+1,'+1 CHA when worn');
  const y0=E.taskYields(s,D.activities.find(a=>a.id==='fishing')).fish; ok(y0>0,'fishing yields'); m.equip.accessory=null; const y1=E.taskYields(s,D.activities.find(a=>a.id==='fishing')).fish; ok(y0>y1,'+5% from the Fish task');
  ok(D.crafting.inlays.mats.pearls&&D.crafting.inlays.mats.amber,'pearl and amber inlays'); }
// ---- Salt Works + kelp fertiliser
{ const s=base(); s.land=['plot']; const W=D.estate.structures.find(x=>x.id==='saltworks'); ok(W&&W.requires==='dock'&&W.fixed.includes('brinepans'),'Salt Works: brine → salt, needs a Dock');
  ok(/Saltmere/.test(E.structIssue(s,'saltworks')||''),'learned at Saltmere: '+E.structIssue(s,'saltworks')); findSalt(s); ok(/Dock/.test(E.structIssue(s,'saltworks')||''),'then needs a Dock: '+E.structIssue(s,'saltworks'));
  ok(D.estate.pieces.find(p=>p.id==='kelpvat').bonus.processes[0].out==='kelpfert','Kelp Vat: kelp → fertiliser');
  const f={crop:'food',lvl:1}; const y0=E.fieldYield(s,f); s.res.kelpfert=5;
  ok(E.fertSeason(s,3,30)&&s.res.kelpfert===2&&E.fertBonus(s)===0.05&&E.fieldYield(s,f)>y0,"Fields' Auto spreads it: +5% field yield for the season");
  ok(!E.fertSeason(s,3,30),'once a season'); s.day+=31; ok(E.fertBonus(s)===0,'it wears off'); }
// ---- House Gilmane
{ const h=D.families.list.find(x=>x.id==='gilmane'); ok(h&&h.major&&h.seat==='saltmere'&&h.temperament==='secretive'&&h.thread.quests.length===3&&h.thread.also==='reef'&&h.marriage,'House Gilmane: Saltmere, secretive, “The Gilmane Ledger” + the reef chain, marries');
  const s=base(); findSalt(s); const p0=E.townBuyPrice(s,'saltmere','reefgold'), q0=E.townBuyPrice(s,'saltmere','salt'), q1=E.townBuyPrice(s,'gullport','salt');
  s.houses.gilmane={r:40,state:'peace'}; ok(E.townBuyPrice(s,'saltmere','reefgold')<p0,'Friendly: reef-gold −15%');
  s.houses.gilmane={r:80,state:'peace'}; ok(E.townBuyPrice(s,'saltmere','salt')<q0&&E.townBuyPrice(s,'gullport','salt')===q1,'Allied: Saltmere salt −20% (only in Saltmere)');
  ok(D.traits.find(t=>t.id==='seatouched').houseOnly&&D.traits.find(t=>t.id==='seatouched').skillXp.fishing===0.25,'Sea-touched: +25% Fishing/Sailing XP, never rolled at random');
  let got=0; for(let i=0;i<40;i++){const c={name:'Kid',traits:[]}; if(E.houseBirthTrait(s,c,[{house:'gilmane'},{}]))got++;} ok(got>5&&got<35,'children of a Gilmane marriage may be Sea-touched ('+got+'/40)');
  let rolled=0; for(let i=0;i<300;i++) if(E.rollTrait(s,[])==='seatouched') rolled++; ok(!rolled,'never from a random roll'); }
// ---- save step 45
{ const s=base(); s.charts=['saltmere']; s.reqPerks=[{type:'chart',region:'saltmere',from:'merrow3'}]; delete s.houses.gilmane; s.schema=44;
  E.STEPS? null:null; const st=(await import('../js/engine/save-steps.js')).STEPS.find(x=>x.n===45); st.run(s);
  ok(s.charts.includes('saltcoast')&&E.regionKnown(s,'saltcoast')&&s.discovered.includes('saltmere')&&s.houses.gilmane.r===0&&Array.isArray(s.choices),"step 45: Merrow's chart (from R48) now finds the coast; Gilmane Neutral");
  ok(!s.doneQuests.some(q=>q.startsWith('reef'))&&!(s.res.reefgold>0),'nothing given'); }
// changelog
// R49 fixes found by the sim: crafted Sea Boats (quality-tagged vault ids) count for req.item; carried deliver goods and requested food are held back
{ const rgc=D.regions.find(r=>r.id==='saltcoast'), cp0=rgc.cp; rgc.cp=0; const s=base(); s.doneQuests.push('reef1'); s.revealed.push('reef2'); s.discovered.push('saltcoast','saltmere'); (s.townsVisited||=[]).push('saltmere'); s.storyCh=9; for(let i=1;i<=6;i++)s.doneQuests.push('st'+i); const q=D.quests.find(q=>q.id==='reef2'); s.vault=s.vault.filter(v=>!String(v).includes('seaboat')); s.members.forEach(m=>{m.bag=[];});
  ok(/Sea Boat/i.test(E.questIssue(s,s.members[0],q)||''),'reef2 needs the boat: '+E.questIssue(s,s.members[0],q));
  s.vault.push('c|seaboat|fine#7'); ok(!/Sea Boat/i.test(E.questIssue(s,s.members[0],q)||''),'crafted boat id counts: '+E.questIssue(s,s.members[0],q));
  const m=s.members[0]; m.action={type:'quest',target:'reef1',progress:0,trip:{out:1,task:1,back:1,t:0,resolved:false}}; ok(E.reserveOf(s,'ale')>=3,'ale held for reef1 en route');
  m.action.trip.resolved=true; ok(E.reserveOf(s,'ale')===((s.reserve||{}).ale||0),'released once handed over'); m.action=null; rgc.cp=cp0; }
ok(E.questChainName('reef')==="What the Reef Keeps",'chain name '+E.questChainName('reef'));
// R49 tweaks: reef-gold ~115 outside Saltmere (85 there); town breweries (limited monthly brews at a markup)
for(const tw of D.towns) ok(tw.id==='saltmere'?tw.prices.reefgold===85:tw.prices.reefgold>=105&&tw.prices.reefgold<=120,'reefgold price '+tw.id+' '+tw.prices.reefgold);
{ const s=base(); s.res.coin=1e5; s.day=300; const tv=D.towns.find(t=>t.id==='gullport').brewery.brews.ale;
  for(const id of ['gullport','saltmere']) ok(E.breweryOf(id)&&E.brewsOf(id).ale,'brewery at '+id);
  for(const tw of D.towns) if(tw.brewery) for(const [k,d] of Object.entries(tw.brewery.brews)){ ok(D.towns[0].prices[k]!=null&&d.n>0&&d.mult>1.2,'brew data '+tw.id+' '+k); ok(!tw.market.includes(k),'brew not also on the market '+tw.id+' '+k); }
  ok(E.brewLeft(s,'gullport','ale')===tv.n,'stock '+tv.n); ok(E.brewPrice(s,'gullport','ale')>D.towns.find(t=>t.id==='gullport').prices.ale*1.3,'markup '+E.brewPrice(s,'gullport','ale'));
  const a0=s.res.ale||0; ok(E.buyBrew(s,'gullport','ale',100)===tv.n && (s.res.ale-a0)===tv.n,'capped at stock'); ok(!E.buyBrew(s,'gullport','ale',1),'sold out this month');
  ok(E.brewLeft(s,'saltmere','ale')>0,'stock is per town'); s.day=330; ok(E.brewLeft(s,'gullport','ale')===tv.n,'restocked next month'); ok(E.brewLeft(s,'eyrie','ale')===0,'no brewery, no brews');
  for(const tw of D.towns) if(tw.brewery&&tw.brewery.brews.ale) ok(E.brewPrice(s,tw.id,'ale')>2*2.5,'family Brewery (2 barley) cheaper at '+tw.id); }
ok(D.changelog.entries.some(e=>e.build==='R49'),'changelog R49');
console.log(pass+' R49 checks passed');
