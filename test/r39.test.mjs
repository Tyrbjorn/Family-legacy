// R39: base-game supply & demand made visible (price tags, town tags, Market Board, shortage/glut events)
import fs from 'fs'; import * as E from '../js/engine.js'; import { T } from '../js/engine/state.js';
const R=new URL('../data/',import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const game=()=>{const s=E.newGame(1);E.normalize(s);s.wevents=[];return s;};
const tw=id=>D.towns.find(t=>t.id===id);
// data
const sh=E.eventType('shortage'), gl=E.eventType('glut');
ok(sh&&gl&&sh.scope==='town'&&gl.scope==='town','shortage + glut event types exist');
ok(sh.effects.resPrice===1.5&&gl.effects.resPrice===0.6&&sh.days[0]===10&&sh.days[1]===20&&gl.days[1]===20,'x1.5 / x0.6, 10-20 days');
ok(D.events.chancePerDay===0.03&&D.events.maxActive===3,'shared event chance unchanged');
ok(T.market.highAt===1.15&&T.market.lowAt===0.85,'thresholds 115% / 85%');
// tags at rest: made goods cheap, wanted goods dear, others normal
{ const s=game();
  ok(E.priceTag(s,'ashford','planks').level==='high'&&/want/.test(E.priceTag(s,'ashford','planks').tip),'wanted good ▲ with plain tip');
  ok(E.priceTag(s,'millbrook','wheat').level==='low'&&/makes/.test(E.priceTag(s,'millbrook','wheat').tip),'made good ▼ with plain tip');
  const plain=Object.keys(tw('millbrook').prices).find(k=>!tw('millbrook').produces.includes(k)&&!tw('millbrook').wants.includes(k));
  ok(E.priceTag(s,'millbrook',plain).level==='normal'&&E.priceTag(s,'millbrook',plain).arrow==='','ordinary good: no arrow');
  // flooding by selling
  s.res[plain]=500; E.sellRes(s,'millbrook',plain,200);
  const t=E.priceTag(s,'millbrook',plain); ok(t.level==='low'&&/Flooded/.test(t.tip)&&/recovers in ~\d+ days/.test(t.tip),'selling a lot floods the town: ▼ + recover hint');
  ok(E.townTags(s,'millbrook').flooded.some(x=>x.res===plain),'flooded good in town tags');
  for(let i=0;i<120;i++)E.tradeDay(s); ok(E.priceTag(s,'millbrook',plain).level==='normal','price drifts back to normal');
  const tg=E.townTags(s,'ashford'); ok(tg.short.length<=3&&tg.flooded.length<=3,'max 3 tags each');
}
// tag matches actual sell price movement
{ const s=game(); const p0=E.townSellPrice(s,'thornwick','salt'); E.startEvent(s,'shortage','thornwick',15,'salt');
  const p1=E.townSellPrice(s,'thornwick','salt'); ok(Math.abs(p1/p0-1.5)<0.02,'shortage: sell price x1.5');
  ok(E.priceTag(s,'thornwick','salt').level==='high'&&/short of salt/.test(E.priceTag(s,'thornwick','salt').tip),'shortage tip');
  ok(E.townTags(s,'thornwick').short[0].res==='salt','shortage good tops "Short of"');
  ok(E.eventText(s.wevents[0]).includes('salt')&&E.eventText(s.wevents[0]).includes('Thornwick'),'event text names town and good');
  const other=E.townSellPrice(s,'thornwick','ale'), oth2=E.townSellPrice(s,'ashford','salt'); s.wevents=[]; ok(other===E.townSellPrice(s,'thornwick','ale')&&oth2===E.townSellPrice(s,'ashford','salt'),'only that good in that town');
  E.startEvent(s,'glut','ashford',12,'flour'); const g=E.priceTag(s,'ashford','flour'); ok(g.level==='low'&&/flooded with flour/.test(g.tip),'glut ▼ + tip');
  const b0=(()=>{const x=game();return E.townBuyPrice(x,'ashford','flour');})(); ok(E.townBuyPrice(s,'ashford','flour')>=b0,'glut never makes buying cheaper (no resale arbitrage)');
  s.day+=13; E.eventsDay(s); ok(!s.wevents.length&&E.priceTag(s,'ashford','flour').level==='low'&&!/flooded with/.test(E.priceTag(s,'ashford','flour').tip),'event expires');
}
// random spawning: picks right goods, one market event per town, never above maxActive
{ const s=game(); const ch=D.events.chancePerDay; D.events.chancePerDay=1; let seen={shortage:0,glut:0}, bad=0;
  for(let d=0;d<3000;d++){ s.day++; E.eventsDay(s);
    const act=E.activeEvents(s); if(act.length>3)bad++;
    for(const t of D.towns){ const m=act.filter(e=>e.place===t.id&&(e.type==='shortage'||e.type==='glut')); if(m.length>1)bad++; }
    for(const e of act){ if(e.type==='shortage'){ if(!tw(e.place).wants.includes(e.res))bad++; } if(e.type==='glut'&&!tw(e.place).produces.includes(e.res))bad++; if((e.type==='shortage'||e.type==='glut')&&e.from===s.day)seen[e.type]++; } }
  D.events.chancePerDay=ch; ok(!bad,'spawn rules hold over 3000 days'); ok(seen.shortage>5&&seen.glut>5,'both events occur'); }
// Market Board
{ const s=game(); s.res.wheat=50; s.res.ingots=5;
  const b=E.marketBoard(s), known=E.knownTowns(s).map(t=>t.id);
  ok(b.sell.every(r=>known.includes(r.town))&&b.buy.every(r=>known.includes(r.town)),'board uses discovered towns only');
  const w=b.sell.find(r=>r.res==='wheat'); ok(w&&w.price===Math.max(...known.filter(id=>tw(id).prices.wheat).map(id=>E.townSellPrice(s,id,'wheat'))),'best sell town picked');
  ok(b.sell.every((r,i)=>!i||b.sell[i-1].value>=r.value),'sell rows sorted by total value');
  ok(b.buy.every(r=>r.price===Math.min(...known.filter(id=>E.marketOf(id).includes(r.res)&&tw(id).prices[r.res]).map(id=>E.townBuyPrice(s,id,r.res)))),'cheapest buy town picked');
  ok(!b.sell.some(r=>r.res==='coin'||r.res==='food'),'no coin/food rows'); ok(b.rows===8,'8 rows before show all');
  s.discovered=[]; const hid=D.towns.filter(t=>!E.knownTowns(s).includes(t)).map(t=>t.id); ok(E.marketBoard(s).sell.every(r=>!hid.includes(r.town)),'undiscovered towns excluded'); }
// no save bump: event with res round-trips; old events without res still work
{ const s=game(); E.startEvent(s,'shortage','eyrie',10,'cloth'); s.wevents.push({type:'badharvest',scope:'town',place:'millbrook',from:s.day,until:s.day+20});
  const l=E.deserialize(E.serialize(s)); ok(l.wevents[0].res==='cloth'&&E.priceTag(l,'eyrie','cloth').level==='high','res survives save/load');
  ok(E.priceMult(l,'millbrook','food')===1.8,'old-style events unaffected'); }
console.log('r39 ok',pass);
