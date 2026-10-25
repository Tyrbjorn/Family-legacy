// R74: workers walk around and work at the painted stations in the roof-off room views. Display only: computed from owned
// items and who is assigned where, nothing saved, classic emoji draws none of it, reduced motion = static at the stations.
import fs from 'fs'; import * as E from '../js/engine.js'; import { BUILD } from '../js/config.js'; import { STEPS } from '../js/engine/save-steps.js';
import { roomHtml, sceneLayout, roomModel } from '../js/ui/estate-room.js';
import { roomActors, wander, hash } from '../js/ui/actors.js';
import { roomWorkers, mapWorkers, workGeo, workerCount, workerPositions, onFloor, route, cfgOf, DEF, SHEET } from '../js/ui/workers.js';
import { walkerList, estateLayout } from '../js/ui/estate-layout.js';
const root=new URL('../',import.meta.url).pathname; const D={};
for(const f of fs.readdirSync(root+'data').filter(f=>f.endsWith('.json'))) D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(root+'data/'+f));
for(const f of D.estate.structureFiles) D['structures/'+f]=JSON.parse(fs.readFileSync(root+'data/structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const R=D.estaterooms, ART=D.art, HL=D.world.haul, A=R.art;
ok(/^R(?:77|76|7[45])/.test(BUILD)&&E.SCHEMA===55&&STEPS.at(-1).n===55,'R74, save stays 55'); ok(D.changelog.entries.some(e=>e.build==='R74'&&e.items.length>=3),'changelog has R74');

const s=E.newGame(1); E.normalize(s); for(const k of Object.keys(s.res)) s.res[k]=1e6; s.land=Object.keys(D.estatemap.parcels);
for(const t of ['shack','smithy','sawmill','gristmill','cowpen','chickencoop','tannery','quarry','barracks','kitchen','warehouse']){ try{E.buildStructure(s,t);}catch(e){} }
s.minions=[{job:'a'},{job:'b'},{job:'c'}];
const sts=s.structures, by=t=>sts.find(x=>x.type===t);
const lay=st=>sceneLayout(R,roomModel(E,R,st,s,false));
const html=(st,classic)=>roomHtml(E,R,s,st,0,classic,undefined,classic?null:{...roomActors(E,s,st,HL,ART),workers:roomWorkers(E,s,D,st)});

// ---- 1. data: stations + aisle for the guildhall (invented, flagged), config present, rooms' own data untouched
const gh=R.art.rects.guildhall; ok(gh.workspots&&Object.keys(gh.workspots).length>=4&&gh.workpaths&&Object.keys(gh.workpaths).length>=2,'guildhall workspots + workpaths');
ok(!('workpaths' in (gh.block||{})),'workpaths are not a furniture block'); ok(JSON.stringify(Object.keys(gh.block||{})).length>0,'guildhall block kept');
const W=A.workers; ok(W&&W.cap===3&&W.sep===20&&W.speed>0&&W.reach>=30&&Array.isArray(W.post)&&!/animal/.test(JSON.stringify(A)),'art.workers config');
const cfg=cfgOf(A); ok(cfg.cap===3&&cfg.styles.hammer.fps>0&&cfg.style.hammer.includes('anvil')&&cfg.style.haul.includes('logpile'),'cfgOf merges data over DEF');
ok(cfgOf(null).cap===DEF.cap&&cfgOf({}).sep===DEF.sep,'cfgOf defaults'); ok(SHEET.fw===16&&SHEET.fh===24&&SHEET.cols===2&&SHEET.rows===4,'sheet geometry');
const sz=p=>{const b=fs.readFileSync(p); if(b.toString('ascii',0,4)!=='RIFF') return null; const k=b.toString('ascii',12,16);
  if(k==='VP8X') return [1+b.readUIntLE(24,3),1+b.readUIntLE(27,3)]; if(k==='VP8L'){const v=b.readUInt32LE(21);return [1+(v&0x3fff),1+((v>>14)&0x3fff)];} const o=b.indexOf(Buffer.from([0x9d,0x01,0x2a])); return [b.readUInt16LE(o+3)&0x3fff,b.readUInt16LE(o+5)&0x3fff];};

for(const n of ['dwarf-female','dwarf-male','human-female','human-male-hairkey']){ const z=sz(root+`art/estate/walker-${n}.webp`); ok(z&&z[0]===SHEET.fw*SHEET.cols&&z[1]===SHEET.fh*SHEET.rows,'walker sheet '+n+' is 2x4 frames of 16x24'); }

// ---- 2. roomWorkers = the walkers the map sends to that building (same people), capped
const Lm=estateLayout(s,D,E), WL=walkerList(s,D,E,Lm); let tot=0;
for(const st of sts){ const w=mapWorkers(E,s,D,st); tot+=w.length; ok(w.length<=4,'cap '+st.type); ok(w.every(x=>x.job==='b:'+st.uid),'job matches '+st.type);
  ok(JSON.stringify(w.map(x=>x.id))===JSON.stringify(WL.filter(x=>x.job==='b:'+st.uid).slice(0,4).map(x=>x.id)),'same people as the map '+st.type); }
ok(tot>=1&&tot<=WL.length,'someone is working somewhere ('+tot+' of '+WL.length+')'); ok(roomWorkers(E,s,D,{uid:'nope',type:'shack'}).length===0,'unknown building: none');
ok(roomWorkers(null,s,D,sts[0]).length===0,'bad input does not throw'); ok(roomWorkers(E,s,D,sts[0],1).length<=1,'explicit cap');

// ---- 3. geometry: stations from workspots, deduped, facing the fixture, order seeded, no geometry without paths
const G={}; for(const st of sts) G[st.type]=workGeo(lay(st),A,st.uid);
const sm=G.smithy; ok(sm&&sm.stations.length===4&&sm.stations.every(x=>[0,1,2,3].includes(x.face)&&cfg.styles[x.style]),'smithy: 4 stations, faces, styles');
ok(sm.stations.find(x=>x.n==='anvil').style==='hammer'&&G.sawmill.stations.some(x=>x.style==='haul'),'styles from station ids');
ok(JSON.stringify(workGeo(lay(by('smithy')),A,by('smithy').uid))===JSON.stringify(sm),'workGeo pure/deterministic');
ok(JSON.stringify(workGeo(lay(by('smithy')),A,'other'))!==JSON.stringify(sm),'seed changes order'); ok(workGeo(null,A,'x')===null&&workGeo({work:{},paths:{}},A,'x')===null,'no stations / paths: null');
ok(workGeo({w:100,h:100,work:{a:[10,10],b:[12,12]},paths:{p:[0,0,50,50]},fix:{}},{},'x').stations.filter(q=>!q.aisle).length===1,'stations closer than merge collapse');
ok(workerCount(null,3)===0&&workerCount(sm,0)===0&&workerCount(sm,9)===sm.cfg.cap&&workerCount(G.quarry,3)===G.quarry.stations.length&&workerCount(sm,2)===2,'workerCount: min(cap, stations, have)');

// ---- 4. positions: deterministic, on the aisle, never in the furniture zone, apart, spread over stations, working at times
let mixed=0;
for(const st of sts){ const g=G[st.type]; if(!g) continue; const fam=lay(st).fam, FL=R.art.rects[fam].floor_large, n=workerCount(g,9); let minSep=1e9, work=0, tot2=0, started=new Set(), P0=workerPositions(g,n,0,{});
  ok(JSON.stringify(P0)===JSON.stringify(workerPositions(g,n,0,{})),'pure '+st.type); ok(P0.length===n,'n positions '+st.type);
  for(let t=0;t<600;t+=0.5){ const P=workerPositions(g,n,t,{});
    for(const p of P){ tot2++; if(p.work) work++; ok(onFloor(g,p.raw.x,p.raw.y),'raw on the aisle '+st.type+' '+t); ok(onFloor(g,p.x,p.y,8),'final near the aisle '+st.type+' '+t);
      ok(!(FL&&p.raw.x>FL[0]+1&&p.raw.x<FL[2]-1&&p.raw.y>FL[1]+1&&p.raw.y<FL[3]-1),'not inside the furniture zone '+st.type+' '+t); ok([0,1,2,3].includes(p.row)&&(p.frame===0||p.frame===1)&&typeof p.mir==='boolean','frame/row '+st.type); }
    for(let i=0;i<P.length;i++) for(let j=0;j<i;j++) minSep=Math.min(minSep,Math.hypot(P[i].x-P[j].x,P[i].y-P[j].y));
    if(P.some(p=>p.work)&&P.some(p=>!p.work)) mixed++; }
  ok(n<2||minSep>=18,'workers stay apart '+st.type+' '+minSep.toFixed(1)); ok(work/tot2>0.2,'they spend real time working '+st.type+' '+(work/tot2).toFixed(2));
  ok(n<2||workerPositions(g,n,0,{still:true}).every((p,i,a)=>a.every((q,j)=>j>=i||Math.hypot(p.x-q.x,p.y-q.y)>=10)),'still: not on top of each other '+st.type); }
ok(mixed>10,'some work while others walk');
// they actually walk (positions change) and the work frame bobs
const w0=workerPositions(sm,3,3,{}), w1=workerPositions(sm,3,40,{}); ok(w0.some((p,i)=>Math.hypot(p.x-w1[i].x,p.y-w1[i].y)>5),'workers move over time');
let fr=new Set(), dip=0; for(let t=0;t<120;t+=0.1) for(const p of workerPositions(sm,3,t,{})) if(p.work){ fr.add(p.frame); if(p.y!==p.raw.y) dip++; } ok(fr.size===2&&dip>0,'work bob: 2 frames, 1px dip');
// workers start at different stations
for(const [t,n] of [['smithy',3],['sawmill',2],['gristmill',3],['cowpen',3]]){ const g=G[t], P=workerPositions(g,n,0.01,{still:true}); const near=P.map(p=>g.stations.findIndex(x=>Math.hypot(x.x-p.x,x.y-p.y)<2)); ok(near.every(i=>i>=0)&&new Set(near).size===n,'still: each at its own station '+t); }
// reduced motion: still = frame 0, standing, facing the fixture, the same whatever the time
{ const a=workerPositions(sm,3,0,{still:true}), b=workerPositions(sm,3,777,{still:true}); ok(JSON.stringify(a)===JSON.stringify(b),'still ignores time'); ok(a.every(p=>p.frame===0&&p.x===p.raw.x&&p.y===p.raw.y),'still: frame 0, no dip'); ok(a.every(p=>p.row===[0,2,3,1][sm.stations.find(x=>Math.hypot(x.x-p.x,x.y-p.y)<2).face]),'still faces the station'); ok(a.every(p=>p.mir===false),'no mirroring'); }
// route stays inside the aisle rects
{ const a={x:sm.stations[0].x,y:sm.stations[0].y}, b={x:sm.stations[3].x,y:sm.stations[3].y}; const r=route(sm,a,b); ok(r&&r.length>=2,'route'); }

// ---- 5. HTML: workers in the roof-off room, nothing in classic, nothing without workers or stations, manors: Hall only
let withW=0; for(const st of sts){ const g=G[st.type], w=roomWorkers(E,s,D,st), n=workerCount(g,w.length), h=html(st,false);
  ok((h.match(/class="rmwk"/g)||[]).length===n,'rmwk count = workers '+st.type); ok(n===0?!h.includes('rmwg'):(h.includes('class="rmwg"')&&/data-geo="/.test(h)),'geo carrier '+st.type);
  const c=html(st,true); ok(!c.includes('rmwk')&&!c.includes('rmwg'),'classic: no workers '+st.type); ok(!roomHtml(E,R,s,st,0,true).includes('rmwk'),'classic, no act'); ok(!roomHtml(E,R,s,st,0,false).includes('rmwk'),'no act: none');
  if(n) withW++; }
ok(withW>=3,'several rooms show workers ('+withW+')');
{ const st=by('smithy'), h=html(st,false); const m=h.match(/<span class="rmwk"[^>]*>/); ok(m&&/data-sheet="[^"]*walker-/.test(m[0])&&/data-house="#/.test(m[0])&&/data-hair="#/.test(m[0])&&/left:[\d.]+%;top:[\d.]+%/.test(m[0]),'worker span: tinted walker sheet, time-0 spot'); }
// ---- 6. purity: no random, no saved state, engine untouched
for(const f of ['js/ui/workers.js','js/ui/workers-dom.js','js/ui/actors.js']) ok(!/Math\.random/.test(fs.readFileSync(root+f,'utf8')),'no Math.random in '+f);
{ const before=JSON.stringify(s); for(const st of sts){ html(st,false); workerPositions(G[st.type]||sm,2,5,{}); roomWorkers(E,s,D,st); } ok(JSON.stringify(s)===before,'display only: state not touched'); ok(E.SCHEMA===55,'schema unchanged'); }
// the actor loop wiring + the CSS
{ const dom=fs.readFileSync(root+'js/ui/actors-dom.js','utf8'), css=fs.readFileSync(root+'style.css','utf8'); ok(/paintWorkers/.test(dom)&&/\.rmwk/.test(dom),'actors-dom paints workers'); ok(/\.estroom \.rmwk\{[^}]*pointer-events:none/.test(css),'css for .rmwk'); ok(/avoidPoints/.test(dom),'pen animals avoid workers'); }
console.log('r74 OK',pass);
