// R76 Rounds B-D: encyclopedia memory (fl_enc_v1), unlock rows, profile settings, tip jar flag, release strip, rename.
import fs from 'fs'; import os from 'os'; import path from 'path'; import { execFileSync } from 'child_process';
import * as E from '../js/engine.js'; import { tipOn, tipLink } from '../js/ui/tip.js';
const ROOT=new URL('..',import.meta.url).pathname, R=ROOT+'data/', D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;}; let pass=0;
const store=()=>{const m=new Map();return{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),_m:m};};
const game=()=>{const s=E.newGame(1);E.normalize(s);return s;};

// ---- encyclopedia catalog
const C=E.encCatalog(D), T=E.encTotals(C);
ok(E.ENC_SECTIONS.map(x=>x[0]).join()==='items,buildings,classes,factions,places,quests,creatures,lore','scope: the eight sections, no deity section');
ok(!('deities' in C)&&!('faiths' in C),'no deity pages before the Old Ones pack');
for(const [k,l] of Object.entries(C)){ const ids=l.map(e=>e.id); ok(new Set(ids).size===ids.length,'unique ids in '+k); ok(l.length>0&&l.every(e=>e.name&&typeof e.id==='string'),k+' entries have ids and names'); }
ok(T.items>=D.items.length,'every item is catalogued');

// ---- observer: finds things, never mutates
const s0=game(); const before=JSON.stringify(s0); const f0=E.encObserve(D,s0);
ok(JSON.stringify(s0)===before,'encObserve does not change the game state');
ok(Object.keys(C).every(k=>Array.isArray(f0[k])),'observer reports every section');
const all=new Set(Object.values(C).flat().map(e=>e.id));
ok(Object.values(f0).flat().length>0&&Object.entries(f0).every(([k,ids])=>ids.every(i=>C[k].some(e=>e.id===i))),'observed ids all exist in the catalog');
ok(f0.items.length<T.items&&f0.buildings.length===0&&f0.lore.every(i=>!i.startsWith('e:')),'a fresh game has found only a small part; no endings');
// something new is found after the game moves on
const s1=game(); s1.found=s1.found||{}; const it=D.items.find(i=>!f0.items.includes(i.id)); s1.members[0].bag=(s1.members[0].bag||[]); s1.members[0].bag.push(it.id);
const f1=E.encObserve(D,s1); ok(f1.items.includes(it.id),'an item carried by a member is found');
const bld=D['structures/home'][0]; (s1.structures=s1.structures||[]).push({id:'x1',type:bld.id}); ok(E.encObserve(D,s1).buildings.some(i=>i.endsWith(bld.id)),'a built structure is found');
const s2=game(); const q=C.quests.find(e=>!E.encObserve(D,s2).quests.includes(e.id)); s2.doneQuests=[q.id]; ok(E.encObserve(D,s2).quests.includes(q.id),'a finished quest is found');

// ---- memory: profile-wide set + per-save set
const st=store(); let enc=E.encLoad(st); ok(enc.v===1&&!Object.keys(enc.seen).length,'blank memory on first run');
ok(E.encRecord(enc,1,{items:['a','b']})===true&&E.encRecord(enc,1,{items:['a','b']})===false,'recording reports only new ids');
E.encRecord(enc,2,{items:['b','c']}); E.encSave(st,enc);
const e2=E.encLoad(st); ok([...E.encSet(e2,'all',0,'items')].sort().join()==='a,b,c','profile memory is the union over slots');
ok([...E.encSet(e2,'save',1,'items')].join()==='a,b'&&[...E.encSet(e2,'save',2,'items')].join()==='b,c','"this save" shows only that slot');
ok(E.encResetSlot(e2,1)&&E.encSet(e2,'save',1,'items').size===0,'new game / delete / import resets that slot');
ok([...E.encSet(e2,'all',0,'items')].sort().join()==='a,b,c','profile-wide discoveries outlive a slot reset');
for(const junk of ['','null','{','[]','{"v":2}','{"v":1,"seen":5,"slots":"x"}','"s"']){ const g=store(); if(junk)g.setItem('fl_enc_v1',junk); const x=E.encLoad(g); ok(x&&typeof x.seen==='object'&&typeof x.slots==='object'&&E.encRecord(x,1,{items:['z']}),'garbage fl_enc_v1 ('+junk+') recovers'); }
// endings are lore only once a lineage is over
const so=game(); so.gameOver={kind:'x'}; const end=C.lore.find(e=>e.id.startsWith('e:')); ok(!end||!E.encObserve(D,game()).lore.includes(end.id),'endings stay hidden in a live game');

// ---- unlock rows
const rec=E.emptyLegacyRec(); const g0=E.unlockRows(D,rec,game(),'all');
ok(g0.map(g=>g.id).join()==='start,ach,cls'||g0.map(g=>g.id).join()==='start,ach','all-lineages scope: start options, achievements, story classes only');
ok(g0[0].total===D.creation.unlocks.length&&g0[0].done===0,'nothing unlocked on a clean record');
const rec2=E.emptyLegacyRec(); rec2.unlocks=['race_dwarf']; rec2.ach.a_gen3=5; const g1=E.unlockRows(D,rec2,game(),'all');
ok(g1[0].rows.find(r=>r.id==='race_dwarf').done&&g1[0].done===1&&g1[1].rows.find(r=>r.id==='a_gen3').done,'record drives the all-lineages view');
const gs=E.unlockRows(D,rec2,game(),'save'); ok(gs.some(g=>g.id==='era')&&gs.some(g=>g.id==='estate')&&!gs.some(g=>g.rows.some(r=>/planned/i.test(r.how))),'this-save scope adds eras and estate stages');
ok(gs.find(g=>g.id==='era').rows.length>=1&&gs.find(g=>g.id==='era').rows[0].done,'era 1 reached');
ok(gs[0].rows.find(r=>r.id==='race_dwarf').done===false,'this-save view ignores the device record');
ok(JSON.stringify(rec2)===JSON.stringify({...E.emptyLegacyRec(),unlocks:['race_dwarf'],ach:{a_gen3:5}}),'unlockRows leaves the record alone');

// ---- profile settings: migration of classic emoji and reduced motion
import('../js/engine/profile-store.js').then(P=>{
  const a=store(); let r=P.loadSettings(a,true); ok(r.migrated&&r.settings.classic===true&&r.settings.motion==='auto'&&r.settings.skipTitle===false,'first run takes classic from the last-played save; skip title off by default');
  ok(JSON.parse(a.getItem('fl_settings_v1')).classic===true,'migrated value is stored');
  r=P.loadSettings(a,false); ok(!r.migrated&&r.settings.classic===true,'later runs ignore the old per-save value');
  ok(P.loadSettings(store(),false).settings.classic===false,'default off');
  const b=store(); b.setItem('fl_settings_v1','{"v":1,"classic":1,"motion":"bogus","skipTitle":"y"}'); const c=P.loadSettings(b).settings; ok(c.classic===true&&c.motion==='auto'&&c.skipTitle===true,'settings are sanitised');
  const g=store(); g.setItem('fl_settings_v1','junk'); ok(P.loadSettings(g,true).settings.classic===true,'unreadable settings fall back to migration');
  ok(P.reducedMotion({motion:'on'},false)&&!P.reducedMotion({motion:'off'},true)&&P.reducedMotion({motion:'auto'},true)&&!P.reducedMotion({motion:'auto'},false),'reduced motion: on/off force, auto follows the device');
  ok(P.SETTINGS_KEY==='fl_settings_v1'&&P.ENC_KEY==='fl_enc_v1','profile keys');

  // ---- tip jar: web demo only
  const B=JSON.parse(fs.readFileSync(R+'build.json','utf8'));
  ok(B.target==='web'&&B.edition==='demo'&&/^https?:\/\//.test(B.tipUrl)&&/placeholder/.test(B.tipUrl),'source build is web demo with a placeholder tip URL');
  ok(tipOn(B)&&/placeholder link/.test(tipLink(B)),'tip link shown on the web demo and marked as a placeholder');
  for(const [t,e] of [['android','demo'],['steam','demo'],['web','full'],['steam','full'],['android','full']]) ok(!tipOn({...B,target:t,edition:e})&&tipLink({...B,target:t,edition:e})==='','no tip link for '+t+'/'+e);
  ok(!tipOn({target:'web',edition:'demo',tipUrl:'javascript:alert(1)'})&&!tipOn({}),'only http(s) tip URLs');
  // release strip
  for(const [t,e,keep] of [['web','demo',true],['android','demo',false],['steam','full',false]]){
    const out=fs.mkdtempSync(path.join(os.tmpdir(),'flrel-')); execFileSync('node',[ROOT+'tools/make-release.mjs',out,'--target',t,'--edition',e],{stdio:'pipe'});
    const txt=fs.readFileSync(out+'/family-legacy-idle/data/build.json','utf8'); ok(txt.includes('tipUrl')===keep,'release '+t+'/'+e+(keep?' keeps':' strips')+' tipUrl'); fs.rmSync(out,{recursive:true,force:true}); }
  // ---- rename: user-visible title everywhere, storage keys untouched
  const html=fs.readFileSync(ROOT+'index.html','utf8'); ok(/<title>Heirs of the Hold<\/title>/.test(html),'page title');
  const vis=['index.html','js/ui/common.js','js/ui/menu.js','js/ui/menu-load.js','js/ui/render.js','js/ui/guide.js','js/engine/saveio.js','README.md'];
  for(const f of vis){ const t=fs.readFileSync(ROOT+f,'utf8'); ok(!/Family Legacy/.test(t),f+' has no "Family Legacy"'); }
  ok(/Heirs of the Hold/.test(fs.readFileSync(ROOT+'js/ui/menu.js','utf8')),'title screen carries the new name');
  const S=E.Slots; ok(S.META_KEY===undefined||S.META_KEY==='familyLegacy.slots.v1','meta key unchanged'); ok(S.slotKey(1)==='familyLegacy.slot.1'&&S.OLD_KEY==='familyLegacy.save.v1','storage keys unchanged');
  const cfg=fs.readFileSync(ROOT+'js/config.js','utf8'); ok(E.SAVE_VERSION===undefined||E.SAVE_VERSION===1,'SAVE_VERSION stays 1'); ok(game().v===1,'a new save is still v1');
  console.log('r76-enc: '+pass+' asserts passed');
});
