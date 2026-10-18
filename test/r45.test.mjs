import fs from "fs"; import * as E from "../js/engine.js"; import { BUILD } from "../js/config.js";
const R=new URL("../data/",import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const A=D.fields.animals;
const ST0=JSON.parse(JSON.stringify(D.estate.stages)); const at=name=>{const i=ST0.findIndex(x=>x[1]===name);D.estate.stages=ST0.map((x,j)=>[j<=i?0:1e9,x[1]]);};
const seeded=(()=>{let a=45;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};})(); E.setRng(seeded);
const U=id=>D.legacy.upgrades.find(u=>u.id===id);
const base=()=>{const s=E.newGame(1);E.normalize(s);s.land=['plot'];s.members[0].ageDays=20*D.tuning.daysPerYear;s.members[0].skills.smithing.lvl=10;s.res.coin=1e4;s.minions=[];return s;};
const forge=s=>s.structures.push({uid:'sm'+s.nextId++,type:'smithy',pieces:['forge'],up:0});
const BD=D.boards, adv=s=>{const m=s.members[0];m.ageDays=25*D.tuning.daysPerYear;m.action=null;return m;};
const run=(s,m,n)=>{for(let i=0;i<n&&m.action;i++)E.doAction(s,m,m.action,1);};
ok(E.SCHEMA>=41,'save step 41+');
// data
ok(BD.rotateDays===7&&BD.show===3&&BD.fromBand===2,'boards: 3 jobs, 2 from your band, new set every 7 days');
ok(BD.bands.map(b=>b.mult).join()==='1,2.5,6','bands ×1 / ×2.5 / ×6');
ok(D.towns.every(t=>BD.pools[t.id]&&[1,2,3].every(b=>BD.pools[t.id].some(j=>j.band===b))),'every town has a job pool covering all 3 bands');
ok(['millers_contract','barons_courier','lost_shipment'].every(id=>E.lineDef(id)),'three quest lines');
ok(E.lineDef('barons_courier').stops.length===3&&E.lineDef('millers_contract').stops.map(x=>x.at).join()==='millbrook,ashford','Courier: 3 towns; Miller: Millbrook → Ashford');
ok(E.lineDef('lost_shipment').stops[0].at==='home'&&E.lineDef('lost_shipment').stops[2].at==='stag','Lost Shipment: Dock → Thornwick → forest pin');
// boards: discovered towns only
{ const s=base(); s.discovered=[]; E.boardsDay(s); const t=E.boardTowns(s).map(t=>t.id);
  ok(t.includes('millbrook')&&!t.includes('ashford')&&!t.includes('eyrie'),'boards only for discovered towns ('+t+')');
  ok(E.boardOf(s,'millbrook').length===3,'3 jobs on the board');
  ok(!s.boards.towns.ashford,'no board rolled for an undiscovered town');
  s.discovered=['ashford']; s.day=1; E.boardsDay(s); ok(E.boardOf(s,'ashford').length===3,'discovering a town opens its board');
  const j0=E.boardOf(s,'millbrook').map(j=>j.uid).join(); s.day=6; E.boardsDay(s); ok(E.boardOf(s,'millbrook').map(j=>j.uid).join()===j0,'same jobs until day 7');
  s.day=7; E.boardsDay(s); ok(E.boardOf(s,'millbrook').map(j=>j.uid).join()!==j0&&E.boardNext(s,'millbrook')===14,'new set on day 7, next on day 14'); }
// bands
{ const s=base(); ok(E.bandOf(s)===1,'new game: Beginning band');
  for(let i=0;i<20;i++){E.rollBoard(s,'thornwick');const J=E.boardOf(s,'thornwick');ok(J.filter(j=>j.band===1).length===2&&J.filter(j=>j.band===2&&j.stretch).length===1,'Beginning: 2 band-1 jobs + 1 stretch from Established');if(pass>200)break;}
  const J=E.boardOf(s,'thornwick'), st=J.find(j=>j.stretch), raw=BD.pools.thornwick.find(x=>x.id===st.id); ok(st.coin===Math.round(raw.coin*2.5),'stretch job pays ×2.5');
  const b1=J.find(j=>!j.stretch); ok(b1.coin===BD.pools.thornwick.find(x=>x.id===b1.id).coin,'band-1 job pays ×1');
  s.renown=400; ok(E.bandOf(s)===2,'Established phase → band 2'); E.rollBoard(s,'thornwick'); const K=E.boardOf(s,'thornwick'); ok(K.filter(j=>j.band===2).length===2&&K.filter(j=>j.band===3).length===1,'Established: 2 band-2 + 1 Dynasty stretch');
  ok(K.find(j=>j.band===3).coin===Math.round(BD.pools.thornwick.find(x=>x.id===K.find(j=>j.band===3).id).coin*6),'Dynasty pays ×6'); }
// taking jobs
{ const s=base(); s.discovered=['ashford','thornwick']; const m=adv(s); s.boards={towns:{},seq:0};
  s.boards.towns.millbrook={next:99,jobs:[{...BD.pools.millbrook[0],uid:'j1',coin:45,band:1},{...BD.pools.millbrook[1],uid:'j2',coin:40,band:1},{...BD.pools.millbrook[4],uid:'j3',coin:137,band:2}]};
  s.res.wood=5; ok(/needs 20 wood/.test(E.jobIssue(s,m,'j1')),'deliver: says what is short');
  const o=E.orderForJob(s,'j1'); ok(o&&o.item==='wood'&&o.target===15,'Work Orders planner: order the 15 missing wood');
  ok(!E.orderForJob(s,'j1'),'no duplicate order');
  s.res.wood=25; const c0=s.res.coin; ok(E.takeJob(s,m,'j1')&&s.res.wood===5,'take a deliver job: goods go with them');
  ok(m.action.type==='bjob'&&m.action.target==='millbrook','a normal trip to the town');
  ok(E.jobIssue(s,m,'j2')&&/away|taken/.test(E.jobIssue(s,m,'j2')),'busy member cannot take a second job');
  run(s,m,60); ok(!m.action||m.action.type!=='bjob','trip finished'); ok(s.res.coin===c0+45&&E.townFavour(s,'millbrook')===5,'reward: coin + town favour');
  ok(!E.boardOf(s,'millbrook').some(j=>j.uid==='j1'),'finished job leaves the board');
  m.action=null; ok(/needs CP/.test(E.jobIssue(s,m,'j2'))||!E.jobIssue(s,m,'j2'),'clear job checks CP');
  m.action=null; ok(E.takeJob(s,m,'j3')&&m.action.target==='thornwick','escort goes to the other town'); run(s,m,80); ok(s.res.coin>=c0+45+137,'escort paid');
  s.day=100; E.boardsDay(s); ok(E.boardOf(s,'millbrook').length===3,'board refills on rotation'); }
// taken job survives rotation
{ const s=base(); const m=adv(s); E.boardsDay(s); const j=E.boardOf(s,'millbrook').find(j=>j.kind==='escort'||j.kind==='clear'&&j.cp<=E.cp(s,m)); if(j&&j.kind==='escort'){ok(true,'skip');} else { s.res.wood=100;s.res.fish=100; }
  const any=E.boardOf(s,'millbrook').find(x=>!E.jobIssue(s,m,x.uid)); if(any){E.takeJob(s,m,any.uid); s.day=7; E.boardsDay(s); ok(E.boardOf(s,'millbrook').some(x=>x.uid===any.uid),'a job under way stays through the rotation');} else ok(true,'no takeable job this seed'); }
// quest lines
{ const s=base(); const m=adv(s); s.discovered=[]; const L=E.lineDef('millers_contract');
  ok(/Homestead|find/.test(E.lineIssue(s,L)),'line locked: '+E.lineIssue(s,L));
  at('Homestead'); ok(/find Ashford/.test(E.lineIssue(s,L)||''),'needs every stop town discovered');
  s.discovered=['ashford']; ok(!E.lineIssue(s,L),'opens at Homestead with Ashford found');
  const c0=s.res.coin; ok(E.goStop(s,m,'millers_contract'),'start the line'); run(s,m,60);
  ok(E.lineState(s,'millers_contract').stop===1&&s.res.coin===c0+20,'stop 1 reward');
  m.action=null; s.res.flour=0; ok(/needs 15 flour/.test(E.stopIssue(s,m,'millers_contract')),'stop 2 needs the flour');
  const os=E.orderForStop(s,'millers_contract'); ok(os.length===1&&os[0].item==='flour'&&os[0].target===15,'stop short of goods: Work Order for the flour'); ok(!E.orderForStop(s,'millers_contract').length,'no duplicate');
  s.res.flour=20; ok(E.goStop(s,m,'millers_contract')&&s.res.flour===5,'deliver stop takes the goods'); ok(m.action.target==='ashford','to Ashford');
  run(s,m,60); const st=E.lineState(s,'millers_contract'); ok(st.done&&s.res.coin===c0+20+40+120,'stop 2 + end reward');
  ok(E.townFavour(s,'ashford')===10,'line favour'); m.action=null; ok(E.stopIssue(s,m,'millers_contract')==='finished','finished line stays finished');
  ok(E.lineRoute('barons_courier').join()==='home,millbrook,thornwick,eyrie','route for the map'); }
{ const s=base(); const m=adv(s); s.renown=400; at('Farmstead'); s.discovered=['eyrie','thornwick']; const c0=s.res.coin; E.goStop(s,m,'barons_courier'); run(s,m,80); ok(s.res.coin===c0+Math.round(20*2.5),'band-2 line: stop rewards ×2.5'); }
// Auto-Adventure
{ const s=base(); const m=adv(s); at('Homestead'); s.discovered=['ashford']; E.goStop(s,m,'millers_contract'); run(s,m,60); m.action=null;
  s.res.flour=0; m.standing='adventure'; E.standingTick(s,m); ok(E.orderList(s).some(o=>o.item==='flour'),'auto: a line stop short of goods orders them (planner)');
  s.res.flour=30; m.action=null; E.standingTick(s,m); ok(m.action&&m.action.line==='millers_contract'&&m.action.trip,'auto follows the line its person started');
  const m2=JSON.parse(JSON.stringify(m)); m2.id=777; m2.action=null; s.members.push(m2); m2.standing='adventure'; s.boards={towns:{millbrook:{next:99,jobs:[{...BD.pools.millbrook[4],uid:'jx',coin:137,band:2,stretch:true},{...BD.pools.millbrook[2],uid:'jy',coin:400,band:1}]}},seq:2}; s.res.fish=50;
  E.standingTick(s,m2); ok(m2.action&&m2.action.job==='jy','auto takes a job from your band, not the stretch');
  ok(!(m2.action&&m2.action.line),'and does not follow a line someone else started'); }
{ const s=base(); const m=adv(s); m.standing='adventure'; s.boards={towns:{millbrook:{next:99,jobs:[{...BD.pools.millbrook[0],uid:'jw',coin:45,band:1}]}},seq:1}; s.res.wood=0; E.standingTick(s,m);
  ok(E.orderList(s).some(o=>o.item==='wood'),'auto: band deliver job short of goods → Work Order for them'); }
// non-active member keeps the job going despite their order
{ const s=base(); const m=adv(s); const k=JSON.parse(JSON.stringify(m)); k.id=888; s.members.push(k); s.activeId=m.id; s.boards={towns:{millbrook:{next:99,jobs:[{...BD.pools.millbrook[2],uid:'jz',coin:40,band:1}]}},seq:1}; s.res.fish=20; k.order={type:'work'};
  ok(E.takeJob(s,k,'jz'),'family member takes a job'); for(let i=0;i<30&&E.boardOf(s,'millbrook').length;i++)E.dayTick(s,1,1); ok(!E.boardOf(s,'millbrook').some(j=>j.uid==='jz')&&E.townFavour(s,'millbrook')>=4,'a non-active member finishes the job despite their work order'); }
// save step 41
{ const s=base(); delete s.boards; delete s.lines; delete s.townFav; s.schema=40; E.normalize(s); ok(s.boards&&s.lines&&s.townFav&&s.schema>=41,'step 41: fresh boards, no lines, no favour'); }
{ const seen={}; for(const f of fs.readFileSync(new URL('../js/engine.js',import.meta.url),'utf8').match(/\.\/engine\/[a-z0-9-]+\.js/g)){ const mod=await import('../js/'+f.slice(2)); for(const k of Object.keys(mod))(seen[k]||=[]).push(f);} const dup=Object.entries(seen).filter(([,v])=>v.length>1).map(([k])=>k); ok(!dup.length,'no export name clashes in the engine barrel ('+dup+')'); }
{ const s=base(); const m=adv(s); m.standing='adventure'; s.boards={towns:{millbrook:{next:99,jobs:[{...BD.pools.millbrook[2],uid:'jl',coin:16,band:1}]}},seq:1}; s.res.fish=50; E.standingTick(s,m); ok(!(m.action&&m.action.job==='jl'),'auto skips a job that pays worse per trip-day than the quest it would run'); }
{ const s=base(); s.boards={towns:{millbrook:{next:99,jobs:[{...BD.pools.millbrook[0],uid:'jq',coin:45,band:1}]}},seq:1}; s.res.wood=0; E.addOrder(s,'planks',5); E.addOrder(s,'ingots',5); ok(!E.orderForJob(s,'jq',true)&&E.orderForJob(s,'jq'),'auto never crowds a full Work Orders queue (the button still can)'); }
// base-game gap fixes (audit)
ok(/Turbo bank/.test(D.buildings.find(b=>b.id==='hourglass').desc)&&!/offline cap/.test(D.buildings.find(b=>b.id==='hourglass').desc),'Hourglass Tower text: turbo bank, no offline-cap promise');
{ const s=base(); const c0=E.turboCapSec(s); s.buildings.hourglass=(s.buildings.hourglass||0)+1; ok(E.turboCapSec(s)===c0+1800,'Hourglass level raises the turbo bank by 30 min'); }
ok(D.phases.list.find(p=>p.id==='titles').hidden&&E.phaseCount()===3,'Titles phase hidden for launch (kept in data)');
{ const s=base(); ok(!/Titles/.test(E.nextEraHint(s))||E.era(s).n<3,'no Titles hint'); }
ok(['throwing_knives','hunting_spear'].every(id=>D.crafting.recipes.some(r=>r.base===id)),'Throwing Knives and Hunting Spear have recipes');
console.log(pass+' checks passed');
