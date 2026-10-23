// R62 ART-3: estate map layout, art stages, dock on south shore, art files present, walkers; no save step
import fs from 'fs'; import * as E from '../js/engine.js'; import { BUILD } from '../js/config.js'; import { STEPS } from '../js/engine/save-steps.js';
import { estateLayout, artKey, walkerList, pathTile, route } from '../js/ui/estate-layout.js';
const root=new URL('../',import.meta.url).pathname; const D={};
for(const f of fs.readdirSync(root+'data').filter(f=>f.endsWith('.json'))) D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(root+'data/'+f));
for(const f of D.estate.structureFiles) D['structures/'+f]=JSON.parse(fs.readFileSync(root+'data/structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const fresh=()=>{const s=E.newGame(1);E.normalize(s);E.skipTutorial&&E.skipTutorial(s);s.res.coin=1e5;for(const k of Object.keys(s.res))s.res[k]=1e6;s.res.planks=s.res.stone=s.res.wood=1e6;return s;};
const M=D.estatemap, has=k=>fs.existsSync(root+'art/estate/'+k+'.webp');
ok(+BUILD.slice(1)>=62&&E.SCHEMA===55&&STEPS.at(-1).n===55,'R62, no new save step');
ok(JSON.parse(fs.readFileSync(root+'data/changelog.json')).entries.some(e=>e.build==='R62'),'changelog');
// every art key the data can produce exists
for(const [t,[b,n]] of Object.entries(M.art.chain)) ok(has(`${b}-${n+1}`),'chain art '+t);
for(const t of M.art.ups) for(const n of [1,2,3]) ok(has(`${t}-${n}`),'ups art '+t+n);
for(const b of Object.values(M.art.named)) for(const n of [1,2,3]) ok(has(`${b}-${n}`),'named '+b);
for(const k of ['tile-grass','tile-water','water-edge','tile-dirt-path','path-corner','path-tee','path-cross','path-end','plot-locked','walker-human-female','walker-human-male-hairkey','walker-dwarf-male','walker-dwarf-female']) ok(has(k),'tile '+k);
// every structure type in data is placeable (art or emoji)
for(const d of D.estate.structures){const k=artKey(E,M,{type:d.id,up:0,tier:0}); ok(k===null||has(k),'art for '+d.id);}
// early estate
let s=fresh(); E.buyLand(s,'plot'); E.buildStructure(s,'shack');
let L=estateLayout(s,D,E);
ok(L.W===M.cols*M.tile&&L.H===M.rows*M.tile,'size');
ok(L.parcels.filter(p=>p.owned).length===1&&L.parcels.length===9,'one parcel owned of 9');
const sh=L.items.find(i=>i.type==='shack'); ok(sh&&sh.img==='manor-1','shack -> manor-1');
ok(L.empties.length===E.landSlots(s)-E.landUsed(s),'empty outlines = free land');
const w=walkerList(s,D,E,L); ok(w.length>=1&&w.every(x=>x.job&&x.home&&/^#/.test(x.hair)&&/^#/.test(x.house)),'walkers have job/home/colours');
ok(w.every(x=>has(x.sheet)),'walker sheets exist');
// rects stay inside map and do not overlap
const inside=r=>r.x>=0&&r.y>=0&&r.x+r.w<=L.W&&r.y+r.h<=L.H;
// developed estate
s=fresh(); s.land=D.estate.lands.map(l=>l.id);
for(const t of ['shack','smithy','herbgarden','sawmill','quarry','dock']) E.buildStructure(s,t);
L=estateLayout(s,D,E);
ok(L.parcels.every(p=>p.owned),'all parcels owned');
ok(L.items.every(i=>inside(i.rect)),'items inside map');
for(let i=0;i<L.items.length;i++)for(let j=i+1;j<L.items.length;j++){const a=L.items[i].rect,b=L.items[j].rect;ok(!(a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h),'no overlap '+L.items[i].key+' '+L.items[j].key);}
const dk=L.items.find(i=>i.type==='dock');
ok(s.structures.some(x=>x.type==='dock'),'dock built');{ok(dk&&dk.rect.y===M.shoreRow*M.tile&&dk.img==='dock-1','dock on south shore row');}
ok(L.items.some(i=>i.img==='workshop-1'),'smithy -> workshop');
// paths: tile name valid; route ends at target
for(const k of L.paths){const [x,y]=k.split(',').map(Number);const [t,r]=pathTile(L.paths,x,y);ok(has(t)&&r>=0&&r<4,'path tile '+k);}
const rt=route(M,L.items[0].door,L.items.at(-1).door); ok(rt.length&&rt.at(-1).x===L.items.at(-1).door.x&&rt.at(-1).y===L.items.at(-1).door.y,'route reaches door');
// layout is pure: no save change
const before=JSON.stringify(s); estateLayout(s,D,E); walkerList(s,D,E,L); ok(JSON.stringify(s)===before,'layout does not touch save');
console.log(`PASS test/r62.test.mjs: ${pass} checks passed`);
