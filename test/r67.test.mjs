// R67: room art (room1b backgrounds, room2 furnishings, room2b built-ins) + ART-3b map exteriors (reuse + batch3c).
// Display only: no save step, classic ignores all art, emoji fallback stays for anything without art.
import fs from 'fs'; import * as E from '../js/engine.js'; import { BUILD } from '../js/config.js'; import { STEPS } from '../js/engine/save-steps.js';
import { roomModel, roomHtml, sceneLayout } from '../js/ui/estate-room.js';
import { artKey, artStage, artTouch, estateLayout } from '../js/ui/estate-layout.js';
const root=new URL('../',import.meta.url).pathname; const D={};
for(const f of fs.readdirSync(root+'data').filter(f=>f.endsWith('.json'))) D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(root+'data/'+f));
for(const f of D.estate.structureFiles) D['structures/'+f]=JSON.parse(fs.readFileSync(root+'data/structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const R=D.estaterooms, A=R.art, M=D.estatemap;
ok(+BUILD.slice(1)>=67&&E.SCHEMA===55&&STEPS.at(-1).n===55,'R67, no new save step');
ok(D.changelog.entries.some(e=>e.build==='R67'),'changelog');
const webp=f=>{const b=fs.readFileSync(f);return b.slice(0,4).toString()==='RIFF'&&b.slice(8,12).toString()==='WEBP'&&b.slice(12,16).toString()==='VP8L';};
// 1. rooms
ok(Object.keys(A.rooms).length>=12,'12 room backgrounds');
for(const [fam,f] of Object.entries(A.rooms)){ ok(R.rooms[fam]||Object.values(A.painted||{}).some(p=>p.room===fam),'family '+fam); ok(webp(root+'art/rooms/'+f+'.webp'),'lossless '+f); const r=A.rects[fam]; ok(r&&r.floor&&r.backwall,'rects '+fam); }
ok(JSON.stringify(A.rects.mill.floor_large)==='[15,40,130,135]'&&A.paintedFam.mill.fix.millwheel,'R69: mill millstone is a painted fixture now (was rect [98,15,147,63])');
ok(JSON.stringify(A.rects.workshop.forge_piece_front)==='[100,53,139,80]','forge front rect');
// 2. pieces: every piece id has art, files exist and are lossless
for(const p of D.estate.pieces){ ok(A.pieces[p.id],'art for '+p.id); ok(webp(root+'art/rooms/'+A.pieces[p.id]+'.webp'),'file '+p.id); }
ok(A.pieces.limecut!==A.pieces.quarrypit&&A.pieces.granitecut!==A.pieces.quarrypit,'quarry tint variants');
ok(A.pieces.bunk==='pieces/bed'&&A.pieces.infirmary==='pieces/bed-infirmary','bed files');
const s=E.newGame(1); E.normalize(s);
const types=D.estate.structureFiles.flatMap(f=>{const d=D['structures/'+f];return (Array.isArray(d)?d:(d.structures||Object.values(d)))});
const inside=(b,r)=>b[0]>=r[0]-1&&b[1]>=r[1]-1&&b[0]+32<=r[2]+2&&b[1]+32<=r[3]+2;
const hit=(a,b)=>a[0]<b[2]&&b[0]<a[2]&&a[1]<b[3]&&b[1]<a[3];
let uid=1000;
for(const d of types){
  // every type with its built-ins + up to all slots filled with allowed pieces, and again empty
  const allow=(d.allowed||[]).filter(p=>!E.pieceDef(p).fitting);
  for(const fill of [0,1]){
    const st={uid:'st'+(uid++),type:d.id,pieces:[...(d.fixed||[]),...(fill?allow.slice(0,d.slots):[])],up:0,fittings:[]};
    s.structures.push(st);
    const Mo=roomModel(E,R,st,s), L=sceneLayout(R,Mo), rc=A.rects[L.fam];
    ok(L,'scene '+d.id);
    const placed=L.filter(c=>c.at!=='free');
    ok(Mo.floor.every(c=>placed.some(o=>o.id===(((A.painted[d.id]||{}).as||{})[c.id]||c.id))),'all pieces drawn '+d.id+' '+fill); // R68: + starters, wall layer
    ok(L.filter(c=>c.at==='free').length===Mo.free,'free slots drawn '+d.id);
    for(const c of L){ const b=[c.x+2,c.y+4,c.x+30,c.y+31];
      if((c.at==='floor'||c.at==='free')&&!(c.fixed&&(A.beside||{})[c.id])){ ok(inside([c.x,c.y],rc.floor),'in floor '+d.id+' '+c.id); for(const k of ['door','millstone','forge_piece_front','water','jetty']) if(rc[k]) ok(!hit(b,rc[k]),k+' kept clear '+d.id+' '+c.id); }
      if(c.at==='forge') ok(Mo.fam==='workshop'&&['forge','steelfurnace','crucible'].includes(c.id)&&c.x>=100&&c.y===53&&c.x+32<=141,'forge front '+d.id);
    }
    // valid only: nothing drawn that the type cannot hold
    for(const c of placed) ok((d.fixed||[]).includes(c.id)||allow.includes(c.id)||Mo.starters.some(x=>x.id===c.id)||c.at==='painted','allowed '+c.id+' in '+d.id);
    const h=roomHtml(E,R,s,st,0,false), hc=roomHtml(E,R,s,st,0,true);
    ok(h.includes('rmscene')&&h.includes('art/rooms/'+(A.manor&&A.manor.types[d.id]?A.rooms['manor:hall']:A.rooms[L.fam])+'.webp'),'scene html '+d.id); // R72: manors open on their Great Hall
    ok(!hc.includes('art/')&&!hc.includes('rmscene'),'classic ignores art '+d.id);
    if(!['bunkhouse','barracks','advlodge','shack','cabin','house','mansion','fort','towerkeep','abbey','cottage'].includes(d.id)) ok(!h.includes('pieces/bed.webp'),'no beds in '+d.id);
  }
}
// house with beds stacks; smithy forge in the forge front
const hs={uid:'stH',type:'house',pieces:['bunk','bunk','bunk','larder'],up:0}; s.structures.push(hs);
const LH=sceneLayout(R,roomModel(E,R,hs,s)); ok(LH.find(c=>c.id==='bunk').n===3&&LH.find(c=>c.id==='bunkbed'&&c.at==='painted').n===1&&roomHtml(E,R,s,hs,0,false).split('pieces/bed.webp').length-1>=3,'3 beds stacked (bought beds drawn as sprites, the starter bed is the painted one, R72)');
const sm={uid:'stS',type:'smithy',pieces:['forge','workbench'],up:0}; s.structures.push(sm);
ok(sceneLayout(R,roomModel(E,R,sm,s)).find(c=>c.id==='forge').at==='painted','forge painted (R68.2)');
// emoji fallback when a piece has no art
const keep=A.pieces.larder; delete A.pieces.larder; ok(roomHtml(E,R,s,hs,0,false).includes('rmsp rmemo'),'emoji fallback'); A.pieces.larder=keep;
// 3. ART-3b map exteriors
const ru=M.art.reuse; ok(Object.keys(ru).length===26,'26 reuse entries (+dock kept on chain)');
const spr=new Set(fs.readdirSync(root+'art/estate').map(f=>f.replace('.webp','')));
for(const k of ['hut','tower','shrine','fort']) for(const n of [1,2,3]) ok(spr.has(k+'-'+n)&&webp(root+'art/estate/'+k+'-'+n+'.webp')||spr.has(k+'-'+n),'batch3c '+k+n);
const newT=['fishinghut','herbalistshack','hunterscabin','magestower','towerkeep','shrinehouse','ancestorhall','abbey','fort','barracks'];
for(const d of types){ if(d.id==='cottage') continue; const st={uid:'x',type:d.id,pieces:[],up:0};
  for(const up of [0,1,9]){ st.up=up; const k=artKey(E,M,st); ok(k&&spr.has(k),'map art '+d.id+' '+k); } }
for(const t of newT) ok(['hut','tower','shrine','fort'].includes(ru[t].sprite),'new exterior '+t);
ok(Object.keys(ru).filter(t=>!newT.includes(t)).length===16,'16 reuse (+dock chain = 17)');
// hut users differ from the bunkhouse and each other
const tch=t=>artTouch(E,M,{uid:'x',type:t,pieces:[]},D.art);
ok(artTouch(E,M,{type:'bunkhouse'},D.art)===null,'bunkhouse untouched');
const hut=['fishinghut','herbalistshack','hunterscabin'].map(tch); ok(new Set(hut.map(h=>h.tint)).size===3&&hut.every(h=>h.tint&&h.emblem),'huts tinted + emblem, all different');
// guardhouse looks 1-2 fort, barracks (3rd stage) fort-3
const bk={uid:'b',type:'barracks',pieces:[],up:0}; ok(artKey(E,M,bk)==='fort-1','guardhouse fort-1'); bk.up=1; ok(artKey(E,M,bk)==='fort-2','guardhouse fort-2'); bk.up=3; ok(artKey(E,M,bk)==='fort-3','barracks fort-3');
ok(artKey(E,M,{type:'slipway',pieces:[],up:0})==='dock-2'&&artKey(E,M,{type:'dock',pieces:[],up:0})==='dock-1','dock kept');
const mine=tch('mineshaft'); ok(mine.tint===D.art.veinPal.iron,'mine tinted by vein');
// layout carries touch
const s2=E.newGame(2); E.normalize(s2); s2.land=Object.keys(M.parcels).slice(0,3); s2.structures.push({uid:'h1',type:'fishinghut',pieces:['fishrack'],up:0});
const L2=estateLayout(s2,D,E); const it=L2.items.find(i=>i.uid==='h1'); ok(it&&it.img==='hut-1'&&it.touch.emblem==='🐟','layout touch');
const css=fs.readFileSync(root+'style.css','utf8'); ok(css.includes('.rmscene')&&css.includes('prefers-reduced-motion'),'css');
console.log('r67 ok',pass,'checks');
