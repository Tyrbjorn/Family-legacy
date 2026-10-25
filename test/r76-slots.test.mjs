// R76 Round A: slot safety. Migration into slot 1, quarantine of unreadable slots (no overwrite), rolling gzip backup, storage pressure.
import fs from 'fs'; import * as E from '../js/engine.js';
const R=new URL('../data/',import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const S=E.Slots;
const store=(cap=Infinity)=>{const m=new Map();return{get length(){return m.size},key:i=>[...m.keys()][i],getItem:k=>m.has(k)?m.get(k):null,removeItem:k=>m.delete(k),setItem(k,v){v=String(v);let b=0;for(const[a,x]of m)if(a!==k)b+=(a.length+x.length)*2;if(b+(k.length+v.length)*2>cap){const e=new Error('QuotaExceededError');e.name='QuotaExceededError';throw e;}m.set(k,v);},_m:m};};
const game=(name,days=0)=>{const s=E.newGame(1);E.normalize(s);s.members[0].name=name;s.day=days;return s;};
ok(S.SLOTS===5,'5 slots everywhere (web, Android, Steam)');

// 1. migration of the single pre-R38 save into slot 1: byte for byte, old key kept, becomes the boot slot
{ const st=store(); const g=game('Mira',720); const raw=E.serialize(g,5000); st.setItem(S.OLD_KEY,raw);
  const r=S.migrateSlots(st); ok(r.moved&&!r.bad&&st.getItem(S.slotKey(1))===raw&&st.getItem(S.OLD_KEY)===raw,'single save copied into slot 1, old key kept');
  const b=S.bootPick(st); ok(b.n===1&&b.s.members[0].name==='Mira'&&!b.skipped.length,'boot opens slot 1 after migration'); ok(S.listSlots(st).slice(1).every(x=>x.empty),'slots 2-5 stay empty');
  // the real old fixture (an FL1 export migrates through importSave; a raw save json goes through slot 1)
  ok(S.migrateSlots(st).moved===false,'migration runs once'); }

// 2. quarantine: a corrupt / wrong-version last slot is never overwritten by a fresh game
for(const [label,raw,reason] of [['truncated json','{"v":1,"members":[{"id"','corrupt'],['empty object','{}','corrupt'],['wrong version',JSON.stringify({...game('Old'),v:2}),'version'],['not json','hello','corrupt']]){
  const st=store(); S.migrateSlots(st); ok(S.saveSlot(st,1,game('Good',100),1000).ok,'seed slot 1'); ok(S.saveSlot(st,2,game('Bad',200),2000).ok,'seed slot 2');
  st.setItem(S.slotKey(2),raw); // damage slot 2 (the last played)
  const b=S.bootPick(st);
  ok(b.skipped.length===1&&b.skipped[0].n===2&&b.skipped[0].reason===reason,label+': last slot flagged '+reason);
  ok(b.n===1&&b.s.members[0].name==='Good',label+': another readable slot is offered, not a new game');
  ok(st.getItem(S.slotKey(2))===raw&&st.getItem(S.corruptKey(2))===raw,label+': raw text untouched in the slot and copied to .corrupt');
  ok(S.listSlots(st)[1].bad&&S.listSlots(st)[1].bad.reason===reason&&!S.listSlots(st)[1].empty,label+': slot listed as unreadable, not empty');
  const w=S.saveSlot(st,2,game('Fresh'),3000); ok(!w.ok&&st.getItem(S.slotKey(2))===raw,label+': saving over the bad slot is refused');
  let threw=false; try{S.loadSlot(st,2);}catch(e){threw=e.slotBad===reason;} ok(threw,label+': loadSlot throws with the reason');
  ok(S.readSlot(st,2)===null&&st.getItem(S.slotKey(2))===raw,label+': readSlot returns null, no change');
  // explicit player action (restore / import / new game after delete) may replace it
  ok(S.saveSlot(st,2,game('Chosen'),4000,{force:true}).ok&&!S.listSlots(st)[1].bad,label+': force save replaces it and clears the flag'); }
{ // every slot bad -> nothing opens, nothing is deleted
  const st=store(); S.migrateSlots(st); for(const n of [1,2])st.setItem(S.slotKey(n),'xx'+n); const b=S.bootPick(st);
  ok(b.n===null&&b.s===null&&b.skipped.length===2,'all slots unreadable: no slot picked'); ok(st.getItem(S.slotKey(1))==='xx1'&&st.getItem(S.slotKey(2))==='xx2','both kept'); }
{ // a corrupt old single save: kept as a quarantined slot 1, never replaced
  const st=store(); st.setItem(S.OLD_KEY,'{"v":1,"members":'); const r=S.migrateSlots(st);
  ok(r.moved&&r.bad&&!r.error,'corrupt old save migrates as quarantined'); const b=S.bootPick(st); ok(b.n===null&&b.skipped[0].n===1,'boot offers no slot for it');
  ok(st.getItem(S.slotKey(1))==='{"v":1,"members":'&&st.getItem(S.OLD_KEY)==='{"v":1,"members":','raw text kept in slot 1 and old key'); }
{ // meta lost but saves exist: slots still found
  const st=store(); S.migrateSlots(st); S.saveSlot(st,3,game('Zed',9),500); st.removeItem(S.META_KEY); const b=S.bootPick(st); ok(b.n===3&&b.s.members[0].name==='Zed','meta missing: the stored slot is still found'); }

// 3. rolling gzip backup, one per slot
{ const st=store(); S.migrateSlots(st); const a=game('Ann',50); const T0=10_000_000;
  ok(S.saveSlot(st,1,a,T0).ok,'first save'); const r1=S.saveSlot(st,1,a,T0+30_000); ok(r1.ok&&r1.prev===null,'autosave 30 s later: no backup needed');
  a.day=99; const r2=S.saveSlot(st,1,a,T0+30_000+S.BACKUP_AFTER_MS+1); ok(r2.ok&&typeof r2.prev==='string','first save of a new session (previous one is >=10 min old): previous text offered for backup');
  const m=await S.makeBackup(st,1,r2.prev); ok(m.ok&&st.getItem(S.bakKey(1)).length>0,'gzip backup written');
  const raw=r2.prev; ok(st.getItem(S.bakKey(1)).length<raw.length*0.6,'backup is smaller than the save (gzip+base64) '+st.getItem(S.bakKey(1)).length+' < '+raw.length);
  ok(await S.readBackup(st,1)===raw,'backup round-trips');
  // rotation: a second session replaces the single backup, never adds a second key
  a.day=120; const r3=S.saveSlot(st,1,a,T0+99*3600e3); ok(typeof r3.prev==='string','another session'); ok((await S.makeBackup(st,1,r3.prev,T0+99*3600e3)).ok,'rotated');
  ok([...st._m.keys()].filter(k=>/\.bak$/.test(k)).length===1,'still exactly one backup key for the slot'); const back=JSON.parse(await S.readBackup(st,1)); ok(back.day===99,'the backup now holds the newer previous state (day 99)');
  { const T=T0+99*3600e3; let hits=0, firstAt=0; for(let k=1;k<=80;k++){ const now=T+k*5*60e3; a.day=130+k; const q=S.saveSlot(st,1,a,now); if(q.prev){ hits++; firstAt=firstAt||now-T; await S.makeBackup(st,1,q.prev,now); } }
    ok(hits===1&&firstAt>=S.BACKUP_REFRESH_MS&&firstAt<=S.BACKUP_REFRESH_MS+5*60e3,'a session that never closes: one refresh of the backup about every 6 h (not every autosave)'); }
  // an unreadable text is never backed up
  { const keepB=st.getItem(S.bakKey(1)); ok(!(await S.makeBackup(st,1,'{broken')).ok&&st.getItem(S.bakKey(1))===keepB,'garbage is not backed up and does not replace the good backup'); }
  // restore
  st.setItem(S.slotKey(1),'{broken'); S.quarantine(st,1,'corrupt'); ok(S.listSlots(st)[0].bad,'damaged slot flagged');
  const rr=await S.restoreBackup(st,1); ok(rr.ok&&!S.listSlots(st)[0].bad&&S.loadSlot(st,1).day>=99,'restore puts the backup back and clears the flag'); ok(st.getItem(S.corruptKey(1))==='{broken','the damaged text is kept as the .corrupt copy');
  ok(!(await S.restoreBackup(st,2)).ok,'no backup: restore says so'); }

// 4. storage pressure: backups are dropped first, the save is never lost
{ const g=game('Pat',1), probe=E.serialize(g).length; const cap=store(); S.migrateSlots(cap); S.saveSlot(cap,1,g,1000); S.saveSlot(cap,2,g,1000);
  await S.makeBackup(cap,1,cap.getItem(S.slotKey(1))); await S.makeBackup(cap,2,cap.getItem(S.slotKey(2))); ok(S.listSlots(cap)[0].bak&&S.listSlots(cap)[1].bak,'two backups exist');
  const used=S.storageUsed(cap); ok(used.bak>0&&used.bak<used.bytes,'storage meter counts backups');
  // shrink the cap so the next (bigger) save only fits once the backups are gone
  const tight=store(); for(const[k,v]of cap._m)tight._m.set(k,v);
  let bytes=0; for(const[k,v]of tight._m)bytes+=(k.length+v.length)*2; const bakBytes=S.storageUsed(tight).bak;
  g.log=Array.from({length:300},(_,i)=>({day:i,msg:'y'.repeat(30)})); const newLen=E.serialize(g,2000).length, oldLen=tight.getItem(S.slotKey(1)).length;
  const tcap=store(bytes+(newLen-oldLen)*2-Math.floor(bakBytes/2)); for(const[k,v]of tight._m)tcap._m.set(k,v); const before=tcap.getItem(S.slotKey(1));
  const r=S.saveSlot(tcap,1,g,2000); ok(r.ok&&r.droppedBackups,'save succeeds after dropping backups'); ok(!S.listSlots(tcap)[0].bak&&!S.listSlots(tcap)[1].bak,'all backups dropped'); ok(tcap.getItem(S.slotKey(1))!==before&&S.loadSlot(tcap,1).log.length===300,'new save stored in full');
  // nothing to drop and still no room: the old save is kept untouched
  const full=store(bytes); for(const[k,v]of tight._m)if(!/\.bak$/.test(k))full._m.set(k,v); const keep=full.getItem(S.slotKey(1)); g.log=Array.from({length:4000},(_,i)=>({day:i,msg:'z'.repeat(30)}));
  const r2=S.saveSlot(full,1,g,3000); ok(!r2.ok&&r2.err==='storage full'&&full.getItem(S.slotKey(1))===keep,'still full: reported, stored save untouched'); }
{ // delete removes the slot's backup and quarantine copy; undo brings them back
  const st=store(); S.migrateSlots(st); const g=game('Del',3); S.saveSlot(st,4,g,1); await S.makeBackup(st,4,st.getItem(S.slotKey(4)));
  ok(S.deleteSlot(st,4)&&st.getItem(S.bakKey(4))===null,'delete removes the backup too'); ok(S.undoDelete(st,4)&&st.getItem(S.bakKey(4))!==null,'undo restores slot and backup'); }
console.log('r76-slots ok',pass);
// R76 boot sweep: an unreadable slot that is not the last played one is flagged too, and never rewritten
{ const st=store(); S.migrateSlots(st); ok(S.saveSlot(st,1,game('A',100),1000).ok,'seed 1'); const raw='{"v":1,"members":[{"id"'; st.setItem(S.slotKey(3),raw);
  const hit=S.scanAll(st); ok(hit.length===1&&hit[0].n===3&&hit[0].reason==='corrupt','scanAll flags a damaged non-last slot');
  ok(st.getItem(S.slotKey(3))===raw&&st.getItem(S.corruptKey(3))===raw&&S.listSlots(st)[2].bad,'text untouched, copied aside, listed as unreadable');
  ok(S.scanAll(st).length===0,'second sweep reports nothing new'); ok(S.listSlots(st)[0].bad===null,'healthy slot untouched'); }
console.log('r76-slots sweep ok');
