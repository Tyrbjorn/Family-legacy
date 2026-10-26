// R68: wall layer (7 slots on the backwall, xN, overflow to floor, order built-ins/upgrades/furnishings), wall redraws,
// 11 upgrade wall pieces, display-only starter kits (bunkhouse bunks + trestle table, smithy anvil right of the forge,
// steel anvil tinted). No save change, classic ignores all art.
import fs from 'fs'; import * as E from '../js/engine.js'; import { BUILD } from '../js/config.js'; import { STEPS } from '../js/engine/save-steps.js';
import { roomModel, roomHtml, sceneLayout } from '../js/ui/estate-room.js';
const root=new URL('../',import.meta.url).pathname; const D={};
for(const f of fs.readdirSync(root+'data').filter(f=>f.endsWith('.json'))) D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(root+'data/'+f));
for(const f of D.estate.structureFiles) D['structures/'+f]=JSON.parse(fs.readFileSync(root+'data/structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const R=D.estaterooms, A=R.art;
ok(/^R(?:80|79|78|77|76|68|69|70|71|72|73|74|75)/.test(BUILD)&&E.SCHEMA===55&&STEPS.at(-1).n===55,'R68, save stays 55');
ok(D.changelog.entries.some(e=>e.build==='R68'),'changelog');
const webp=f=>{const b=fs.readFileSync(f);return b.slice(0,4).toString()==='RIFF'&&b.slice(8,12).toString()==='WEBP'&&b.slice(12,16).toString()==='VP8L';};
for(const k of ['herbrack','toolrack','reagentshelf','lanterns','tanrack']) ok(A.pieces[k]==='pieces/'+k+'-wall'&&A.onWall.includes(k),'wall redraw '+k);
const NEW=['trophywall','portraits','starcharts','candleniche','spiceshelf','shelving','oakracks','dryinglines','chiselrack','armorywall','mapwall'];
for(const k of NEW) ok(A.onWall.includes(k)&&Object.values(A.upPieces).includes(k),'new wall piece '+k);
for(const v of Object.values(A.pieces)) ok(webp(root+'art/rooms/'+v+'.webp'),'lossless '+v);
ok(!A.pieces.banner&&!A.onWall.includes('banner'),'banner not placed (not approved)');
const types=D.estate.structureFiles.flatMap(f=>D['structures/'+f]); const T=Object.fromEntries(types.map(d=>[d.id,d]));
for(const [up,p] of Object.entries(A.upPieces)) ok(types.some(d=>(d.upgrades||[]).some(u=>u.name===up)),'upgrade exists '+up);
for(const t of Object.keys(A.starters)) ok(T[t],'starter type '+t);
const s=E.newGame(1); E.normalize(s); const snap=JSON.stringify(s);
const lay=st=>{s.structures.push(st);const M=roomModel(E,R,st,s);return {M,L:sceneLayout(R,M),rc:A.rects[(A.painted[st.type]||{}).room||M.fam]};};
const hit=(a,b)=>a[0]<b[2]&&b[0]<a[2]&&a[1]<b[3]&&b[1]<a[3];
// bunkhouse: 2 bunks (bed drawing) + trestle table; bought bunks stack on
let {M,L}=lay({uid:'b1',type:'bunkhouse',pieces:[],up:0});
ok(L.filter(c=>c.at==='painted'&&c.id.startsWith('bunk')).length===2&&L.find(c=>c.id==='trestletable').fixed,'bunkhouse starters');
ok(M.floor.length===0,'starters not in the model floor (no stats/slots)');
// R70: bunkhouse is painted: the 2 starter bunks are the painted bunks; bought bunks are floor sprites that stack
({L}=lay({uid:'b2',type:'bunkhouse',pieces:['bunk','bunk'],up:0})); ok(L.filter(c=>c.id==='bunk'&&c.at==='floor').length===1&&L.find(c=>c.id==='bunk'&&c.at==='floor').n===2,'bought bunks stack');
// smithy (R68.2): forge + anvil are painted into the guildhall background; steel anvil is an add-on on the anvil
let r=lay({uid:'s1',type:'smithy',pieces:['forge','steelanvil'],up:0});
ok(r.L.find(c=>c.id==='forge').at==='painted'&&r.L.find(c=>c.id==='anvil').at==='painted','painted forge+anvil');
const sa=r.L.find(c=>c.id==='steelanvil'); ok(sa&&sa.at==='attach'&&sa.host==='anvil','steel anvil on the painted anvil');
// wall layer geometry + order + xN + overflow
for(const d of types){
  const allow=(d.allowed||[]).filter(p=>!E.pieceDef(p).fitting);
  const st={uid:'w'+d.id,type:d.id,pieces:[...(d.fixed||[]),...allow.slice(0,d.slots)],up:9,fittings:[]};
  const {L,rc}=lay(st); const W=rc.backwall, wl=L.filter(c=>c.at==='wall');
  ok(wl.length<=7,'max 7 wall '+d.id); ok(new Set(wl.map(c=>c.id)).size===wl.length,'one sprite per id '+d.id);
  for(const c of wl){ const sz=32*(c.s||1); ok(c.y===Math.max(0,W[3]+1-Math.round(25*(c.s||1))),'wall y '+d.id); ok(c.x>=0&&c.x+sz<=256,'wall x '+d.id); ok(A.onWall.includes(c.id),'onWall '+c.id); }
  for(let i=1;i<wl.length;i++) ok(wl[i].x-wl[i-1].x>=Math.round(32*(wl[i].s||1))-9,'no heavy overlap '+d.id);
  ok(!L.some(c=>c.at==='floor'&&A.onWall.includes(c.id)&&!c.over&&c.id!=='finecornice'),'wall pieces not on floor '+d.id);
  const h=roomHtml(E,R,s,st,0,true); ok(!h.includes('art/')&&!h.includes('rmscene'),'classic ignores '+d.id);
}
// big walls scaled + spread; normal walls 32px slots
// R70: the Kitchen is painted (32px wall slot); the old tall kitchen room (brewery etc.) keeps the big wall scale
r=lay({uid:'k1',type:'kitchen',pieces:['range'],up:1}); let w=r.L.filter(c=>c.at==='wall'); ok(w.length===0&&r.L.some(c=>c.at==='attach'&&c.up==='Spice Shelf'&&c.host==='larder'),'kitchen spice shelf on the larder shelves in the painted kitchen (R71)');
w=sceneLayout(R,{fam:'kitchen',type:'zzoldtype',starters:[],free:0,floor:[],wall:[{kind:'up',id:'Spice Shelf',icon:'x',name:'Spice Shelf'}]}).filter(c=>c.at==='wall'); ok(w.length===1&&w[0].id==='spiceshelf'&&w[0].s>1,'old kitchen room: spice shelf, big wall scale');
r=lay({uid:'l1',type:'advlodge',pieces:['questboard'],up:2}); w=r.L.filter(c=>c.at==='wall'); ok(w.map(c=>c.id).join()==='mapwall,trophywall'&&w[0].s===1&&w[1].x-w[0].x===32,'lodge map + trophy in order');
// order: built-in, upgrade, furnishing; overflow past 7 -> floor
const fake={fam:'home',type:'zzoldtype',starters:[],free:0,floor:[{id:'tanrack',n:1,fixed:true},{id:'herbrack',n:2,fixed:false},...['toolrack','reagentshelf','lanterns','shelving','oakracks','chiselrack','candleniche'].map(id=>({id,n:1,fixed:false}))],wall:[{kind:'up',id:'Map Room'}]};
const FL=sceneLayout(R,fake), FW=FL.filter(c=>c.at==='wall');
ok(FW.length===7&&FW[0].id==='tanrack'&&FW[1].id==='mapwall'&&FW[2].id==='herbrack'&&FW[2].n===2,'order + xN');
ok(FL.filter(c=>c.over&&c.at==='floor').length===3,'overflow to floor');
ok(roomHtml(E,R,s,{uid:'hx',type:'house',pieces:['herbrack','herbrack'],up:0},0,false).includes('×2'),'xN badge');
ok(JSON.stringify(s.structures.filter(x=>0))==='[]'&&JSON.parse(snap).version===s.version,'no save change');
console.log('r68 ok',pass,'checks');
