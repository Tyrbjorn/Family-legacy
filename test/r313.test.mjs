// R31.3: themed vehicle drops only from specific quests (5%), Bandit Keep gives a wagon on first clear only
import fs from 'fs'; import * as E from '../js/engine.js';
const R=new URL('../data/',import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const V={caravan:'handcart',hq_corran_ore:'handcart',hq_marlowe_cargo:'wagon',b_smugglers:'smallboat'}, VEH=['handcart','wagon','smallboat'];
const fresh=()=>{const s=E.newGame(1);E.normalize(s);return s;};
for(const [qid,it] of Object.entries(V)){ const q=D.quests.find(x=>x.id===qid), s=fresh(); s.vault=[]; let n=0;
  for(let i=0;i<2000;i++){ E.rollRare(s,q,null); n+=s.vault.filter(x=>x===it).length; s.vault=[]; }
  ok(n>40&&n<180,`${qid} drops a ${it} about 5% (${n}/2000)`); }
const others=D.quests.filter(q=>!V[q.id]);
ok(others.every(q=>!(q.rare||[]).some(d=>VEH.includes(d.id))),'no other quest has a vehicle rare drop');
{ const s=fresh(); let hit=0; for(const q of others) for(let i=0;i<200;i++){ s.vault=[]; E.rollRare(s,q,null); const id=E.rollLoot(q,0.5,5); if(VEH.includes(id)||s.vault.some(x=>VEH.includes(x))) hit++; } ok(hit===0,'other quests never drop vehicles (random loot exclusion kept)'); }
ok(D.items.filter(i=>VEH.includes(i.id)).every(i=>i.noDrop),'global random-loot exclusion still in place');
{ const q=D.quests.find(x=>x.id==='g_vanguard_siege'); ok(q.firstGrants.item==='wagon','Bandit Keep first-clear reward = wagon');
  const s=fresh(), m=E.active(s); m.ageDays=30*360; for(const k in m.skills)m.skills[k].lvl=40; for(const k in m.stats)m.stats[k]+=40;
  const first=!s.doneQuests.includes(q.id); const g1=first&&q.firstGrants?E.grantRewards(s,m,{...q,grants:q.firstGrants}):[]; s.doneQuests.push(q.id);
  ok(g1.length===1&&s.vault.filter(x=>x==='wagon').length===1,'first clear gives one wagon');
  const again=!s.doneQuests.includes(q.id); ok(!again,'repeat clears are not first clears (no second wagon)'); }
{ const q=D.quests.find(x=>x.id==='g_vanguard_siege'), s=fresh(), m=E.active(s); m.ageDays=30*360; for(const k in m.skills)m.skills[k].lvl=60; for(const k in m.stats)m.stats[k]+=80; s.vault=[];
  for(let i=0;i<20&&s.doneQuests.filter(x=>x===q.id).length===0;i++) E.resolveQuest(s,m,q,1);
  const w1=s.vault.filter(x=>x==='wagon').length; for(let i=0;i<5;i++) E.resolveQuest(s,m,q,1);
  ok(s.doneQuests.includes(q.id)&&w1===1&&s.vault.filter(x=>x==='wagon').length===1,'resolveQuest: wagon on the first clear only'); }
{ const q=D.quests.find(x=>x.id==='q_river'); ok(q.grants.item==='smallboat'&&!(q.rare||[]).some(d=>d.id==='smallboat'),'River: small boat is a guaranteed reward');
  const s=fresh(), m=E.active(s); m.ageDays=25*360; for(const k in m.skills)m.skills[k].lvl=40; s.vault=[];
  for(let i=0;i<20&&!s.doneQuests.includes('q_river');i++) E.resolveQuest(s,m,q,1);
  ok(s.vault.includes('smallboat')&&s.log.some(l=>/deep water/.test(l.msg)&&/💡/.test(l.msg)),'clearing the River gives the boat and the boat tip');
  ok(/deep water/.test(q.tip)&&/lakes/.test(q.tip),'tip claims the real effects (deep-water fishing + lake crossings)'); }
console.log('r313:',pass,'passed');
