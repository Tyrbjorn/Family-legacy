import fs from "fs"; import * as E from "../js/engine.js"; import { BUILD } from "../js/config.js";
const R=new URL("../data/",import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const A=D.fields.animals;
const ST0=JSON.parse(JSON.stringify(D.estate.stages)); const at=name=>{const i=ST0.findIndex(x=>x[1]===name);D.estate.stages=ST0.map((x,j)=>[j<=i?0:1e9,x[1]]);};
const seeded=(()=>{let a=43;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};})(); E.setRng(seeded);
const U=id=>D.legacy.upgrades.find(u=>u.id===id);
const base=()=>{const s=E.newGame(1);E.normalize(s);s.land=['plot'];s.members[0].ageDays=20*D.tuning.daysPerYear;s.members[0].skills.smithing.lvl=10;s.res.coin=1e4;s.minions=[];return s;};
const forge=s=>s.structures.push({uid:'sm'+s.nextId++,type:'smithy',pieces:['forge'],up:0});
ok(/^R\d+/.test(BUILD)&&+BUILD.slice(1).split('.')[0]>=43&&E.SCHEMA>=40,'R43+, save step 40+');
// Workshop lines (data)
ok(D.legacy.groups.workshop&&['orders','quotas','craftspd','mwork','at_tend'].every(id=>U(id)&&U(id).group==='workshop'&&U(id).tiers.length===3),'Workshop: 5 lines, 3 tiers each');
ok(['orders','quotas','craftspd','mwork','at_tend'].every(id=>U(id).tiers[0].cost<=80),'every tier 1 costs 80 or less (sims bank ~75-100 by year 10)');
ok(U('orders').free===2&&U('orders').tiers.map(t=>t.value).join()==='4,8,15','queue: 2 free, 4/8/15');
ok(U('mwork').tiers.map(t=>t.value).join()==='0.02,0.04,0.07'&&U('craftspd').tiers.map(t=>t.value).join()==='0.15,0.3,0.5','masterwork +2/4/7%, craft speed +15/30/50%');
// orders: queue + status
{ const s=base(); ok(E.queueSize(s)===2,'free queue of 2');
  ok(E.orderIssue(s,'nothing_xyz',1)==='nothing can make that','unknown item refused');
  const a=E.addOrder(s,'iron_sword',3), b=E.addOrder(s,'planks',10), c=E.addOrder(s,'ingots',5);
  ok(a&&b&&c&&E.activeOrders(s).length===2,'3 orders, 2 working');
  ok(/queue slot/.test(E.orderStatus(s,c).text),'third waits for a queue slot');
  ok(/Forge/.test(E.orderStatus(s,a).text),'stuck line: needs a Forge');
  forge(s); s.res.ingots=0; s.res.planks=5; E.quotaDay(s);
  const chain=E.quotaList(s).filter(q=>q.order===a.id); if(process.env.DBG)console.log(JSON.stringify(E.quotaList(s)),JSON.stringify(E.orderList(s)),E.quotaBlock(s,chain[0]||{item:'iron_sword',target:3,mode:'once',made:0}));
  ok(chain.some(q=>q.item==='iron_sword')&&chain.some(q=>q.item==='ingots'),'planner pulls the missing input (ingots) for the order');
  ok(/ingots/.test(E.orderStatus(s,a).text),'stuck line names the missing material');
  ok(E.quotaIssue(s,'wood','standing')===null,'order chains do not use quota slots');
  E.toggleOrderPause(s,a.id); E.quotaDay(s); ok(!E.quotaList(s).some(q=>q.order===a.id)&&E.activeOrders(s).map(o=>o.id).join()===[b.id,c.id].join(),'pausing frees the slot (next order starts)');
  ok(E.orderStatus(s,a).text==='paused','paused line');
  E.toggleOrderPause(s,a.id); ok(E.moveOrder(s,a.id,1)&&E.orderList(s)[1].id===a.id,'reorder');
  ok(E.removeOrder(s,c.id)&&E.orderList(s).length===2,'cancel'); }
// followers first, then family
{ const s=base(); forge(s); s.res.ingots=30; s.res.planks=10; const mi={uid:'m1',type:'laborer',job:'craft',equip:{},name:'Smith',loyalty:100,lvl:1,skills:{}}; s.minions.push(mi);
  const o=E.addOrder(s,'iron_sword',2); E.quotaDay(s); ok(mi.craftOrder==='r_sword'&&mi.orderFor===o.id,'a craft-job follower takes the order');
  ok(!(s.members[0].craftQueue||[]).length,'family not queued while a follower works it');
  const s2=base(); forge(s2); s2.res.ingots=30; s2.res.planks=10; E.addOrder(s2,'iron_sword',2); E.quotaDay(s2); ok((s2.members[0].craftQueue||[]).includes('r_sword'),'no follower: family crafter queued');
  s.vault=s.vault||[]; s.vault.push('iron_sword','iron_sword'); E.quotaDay(s); ok(E.orderDone(s,o)&&!E.quotaList(s).some(q=>q.order===o.id)&&!mi.craftOrder,'order done: chain cleared, follower released'); }
// pause when done
{ const s=base(); forge(s); const o=E.addOrder(s,'iron_sword',5); E.quotaDay(s); E.setOrderPauseWhenDone(s,o.id,true); E.quotaDay(s); ok(!o.paused,'pause-when-done waits for the current item');
  (s.vault||=[]).push('iron_sword'); E.quotaDay(s); E.quotaDay(s); ok(o.paused&&!o.pwd&&E.orderMade(s,o)===1,'pauses after the item being made');
  const q=E.addQuota(s,'wood',10,'standing'); E.setQuotaPauseWhenDone(s,q.id,true); s.res.wood=5; E.quotaDay(s); ok(!q.off,'quota keeps going until met');
  s.res.wood=20; E.quotaDay(s); ok(q.off&&E.quotaPaused(s,q),'quota pauses when done'); E.toggleQuotaOff(s,q.id); ok(!q.off,'resume quota'); }
// craft speed + masterwork
{ const s=base(); s.legacy=s.legacy||E.legacyState(s); E.legacyState(s).renown=5000; ok(E.legacyValue(s,'craftspd')===0&&E.buyLegacy(s,'craftspd')&&E.legacyValue(s,'craftspd')===0.15,'Craft Speed tier 1 = +15%');
  const Q=D.crafting.qualities, top=Q[Q.length-1].id, sub=Q[Q.length-2].id;
  E.setRng(()=>0); ok(E.masterworkBump(s,sub)===sub,'no Masterwork line: no bump');
  E.buyLegacy(s,'mwork'); ok(E.masterworkBump(s,sub)===top&&E.masterworkBump(s,Q[0].id)===Q[0].id,'Masterwork Chance only lifts the step below masterwork');
  E.setRng(()=>0.5); ok(E.masterworkBump(s,sub)===sub,'chance is small (2%)'); E.setRng(seeded); }
// save step 40: refunds + queues -> orders
{ const s=base(); const L=E.legacyState(s); L.ups.quotas=2; L.ups.at_tend=1; L.renown=0; s.members[0].craftQueue=['r_sword','r_sword']; s.quotas=[{id:'q1',item:'wood',target:10,mode:'standing',made:0}]; s.schema=39; E.normalize(s);
  ok(L.ups.quotas===3&&L.ups.at_tend===1,'Ledger tier 2 -> Quotas tier 3 (unlimited); Tireless Hands tier 1 -> tier 1');
  ok(L.renown===(1600-860)+(300-80),'refund: renown paid above the new price ('+L.renown+')');
  ok(E.orderList(s).length===1&&E.orderList(s)[0].target===2&&!s.members[0].craftQueue.length,'old craft queue becomes an order');
  ok(s.quotas.some(q=>q.id==='q1'),'quotas kept'); ok(s.schema===E.SCHEMA,'schema current');
  const t=base(); t.schema=39; E.normalize(t); ok((E.legacyState(t).renown||0)===0,'nothing bought: no refund'); }
// R43 Auto rotation (data order, skip done/paused/full)
{ const s=base(); at('Homestead'); s.buildings.farm=3; E.migrateFields(s); s.structures.push({uid:'c1',type:'chickencoop',pieces:['nestboxes'],up:0},{uid:'p1',type:'cowpen',pieces:['milkstalls'],up:0});
  Object.assign(s.res,{coin:1e4,wheat:100,hay:100,vegetables:50}); E.buyAnimals(s,'chickencoop'); E.buyAnimals(s,'cowpen');
  for(let i=0;i<2;i++) s.minions.push({uid:'f'+i,type:'laborer',job:'farm',equip:{},name:'F'+i,loyalty:100,lvl:1,skills:{}});
  ok(D.fields.rotation.order.join()==='chickencoop,cowpen,chores','rotation order is data');
  let L=E.fieldsDay(s); ok(L.rotation.map(x=>x.step).join()==='fields,chickencoop,cowpen,chores','worker moves fields -> coop -> pen -> chores');
  ok(L.rotation.every(x=>x.state==='worked'),'every stop worked when there are hands: '+JSON.stringify(L.rotation));
  ok(L.chores.glean==='worked'&&L.chores.kindling==='worked','chores worked in turn');
  s.res.eggs=E.capOf(s,'eggs'); E.toggleChore(s,'glean'); L=E.fieldsDay(s);
  ok(L.animals.chickencoop.state==='full'&&L.rotation.find(x=>x.step==='chickencoop').state==='skipped','coop full: skipped');
  ok(L.chores.glean==='paused'&&L.chores.kindling==='worked','paused chore skipped, next one worked');
  D.fields.rotation.order=['chores','cowpen','chickencoop']; L=E.fieldsDay(s); ok(L.rotation.map(x=>x.step).join()==='fields,chores,cowpen,chickencoop','changing the data changes the order'); D.fields.rotation.order=['chickencoop','cowpen','chores']; }
// free auto from day 1: gathering has a default spot
{ const s=base(); s.atLast={}; const t=E.atTarget(s,'extraction'); ok(!t||t.kind==='gather','auto gathering picks the first known spot without a hand-done trip'); }
D.estate.stages=ST0;
console.log('r43 ok',pass);
