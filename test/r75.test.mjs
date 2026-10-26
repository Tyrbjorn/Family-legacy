// R75 Union Hall: gate, three tiers as simulated, auto collect, easy hiring, saves, UI wiring.
import fs from 'fs'; import * as E from '../js/engine.js'; import { BUILD } from '../js/config.js'; import { STEPS } from '../js/engine/save-steps.js';
const R=new URL('../data/',import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const U=D.fields.union;
const base=()=>{const s=E.newGame(1);E.normalize(s);s.land=['plot'];s.members[0].ageDays=20*D.tuning.daysPerYear;s.res.coin=1e5;Object.assign(s.res,{wood:500,planks:500,stone:500,ingots:500,wheat:200,hay:200,vegetables:200,eggs:0});return s;};
const tm=(s,n=1,job='teamster')=>{for(let i=0;i<n;i++)s.minions.push({uid:'t'+s.nextId++,type:'laborer',equip:{},name:'T'+i,job,loyalty:100,lvl:1,skills:{}});};
const withFields=s=>{E.fieldsState(s).list.push({id:'f1',crop:'wheat',lvl:1,size:0});return s;};
const carts=s=>{const f=E.fieldsState(s);f.ups.cart1=true;f.ups.cart2=true;};

// ---- data + build
ok(/^R(75|76|77|78|79|80)$/.test(BUILD)&&D.changelog.entries.some(e=>e.build==='R75'&&e.items.length>=5),'R75 changelog kept'); 
ok(E.SCHEMA===55&&STEPS.at(-1).n===55,'no schema step: save schema stays 55');
ok(U&&U.name==='Union Hall'&&U.tiers.length===3&&U.quarter==='nw','union config in fields.json, home quarter');
ok(U.tiers[0].cost.coin===4000&&U.tiers[0].cost.planks===80&&U.tiers[0].wagons===1,'T1 4000c + 80 planks + 1 Wagon (as simulated)');
ok(U.tiers[1].cost.coin===3000&&U.tiers[1].wagons===2&&U.tiers[1].foreman===1&&U.tiers[1].teamsterSpots===2&&U.tiers[1].haulMult===1.5,'T2 3000c, 2 Wagons, foreman, +2 spots, x1.5');
ok(U.tiers[2].cost.coin===8000&&U.tiers[2].cost.ingots===40&&U.tiers[2].fees['War-wagon']===1000&&U.tiers[2].tied===2,'T3 8000c, 40 ingots, War-wagon 1000, 2 tied');
ok(U.gate.ups.join()==='cart1,cart2'&&U.gate.teamster===true&&!('buildersyard' in U.gate),'gate: cart1 + cart2 + a teamster, no Builder\'s Yard');

// ---- off by default, nothing saved
{ const s=withFields(base()); ok(!s.union&&E.unionTier(s)===0&&!E.unionActive(s)&&E.unionTied(s)===0&&E.unionSpots(s)===0&&E.unionHaulMult(s)===1,'unbuilt hall does nothing'); ok(!('union' in JSON.parse(E.serialize(s))),'no s.union in a new save'); }

// ---- gate
{ const s=withFields(base()); ok(/Cart Shed/.test(E.unionIssue(s)),'gate: needs the carts'); E.fieldsState(s).ups.cart1=true; ok(/Second Wagon|Cart/.test(E.unionIssue(s)),'gate: cart1 alone is not enough');
  carts(s); ok(E.unionIssue(s)==='needs a teamster','gate: needs a teamster'); tm(s); s.res.coin=1000; ok(E.unionIssue(s)==='cannot afford','gate open, cannot afford'); ok(E.unionBuy(s)===false&&!s.union,'cannot buy without coin');
  s.res.coin=1e5; s.res.planks=79; ok(E.unionIssue(s)==='cannot afford','needs the planks'); }

// ---- T1: no wagon in the vault -> bought at value (300)
{ const s=withFields(base()); carts(s); tm(s,2); const c0=s.res.coin, p0=s.res.planks; ok(E.unionIssue(s)===null,'ready');
  const q=E.unionQuote(s); ok(q.wagonsBought===1&&q.wagonsOwned===0&&q.total.coin===4300,'quote: 4000 + a Wagon at 300');
  ok(E.unionBuy(s)&&E.unionTier(s)===1&&s.res.coin===c0-4300&&s.res.planks===p0-80&&s.union.tier===1,'T1 bought for 4300c + 80 planks'); ok(s.minions.length===2,'T1 keeps all teamsters');
  ok(E.unionActive(s)&&E.unionTied(s)===1&&E.unionSpots(s)===0&&E.unionHaulMult(s)===1,'T1: active, 1 on duty, no spots');
  const j=JSON.parse(E.serialize(s)); ok(j.union.tier===1&&Object.keys(j.union).length===1,'saved state is just { tier }'); }
// wagon items pay for wagons
{ const s=withFields(base()); carts(s); tm(s); s.vault.push('c|wagon|fine','sword'); const c0=s.res.coin; const q=E.unionQuote(s); ok(q.wagonsOwned===1&&q.wagonsBought===0&&q.total.coin===4000,'quote uses the vault Wagon');
  ok(E.unionBuy(s)&&s.res.coin===c0-4000&&!s.vault.includes('c|wagon|fine')&&s.vault.includes('sword'),'vault Wagon consumed, other items untouched'); }
{ const s=withFields(base()); carts(s); tm(s); s.vault.push('wagon'); ok(E.vaultWagons(s).length===1&&E.unionBuy(s)&&s.vault.length===0,'plain wagon id works too'); }

// ---- T2: foreman, spots, x1.5
{ const s=withFields(base()); carts(s); tm(s,3); const cap0=E.teamsterCap(s); E.unionBuy(s); ok(E.unionIssue(s)===null,'T2 ready'); const c0=s.res.coin, n0=s.minions.length;
  ok(E.unionQuote(s).total.coin===3600,'T2 = 3000 + 2 Wagons at 300');
  ok(E.unionBuy(s)&&E.unionTier(s)===2&&s.res.coin===c0-3600&&s.minions.length===n0-1,'T2 bought, one teamster retires as foreman');
  ok(E.teamsterCap(s)===cap0+2&&E.jobCap(s,'teamster')===cap0+2&&E.unionSpots(s)===2&&E.unionHaulMult(s)===1.5,'T2: +2 teamster spots, x1.5');
  const s2=withFields(base()); carts(s2); ok(E.unionBuy(s2)===false,'no teamster -> cannot start'); }
{ const s=withFields(base()); carts(s); tm(s,1); E.unionBuy(s); s.res.coin=1e5; ok(E.unionIssue(s)===null&&E.unionBuy(s)&&s.minions.filter(x=>x.job==='teamster').length===0&&!E.unionActive(s),'foreman can be the only teamster: hall then idle until another is on duty'); }
// ---- T3
{ const s=withFields(base()); carts(s); tm(s,4); E.unionBuy(s); E.unionBuy(s); const c0=s.res.coin, i0=s.res.ingots; ok(E.unionQuote(s).total.coin===9000,'T3 = 8000 + War-wagon 1000');
  ok(E.unionBuy(s)&&E.unionTier(s)===3&&s.res.coin===c0-9000&&s.res.ingots===i0-40,'T3 bought'); ok(E.unionTied(s)===3,'T3: 3 teamsters on hall duty'); ok(E.unionIssue(s)==='max'&&E.unionBuy(s)===false&&E.unionQuote(s)===null,'max tier'); }
// ---- gate is checked once; later tiers do not need carts re-checked
{ const s=withFields(base()); carts(s); tm(s,2); E.unionBuy(s); ok(E.unionNext(s).id==='haulers','next tier is the Hauler\'s Guild'); }

// ---- auto collect (T1) vs pile
const coop=s=>{s.structures.push({uid:'c'+s.nextId++,type:'chickencoop',pieces:['nestboxes'],up:0});};
const run=(s,days)=>{for(let i=0;i<days;i++)E.processDay(s);};
{ const a=withFields(base()); coop(a); E.buyAnimals(a,'chickencoop'); tm(a,2); const b=JSON.parse(JSON.stringify(a)); carts(b); E.unionBuy(b);
  a.res.eggs=0; b.res.eggs=0; run(a,30); run(b,30);
  const pa=E.fieldsState(a).pile.eggs||0, pb=E.fieldsState(b).pile.eggs||0;
  ok(pb===0,'hall: nothing piles up'); ok(a.res.eggs+pa<b.res.eggs+pb+1e-9,'hall keeps every egg (no pile loss)'); }
{ const s=withFields(base()); coop(s); E.buyAnimals(s,'chickencoop'); carts(s); tm(s,1,'idle'); E.unionBuy(s)||(s.union={tier:1}); s.minions.forEach(x=>{x.job='idle';});
  ok(!E.unionActive(s),'no teamster on duty: hall idle'); s.res.eggs=0; run(s,10); ok((E.fieldsState(s).pile.eggs||0)>0,'idle hall: eggs go to the haul pile again'); }

// ---- hauling: hall duty is taken out of the haul rate, x1.5 from T2
const hauled=(tier,n)=>{const s=withFields(base()); s.res.wheat=0; carts(s); tm(s,n); const f=E.fieldsState(s); for(const k of ["wheat","eggs","milk","berries","wood","stone","planks"]){s.res[k]=0;f.pile[k]=1e6;} f.auto.haul=true; if(tier){ s.union={tier}; } const L=E.fieldsDay(s); return L.byTeamsters; };
{ const h0=hauled(0,4), h1=hauled(1,4), h2=hauled(2,4), h3=hauled(3,4);
  ok(h0>0&&Math.abs(h1-h0*3/4)<1e-6,'T1: one of four teamsters on hall duty ('+h0+' -> '+h1+')');
  ok(Math.abs(h2-h0*1.5*3/4)<1e-6,'T2: x1.5 with one on duty');
  ok(Math.abs(h3-h0*1.5*1/4)<1e-6,'T3: three on duty, one hauling at x1.5'); }
{ const h=hauled(1,1); ok(h===0,'a lone teamster on hall duty hauls nothing (never negative)'); }

// ---- easy hiring
const bunks=s=>{E.buildStructure(s,'bunkhouse');};
{ const s=base(); bunks(s); ok(E.hallHireIssue(s,'laborer')==='needs a Union Hall'&&E.hireAtHall(s,'laborer')===null,'no hall, no hall hiring');
  s.union={tier:1}; const fee=E.hallHireFee('laborer'), full=E.mtype('laborer').hire; ok(fee===Math.round(full*0.75)&&fee<full,'25% off: '+full+' -> '+fee);
  s.res.coin=1e5; const c0=s.res.coin, n0=s.minions.length; const mi=E.hireAtHall(s,'laborer'); ok(mi&&s.res.coin===c0-fee&&s.minions.length===n0+1&&mi.job==='idle','hired a laborer at the hall');
  ok(E.hallHireIssue(s,'guard')==='not hired here','only listed types'); s.res.coin=0; ok(E.hallHireIssue(s,'laborer')==='cannot afford'&&E.hireAtHall(s,'laborer')===null,'cannot afford the fee'); }
{ const s=base(); bunks(s); s.res.coin=1e5; ok(E.hire(s,'millbrook','laborer')&&s.res.coin===1e5-E.mtype('laborer').hire,'town hiring unchanged'); }

// ---- saves
{ const s=withFields(base()); carts(s); tm(s,3); E.unionBuy(s); E.unionBuy(s); const j=E.serialize(s), t=E.deserialize(j); ok(E.unionTier(t)===2&&t.union.tier===2,'round trip keeps the hall'); }
{ const A=E.importSave(fs.readFileSync(new URL('./fixtures/old-save-fl1.txt',import.meta.url),'utf8').trim()); ok(A.schema===E.SCHEMA&&E.unionTier(A)===0&&!A.union,'old FL1 save loads, hall unbuilt'); for(let i=0;i<30;i++)E.processDay(A); ok(!A.union,'and stays unbuilt through play'); }
{ const s=withFields(base()); const j=JSON.parse(E.serialize(s)); delete j.union; const t=E.deserialize(JSON.stringify(j)); ok(E.unionTier(t)===0,'a save without s.union reads as tier 0'); }

// ---- wiring
{ const h=fs.readFileSync(new URL('../js/ui/handlers/estate.js',import.meta.url),'utf8'), u=fs.readFileSync(new URL('../js/ui/union-ui.js',import.meta.url),'utf8'), t=fs.readFileSync(new URL('../js/ui/estate-tab.js',import.meta.url),'utf8');
  for(const a of [...u.matchAll(/data-a="(\w+)"/g)].map(x=>x[1])) ok(new RegExp('\\b'+a+':').test(h),'handler for '+a);
  ok(/unionCard\(\)/.test(t+fs.readFileSync(new URL('../js/ui/views.js',import.meta.url),'utf8')),'card is in the Estate tab'); ok(!/(png|webp|jpe?g)/i.test(u),'union card uses no new art files'); }
console.log('r75: all '+pass+' assertions passed');
