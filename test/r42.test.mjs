import fs from "fs"; import * as E from "../js/engine.js"; import { BUILD } from "../js/config.js";
const R=new URL("../data/",import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const A=D.fields.animals;
const ST0=JSON.parse(JSON.stringify(D.estate.stages));
const at=name=>{const i=ST0.findIndex(x=>x[1]===name);D.estate.stages=ST0.map((x,j)=>[j<=i?0:1e9,x[1]]);};
const base=()=>{const s=E.newGame(1);E.normalize(s);s.land=['plot'];s.members[0].ageDays=20*D.tuning.daysPerYear;Object.assign(s.res,{coin:1000,wheat:50,wood:50,ore:20,stone:20,barley:20});return s;};
const add=(s,type)=>s.structures.push({uid:type+s.nextId++,type,pieces:[],up:0});
const C=E.chores();
ok(BUILD==='R42','R42');
ok(C.length===11,'11 chores');
ok(!C.some(c=>/hens|cows/i.test(c.name)),'Mind the Hens / Milk the Cows dropped (R41 tending)');
ok(C.every(c=>c.task&&c.tier==='basic'&&c.chore.opens&&c.chore.tier>=1&&c.chore.tier<=4),'chores are basic tasks with tier + opens in data');
ok(C.every(c=>{const r=E.choreRecipe(c);return r.id&&r.in&&r.out&&r.skill;}),'every chore has a planner recipe (in -> out, skill)');
ok([1,2,3,4].every(t=>C.some(c=>c.chore.tier===t)),'4 tiers');
// tiers open with growth
{ const s=base(); at('Scrub Plot'); ok(E.openChores(s).length===0,'scrub plot: none');
  at('Homestead'); ok(E.openChores(s).map(c=>c.id).sort().join()==='glean,kindling','Homestead: Glean + Kindling');
  at('Farmstead'); ok(E.openChores(s).some(c=>c.id==='mendnets')&&!E.openChores(s).some(c=>c.id==='millflour'),'Farmstead: Mend Nets; Mill Flour needs a Gristmill');
  add(s,'gristmill'); ok(E.choreOpen(s,E.choreDef('millflour')),'Gristmill opens Mill Flour');
  ok(E.taskLock(s,s.members[0],E.choreDef('ledgers'))!=='','Manor chore locked at Farmstead');
  at('Manor'); ok(E.taskLock(s,s.members[0],E.choreDef('ledgers'))==='','Manor: Keep the Ledgers open');
  ok(!E.choreOpen(s,E.choreDef('errands')),'village chores need your village'); s.village={tier:0}; ok(E.choreOpen(s,E.choreDef('errands')),'village opens errands'); }
// popup + seen (no save step)
{ const s=base(); at('Scrub Plot'); E.choresDay(s); ok(s.chores.seen.length===0&&s.chores.news.length===0,'nothing new at start');
  at('Homestead'); E.choresDay(s); ok(s.chores.news.length===2,'new chores queue a popup');
  ok(E.takeChoreNews(s).length===2&&s.chores.news.length===0,'popup consumed'); E.choresDay(s); ok(s.chores.news.length===0,'shown once');
  const o=base(); delete o.chores; at('Manor'); E.choresDay(o); ok(o.chores.news.length===0,'older save: chores already open do not flood popups'); }
// free basic auto
{ const s=base(); at('Farmstead'); add(s,'gristmill'); s.res.flour=0; const w0=s.res.wheat; E.choresDay(s);
  const r=D.estate.chores.autoRate; ok(Math.abs(s.res.flour-r*E.taskMult(s,E.choreDef('millflour')))<1e-9&&s.res.wheat<w0,'auto mills flour at the basic rate (uses wheat)');
  const b0=s.res.berries||0; E.choresDay(s); ok(s.res.berries>b0,'auto gleans berries');
  E.toggleChore(s,'glean'); const b1=s.res.berries; E.choresDay(s); ok(s.res.berries===b1,'paused chore does not run');
  s.res.wheat=0; const f1=s.res.flour; E.choresDay(s); ok(s.res.flour===f1,'no wheat: no flour'); }
// chore effects
{ const s=base(); at('Farmstead'); const f0=E.taskMult(s,D.activities.find(a=>a.id==='fishing')); E.choresDay(s); ok(E.taskMult(s,D.activities.find(a=>a.id==='fishing'))>f0+0.19,'Mend Nets: fishing +20% that day');
  const k0=E.taskMult(s,D.activities.find(a=>a.id==='cook')); ok(k0>=1.25,'Kindling: cooking +25%');
  at('Manor'); const p0=E.townSellPrice(s,'millbrook','wood'); E.choresDay(s); ok(E.townSellPrice(s,'millbrook','wood')>=p0,'ledgers: trade price not lower');
  ok(E.choreFx(s,'tradeSell')===0.02,'Keep the Ledgers: +2% trade');
  s.village={tier:0}; E.choresDay(s); ok(Math.abs(E.upkeepMult(s)-0.9)<1e-9,'errands: village upkeep -10%'); }
// villager second sets + village villagers
{ const s=base(); at('Homestead'); const n=E.npcDef('maud'); ok(E.reqList(s,n).length===3,'before Farmstead: 3 requests');
  at('Farmstead'); ok(E.reqList(s,n).length===6&&n.set2.requests.some(r=>r.wants.flour),'Farmstead: second set (asks flour)');
  ok(D.requests.npcs.filter(n=>n.town==='millbrook').every(n=>n.set2&&n.set2.requests.length===3),'every Millbrook villager has a second set of 3');
  ok(!E.openNpcs(s).some(n=>n.id==='reeve')&&E.deliverIssue(s,'reeve')==='not here yet','Reeve hidden before your village');
  s.village={tier:0}; ok(E.openNpcs(s).some(n=>n.id==='reeve')&&E.openNpcs(s).some(n=>n.id==='millerwife'),'Reeve + Miller\'s Wife appear with the village');
  s.res.planks=100; s.res.blocks=100; s.req={}; ok(E.deliverRequest(s,'reeve'),'deliver to the Reeve at home');
  s.req.reeve.at=0; E.deliverRequest(s,'reeve'); ok(s.reqPerks.some(p=>p.type==='upkeep')&&E.upkeepMult(s)<1,'Reeve: lasting upkeep cut');
  s.res.flour=100; s.res.milk=100; s.dishes=(s.dishes||[]).filter(d=>d!=='pancakes'); E.deliverRequest(s,'millerwife'); s.req.millerwife.at=0; E.deliverRequest(s,'millerwife'); ok(s.dishes.includes('pancakes'),'Miller\'s Wife shares a recipe'); }
D.estate.stages=ST0;
ok(E.SCHEMA===39,'no save step needed (still 39)');
console.log('r42 ok',pass);
