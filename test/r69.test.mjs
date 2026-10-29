// R69: new mill interior (Art room-mill-b). Painted hopper/millstones/drive shaft/flour bin/sacks are shared fixtures of the mill
// room (gristmill, sawmill, tannery); Iron Gearing / Second Stones are add-ons pinned to their anchors with their own art;
// floor furniture stays in floor_large, wall pieces in wall_strip, the service aisle and door approach stay clear.
// Zone fields (floor_large, wall_strip, paths, workspots, anchors) are general room-rect data. Display only, sim unchanged.
import fs from 'fs'; import * as E from '../js/engine.js'; import { BUILD } from '../js/config.js'; import { STEPS } from '../js/engine/save-steps.js';
import { roomModel, roomHtml, sceneLayout } from '../js/ui/estate-room.js';
const root=new URL('../',import.meta.url).pathname; const D={};
for(const f of fs.readdirSync(root+'data').filter(f=>f.endsWith('.json'))) D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(root+'data/'+f));
for(const f of D.estate.structureFiles) D['structures/'+f]=JSON.parse(fs.readFileSync(root+'data/structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const R=D.estaterooms, A=R.art, rc=A.rects.mill;
ok(/^R(?:86|85|84|83|82|81|80|79|78|77|76|69|70|71|72|73|74|75)/.test(BUILD)&&E.SCHEMA===55&&STEPS.at(-1).n===55,'R69, save stays 55');
ok(D.changelog.entries.some(e=>e.build==='R69'),'changelog');
const hit=(a,b)=>a[0]<b[2]&&b[0]<a[2]&&a[1]<b[3]&&b[1]<a[3];
// art files: lossless webp with the sizes Art delivered
const dims=f=>{const b=fs.readFileSync(root+'art/rooms/'+f+'.webp');ok(b.slice(0,4).toString()==='RIFF'&&b.slice(12,16).toString()==='VP8L','lossless '+f);const v=b.readUInt32LE(21);return [1+(v&0x3fff),1+((v>>14)&0x3fff)];};
ok(dims('room-mill').join()==='256,192'&&dims('iron-gearing').join()==='24,22'&&dims('second-stones').join()==='24,24','art sizes');
// room data: zones, paths, work spots, anchors (values from Art boxes.json)
ok(rc.floor_large.join()==='15,40,130,135'&&rc.wall_strip.join()==='12,9,191,39'&&rc.door.join()==='109,163,147,191','zones+door');
ok(rc.paths['service-aisle'].join()==='132,40,187,162'&&rc.paths['door-approach'].join()==='109,136,187,162','paths');
ok(rc.anchors['iron-gearing'].join()==='222,63,245,84'&&rc.anchors['second-stones'].join()==='164,56,187,79','anchors');
ok(Object.keys(rc.workspots).sort().join()==='flourbin,hopper,millwheel,sacks','work spots');
for(const [k,[x,y]] of Object.entries(rc.workspots)){ ok(x>=rc.floor[0]&&x<=rc.floor[2]&&y>=rc.floor[1]&&y<=rc.floor[3],'spot in floor '+k); ok(!hit([x,y,x+1,y+1],rc.floor_large),'spot outside furniture zone '+k); }
ok(!hit(rc.floor_large,rc.paths['service-aisle'])&&!hit(rc.floor_large,rc.door)&&!hit(rc.wall_strip,rc.floor_large),'zones do not overlap aisle/door/wall');
const PF=A.paintedFam.mill.fix; ok(Object.keys(PF).join()==='hopper,millwheel,driveshaft,flourbin,sacks','five painted fixtures');
ok(PF.hopper.join()==='194,12,225,53'&&PF.millwheel.join()==='188,55,230,97'&&PF.driveshaft.join()==='227,68,246,80'&&PF.flourbin.join()==='205,97,233,128'&&PF.sacks.join()==='189,128,241,165','fixture boxes');
for(const id of Object.keys(PF)) ok(A.paintedNames[id],'name '+id);
ok(!A.painted.gristmill&&A.attachArt['Iron Gearing']==='iron-gearing'&&A.attachArt['Second Stones']==='second-stones','attach art');
ok(A.rooms.mill==='room-mill'&&R.typeRoom.sawmill==='mill'&&R.typeRoom.gristmill==='mill'&&R.typeRoom.tannery==='mill'&&!A.painted.gristmill,'mill family unchanged (typeRoom), gristmill keeps room-mill');
// layouts
const s=E.newGame(1); E.normalize(s);
const T=Object.fromEntries(D.estate.structureFiles.flatMap(f=>D['structures/'+f]).map(d=>[d.id,d]));
const wallIds=A.onWall.filter(id=>id!=='finecornice'&&E.pieceDef(id));
const full=t=>({uid:'f'+t,type:t,pieces:[...(T[t].fixed||[]),...(T[t].allowed||[]).filter(p=>!E.pieceDef(p).fitting),...wallIds],up:9,tier:2,fittings:[]});
const sprite=c=>[c.x,c.y,c.x+32,c.y+32];
// R70: the sawmill and tannery moved to their own painted rooms (test/r70.test.mjs); the gristmill keeps the mill room
for(const t of ['gristmill']) for(const st of [full(t),{uid:'e'+t,type:t,pieces:[...(T[t].fixed||[])],up:0}]){
  s.structures.push(st); const M=roomModel(E,R,st,s), L=sceneLayout(R,M);
  ok(L.fam==='mill'&&L.work===rc.workspots,'room+work '+t);
  for(const id of Object.keys(PF)){ const c=L.filter(o=>o.id===id); ok(c.length===1&&c[0].at==='painted'&&c[0].box.join()===PF[id].join(),'painted '+t+' '+id); }
  for(const c of L){ const b=[c.x+2,c.y+4,c.x+30,c.y+31];
    if(['floor','free'].includes(c.at)){ ok(c.x>=rc.floor_large[0]&&c.y>=rc.floor_large[1]&&c.x+32<=rc.floor_large[2]+1&&c.y+32<=rc.floor_large[3]+1,'floor_large '+t+' '+c.id);
      for(const k of [...Object.values(PF),...Object.values(rc.paths),rc.door]) ok(!hit(b,k),'clear of fixture/aisle/door '+t+' '+c.id); }
    if(c.at==='wall'){ ok(c.x>=rc.wall_strip[0]&&c.x+32<=rc.wall_strip[2]+1&&c.y===15,'wall_strip '+t+' '+c.id); for(const k of Object.values(PF)) ok(!hit([c.x,c.y,c.x+32,c.y+25],k),'wall clear of fixtures '+t+' '+c.id); }
  }
  if(st.up) ok(L.filter(c=>c.at==='wall').length===5,'5 wall slots in the strip '+t+' ('+L.filter(c=>c.at==='wall').length+')');
  const hh=(roomHtml(E,R,s,st,0,false).match(/rmscene.*?<div class="rmfloor/s)||[''])[0]; ok((hh.match(/rmhit/g)||[]).length===5&&hh.includes('room-mill.webp'),'5 hit areas '+t);
  ok(!Object.keys(PF).some(id=>A.pieces[id]&&hh.includes(A.pieces[id]+'.webp')),'no sprite over fixtures '+t);
  const hc=roomHtml(E,R,s,st,0,true); ok(!hc.includes('art/')&&!hc.includes('rmhit'),'classic ignores art '+t);
  if(t!=='gristmill') ok(!L.some(c=>c.at==='attach'&&c.host==='millwheel'),'no millstone add-ons in '+t);
}
// gristmill add-ons: art at the exact anchors, own sizes, no emoji
const gm={uid:'gm',type:'gristmill',pieces:['millwheel','oven'],up:2}; s.structures.push(gm);
const G=sceneLayout(R,roomModel(E,R,gm,s)), ig=G.find(c=>c.up==='Iron Gearing'), ss=G.find(c=>c.up==='Second Stones');
ok(ig&&ss&&ig.host==='millwheel'&&ss.host==='millwheel','add-ons on millstones');
ok([ig.x,ig.y,ig.x+ig.w-1,ig.y+ig.h-1].join()==='222,63,245,84'&&ig.art==='iron-gearing','iron gearing anchor');
ok([ss.x,ss.y,ss.x+ss.w-1,ss.y+ss.h-1].join()==='164,56,187,79'&&ss.art==='second-stones','second stones anchor');
const gh=(roomHtml(E,R,s,gm,0,false).match(/rmscene.*?<div class="rmfloor/s)||[''])[0]; ok(gh.includes('iron-gearing.webp')&&gh.includes('second-stones.webp'),'add-on art drawn');
ok(!/rmatt rmemo/.test(gh),'no emoji placeholders on the mill');
const g1={uid:'g1',type:'gristmill',pieces:['millwheel'],up:1}; s.structures.push(g1);
ok(sceneLayout(R,roomModel(E,R,g1,s)).filter(c=>c.at==='attach').length===1,'only bought upgrades attach');
// other rooms keep their rules (no zone fields -> floor/backwall as before)
ok(!A.rects.home.floor_large&&!A.rects.home.wall_strip&&sceneLayout(R,roomModel(E,R,{uid:'h',type:'house',pieces:['hearth','bunk'],up:0},s)).fam==='house','house has its own room (R72); home rect kept');
console.log('r69 ok',pass,'checks');
