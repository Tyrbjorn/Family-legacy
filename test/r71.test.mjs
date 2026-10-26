// R71: fix the R70 rough spots. (1) distinct placeholder emoji for Twin Blades / Steam Saw / Scraping Frames (painted scene + chips only, Classic
// keeps the old icons); (2) kitchen wall strip holds 2 slots (rc.wallPx 23); (3) floor_large spot search starts flush so every painted room
// holds at least its largest possible build; (4) Armory -> barracks weapon rack, Spice Shelf -> kitchen larder (PT.attach, not also a wall piece).
// Display only: sim and save (55) unchanged.
import fs from 'fs'; import * as E from '../js/engine.js'; import { BUILD } from '../js/config.js'; import { STEPS } from '../js/engine/save-steps.js';
import { roomModel, roomHtml, sceneLayout } from '../js/ui/estate-room.js';
const root=new URL('../',import.meta.url).pathname; const D={};
for(const f of fs.readdirSync(root+'data').filter(f=>f.endsWith('.json'))) D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(root+'data/'+f));
for(const f of D.estate.structureFiles) D['structures/'+f]=JSON.parse(fs.readFileSync(root+'data/structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const R=D.estaterooms, A=R.art, hit=(a,b)=>a[0]<b[2]&&b[0]<a[2]&&a[1]<b[3]&&b[1]<a[3];
ok(/^R(?:81|80|79|78|77|76|7[12345])/.test(BUILD)&&E.SCHEMA===55&&STEPS.at(-1).n===55,'R71, save stays 55'); ok(D.changelog.entries.some(e=>e.build==='R71')&&D.changelog.entries.some(e=>e.build==='R70'),'changelog');
const T=Object.fromEntries(D.estate.structureFiles.flatMap(f=>D['structures/'+f]).map(d=>[d.id,d]));
const s=E.newGame(1); E.normalize(s); let uid=0;
const mk=(t,up,extra={})=>{const st={uid:'q'+t+(uid++),type:t,pieces:[...(T[t].fixed||[])],up,tier:0,fittings:[],...extra}; s.structures.push(st); return st;};
const lay=st=>sceneLayout(R,roomModel(E,R,st,s));
const ups=t=>(T[t].upgrades||[]).map(u=>u.name);
// 1. placeholders
const PH=A.upPlaceholder; const three=[['sawmill','Twin Blades'],['sawmill','Steam Saw'],['tannery','Scraping Frames']];
ok(new Set(three.map(([,u])=>PH[u])).size===3&&three.every(([,u])=>PH[u]&&PH[u]!=='🪚'),'three distinct emoji, none a saw');
for(const [t,u] of three){ const idx=ups(t).indexOf(u), st=mk(t,idx+1); const at=lay(st).filter(c=>c.up===u);
  ok(at.length===1&&at[0].icon===PH[u],'scene add-on uses '+PH[u]+' '+u);
  const h=roomHtml(E,R,s,st,0,false); ok(h.includes('>'+PH[u]+'</span>'),'painted mode: emoji in html '+u);
  const hc=roomHtml(E,R,s,st,0,true); ok(!hc.includes(PH[u])&&!hc.includes('rmscene'),'classic keeps old icon, no art '+u); }
ok(R.upKeys.every(([k,i])=>i!=='⚔️'||/Drill/.test(k))&&R.upKeys.find(([k])=>/Scraping/.test(k))[1]==='🪚','upKeys untouched (Classic icons)');
ok(PH.Armory&&PH.Armory!==R.upKeys.find(([k])=>/Drill/.test(k))[1]&&!Object.values(PH).slice(0,3).includes(PH.Armory),'Armory placeholder differs from Drill Ground icon');
// 2. kitchen wall strip
{ const rc=A.rects.kitchenhearth, W=rc.wall_strip, N=Math.floor((W[2]+1-W[0])/rc.wallPx);
  ok(rc.wallPx===23&&N===2,'kitchen strip fits 2 slots of 23px');
  const st=mk('kitchen',0,{pieces:['range','herbrack','toolrack','shelving','dryinglines']}); const w=lay(st).filter(c=>c.at==='wall');
  ok(w.length===2,'kitchen shows 2 wall pieces '+w.length);
  const boxes=Object.values(A.painted.kitchen.fix);
  for(const c of w){ ok(c.s===23/32&&c.x>=W[0]&&c.x+23<=W[2]+1&&c.y===W[3]-23&&c.y>=W[1],'wall slot inside strip '+c.x); for(const k of boxes) ok(!hit([c.x,c.y,c.x+23,c.y+23],k),'wall slot clear of fixtures'); }
  ok(w[0].x+23<=w[1].x,'slots do not overlap');
  const h=roomHtml(E,R,s,st,0,false); ok(/width:8\.98%/.test(h),'wall emoji box 23/256 wide'); }
// other painted rooms keep 32px wall slots
for(const t of ['barracks','chickencoop','cowpen','sawmill','tannery','bunkhouse']) ok(!A.rects[A.painted[t].room].wallPx,'32px wall slots '+t);
// 3. floor zones: spots start flush and hold the largest possible build
const MAX={barracks:5,chickencoop:5,cowpen:5,sawmill:5,tannery:5,kitchen:3,bunkhouse:2};
const COUNT={barracks:9,cowpen:9,sawmill:9,tannery:9,chickencoop:6,bunkhouse:6,kitchen:4};
for(const [t,m] of Object.entries(MAX)){
  const rk=A.painted[t].room, rc=A.rects[rk]; ok(rc.spotFlush===true,'spotFlush '+t);
  const st=mk(t,0), L=lay(st), fr=L.filter(o=>o.at==='free'||o.at==='floor');
  const M0=roomModel(E,R,st,s); M0.free=99; const spots=sceneLayout(R,M0).filter(o=>o.at==='free');
  ok(spots.length===COUNT[t],'spots '+t+' '+spots.length+' vs '+COUNT[t]); ok(spots.length>=m,'room holds largest build '+t+' '+spots.length+'>='+m);
  const boxes=Object.values(A.painted[t].fix), F=rc.floor_large;
  for(const o of spots){ const b=[o.x+2,o.y+4,o.x+30,o.y+31]; ok(o.x>=F[0]&&o.y>=F[1]&&o.x+32<=F[2]+1&&o.y+32<=F[3]+1,'inside floor_large '+t);
    for(const k of [...boxes,...Object.values(rc.paths),rc.door]) ok(!hit(b,k),'spot clear '+t);
    for(const p of spots) if(p!==o) ok(!hit(b,[p.x+2,p.y+4,p.x+30,p.y+31]),'spots do not overlap '+t); }
}
// a fully built production line shows all 5 pieces on the floor (none overflows to the list)
for(const t of ['sawmill','tannery','cowpen','chickencoop']){ const al=(T[t].allowed||[]); const st=mk(t,3,{tier:0,pieces:[...(T[t].fixed||[]),...al,'storage','workbench']});
  const M=roomModel(E,R,st,s); const L=sceneLayout(R,M); ok(L.filter(o=>o.at==='floor').length>=Math.min(5,[...new Set(st.pieces)].filter(p=>!(A.painted[t].fix||{})[p]).length),'floor sprites for built-up '+t); }
// gristmill (mill family) unchanged: no spotFlush, still 6 spots
{ ok(!A.rects.mill.spotFlush,'mill no spotFlush'); const st=mk('gristmill',0); const M=roomModel(E,R,st,s); M.free=99; ok(sceneLayout(R,M).filter(o=>o.at==='free').length===6,'gristmill spots unchanged'); }
// 4. Armory / Spice Shelf
{ const idx=ups('barracks').indexOf('Armory'), st=mk('barracks',idx+1), L=lay(st), a=L.filter(c=>c.up==='Armory'), b=A.rects.barracks.anchors.rack_upgrade;
  ok(a.length===1&&a[0].host==='weaponrack2'&&[a[0].x,a[0].y,a[0].x+a[0].w-1,a[0].y+a[0].h-1].join()===b.join(),'Armory on rack_upgrade at weaponrack2');
  ok(!L.some(c=>c.at==='wall'&&c.id==='armorywall'),'Armory no longer also a wall piece');
  ok(!lay(mk('barracks',0)).some(c=>c.up==='Armory'),'Armory only when bought'); ok(!roomHtml(E,R,s,st,0,true).includes('rmatt'),'classic: no add-on'); }
{ const idx=ups('kitchen').indexOf('Spice Shelf'), st=mk('kitchen',idx+1), L=lay(st), a=L.filter(c=>c.up==='Spice Shelf'), b=A.rects.kitchenhearth.anchors.larder_upgrade;
  ok(a.length===1&&a[0].host==='larder'&&[a[0].x,a[0].y,a[0].x+a[0].w-1,a[0].y+a[0].h-1].join()===b.join(),'Spice Shelf on larder_upgrade at larder');
  ok(!L.some(c=>c.at==='wall'&&c.id==='spiceshelf'),'Spice Shelf not also a wall piece');
  const st2=mk('kitchen',3); const L2=lay(st2); ok(L2.some(c=>c.up==='Copper Pots'&&c.host==='range')&&L2.some(c=>c.up==='Spice Shelf'),'Copper Pots + Spice Shelf both attached'); }
// old kitchen room (brewery) still takes the Spice Shelf as a wall piece: unchanged
{ const w=sceneLayout(R,{fam:'kitchen',type:'brewery',starters:[],free:0,floor:[],wall:[{kind:'up',id:'Spice Shelf',icon:'x',name:'Spice Shelf'}]}).filter(c=>c.at==='wall'); ok(w.length===1&&w[0].id==='spiceshelf','brewery (old kitchen room): spice shelf still a wall piece'); }
// still unmapped on purpose (no obvious host): nothing attaches there, and nothing else changed
for(const [rk,an] of [['chickencoop','grain_bin_upgrade'],['cowpen','stall_lower_upgrade'],['kitchenhearth','table_upgrade'],['bunkhouse','bunk_bedding_upper'],['bunkhouse','hearth_upgrade'],['bunkhouse','table_upgrade']])
  ok(A.rects[rk].anchors[an]&&!Object.values(A.rects[rk].upAnchors).includes(an),'unmapped anchor left '+rk+' '+an);
console.log('r71 test: '+pass+' checks passed');
