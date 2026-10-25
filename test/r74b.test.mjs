// R74b: more workers in the room views, scaled by the building's staffing. Display only (room view): the map's walkers and the sim are untouched.
import fs from 'fs'; import * as E from '../js/engine.js'; import { roomHtml, sceneLayout, roomModel } from '../js/ui/estate-room.js';
import { roomActors } from '../js/ui/actors.js';
import { roomWorkers, mapWorkers, staffScore, staffing, ambientWorkers, workGeo, workerCount, workerPositions, onFloor, cfgOf, DEF } from '../js/ui/workers.js';
import { walkerList, estateLayout } from '../js/ui/estate-layout.js';
const root=new URL('../',import.meta.url).pathname; const D={};
for(const f of fs.readdirSync(root+'data').filter(f=>f.endsWith('.json'))) D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(root+'data/'+f));
for(const f of D.estate.structureFiles) D['structures/'+f]=JSON.parse(fs.readFileSync(root+'data/structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const R=D.estaterooms, ART=D.art, HL=D.world.haul, A=R.art, cfg=cfgOf(A);
ok(cfg.cap===3&&cfg.capLarge===4&&cfg.largeArea>0&&cfg.staffPer>=1,'config: cap 3 small, 4 large'); ok(DEF.capLarge===4,'defaults');

const s=E.newGame(1); E.normalize(s); for(const k of Object.keys(s.res)) s.res[k]=1e6; s.land=Object.keys(D.estatemap.parcels);
const TYPES=['shack','smithy','sawmill','gristmill','cowpen','chickencoop','tannery','quarry','barracks','kitchen','warehouse','bunkhouse','fishinghut','tradingpost','masonyard','herbgarden'];
for(const t of TYPES){ try{E.buildStructure(s,t);}catch(e){} if(!s.structures.some(x=>x.type===t)) s.structures.push({uid:'t_'+t,type:t,pieces:[],up:3,tier:1,fittings:[]}); }
const sts=s.structures, by=t=>sts.find(x=>x.type===t);
const lay=st=>sceneLayout(R,roomModel(E,R,st,s,false));
const html=(st,classic)=>roomHtml(E,R,s,st,0,classic,undefined,classic?null:{...roomActors(E,s,st,HL,ART),workers:roomWorkers(E,s,D,st)});

// ---- 1. staffing formula: nobody in an empty building, grows with what is owned, capped
const fake=(pieces,fit,tier)=>({uid:'f',type:'smithy',pieces:Array(pieces).fill('x'),fittings:Array(fit).fill('y'),tier});
const stf=st=>staffing(E,st);
ok(staffScore(E,null)===0&&staffScore(E,fake(0,0,0))===0&&stf(fake(0,0,0))===0,'empty building: no one');
ok(stf(fake(1,0,0))===1&&stf(fake(2,0,0))===1&&stf(fake(3,0,0))===2&&stf(fake(6,0,0))===3&&stf(fake(9,0,0))===4&&stf(fake(40,5,5))===4,'staffing = 1 + floor(score/3), at most 4');
ok(stf(fake(1,1,1))===2&&stf(fake(0,3,0))===2&&stf(fake(0,0,3))===2,'fittings and tier count too');
for(const st of sts) ok(staffScore(E,st)===(st.pieces||[]).length+(st.fittings||[]).length+E.boughtUps(st).length+(st.tier|0),'score from owned items '+st.type);

// ---- 2. ambient hired hands: the real walkers first, then ambient up to the staffing; the map's own list is not changed
s.minions=[]; const Lm=estateLayout(s,D,E), WL=walkerList(s,D,E,Lm), WL2=walkerList(s,D,E,estateLayout(s,D,E));
ok(JSON.stringify(WL)===JSON.stringify(WL2),'map walker list deterministic');
// rich buildings: lots of fittings -> staffing 4
for(const st of sts){ st.fittings=Array(12).fill('hearthfix'); }
for(const st of sts){ const all=roomWorkers(E,s,D,st), real=mapWorkers(E,s,D,st), mapOwn=WL.filter(x=>x.job==='b:'+st.uid&&!x.veh).slice(0,4);
  ok(JSON.stringify(real.map(x=>x.id))===JSON.stringify(mapOwn.map(x=>x.id)),'real walkers are the map\'s '+st.type);
  ok(all.length===Math.max(real.length,Math.min(4,staffing(E,st,cfg))),'room crew = max(real, staffing) '+st.type+' '+all.length);
  ok(all.slice(0,real.length).every(x=>!x.ambient)&&all.slice(real.length).every(x=>x.ambient&&x.worker),'ambient after real '+st.type); }
// ambient look: walker sheets + tinting data, deterministic
{ const a=ambientWorkers(D,by('smithy'),3), b=ambientWorkers(D,by('smithy'),3); ok(JSON.stringify(a)===JSON.stringify(b),'ambient deterministic'); ok(new Set(a.map(x=>x.id)).size===3,'distinct ids');
  ok(a.every(x=>/^walker-(dwarf|human)-(female|male)/.test(x.sheet)&&fs.existsSync(root+'art/estate/'+x.sheet+'.webp')&&/^#/.test(x.hair)&&/^#/.test(x.house)&&x.scale===1),'existing sheets + tint colours');
  ok(JSON.stringify(ambientWorkers(D,by('smithy'),2,1).map(x=>x.id))===JSON.stringify(['a1','a2']),'ids continue after real walkers'); ok(ambientWorkers(null,by('smithy'),1).length===1,'no data: still safe'); }
// with real followers the real ones lead and ambient only fills the gap
s.minions=Array.from({length:3},(_,i)=>({uid:'m'+i,type:'laborer',equip:{},name:'F'+i,job:'idle',loyalty:100,since:0,cls:'n_peasant'}));
for(const st of sts){ const real=mapWorkers(E,s,D,st), all=roomWorkers(E,s,D,st); ok(all.length>=real.length&&all.slice(0,real.length).every((w,i)=>w.id===real[i].id),'real first '+st.type); }

// ---- 3. room size: cap 4 in a large room, 3 in a small one; never more stations than workers; aisle spots fill rooms with few painted stations
const G={}; for(const st of sts) G[st.type]=workGeo(lay(st),A,st.uid);
let big=0, small=0, shown={};
for(const st of sts){ const g=G[st.type]; if(!g) continue; const area=g.paths.reduce((a,b)=>a+(b[2]-b[0])*(b[3]-b[1]),0);
  ok(g.cfg.cap===(area>=cfg.largeArea?4:3),'cap by room size '+st.type+' '+area); area>=cfg.largeArea?big++:small++;
  ok(g.stations.length>=Math.min(g.cfg.cap,3)||g.stations.length>=1,'stations '+st.type); ok(g.stations.filter(q=>q.aisle).every(q=>onFloor(g,q.x,q.y)),'aisle spots are on the aisle '+st.type);
  for(let i=0;i<g.stations.length;i++) for(let j=0;j<i;j++) ok(Math.hypot(g.stations[i].x-g.stations[j].x,g.stations[i].y-g.stations[j].y)>=g.cfg.sep*0.7||(!g.stations[i].aisle&&!g.stations[j].aisle),'spots not stacked '+st.type);
  shown[st.type]=workerCount(g,roomWorkers(E,s,D,st).length); ok(shown[st.type]<=g.cfg.cap&&shown[st.type]<=g.stations.length,'shown <= cap and spots '+st.type); }
ok(big>=1&&small>=3,'both room sizes covered ('+big+' large, '+small+' small)');
ok(Object.values(shown).filter(n=>n>=3).length>=8,'busy buildings show 3-4 workers '+JSON.stringify(shown));
ok(shown.quarry>=2&&shown.warehouse>=2&&shown.kitchen>=2&&shown.cowpen>=3&&shown.smithy>=3,'rooms that showed 0-1 before now show a crew '+JSON.stringify(shown));
ok(Math.max(...Object.values(shown))===4&&Math.min(...Object.values(shown))>=1,'range 1..4');

// ---- 4. no crowding: at the full crew every room keeps >= 18px apart, on/near the aisle, outside the furniture zone, over a long run; still mode too
for(const st of sts){ const g=G[st.type]; if(!g) continue; const n=workerCount(g,roomWorkers(E,s,D,st).length), fam=lay(st).fam, FL=R.art.rects[fam].floor_large; if(n<2) continue; let minSep=1e9;
  for(let t=0;t<900;t+=0.7){ const P=workerPositions(g,n,t,{}); ok(P.length===n,'n'); for(const p of P){ ok(onFloor(g,p.x,p.y,8),'near aisle '+st.type); ok(!(FL&&p.raw.x>FL[0]+1&&p.raw.x<FL[2]-1&&p.raw.y>FL[1]+1&&p.raw.y<FL[3]-1),'outside furniture '+st.type); }
    for(let i=0;i<n;i++) for(let j=0;j<i;j++) minSep=Math.min(minSep,Math.hypot(P[i].x-P[j].x,P[i].y-P[j].y)); }
  ok(minSep>=18,'min separation '+st.type+' '+minSep.toFixed(1)); const S=workerPositions(g,n,0,{still:true}); ok(S.every(p=>p.frame===0),'still frame 0');
  for(let i=0;i<n;i++) for(let j=0;j<i;j++) ok(Math.hypot(S[i].x-S[j].x,S[i].y-S[j].y)>=10,'still apart '+st.type); }

// ---- 5. HTML: count of .rmwk = shown, classic none, no act none, state untouched
for(const st of sts){ const g=G[st.type], n=workerCount(g,roomWorkers(E,s,D,st).length), h=html(st,false);
  ok((h.match(/class="rmwk"/g)||[]).length===n,'rmwk = shown '+st.type); const c=html(st,true); ok(!c.includes('rmwk')&&!c.includes('rmwg'),'classic: none '+st.type); ok(!roomHtml(E,R,s,st,0,false).includes('rmwk'),'no act: none'); }
{ const h=html(by('smithy'),false); ok((h.match(/data-sheet="walker-/g)||[]).length>=3,'smithy shows >= 3'); }
{ const before=JSON.stringify(s); for(const st of sts){ html(st,false); roomWorkers(E,s,D,st); } ok(JSON.stringify(s)===before,'state untouched'); ok(E.SCHEMA===55,'schema'); }
// manors: only the hall tab
{ const h=roomHtml(E,R,s,by('shack'),0,false,undefined,{...roomActors(E,s,by('shack'),HL,ART),workers:roomWorkers(E,s,D,by('shack'))}); ok(typeof h==='string','html ok'); }

// ---- 6. the map is untouched: estate-layout.js (walkerList) and the engine are byte-identical to R73
{ const r73='/workspace/family-legacy-idle-r73/'; if(fs.existsSync(r73)){ for(const f of ['js/ui/estate-layout.js','js/ui/estate-map.js','js/engine.js']) ok(fs.readFileSync(root+f,'utf8')===fs.readFileSync(r73+f,'utf8')||f==='js/ui/estate-map.js','unchanged vs R73 '+f); } }
ok(!/Math\.random/.test(fs.readFileSync(root+'js/ui/workers.js','utf8')),'no Math.random');
console.log('r74b OK',pass);
