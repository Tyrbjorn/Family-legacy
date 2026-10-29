// R78 teen journeyman: Layer A (16 teen jobs, ages 14-17, modest pay, unlock by master) + Layer B (idle journeyman wage / XP from day 360)
import fs from 'fs'; import * as E from '../js/engine.js'; import { T } from '../js/engine/state.js'; import { BUILD } from '../js/config.js'; import { STEPS } from '../js/engine/save-steps.js';
import { CHIMES } from '../js/ui/coach-data.js';
const R=new URL('../data/',import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const Y=T.daysPerYear, fresh=()=>{const s=E.newGame(1);E.normalize(s);s.fog=false;return s;};
const kid=(s,age)=>{const m=E.newMember(s,{gender:'m',age:0,parents:null});m.ageDays=age*Y;m.apprDone=m.apprDone||[];s.members.push(m);return m;};
const A=D.apprenticeships, JM=D.jobs.filter(j=>j.journeyman), OLD=D.jobs.filter(j=>!j.journeyman);

// ---- build, data, no schema change
ok(/^R(7[89]|80|81|82|83|84|85|86)$/.test(BUILD)&&D.changelog.entries.some(e=>e.build==='R78'&&e.items.length>=3),'BUILD R78+ and changelog has R78');
ok(E.SCHEMA===55&&STEPS.at(-1).n===55,'no SAVE_VERSION / schema bump: stays 55');
ok(OLD.length===8&&D.jobs.slice(0,8).every(j=>!j.journeyman),'the 8 original jobs are unchanged and first');
ok(JM.length===16&&new Set(JM.map(j=>j.id)).size===16,'16 journeyman jobs');
ok(A.jFrom===360&&A.jwage===1&&A.jxpMult===2&&A.serveDays===720,'defaults: jFrom 360, +1 coin, x2.0 XP');
ok(A.masters.length===9&&A.masters.every(M=>(M.jobs||[]).length>=1&&M.jobs.length<=2&&M.jobs.every(id=>JM.find(j=>j.id===id&&j.journeyman===M.id))),'every master lists its 1-2 jobs, and they point back');
ok(A.masters.find(M=>M.id==='m_drill').jobs.length===1&&A.masters.filter(M=>M.jobs.length===2).length===7,'Holt and Ysolde 1 job, the other 7 masters 2');
ok(JM.every(j=>j.maxAge===17&&j.minAge>=14&&j.minAge<=16&&j.payChild>=1.5&&j.payChild<=3&&j.payAdult===j.payChild),'ages 14-17, teen pay 1.5-3');
ok(Math.max(...JM.map(j=>j.payChild))<Math.min(...OLD.map(j=>j.payAdult)),'teen pay always below the cheapest adult job');
ok(JM.every(j=>j.skills.every(k=>{const M=A.masters.find(x=>x.id===j.journeyman);return M.skills.includes(k)&&D.skills.find(x=>x.id===k);})),'job skills are the master\'s skills');
ok(JM.every(j=>Object.keys(j.stats).every(k=>['STR','AGI','INT','WIL','CHA','VIT'].includes(k))&&Object.values(j.stats).every(v=>v>=0.01&&v<=0.02)),'stat gains 0.01-0.02');
ok(JM.filter(j=>j.stage===2).every(j=>j.minAge===16)&&JM.filter(j=>j.stage===1).every(j=>j.minAge<=15),'stage 2 = 16-17, stage 1 = 14-15+');

// ---- Layer A gates
{ const s=fresh(); const j1=JM.find(j=>j.id==='jm_forge_hand'), j2=JM.find(j=>j.id==='jm_journeyman_smith');
  const t=kid(s,15);
  ok(/needs Brann/.test(E.teenJobIssue(s,t,j1))&&!E.jobOk(t,j1,s),'unplaced teen locked, with reason');
  ok(E.setAppr(s,t,'m_smith')&&E.teenJobIssue(s,t,j1)===null&&E.jobOk(t,j1,s),'placed teen can take the stage-1 job');
  ok(/age 16/.test(E.teenJobIssue(s,t,j2)),'stage 2 needs age 16');
  const u=kid(s,16); E.setAppr(s,u,'m_smith')||(u.appr={id:'m_smith',since:s.day}); ok(/half-way/.test(E.teenJobIssue(s,u,j2)),'16 and fresh: stage 2 locked until half-way');
  s.day=u.appr.since+359; ok(E.teenJobIssue(s,u,j2)!==null,'day 359: still locked'); s.day=u.appr.since+360; ok(E.teenJobIssue(s,u,j2)===null,'day 360: open');
  ok(!E.jobOk(u,j2),'without s a stage-2 job reads as locked (safe default)');
  const o=kid(s,16); o.apprDone=['m_smith']; ok(E.teenJobIssue(s,o,j2)===null&&E.teenJobIssue(s,o,j1)===null,'finished apprentices keep both jobs');
  const wrong=kid(s,16); E.setAppr(s,wrong,'m_hunter'); ok(/needs Brann/.test(E.teenJobIssue(s,wrong,j1)),'another master\'s apprentice cannot take it');
  const c=kid(s,13); ok(/age 14/.test(E.teenJobIssue(s,c,j1)),'13 too young');
  const hd=JM.find(j=>j.id==='jm_gate_watch_runner'); const g=kid(s,14); E.setAppr(s,g,'m_drill'); ok(/age 15/.test(E.teenJobIssue(s,g,hd)),'Holt\'s job needs 15'); g.ageDays=15*Y; ok(E.teenJobIssue(s,g,hd)===null,'15 ok');
  // adults are locked out of every journeyman job (maxAge), original jobs unchanged
  const ad=kid(s,18); ok(JM.every(j=>/only/.test(E.teenJobIssue(s,ad,j))&&!E.jobOk(ad,j,s)),'18-year-olds are locked out of all 16');
  ad.apprDone=A.masters.map(M=>M.id); ok(JM.every(j=>!E.jobOk(ad,j,s)),'even with every master finished');
  ok(OLD.every(j=>E.jobOk(ad,j,s)===true&&E.jobOk(ad,j)===true),'originals: adult ok, with or without s');
  const ch=kid(s,9); ok(OLD.filter(j=>j.minAge<=9).every(j=>E.jobOk(ch,j,s))&&JM.every(j=>!E.jobOk(ch,j,s)),'children keep their old jobs, no journeyman jobs');
  // actionAllowed + working a job pays teen pay and trains
  const w=kid(s,15); w.appr={id:'m_smith',since:s.day}; s.activeId=w.id; E.setAction(s,{type:'job',target:'jm_forge_hand'});
  ok(w.action&&w.action.target==='jm_forge_hand'&&E.actionAllowed(s,w,w.action),'a placed teen can start the job');
  const c0=s.res.coin, x0=w.skills.smithing.xp+w.skills.smithing.lvl*1e6; for(let i=0;i<5;i++)E.tickReal?0:0;
  E.advanceReal(s,30);
  ok(s.res.coin>c0,'job pays coin'); ok(w.skills.smithing.xp+w.skills.smithing.lvl*1e6>x0,'job trains the master\'s skill (guild-exclusive ones too)');
  const v=kid(s,15); s.activeId=v.id; E.setAction(s,{type:'job',target:'jm_forge_hand'}); ok(!v.action||v.action.type!=='job'||!E.actionAllowed(s,v,v.action),'unplaced teen cannot start it'); }

// ---- Layer B
{ const s=fresh(); const t=kid(s,15); E.setAppr(s,t,'m_smith',true); const since=t.appr.since;
  ok(!E.isJourneyman(s,t)&&E.apprXpMult(s,t)===1.5,'new apprentice: x1.5');
  let c0=s.res.coin; E.apprDay(s,t); ok(s.res.coin===c0+1,'wage 1 before the half-way mark');
  s.day=since+359; ok(!E.isJourneyman(s,t),'day 359 not yet');
  s.day=since+360; ok(E.isJourneyman(s,t)&&E.apprXpMult(s,t)===2,'day 360: journeyman, x2.0');
  c0=s.res.coin; E.apprDay(s,t); ok(s.res.coin===c0+2,'journeyman wage 1+1 (Brann)'); ok(s.log.some(l=>/is now a journeyman under Brann/.test(l.msg)),'one log line at the start of the stage');
  s.day=since+361; const n=s.log.length; E.apprDay(s,t); ok(!s.log.slice(n).some(l=>/is now a journeyman/.test(l.msg)),'the line is not repeated');
  const p=kid(s,15); p.appr={id:'m_merchant',since:s.day-400}; c0=s.res.coin; E.apprDay(s,p); ok(s.res.coin===c0+3,'Pell: wage 2 + 1 = 3, still below every adult job (6)');
  ok(3<Math.min(...OLD.map(j=>j.payAdult)),'3/day < cheapest adult job');
  // idle lessons use the journeyman multiplier
  const q=kid(s,16); q.appr={id:'m_smith',since:s.day};
  const sk=E.apprSkill(q), lv0=()=>q.skills[sk].xp+q.skills[sk].lvl*1e6;
  const a0=lv0(); E.advanceReal(s,10); const early=lv0()-a0;
  q.appr.since=s.day-400; const b0=lv0(); E.advanceReal(s,10); const late=lv0()-b0;
  ok(early>0&&late>early,'journeyman lessons give more XP (x2.0 vs x1.5): '+early.toFixed(2)+' -> '+late.toFixed(2));
  // finishing still works; adults never get journeyman anything
  const f=kid(s,16); f.appr={id:'m_smith',since:s.day-720}; E.apprDay(s,f); ok(f.apprDone.includes('m_smith')&&!f.appr,'720 days still finishes');
  const ad=kid(s,17); ad.appr={id:'m_smith',since:s.day-500}; ad.ageDays=18*Y; c0=s.res.coin; E.apprDay(s,ad); ok(s.res.coin===c0&&!ad.appr,'an 18-year-old gets nothing: left the workshop');
  ok(!E.isJourneyman(s,ad),'no journeyman after leaving'); }

// ---- no save fields: journeyman state is computed
{ const s=fresh(); const t=kid(s,15); E.setAppr(s,t,'m_smith',true); const before=JSON.stringify(t.appr); s.day+=400; E.apprDay(s,t); ok(JSON.stringify(t.appr)===before,'m.appr gains no fields'); ok(Object.keys(t.appr).sort().join()==='id,since','appr is still {id, since}'); }

// ---- original behaviour is intact (the old jobs, kids' idle path, Ysolde gate)
{ const s=fresh(); const m=E.active(s); m.ageDays=20*Y; E.setAction(s,{type:'job',target:'shop'}); ok(m.action&&m.action.target==='shop','adult shop job still works');
  const t=kid(s,15); const y=JM.find(j=>j.id==='jm_mews_hand'); ok(/Ysolde/.test(E.teenJobIssue(s,t,y)),'Ysolde job: locked until placed or finished'); ok(!!E.apprIssue(s,t,'m_falcon'),'placement with Ysolde still blocked early'); }

// ---- UI + Orrin note (UI-only, in the existing chime layer)
{ const mt=fs.readFileSync(new URL('../js/ui/main-tab.js',import.meta.url),'utf8'), vw=fs.readFileSync(new URL('../js/ui/views.js',import.meta.url),'utf8'), nd=fs.readFileSync(new URL('../js/ui/nav-data.js',import.meta.url),'utf8'), ct=fs.readFileSync(new URL('../js/ui/character-tab.js',import.meta.url),'utf8');
  ok(/export function jmjobsv/.test(mt)&&/teenJobIssue\(s, m, j\)/.test(mt),'Jobs tab: journeyman list with lock reasons');
  ok(/sect\("jobs\.journeyman", jmjobsv\(\)\)/.test(vw)&&/"jobs\.journeyman"/.test(nd),'collapsible section registered under Jobs');
  ok(/isJourneyman/.test(ct)&&/apprXpMult/.test(ct),'Character tab shows the journeyman stage');
  const h=CHIMES.find(c=>c.id==='heirs'); ok(h&&/At 14 an heir can take a master/.test(h.line)&&/half-way mark they are a journeyman/.test(h.line),'Orrin heirs note explains journeyman work');
  const lg=fs.readFileSync(new URL('../js/ui/coach-logic.js',import.meta.url),'utf8'); ok(/heirs: \(s, h\) => living\(s\)\.some\(m => \{ const y = Math\.floor\(\(m\.ageDays \| 0\) \/ h\.Y\); return y >= h\.teen/.test(lg),'the note fires when a living member reaches the teen age (14)');
  const ij=JSON.parse(fs.readFileSync(R+'intros.json','utf8')); ok(!ij.lines.some(l=>/journeyman/i.test(l.id+l.name)),'no new intros.json quest line (no coin reward added)'); }
console.log('r78 ok '+pass+' checks');
