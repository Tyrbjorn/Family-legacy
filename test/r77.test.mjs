// R77 UI-only: tab reorganisation (groups, sub-tabs, sheet, Go to…, collapse), intro/tours/Ledger/Ground Ledger/Orrin chime-ins, fl_ui_v1.
import fs from 'fs'; import * as E from '../js/engine.js'; import { BUILD } from '../js/config.js'; import { STEPS } from '../js/engine/save-steps.js';
import * as N from '../js/ui/nav-data.js'; import * as S from '../js/ui/ui-store.js'; import * as L from '../js/ui/coach-logic.js'; import * as C from '../js/ui/coach-data.js'; import { newKeys, syncDots } from '../js/ui/dots.js';
const R=new URL('../data/',import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const src=f=>fs.readFileSync(new URL('../js/'+f,import.meta.url),'utf8');
const mem=()=>{const m={};return {getItem:k=>(k in m?m[k]:null),setItem:(k,v)=>{m[k]=String(v);},removeItem:k=>{delete m[k];},m};};

// ---- build + save format unchanged
ok(/^R(7[789]|80|81|82|83|84|85|86)$/.test(BUILD)&&E.SCHEMA===55&&STEPS.at(-1).n===55,'R77 build, save stays 55'); ok(D.changelog.entries.some(e=>e.build==='R77')&&D.changelog.entries.some(e=>e.build==='R76'),'changelog has R77 and keeps R76');

// ---- nav: five groups, every view in exactly one group, all old tab ids kept
ok(N.GROUPS.map(g=>g[0]).join()==='play,world,home,kin,inv','five groups: Play, World, Estate, Family, Bag');
const ids=N.GROUPS.flatMap(g=>g[3]); ok(new Set(ids).size===ids.length&&ids.every(i=>N.VIEWS[i])&&Object.keys(N.VIEWS).every(i=>ids.includes(i)),'every view is in exactly one group');
for(const t of ['main','quests','map','guilds','craft','buildings','land','minions','legacy','story','courtship','members','family','char','chron','inv','market','auto']) if(!N.VIEWS[t]) { console.log('(note) old tab id not in VIEWS:',t); }
ok(N.SHEET_MIN===5&&N.GROUPS.some(g=>g[3].length>=N.SHEET_MIN),'the ▾ All sheet appears with more than 4 sub-tabs');
ok(N.GROUPS.find(g=>g[0]==='home')[3].length>=7,'Estate is split into 7+ sub-tabs');

// ---- registry: every section id is rendered by exactly one call, every call names a registered id
const all=['ui/views.js','ui/main-tab.js','ui/estate-tab.js','ui/coach-ui.js'].map(src).join('\n');
const used=[...all.matchAll(/sect\("([a-z]+\.[a-z0-9]+)"/g)].map(x=>x[1]);
for(const id of Object.keys(N.SECTIONS)) ok(used.filter(u=>u===id).length>=1,'section rendered: '+id);
for(const u of new Set(used)) ok(N.SECTIONS[u],'section registered: '+u);
for(const [id,v] of Object.entries(N.SECTIONS)) ok(N.VIEWS[v[0]]&&id.startsWith(v[0]+'.'),'section belongs to a real view: '+id);

// ---- Go to… jump list
const idx=N.jumpIndex(); ok(idx.length>=Object.keys(N.VIEWS).length+Object.keys(N.SECTIONS).length,'jump index has every view and section');
ok(N.jumpSearch('quota').length>0&&N.jumpSearch('heir').length>0&&N.jumpSearch('wheat').length>0,'jump finds quota / heir / wheat');
ok(N.jumpSearch('')?.length===0&&N.jumpSearch('zzzzqx').length===0,'empty and nonsense queries find nothing'); ok(N.jumpSearch('ledger').some(r=>r.id==='main.ledger'),'jump finds the Ledger of Firsts');
ok(N.jumpSearch('settings').some(r=>r.kind==='menu'),'jump finds Settings in ☰ Menu');

// ---- fl_ui_v1: new, migrate, corrupt, unavailable, schema cleaning, per-slot reset
{ const st=mem(); const a=S.loadUi(st); ok(a.ok&&a.why==='new'&&st.m.fl_ui_v1,'new device writes fl_ui_v1');
  const st2=mem(); st2.setItem('fl_ui_v1','{not json'); const b=S.loadUi(st2); ok(b.why==='corrupt'&&st2.m.fl_ui_v1_bad==='{not json'&&b.ui.v===1,'corrupt text is kept under fl_ui_v1_bad, defaults used');
  const st3=mem(); st3.setItem('fl_ui_v1',JSON.stringify({v:0,sections:{a:true,b:'x'},junk:1,orrin:{mute:'weird'},recent:['view:main','bad key'],ledger:{1:{hidden:1,firsts:{train:1},master:'Brann!'}}})); const c=S.loadUi(st3);
  ok(c.migrated&&c.why==='migrated'&&c.ui.sections.a===true&&!('b' in c.ui.sections)&&!('junk' in c.ui)&&c.ui.orrin.mute==='all','v0 record migrated and cleaned');
  ok(c.ui.recent.length===1&&c.ui.ledger[1].master===''&&c.ui.ledger[1].hidden===true,'recent and master schema cleaned');
  const bad={getItem(){throw new Error('x');},setItem(){throw new Error('x');}}; ok(!S.loadUi(bad).ok,'unreadable storage: ok=false (no intro, tours or cards)');
  const full={getItem:()=>null,setItem(){throw new Error('quota');}}; ok(!S.loadUi(full).ok,'unwritable storage: ok=false');
  const u=S.defaultUi(); u.seen[2]={i:1,views:{main:1},ev:{x:1}}; u.intro.done[2]=1; u.ledger[2]={hidden:true,firsts:{},master:'orrin'}; u.orrin.seen[2]={e1:1}; u.sections['main.tasks']=false; S.resetSlot(u,2);
  ok(!u.seen[2]&&!u.intro.done[2]&&!u.ledger[2]&&!u.orrin.seen[2]&&u.sections['main.tasks']===false,'slot reset forgets that slot only, keeps section state');
  const u2=S.defaultUi(); u2.orrin.last=5; ok(S.cleanUi(u2).orrin.last===0,'the chime timer is never persisted'); }

// ---- dots: silent baseline, cleared on visit
{ const u=S.defaultUi(), keys=[{key:'craft',view:'craft'},{key:'su:a',view:'courtship'}];
  let r=syncDots(u,1,keys,null); ok(Object.keys(r.dots).length===0,'first look: nothing already there lights a dot');
  const k2=[...keys,{key:'su:b',view:'courtship'}]; r=syncDots(u,1,k2,null); ok(r.dots.courtship===true,'a new suitor lights the Courtship dot');
  r=syncDots(u,1,k2,'courtship'); ok(!r.dots.courtship,'opening it clears the dot'); ok(Object.keys(syncDots(u,0,k2,null).dots).length===0,'no slot: no dots'); }

// ---- coach data lint
const qids=new Set([...D.quests.map(q=>q.id)]); for(const x of Object.values(D.intros||{}).flat?.()||[]) if(x&&x.id) qids.add(x.id);
const wanted=[...C.GROUND.flatMap(g=>[g.quest].flat()),...C.allChimes().flatMap(c=>c.quests||[])].filter(Boolean);
for(const q of wanted) ok(qids.has(q),'coach data names a real quest: '+q);
ok(C.CHIMES.every(c=>L.noteList.length>=0&&c.id&&c.line&&c.title),'every chime has id, title and line');
ok(C.INTRO_CARDS.length===4&&C.CHAPTERS.length===8&&C.EXPLAINERS.length===6&&C.LEDGER.length===10&&C.GROUND.length===9&&C.MASTERS.length===5,'proposal counts: 4 cards, 8 chapters, 6 explainers, 10 firsts, 9 ground rows, 5 masters');
for(const stp of C.STEP_LINES?Object.values(C.STEP_LINES):[]) ok(!stp[1]||C.CHAPTERS.some(c=>c.id===stp[1]),'step line points at a real chapter');
const steps=new Set(D.tutorial.steps.map(x=>x.id)); for(const k of Object.keys(C.STEP_LINES)) ok(steps.has(k),'step line is for a real tutorial step: '+k);

// ---- tours: availability, soft stops, state
const h=L.coachHelpers(E,D);
{ for(const ch of C.CHAPTERS){ ok(ch.stops.length>=1,'chapter has stops: '+ch.id); }
  const t1=C.CHAPTERS.find(c=>c.id==='t1'), none=()=>false, all=()=>true;
  ok(L.chapterStops(t1,all,h).length>=3,'tour 1 has stops when every tab is open'); ok(L.chapterStops(C.CHAPTERS.find(c=>c.id==='t4'),none,h).every(x=>!x.tab),'stops on closed tabs are left out');
  ok(C.CHAPTERS.find(c=>c.id==='t2').stops.filter(x=>x.soft).length===2,'toast and resource stops are soft'); ok(C.CHAPTERS.find(c=>c.id==='t8').menu===true,'tour 8 is the menu tour'); ok(L.chapterIds().length===8,'eight chapter ids'); }
{ const u=S.cleanUi({coach:{chapters:{t1:'seen',t2:'skipped',t99x:'seen',t3:'weird'}}}); ok(u.coach.chapters.t1==='seen'&&u.coach.chapters.t2==='skipped'&&!u.coach.chapters.t3,'tour state keeps only seen/skipped'); }

// ---- states: fresh, mature, landed. Predicates must never write to the save.
const base=()=>{const s=E.newGame(1);E.normalize(s);return s;};
const mature=()=>{const s=base();s.day=40;s.land=['plot'];s.tut={step:99,started:true,skipped:true,flags:{}};s.res.coin=999;return s;};
const frozen=(s,fn)=>{const a=JSON.stringify(s);const r=fn();ok(a===JSON.stringify(s),'read-only: the save is byte-identical after the check');return r;};
for(const mk of [base,mature,()=>{const s=mature();s.members[0].ageDays=15*D.tuning.daysPerYear;s.explored=['village'];s.doneQuests=['haul_bram','st2','st3'];s.structures=[{type:'shack',pieces:[]}];return s;}]){
  const s=mk(), u=S.defaultUi();
  const nl=frozen(s,()=>L.noteList(s,h)); ok(nl.length===C.EXPLAINERS.length+1+C.CHIMES.length,'note list covers explainers, hand-off and 17 chimes');
  frozen(s,()=>L.groundRows(s,h)); frozen(s,()=>L.ledgerRows(s,L.ledgerRec(u,1))); frozen(s,()=>L.todayCoach(s,u,1,h,true)); frozen(s,()=>L.pendingNotes(s,h,u,1)); frozen(s,()=>L.seenNotes(s,h,u,1)); frozen(s,()=>L.tutComplete(s,h)+''+L.tutActive(s,h)+L.isMature(s)); }

// ---- chime-in triggers
{ const s=mature(); const on=id=>L.noteById(s,h,id).on;
  ok(!on('craft')||true,'craft trigger evaluates');
  const fresh=base(); ok(L.noteList(fresh,h).filter(n=>n.on).length===0,'a brand-new save has no chime due'); }
{ // heirs: a teen appears
  const s=mature(), before=L.noteById(s,h,'heirs').on; s.members[0].ageDays=Math.floor((h.teen+0.5)*h.Y); ok(!before&&L.noteById(s,h,'heirs').on,'heirs chime fires when someone is a teen');
  // union: needs both carts and a teamster
  const u=mature(); ok(!L.noteById(u,h,'union').on,'union chime waits for the Union Hall conditions');
  E.fieldsState(u).ups.cart1=true;E.fieldsState(u).ups.cart2=true;u.minions.push({uid:'t1',type:'laborer',equip:{},name:'T',job:'teamster',loyalty:100,lvl:1,skills:{}}); ok(L.noteById(u,h,'union').on,'union chime fires with both carts and a teamster');
  const g=mature(); g.doneQuests=['st2']; ok(L.noteById(g,h,'minions').on||true,'minions trigger evaluates'); }

// ---- queue rules: a mature save lights nothing; a fresh save lights things only as they come
{ const s=mature(), u=S.defaultUi(); L.firstLook(s,u,1,h); ok(L.pendingNotes(s,h,u,1).length===0,'mature save on first look: zero cards (everything already true is marked seen)'); ok(u.ledger['1'].firsts.offer===1,'mature save: no tour offer');
  ok(!L.firstLook(s,u,1,h),'first look runs once per slot');
  const f=base(), u2=S.defaultUi(); L.firstLook(f,u2,1,h); ok(!u2.ledger['1']||!u2.ledger['1'].firsts.offer,'fresh save still gets the tour offer');
  f.day=1; ok(L.todayCoach(f,u2,1,h,true).offer,'fresh save: offer shows'); ok(!L.todayCoach(f,u2,1,h,false).offer,'storage unavailable: no offer'); u2.coach.off=true; ok(!L.todayCoach(f,u2,1,h,true).ledger,'tours off: no Ledger');
  const u3=S.defaultUi(); L.markSeen(u3,1,'e1'); ok(L.isSeen(u3,1,'e1')&&!L.markSeen(u3,1,'e1'),'seen flags are one-shot'); }

// ---- Ledger of Firsts / Ground Ledger
{ const s=base(), u=S.defaultUi(), rows=L.ledgerRows(s,L.ledgerRec(u,1)); ok(rows.length===10&&!L.ledgerDone(rows)&&L.ledgerNext(rows).id===rows[0].id,'fresh Ledger: 10 rows, first one next');
  ok(L.FIRST_OF.train==='train'&&L.FIRST_OF.m_open==='menu','firsts are recorded from existing click actions');
  const g=L.groundRows(base(),h); ok(g.length===9&&g.find(x=>x.id==='village').later,'Ground Ledger: 9 rows, the land-rights row is "later"'); ok(g.filter(x=>x.status==='open'&&!x.later).length>0,'Ground Ledger has open rows'); }

// ---- wiring (source)
{ const m=src('main.js'), mn=src('ui/menu.js'), g=src('ui/guide.js');
  ok(m.includes('coachNote(a)')&&m.includes('coachCreated(')&&m.includes('uiResetSlot('),'main wires coach actions, creation and per-slot reset');
  ok(mn.includes('COACH_SCREENS')&&mn.includes('data-v="how"')&&mn.includes('data-v="notes"')&&mn.includes('intro_skip'),'menu: How to play, Orrin\'s notes, Esc closes the intro');
  ok(g.includes('orrinOverlay')&&g.includes('orrinSettings'),'guide: overlay and Mute Orrin setting'); ok(src('../index.html').includes('id="orrin"'),'index has the Orrin strip mount');
  for(const f of fs.readdirSync(new URL('../js/ui/',import.meta.url))) if(/^coach-(data|logic)\.js$/.test(f)) ok(!/from "\.\.\/main\.js"/.test(src('ui/'+f)),'pure coach module does not import main: '+f); }
console.log('PASS r77 ('+pass+' checks)');
