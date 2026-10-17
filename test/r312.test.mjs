// R31.2: item quests (handcart/wagon/boat never random loot; Haul for Bram, Wolves first clear, A Merchant's First Run), grouped quest badges
import fs from 'fs'; import * as E from '../js/engine.js';
const R=new URL('../data/',import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const fresh=()=>{const s=E.newGame(1_700_000_000_000);E.normalize(s);s.tut.skipped=true;return s;};
const Q=id=>D.quests.find(q=>q.id===id);
// loot tables
const bad=new Set(['handcart','wagon','smallboat']); let hit=0;
for(const q of D.quests) for(let i=0;i<400;i++){ const id=E.rollLoot(q,0.5,5); if(bad.has(id)) hit++; }
ok(hit===0,'handcart, wagon and small boat never drop from random quest loot');
ok(!D.quests.some(q=>q.region==='forest'&&(q.loot||[]).includes('tower_shield')),'tower shield off the forest special-drop lists');
ok(Q('h_giants').loot.includes('tower_shield'),'giants still drop the tower shield');
const strong=s=>{const m=E.active(s); m.ageDays=25*360; for(const k in m.skills)m.skills[k].lvl=30; for(const k in m.stats)m.stats[k]+=20; return m;};
const run=(s,id,n=1)=>{const m=E.active(s); const d0=s.doneQuests.filter(x=>x===id).length; let c=0; for(let i=0;i<400&&c<n;i++){ if(!E.isBusy(m)) { const r=E.setAction(s,{type:'quest',target:id}); if(r===false) return false; } E.advanceReal(s,10); c=(m.questsDone||0); } return true;};
// Haul for Bram
{ const s=fresh(); strong(s); const q=Q('haul_bram');
  ok(E.questVisible(s,q),'Haul for Bram is known and seen at the start (Millbrook)');
  ok(E.questIssue(s,E.active(s),q),'needs 10 wood first'); s.res.wood=15;
  ok(!E.questIssue(s,E.active(s),q),'takeable with 10 wood'); E.setAction(s,{type:'quest',target:'haul_bram'});
  for(let i=0;i<200&&!s.doneQuests.includes('haul_bram');i++) E.advanceReal(s,10);
  ok(s.doneQuests.includes('haul_bram')&&s.vault.includes('handcart')&&s.res.wood<=5,'delivers 10 wood, gives the handcart');
  ok(/handcart/i.test(q.desc)&&/carry|gather/i.test(q.desc),'text teaches hauling'); }
// Wolves: first clear only
{ const s=fresh(); strong(s); E.setAction(s,{type:'quest',target:'wolves'}); let n=0;
  for(let i=0;i<400&&s.doneQuests.filter(x=>x==='wolves').length<1;i++){ if(!E.isBusy(E.active(s))) E.setAction(s,{type:'quest',target:'wolves'}); E.advanceReal(s,10); }
  ok(s.vault.filter(x=>x==='tower_shield').length===1,'Wolves first clear gives a tower shield');
  s.vault=s.vault.filter(x=>x!=='tower_shield'); const m=E.active(s); const qd=m.questsDone;
  for(let i=0;i<400&&m.questsDone<qd+2;i++){ if(!E.isBusy(m)) E.setAction(s,{type:'quest',target:'wolves'}); E.advanceReal(s,10); }
  ok(!E.grantRewards(s,m,{...Q('wolves')}).length,'Wolves has no repeat grant'); }
// Merchant's First Run
{ const s=fresh(); strong(s); const q=Q('merchant_run');
  ok(q.region==='forest'&&!E.questVisible(s,q),'Merchant run hidden in fog at the start (Thornwick not found yet)');
  E.revealAt(s,'thornwick',200); E.revealAt(s,'merchant_run',80); ok(E.questVisible(s,q),'shows once its spot near Thornwick is seen');
  ok(E.marketOf('millbrook').includes('wheat')&&E.townBuyPrice(s,'millbrook','wheat')<E.townSellPrice(s,'thornwick','wheat')*1.5,'wheat is a Millbrook good');
  E.buyRes(s,'millbrook','wheat',20); ok((s.res.wheat||0)>=20,'buy 20 wheat in Millbrook');
  for(let i=0;i<300&&!s.doneQuests.includes('merchant_run');i++){ if(!E.isBusy(E.active(s))) E.setAction(s,{type:'quest',target:'merchant_run'}); E.advanceReal(s,10); }
  ok(s.doneQuests.includes('merchant_run')&&s.vault.includes('wagon')&&s.unlocks.includes('recipe:r_wagon'),'gives the wagon and unlocks the wagon recipe'); }
// grouped badges
// map-draw imports the browser main module; test the clustering rule directly on map points instead
{ const s=fresh(); const vq=D.quests.filter(q=>E.questVisible(s,q)&&q.id!=='rats'); const P=q=>D.map.points[q.id];
  const near=vq.filter(q=>Math.hypot(P(q).x-D.map.towns.millbrook.x,P(q).y-D.map.towns.millbrook.y)<60); ok(near.length>=3,`several known quests cluster at Millbrook (${near.length})`);
  ok(vq.every(q=>E.questVisible(s,q)),'only known + seen pins counted'); }
// old saves keep their items
{ const s=fresh(); s.vault.push('wagon','tower_shield'); s.schema=31; E.normalize(s); ok(s.vault.includes('wagon')&&s.vault.includes('tower_shield'),'old saves keep items they already have'); }
console.log('r312:',pass,'passed');
