// R59: character creation, per-device legacy record (R60 shape), doll layers, step 54
import fs from 'fs'; import * as E from '../js/engine.js'; import { BUILD } from '../js/config.js'; import { dollLayers, dollHtml } from '../js/doll.js'; import { STEPS } from '../js/engine/save-steps.js';
const L=n=>JSON.parse(fs.readFileSync(new URL('../data/'+n+'.json',import.meta.url)));
const D={};for(const n of ['fields','skills','classes','traits','buildings','furniture','items','quests','regions','tuning','nodes','towns','minions','guilds','jobs','activities','estate','crafting','map','dungeons','legacy','chronicle','achievements','events','encounters','seasons','tutorial','notify','marriage','families','phases','intros','gear','paths','world','metals','creation','doll'])D[n]=L(n);
for(const f of D.estate.structureFiles)D['structures/'+f]=L('structures/'+f);
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const C=D.creation, CL=L('changelog');
ok(+BUILD.slice(1)>=59&&E.SCHEMA>=54,'R59+, schema 54+'); ok(CL.entries.some(e=>e.build==='R59'),'R59 changelog entry');
ok(C.unlocks.length===13,'13 unlocks');
const achIds=new Set(D.achievements.list?D.achievements.list.map(a=>a.id):(Array.isArray(D.achievements)?D.achievements.map(a=>a.id):Object.keys(D.achievements)));
const achTxt=JSON.stringify(D.achievements);
for(const u of C.unlocks){ok(u.flag||u.check||u.hydra||u.ach||u.achCount,'unlock has a source '+u.id); if(u.ach) ok(achTxt.includes('"'+u.ach+'"'),'ach exists '+u.ach); for(const tr of u.traits||[]) ok(E.traitDef(tr),'trait '+tr);}
const empty=E.emptyLegacyRec();
for(const k of ['ach','unlocks','bonuses','classUnlocks','flags']) ok(k in empty,'R60 field '+k);
const O=E.creationOptions(empty);
ok(O.sexes.length===2&&O.races.find(r=>r.id==='human').ok&&!O.races.find(r=>r.id==='dwarf').ok,'open set: 2 sexes, human only');
ok(O.traits.filter(t=>t.ok).length===10,'10 open traits'); ok(O.maxPicks===2,'2 picks');
ok(O.classes.every(c=>!c.ok),'class locked before Three Generations');
ok(E.creationIssue({race:'dwarf'},empty),'locked race rejected'); ok(E.creationIssue({traits:['quick','hardy','brave']},empty),'3 good traits rejected');
ok(!E.creationIssue({traits:['quick','brave','clumsy']},empty),'bad trait earns a 3rd');
ok(E.creationIssue({cls:O.classes[0].id},empty),'locked class rejected');
// quick start = today's start
const a=E.newGame(1000), b=E.newGame(1000); ok(JSON.stringify(a.res)===JSON.stringify(b.res)&&a.members.length===b.members.length,'newGame deterministic shape');
ok(!a.created,'quick start leaves founder alone');
// apply
const g=E.newGame(1000), f=g.members[0];
ok(!E.applyCreation(g,{name:'Ada',gender:'f',race:'human',blood:'',traits:['quick','brave','clumsy'],cls:'',look:{hair:C.hairStyles.f[0][0],hairCol:2,skin:3},house:'crimson',frame:'open'},empty),'apply ok');
ok(f.name==='Ada'&&f.gender==='f'&&f.traits.includes('clumsy')&&g.house.col===C.houseCols.find(h=>h.id==='crimson').col,'applied');
// record survives a deleted save, export round trip
const store={d:{},getItem(k){return k in this.d?this.d[k]:null},setItem(k,v){this.d[k]=String(v)},removeItem(k){delete this.d[k]}};
const s2=E.newGame(1); s2.flags=s2.flags||{}; s2.flags.thaneOath=1; let r=E.recordSave(empty,s2).rec; E.saveLegacyRec(store,r);
ok(E.loadLegacyRec(store).unlocks.includes('race_dwarf'),'dwarf unlocked & stored');
ok(E.creationOptions(E.loadLegacyRec(store)).races.find(x=>x.id==='dwarf').ok,'dwarf selectable after unlock (save gone)');
const sp=E.splitLegacyRec(E.withLegacyRec('ABC',r)); ok(sp.save==='ABC'&&sp.rec.unlocks.includes('race_dwarf'),'export round trip');
ok(E.splitLegacyRec('ABC').rec===null,'plain code still fine');
ok(E.resetLegacyRec(store).unlocks.length===0&&store.getItem(E.CR_KEY)==null,'reset');
// step 54 idempotent
const st=STEPS.find(x=>x.n===54), o=E.newGame(5); delete o.house; for(const m of o.members) delete m.look; st.run(o); const j1=JSON.stringify([o.house,o.members.map(m=>m.look)]); st.run(o); ok(j1===JSON.stringify([o.house,o.members.map(m=>m.look)])&&o.house.col,'step 54 idempotent');
ok(JSON.stringify(E.seededLook({id:'m7'}))===JSON.stringify(E.seededLook({id:'m7'})),'seeded look stable');
// doll layers
const lay=dollLayers(D.doll,C,{base:'human-female',look:{hair:C.hairStyles.f[0][0],bun:1,skin:1},sea:1,house:'#7d2020',armor:Object.keys(D.doll.bases['human-female'].coif||{})[0]});
const ks=lay.map(x=>x.k); ok(ks.join()==='base,skin,marks,eyes,armor,tabard,hair,bun'||ks.join()==='base,skin,marks,eyes,tabard,hair,bun','layer order '+ks);
ok(lay.find(x=>x.k==='skin').col===C.skins[1].col&&lay.find(x=>x.k==='marks').col===C.skins[1].col&&!lay.find(x=>x.k==='eyes').col,'skin/marks tinted, eyes not');
ok(lay.find(x=>x.k==='tabard').col==='#7d2020','tabard house colour');
if(ks.includes('armor')) ok(lay.find(x=>x.k==='hair').minus,'coif subtracts hair');
const bl=dollLayers(D.doll,C,{base:'dwarf-male',look:{beard:'ringed-plait'}}); ok(bl.find(x=>x.k==='rings')&&!bl.find(x=>x.k==='rings').col,'rings untinted');
ok(!dollHtml(D.doll,C,{base:'human-male',classic:true,emoji:'👨',size:48}).includes('webp'),'classic gives emoji');
ok(D.doll.missing.length===0,'no missing art');
for(const l of lay) ok(fs.existsSync(new URL('../'+l.src,import.meta.url)),'file '+l.src);
console.log('r59 ok',pass);
{const pl=dollLayers(D.doll,C,{base:'human-male',look:{},house:'#123456',armor:'plate-helm'}).map(x=>x.k);if(!(pl.indexOf('tabard')<pl.indexOf('armor')))throw new Error('plate over tabard');
const cl=dollLayers(D.doll,C,{base:'human-male',look:{},house:'#123456',armor:'clothes'}).map(x=>x.k);if(!(cl.indexOf('tabard')>cl.indexOf('armor')))throw new Error('tabard over clothes');console.log('r59b tabard ok');}
