// R38: save slots
import fs from 'fs'; import * as E from '../js/engine.js'; import { T } from '../js/engine/state.js';
const R=new URL('../data/',import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const S=E.Slots;
// Storage shim (localStorage API) with an optional byte cap to simulate "storage full"
const store=(cap=Infinity)=>{const m=new Map();return{get length(){return m.size},key:i=>[...m.keys()][i],getItem:k=>m.has(k)?m.get(k):null,removeItem:k=>m.delete(k),setItem(k,v){v=String(v);let b=0;for(const[a,x]of m)if(a!==k)b+=(a.length+x.length)*2;if(b+(k.length+v.length)*2>cap){const e=new Error('QuotaExceededError');e.name='QuotaExceededError';throw e;}m.set(k,v);},_m:m};};
const game=(name,days=0)=>{const s=E.newGame(1);E.normalize(s);s.members[0].name=name;s.day=days;return s;};
ok(S.SLOTS===5,'5 slots');
// migration: old save copied to slot 1, original kept, idempotent
{ const st=store(); const g=game('Rowan',400); g.legacy.renown=777; const raw=E.serialize(g); st.setItem(S.OLD_KEY,raw);
  const r=S.migrateSlots(st); ok(r.moved&&st.getItem(S.slotKey(1))===raw,'old save copied into slot 1 byte for byte'); ok(st.getItem(S.OLD_KEY)===raw,'original kept as backup');
  const L=S.listSlots(st); ok(!L[0].empty&&L[0].name==='The Rowan line'&&L[0].card.year===2&&L[0].card.legacy===777&&S.lastSlot(st)===1,'slot 1 card: name, year, Legacy');
  st.setItem(S.slotKey(1),'changed'); S.migrateSlots(st); ok(st.getItem(S.slotKey(1))==='changed','migration runs once'); }
{ const st=store(); ok(!S.migrateSlots(st).moved&&S.listSlots(st).every(x=>x.empty),'no old save: all slots empty'); }
{ const st=store(); st.setItem(S.OLD_KEY,'{broken'); const r=S.migrateSlots(st); ok(r.error&&r.fallback&&st.getItem(S.OLD_KEY)==='{broken','failed copy keeps the old save and falls back'); }
// save / load / per-slot Legacy
{ const st=store(); S.migrateSlots(st); const a=game('Ada',10), b=game('Bran',2000); a.legacy.renown=5; b.legacy.renown=900;
  ok(S.saveSlot(st,1,a,1000).ok&&S.saveSlot(st,3,b,2000).ok,'save two slots'); ok(S.lastSlot(st)===3,'last played tracked');
  const la=S.loadSlot(st,1), lb=S.loadSlot(st,3); ok(la.members[0].name==='Ada'&&lb.members[0].name==='Bran','load each slot'); ok(la.legacy.renown===5&&lb.legacy.renown===900,'Legacy renown per slot');
  ok(S.lastSlot(st)===3&&S.loadSlot(st,1)&&S.lastSlot(st)===1,'loading sets last played'); ok(S.loadSlot(st,2)===null,'empty slot loads nothing'); ok(S.firstEmpty(st)===2,'first empty slot');
  const L=S.listSlots(st); ok(L[2].card.gen>=1&&L[2].card.head==='Bran'&&L[2].played===2000&&L[0].played===1000,'cards: head, generation, last played');
  // rename
  S.renameSlot(st,3,'House Bran','trade route run'); ok(S.listSlots(st)[2].name==='House Bran'&&S.listSlots(st)[2].note==='trade route run','rename + note'); S.saveSlot(st,3,b); ok(S.listSlots(st)[2].name==='House Bran','name survives saving');
  // delete + undo
  ok(S.deleteSlot(st,3)&&S.listSlots(st)[2].empty,'delete'); ok(S.undoDelete(st,3)&&S.loadSlot(st,3).members[0].name==='Bran'&&S.listSlots(st)[2].name==='House Bran','undo restores save and name'); ok(!S.undoDelete(st,3),'undo only once'); }
// storage: bar numbers, warning, full storage never loses the stored save
{ const st=store(); S.migrateSlots(st); const g=game('Cy'); S.saveSlot(st,1,g); const u=S.storageUsed(st); ok(u.bytes>0&&u.quota===5*1048576&&!u.warn,'storage use measured');
  st.setItem('pad','x'.repeat(Math.ceil(S.QUOTA*0.85/2))); ok(S.storageUsed(st).warn,'warns above 80%');
  const cap=store(60000); S.migrateSlots(cap); const s1=game('Dee'); ok(S.saveSlot(cap,1,s1).ok,'fits'); const before=cap.getItem(S.slotKey(1));
  s1.log=Array.from({length:4000},(_,i)=>({day:i,msg:'x'.repeat(20)})); const r=S.saveSlot(cap,1,s1); ok(!r.ok&&r.err==='storage full','full storage reported'); ok(cap.getItem(S.slotKey(1))===before,'old save untouched when full'); }
// game wiring (source)
const src=f=>fs.readFileSync(new URL('../js/'+f,import.meta.url)).toString();
ok(src('main.js').includes('SL.migrateSlots(localStorage)')&&src('main.js').includes('SL.lastSlot(localStorage)'),'launch: migrate, open last played slot');
ok(src('main.js').includes('U.delArm !== +v'),'delete needs a second press'); ok(src('ui/common.js').includes('data-tab="saves"'),'📂 Saves in the top bar');
ok(src('ui/saves-tab.js').includes('storageBar()')&&src('ui/common.js').includes('U.saveErr'),'storage bar + save-failed banner');
console.log('r38 ok',pass);
