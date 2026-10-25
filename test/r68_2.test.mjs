// R68.2: painted built-ins. Smithy uses the guildhall interior (forge, anvil, workbench, tool rack painted in); gristmill's
// millstone is painted. No sprite over painted fixtures, hit areas instead, upgrades attach to the painted boxes, furniture
// and wall items avoid them. Display only: no save step, sim unchanged, classic ignores it.
import fs from 'fs'; import * as E from '../js/engine.js'; import { BUILD } from '../js/config.js'; import { STEPS } from '../js/engine/save-steps.js';
import { roomModel, roomHtml, sceneLayout } from '../js/ui/estate-room.js';
const root=new URL('../',import.meta.url).pathname; const D={};
for(const f of fs.readdirSync(root+'data').filter(f=>f.endsWith('.json'))) D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(root+'data/'+f));
for(const f of D.estate.structureFiles) D['structures/'+f]=JSON.parse(fs.readFileSync(root+'data/structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const R=D.estaterooms, A=R.art, PT=A.painted;
ok(/^R(68\.2|69|70|71|72|73)$/.test(BUILD)&&E.SCHEMA===55&&STEPS.at(-1).n===55,'R68.2, save stays 55');
ok(D.changelog.entries.some(e=>e.build==='R68.2'),'changelog');
const types=D.estate.structureFiles.flatMap(f=>D['structures/'+f]); const T=Object.fromEntries(types.map(d=>[d.id,d]));
const hit=(a,b)=>a[0]<b[2]&&b[0]<a[2]&&a[1]<b[3]&&b[1]<a[3];
ok(fs.existsSync(root+'art/rooms/room-guildhall.webp')&&A.rooms.guildhall==='room-guildhall'&&A.rects.guildhall,'guildhall art+rects');
for(const [t,p] of Object.entries(PT)){ if(t.startsWith('manor:')) continue; ok(T[t],'type '+t);
  for(const [id,b] of Object.entries(p.fix)){ ok(b[0]>=0&&b[1]>=0&&b[2]<=256&&b[3]<=192&&b[2]>b[0]&&b[3]>b[1],'box '+t+id); ok(A.paintedNames[id],'name '+id); }
  for(const [id,[h]] of Object.entries(p.onto||{})) ok(p.fix[h],'onto host '+id); }
ok(!(A.starters.smithy||[]).length,'smithy starter anvil replaced by the painted one');
const s=E.newGame(1); E.normalize(s);
const all=t=>{const d=T[t];return {uid:'x'+t,type:t,pieces:[...(d.fixed||[]),...(d.allowed||[]).filter(p=>!E.pieceDef(p).fitting)],up:9,tier:2,fittings:d.fittings||[]};};
for(const t of Object.keys(PT).filter(k=>!k.startsWith("manor:"))) for(const st of [all(t),{uid:'e'+t,type:t,pieces:[...(T[t].fixed||[])],up:0}]){
  s.structures.push(st); const M=roomModel(E,R,st,s), L=sceneLayout(R,M), P=PT[t], boxes=[...Object.values(P.fix),...(P.decor||[])];
  for(const id of Object.keys(P.fix)){ const c=L.filter(o=>o.id===id); ok(c.length===1&&c[0].at==='painted','painted only '+t+id); }
  for(const c of L) if(['floor','free','wall','forge'].includes(c.at)){ const b=c.at==='wall'?[c.x,c.y,c.x+32,c.y+25]:[c.x+2,c.y+4,c.x+30,c.y+31]; ok(!boxes.some(k=>hit(b,k)),'avoids painted '+t+' '+c.id+' '+c.at); }
  for(const c of L.filter(o=>o.at==='attach')){ const h=L.find(o=>o.id===c.host&&o.at==='painted'); if(h&&!c.w) ok(c.x>=h.x-8&&c.x<=h.x+h.w&&c.y>=h.y-8&&c.y<=h.y+h.h,'attach on box '+c.up); }
  const html=(roomHtml(E,R,s,st,0,false).match(/rmscene.*?<div class="rmfloor/s)||[''])[0]; ok(html.includes('rmhit')&&!Object.keys(P.fix).some(id=>A.pieces[id]&&html.includes(A.pieces[id]+'.webp')),'no sprite over painted '+t);
  const hc=roomHtml(E,R,s,st,0,true); ok(!hc.includes('art/')&&!hc.includes('rmhit'),'classic '+t);
}
const sm={uid:'sm',type:'smithy',pieces:['forge','workbench','steelanvil'],up:3,fittings:['runedanvil']}; s.structures.push(sm);
const L=sceneLayout(R,roomModel(E,R,sm,s)); const at=u=>L.find(c=>c.at==='attach'&&c.up===u);
ok(at('Bellows').host==='forge'&&at('Bellows').side==='l'&&at('Master Crucible').side==='r','forge attachments');
ok(at('steelanvil').host==='anvil'&&at('runedanvil').host==='anvil','anvil add-ons');
ok(L.fam==='guildhall'&&roomHtml(E,R,s,sm,0,false).includes('room-guildhall.webp'),'guildhall bg');
const bs={uid:'bs',type:'buildersyard',pieces:['storage'],up:0}; s.structures.push(bs); ok(sceneLayout(R,roomModel(E,R,bs,s)).fam==='buildersyard','builders yard has its own R72 room');
const gm={uid:'gm',type:'gristmill',pieces:['millwheel','oven'],up:2}; s.structures.push(gm);
const G=sceneLayout(R,roomModel(E,R,gm,s)); ok(G.find(c=>c.id==='millwheel').at==='painted'&&G.filter(c=>c.at==='attach'&&c.host==='millwheel').length===2,'mill gearing on the painted millstone');
console.log('r68.2 ok',pass,'checks');
