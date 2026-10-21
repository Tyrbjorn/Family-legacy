// R50 (fl-stub-regions-proposal round 3a): the Highlands — 9 new jobs (12 in all) incl. the Act 3 beat "The Usurper's
// Dwarven Steel", Falconmaster Ysolde (falcon scouting, Falconry skill + master) and Elder Tamsin (lead to the Sealed
// Dwarven Gate), Highland Pasture + Mountain Herbs, the Eyrie Mead Hall, mountain routes (wagons x0.6, winter x0.75),
// House Crane (the usurper's house: Rival, disgraced after chapter 10), camps.json sites, save step 46.
import fs from "fs"; import * as E from "../js/engine.js"; import { BUILD } from "../js/config.js";
import { STEPS } from "../js/engine/save-steps.js";
const R=new URL("../data/",import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const Y=D.tuning.daysPerYear, Q=id=>D.quests.find(q=>q.id===id);
const base=()=>{const s=E.newGame(1);E.normalize(s);E.skipTutorial&&E.skipTutorial(s);const m=s.members[0];m.ageDays=25*Y;s.res.coin=1e5;for(const k of ['preserves','meat','cloth','honey','wood','stone'])s.res[k]=1e3;for(const k in m.stats)m.stats[k]=60;return s;};
const findEyrie=s=>{for(const id of ['highlands','eyrie'])if(!s.discovered.includes(id))s.discovered.push(id);(s.townsVisited||=[]).push('eyrie');};
const deliver3=(s,id)=>{for(let i=0;i<3;i++){s.day=Math.max(s.day,(s.req[id]||{}).at||0);ok(!E.deliverIssue(s,id),id+' open '+i+': '+E.deliverIssue(s,id));E.deliverRequest(s,id);}};
ok(BUILD==='R50'&&E.SCHEMA===46,'R50, save step 46');
// ---- 12 Highlands jobs
const HJ=D.quests.filter(q=>q.region==='highlands'&&!['house','guild'].includes(q.type));
ok(HJ.length===12,'12 Highlands jobs ('+HJ.length+')');
const NEW=['q_hl_goats','q_hl_rams','q_hl_heather','q_hl_avalanche','q_hl_wolves','q_hl_trial','q_hl_cairn','q_hl_shrine','b_dwarvensteel'];
ok(NEW.every(id=>Q(id)&&D.map.points[id]&&E.regionAt(D.map.points[id].x,D.map.points[id].y)==='highlands'),'new jobs exist and sit in the Highlands');
ok(NEW.every(id=>Q(id).act&&Q(id).band),'act and band tags');
{ const b=Q('b_dwarvensteel'); ok(b.beat&&b.act===3&&b.req.story===8&&b.once,'Act 3 beat after chapter 8');
  const s=base(); findEyrie(s); const m=s.members[0]; for(const k in m.skills)m.skills[k].lvl=40;
  ok(E.questIssue(s,m,b)==='after chapter 8','beat waits for chapter 8: '+E.questIssue(s,m,b));
  ok(/first:/.test(E.questIssue(s,m,Q('q_hl_trial'))||''),'Eagle-Riders\' Trial comes after The Eyrie Oath');
  ok(/first:/.test(E.questIssue(s,m,Q('q_hl_cairn'))||''),'The Giant\'s Cairn comes after Hill Giant Toll');
  ok(Q('q_hl_trial').check.skills.join()==='archery,leadership','Archery or Leadership check');
  ok(Q('q_hl_shrine').hidden&&D.map.areas.find(a=>a.id==='a_peaks').secrets.some(x=>x.id==='q_hl_shrine'),'the Shrine is found exploring the Peaks'); }
// ---- nodes
{ const P=D.nodes.find(n=>n.id==='n_pasture'), H=D.nodes.find(n=>n.id==='n_mtnherbs');
  ok(P&&P.region==='highlands'&&P.res.hay>0&&P.res.sage>0&&P.res.sage<1,'Highland Pasture: hay and a little sage');
  ok(H&&H.res.mandrake>0&&H.hidden&&D.map.areas.find(a=>a.id==='a_peaks').secrets.some(x=>x.id==='n_mtnherbs'),'Mountain Herbs: mandrake, found exploring');
  ok(D.map.points.n_pasture&&D.map.points.n_mtnherbs,'node map points'); }
// ---- mead + Eyrie brewery
ok(D.towns.every(t=>t.prices.mead>0),'mead has a price everywhere');
{ const s=base(); s.day=300; ok(E.breweryOf('eyrie')&&E.brewsOf('eyrie').mead&&!E.brewsOf('eyrie').ale,'Eyrie Mead Hall sells mead, not ale');
  const n=E.brewsOf('eyrie').mead.n, a0=s.res.mead||0; ok(E.buyBrew(s,'eyrie','mead',99)===n&&s.res.mead-a0===n,'buy the month\'s '+n+' casks');
  ok(E.brewPrice(s,'eyrie','mead')>D.towns.find(t=>t.id==='eyrie').prices.mead,'at a markup'); }
// ---- Ysolde: falcons + Falconry
{ const s=base(); findEyrie(s); const m=s.members[0]; const N=D.requests.npcs.find(n=>n.id==='ysolde');
  ok(N&&N.town==='eyrie'&&N.requests.every(r=>r.wants.preserves),'Ysolde wants preserves');
  const kid=E.living(s).find(x=>x!==m)||m; const d0=E.perkDiscover(s,'forest');
  const mf=D.apprenticeships.masters.find(x=>x.id==='m_falcon'); ok(mf&&mf.skills.includes('falconry'),'Ysolde is on the masters list');
  ok(/requests first/.test(E.apprIssue(s,{...kid,id:'zz',alive:true,ageDays:15*Y},'m_falcon')||''),'her apprenticeship waits for her requests');
  const ac=D.activities.find(a=>a.id==='flyfalcon'); ok(ac&&E.taskLock(s,m,ac),'Fly the Falcon locked at first');
  deliver3(s,'ysolde');
  ok(E.perkDiscover(s,'forest')>d0+0.19&&E.perkDiscover(s,'highlands')>=0.2,'+20% exploring finds anywhere');
  ok(!/requests first/.test(E.apprIssue(s,{...kid,id:'zz',alive:true,ageDays:15*Y},'m_falcon')||''),'then she takes an apprentice');
  ok(!E.taskLock(s,m,ac),'and Fly the Falcon opens');
  ok(E.falconBonus({skills:{falconry:{lvl:10}}})===0.1&&E.falconBonus({skills:{falconry:{lvl:90}}})===0.3&&E.falconBonus(m)===0,'Falconry: +1%/level, cap +30%'); }
// ---- Tamsin: lead to the Sealed Dwarven Gate
{ const s=base(); findEyrie(s); ok(!s.discovered.includes('loc:l_dwarfhold'),'gate unknown');
  deliver3(s,'tamsin'); ok(s.discovered.includes('loc:l_dwarfhold'),'Tamsin marks the Sealed Dwarven Gate');
  ok(D.world.locations.find(l=>l.id==='l_dwarfhold').locked,'…which stays sealed (R51)'); }
// ---- mountain routes
{ const s=base(); s.vault.push('wagon'); s.res.planks=1e3; s.res.wood=1e3; s.res.stone=1e3; E.buyLand(s,'plot'); const sh=E.buildStructure(s,'shack'); E.placePiece(s,sh.uid,'stablestall'); s.animals={horse:1};
  ok(E.stalls(s)>=1,'a stall for the horse');
  const lo=E.haulTier(s), hi=E.haulTier(s,{mountain:true});
  ok(lo.id==='horsewagon'&&hi.haulSpeed<lo.haulSpeed,'wagons slow in the mountains ('+lo.haulSpeed+' → '+hi.haulSpeed+')');
  s.animals={mule:1}; s.vault=s.vault.filter(v=>v!=='wagon'); ok(E.haulTier(s,{mountain:true}).haulSpeed===E.haulTier(s).haulSpeed,'mules keep their speed');
  const W=D.seasons.order.indexOf('winter'); ok(E.isMountain('highlands')&&!E.isMountain('forest'),'Highlands are mountain');
  for(let d=0;d<Y;d++){ s.day=d; if(E.season(s).id==='winter')break; }
  ok(E.mountainWinter(s,'highlands')===0.75&&E.mountainWinter(s,'forest')===1,'winter passes ×0.75, never closed');
  for(let d=0;d<Y;d++){ s.day=d; if(E.season(s).id==='summer')break; } ok(E.mountainWinter(s,'highlands')===1,'summer: no slowdown'); }
// ---- House Crane
{ const s=base(); ok(!E.houseList().some(h=>h.id==='crane')&&E.usurperDef().id==='crane','Crane is outside the house list (no gifts, suitors or drift)');
  ok(E.usurperTier(s)==='rival','Crane starts Rival');
  const m=s.members[0]; const r0=E.usurperState(s).r; E.usurperQuestDone(s,Q('b_dwarvensteel')); ok(E.usurperState(s).r<r0,'the beat sets Crane further against you');
  for(let i=0;i<20;i++)E.usurperQuestDone(s,{id:'x',usurper:50}); ok(E.usurperTier(s)==='rival','never better than Rival');
  s.doneQuests.push('st10'); E.usurperQuestDone(s,Q('st10')); ok(E.usurperTier(s)==='disgraced'&&s.usurper.gone!=null,'disgraced after chapter 10');
  ok(/Crane/.test(Q('st9').desc)&&/Crane/.test(Q('st10').desc),'chapters 9-10 name House Crane'); }
// ---- camps data
ok(Array.isArray(D.camps.sites)&&D.camps.sites.filter(c=>c.region==='highlands').length===2,'2 Highlands campsites in camps.json');
// ---- save step 46 + old saves
{ const s=base(); delete s.usurper; for(const m of s.members) delete m.skills.falconry; s.schema=45; STEPS.find(x=>x.n===46).run(s);
  ok(s.usurper.r===-60&&!s.usurper.gone&&s.members.every(m=>m.skills.falconry.lvl===0),'step 46: Crane Rival, Falconry 0');
  const t=base(); delete t.usurper; t.doneQuests.push('st10'); STEPS.find(x=>x.n===46).run(t); ok(E.usurperGone(t)&&t.usurper.gone!=null,'a save past chapter 10: already disgraced');
  ok(!s.reqPerks.some(p=>/ysolde|tamsin/.test(p.from)),'nothing given'); }
{ const A=E.importSave(fs.readFileSync(new URL('./fixtures/old-save-fl1.txt',import.meta.url),'utf8').trim());
  ok(A.schema===46&&A.usurper&&A.members.every(m=>!m.alive||m.skills.falconry),'old FL1 save migrates to step 46'); }
{ const s=base(); findEyrie(s); deliver3(s,'ysolde'); const l=E.deserialize(E.serialize(s)); ok(l.schema===46&&E.perkDiscover(l,'forest')>=0.2&&l.usurper,'R50 state survives save/load'); }
ok(D.changelog.entries[0].build==='R50','changelog R50');
console.log(pass+' R50 checks passed');
