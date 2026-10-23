// R66: building interiors (roof-off reveal). Display-only data, every structure type mapped, model stacks beds and
// shows bought upgrades/fittings/free slots, no save step, CSS respects reduced motion.
import fs from 'fs'; import * as E from '../js/engine.js'; import { BUILD } from '../js/config.js'; import { STEPS } from '../js/engine/save-steps.js';
import { roomModel, roomHtml } from '../js/ui/estate-room.js';
const root=new URL('../',import.meta.url).pathname; const D={};
for(const f of fs.readdirSync(root+'data').filter(f=>f.endsWith('.json'))) D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(root+'data/'+f));
for(const f of D.estate.structureFiles) D['structures/'+f]=JSON.parse(fs.readFileSync(root+'data/structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const R=D.estaterooms;
ok(['R66','R67'].includes(BUILD)&&E.SCHEMA===55&&STEPS.at(-1).n===55,'R66, no new save step');
ok(fs.readFileSync(root+'js/main.js','utf8').includes('"estaterooms"'),'main.js loads estaterooms');
ok(Object.keys(R.rooms).length===12,'12 room families');
const types=D.estate.structureFiles.flatMap(f=>{const d=D['structures/'+f];return (Array.isArray(d)?d:(d.structures||Object.values(d)))});
for(const d of types) ok(R.rooms[R.typeRoom[d.id]],'room for '+d.id);
for(const k of Object.values(R.typeRoom)) ok(R.rooms[k],'room key '+k);
// a smithy with upgrades and a fitting; a house with 3 beds
const s=E.newGame(1); E.normalize(s); s.res.coin=1e7;
const st={uid:'st900',type:'smithy',pieces:['forge','workbench'],up:2,fittings:['runedanvil']};
const st2={uid:'st901',type:'house',pieces:['bunk','bunk','bunk','larder'],up:0};
s.structures.push(st,st2);
const M=roomModel(E,R,st,s); ok(M.fam==='workshop'&&M.floor.length===2&&M.floor[0].fixed,'smithy floor, forge built-in');
ok(M.wall.filter(w=>w.kind==='up').map(w=>w.name).join()==='Bellows,Fire-brick Hearth','bought upgrades on the wall');
ok(M.wall.some(w=>w.kind==='fit'&&w.id==='runedanvil'),'fitting shown');
const M2=roomModel(E,R,st2,s); ok(M2.floor[0].id==='bunk'&&M2.floor[0].n===3&&M2.floor.length===2,'beds stacked ×3');
ok(M2.free===E.freeSlots(s,st2),'free slots drawn');
const h=roomHtml(E,R,s,st2,Date.now(),false); ok(h.includes('rmroof')&&h.includes('×3')&&h.includes('rmcell empty'),'html: roof, stack, empty slot');
ok(!roomHtml(E,R,s,st2,Date.now()-5000,false).includes('rmroof'),'roof gone after the reveal');
// art hook: listed art replaces emoji, classic ignores it
R.art.pieces.bunk='bed'; ok(roomHtml(E,R,s,st2,0,false).includes('art/rooms/bed.webp')&&!roomHtml(E,R,s,st2,0,true).includes('art/rooms/'),'art hook + classic'); delete R.art.pieces.bunk;
// every real structure renders
for(const d of types){const x={uid:'t'+d.id,type:d.id,pieces:[...(d.fixed||[])],up:(d.upgrades||[]).length};ok(roomHtml(E,R,s,x,0,false).includes('estroom'),'renders '+d.id);}
ok(!JSON.stringify(s).includes('estRoom'),'nothing saved');
const css=fs.readFileSync(root+'style.css','utf8'); ok(/prefers-reduced-motion:reduce\)\{\.estroom \.rmroof\{display:none/.test(css),'reduced motion');
console.log('r66 ok',pass);
