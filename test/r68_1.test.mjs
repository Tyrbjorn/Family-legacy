// R68.1: built-ins as structure at fixed spots; upgrades tied to a fixture are drawn onto it. Display only, save 55.
import fs from 'fs'; import * as E from '../js/engine.js'; import { STEPS } from '../js/engine/save-steps.js';
import { roomModel, roomHtml, sceneLayout } from '../js/ui/estate-room.js';
const root=new URL('../',import.meta.url).pathname; const D={};
for(const f of fs.readdirSync(root+'data').filter(f=>f.endsWith('.json'))) D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(root+'data/'+f));
for(const f of D.estate.structureFiles) D['structures/'+f]=JSON.parse(fs.readFileSync(root+'data/structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const R=D.estaterooms, A=R.art; ok(E.SCHEMA===55&&STEPS.at(-1).n===55,'save 55');
const types=D.estate.structureFiles.flatMap(f=>D['structures/'+f]);
for(const [up,a] of Object.entries(A.attach)){ const ts=types.filter(d=>(d.upgrades||[]).some(u=>u.name===up)||(d.tiers||[]).some(t=>(t.upgrades||[]).some(u=>u.name===up)));
  ok(ts.length,'upgrade exists '+up); ok(ts.some(d=>(d.fixed||[]).includes(a.host)||((A.painted||{})[d.id]?.fix||{})[a.host]||((A.starters||{})[d.id]||[]).some(x=>x[0]===a.host)),'host is a fixture of '+up); ok(!A.upPieces[up],'not also a wall piece '+up); }
const s=E.newGame(1); E.normalize(s);
const L=st=>{s.structures.push(st);return sceneLayout(R,roomModel(E,R,st,s));};
const sm=L({uid:'a1',type:'smithy',pieces:['forge'],up:3}); const fg=sm.find(c=>c.id==='forge'), at=sm.filter(c=>c.at==='attach');
ok(at.length===3&&at.every(c=>c.host==='forge'),'3 forge attachments');
const bl=at.find(c=>c.up==='Bellows'); ok(bl.side==='l'&&bl.x<fg.x&&Math.abs(bl.y-fg.y)<32,'bellows on forge left side');
ok(new Set(at.map(c=>c.side)).size===3,'distinct sides');
ok(!sm.some(c=>c.at==='floor'&&/Bellows/.test(c.name||'')),'no loose bellows');
const h=roomHtml(E,R,s,s.structures.at(-1),0,false); ok(h.includes('rmatt'),'attach html'); ok(!roomHtml(E,R,s,s.structures.at(-1),0,true).includes('rmatt'),'classic ignores');
const k=L({uid:'a2',type:'kitchen',pieces:['range'],up:2}); ok(k.find(c=>c.at==='attach'&&c.host==='range')&&k.find(c=>c.at==='attach'&&c.host==='larder'&&c.up==='Spice Shelf'),'kitchen pots on range, spice shelf on larder (R71)');
const sh=L({uid:'a3',type:'shrinehouse',pieces:['altar'],up:3}); ok(sh.find(c=>c.at==='attach'&&c.host==='altar')&&sh.find(c=>c.at==='wall'&&c.id==='candleniche'),'shrine');
console.log('r68.1 ok',pass,'checks');
