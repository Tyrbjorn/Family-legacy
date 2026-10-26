// R73: animals, mounts and wagons art wired in (icons everywhere, pen animals / bees / stall animals in the roof-off rooms, wagons /
// riders / boat on the estate map). Display only: computed from owned items, nothing saved, classic emoji draws none of it.
import fs from 'fs'; import * as E from '../js/engine.js'; import { BUILD } from '../js/config.js'; import { STEPS } from '../js/engine/save-steps.js';
import { roomHtml, sceneLayout, roomModel } from '../js/ui/estate-room.js';
import { wander, spread, penPositions, penCount, roomActors, vehicleSlots, stallDraft, stallCap, draftList, ownedTiers, MAX_PEN, MAX_VEH, VEH_SHEET, PEN_SHEET, KIND_OPTS } from '../js/ui/actors.js';
import { vehicleList, estateLayout } from '../js/ui/estate-layout.js';
import { iconHtml, spriteFor } from '../js/art.js';
const root=new URL('../',import.meta.url).pathname; const D={};
for(const f of fs.readdirSync(root+'data').filter(f=>f.endsWith('.json'))) D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(root+'data/'+f));
for(const f of D.estate.structureFiles) D['structures/'+f]=JSON.parse(fs.readFileSync(root+'data/structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const R=D.estaterooms, ART=D.art, HL=D.world.haul;
const size=p=>{const b=fs.readFileSync(p); if(b.toString('ascii',0,4)!=='RIFF') return null; const k=b.toString('ascii',12,16);
  if(k==='VP8X') return [1+b.readUIntLE(24,3),1+b.readUIntLE(27,3)]; if(k==='VP8L'){const v=b.readUInt32LE(21);return [1+(v&0x3fff),1+((v>>14)&0x3fff)];} const o=b.indexOf(Buffer.from([0x9d,0x01,0x2a])); return [b.readUInt16LE(o+3)&0x3fff,b.readUInt16LE(o+5)&0x3fff];};
const T={}; for(const f of D.estate.structureFiles){const d=D['structures/'+f]; for(const x of (Array.isArray(d)?d:(d.structures||Object.values(d)))) T[x.id]=x;}
ok(/^R(?:82|81|80|79|78|77|76|7[345])/.test(BUILD)&&E.SCHEMA===55&&STEPS.at(-1).n===55,'R73, save stays 55'); ok(D.changelog.entries.some(e=>e.build==='R73')&&D.changelog.entries.some(e=>e.build==='R72'),'changelog');

// ---- 1. art data: every file exists with the size it claims; every game id maps to a sprite
for(const [k,v] of Object.entries(ART.sprites)) if(v.file.startsWith('art/animals/')&&!v.file.includes('/sheets/')){ ok(fs.existsSync(root+v.file),'icon file '+k); const z=size(root+v.file); ok(z&&z[0]===v.size&&z[1]===v.size,'icon size '+k); ok(v.size===(/-sm$/.test(k)?24:64),'-sm icons are 24px, the rest 64px '+k); }
for(const k of ['seaboat','ox','drafthorse','mule','ram','pony','cow','hen']) ok(ART.sprites[k+'-sm']&&ART.sprites[k+'-sm'].from.includes('batch-animals-c'),'batch c -sm icon '+k);
ok(ART.sheets['seaboat-moored'].fw===32&&ART.sheets['seaboat-moored'].fh===24&&ART.sheets['chariot-walk'].fw===64&&ART.sheets['chariot-walk'].fh===48&&ART.sheets['rider-courser'].fw===32&&ART.sheets['cow-walk'].fw===24&&ART.sheets['hen-walk'].fw===16,'batch c frame sizes');
for(const [id,k] of Object.entries(ART.draftSheet)) ok(ART.sheets[k]&&ART.sheets[k].kind==='idle'&&ART.sheets[k].fw===24&&ART.sheets[k].fh===20,'draft idle sheet '+id);
ok(Object.keys(ART.draftSheet).sort().join()==='horse,mule,ox,pony,ram','5 draft idle sheets');
for(const [k,S] of Object.entries(ART.sheets)){ ok(fs.existsSync(root+S.file),'sheet file '+k); const z=size(root+S.file); ok(z[0]===S.fw*S.cols&&z[1]===S.fh*S.rows,'sheet frame math '+k+' '+z); ok(S.kind==='idle'?S.rows===1&&S.cols===2:S.kind==='strip'?S.rows===1&&S.cols===4:(S.kind==='walk'&&S.cols===4&&S.rows===3),'sheet layout '+k); }
for(const [m,sp] of [[ART.an,'an'],[ART.veh,'veh'],[ART.vehSm,'vehSm']]) for(const [id,key] of Object.entries(m)) ok(ART.sprites[key]&&ART.sprites[key].file,sp+' maps '+id+' -> '+key);
for(const id of Object.keys(HL.animals)) ok(ART.an[id],'draft animal has an icon '+id);
for(const t of HL.tiers) ok(ART.veh[t.id]||t.coast&&ART.veh.seaboat,'haul tier has a vehicle icon '+t.id); ok(ART.veh.wagoncart&&ART.veh.seaboat,'wagon + boat icons');
ok(ART.an.pony&&ART.an.courser&&ART.an.warhorse,'3 mount icons');
ok(ART.an.courser===ART.an.horse,'courser reuses the drafthorse icon (invented fallback)'); ok(!ART.anSm.courser&&!ART.anSm.warhorse&&!ART.vehSm.warhorse,'courser and warhorse have no -sm icon');
ok(VEH_SHEET.warchariot==='chariot-walk'&&VEH_SHEET['rider:courser']==='rider-courser'&&VEH_SHEET['rider:warhorse']==='rider-warhorse'&&VEH_SHEET.seaboat==='seaboat-moored'&&VEH_SHEET['rider:pony']==='rider-noble-pony','batch c sheets wired, no fallbacks left');
for(const [id,sh] of Object.entries(VEH_SHEET)) ok(sh===null||ART.sheets[sh],'vehicle sheet exists '+id); for(const x of Object.values(PEN_SHEET)) ok(ART.sheets[x.walk]&&(x.sheet===null||ART.sheets[x.sheet]),'pen sheets '+x.walk); ok(ART.sheets['bees-swarm'],'bees sheet');
// icons: art mode = <img>, classic = the emoji, unknown id = the emoji
const ic=(k,id,classic)=>iconHtml(ART,k,id,null,{emoji:'E',classic,size:24});
ok(/<img/.test(ic('an','cowpen'))&&ic('an','cowpen',true)==='E'&&ic('an','nonesuch')==='E'&&/<img/.test(ic('veh','oxwagon'))&&ic('veh','oxwagon',true)==='E','anIco / vehIco');
ok(spriteFor(ART,'vehsm','seaboat')==='seaboat-sm'&&spriteFor(ART,'vehsm','warchariot')==='chariot-sm','vehsm: boat and chariot -sm');
ok(spriteFor(ART,'ansm','ox')==='ox-sm'&&spriteFor(ART,'ansm','chickencoop')==='hen-sm'&&spriteFor(ART,'ansm','cowpen')==='cow-sm'&&spriteFor(ART,'ansm','horse')==='drafthorse-sm'&&spriteFor(ART,'ansm','pony')==='pony-sm','ansm: batch c icons');
ok(spriteFor(ART,'ansm','courser')==='drafthorse'&&spriteFor(ART,'ansm','warhorse')==='warhorse'&&spriteFor(ART,'ansm','sheep')==='sheep','ansm falls back to the 64px icon');

// ---- 2. wander: pure, seeded, time based
const box=[20,40,120,100]; let moved=0,paused=0,left=0,right=0,frames=new Set();
for(let i=0;i<10000;i++){ const t=i*0.37, p=wander('cow:1',t,box); ok(p.x>=box[0]-1e-9&&p.x<=box[2]+1e-9&&p.y>=box[1]-1.0001&&p.y<=box[3]+1e-9,'stays in box'); ok(p.frame===0||p.frame===1,'frame 0/1'); frames.add(p.frame); p.moving?moved++:paused++; p.dir<0?left++:right++; }
ok(moved>200&&paused>moved,'it walks, and pauses far longer than it walks ('+moved+'/'+paused+')'); ok(left>500&&right>500,'faces both ways'); ok(frames.size===2,'both frames used');
const a=wander('x',123.4,box),b=wander('x',123.4,box); ok(JSON.stringify(a)===JSON.stringify(b),'deterministic'); ok(JSON.stringify(wander('y',123.4,box))!==JSON.stringify(a),'seed changes it');
const st0=wander('x',0,box,{still:true}),st1=wander('x',999,box,{still:true}); ok(JSON.stringify(st0)===JSON.stringify(st1)&&st0.frame===0&&!st0.moving,'still = frame 0 and fixed');
let big=0,pr=wander('z',0,box); for(let t=0.1;t<300;t+=0.1){const p=wander('z',t,box); if(Math.hypot(p.x-pr.x,p.y-pr.y)>3.5) big++; pr=p;} ok(big===0,'no teleports (speed ~10px/s)');
const cyc=[0,1,2].map(i=>wander('loop',i*5,box)); ok(cyc.every(p=>isFinite(p.x)&&isFinite(p.y)),'finite');
let bm=0; for(let t=0;t<120;t+=.25){ if(wander('b:1',t,[25,45,88,62],KIND_OPTS.bees).moving) bm++; } ok(bm>120,'bees move far more than pen animals');
ok(!/Math\.random/.test(fs.readFileSync(root+'js/ui/actors.js','utf8')),'actors.js has no Math.random');

// ---- 3. penCount
ok(penCount(0,1)===0&&penCount(1,1)===1&&penCount(3,1)===3&&penCount(9,1)===3,'cow caps at 3');
ok(penCount(5,2,0)===3&&penCount(5,2,1)===2&&penCount(1,2,0)===1&&penCount(1,2,1)===0,'head split over pens, extra to the first');
ok(penCount(2,1,0,2)===1&&penCount(6,1,0,2)===3&&penCount(12,1,0,2)===3&&penCount(1,1,0,2)===1,'a pair of hens = 1 sprite, 3 sprites = 6 hens shown'); ok(MAX_PEN===3&&MAX_VEH===3,'caps');
// ---- 4. rooms
const s=E.newGame(1); E.normalize(s); let uid=7000;
const mk=(t,o={})=>{const d=T[t]; const st={uid:'r73-'+(uid++),type:t,pieces:[...(d.fixed||[]),...(o.pieces||[])],up:o.up||0,tier:o.tier||0,fittings:o.fittings||[],spec:o.spec}; s.structures.push(st); return st;}
const cow=mk('cowpen'), coop=mk('chickencoop'), api=mk('apiary');
s.herds={cowpen:99,chickencoop:99}; s.unfed={};
const head=t=>E.herdHead(s,t); ok(head('cowpen')>=1&&head('chickencoop')>=1,'new game herds exist ('+head('cowpen')+','+head('chickencoop')+')');
let ra=roomActors(E,s,cow,HL,ART); ok(ra.pen&&ra.pen.sheet==='cow-idle'&&ra.pen.walk==='cow-walk'&&ra.pen.n===Math.min(3,head('cowpen'))&&!ra.pen.still,'cow pen actors');
ra=roomActors(E,s,coop,HL,ART); ok(ra.pen&&ra.pen.sheet===null&&ra.pen.walk==='hen-walk'&&ra.pen.per===2&&ra.pen.n===Math.min(3,Math.ceil(head('chickencoop')/2)),'coop: pairs');
ok(roomActors(E,s,api,HL,ART).bees===2&&!roomActors(E,s,api,HL,ART).pen,'apiary bees');
s.unfed.cowpen=2; ok(roomActors(E,s,cow,HL,ART).pen.still,'unfed pen stands still'); s.unfed.cowpen=0;
const house=mk('house'); ok(roomActors(E,s,house,HL,ART).pen===null&&roomActors(E,s,house,HL,ART).bees===0,'other rooms: none');
const html=(st,classic)=>roomHtml(E,R,s,st,0,classic,undefined,classic?null:roomActors(E,s,st,HL,ART));
let h=html(cow,false); const nCow=(h.match(/class="rmact rm-pen"/g)||[]).length; ok(nCow===ra.pen.n||nCow===roomActors(E,s,cow,HL,ART).pen.n,'cow sprites in html '+nCow); ok(h.includes('data-seed')&&h.includes('art/animals/sheets/cow-idle.webp')&&h.includes('data-wu="art/animals/sheets/cow-walk.webp"')&&h.includes('data-wc="4"'),'cow idle + walk sheets in html');
ok(html(cow,false)===h,'static html: same string on re-render'); ok(h.includes('data-box')&&h.includes('data-fw="24"'),'data attrs');
const [x0,y0,x1,y1]=h.match(/data-box="([^"]+)"/)[1].split(',').map(Number), pen=R.art.rects.cowpen.pen; ok(x0>=pen[0]&&x1<=pen[2]&&y1<=150,'cow feet box inside the pen (the open floor)');
ok(sceneLayout(R,roomModel(E,R,cow,s)).pen[2]===236&&sceneLayout(R,roomModel(E,R,cow,s)).penStops.length>=2,'sceneLayout exposes pen');
h=html(cow,true); ok(!h.includes('rmact')&&!h.includes('animals/'),'classic: no actors'); ok(!roomHtml(E,R,s,cow,0,true).includes('rmact'),'classic without act');
h=html(coop,false); const nh=(h.match(/class="rmact rm-pen"/g)||[]).length; ok(nh===2*roomActors(E,s,coop,HL,ART).pen.n&&h.includes('hen-walk.webp')&&!h.includes('hens-idle')&&h.includes('data-ox="-9"')&&h.includes('data-ox="9"'),'coop html: every pair is two hen-walk hens that walk together ('+nh+')'); h=html(api,false); ok((h.match(/rm-bees/g)||[]).length===2&&h.includes('bees-swarm'),'bees html');
for(const k of ['chickencoop','cowpen']) { const rc=R.art.rects[k]; ok(rc.pen&&rc.pen[1]>=rc.floor[1]&&rc.pen[3]<=150&&rc.pen[0]>=rc.floor[0]&&rc.pen[2]<=rc.floor[2],'pen inside floor '+k); }
ok(R.art.rects.apiary.bees.length===4,'apiary bees box');
// ---- 4b. R73b: pens use the whole open floor, animals keep apart, troughs are just one stop among many
const parse=hh=>{ const g={}; for(const m of hh.matchAll(/<span class="rmact rm-(pen|bees)"([^>]*)>/g)){ const a=Object.fromEntries([...m[2].matchAll(/data-([a-z]+)="([^"]*)"/g)].map(x=>[x[1],x[2]]));
  const G=g[a.grp]||(g[a.grp]={k:m[1],box:a.box.split(',').map(Number),md:+a.md,stops:a.stops?a.stops.split(';').map(q=>q.split(',').map(Number)):[],seeds:[],fw:+a.fw,fh:+a.fh,k2:a.k}); if(!G.seeds.includes(a.seed)) G.seeds.push(a.seed); } return Object.values(g); };
const fixBoxes=(st)=>{ const L=sceneLayout(R,roomModel(E,R,st,s)); return L.filter(c=>c.at==='painted').map(c=>[c.x,c.y,c.x+c.w,c.y+c.h]); };
const rep={};
for(const [nm,st] of [['cow',cow],['coop',coop],['apiary',api]]){
  const hh=html(st,false), G=parse(hh); const want=nm==='apiary'?2:roomActors(E,s,st,HL,ART).pen.n; ok(G.length===1&&G[0].seeds.length===want&&want>=2,nm+': one group of '+G[0].seeds.length); const g=G[0], o={...(KIND_OPTS[g.k]||{}),stops:g.stops}, [bx0,by0,bx1,by1]=g.box;
  ok(g.stops.length>=3,nm+' has trough/hive stops'); ok(g.md>=g.fw+4&&(nm==='apiary'||g.md>=g.fw+8),nm+' keeps >= a sprite width + gap ('+g.md+')');
  const fx=fixBoxes(st), nearStop=(p)=>g.stops.some(q=>Math.hypot(p.x-q[0],p.y-q[1])<16);
  let minD=1e9,inFix=0,visits=0,allAtStops=0,twoAtStops=0,N=0; const cellsBy=g.seeds.map(()=>new Set()), CX=4, CY=3, xs=[], pause=g.seeds.map(()=>({t:0,max:0,p:null}));
  for(let t=0;t<3600;t+=0.5){ N++; const ps=penPositions(g.seeds,t,g.box,o,g.md), ns=ps.map(nearStop).filter(Boolean).length;
    if(ns===ps.length) allAtStops++; if(ns>=2) twoAtStops++; if(ns) visits++;
    ps.forEach((p,i)=>{ ok(p.x>=bx0-1e-6&&p.x<=bx1+1e-6&&p.y>=by0-1.01&&p.y<=by1+1e-6,nm+' stays in the box'); cellsBy[i].add(Math.min(CX-1,Math.floor((p.x-bx0)/(bx1-bx0)*CX))+CX*Math.min(CY-1,Math.floor((p.y-by0)/Math.max(1,by1-by0)*CY))); xs.push(p.x);
      if(fx.some(b=>p.x>b[0]&&p.x<b[2]&&p.y-g.fh<b[3]&&p.y>b[1])) inFix++;
      const q=pause[i]; if(q.p&&Math.hypot(p.x-q.p.x,p.y-q.p.y)<2.5){ q.t+=0.5; q.max=Math.max(q.max,q.t); } else { q.t=0; q.p=p; } });
    for(let i=0;i<ps.length;i++) for(let j=i+1;j<ps.length;j++) minD=Math.min(minD,Math.hypot(ps[i].x-ps[j].x,ps[i].y-ps[j].y)); }
  rep[nm]={minD:+minD.toFixed(1),md:g.md,cells:cellsBy.map(c=>c.size),near:+(visits/N).toFixed(3),two:+(twoAtStops/N).toFixed(3),all:allAtStops,fix:+(inFix/N/g.seeds.length).toFixed(3),pause:pause.map(q=>q.max),spreadX:+((Math.max(...xs)-Math.min(...xs))/(bx1-bx0)).toFixed(2)};
  if(process.env.DBG) console.error(nm,JSON.stringify(rep[nm]),g.box);
  ok(minD>=g.md-1.5,nm+': animals never closer than '+g.md+' ('+minD.toFixed(1)+')'); ok(nm==='apiary'||allAtStops/N<0.01,nm+': never all at the troughs at once ('+allAtStops+'/'+N+')'); ok(visits>0,nm+': they do visit a trough now and then');
  ok(visits/N<0.35,nm+': troughs are one stop among many ('+(visits/N).toFixed(2)+')'); ok(cellsBy.every(c=>c.size>=(nm==='apiary'?7:9)),nm+': each animal covers most of the open floor ('+cellsBy.map(c=>c.size)+' of 12 cells)');
  ok((Math.max(...xs)-Math.min(...xs))/(bx1-bx0)>0.9,nm+': spread over the whole width'); ok(inFix/N/g.seeds.length<(nm==='apiary'?1:0.12),nm+': mostly off the painted fixtures ('+rep[nm].fix+')');
  ok(Math.max(...pause.map(q=>q.max))<=12,nm+': no long idle stays on one spot ('+pause.map(q=>q.max)+' s)');
}
if(process.env.DBG) console.log(JSON.stringify(rep));
// robust over many rooms: any seed keeps the pen apart and inside
{ const g=parse(html(cow,false))[0]; let md=1e9; for(let k=0;k<150;k++){ const sd=[0,1,2].map(i=>'u'+k+':pen:'+i); for(let t=0;t<600;t+=1.5){ const ps=penPositions(sd,t,g.box,{...KIND_OPTS.pen,stops:g.stops},g.md); for(let i=0;i<3;i++) for(let j=i+1;j<3;j++) md=Math.min(md,Math.hypot(ps[i].x-ps[j].x,ps[i].y-ps[j].y)); } } ok(md>=g.md-1.5,'150 random pens: never closer than '+g.md+' ('+md.toFixed(1)+')'); }
{ const a=spread([{x:50,y:50},{x:50,y:50},{x:51,y:50}],28,[0,0,200,100]); ok(a.every((p,i)=>a.every((q,j)=>i===j||Math.hypot(p.x-q.x,p.y-q.y)>=27.5)),'spread: three animals on one point are pushed apart'); ok(JSON.stringify(spread(a,28,[0,0,200,100]))===JSON.stringify(a),'spread: already apart = unchanged'); }
{ const two=wander('s',10,[20,40,120,100],{stops:[[60,60]],stopChance:1}); ok(isFinite(two.x),'wander with stops'); const stp={...KIND_OPTS.pen,stops:[[60,60]],stopChance:1}; let hit=0; for(let t=0;t<1200;t+=.5){const p=wander('stp1',t,[20,40,120,100],stp); if(Math.hypot(p.x-60,p.y-60)<10) hit++;} ok(hit>0,'a stop is visited'); }
// reduced motion: the still positions of a pen are apart too
{ const g=parse(html(cow,false))[0], ps=penPositions(g.seeds,0,g.box,{still:true,stops:g.stops},g.md); ok(ps.every((p,i)=>ps.every((q,j)=>i===j||Math.hypot(p.x-q.x,p.y-q.y)>=g.md-1.5)),'still pen: apart'); }
// ---- 5. stall draft animals
const SP=HL.stall; ok(SP==='stablestall'&&T.warehouse.allowed.includes(SP),'stall host');
const host=mk('warehouse',{pieces:[SP,SP]}); ok(stallCap(HL,host)===2*HL.stallsPer,'stall capacity');
s.animals={mule:1,ox:1,horse:1,ram:1}; ok(draftList(HL,s).join()==='mule,ox,horse,ram','draft order = world.json order');
ok(stallDraft(HL,s,host).length===3,'3 shown per room at most'); let rr=roomActors(E,s,host,HL,ART); ok(rr.draft.length===3&&rr.draft.every(d=>d.file.startsWith('art/animals/')&&d.name),'draft icons with names');
s.animals={}; ok(roomActors(E,s,host,HL,ART).draft.length===0,'no animals, none drawn'); s.animals={mule:1,ox:2};
h=html(host,false); const lay=sceneLayout(R,roomModel(E,R,host,s)); ok(lay.some(c=>c.id===SP),'stall piece in the layout'); ok((h.match(/class="rmact rmdraft"/g)||[]).length===3&&(h.match(/data-stand="1"/g)||[]).length===3&&h.includes('mule-idle.webp')&&h.includes('ox-idle.webp'),'3 draft animals drawn beside the stall, on their idle sheets'); ok(!html(host,true).includes('rmdraft'),'classic: no draft animals');
// R73b: stall animals stand on clear floor: not on the stall piece, another piece/fixture, the door, or each other; also with 2 pieces and 1 piece
s.structures=s.structures.filter(x=>x!==host);
for(const [nm,pcs] of [['2 stalls',[SP,SP]],['1 stall',[SP]]]){ const hs=mk('warehouse',{pieces:pcs}); s.animals={mule:1,ox:1,horse:1,ram:1}; const hh=html(hs,false), Ls=sceneLayout(R,roomModel(E,R,hs,s)), W=Ls.w, Hh=Ls.h;
  const dr=[...hh.matchAll(/<span class="rmact rmdraft"[^>]*style="left:([\d.]+)%;top:([\d.]+)%;width:([\d.]+)%;height:([\d.]+)%/g)].map(m=>[+m[1]*W/100,+m[2]*Hh/100,+m[1]*W/100+m[3]*W/100,+m[2]*Hh/100+m[4]*Hh/100]);
  const nd=Math.min(3,stallCap(HL,hs)); ok(dr.length===nd&&nd>=2,nm+': '+nd+' animals'); const hard=[...Ls.hard,...Ls.filter(c=>c.at==='painted').map(c=>[c.x,c.y,c.x+c.w,c.y+c.h]),...Ls.filter(c=>c.at==='floor').map(c=>[c.x+2,c.y+4,c.x+30,c.y+31])];
  for(let i=0;i<nd;i++){ ok(!hard.some(b=>dr[i][0]<b[2]&&b[0]<dr[i][2]&&dr[i][1]<b[3]&&b[1]<dr[i][3]),nm+': animal '+i+' clear of every fixture and the stall piece'); ok(dr[i][0]>=Ls.floor[0]-.5&&dr[i][2]<=Ls.floor[2]+.5&&dr[i][3]<=Ls.floor[3]+.5,nm+': inside the floor');
    for(let j=i+1;j<nd;j++) ok(!(dr[i][0]<dr[j][2]&&dr[j][0]<dr[i][2]&&dr[i][1]<dr[j][3]&&dr[j][1]<dr[i][3]),nm+': animals '+i+','+j+' do not overlap'); }
  ok(hh===html(hs,false),nm+': static'); s.structures=s.structures.filter(x=>x!==hs); }
{ const bs=mk('barracks',{spec:'stable'}); s.animals={mule:1,ox:1,horse:1}; const hh=html(bs,false); ok((hh.match(/rmdraft/g)||[]).length>=1,'stable spec still draws its animals'); s.structures=s.structures.filter(x=>x!==bs); } s.animals={mule:1,ox:2};
const bar=mk('barracks',{spec:'stable'}); ok(stallCap(HL,bar)===HL.stableSpecStalls,'Stable spec stalls'); ok(roomActors(E,s,bar,HL,ART).stable,'stable spec flagged');
s.structures=s.structures.filter(x=>x!==host&&x!==bar); s.animals={};
// ---- 6. vehicles on the estate map
const hand=s.vault; s.vault=[]; s.minions=[]; s.eg=s.eg||{}; s.eg.mount=0;
ok(vehicleSlots(E,s,HL).length===0,'nothing owned, no vehicles');
s.vault=['handcart']; let v=vehicleSlots(E,s,HL); ok(v.length===1&&v[0].id==='handcart'&&v[0].kind==='wagon'&&v[0].parked&&v[0].n===0,'one handcart, parked ('+JSON.stringify(v)+')');
s.minions=[{job:'teamster'},{job:'teamster'},{job:'teamster'},{job:'teamster'}];
v=vehicleSlots(E,s,HL); ok(v.length===3&&v.reduce((a,b)=>a+b.n,0)===3||v.reduce((a,b)=>a+b.n,0)===4,'teamsters spread over up to 3 wagons ('+v.map(x=>x.n)+')'); ok(v.every(x=>!x.parked&&x.n>=1),'not parked');
s.eg.mount=1; v=vehicleSlots(E,s,HL); ok(v.length===3&&v[2].kind==='wagon','cap 3 even with a rider');
s.minions=[{job:'teamster'}]; v=vehicleSlots(E,s,HL); ok(v.length===2&&v[0].kind==='wagon'&&v[1].kind==='rider'&&v[1].id==='rider:pony','wagon + noble rider (pony)');
s.eg.mount=2; ok(vehicleSlots(E,s,HL)[1].id==='rider:courser'&&VEH_SHEET['rider:courser']==='rider-courser','courser rider has its own sheet'); s.eg.mount=3; ok(vehicleSlots(E,s,HL)[1].id==='rider:warhorse','warhorse'); ok(vehicleSlots(E,s,HL)[1].sheet==='rider-warhorse','warhorse sheet');
s.eg.mount=0; s.vault=['handcart','seaboat']; const dock=mk('dock'); v=vehicleSlots(E,s,HL); ok(v[0].kind==='boat'&&v[0].id==='seaboat','boat first when owned + Dock');
ok(v.length===2,'boat counts toward the 3 ('+v.map(x=>x.id)+')'); s.minions=[{job:'teamster'},{job:'teamster'},{job:'teamster'}]; s.vault=['handcart','seaboat']; v=vehicleSlots(E,s,HL); ok(v.length===3&&v[0].kind==='boat','boat + 2 wagons = 3');
s.structures=s.structures.filter(x=>x!==dock); ok(!vehicleSlots(E,s,HL).some(x=>x.kind==='boat'),'no Dock, no boat');
// tiers: best owned first, and the engine's own pick is the first
s.vault=['handcart','wagon']; s.animals={ox:1}; s.res.coin=1e9; const tiers=ownedTiers(E,HL,s); ok(tiers.length>=2&&tiers[0].id===E.haulTier(s).id,'best owned tier first = engine pick ('+tiers.map(t=>t.id)+')');
// layout
s.land=Object.keys(D.estatemap.parcels); const wh=mk('warehouse'), dk=mk('dock'); s.vault=['handcart']; s.minions=[{job:'teamster'}]; const L=estateLayout(s,D,E); ok(L.items.length>0,'layout has items');
const vl=vehicleList(s,D,E,L); ok(vl.length===1&&vl[0].veh.id==='handcart'&&L.items.find(i=>i.key===vl[0].job).type==='warehouse','vehicleList: wagons start at the warehouse door'); ok(D.estatemap.walk.maxVehicles===3,'maxVehicles 3');
s.vault=['handcart','oxwagon','horsewagon','seaboat']; s.minions=[{job:'teamster'},{job:'teamster'},{job:'teamster'}]; ok(vehicleList(s,D,E,estateLayout(s,D,E)).length<=3,'vehicleList capped at 3');
const bl=vehicleList(s,D,E,estateLayout(s,D,E)).find(x=>x.veh.kind==='boat'); ok(bl&&L.items.find(i=>i.key===bl.dock).type==='dock'&&bl.still,'boat moored at the Dock');
const bo=vehicleList(s,D,E,estateLayout(s,D,E)); ok(bo.every(x=>x.id&&x.name),'every vehicle has an id and a name');
ok(vehicleList(s,D,E,estateLayout(s,D,E)).every(x=>(x.veh.kind==='boat')===!!x.dock&&(x.veh.kind==='boat'||x.veh.parked===!!x.still||x.still===false||x.still===undefined)),'boat has a dock, others do not');
// ---- 7. display only: no engine or save change, no Math.random in the pure helpers, the sim files are the R72 ones
const before=JSON.stringify(s); for(const st of s.structures){ roomActors(E,s,st,HL,ART); roomHtml(E,R,s,st,0,false,undefined,roomActors(E,s,st,HL,ART)); } vehicleSlots(E,s,HL); vehicleList(s,D,E,estateLayout(s,D,E)); ownedTiers(E,HL,s);
ok(JSON.stringify(s)===before,'reading everything leaves the state untouched (nothing new saved)'); ok(!('actors' in s)&&!('vehicles' in s),'no new state keys');
const em=fs.readFileSync(root+'js/ui/estate-map.js','utf8'), dv=em.slice(em.indexOf('function drawVeh'),em.indexOf('function paint(')); ok(dv.includes('drawImage')&&!/sheetFor|walkerTabard|tintedImg|getImageData/.test(dv),'vehicles are never tinted (#194261 is also in the chariot car and the boat pennant)');
console.log('r73 ok '+pass);
