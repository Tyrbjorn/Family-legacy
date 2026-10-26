// R70: barracks, chickencoop, cowpen, kitchen (building only), sawmill, tannery and bunkhouse each get their own painted room
// (art.painted[type].room), wired like the guildhall/mill: painted fixtures = built-ins with hit areas, upgrades pinned at the
// boxes.json anchors (rc.upAnchors), floor_large / wall_strip / paths respected, work spots stored in the room data.
// Classic emoji mode ignores all art. Display only: sim and save (55) unchanged.
import fs from 'fs'; import * as E from '../js/engine.js'; import { BUILD } from '../js/config.js'; import { STEPS } from '../js/engine/save-steps.js';
import { roomModel, roomHtml, sceneLayout } from '../js/ui/estate-room.js';
const root=new URL('../',import.meta.url).pathname; const D={};
for(const f of fs.readdirSync(root+'data').filter(f=>f.endsWith('.json'))) D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(root+'data/'+f));
for(const f of D.estate.structureFiles) D['structures/'+f]=JSON.parse(fs.readFileSync(root+'data/structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const R=D.estaterooms, A=R.art, hit=(a,b)=>a[0]<b[2]&&b[0]<a[2]&&a[1]<b[3]&&b[1]<a[3];
ok(/^R(?:82|81|80|79|78|77|76|70|71|72|73|74|75)/.test(BUILD)&&E.SCHEMA===55&&STEPS.at(-1).n===55,'R70, save stays 55'); ok(D.changelog.entries.some(e=>e.build==='R70'),'changelog');
const X={"barracks":{"room":"barracks","file":"room-barracks","fix":{"weaponrack":[22,24,63,58],"weaponrack2":[68,24,106,58],"dummy":[48,70,82,115]},"floor_large":[144,46,239,141],"wall_strip":[110,17,239,42],"door":[113,163,143,191],"paths":{"sparring_lane":[93,60,143,162],"door_approach":[93,140,143,162]},"work":{"weaponrack":[42,64],"weaponrack2":[87,64],"dummy":[92,102]},"anchors":{"rack_upgrade":[82,26,105,49],"dummy_upgrade":[50,66,73,89]},"ups":{"Drill Ground":"dummy_upgrade"}},"chickencoop":{"room":"chickencoop","file":"room-chickencoop","fix":{"nestboxes":[25,21,87,71],"roostbars":[178,37,235,70],"grainbin":[203,104,234,150],"gate":[111,158,142,191]},"floor_large":[20,74,115,157],"wall_strip":[98,19,175,45],"door":[113,158,143,191],"paths":{"central_aisle":[118,46,177,157],"door_approach":[116,140,146,157]},"work":{"nestboxes":[92,58],"roostbars":[170,60],"grainbin":[196,128],"gate":[127,150]},"anchors":{"nest_box_upgrade":[29,24,56,46],"roost_upgrade":[182,40,230,56],"grain_bin_upgrade":[205,106,232,128],"gate_upgrade":[113,160,141,175]},"ups":{"Prize Flock":"nest_box_upgrade","Heated Roost":"roost_upgrade","Bigger Run":"gate_upgrade"}},"cowpen":{"room":"cowpen","file":"room-cowpen","fix":{"milkstalls":[19,26,69,88],"milkstalls2":[19,90,69,151],"hayrack":[100,22,156,60],"milkingstool":[73,35,95,66]},"floor_large":[144,61,239,156],"wall_strip":[160,19,230,46],"door":[113,158,143,191],"paths":{"central_aisle":[97,62,143,157],"door_approach":[113,140,143,157]},"work":{"milkstalls":[73,74],"milkstalls2":[76,122],"hayrack":[128,66],"milkingstool":[84,70]},"anchors":{"stall_upper_upgrade":[24,30,62,60],"stall_lower_upgrade":[24,94,62,125],"hay_rack_upgrade":[104,26,152,52]},"ups":{"Prize Herd":"stall_upper_upgrade","Hay Loft":"hay_rack_upgrade"}},"kitchen":{"room":"kitchenhearth","file":"room-kitchen-hearth","fix":{"larder":[21,20,102,89],"range":[163,1,224,85],"firewood":[222,64,241,90],"preptable":[25,98,111,144]},"floor_large":[159,91,244,156],"wall_strip":[112,18,158,54],"door":[113,158,143,191],"paths":{"central_aisle":[112,57,158,157],"door_approach":[113,140,143,157]},"work":{"larder":[60,93],"range":[190,89],"firewood":[215,88],"preptable":[68,150]},"anchors":{"hearth_upgrade":[172,28,214,70],"larder_upgrade":[28,24,98,62],"table_upgrade":[30,100,106,125]},"ups":{"Copper Pots":"hearth_upgrade"}},"sawmill":{"room":"sawmill","file":"room-sawmill","fix":{"plankrack":[25,19,81,59],"sawtable":[31,65,92,127],"logpile":[23,117,60,153]},"floor_large":[144,46,239,141],"wall_strip":[84,17,239,42],"door":[113,158,143,191],"paths":{"central_aisle":[97,46,143,157],"door_approach":[97,146,143,157]},"work":{"plankrack":[53,64],"sawtable":[95,100],"logpile":[67,138]},"anchors":{"twin_blades_upgrade":[80,68,96,92],"steam_saw_upgrade":[20,68,42,92]},"ups":{"Twin Blades":"twin_blades_upgrade","Steam Saw":"steam_saw_upgrade"}},"tannery":{"room":"tannery","file":"room-tannery","fix":{"tanracks":[24,19,81,63],"tanvats":[25,64,84,94],"hideframe":[24,101,67,149],"barkpile":[67,119,96,144]},"floor_large":[144,46,239,141],"wall_strip":[84,17,239,42],"door":[113,158,143,191],"paths":{"central_aisle":[97,46,143,157],"door_approach":[97,146,143,157]},"work":{"tanracks":[88,52],"tanvats":[54,98],"hideframe":[78,108],"barkpile":[82,150]},"anchors":{"scraping_frames_upgrade":[19,66,40,90],"bark_pits_upgrade":[76,66,96,90]},"ups":{"Scraping Frames":"scraping_frames_upgrade","Bark Pits":"bark_pits_upgrade"}},"bunkhouse":{"room":"bunkhouse","file":"room-bunkhouse","fix":{"bunkup":[25,21,64,100],"bunklow":[25,101,64,173],"hearth":[171,1,227,70],"trestletable":[186,77,230,131]},"floor_large":[70,48,165,125],"wall_strip":[67,19,168,46],"door":[113,174,143,191],"paths":{"central_aisle":[65,126,185,172],"door_approach":[113,161,143,173]},"work":{"bunkup":[67,60],"bunklow":[67,140],"hearth":[196,75],"trestletable":[181,108]},"anchors":{"bunk_bedding_upper":[30,30,59,58],"bunk_bedding_lower":[30,108,59,136],"hearth_upgrade":[180,34,218,62],"table_upgrade":[203,77,230,105]},"ups":{}}};
const T=Object.fromEntries(D.estate.structureFiles.flatMap(f=>D['structures/'+f]).map(d=>[d.id,d]));
const dims=f=>{const b=fs.readFileSync(root+'art/rooms/'+f+'.webp');ok(b.slice(0,4).toString()==='RIFF'&&b.slice(12,16).toString()==='VP8L','lossless '+f);const v=b.readUInt32LE(21);return [1+(v&0x3fff),1+((v>>14)&0x3fff)];};
const s=E.newGame(1); E.normalize(s);
const wallIds=A.onWall.filter(id=>id!=='finecornice'&&E.pieceDef(id));
const full=t=>({uid:'f'+t,type:t,pieces:[...(T[t].fixed||[]),...(T[t].allowed||[]).filter(p=>!E.pieceDef(p).fitting),...wallIds],up:9,tier:2,fittings:[]});
const ups=t=>[...(T[t].upgrades||[]),...(T[t].tiers||[]).flatMap(x=>x.upgrades||[])].map(u=>u.name);
for(const [t,x] of Object.entries(X)){
  ok(dims(x.file).join()==='256,192','room art 256x192 '+t); ok(fs.statSync(root+'art/rooms/'+x.file+'.webp').size>5000,'art not empty '+t);
  const rc=A.rects[x.room]; ok(A.rooms[x.room]===x.file&&rc,'room+rect '+t);
  ok(rc.floor_large.join()===x.floor_large.join()&&rc.wall_strip.join()===x.wall_strip.join()&&rc.door.join()===x.door.join(),'zones '+t);
  ok(!hit(rc.floor_large,rc.door)&&!hit(rc.wall_strip,rc.floor_large)&&Object.values(rc.paths).every(p=>!hit(rc.floor_large,p)),'zones do not overlap aisle/door/wall '+t);
  ok(JSON.stringify(rc.workspots)===JSON.stringify(x.work)&&Object.keys(rc.workspots).every(k=>x.fix[k]),'work spots keyed by painted fixture '+t);
  ok(JSON.stringify(rc.anchors)===JSON.stringify(x.anchors),'anchors '+t);
  for(const id of Object.keys(x.fix)) ok(A.paintedNames[id],'name '+id);
  // sceneLayout: own room, fixtures with hit areas, nothing else
  for(const st of [full(t),{uid:'e'+t,type:t,pieces:[...(T[t].fixed||[])],up:0}]){
    st.uid+=s.structures.length; s.structures.push(st); const M=roomModel(E,R,st,s), L=sceneLayout(R,M);
    ok(L.fam===x.room&&L.work===rc.workspots,'own room '+t+' '+L.fam);
    for(const id of Object.keys(x.fix)){ const c=L.filter(o=>o.id===id); ok(c.length===1&&c[0].at==='painted'&&c[0].box.join()===x.fix[id].join(),'painted '+t+' '+id); }
    const boxes=Object.values(x.fix);
    for(const c of L){ const b=[c.x+2,c.y+4,c.x+30,c.y+31];
      if(['floor','free'].includes(c.at)){ ok(c.x>=rc.floor_large[0]&&c.y>=rc.floor_large[1]&&c.x+32<=rc.floor_large[2]+1&&c.y+32<=rc.floor_large[3]+1,'floor_large '+t+' '+c.id);
        for(const k of [...boxes,...Object.values(rc.paths),rc.door]) ok(!hit(b,k),'clear of fixture/aisle/door '+t+' '+c.id); }
      if(c.at==='wall'){ const px=rc.wallPx||32,wy=rc.wallPx?rc.wall_strip[3]-px:rc.wall_strip[3]+1-25,wh=rc.wallPx||25; ok(c.x>=rc.wall_strip[0]&&c.x+px<=rc.wall_strip[2]+1&&c.y===wy,'wall_strip '+t+' '+c.id); for(const k of boxes) ok(!hit([c.x,c.y,c.x+px,c.y+wh],k),'wall clear of fixtures '+t+' '+c.id); } }
    // no duplicate overlay sprite for a painted fixture (the piece merges into its box)
    for(const p of st.pieces){ const id=E.baseId(p); if(x.fix[id]||(A.painted[t].as||{})[id]) ok(!L.some(o=>o.id===id&&o.at!=='painted'),'no duplicate sprite '+t+' '+id); }
    const h=(roomHtml(E,R,s,st,0,false).match(/rmscene.*?<div class="rmfloor/s)||[''])[0];
    ok(h.includes(x.file+'.webp')&&(h.match(/rmhit/g)||[]).length===Object.keys(x.fix).length,'html: room art + hit areas '+t);
    const hc=roomHtml(E,R,s,st,0,true); ok(!hc.includes('art/')&&!hc.includes('rmhit')&&!hc.includes('rmscene'),'classic ignores art '+t);
  }
  // upgrades attach at the exact anchors, only when bought, as add-ons (no loose copies)
  for(const [u,an] of Object.entries(x.ups)){
    ok(ups(t).includes(u)&&A.attach[u]&&!A.upPieces[u],'upgrade exists '+t+' '+u);
    const st=full(t); const idx=ups(t).indexOf(u); st.uid='u'+t+idx; st.up=idx+1; st.tier=0; s.structures.push(st);
    const at=sceneLayout(R,roomModel(E,R,st,s)).filter(c=>c.up===u);  ok(at.length===1&&at[0].at==='attach','attached '+u);
    const b=x.anchors[an]; ok([at[0].x,at[0].y,at[0].x+at[0].w-1,at[0].y+at[0].h-1].join()===b.join(),'exact anchor '+u+' '+an);
    ok(sceneLayout(R,roomModel(E,R,{...st,uid:st.uid+'z',up:0},s)).filter(c=>c.at==='attach').length===0,'not bought -> no add-on '+u);
    ok(!roomHtml(E,R,s,st,0,true).includes('rmatt'),'classic: no add-on '+u);
  }
}
// specific mappings
const SX=(t,u)=>X[t].ups[u]; ok(SX('sawmill','Twin Blades')==='twin_blades_upgrade'&&SX('sawmill','Steam Saw')==='steam_saw_upgrade','sawmill anchors');
ok(SX('tannery','Scraping Frames')==='scraping_frames_upgrade'&&SX('tannery','Bark Pits')==='bark_pits_upgrade','tannery anchors');
ok(Object.keys(X.cowpen.fix).join()==='milkstalls,milkstalls2,hayrack,milkingstool'&&Object.keys(X.chickencoop.fix)[0]==='nestboxes'&&Object.keys(X.barracks.fix)[0]==='weaponrack','piece ids mapped');
ok(Object.keys(X.sawmill.fix).includes('sawtable')&&Object.keys(X.tannery.fix).includes('tanvats')&&Object.keys(X.kitchen.fix).includes('range'),'sawtable, tanvats, range');
// kitchen: the hearth piece IS the painted hearth (alias), range+hearth -> one hit area
{ const st={uid:'kh',type:'kitchen',pieces:['range','hearth'],up:0}; s.structures.push(st); const L=sceneLayout(R,roomModel(E,R,st,s));
  ok(L.filter(c=>c.id==='range').length===1&&!L.some(c=>c.id==='hearth'),'kitchen hearth piece merges into the painted hearth'); }
// bunkhouse: the 2 starter bunks are the 2 painted bunks, bought bunks are floor sprites, trestle table painted
{ const st={uid:'bh',type:'bunkhouse',pieces:['bunk','bunk'],up:0}; s.structures.push(st); const L=sceneLayout(R,roomModel(E,R,st,s));
  ok(L.filter(c=>c.at==='painted'&&/^bunk/.test(c.id)).length===2&&L.find(c=>c.id==='trestletable').at==='painted'&&L.find(c=>c.id==='hearth').at==='painted','bunkhouse painted bunks/table/hearth');
  const b=L.filter(c=>c.id==='bunk'); ok(b.length===1&&b[0].at==='floor'&&b[0].n===2,'bought bunks are one stacked floor sprite'); }
// painted rooms never inherit the mill fixtures
for(const t of ['sawmill','tannery']){ const L=sceneLayout(R,roomModel(E,R,full(t),s)); ok(!L.some(c=>['hopper','driveshaft','flourbin','sacks'].includes(c.id)),'no mill fixtures in '+t); }
// unchanged rooms: other kitchen / lodge / mill buildings keep their old rooms, no painted fixtures, no hit areas
const OLD={fort:'lodge'}; // R72: every other building now has its own painted room; the fort is a manor (its whole-building model keeps the old family, the view shows manor tabs)
for(const [t,fam] of Object.entries(OLD)){ if(!T[t]) continue; ok(!A.painted[t],'not painted '+t);
  const st=full(t); s.structures.push(st); const L=sceneLayout(R,roomModel(E,R,st,s)); ok(L.fam===fam&&!L.some(c=>c.at==='painted'),'old room '+t);
  const h=roomHtml(E,R,s,st,0,false); ok(A.manor.types[t]||(h.includes('room-'+fam+'.webp')&&!h.includes('rmhit')),'old art '+t); }
ok(A.rooms.kitchen==='room-kitchen'&&A.rooms.lodge==='room-lodge'&&A.rooms.mill==='room-mill'&&A.rooms.barn==='room-barn','old room files kept');
{ const st=full('gristmill'); s.structures.push(st); const L=sceneLayout(R,roomModel(E,R,st,s)); ok(L.fam==='mill'&&['hopper','millwheel','driveshaft','flourbin','sacks'].every(id=>L.find(c=>c.id===id&&c.at==='painted')),'gristmill keeps room-mill + its 5 fixtures'); }
// the legend/class family of each type is unchanged
ok(R.typeRoom.sawmill==='mill'&&R.typeRoom.tannery==='mill'&&R.typeRoom.chickencoop==='barn'&&R.typeRoom.cowpen==='barn'&&R.typeRoom.kitchen==='kitchen'&&R.typeRoom.barracks==='lodge'&&R.typeRoom.bunkhouse==='lodge','typeRoom families unchanged');
// animal art is not wired in
ok(!JSON.stringify(A).match(/animal/i)&&!fs.existsSync(root+'art/rooms/animals'),'no animal art wired');
console.log('r70 ok',pass,'checks');
