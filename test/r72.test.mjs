// R72: every building gets its painted room (batches C D E F G H I) + the 11-room manor suite (320x224, tabs, routing) + 33 add-on overlays + 10 furniture
// sprites + exact-name chip icons + tier pins + beds far from fires. Display only: sim and save (55) unchanged; classic emoji mode ignores all of it.
import fs from 'fs'; import * as E from '../js/engine.js'; import { BUILD } from '../js/config.js'; import { STEPS } from '../js/engine/save-steps.js';
import { roomModel, roomHtml, sceneLayout, manorInfo } from '../js/ui/estate-room.js';
const root=new URL('../',import.meta.url).pathname; const D={};
for(const f of fs.readdirSync(root+'data').filter(f=>f.endsWith('.json'))) D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(root+'data/'+f));
for(const f of D.estate.structureFiles) D['structures/'+f]=JSON.parse(fs.readFileSync(root+'data/structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const R=D.estaterooms, A=R.art, hit=(a,b)=>a[0]<b[2]&&b[0]<a[2]&&a[1]<b[3]&&b[1]<a[3], inb=(b,r)=>b[0]>=r[0]&&b[1]>=r[1]&&b[2]<=r[2]&&b[3]<=r[3];
const T={}; for(const f of D.estate.structureFiles){const d=D['structures/'+f]; for(const x of (Array.isArray(d)?d:(d.structures||Object.values(d)))) T[x.id]=x;}
const size=p=>{const b=fs.readFileSync(p); if(b.toString('ascii',0,4)!=='RIFF') return null; const k=b.toString('ascii',12,16);
  if(k==='VP8X') return [1+b.readUIntLE(24,3),1+b.readUIntLE(27,3)]; if(k==='VP8L'){const v=b.readUInt32LE(21);return [1+(v&0x3fff),1+((v>>14)&0x3fff)];} const o=b.indexOf(Buffer.from([0x9d,0x01,0x2a])); return [b.readUInt16LE(o+3)&0x3fff,b.readUInt16LE(o+5)&0x3fff];};
ok(/^R(?:84|83|82|81|80|79|78|77|76|7[2345])/.test(BUILD)&&E.SCHEMA===55&&STEPS.at(-1).n===55,'R72, save stays 55'); ok(D.changelog.entries.some(e=>e.build==='R72')&&D.changelog.entries.some(e=>e.build==='R71'),'changelog');
const s=E.newGame(1); E.normalize(s); let uid=5000;
const mk=(t,o={})=>{const d=T[t]; const st={uid:'r72-'+(uid++),type:t,pieces:[...(d.fixed||[]),...(o.pieces||[])],up:o.up||0,tier:o.tier||0,fittings:o.fittings||[]}; s.structures.push(st); return st;};
// ---- 1. the 32 single rooms
const SINGLE='brewery smokehouse preservery saltworks fishinghut advlodge thievesden hunterscabin hall warehouse tradingpost countinghouse dock slipway apiary fields orchard herbgarden herbalistshack quarry mineshaft masonyard buildersyard shrinehouse ancestorhall arcaneworkshop graveyard magestower shack cabin cottage house'.split(' ');
ok(SINGLE.length===32,'32 rooms');
for(const t of SINGLE){
  const P=A.painted[t]; ok(P&&P.room&&T[t],'painted '+t); const rc=A.rects[P.room]; ok(rc,'rect '+t); ok(A.rooms[P.room]==='room-'+P.room,'rooms key '+t);
  ok(size(root+'art/rooms/room-'+P.room+'.webp').join('x')==='256x192','room art 256x192 '+t);
  ok(rc.floor_large&&rc.wall_strip&&rc.door&&rc.spotFlush&&rc.paths,'zones '+t);
  ok(Object.keys(P.fix).length>0&&Object.keys(rc.workspots||{}).every(id=>P.fix[id]),'workspots are painted ids '+t);
  for(const [id,b] of Object.entries(P.fix)){ ok(!hit(b,rc.floor_large),'fixture '+t+'/'+id+' clear of floor_large'); ok(!hit(b,rc.wall_strip),'fixture '+t+'/'+id+' clear of wall_strip'); ok(inb(b,[0,0,255,191]),'fixture in room '+t+id); ok(A.paintedNames[id],'name '+id); }
  for(const b of P.decor||[]){ ok(!hit(b,rc.floor_large)&&!hit(b,rc.wall_strip),'decor clear '+t); }
  ok(!hit(rc.door,rc.floor_large),'door clear '+t);
  for(const [u,a] of Object.entries(rc.upAnchors||{})){ ok(rc.anchors[a],'upAnchor '+t+u); }
    // full build + empty: every piece drawn, nothing over a painted/decor box, spots inside floor_large
  const d=T[t], allow=(d.allowed||[]).filter(p=>!E.pieceDef(p).fitting);
  for(const st of [mk(t,{pieces:allow.slice(0,d.slots),up:9,tier:2}),mk(t)]){
    const M=roomModel(E,R,st,s), L=sceneLayout(R,M); ok(L&&L.fam===P.room&&L.w===256&&L.h===192,'layout '+t);
    const boxes=[...Object.values(P.fix),...(P.decor||[]),...Object.values(rc.pins||{})];
    for(const c of L.filter(o=>o.at==='floor'||o.at==='free')){ const b=[c.x+2,c.y+4,c.x+30,c.y+31]; const pin=(rc.pins||{})[c.id];
      if(pin){ ok(c.x===pin[0]+1&&c.y===pin[1]+1,'pinned '+t+c.id); continue; }
      ok(inb(b,[rc.floor_large[0],rc.floor_large[1],rc.floor_large[2]+1,rc.floor_large[3]+1]),'spot inside floor_large '+t+c.id); ok(!boxes.some(k=>hit(b,k)),'spot clear of painted '+t+c.id); ok(!hit(b,rc.door),'door clear '+t); }
    for(const c of L.filter(o=>o.at==='wall')) ok(!boxes.some(k=>hit([c.x,c.y,c.x+32,c.y+25],k)),'wall piece clear '+t);
    const drawn=new Set(L.map(c=>c.id)); for(const c of M.floor) ok(drawn.has(c.id)||drawn.has((P.as||{})[c.id]),'piece drawn '+t+c.id);
    const h=roomHtml(E,R,s,st,0,false), hc=roomHtml(E,R,s,st,0,true);
    ok(h.includes('art/rooms/room-'+P.room+'.webp')&&h.includes('rmhit')&&!h.includes('rmtab'),'html '+t); ok(!hc.includes('art/')&&!hc.includes('rmscene')&&!hc.includes('rmtab'),'classic ignores art '+t);
    for(const a of L.filter(o=>o.at==='attach')) if(a.art) ok(fs.existsSync(root+'art/rooms/'+a.art+'.webp'),'attach art file '+a.art);
  }
}
// quarry / dock mapping
ok(A.painted.quarry.fix.quarryface&&!A.painted.quarry.fix.quarry_pit&&A.painted.quarry.as.quarrypit==='quarryface','quarry_pit -> quarry_face');
ok(A.painted.dock.room==='dockshed'&&A.painted.slipway.room==='slipwayshed'&&A.rooms.dock==='room-dock','dock sheds have their own keys (old dock picture kept)');
// ---- 2. tier pins
{ const bw=A.rects.brewery.pins, qy=A.rects.quarry.pins; ok(bw.winepress&&bw.stillpot&&qy.limecut&&qy.granitecut,'pins present'); for(const b of [...Object.values(bw),...Object.values(qy)]) ok(b[2]-b[0]+1===34&&b[3]-b[1]+1===34,'pin 34x34');
  const st=mk('brewery',{pieces:['winepress','stillpot']}), L=sceneLayout(R,roomModel(E,R,st,s)); const wp=L.find(c=>c.id==='winepress'); ok(wp&&wp.x===bw.winepress[0]+1&&wp.y===bw.winepress[1]+1,'winepress sits in its slot');
  const others=L.filter(c=>(c.at==='floor'||c.at==='free')&&!['winepress','stillpot'].includes(c.id)); ok(others.every(c=>!Object.values(bw).some(b=>hit([c.x+2,c.y+4,c.x+30,c.y+31],b))),'nothing else uses a slot'); }
// ---- 3. beds far from hearths
{ ok(A.beds.includes('bunk')&&A.beds.includes('featherbed')&&A.beds.includes('cradle'),'beds list');
  for(const t of ['shack','cabin','cottage','house']){ ok(A.rects[t].bedFar,'bedFar '+t); const st=mk(t,{pieces:t==='cottage'?[]:['larder','bunk']}); const L=sceneLayout(R,roomModel(E,R,st,s)); const hf=L.find(c=>c.id==='hearthfix'), bu=L.find(c=>c.id==='bunkbed'); ok(hf&&bu,'painted hearth + bed '+t);
    const bed=L.find(c=>c.id==='bunk'); if(bed){ const cx=bed.x+16,cy=bed.y+16, hx=hf.x+hf.w/2, hy=hf.y+hf.h/2; ok(Math.hypot(cx-hx,cy-hy)>=64,'bought bed well away from the hearth '+t+' '+Math.round(Math.hypot(cx-hx,cy-hy))); }
    const L2=sceneLayout(R,roomModel(E,R,mk(t),s)); ok(L2.some(c=>c.at==='painted'&&c.id==='hearthfix')&&L2.some(c=>c.at==='painted'&&c.id==='bunkbed'),'starter hearth + bed are the painted ones '+t); }
  const hs=mk('house',{pieces:['bunk','bunk','bunk','larder']}), LH=sceneLayout(R,roomModel(E,R,hs,s)); ok(LH.find(c=>c.id==='bunk').n===3,'beds stack'); }
// ---- 4. add-ons and furniture
const AO='silver-inlay master-crucible pumps timber-props nets great-chimney steam-saw smoker'.split(' '); for(const f of AO) ok(fs.existsSync(root+'art/rooms/'+f+'.webp'),'add-on file '+f);
ok(Object.keys(A.attachArt).length>=33,'33+ add-ons have art'); for(const [u,slug] of Object.entries(A.attachArt)){ ok(fs.existsSync(root+'art/rooms/'+slug+'.webp'),'attachArt file '+slug); ok(A.attach[u]||Object.values(A.painted).some(p=>(p.attach||{})[u]),'attach host '+u); }
for(const [t,rc] of Object.entries(A.rects)) for(const [u,a] of Object.entries(rc.upAnchors||{})){ const slug=A.attachArt[u]; if(slug&&rc.anchors[a]){ const b=rc.anchors[a], z=size(root+'art/rooms/'+slug+'.webp'); ok(z[0]===b[2]-b[0]+1&&z[1]===b[3]-b[1]+1,'add-on size = anchor '+t+u+' '+z+' '+b); } }
ok(A.rects.guildhall.upAnchors.Bellows&&A.rects.guildhall.upAnchors['Master Crucible']&&A.rects.guildhall.anchors.master_crucible_upgrade,'guildhall anchors (invented)');
for(const f of 'coldcellar cradle crystal dummy featherbed minionbunk mirror pantry strongbox trophy'.split(' ')){ ok(A.pieces[f]==='pieces/'+f,'furniture art '+f); const z=size(root+'art/rooms/pieces/'+f+'.webp'); ok(z[0]===32&&z[1]===32,'32x32 '+f); }
ok(A.pieces.bunk==='pieces/bed'&&A.pieces.infirmary==='pieces/bed-infirmary','old bed art kept');
// ---- 5. chip icons
{ const C=A.chipIcons; ok(Object.keys(C).length>=129,'129 icons'); ok(C['Runed Circle']!=='🐔'&&C['Portrait Gallery']!=='⛏️','runed circle / portrait gallery fixed');
  ok(C['Twin Blades']==='⚔️'&&C['Steam Saw']==='♨️'&&C['Scraping Frames']==='🪟'&&C['Armory']==='🛡️','placeholders');
  const names=Object.keys(C); ok(new Set(Object.values(C)).size>=100,'mostly distinct');
  const st=mk('arcaneworkshop',{up:9,tier:2}); const M=roomModel(E,R,st,s), Mc=roomModel(E,R,st,s,true), wr=M.wall.find(w=>w.name==='Runed Circle'), wc=Mc.wall.find(w=>w.name==='Runed Circle');
  if(wr) ok(wr.icon===C['Runed Circle']&&wc.icon!==wr.icon,'exact name beats the regex, classic keeps the old icon');
  const hs=mk('hall',{up:9}); const a=roomModel(E,R,hs,s).wall.filter(w=>w.kind==='up'), b=roomModel(E,R,hs,s,true).wall.filter(w=>w.kind==='up'); ok(a.length===b.length,'same upgrades'); }
// ---- 6. manor suite
const MA=A.manor, ROOMS=['hall','bedchamber','kitchen','study','workshop','nursery','cellar','counting','barracks','sanctum','chapel'];
ok(Object.keys(MA.rooms).join()===ROOMS.join(),'11 manor rooms');
for(const r of ROOMS){ const k='manor:'+r, rc=A.rects[k], P=A.painted[k]; ok(rc&&P&&P.room===k&&A.rooms[k]==='room-manor-'+r,'manor wiring '+r); ok(rc.w===320&&rc.h===224&&rc.door[0]<=160&&rc.door[2]>=160,'320x224 door at 160 '+r);
  ok(size(root+'art/rooms/room-manor-'+r+'.webp').join('x')==='320x224','manor art size '+r);
  for(const [id,b] of Object.entries(P.fix)){ ok(!hit(b,rc.floor_large)&&!hit(b,rc.wall_strip),'manor fixture clear '+r+id); ok(inb(b,[0,0,319,223]),'in room'); }
  for(const b of P.decor||[]) ok(!hit(b,rc.floor_large)&&!hit(b,rc.wall_strip),'manor decor clear '+r); }
// no engine file imports the room data
for(const f of fs.readdirSync(root+'js/engine').concat(['../engine.js'])) { const p=root+'js/engine/'+f; if(fs.existsSync(p)&&p.endsWith('.js')) ok(!/estaterooms/.test(fs.readFileSync(p,'utf8')),'engine does not import estaterooms '+f); }
const ids=m=>[...m.floor.map(c=>'p:'+c.id),...m.wall.filter(w=>w.kind==='fit').map(w=>'f:'+w.id)];
const MANORS={mansion:'counting',fort:'barracks',towerkeep:'sanctum',abbey:'chapel'};
const allPieces=t=>(T[t].allowed||[]).filter(p=>!E.pieceDef(p).fitting), allFits=t=>T[t].fittings||[];
for(const [t,wing] of Object.entries(MANORS)){
  const bare=mk(t), full=mk(t,{pieces:allPieces(t).slice(0,8),up:9,tier:2,fittings:allFits(t)});
  const Mb=roomModel(E,R,bare,s); let I=manorInfo(R,Mb); ok(I,'manor info '+t);
  const open=I.tabs.filter(x=>x.open).map(x=>x.id); const want=t==='fort'?['hall','kitchen',wing]:['hall','bedchamber','kitchen',wing]; ok(open.join()===want.join(),'open from the start '+t+' '+open);
  ok((t==='fort')===!I.tabs.some(x=>x.id==='bedchamber'),'fort drops the bedchamber '+t);
  ok(I.tabs.filter(x=>!x.open).map(x=>x.id).join()==='study,workshop,nursery,cellar','locked rooms '+t+' '+I.tabs.map(x=>x.id+x.open));
  ok(I.tabs.slice(0,want.length).map(x=>x.id).join()===want.join(),'tab order '+t);
  const hb=roomHtml(E,R,s,bare,0,false); ok(hb.includes('rmtabs')&&hb.includes('data-a="manorroom"')&&hb.includes('room-manor-hall.webp')&&hb.includes('lock'),'tabs in html '+t);
  const hc=roomHtml(E,R,s,bare,0,true); ok(!hc.includes('rmtab')&&!hc.includes('art/'),'classic: no tabs, no art '+t);
  // routing partitions the full build exactly once, over every tab
  const Mf=roomModel(E,R,full,s); const If=manorInfo(R,Mf); ok(If.tabs.every(x=>x.open),'all rooms open for the full build '+t);
  const seen=[]; for(const r of ROOMS){ const J=manorInfo(R,Mf,r); if(!J.open.has(r)) continue; ok(J.cur===r,'select '+r); const V=J.V; ok(V.fam==='manor:'+r&&V.type==='manor:'+r,'sub-model'); seen.push(...ids(V));
    const L=sceneLayout(R,V); ok(L&&L.w===320&&L.h===224&&L.fam==='manor:'+r,'manor layout '+t+r); const rc=A.rects['manor:'+r], P=A.painted['manor:'+r], boxes=[...Object.values(P.fix),...(P.decor||[])];
    for(const c of L.filter(o=>o.at==='floor'||o.at==='free')){ const b=[c.x+2,c.y+4,c.x+30,c.y+31]; ok(inb(b,[rc.floor_large[0],rc.floor_large[1],rc.floor_large[2]+1,rc.floor_large[3]+1])&&!boxes.some(k=>hit(b,k))&&!hit(b,rc.door),'manor spot clear '+t+r+c.id); }
    for(const c of L.filter(o=>o.at==='wall')) ok(!boxes.some(k=>hit([c.x,c.y,c.x+32,c.y+25],k)),'manor wall clear');
    const h=roomHtml(E,R,s,full,0,false,r); ok(h.includes('room-manor-'+r+'.webp')&&h.includes('--rw:320;--rh:224')&&/rmtab on/.test(h),'room html '+t+r); }
  ok(seen.slice().sort().join()===ids(Mf).slice().sort().join()&&new Set(seen).size===seen.length,'every item routed exactly once '+t);
  // unlock rules: each of the four rooms opens by its own items
  for(const [r,piece] of [['study','studydesk'],['workshop','workbench'],['nursery','cradle'],['cellar','larder']]){ if(r==='nursery'||!(T[t].allowed||[]).includes(piece)) continue; const st=mk(t,{pieces:[piece]}); const J=manorInfo(R,roomModel(E,R,st,s)); ok(J.open.has(r)||(t==='fort'&&false),'owning '+piece+' opens '+r+' in '+t); }
  const nu=mk(t,{fittings:['nursery']}); ok(allFits(t).includes('nursery')&&manorInfo(R,roomModel(E,R,nu,s)).open.has('nursery'),'nursery fitting opens the nursery '+t);
}
{ // beds: bedchamber (barracks in the fort); the unlocked-but-unnamed fall back to the hall
  const m=mk('mansion',{pieces:['bunk','bunk','larder']}), I=manorInfo(R,roomModel(E,R,m,s),'bedchamber'); ok(I.V.floor.some(c=>c.id==='bunk'&&c.n===2)&&!I.V.floor.some(c=>c.id==='larder'),'mansion beds in the bedchamber'); ok(manorInfo(R,roomModel(E,R,m,s),'cellar').cur==='cellar','larder opens the cellar');
  const bc=sceneLayout(R,I.V); ok(bc.some(c=>c.id==='bunk'),'bed drawn in the bedchamber'); ok(bc.some(c=>c.id==='bunkbed'&&c.at==='painted'),'starter bunk is the painted bed');
  const f=mk('fort',{pieces:['bunk']}), J=manorInfo(R,roomModel(E,R,f,s),'barracks'); ok(J.V.floor.some(c=>c.id==='bunk'),'fort beds in the barracks'); ok(manorInfo(R,roomModel(E,R,f,s),'bedchamber').cur==='hall','fort has no bedchamber -> hall');
  ok(manorInfo(R,roomModel(E,R,m,s),'chapel').cur==='hall','a room that is not open falls back to the hall');
  const h=mk('hall'); ok(manorInfo(R,roomModel(E,R,h,s))===null,'non-manors have no tabs'); const hs=mk('house'); ok(manorInfo(R,roomModel(E,R,hs,s))===null,'house is a plain room'); }
// the layout of the whole-building model is unchanged for the legend / chips
{ const st=mk('mansion',{pieces:['bunk','larder','loom'],up:2}); const h=roomHtml(E,R,s,st,0,false,'kitchen'); ok(h.includes('rmfloor legend')||h.includes('rmfloor'),'legend kept'); }
console.log('r72 ok',pass);
