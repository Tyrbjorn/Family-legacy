import fs from 'fs'; import * as E from '../js/engine.js';
const L=n=>JSON.parse(fs.readFileSync(new URL('../data/'+n+'.json',import.meta.url)));
const D={};for(const n of ['skills','classes','traits','buildings','furniture','items','quests','regions','tuning','nodes','towns','minions','guilds','jobs','activities','estate','crafting','map','dungeons','legacy','chronicle','achievements','events','encounters','seasons','tutorial','notify','marriage','phases','intros','gear','paths','world','metals'])D[n]=L(n);
for(const f of D.estate.structureFiles)D['structures/'+f]=L('structures/'+f);
E.setData(D); let seed=7; E.setRng(()=>{seed=(seed*16807)%2147483647;return seed/2147483647;});
let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const s=E.newGame(1_700_000_000_000); const f=E.active(s); E.revealAt(s,'thornwick',135); // R30: Thornwick is found by walking there
// teens
const rats=D.quests.find(q=>q.id==='rats'), wolves=D.quests.find(q=>q.id==='wolves'), goblins=D.quests.find(q=>q.id==='goblins');
f.ageDays=15*D.tuning.daysPerYear; ok(E.isTeen(f)&&E.canQuest(f,rats),'teen can do rats');
ok(E.canQuest(f,wolves),'teen can hunt wolves'); ok(!E.canQuest(f,goblins),'teen blocked from dungeon-type fight');
ok(D.tuning.adultAge===18&&!E.isAdult({ageDays:17*D.tuning.daysPerYear})&&E.isTeen({ageDays:17*D.tuning.daysPerYear}),'adult at 18, 17 is a teen');
{ const hard=D.quests.find(q=>q.risk==='risky'&&q.cp>15&&q.type!=='dungeon'&&(q.skill==='hunting'||q.skill==='swordsmanship'));
  ok(hard&&!E.canQuest(f,hard,s),'teen blocked from harder fight when injury chance is high: '+hard.id+' '+E.teenInjuryChance(s,f,hard).toFixed(2));
  const st=JSON.parse(JSON.stringify(f.stats));for(const k in f.stats)f.stats[k]=999;for(const k in f.skills)f.skills[k].lvl=99;
  ok(E.teenInjuryChance(s,f,hard)<0.1&&E.canQuest(f,hard,s),'strong teen allowed when injury chance < 10%');
  f.stats=st;for(const k in f.skills)f.skills[k].lvl=0; }
ok(!D.quests.filter(q=>q.risk==='deadly').some(q=>E.canQuest(f,q)),'teen never on deadly');
f.ageDays=10*D.tuning.daysPerYear; ok(!E.canQuest(f,rats),'child cannot quest');
f.ageDays=20*D.tuning.daysPerYear;
// trade
E.normalize(s); ok(s.trade&&Array.isArray(s.trade.routes),'trade state');
ok(E.routeSlots(s)===0&&!E.addRoute(s,'millbrook','sell','wood'),'no routes without a Warehouse');
s.res.coin=1e5;s.res.planks=500;s.res.stone=500;s.res.blocks=500;s.res.ingots=50;['plot','acre','meadow'].forEach(l=>E.buyLand(s,l));
const st=E.buildStructure(s,'warehouse'); ok(st&&E.tradeTier(s)===1&&E.routeSlots(s)===1,'warehouse = 1 slot');
ok(E.upgradeStructure(s,st.uid)&&E.routeSlots(s)===2,'trading post = 2');
ok(E.upgradeStructure(s,st.uid)&&E.routeSlots(s)===3,'counting house = 3');
const p0=E.townSellPrice(s,'millbrook','wood'); E.shiftSupply(s,'millbrook','wood',200); ok(E.townSellPrice(s,'millbrook','wood')<p0,'glut lowers price');
for(let i=0;i<120;i++) E.tradeDay(s); ok(Math.abs(E.townSellPrice(s,'millbrook','wood')-p0)<0.05,'supply recovers');
const b0=E.townBuyPrice(s,'millbrook','salt'); E.buyRes(s,'millbrook','salt',100); ok(E.townBuyPrice(s,'millbrook','salt')>b0,'buying raises price');
// no same-town arbitrage
for(const t of D.towns) for(const k of t.market||[]) ok(E.townBuyPrice(s,t.id,k)>E.townSellPrice(s,t.id,k)*0.99||!t.prices[k],'no arbitrage '+t.id+' '+k);
// a route runs
s.minions=s.minions||[]; const mk=(type)=>{const mi={uid:'mi'+s.nextId++,type,equip:{},name:'T',job:'idle',loyalty:100,cls:'n_peasant'};s.minions.push(mi);return mi;}; const d=mk('laborer'), g=mk('guard');
const r=E.addRoute(s,'millbrook','sell','wood'); ok(r,'add route');
ok(E.setCrew(s,r.id,'driver',d.uid)&&E.setCrew(s,r.id,'guard',g.uid)&&d.job==='trade','crew set');
s.res.wood=400; const c0=s.res.coin; let robbed=0;
for(let i=0;i<60;i++) E.tradeDay(s);
ok(r.trips>0&&(s.res.coin>c0||r.robbed||r.won!=null),'route made trips: '+r.trips+' robbed '+(r.robbed||0));
ok(s.res.wood>=r.keep,'keeps reserve');
ok(E.banditChance(s,r)<D.tuning.trade.banditBase,'guard lowers bandit chance');
const rb=E.addRoute(s,'millbrook','buy','salt'); s.res.salt=0; E.setCrew(s,rb.id,'driver',mk('laborer').uid);
for(let i=0;i<30;i++) E.tradeDay(s); ok(rb.trips>0,'buy route ran');
ok(E.removeRoute(s,r.id)&&d.job==='idle','remove frees crew');
// town specialties
for(const tw of D.towns){ok(tw.produces.length&&tw.produces.length<=2&&tw.wants.length&&tw.wants.length<=2,'specialties '+tw.id);
 for(const k of tw.produces) ok(E.marketOf(tw.id).includes(k)&&E.townSupply(s,tw.id,k)>1,'produce sold & plentiful '+tw.id+' '+k);
 for(const k of tw.wants) ok(E.townSupply(s,tw.id,k)<1,'want scarce '+tw.id+' '+k);}
{ const m=D.towns.find(x=>x.id==='millbrook'); const other=D.towns.find(x=>x.id==='thornwick');
  ok(E.townSellPrice(s,'millbrook','ingots')>E.townSellPrice(s,'thornwick','ingots')*1.2||m.prices.ingots!==other.prices.ingots,'wanted goods sell higher'); }
// town-to-town haul + patrols + fights
s.discovered=[...(s.discovered||[]),...D.towns.map(x=>x.id)];
s.trade.routes.forEach(x=>E.removeRoute(s,x.id));
const h=E.addRoute(s,'millbrook','haul','hides','thornwick'); ok(h&&h.from==='thornwick','haul route');
ok(!E.addRoute(s,'millbrook','haul','gems','millbrook'),'haul needs two towns');
ok(E.legDays('thornwick','millbrook')>0&&E.cargoLegs(h).length===2,'legs');
const hd=mk('laborer'); E.setCrew(s,h.id,'driver',hd.uid); h.margin=0; s.res.coin=1e5;
const coinH=s.res.coin; for(let i=0;i<40;i++) E.tradeDay(s); ok(h.trips>0,'haul ran '+h.trips+' coin '+(s.res.coin-coinH));
const risk0=E.banditChance(s,h); const P=E.addPatrol(s,'thornwick','millbrook'); ok(P&&!E.addPatrol(s,'millbrook','thornwick'),'one patrol per road');
const pg=mk('guard'); ok(E.setPatrol(s,P.id,pg.uid)&&pg.job==='patrol','patrol member'); ok(E.banditChance(s,h)<risk0,'patrol lowers risk');
ok(E.removePatrol(s,P.id)&&pg.job==='idle','patrol removed');
// fights: lose with no guards -> crew none, goods lost; with strong guards -> mostly win
{ const g2=mk('guard'), e2=mk('guard'); e2.cls='n_horseman'; E.setCrew(s,h.id,'guard',g2.uid); E.setCrew(s,h.id,'escort',e2.uid);
  ok(E.winChance(s,h)>0&&E.winChance(s,h)<1,'win chance');
  D.tuning.trade.banditBase=1; D.tuning.trade.banditStrength=1e9; const n0=s.minions.length; h.trip=null; h.margin=-1; const rb0=h.robbed||0;
  for(let i=0;i<300&&(h.robbed||0)===rb0;i++) E.tradeDay(s);
  ok(h.robbed>rb0&&!h.guard&&!h.escorts.length,'loss: guards fled or died '+JSON.stringify({rb:h.robbed,g:h.guard,e:h.escorts,t:h.trips,w:h.won}));
  ok(s.minions.length<=n0,'some may die');
  D.tuning.trade.banditStrength=1e-9; const g3=mk('guard'); E.setCrew(s,h.id,'guard',g3.uid); const w0=h.won||0; for(let i=0;i<40&&(h.won||0)===w0;i++) E.tradeDay(s);
  ok((h.won||0)>w0&&h.guard===g3.uid,'win: cart continues, guard stays');
  D.tuning.trade.banditBase=0.12; D.tuning.trade.banditStrength=3; }
const ser=E.deserialize(E.serialize(s,1_700_000_000_000)); ok(ser.trade.routes.length===s.trade.routes.length,'save roundtrip');
console.log(pass+' trade checks passed');
