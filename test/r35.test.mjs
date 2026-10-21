// R35: Leans, town apprenticeships, Family Tutor fix, inheritance
import fs from 'fs'; import * as E from '../js/engine.js'; import { T } from '../js/engine/state.js';
const R=new URL('../data/',import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const Y=T.daysPerYear, fresh=()=>{const s=E.newGame(1);E.normalize(s);s.fog=false;return s;};
const kid=(s,age,o={})=>{const m=E.newMember(s,{gender:'m',age:0,parents:o.parents||null});m.ageDays=age*Y;s.members.push(m);return m;};
const A=D.apprenticeships;
ok(A.masters.length>=8&&A.minAge===14&&A.maxAge===17&&A.xpMult===1.5&&A.serveDays===720,'8 masters, ages 14-17, x1.5, 720 days');
ok(A.masters.every(M=>D.towns.find(t=>t.id===M.town)&&M.skills.every(k=>D.skills.find(x=>x.id===k))&&D.legacy.familyAuto.tracks[M.track]),'masters: real towns, skills, tracks');
// leans
{ const s=fresh(); let two=0,keen=0; for(let i=0;i<200;i++){const m=kid(s,1);m.traits=['keeneyed'];E.rollLean(s,m,[]); const z=kid(s,1);z.traits=[];E.rollLean(s,z,[]); if(z.lean.length===2)two++; if(m.lean[0]==='lodge')keen++; ok(m.lean.length>=1&&m.lean.length<=2,'1-2 leans');}
  ok(keen>150,'keen-eyed leans Wilds ('+keen+'/200)'); ok(two>0,'some get a second lean');
  const p=kid(s,30); p.guild={id:'collegium',rank:0,rep:0}; let col=0; for(let i=0;i<200;i++){const m=kid(s,1);m.traits=[];E.rollLean(s,m,[p]); if(m.lean.includes('collegium'))col++;} ok(col>180,'parent guild drives the lean');
  const m=kid(s,5); m.lean=['lodge']; ok(E.leanXp(m,'hunting')===0.1&&E.leanXp(m,'smithing')===0,'+10% XP on lean guild skills only');
  const b=E.xpMult(s,m,'hunting'), c=(m.lean=[],E.xpMult(s,m,'hunting')); ok(Math.abs(b-c-0.1)<1e-9,'xpMult includes the lean'); }
// apprenticeships
{ const s=fresh(); const m=kid(s,13); ok(/age 14/.test(E.apprIssue(s,m,'m_smith')),'under 14 refused');
  m.ageDays=14*Y; ok(!E.apprIssue(s,m,'m_smith')&&E.setAppr(s,m,'m_smith'),'14 placed'); ok(m.pins.appr,'manual choice pins');
  const n=kid(s,15); ok(/no free place/.test(E.apprIssue(s,n,'m_smith')),'one place per master');
  m.ageDays=18*Y; E.apprDay(s,m); ok(m.appr===null&&s.log.some(l=>/came of age/.test(l.msg)),'coming of age ends it'); m.ageDays=17*Y;
  ok(E.setAppr(s,m,'m_smith'),'re-place'); const c0=s.res.coin; E.apprDay(s,m); ok(s.res.coin===c0+1,'wage paid');
  m.appr.since=-1000; E.apprDay(s,m); ok(m.apprDone.includes('m_smith')&&!m.appr&&s.log.some(l=>/finished their apprenticeship/.test(l.msg)),'720 days finishes with log');
  ok(E.apprFee(m,'hearth')===0.5&&E.apprRep(m,'hearth')===20&&E.apprFee(m,'vanguard')===1,'reward: hearth fee half, +20 rep');
  ok(/already trained/.test(E.apprIssue(s,m,'m_smith')),'no repeat with same master');
  const t=kid(s,15); E.setAppr(s,t,'m_drill'); s.day=(s.day||0)+100; E.setAppr(s,t,'m_hunter'); ok(t.appr.id==='m_hunter'&&t.appr.since===s.day,'switching resets progress');
  // exclusive skill opens while placed
  const ex=D.skills.find(k=>k.exclusive&&A.masters.some(M=>M.skills.includes(k.id)));
  if(ex){const M=A.masters.find(M=>M.skills.includes(ex.id)); const q=kid(s,14); ok(!E.skillOpen(q,ex.id),'exclusive closed before'); E.setAppr(s,q,M.id)||(q.appr={id:M.id,since:0}); ok(E.skillOpen(q,ex.id),'exclusive '+ex.id+' open while apprenticed');}
  // hidden town
  const H=A.masters.find(M=>D.towns.find(t=>t.id===M.town).hidden); if(H){const s2=E.newGame(1);E.normalize(s2);const z=kid(s2,14);ok(/find/.test(E.apprIssue(s2,z,H.id)),'unknown town refused');} }
// family tutor
{ const s=fresh(); const m=kid(s,14); m.lean=['lodge']; ok(E.tutorPlace(s,m)&&E.masterDef(m.appr.id).track==='lodge','tutor places by lean');
  const n=kid(s,14); n.lean=['lodge','hearth']; E.tutorPlace(s,n); ok(n.appr&&E.masterDef(n.appr.id).track==='hearth','falls back to second lean when full');
  const p=kid(s,14); p.lean=['hearth']; p.pins={appr:true}; ok(!E.tutorPlace(s,p),'respects pins.appr');
  // kidSkill bug fix: never returns a closed skill
  const k=kid(s,8); k.track=null; k.lean=['vanguard']; for(let d=0;d<30;d++){k.ageDays++; const sk=E.kidSkill(s,k); ok(!sk||E.skillOpen(k,sk),'kidSkill never picks a closed skill');}
  ok(E.trackFor(s,k)==='vanguard'||k.track==='vanguard','track follows lean'); }
// inheritance
{ const s=fresh(); const a=kid(s,30), b=kid(s,30); Object.assign(a.stats,{STR:20,AGI:5,INT:5,WIL:5,CHA:5,VIT:5}); Object.assign(b.stats,{STR:18,AGI:5,INT:21,WIL:21,CHA:21,VIT:5});
  a.skills.hunting.lvl=20; a.skills.archery&&(a.skills.archery.lvl=15);
  const inh=E.inheritFrom([a,b]); ok(inh.stats.STR===3,'STR +3 (cap)'); ok(Object.values(inh.stats).every(v=>v<=3)&&Object.values(inh.stats).reduce((x,y)=>x+y,0)<=8,'caps +3 each, +8 total');
  ok(inh.skills.hunting===0.2,'parent top skill +20% XP');
  const c=kid(s,0); const st0={...c.stats}; E.birthInherit(s,c,[a,b]); ok(c.stats.STR===st0.STR+3&&c.lean.length>=1&&c.appr===null,'birth applies stats + lean');
  ok(Math.abs(E.inhXp(c,'hunting')-0.2)<1e-9,'kid gets skill boost'); c.ageDays=18*Y; ok(E.inhXp(c,'hunting')===0,'boost ends at 18');
  const w=kid(s,30); const i2=E.inheritFrom([w]); ok(!Object.keys(i2.stats).length,'average parents give nothing'); 
  const two=kid(s,30); two.skills.hunting.lvl=20; ok(E.inheritFrom([a,two]).skills.hunting===0.4,'both parents same skill: cap 40%'); }
// birth in time.js uses it
ok(fs.readFileSync(new URL('../js/engine/time.js',import.meta.url)).toString().includes('birthInherit(s, c, [m, sp])'),'birth hook');
// migration
{ const s=fresh(); s.schema=34; const k=kid(s,10); delete k.lean; delete k.inh; delete k.appr; const st={...k.stats}; E.migrate?E.migrate(s):E.normalize(s);
  ok(Array.isArray(k.lean)&&k.appr===null&&Array.isArray(k.apprDone)&&k.inh&&JSON.stringify(k.stats)===JSON.stringify(st),'v35 migration: lean, no placement, no stat change');
  ok(s.members.filter(m=>m.alive).every(m=>m.lean&&m.inh),'all living get lean + inh'); ok(E.SCHEMA>=35,'schema 35+'); }
console.log('r35 ok',pass);
