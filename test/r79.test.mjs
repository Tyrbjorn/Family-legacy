// R79 land renown gate (light thresholds): bigger parcels need current household renown; Starting Plot ungated; quest grants bypass; UI reasons; Orrin chime; Encyclopedia entry.
import fs from 'fs'; import * as E from '../js/engine.js'; import { BUILD } from '../js/config.js'; import { STEPS } from '../js/engine/save-steps.js';
import * as L from '../js/ui/coach-logic.js'; import * as C from '../js/ui/coach-data.js';
const R=new URL('../data/',import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const src=f=>fs.readFileSync(new URL('../js/'+f,import.meta.url),'utf8');
const fresh=()=>{const s=E.newGame(1);E.normalize(s);return s;};
const rich=s=>{Object.assign(s.res,{coin:1e7,stone:1e5,wood:1e5,blocks:1e5});return s;};
const LAND=D.estate.lands, TH={acre:25,riverbank:60,meadow:130,woodlot:200,hillside:400,ridge:600,highclaim:900,valley:1200};

// ---- build, save format unchanged
ok(/^R(79|80|81|82|83|84|85)$/.test(BUILD)&&E.SCHEMA===55&&STEPS.at(-1).n===55,'R79 build, save stays 55');
ok(D.changelog.entries.some(e=>e.build==='R79'&&e.items.length>=3)&&D.changelog.entries.some(e=>e.build==='R78'),'changelog has R79 first and keeps R78');

// ---- data: light thresholds, plot ungated
for(const l of LAND) ok(l.id==='plot'?l.renown===undefined:l.renown===TH[l.id],'threshold '+l.id);
ok(LAND.length===9,'nine parcels');

// ---- engine
{ const s=rich(fresh()); s.renown=0;
  ok(E.landIssue(s,'plot')===null&&E.canBuyLand(s,'plot')&&E.landRenown(s,'plot')===null,'Starting Plot is ungated at renown 0');
  ok(E.buyLand(s,'plot'),'buy the plot with 0 renown');
  ok(/^Needs renown 25 \(you have 0\)$/.test(E.landIssue(s,'acre'))&&!E.canBuyLand(s,'acre')&&!E.buyLand(s,'acre')&&!s.land.includes('acre'),'acre refused at renown 0 with a reason');
  const c0=s.res.coin; E.buyLand(s,'acre'); ok(s.res.coin===c0,'a refused purchase costs nothing');
  s.renown=24.9; ok(/you have 24\)/.test(E.landIssue(s,'acre')),'have is floored, 24.9 < 25 refused');
  s.renown=25; ok(E.landIssue(s,'acre')===null&&E.buyLand(s,'acre')&&s.land.includes('acre'),'exactly 25 renown buys the acre');
  ok(E.landRenown(s,'acre').ok===true,'landRenown ok flag');
  s.renown=10; ok(s.land.includes('acre')&&E.landSlots(s)>=4,'dropping renown never takes a parcel back');
  // order of reasons: requires first, then renown, then cost
  ok(E.landIssue(s,'hillside')==='needs Brookside Meadow','requires reported before renown');
  s.renown=1e6; ok(E.buyLand(s,'meadow')&&E.buyLand(s,'hillside'),'with plenty of renown the chain buys');
  const t=rich(fresh()); t.renown=130; t.land=['plot','acre']; t.res.coin=0; ok(E.landIssue(t,'meadow')==='cannot afford','renown met, coin short => cannot afford');
  ok(E.landIssue(t,'nope')==='no such parcel','unknown parcel'); ok(E.landIssue(t,'acre')==='owned','owned parcel');
  const h=rich(fresh()); h.land=['plot','acre','meadow','hillside']; h.renown=899; ok(/discovered/.test(E.landIssue(h,'highclaim')),'highclaim: region reported first'); h.discovered=[...(h.discovered||[]),'highlands']; ok(/^Needs renown 900/.test(E.landIssue(h,'highclaim')),'highclaim: renown once the region is known');
}
{ // every threshold boundary; gate uses CURRENT renown
  for(const [id,n] of Object.entries(TH)){ const s=rich(fresh()); s.land=LAND.filter(l=>l.id!==id&&l.id!=='valley'&&l.id!==id).map(l=>l.id); s.discovered=[...(s.discovered||[]),'highlands'];
    s.land=s.land.filter(x=>x!==id); if(id==='valley') s.land=['plot','acre','meadow','hillside','ridge'];
    s.renown=n-1; const a=E.landIssue(s,id); s.renown=n; const b=E.landIssue(s,id);
    ok(/Needs renown/.test(a||'')&&!/Needs renown/.test(b||''),'boundary '+id+' at '+n); }
}
// ---- quest grants bypass the gate
{ const s=fresh(); s.renown=0; const st8=D.quests.find(q=>q.id==='st8'), st3=D.quests.find(q=>q.id==='st3');
  ok(st8&&st8.rewards&&st8.rewards.land==='acre'||JSON.stringify(st8).includes('"land":"acre"')||JSON.stringify(st8).includes('"land": "acre"'),'st8 grants the acre'); ok(JSON.stringify(st3).includes('plot'),'st3 grants the plot');
  const q=src('engine/quests.js'); ok(/s\.land\.push\(g\.land\)/.test(q)&&!/canBuyLand|landIssue/.test(q),'quest grant pushes the parcel directly (no gate)'); }
// ---- gate off (no renown fields / zeros) == the old behaviour
{ const saved=LAND.map(l=>l.renown); for(const l of LAND) l.renown=0;
  const s=rich(fresh()); s.renown=0; s.discovered=[...(s.discovered||[]),'highlands']; const got=[]; for(let k=0;k<3;k++) for(const l of LAND) if(E.buyLand(s,l.id)) got.push(l.id);
  ok(got.length===9&&LAND.every(l=>E.landRenown(s,l.id)===null),'gate-off: renown 0 buys all nine in chain order');
  for(const l of LAND) delete l.renown; const t=rich(fresh()); ok(E.landRenown(t,'acre')===null&&E.landIssue(t,'acre')==='needs Starting Plot','gate-off: no field = no gate');
  LAND.forEach((l,i)=>{ if(saved[i]!==undefined) l.renown=saved[i]; }); }
// ---- UI wiring
{ const et=src('ui/estate-tab.js'), em=src('ui/estate-map.js'), mt=src('ui/map-tab.js'), cl=src('ui/coach-logic.js'), cd=src('ui/coach-data.js'), enc=src('engine/encyclopedia.js');
  ok(/export function renownLine/.test(et)&&/Needs renown \$\{r\.need/.test(et)&&/\(you have \$\{r\.have/.test(et)&&/renownLine\(l\.id\)/.test(et),'landShop shows "Needs renown X (you have Y)"');
  ok(/landShop\(t\.id\)/.test(mt)&&/import \{ landShop \}/.test(mt),'map-tab town list uses the same landShop');
  ok(/E\.landRenown\(s, p\.id\)/.test(em)&&/renown \$\{rn\.need\}/.test(em)&&/disabled/.test(em),'estate-map lock shows the renown and stays disabled');
  ok(/landgate/.test(cl)&&/landgate/.test(cd),'Orrin chime landgate wired'); ok(/land:renown/.test(enc),'Encyclopedia entry wired');
  ok(!/landIssue|landRenown/.test(src('ui/estate-layout.js')),'map layout untouched');
  ok(/150 coin and a name on the roll/.test(cd)&&/Greenvale needs renown 1,200/.test(cd),'Ground Ledger text'); ok(/reeve wants to know your family is known/.test(et),'landless card text'); }
// ---- Orrin chime
{ const h=L.coachHelpers(E,D), mk=()=>{const s=fresh();s.day=40;s.tut={step:99,started:true,skipped:true,flags:{}};return s;};
  const s=mk(); ok(!L.noteById(s,h,'landgate').on,'no chime before the family has land'); s.land=['plot']; s.renown=0; ok(L.noteById(s,h,'landgate').on,'chime when the next parcel is held back by renown');
  s.renown=60; ok(!L.noteById(s,h,'landgate').on,'chime off once the acre and riverbank are open'); s.land=['plot','acre']; s.renown=0; ok(L.noteById(s,h,'landgate').on,'chime again for the meadow gate');
  ok(C.CHIMES.some(c=>c.id==='landgate'&&c.line&&c.title)&&C.NOTE_ID.test('landgate'),'chime row well-formed'); }
// ---- Encyclopedia
{ const Cat=E.encCatalog(D), e=Cat.lore.find(x=>x.id==='land:renown'); ok(e&&e.name==='Land and renown'&&/Cleared Acre: 2 land slots, 500 coin, needs renown 25, after Starting Plot/.test(e.text)&&/Starting Plot: 2 land slots, 150 coin, no renown needed/.test(e.text)&&/Greenvale.*needs renown 1,200/.test(e.text),'catalog entry built from D.estate.lands');
  const s=fresh(); ok(!E.encObserve(D,s).lore.includes('land:renown'),'hidden before any land'); s.land=['plot']; ok(E.encObserve(D,s).lore.includes('land:renown'),'found once the family holds land'); }
// ---- engine diffs are limited; no save change
{ const sv=src('engine/save-steps.js'); ok(!/renown.*land|land.*renown/i.test(sv.slice(-600)),'no new save step for the gate'); }
console.log('r79 ok '+pass+' checks');
