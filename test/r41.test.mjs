import fs from 'fs'; import * as E from '../js/engine.js'; import { BUILD } from '../js/config.js';
const R=new URL('../data/',import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const A=D.fields.animals;
const base=()=>{const s=E.newGame(1);E.normalize(s);s.land=['plot'];s.members[0].ageDays=20*D.tuning.daysPerYear;s.res.coin=1e5;Object.assign(s.res,{wood:500,planks:500,stone:500,wheat:200,hay:200,vegetables:50});s.minions=[];return s;};
const coop=s=>{s.structures.push({uid:'c'+s.nextId++,type:'chickencoop',pieces:['nestboxes'],up:0});};
const pen=s=>{s.structures.push({uid:'p'+s.nextId++,type:'cowpen',pieces:['milkstalls'],up:0});};
const fol=s=>{s.minions.push({uid:'mi'+s.nextId++,type:'laborer',equip:{},name:'F',job:'farm',loyalty:100,lvl:1,skills:{}});};
ok(BUILD==='R41'&&E.SCHEMA===39,'R41, schema 39');
ok(A&&A.types.chickencoop&&A.types.cowpen,'animals defined in data/fields.json');
ok(A.types.chickencoop.buy.n===6&&A.types.chickencoop.buy.cost.coin===60&&A.types.cowpen.buy.n===1&&A.types.cowpen.buy.cost.coin===90,'6 hens for 60, a cow for 90');
ok(A.types.chickencoop.hours===1&&A.types.cowpen.hours===1&&A.untended===0.25,'about 1 h tending each, 25% untended');
ok(E.hauledProducer('chickencoop')&&E.hauledProducer('cowpen')&&E.hauledProducer('orchard'),'coop and pen join the haul list');
// start empty + buy
{ const s=base(); coop(s); pen(s); ok(E.herdHead(s,'chickencoop')===0&&E.herdHead(s,'cowpen')===0,'new coop and pen start empty');
  s.res.eggs=0; E.processDay(s); ok(!(s.fields.pile.eggs>0)&&!(s.res.eggs>0),'empty coop lays nothing');
  const c0=s.res.coin; ok(E.buyAnimals(s,'chickencoop')&&E.herdHead(s,'chickencoop')===6&&s.res.coin===c0-60,'buy 6 hens for 60');
  ok(/No room/.test(E.buyAnimalsIssue(s,'chickencoop')),'coop full at 6');
  ok(E.buyAnimals(s,'cowpen')&&E.buyAnimals(s,'cowpen')&&E.herdHead(s,'cowpen')===2&&/No room/.test(E.buyAnimalsIssue(s,'cowpen')),'2 cows fill the pen');
  ok(/first/.test(E.buyAnimalsIssue(base(),'cowpen')),'need the building to buy');
  // spots upgrade
  ok(E.buySpotsUp(s,'chickencoop')&&E.herdMax(s,'chickencoop')===8&&E.buyAnimals(s,'chickencoop')&&E.herdHead(s,'chickencoop')===8,'Bigger Henhouse: +2 hens');
  ok(E.buySpotsUp(s,'cowpen')&&E.herdMax(s,'cowpen')===3,'Extra Stall: +1 cow');
  ok(E.spotsUpIssue(s,'cowpen')==='Already built','one spots upgrade each');
  ok(['chickencoop','cowpen'].every(t=>E.structDef(t).upgrades.length===3),'3 existing upgrades kept');
}
// feed: only cost, no upkeep; no breeding
{ const s=base(); coop(s); E.buyAnimals(s,'chickencoop'); const c0=s.res.coin, w0=s.res.wheat; E.feedAnimals(s); ok(s.res.wheat<w0&&s.res.coin===c0,'hens eat wheat; no coin upkeep');
  s.herds.chickencoop=4; for(let i=0;i<40;i++)E.feedAnimals(s); ok(E.herdHead(s,'chickencoop')===4,'no breeding: herd does not regrow');
  s.res.wheat=0; s.res.vegetables=0; E.feedAnimals(s); s.res.eggs=0; s.fields.pile={}; E.processDay(s); ok(!(s.fields.pile.eggs>0),'unfed hens lay nothing'); }
// tending + haul
{ const s=base(); coop(s); pen(s); E.buyAnimals(s,'chickencoop'); E.buyAnimals(s,'cowpen'); E.buyAnimals(s,'cowpen'); fol(s);
  s.res.eggs=0; s.res.milk=0; E.processDay(s); ok(s.fields.pile.eggs>0&&s.fields.pile.milk>0&&!s.res.eggs,'eggs and milk wait for haul');
  const L=E.fieldsDay(s); ok(L.animals.chickencoop.state==='tended'&&L.animals.cowpen.state==='tended','a farmer tends both');
  ok(L.need>=2&&L.workers[0].used>=2-1e-9,'tending uses ~1 h each of the shared worker hours');
  ok(s.res.eggs>0&&s.res.milk>0,'hauled into storage');
  const e1=(()=>{s.res.eggs=0;s.fields.pile={};E.processDay(s);return s.fields.pile.eggs;})();
  s.minions=[]; s.members.forEach(m=>m.ageDays=5*D.tuning.daysPerYear); E.fieldsDay(s); ok(E.tendShare(s,'chickencoop')===0.25,'untended -> 25% share');
  s.res.eggs=0;s.fields.pile={};E.processDay(s); ok(Math.abs(s.fields.pile.eggs-e1*0.25)<1e-6,'untended coop lays 25%'); }
// rest when full
{ const s=base(); coop(s); E.buyAnimals(s,'chickencoop'); fol(s); s.res.eggs=E.capOf(s,'eggs'); const L=E.fieldsDay(s); ok(L.animals.chickencoop.state==='full'&&L.workers[0].used<1e-9,'rests (no hours) when egg storage is full'); }
// seasons + market
ok(D.seasons.list.find(x=>x.id==='winter').yield.eggs===0.8,'eggs dip x0.8 in winter');
ok(D.seasons.list.find(x=>x.id==='winter').yield.milk===0.7,'milk keeps its seasons');
ok(D.towns.find(t=>t.id==='millbrook').market.includes('eggs'),'eggs buyable in Millbrook');
// save step 39: old saves keep animals
{ const s=base(); coop(s); pen(s); delete s.fields.animalsExplicit; s.herds={cowpen:1}; s.schema=38; E.normalize(s);
  ok(E.herdHead(s,'chickencoop')===6&&E.herdHead(s,'cowpen')===1&&s.schema===39,'save step 39: old coop keeps its full flock, a half pen keeps its 1 cow'); }
{ const A2=E.importSave(fs.readFileSync(new URL('./fixtures/old-save-fl1.txt',import.meta.url),'utf8').trim()); ok(A2.schema===39,'FL1 fixture migrates to 39'); }
console.log('r41 ok',pass);
