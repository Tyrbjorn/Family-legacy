import fs from 'fs'; import * as E from '../js/engine.js';
const L=n=>JSON.parse(fs.readFileSync(new URL('../data/'+n+'.json',import.meta.url)));
const D={};for(const n of ['skills','classes','traits','buildings','furniture','items','quests','regions','tuning','nodes','towns','minions','guilds','jobs','activities','estate','crafting','map','dungeons','legacy','chronicle','achievements','events','encounters','seasons','tutorial','notify','marriage','phases','intros','gear','paths','world'])D[n]=L(n);
E.setData(D); let seed=7; E.setRng(()=>{seed=(seed*16807)%2147483647;return seed/2147483647;});
let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const s=E.newGame(1_700_000_000_000); const f=E.active(s);
// teens
const rats=D.quests.find(q=>q.id==='rats'), wolves=D.quests.find(q=>q.id==='wolves'), goblins=D.quests.find(q=>q.id==='goblins');
f.ageDays=15*D.tuning.daysPerYear; ok(E.isTeen(f)&&E.canQuest(f,rats),'teen can do rats');
ok(E.canQuest(f,wolves),'teen can hunt wolves'); ok(!E.canQuest(f,goblins),'teen blocked from dungeon-type fight');
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
ok(r.trips>0&&(s.res.coin>c0||r.robbed),'route made trips: '+r.trips+' robbed '+(r.robbed||0));
ok(s.res.wood>=r.keep,'keeps reserve');
ok(E.banditChance(s,r)<D.tuning.trade.banditBase,'guard lowers bandit chance');
const rb=E.addRoute(s,'millbrook','buy','salt'); s.res.salt=0; E.setCrew(s,rb.id,'driver',mk('laborer').uid);
for(let i=0;i<30;i++) E.tradeDay(s); ok(rb.trips>0,'buy route ran');
ok(E.removeRoute(s,r.id)&&d.job==='idle','remove frees crew');
const ser=E.deserialize(E.serialize(s,1_700_000_000_000)); ok(ser.trade.routes.length===s.trade.routes.length,'save roundtrip');
console.log(pass+' trade checks passed');
