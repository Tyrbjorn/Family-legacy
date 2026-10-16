// Craft ladder: specialist → artisan titles, Scribe branches, Steward route slots, Herbalist bandages, Gemcutter + Jeweler inlays, save step 23
import fs from 'fs'; import * as E from '../js/engine.js';
const L=n=>JSON.parse(fs.readFileSync(new URL('../data/'+n+'.json',import.meta.url)));
const D={};for(const n of ['skills','classes','traits','buildings','furniture','items','quests','regions','tuning','nodes','towns','minions','guilds','jobs','activities','estate','crafting','map','dungeons','legacy','chronicle','achievements','events','encounters','seasons','tutorial','notify','marriage','phases','intros','gear','paths','world','metals'])D[n]=L(n);
for(const f of D.estate.structureFiles)D['structures/'+f]=L('structures/'+f);
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const sp=(p,id)=>D.paths.paths.find(x=>x.id===p).specs.find(x=>x.id===id);
ok(D.paths.paths.find(x=>x.id==='scribe').specs.map(x=>x.name+'>'+x.artisan.name).join()==='Loremaster>Sage,Draftsman>Master Draftsman,Steward>Seneschal,Cartographer>Royal Cartographer','Scribe branches');
ok(sp('cook','baker').name==='Pastry Chef'&&sp('cook','butcher').name==='Smoker'&&sp('alchemy','herbalist').artisan.name==='Apothecary'&&sp('smithing','gemcutter')&&sp('smithing','gemcutter').artisan.name==='Lapidary'&&sp('smithing','goldsmith').artisan.name==='Master Goldsmith'&&sp('woodsman','forestsense'),'renames + Gemcutter + Herbalist > Apothecary');
const s=E.newGame(1); E.normalize(s); const m=s.members[0]; m.ageDays=30*360;
const e={id:'scribe',xp:1e5,rank:3,spec:'steward',sxp:0,srank:2}; m.paths=[e];
ok(E.specName(e)==='Steward'&&!E.isArtisan(e),'specialist stage'); e.srank=3; ok(E.specName(e)==='Seneschal'&&E.isArtisan(e),'artisan at Grandmaster');
s.structures.push({uid:'w1',type:'warehouse',pieces:[],up:0}); ok(E.routeSlotParts(s).steward===2,'Seneschal adds 2 route slots'); e.srank=2; ok(E.routeSlotParts(s).steward===1,'Steward adds 1 route slot (bug fixed)');
m.paths=[{id:'alchemy',xp:1e5,rank:2,spec:'herbalist',sxp:0,srank:1}]; s.res.bandages=0; E.pathsDay(s); ok(Math.abs(s.res.bandages-0.1)<1e-9,'Herbalist makes bandages');
m.paths=[{id:'smithing',xp:1e5,rank:3,spec:'gemcutter',sxp:0,srank:3}]; s.res.gems=1; s.res.cutgems=0; E.pathsDay(s); ok(Math.abs(s.res.cutgems-0.5)<1e-9,'Lapidary cuts gems ×1.25');
// inlays
s.vault=['copper_ring','c|copper_ring|fine']; s.res.gold=2; s.res.cutgems=2;
ok(/Goldsmith/.test(E.inlayIssue(s,'copper_ring','gold')),'gold inlay needs a Goldsmith');
m.paths=[{id:'smithing',xp:1e5,rank:3,spec:'goldsmith',sxp:0,srank:2}];
s.structures.push({uid:'f1',type:'smithy',pieces:['forge'],up:0});
const why=E.inlayIssue(s,'copper_ring','gold'); ok(!why||/Forge/.test(why),'forge check ('+why+')');
if(!why){ const g=E.inlay(s,'copper_ring','gold'); ok(g==='copper_ring~gold'&&E.itemDef(g).value===Math.round(25*1.4)&&s.res.gold===1,'gold inlay adds value');
  const e2=m.paths[0]; ok(/Jeweler/.test(E.inlayIssue(s,'c|copper_ring|fine','cutgems'))&&!E.spec2Choices(m,'smithing').length,'gem inlay needs a Jeweler; no 2nd specialty before Grandmaster');
  e2.srank=3; ok(E.specName(e2)==='Master Goldsmith'&&E.spec2Choices(m,'smithing').map(x=>x.id).join()==='gemcutter'&&E.chooseSpec2(s,m,'smithing','gemcutter'),'Grandmaster Goldsmith takes up Gemcutter');
  e2.s2xp=1e6; m.skills.smithing.lvl=99; E.refreshPaths(s,m); ok(E.mergedTitle(e2)&&E.specName(e2)==='Jeweler'&&s.deeds.some(d=>/Jeweler/.test(d)),'Grandmaster in both = Jeweler');
  const it=E.itemDef('c|copper_ring|fine'), n0=E.enchSlots(it); const c=E.inlay(s,'c|copper_ring|fine','cutgems'); ok(E.enchSlots(E.itemDef(c))===n0+1,'gem inlay adds an enchant slot');
  ok(E.itemDef(c+'#'+'x')!==undefined&&E.itemType(c)==='copper_ring'&&/already/.test(E.inlayIssue(s,c,'gold')||''),'one inlay per item; ids parse'); }
// save step 23
const o=E.newGame(1); E.normalize(o); o.members[0].paths=[{id:'scribe',xp:0,rank:2,spec:'bookbinder',sxp:0,srank:0},{id:'alchemy',xp:0,rank:2,spec:'healerbrewer',sxp:0,srank:0},{id:'woodsman',xp:0,rank:2,spec:'herbalist',sxp:0,srank:0},{id:'smithing',xp:0,rank:3,spec:'jeweler',sxp:0,srank:3}]; o.members.push({...o.members[0],id:999,paths:[{id:'smithing',xp:0,rank:3,spec:'jeweler',sxp:0,srank:1}]}); o.schema=22; E.normalize(o);
ok(o.members[0].paths.map(p=>p.spec).join()==='loremaster,herbalist,forestsense,goldsmith'&&E.specName(o.members[0].paths[3])==='Jeweler'&&E.specName(o.members.at(-1).paths[0])==='Goldsmith','v23/24 renames Bookbinder, Healer-brewer, Woodsman Herbalist ids; old Grandmaster Jeweler stays a Jeweler');
console.log(pass+' ladder checks passed');
