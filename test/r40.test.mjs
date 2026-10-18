// R40: per-crop fields, tending hours, tools, teamsters (haul only), hub upgrades, auto, save step 38
import fs from 'fs'; import * as E from '../js/engine.js'; import { BUILD } from '../js/config.js';
const R=new URL('../data/',import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const F=D.fields;
const homestead=()=>{const s=E.newGame(1);E.normalize(s);s.land=['plot'];s.buildings.farm=5;s.buildings.garden=3;s.buildings.lumber=2;s.members[0].ageDays=20*D.tuning.daysPerYear;s.res.coin=1e6;Object.assign(s.res,{wood:5000,planks:5000,stone:5000,ingots:500,leather:100});s.minions=[];return s;};
const fol=(s,job='farm',type='laborer')=>{const mi={uid:'mi'+s.nextId++,type,equip:{},name:'F'+s.nextId,job,loyalty:100,lvl:1,skills:{}};s.minions.push(mi);return mi;};
const avg=(s)=>E.seasonYield(s,'wheat');
ok(E.SCHEMA>=38,'schema 38+');
ok(['food','wheat','barley','vegetables','flax','berries'].every(c=>F.crops[c]),'crops from existing goods (+ Kitchen Plot for food)');
// slots
{ const s=E.newGame(1);E.normalize(s); ok(E.fieldSlots(s)===0&&/Homestead/.test(E.buildFieldIssue(s,'wheat')),'landless/scrub: no fields yet');
  const h=homestead(); ok(E.estateStage(h)==='Homestead'||E.estateStage(h)!=='Scrub Plot','test estate reached Homestead+');
  ok(E.fieldSlots(h)===1,'1 slot at Homestead'); ok(E.buildField(h,'wheat')&&E.buildFieldIssue(h,'barley')==='no free field slot','one field, then full');
  h.land.push('acre'); ok(E.fieldSlots(h)===2,'+1 per extra land parcel');
  ok(/needs/.test(E.buildFieldIssue(h,'berries')),'berries need an Orchard'); }
// tending: head helps 1 h; follower 8 h; wild 25%
{ const s=homestead(); const f=E.buildField(s,'wheat'); const y=E.fieldYield(s,f);
  let L=E.fieldsDay(s); ok(L.fields[f.id].tended>0.999&&Math.abs(L.made.wheat-y)<1e-6,'head helps 1 h: a normal field is fully tended');
  ok(E.tendNeeded(s)===1&&E.tendAvail(s)===1,'1 h needed, 1 h available');
  E.setFieldsAuto(s,'family',false); s.fields.pile={}; L=E.fieldsDay(s); ok(Math.abs(L.made.wheat-y*0.25)<1e-6&&L.fields[f.id].state==='growing wild','nobody tends: grows wild at 25%');
  const mi=fol(s); s.fields.pile={}; L=E.fieldsDay(s); ok(L.fields[f.id].tended>0.999&&L.workers[0].kind==='follower','farm follower tends (8 h)');
  ok(mi.fieldSpare>0.5&&mi.fieldSpare<1,'follower spare hours (after tending + hauling) left for old farm food');
  s.members[0].action={type:'activity',target:'tendfields'}; E.setFieldsAuto(s,'family',true); ok(E.fieldWorkers(s).find(w=>w.kind==='family').hours===8,'Tend Fields chore = 8 h'); }
// levels + bigger plot
{ const s=homestead(); const f=E.buildField(s,'vegetables'); const y1=E.fieldYield(s,f);
  ok(E.levelField(s,f.id)&&Math.abs(E.fieldYield(s,f)/y1-1.2)<1e-9,'level 2 = +20%');
  const y2=E.fieldYield(s,f); const c0=s.res.coin; ok(E.sizeUp(s,f.id)&&Math.abs(E.fieldYield(s,f)/y2-1.5)<1e-9&&E.tendHours(f)===1.5&&s.res.coin<c0,'Bigger Plot I: x1.5 for 1.5 h');
  E.sizeDown(s,f.id); const c1=s.res.coin; ok(E.sizeUp(s,f.id)&&s.res.coin===c1,'re-taking a paid step is free');
  for(let i=0;i<3;i++)E.levelField(s,f.id); ok(f.lvl===5&&E.levelIssue(s,f)==='max','max level 5');
  E.sizeUp(s,f.id);E.sizeUp(s,f.id); ok(E.tendHours(f)===3&&Math.abs(E.sizeDef(f).mult-2.5)<1e-9&&E.sizeIssue(s,f)==='max','Bigger Plot III: x2.5 for 3 h');
  // head 1 h on a 3 h field = 1/3 tended
  s.fields.pile={}; const L=E.fieldsDay(s); ok(Math.abs(L.fields[f.id].tended-1/3)<1e-6,'partly tended by hours'); }
// tools
{ const s=homestead(); const f=E.buildField(s,'wheat'); const mi=fol(s);
  const w=()=>E.fieldWorkers(s).find(x=>x.kind==='follower');
  mi.equip.tool='copper_sickle'; ok(Math.abs(E.tendHours(f,w())-1*(1-0.10))<1e-9,'copper sickle -10%');
  mi.equip.tool='adamantium_sickle'; ok(Math.abs(E.tendHours(f,w())-0.70)<1e-9,'adamantium sickle -30%');
  mi.equip.tool='c|iron_sickle|masterwork'; ok(Math.abs(E.toolCut(mi.equip.tool,'grain')-0.28)<1e-9,'masterwork +10%');
  mi.equip.tool='iron_hoe'; ok(E.toolCut('iron_hoe','grain')===0&&E.toolCut('iron_hoe','plot')===0.18,'tool must match the crop (hoe for plots)');
  ok(E.itemDef('steel_pruningknife').toolFor==='farm'&&D.crafting.recipes.some(r=>r.base==='mithril_hoe'),'tools craftable in every metal, Auto Equip-able (toolFor farm)');
  s.members[0].skills.farming.lvl=50; s.vault.push('bronze_sickle'); const fw=E.fieldWorkers(s).find(x=>x.kind==='family'); ok(Math.abs(E.tendHours(f,fw)-1*(1-0.14)*(1-0.25))<1e-9,'family use vault tools + farming skill speed (max 25%)'); }
// storage full → processing; stopAt
{ const s=homestead(); const f=E.buildField(s,'wheat'); s.res.wheat=E.capOf(s,'wheat'); let L=E.fieldsDay(s); ok(L.fields[f.id].state==='full'&&!L.made.wheat,'storage full: field rests');
  ok(!Object.keys(L.processed).length,'no mill: nothing processed');
  s.structures.push({uid:'stq',type:'fields',pieces:['furrows','quern'],up:0}); s.res.flour=0; L=E.fieldsDay(s); ok(L.processed.flour>0&&s.res.flour>0,'workers switch to milling flour');
  s.res.wheat=10; E.setStopAt(s,f.id,5); L=E.fieldsDay(s); ok(L.fields[f.id].state==='full','stop-at amount respected'); E.setStopAt(s,f.id,null);
  E.processDay(s); ok(!(E.fieldsState(s).pile.barley>0),'old furrows no longer produce on their own (no double crops)'); }
// teamsters: haul only
{ const s=homestead(); ok(E.jobCap(s,'teamster')===0,'no teamster spots before a field'); const f=E.buildField(s,'wheat'); ok(E.jobCap(s,'teamster')===0&&E.nextHubUp(s,'teamster').cost.coin>=1000,'teamsters are costly: first spot needs a Cart Shed (1000+ coin)'); ok(E.buyHubUp(s,'teamster')&&E.jobCap(s,'teamster')===1,'Cart Shed: 1 teamster spot');
  const idle=fol(s,'idle'); s.fields.pile={wheat:50}; let L=E.fieldsDay(s); ok(idle.job==='teamster','auto: idle follower becomes teamster when harvest waits');
  ok(!E.fieldWorkers(s).some(w=>w.ref===idle),'teamsters never tend');
  s.res.wheat=0; s.fields.pile={wheat:400}; E.setFieldsAuto(s,'family',false); L=E.fieldsDay(s); ok(L.byTeamsters>=250-1e-9&&L.byFarmers===0,'one teamster hauls 250/day (a farmer hauls 5/h)'); ok(D.fields.haul.teamsterPerDay>=D.fields.haul.farmerPerHour*8*5,'a teamster out-hauls 5 farmers\' whole days');
  { const before=JSON.stringify(s.res); E.MINION_JOBS.teamster(s,idle,1,1); ok(JSON.stringify(s.res)===before,'teamster job does no other work'); }
  E.setFieldsAuto(s,'teamsters',false); E.setFieldsAuto(s,'haul',false); const p=s.fields.pile.wheat; L=E.fieldsDay(s); ok(L.hauled===0&&s.fields.pile.wheat>=p,'hauling pausable');
  E.setFieldsAuto(s,'haul',true); E.setFieldsAuto(s,'family',true); s.fields.pile={wheat:10}; s.minions=[]; E.toggleField(s,f.id); L=E.fieldsDay(s); ok(L.byFarmers>0,'farmers haul with leftover hours when no teamster'); }
// hub upgrades: more worker + teamster slots
{ const s=homestead(); ok(E.hubUpIssue(s,'worker')==='build a field first','hub needs a field'); E.buildField(s,'food');
  const c=E.jobCap(s,'farm'); ok(E.buyHubUp(s,'worker')&&E.jobCap(s,'farm')===c+2,'Bunkhouse +2 farm spots');
  ok(E.buyHubUp(s,'teamster')&&E.jobCap(s,'teamster')===1,'Cart Shed: first teamster spot');
  E.buyHubUp(s,'worker');E.buyHubUp(s,'worker'); ok(E.jobCap(s,'farm')===c+7&&E.hubUpIssue(s,'worker')==='max','3 bunkhouse steps (+7)'); }
// crop switch + pause
{ const s=homestead(); const f=E.buildField(s,'wheat'); ok(E.setCrop(s,f.id,'barley')&&f.crop==='barley','switch crop'); ok(!E.setCrop(s,f.id,'berries'),'locked crop refused');
  E.toggleField(s,f.id); s.fields.pile={}; const L=E.fieldsDay(s); ok(L.fields[f.id].state==='growing wild','paused field grows wild'); }
// save step 38: fair conversion (>= 90% of the old food), including real tending by the head alone
{ let worst=9;
  for(let farm=0;farm<=5;farm++)for(let garden=0;garden<=3;garden++)for(const cf of [false,true]){
    const s=homestead(); s.fields=undefined; s.buildings.farm=farm; s.buildings.garden=garden; if(cf)s.structures.push({uid:'stc',type:'fields',pieces:['furrows'],up:0});
    const old=E.oldFarmFood(s); E.migrateFields(s);
    if(old>0){ const r=E.fieldsFoodPerDay(s)/old; worst=Math.min(worst,r);
      // real day, head alone (1 h): Kitchen Plot comes first and is fully tended
      s.fields.pile={}; const L=E.fieldsDay(s); const real=(L.made.food||0)/E.seasonYield(s,'food')/E.resGain(s)/E.hubMult(s); ok(real>=0.9*old-1e-6,`real food farm ${farm} garden ${garden}: ${real.toFixed(1)} vs ${old}`); }
    if(cf) ok(['wheat','barley','vegetables','flax'].every(c=>s.fields.list.some(f=>f.crop===c)),'old Crop Fields → one field per crop');
    ok(s.fields.list.length<=E.fieldSlots(s),'converted fields fit their slots (extra granted)'); }
  ok(worst>=0.9,'every combo keeps >= 90% of old food (worst '+worst.toFixed(2)+')'); console.log('  worst food share after migration', worst.toFixed(3)); }
{ const A=E.importSave(fs.readFileSync(new URL('./fixtures/old-save-fl1.txt',import.meta.url),'utf8').trim()); ok(A.schema===E.SCHEMA,'old FL1 save migrates to latest');
  const old=E.oldFarmFood(A); ok(!old||E.fieldsFoodPerDay(A)>=0.9*old,'fixture keeps its food ('+old+')'); }
{ const s=homestead(); const f=E.buildField(s,'food'); s.res.food=0; const L=E.fieldsDay(s); ok(s.res.food>0&&!(s.fields.pile.food>0),'Kitchen Plot food goes straight to the table (no hauling)'); }
// R40.1: farmers' hand-hauling has a whole-farm daily limit, so big farms need teamsters
const farmRun=(n,carts)=>{const s=homestead();s.fields.extraSlots=20;const crops=['wheat','barley','vegetables','flax'];for(let i=0;i<n;i++){const f=E.buildField(s,crops[i%4]);E.levelField(s,f.id);E.levelField(s,f.id);}
  for(let i=0;i<3;i++)fol(s);for(let i=0;i<carts;i++)E.buyHubUp(s,'teamster');for(const k of crops){s.res[k]=0;}
  let waiting=0;for(let d=0;d<20;d++){for(const k of crops)s.res[k]=0;const L=E.fieldsDay(s);if(process.env.DBG&&n===8)console.log('d',d,Object.values(L.made).reduce((a,b)=>a+b,0).toFixed(1),L.byFarmers.toFixed(1),JSON.stringify(s.fields.pile));waiting+=Object.values(L.fields).filter(x=>x.state==='waiting for haul').length;}
  if(process.env.DBG)console.log(n,carts,JSON.stringify(s.fields.last.made),JSON.stringify(s.fields.last.fields),s.fields.last.byFarmers,JSON.stringify(s.fields.pile));return {s,waiting,pile:Object.values(s.fields.pile).reduce((a,b)=>a+b,0)};};
ok(D.fields.haul.farmerDayCap>0,'farmers have a daily hand-haul limit (data)');
{ const r=farmRun(3,0); ok(r.waiting===0&&r.pile<D.fields.haul.farmerDayCap,'small farm (3 fields) gets by on farmer hauling'); }
{ const r=farmRun(8,0); ok(r.waiting>=20,'8 fields without teamsters: harvest backs up ('+r.waiting+' field-days stuck waiting for haul in 20 days)'); }
{ const r=farmRun(8,1); ok(r.waiting===0,'8 fields + one teamster (Cart Shed): all hauled'); ok(r.s.minions.some(m=>m.job==='teamster'),'auto moved a farmer to the teamster spot when no one was idle'); }
// generic producers: the orchard's berries wait at the trees for haul (data list, livestock can join later)
{ const s=homestead(); ok(E.hauledProducer('orchard')&&!E.hauledProducer('quarry'),'orchard is a hauled producer (data list)');
  s.structures.push({uid:'sto',type:'orchard',pieces:['fruittrees'],up:0}); s.res.berries=0; E.processDay(s);
  const p0=s.fields.pile.berries||0; ok(p0>0&&s.res.berries===0,'orchard berries go to the haul pile, not straight to storage');
  fol(s); E.fieldsDay(s); ok(s.res.berries>0&&!(s.fields.pile.berries>0.01),'a farmer hauls the orchard harvest into storage'); }
console.log('r40 ok',pass);
