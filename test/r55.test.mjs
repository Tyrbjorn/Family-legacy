// R55 the Deep Ones come ashore: Deep One raids (triggers, power, targets, kidnapping + rescue, defence, end) and
// Saltmere's locals (40 lines in 4 moods), save step 51.
import fs from "fs"; import * as E from "../js/engine.js"; import { BUILD } from "../js/config.js";
import { STEPS } from "../js/engine/save-steps.js";
const R=new URL("../data/",import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const Y=D.tuning.daysPerYear, Q=id=>D.quests.find(q=>q.id===id);
const base=(pact,r)=>{const s=E.newGame(1);E.normalize(s);E.skipTutorial&&E.skipTutorial(s);s.day=10*Y;s.dagonPact=pact;s.houses.dagon={r:r??0,state:'peace'};const m=s.members[0];m.ageDays=40*Y;for(const id of ['x2','x3'])s.members.push({...JSON.parse(JSON.stringify(m)),id,name:id,ageDays:20*Y});s.head=m.id;return s;};
const deps={defense:()=>0,addRenown:(s,n)=>s.renown+=n,church:(s,n)=>(s.cf=(s.cf||0)+n),churchRank:()=>-1,addMinion:E.addMinion,hasBoat:()=>true};
ok(+BUILD.slice(1)>=55&&E.SCHEMA>=51,'R55+, save step 51+');
ok(D.changelog.entries.some(e=>e.build==='R55'),'changelog R55');
// locals
const LC=D.families.dagonLocals; ok(['outsider','tolerated','kin','enemy'].every(k=>LC[k].length===10)&&new Set(Object.values(LC).filter(Array.isArray).flat()).size===40,'40 distinct lines, 10 per mood');
ok(E.localsMood(base(undefined,-25))==='outsider'&&E.localsMood(base(undefined,0))==='tolerated'&&E.localsMood(base('join',0))==='kin'&&E.localsMood(base('expose',0))==='enemy','moods');
{ const s=base('join',0); ok(LC.kin.includes(E.localsLine(s)),'a kin line for a joined family'); s.day+=3; ok(E.localsLine(s)!==E.localsLine({...s,day:s.day-3}),'lines rotate'); }
// triggers
ok(E.deepRaidGap(base('expose',0))[0]===120&&!E.deepRaidGap(base('join',-80))&&!E.deepRaidGap(base(undefined,70))&&E.deepRaidGap(base('lapsed',0))[0]===300&&!E.deepRaidGap(base(undefined,-25))&&(()=>{const s=base(undefined,-25);s.doneQuests.push('inv1');return E.deepRaidGap(s)[0]===300;})()&&!E.deepRaidGap(base('bargain',0)),'who gets raided');
{ const s=base('bargain',0); s.hydra={result:'slain'}; ok(E.deepRaidGap(s)[0]===200,'Hydra slain'); s.deepRaidsWon=5; ok(!E.deepRaidGap(s)&&E.deepRaidsOver(s),'raids end: Hydra slain + 5 survived'); }
{ const s=base('expose',0); s.deepRaidsWon=4; ok(E.deepRaidPower(s)===200,'power grows'); s.deepRaidsWon=20; ok(E.deepRaidPower(s)===260,'capped'); }
// raid outcomes
{ let kid=0, n=0; for(let i=0;i<300;i++){ const s=base('expose',0); s.res.fish=100; s.res.pearls=10; const r=E.deepRaid(s,deps); n++; if(r==='kidnap'){kid++; const t=E.takenMembers(s)[0]; ok(t&&t.id!==s.head,'never the head'); } }
  ok(kid>5&&kid<70,'kidnap on some lost raids ('+kid+'/'+n+')'); }
{ const s=base('expose',0); s.members=s.members.slice(0,2); s.members[1].ageDays=5*Y; for(let i=0;i<100;i++)E.deepRaid(s,deps); ok(!E.takenMembers(s).length,'never the last adult'); }
{ const s=base('expose',0); const m=s.members[1]; m.alive=false; m.taken=s.day; s.revealed.push('q_surf'); ok(!E.questIssue(s,s.members[0],Q('q_surf'))||!/no one/.test(E.questIssue(s,s.members[0],Q('q_surf'))),'rescue open');
  E.rescueDone(s); ok(m.alive&&m.taken==null,'rescued'); m.alive=false; m.taken=s.day; s.day+=60; E.deepRaidDay(s,deps); ok(m.wentDown!=null,'60 days: gone down to Father'); }
{ const s=base('expose',0); s.boatHoled=s.day+30; ok(E.boatHoled(s),'a holed boat'); s.day+=31; ok(!E.boatHoled(s),'mended after 30 days'); }
{ const s=base('expose',0); const big={...deps,defense:()=>1e6}; ok(E.deepRaid(s,big)==='won'&&s.deepRaidsWon===1&&s.cf===25,'a win: renown, Church rep'); }
// templars + schedule
{ const s=base('expose',0); s.flags={dagonExpose:s.day}; E.deepRaidDay(s,deps); ok(s.minions.filter(x=>x.type==='templar').length===2&&s.deepRaidAt>=s.day+90,'Templars for a year; first raid 90+ days out'); s.day+=Y; E.deepRaidDay(s,deps); ok(!s.minions.some(x=>x.type==='templar'),'Templars leave'); }
// save step
{ const s=base('expose',0); delete s.deepRaidAt; STEPS.find(x=>x.n===51).run(s); ok(s.deepRaidAt===s.day+90,'step 51: first raid 90 days out'); }
{ const s=base('join',0); STEPS.find(x=>x.n===51).run(s); ok(s.deepRaidAt==null,'step 51: joined families never'); }
{ const s=base('expose',0); s.deepRaidAt=5; const l=E.deserialize(E.serialize(s)); ok(l.schema===E.SCHEMA&&l.deepRaidAt===5,'save/load'); }
console.log('r55 ok',pass);
