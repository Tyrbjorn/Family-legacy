// R51 (fl-stub-regions-proposal round 3b, first part): the Rune-Sealed Gate — Gatewarden Thrain Ironbrow's gate post
// (found by Tamsin's lead or exploring), his growing gate market, the 9-step trust line with the 3 Ironbrow Clan-Crown pieces at steps 3/6/8,
// the discretion choice (keep / sell to House Crane), step 9 opens the gate (Dwarfhold found, Rune Road), mountain rams
// (bought at the Eyrie, bred in pairs), the Ram Cart, save step 47.
import fs from "fs"; import * as E from "../js/engine.js"; import { BUILD } from "../js/config.js";
import { STEPS } from "../js/engine/save-steps.js";
const R=new URL("../data/",import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const Y=D.tuning.daysPerYear, Q=id=>D.quests.find(q=>q.id===id);
const base=()=>{const s=E.newGame(1);E.normalize(s);E.skipTutorial&&E.skipTutorial(s);const m=s.members[0];m.ageDays=25*Y;s.res.coin=1e5;for(const k of ['preserves','meat','cloth','bread','barley','silverore','stone','ale','ingots','coal','gold','planks','leather','hay','wood'])s.res[k]=1e3;for(const k in m.stats)m.stats[k]=60;for(const k in m.skills)m.skills[k].lvl=40;s.vault.push('steel_sword');return s;};
const findEyrie=s=>{for(const id of ['highlands','eyrie'])if(!s.discovered.includes(id))s.discovered.push(id);(s.townsVisited||=[]).push('eyrie');};
const deliver3=(s,id)=>{for(let i=0;i<3;i++){s.day=Math.max(s.day,(s.req[id]||{}).at||0);E.deliverRequest(s,id);}};
const story=(s,n)=>{for(let i=1;i<=n;i++)if(!s.doneQuests.includes('st'+i))s.doneQuests.push('st'+i);};
const clear=(s,id)=>{const m=s.members[0];for(let i=0;i<40&&!s.doneQuests.includes(id);i++)E.resolveQuest(s,m,Q(id),1);return s.doneQuests.includes(id);};
ok(/^R\d+/.test(BUILD)&&+BUILD.slice(1)>=51&&E.SCHEMA>=47,'R51+, save step 47+');
// ---- the gate post
const GP=D.towns.find(t=>t.id==='gatepost'), DH=D.towns.find(t=>t.id==='dwarfhold');
ok(GP&&GP.hidden&&GP.region==='highlands'&&GP.wants.includes('bread')&&GP.wants.includes('ale'),'Ironbrow Gate Post: hidden, buys food and drink');
{ const s=base(); findEyrie(s); ok(!E.townKnownId(s,'gatepost'),'post unknown at first'); deliver3(s,'tamsin');
  ok(E.townKnownId(s,'gatepost')&&s.discovered.includes('loc:l_dwarfhold'),"Tamsin's lead finds the post and the gate"); }
{ const s=base(); findEyrie(s); const ar=D.map.areas.find(a=>a.id==='a_peaks'); let n=0; while(!s.discovered.includes('gatepost')&&n++<200){ s.discovered=s.discovered.filter(x=>x!=='loc:l_dwarfhold'); E.exploreArea(s,s.members[0],ar); }
  ok(s.discovered.includes('gatepost'),'exploring the Peaks to the gate also finds the post ('+n+' tries)'); }
// ---- the trust line
ok([1,2,3,4,5,6,7,8,9].every(i=>Q('gate'+i)&&Q('gate'+i).chain==='gate'&&Q('gate'+i).step===i&&Q('gate'+i).act===3&&D.map.points['gate'+i]),'9 steps, Act 3, on the map');
ok(E.questChainName('gate')==='The Rune-Sealed Gate','chain name');
ok(Q('gate4').name==="Wolves on the Traders' Path"&&Q('gate4').name!==Q('q_hl_wolves').name,'renamed so it does not clash with the Frost Wolves job');
const PC={gate3:'crownband',gate6:'crownstone',gate8:'crowncrest'}; ok(Object.entries(PC).every(([q,k])=>Q(q).reward[k]===1)&&Object.values(PC).every(k=>Q('gate9').deliver[k]===1)&&/Clan-Crown/.test(Q('gate9').desc),'Clan-Crown pieces at steps 3, 6, 8; step 9 reassembles it');
{ const s=base(); findEyrie(s); deliver3(s,'tamsin'); s.townsVisited.push('gatepost'); const m=s.members[0];
  ok(!E.questIssue(s,m,Q('gate1')),'step 1 opens: '+E.questIssue(s,m,Q('gate1')));
  ok(!E.marketOf('gatepost',s).includes('steel'),'small market at first: '+E.marketOf('gatepost',s));
  for(let i=1;i<=6;i++) ok(clear(s,'gate'+i),'step '+i+' done');
  ok(E.marketOf('gatepost',s).includes('steel')&&E.marketOf('gatepost',s).includes('gems')&&!E.marketOf('gatepost',s).includes('mithril'),'market grows with trust');
  ok(s.res.crownband===1&&s.res.crownstone===1&&!s.res.crowncrest,'Band and Brow-Stone so far');
  ok(clear(s,'gate7')&&E.pendingChoices(s).some(c=>c.id==='discretion'),'step 7 asks a choice');
  const t=JSON.parse(JSON.stringify(s)); E.normalize(t);
  const p0=E.townBuyPrice(s,'gatepost','steel'), q0=E.townBuyPrice(s,'eyrie','steel'); ok(E.makeChoice(s,'discretion','keep')&&E.townBuyPrice(s,'gatepost','steel')<p0&&E.townBuyPrice(s,'eyrie','steel')===q0,'keep the secret: steel cheaper at the gate only');
  const c0=t.res.coin; ok(E.makeChoice(t,'discretion','sell')&&t.res.coin===c0+1200&&t.flags.soldGate!=null,'sell it: 1,200 coin, remembered');
  ok(clear(s,'gate8')&&s.res.crowncrest===1&&E.marketOf('gatepost',s).includes('mithril'),'step 8: the Crest, mithril on sale');
  ok(E.questIssue(s,m,Q('gate9'))==='after chapter 8','step 9 waits for chapter 8'); story(s,8);
  ok(!E.questIssue(s,m,Q('gate9')),'then it opens: '+E.questIssue(s,m,Q('gate9')));
  const l=D.world.locations.find(x=>x.id==='l_dwarfhold'); ok(E.locLocked(s,l),'gate sealed');
  const tv0=E.perkTravel(s,'highlands'); ok(clear(s,'gate9'),'step 9 done');
  ok(!E.locLocked(s,l)&&E.locName(s,l)==='The Rune Gate'&&E.gateOpen(s),'the gate opens');
  ok(E.townKnownId(s,'dwarfhold')&&!s.res.crownband&&!s.res.crownstone&&!s.res.crowncrest,'Dwarfhold found; the Clan-Crown is set before the gate');
  ok(E.perkTravel(s,'highlands')>tv0&&E.perkTravel(s,'forest')===1,'the Rune Road speeds Highlands travel');
  ok(s.unlocks.includes('recipe:r_ramcart'),'the dwarves show you the Ram Cart');
  ok(!E.openGate(s),'opens once'); }
// ---- Dwarfhold
ok(['steel','ingots','gems','mithril'].every(k=>DH.produces.includes(k)&&DH.prices[k]<D.towns.find(t=>t.id==='eyrie').prices[k]),'Dwarfhold: cheap steel, ingots, gems, mithril');
ok(['bread','preserves','meat'].every(k=>DH.prices[k]>=D.towns.find(t=>t.id==='eyrie').prices[k]*1.3),'pays +30% or more for bread, preserves, meat');
ok(DH.shop.includes('ramcart'),'sells the Ram Cart');
// ---- rams
{ const s=base(); const A=D.world.haul.animals.ram; ok(A&&A.towns.join()==='eyrie','rams are bought at the Eyrie');
  E.buyLand(s,'plot'); const sh=E.buildStructure(s,'shack'); E.placePiece(s,sh.uid,'stablestall'); const sh2=E.buildStructure(s,'shack'); E.placePiece(s,sh2.uid,'stablestall');
  ok(!E.buyAnimalIssue(s,'ram','eyrie')&&E.buyAnimal(s,'ram','eyrie')&&E.buyAnimal(s,'ram','eyrie'),'buy two rams');
  const run=d=>{for(let i=0;i<d;i++){s.day++;s._stallsFree=E.stalls(s)-E.animalCount(s);E.ramsDay(s);delete s._stallsFree;}};
  ok(E.stalls(s)>=4,'stalls '+E.stalls(s)); run(130); ok(s.animals.ram===2,'no Highland access: no lambs');
  findEyrie(s); run(119); ok(s.animals.ram===2,'not yet'); run(1); ok(s.animals.ram===3,'a lamb after 120 days');
  run(120); ok(s.animals.ram===4,'another'); run(120); ok(s.animals.ram===4,'stalls full: no more');
  s.animals.ram=2; s.unfed={ram:1}; s.ramBreed=0; run(130); ok(s.animals.ram===2,'unfed rams do not breed'); }
// ---- Ram Cart
{ const s=base(); E.buyLand(s,'plot'); const sh=E.buildStructure(s,'shack'); E.placePiece(s,sh.uid,'stablestall'); s.animals={ram:1}; s.vault.push('ramcart');
  const h=E.haulTier(s), hm=E.haulTier(s,{mountain:true}); ok(h.id==='ramcart'&&h.carry>=220&&hm.haulSpeed===h.haulSpeed,'Ram Cart: carry 220, full speed in the mountains');
  s.animals={}; ok(E.haulTier(s).id!=='ramcart','needs a ram'); }
// ---- save step 47
{ const s=base(); s.discovered.push('loc:l_dwarfhold'); delete s.flags; s.schema=46; STEPS.find(x=>x.n===47).run(s);
  ok(s.discovered.includes('gatepost')&&!s.gateOpen&&s.flags&&!['crownband','crownstone','crowncrest'].some(k=>s.res[k]>0),'step 47: a found gate also knows the post; nothing given');
  const t=base(); STEPS.find(x=>x.n===47).run(t); ok(!t.discovered.includes('gatepost'),'no gate found, no post'); }
{ const A=E.importSave(fs.readFileSync(new URL('./fixtures/old-save-fl1.txt',import.meta.url),'utf8').trim()); ok(A.schema===E.SCHEMA,'old FL1 save migrates to step 47'); }
{ const s=base(); s.gateOpen=5; s.boons.push({...E.RUNE_ROAD}); const l=E.deserialize(E.serialize(s)); ok(l.schema===E.SCHEMA&&E.gateOpen(l)&&E.perkTravel(l,'highlands')>1,'R51 state survives save/load'); }
ok(D.changelog.entries.some(e=>e.build==='R51'),'changelog R51');
console.log(pass+' R51 checks passed');
