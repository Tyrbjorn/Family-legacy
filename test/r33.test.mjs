// R33: fish dishes (data/cooking.json) - species spending, cheapest-first any-fish, learning, Auto Cook, luxury toggle, buffs, caviar, save v33
import fs from 'fs'; import * as E from '../js/engine.js';
const R=new URL('../data/',import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const fresh=()=>{const s=E.newGame(1);E.normalize(s);s.res.coin=1e6;return s;};
const cook=(s,n)=>{for(const m of s.members)m.skills.cooking.lvl=n;};
let ku=0; const kitchen=(s,pieces)=>{const st={uid:'k'+(ku++),type:'kitchen',pieces,up:0};(s.structures=s.structures||[]).push(st);return st;};
const C=D.cooking.dishes;
ok(C.filter(x=>x.group==='fish').length>=8&&C.filter(x=>x.group==='kitchen').length===9,'8 fish + 9 kitchen dishes as data');
ok(C.every(x=>D.estate.meals.menu[x.id]===x.food),'every dish is on meals.menu with its food value (variety + diet toggle)');
ok(!('butter' in D.estate.meals.menu)&&!('flour' in D.estate.meals.menu)&&!('milk' in D.estate.meals.menu),'flour, butter, milk are cooking-only');
ok(C.every(x=>Object.keys(x.in).every(k=>!['sage','mandrake'].includes(k))),'thyme is the only herb');
ok(D.crafting.recipes.find(r=>r.id==='r_cakes').mats.honeycakes===2,'gift Honey Cakes are made from the Honey Cakes dish');
ok(['hearth','range','oven','smoker','smokepit','jars','brinecrocks'].every(p=>{const pc=D.estate.pieces.find(z=>z.id===p);return !pc||pc.bonus.processes.length;}),'stations exist');
ok(D.estate.pieces.find(p=>p.id==='oven').bonus.processes.some(r=>r.dish==='pikepie'),'dish rows merged into stations');
ok(D.estate.meals.menu.pikepie===4&&D.towns.every(t=>t.prices.pikepie===18&&t.prices.caviar===40),'menu food value + town prices');
E.setData(D); ok(D.estate.pieces.find(p=>p.id==='oven').bonus.processes.filter(r=>r.dish==='pikepie').length===1,'merge is idempotent');
{ const s=fresh(); ok(E.knowsDish(s,'fishstew')&&E.knowsDish(s,'friedperch')&&!E.knowsDish(s,'pikepie'),'start dishes known');
  // species spending + keep 10 raw fish
  s.res.fish=30; s.fishBag={pike:6,perch:4}; ok(E.fishAvail(s,'fish:pike')===6&&E.fishAvail(s,'fish')===20,'species from the record; 10 raw fish kept');
  E.spendFish(s,'fish:pike',2); ok(s.fishBag.pike===4&&s.res.fish===28,'species spend lowers record and total');
  E.spendFish(s,'fish',22); ok(Math.abs(s.res.fish-6)<1e-9&&s.fishBag.pike>3.99&&Math.abs(s.fishBag.perch-2)<1e-9,'any fish: Creek Fish first, then the cheapest (perch before pike)'); }
{ const s=fresh(); cook(s,30); kitchen(s,['oven']); s.res.fish=30; s.fishBag={pike:10}; Object.assign(s.res,{flour:50,butter:50,milk:50});
  E.processDay(s,1); ok(!(s.res.pikepie>0),'unlearned dish does not cook');
  s.doneQuests.push('q_pike'); E.processDay(s,1); ok(s.res.pikepie>0&&s.fishBag.pike<10&&E.knowsDish(s,'pikepie')&&s.log.some(l=>/New recipe/.test(l.msg)),'quest teaches Pike Pie; it uses pike'); }
{ const s=fresh(); cook(s,0); s.dishes.push('pikepie'); kitchen(s,['oven']); s.res.fish=30; s.fishBag={pike:10}; Object.assign(s.res,{flour:50,butter:50});
  E.processDay(s,1); ok(!(s.res.pikepie>0),'Cooking level gate'); }
{ const s=fresh(); cook(s,30); kitchen(s,['range']); s.res.fish=30; s.fishBag={sturgeon:5,trout:5}; s.fishEver={sturgeon:1,trout:1}; Object.assign(s.res,{vegetables:50,thyme:50,butter:50,wine:50});
  E.processDay(s,1); ok(E.knowsDish(s,'sturgeonfeast')&&E.knowsDish(s,'herbtrout')&&!(s.res.sturgeonfeast>0)&&!(s.res.herbtrout>0),'first catch teaches luxury dishes; not cooked while toggle off');
  E.setCookLuxury(s,true); E.processDay(s,1); ok(s.res.sturgeonfeast>0&&s.res.herbtrout>0&&s.res.caviar>0,'luxury on: feast + trout + caviar side');
  const m0=E.dishMorale(s,['herbtrout','sturgeonfeast']); ok(m0===4&&s.feast.until>s.day,'buffs: +1 trout, +3 feast'); s.day+=1; ok(E.dishMorale(s,[])===3,'feast lasts days'); s.day+=5; ok(E.dishMorale(s,[])===0,'feast ends'); }
{ const s=fresh(); cook(s,30); kitchen(s,['oven']); s.res.fish=12; s.fishBag={}; s.cooked={pie:10}; Object.assign(s.res,{flour:50,butter:50,milk:50});
  E.processDay(s,1); ok(E.knowsDish(s,'fishpie')&&s.res.fish>=10-1e-9&&s.res.fishpie>0,'Fisherman\'s Pie learned after 10 pies; 10 raw fish stay'); }
{ const s=fresh(); s.discovered=['loc:l_gullport']; E.learnDishes(s); ok(E.knowsDish(s,'pickledherring'),'Gull\'s Landing teaches Pickled Herring');
  const n=D.requests.npcs.find(x=>x.requests.some(r=>r.id==='anne3')); s.req={[n.id]:{i:3,at:0,n:3,fav:30}}; E.learnDishes(s); ok(E.knowsDish(s,'smokedeel'),'Anne\'s 3rd request teaches Smoked Eel'); }
{ // Auto Cook order: requested dish first, then variety, then food value
  const s=fresh(); const rows=D.estate.pieces.find(p=>p.id==='hearth').bonus.processes; s.meal={menu:['fishstew']}; s.res.fishstew=5; s.res.friedperch=0;
  const o=E.cookOrder(s,rows).filter(r=>r.dish).map(r=>r.dish); ok(o.indexOf('friedperch')<o.indexOf('fishstew'),'variety: a dish not on the menu goes first');
  const d2={...D,requests:{...D.requests,npcs:[{id:'zz',name:'Z',town:'millbrook',requests:[{id:'zz1',wants:{fishstew:2},reward:{coin:1}}]}]}}; E.setData(d2);
  ok(E.cookOrder(s,rows).filter(r=>r.dish)[0].dish==='fishstew','a dish an open request wants goes first'); E.setData(D); }
{ const s=fresh(); s.res.fish=5; s.fishBag={pike:3}; E.refineDay(s,D.activities.find(a=>a.id==='cook'),1); ok(s.fishBag.pike===3,'Cook a Meal uses Creek Fish before pike'); }
{ const g=fresh(); const q=D.quests.find(x=>x.id==='q_pike'); ok(/Small Boat/.test(E.questIssue(g,g.members[0],q)||''),'Old Pike quest needs a boat'); g.vault.push('smallboat'); ok(!/Boat/.test(E.questIssue(g,g.members[0],q)||''),'boat opens it'); }
{ const s=fresh(); delete s.dishes; s.schema=32; s.fishEver={trout:2}; E.normalize(s); ok(s.schema>=33&&E.knowsDish(s,'fishstew')&&E.knowsDish(s,'herbtrout')&&s.cookLuxury===false,'save v33: starting dishes + trout already caught, luxury off'); }
{ // non-fish dishes slot in as data
  const d={...D,cooking:{...D.cooking,dishes:[...D.cooking.dishes,{id:'omelette',name:'Omelette',icon:'🍳',stations:{hearth:1.5},in:{eggs:2,milk:1,thyme:1},per:1,cook:3,food:3,value:6,learn:{start:true}}]},estate:JSON.parse(JSON.stringify(D.estate)),towns:JSON.parse(JSON.stringify(D.towns))};
  E.setData(d); const s=fresh(); cook(s,10); kitchen(s,['hearth']); Object.assign(s.res,{eggs:20,milk:20,thyme:20}); E.processDay(s,1); ok(s.res.omelette>0,'a non-fish dish works from data alone'); E.setData(D); }
{ const s=fresh(); E.learnDishes(s); ok(E.knowsDish(s,'herbbread')&&E.knowsDish(s,'vegstew')&&!E.knowsDish(s,'omelette'),'kitchen start dishes');
  s.structures.push({uid:'c1',type:'chickencoop',pieces:[],up:0}); s.structures.push({uid:'c2',type:'cowpen',pieces:[],up:0}); s.res.mushrooms=20; s.doneQuests.push('b_boars'); E.learnDishes(s);
  ok(['omelette','cheesetart','mushroomsoup','hunterroast'].every(id=>E.knowsDish(s,id)),'Coop, Cow Pen, 20 mushrooms, boar hunt teach dishes');
  s.req={maud:{i:2},hob:{i:2}}; E.learnDishes(s); ok(E.knowsDish(s,'pancakes')&&E.knowsDish(s,'meatpie'),'Maud and Hob teach Pancakes and Meat Pie');
  s.members[0].spouse='x'; E.learnDishes(s); ok(E.knowsDish(s,'honeycakes'),'first wedding teaches Honey Cakes'); }
{ const s=fresh(); cook(s,20); s.dishes=['herbbread','meatpie','honeycakes']; kitchen(s,['oven']); Object.assign(s.res,{flour:12,thyme:20,meat:20,butter:20,eggs:20,honey:20});
  ok(E.dishReserve(s,'herbbread','flour')===10&&E.dishReserve(s,'herbbread','thyme')===0,'reserve: a dish leaves the last 10 of an ingredient another learned dish needs');
  s.res.flour=100; for(let i=0;i<10;i++)E.processDay(s,1); ok(s.res.honeycakes>=4-1e-9&&s.res.honeycakes<6.5,'Honey Cakes kept at about 4, not overmade'); }
{ const s=fresh(); s.day=100; s.celebrate=99; ok(E.dishMorale(s,['honeycakes'])===2,'Honey Cakes: +2 after a wedding/birth'); s.day=110; ok(E.dishMorale(s,['honeycakes'])===0,'celebration ends'); ok(E.dishMorale(s,['hunterroast'])===1,'Hunter\'s Roast +1'); }
{ const s=fresh(); s.diet={butter:true,bread:false}; s.schema=32; E.normalize(s); ok(!('butter' in s.diet)&&s.diet.bread===false,'v33 drops butter from the diet, keeps other choices'); }
console.log('r33:',pass,'passed');
