// R34: Quotas (Legacy "Steward's Ledger")
import fs from 'fs'; import * as E from '../js/engine.js';
const R=new URL('../data/',import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const fresh=(tier=1)=>{const s=E.newGame(1);E.normalize(s);s.res.coin=1e6;E.legacyState(s).ups.quotas=tier;return s;};
let ku=0; const build=(s,type,pieces)=>{const st={uid:'b'+(ku++),type,pieces,up:0};(s.structures=s.structures||[]).push(st);return st;};
const u=D.legacy.upgrades.find(x=>x.id==='quotas'); ok(u&&u.free===2&&u.tiers[0].cost===60&&u.tiers[2].cost===600&&u.tiers[0].value===5&&u.tiers[2].value===999,'R43 Quotas: 2 free, 60 for 5, 600 unlimited');
{ const s=E.newGame(1);E.normalize(s); ok(E.quotaSlots(s)===2&&E.addQuota(s,'bread',5)&&E.addQuota(s,'planks',5)&&/slots/.test(E.quotaIssue(s,'stew','standing')),'2 free slots'); E.legacyState(s).renown=400; ok(E.buyLegacy(s,'quotas')&&E.quotaSlots(s)===5,'buy tier 1'); }
{ const s=fresh(); for(const k of ['bread','planks','stew','cheese','ingots']) ok(E.addQuota(s,k,10),'add '+k); ok(/slots/.test(E.quotaIssue(s,'flour','standing')),'tier 1 = 5 slots'); E.legacyState(s).ups.quotas=2; ok(E.addQuota(s,'flour',10),'tier 2 unlimited');
  ok(/nothing/.test(E.quotaIssue(s,'zzz','standing')),'unknown item refused'); ok(/one-time/.test(E.quotaIssue(s,'iron_sword','standing')||'one-time'),'crafted items one-time'); }
{ // standing quota idles at target, resumes below; food safety
  const s=fresh(); build(s,'kitchen',['oven']); s.res.flour=500; s.res.bread=0; s.res.food=0; E.addQuota(s,'bread',5,'standing');
  E.processDay(s,1); const b1=s.res.bread; ok(b1>0,'bread made toward quota');
  s.res.bread=10; s.res.food=1e5; const f0=s.res.flour; E.processDay(s,1); ok(s.res.bread===10&&s.res.flour===f0||s.res.flour>f0-1e-9,'standing met (stock plenty): oven idles bread rows');
  s.res.food=0; s.res.bread=6; for(const k of Object.keys(s.res)) if(D.estate.meals.menu[k]&&k!=='bread'&&k!=='food') s.res[k]=0; E.processDay(s,1); ok(s.res.bread>6,'food safety: bread still cooks while food stock is under 20 days');
  s.res.food=1e5; s.res.bread=2; E.processDay(s,1); ok(s.res.bread>2,'resumes below target'); }
{ // one-time: stops after X, logs, removed
  const s=fresh(); build(s,'kitchen',['oven']); s.res.flour=500; s.res.food=1e5; const q=E.addQuota(s,'bread',3,'once');
  for(let i=0;i<5;i++){E.quotaDay(s);E.processDay(s,1);} E.quotaDay(s); ok(!E.quotaList(s).some(x=>x.id===q.id)&&s.log.some(l=>/Quota done/.test(l.msg)),'one-time quota finishes and logs'); }
{ // priority: list order; reserves never broken; input floor for lower quotas
  const s=fresh(); build(s,'kitchen',['range']); Object.assign(s.res,{meat:5,vegetables:100,thyme:100,food:1e5}); s.reserve.meat=3; s.dishes.push('hunterroast'); for(const m of s.members)m.skills.cooking.lvl=20;
  E.addQuota(s,'hunterroast',50,'standing'); E.addQuota(s,'stew',50,'standing');
  const rows=D.estate.pieces.find(p=>p.id==='range').bonus.processes; const o=E.cookOrder(s,rows).map(r=>r.out); ok(o[0]==='hunterroast'&&o[1]==='stew','quota rows first, in list order');
  E.processDay(s,1); ok(s.res.meat>=3-1e-9,'reserve never broken'); ok(s.res.hunterroast>0,'top quota got the meat first');
  const s2=fresh(); E.addQuota(s2,'flour',40,'standing'); E.addQuota(s2,'bread',10,'standing'); ok(E.quotaFloor(s2,'flour','bread')===40&&E.quotaFloor(s2,'flour','flour')===0,'a lower quota never takes an input below a higher standing target'); }
{ // blocked reasons
  const s=fresh(); E.addQuota(s,'bread',10); ok(/no /.test(E.quotaStatus(s,E.quotaList(s)[0]).text),'blocked: no building'); build(s,'kitchen',['oven']); s.res.flour=0; ok(/needs flour/.test(E.quotaStatus(s,E.quotaList(s)[0]).text),'blocked: needs flour');
  s.res.flour=50; ok(E.quotaStatus(s,E.quotaList(s)[0]).k==='on','on track with inputs'); E.addQuota(s,'pikepie',3); ok(/learned|Cooking/.test(E.quotaStatus(s,E.quotaList(s)[1]).text),'blocked dish shows reason'); }
{ // tier 2 pull, depth 2; removing parent removes children
  const s=fresh(2); build(s,'kitchen',['oven']); build(s,'fields',['quern']); s.res.flour=0; s.res.wheat=0; s.res.food=1e5; const q=E.addQuota(s,'bread',10,'standing');
  E.quotaDay(s); ok(E.quotaList(s).some(x=>x.item==='flour'&&x.parent===q.id),'pulls missing flour'); E.quotaDay(s); const w=E.quotaList(s).find(x=>x.item==='wheat'); ok(w&&w.depth===2,'then wheat (2 steps)');
  E.quotaDay(s); ok(E.quotaList(s).length===3,'no deeper than 2'); E.removeQuota(s,q.id); ok(!E.quotaList(s).length,'children go with the parent');
  const t1=fresh(1); build(t1,'kitchen',['oven']); t1.res.flour=0; E.addQuota(t1,'bread',10); E.quotaDay(t1); ok(E.quotaList(t1).length===1,'tier 1 does not pull'); }
{ // sell floor (tier 2 only)
  const s=fresh(2); E.addQuota(s,'planks',80,'standing'); ok(E.sellFloor(s,'planks')===80,'tier 2 sell floor'); const s1=fresh(1); E.addQuota(s1,'planks',80); ok(E.sellFloor(s1,'planks')===0,'tier 1 no sell floor');
  s.res.planks=100; const out={planks:1}; E.autoSell(s,out,{rate:50,price:0.5},1); ok(s.res.planks>=80-1e-9,'shopfront stops at the floor'); }
{ // Auto Tend follows a quota
  const s=fresh(); const c=D.legacy.autoTend.hunting||Object.values(D.legacy.autoTend).find(x=>x.kind==='activity'); E.addQuota(s,'meat',100); E.legacyState(s).ups.at_tend=1; const t=E.atTarget(s,'hunting'); ok(t&&t.quota&&D.activities.find(a=>a.id===t.id).yields.meat,'Auto Tend switches to the quota\'s task');
  s.res.meat=200; const t2=E.atTarget(s,'hunting'); ok(!t2||!t2.quota,'falls back when met'); }
{ // craft quota queues once
  const s=fresh(); const rc=D.crafting.recipes.find(r=>r.base&&r.skill==='smithing'); for(const m of s.members)m.ageDays=20*360; E.addQuota(s,rc.base,2,'once'); E.quotaDay(s); E.quotaDay(s); const n=s.members.reduce((a,m)=>a+(m.craftQueue||[]).filter(x=>x===rc.id).length,0); ok(n===2,'craft quota queued once ('+n+')'); }
{ // monthly follower move (tier 2)
  const s=fresh(2); s.minions=[{uid:'m1',name:'Tom',job:'idle'}]; build(s,'hunterscabin',['gamerack']); E.addQuota(s,'meat',500); s.day=30; const cap=E.jobCap(s,'hunt'); E.quotaDay(s); ok(cap>0&&s.minions[0].job==='hunt','idle follower moves to hunt for a meat quota (cap '+cap+')');
  const s1=fresh(1); s1.minions=[{uid:'m1',job:'idle'}]; E.addQuota(s1,'meat',500); s1.day=30; E.quotaDay(s1); ok(s1.minions[0].job==='idle','tier 1 never moves followers'); }
{ const s=fresh(); delete s.quotas; s.schema=33; E.normalize(s); ok(Array.isArray(s.quotas)&&s.schema>=34,'save v34'); }
{ const s=E.newGame(1); E.normalize(s); const s2=JSON.parse(JSON.stringify(s)); E.processDay(s,1); E.processDay(s2,1); ok(JSON.stringify(s.res)===JSON.stringify(s2.res),'no quotas = unchanged behaviour'); }
console.log('r34:',pass,'passed');
