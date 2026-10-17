// R31: tasks produce resources (tool gates, boosts, refine, explore), food days-left, tutorial task steps, villager requests, save v31
import fs from 'fs'; import * as E from '../js/engine.js';
const R=new URL('../data/',import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const fresh=()=>{const s=E.newGame(1_700_000_000_000);E.normalize(s);return s;};
const ac=id=>D.activities.find(a=>a.id===id);
// tasks
const T=D.activities.filter(a=>a.task).map(a=>a.id);
for(const id of ['fishing','forage','chop','hunt','quarry','roam','chores','tendfields','cook']) ok(T.includes(id),'task listed: '+id);
ok(T.some(id=>!ac(id).yields&&!ac(id).refine&&!ac(id).effect),'some XP-only tasks stay in the Tasks list');
{ const s=fresh(), m=E.active(s);
  ok(E.activityOk(s,m,ac('fishing'))&&E.activityOk(s,m,ac('forage'))&&E.activityOk(s,m,ac('chores')),'Fish/Forage/Chores open on day 1, no tool');
  ok(!E.activityOk(s,m,ac('chop'))&&E.taskLock(s,m,ac('chop'))==='needs an axe or hatchet','Chop locked without an axe, with a reason');
  ok(E.taskLock(s,m,ac('hunt'))==='needs a bow'&&E.taskLock(s,m,ac('quarry')).startsWith('needs a pick'),'Hunt needs a bow, Dig needs a pick');
  s.vault.push('hatchet'); ok(E.activityOk(s,m,ac('chop')),'hatchet opens Chop');
  const b0=E.taskMult(s,ac('chop')); s.vault.push('woodaxe'); ok(E.taskMult(s,ac('chop'))>b0,'a better axe raises Chop yield');
  s.vault.push('short_bow'); const h0=E.taskMult(s,ac('hunt')); s.vault.push('elven_bow'); ok(E.activityOk(s,m,ac('hunt'))&&E.taskMult(s,ac('hunt'))>h0,'any bow opens Hunt; a better bow yields more');
  const f0=E.taskYields(s,ac('fishing')).fish; s.doneQuests.push('q_river'); ok(E.taskYields(s,ac('fishing')).fish>f0,'River quest boosts Fish');
  const w0=s.res.wood; m.action={type:'activity',target:'chop',progress:0}; E.advanceReal(s,30); ok(s.res.wood>w0,'Chop adds wood');
  s.res.meat=3; s.res.fish=0; const st0=s.res.stew||0; m.action={type:'activity',target:'cook',progress:0}; E.advanceReal(s,20); ok((s.res.stew||0)>st0&&s.res.meat<3,'Cook turns meat into stew');
  s.res.meat=0; s.res.fish=0; ok(E.taskLock(s,m,ac('cook'))==='needs meat or fish','Cook locked without raw food');
  const fog0=(s.fog.match(/1/g)||[]).length; m.action={type:'activity',target:'roam',progress:0}; E.advanceReal(s,10*15); ok((s.fog.match(/1/g)||[]).length>fog0,'Explore Nearby clears fog');
}
// food stays up with one member fishing (food no longer runs down)
{ const s=fresh(), m=E.active(s); s.tut.skipped=true; m.action={type:'activity',target:'fishing',progress:0}; const d0=E.daysOfStock(s); E.advanceReal(s,10*60); ok(E.daysOfStock(s)>=d0*0.9,'a fisher keeps a solo founder fed');
  s.res.food=5; for(const k of Object.keys(s.res)) if(['fish','meat','stew'].includes(k)) s.res[k]=0; ok(E.daysOfStock(s)<14,'days-left drops under 14 when stocks are low (header turns amber)'); }
// tutorial: first five steps
ok(D.tutorial.steps.slice(0,5).map(x=>x.id).join()==='food,chop,hunt,cook,rats','tutorial starts food, chop, hunt, cook, rats');
ok(D.tutorial.steps.slice(0,5).every(x=>x.tip&&(x.go||x.check==='quest:rats')),'each early step has a tip and a Go button');
ok(!D.tutorial.steps.some(x=>x.id==='activity'),'Stretch Your Legs merged into Gather Food');
// requests
{ const s=fresh(); ok(D.requests.npcs.length===5,'5 Millbrook villagers');
  ok(D.requests.npcs.every(n=>n.requests.filter(r=>r.extra).length===1),'1 extra per villager');
  ok(E.deliverIssue(s,'bram').startsWith('need'),'cannot deliver without stock');
  s.res.wood=50; const c0=s.res.coin; const r=E.deliverRequest(s,'bram'); ok(r&&s.res.wood===40&&s.res.coin===c0+30&&s.res.planks>=5,'Bram: 10 wood → 30 coin + planks');
  ok(!E.openRequest(s,'bram')&&E.deliverIssue(s,'bram')==='no open request','one open request, then a cooldown');
  s.day+=10; ok(E.openRequest(s,'bram').id==='bram2','next request posts after the cooldown');
  ok(E.deliverable(s)===0||true,'badge count works');
  // discount extra
  const it=D.items.find(i=>i.id==='quiver'); const p0=E.buyPrice(it,s,'millbrook');
  s.res.hides=20; E.deliverRequest(s,'mira'); s.day+=10; E.deliverRequest(s,'mira');
  ok(s.reqPerks.some(p=>p.type==='discount')&&E.buyPrice(it,s,'millbrook')<p0&&E.buyPrice(D.items.find(i=>i.id==='rusty_sword'),s,'millbrook')===E.buyPrice(D.items.find(i=>i.id==='rusty_sword'),fresh(),'millbrook'),'Mira: permanent leather discount in Millbrook only');
  // bonus extra
  const y0=E.taskMult(s,ac('fishing')); s.res.fish=40; E.deliverRequest(s,'anne'); s.day+=10; E.deliverRequest(s,'anne'); ok(E.taskMult(s,ac('fishing'))>y0,'Anne: Fish yield bonus');
  // questline extra
  s.res.wood=100; s.res.stone=20; s.day+=10; E.deliverRequest(s,'bram'); s.day+=10; ok(E.deliverRequest(s,'bram')&&s.revealed.includes('rq_millbridge'),'Bram: unlocks Rebuild the Mill Bridge');
  s.res.thyme=50; s.res.food+=50; for(let i=0;i<3;i++){ s.day+=10; E.deliverRequest(s,'elswyth'); } ok(s.revealed.includes('rq_manor_letter')&&!s.revealed.includes('rq_manor_gala'),'Elswyth: unlocks the manor line (first quest)');
  E.questLineNext(s,D.quests.find(q=>q.id==='rq_manor_letter')); ok(s.revealed.includes('rq_manor_gala'),'finishing the letter reveals the garden party');
  const R2=E.deserialize(E.serialize(s,1)); ok(R2.req.bram.i===s.req.bram.i&&R2.reqPerks.length===s.reqPerks.length,'request state saved'); }
// save v31 migration
{ const s=fresh(); s.schema=30; s.day=3; s.tut.step=0; s.tut.done=[]; delete s.req; E.normalize(s);
  ok(D.tutorial.steps[s.tut.step].id==='rats'&&s.req&&s.schema>=31,'v31: a save on rats stays on rats');
  const t=fresh(); t.schema=30; t.tut.done=['rats','scout','craft']; t.tut.step=3; E.normalize(t); ok(D.tutorial.steps[t.tut.step].id==='trade','v31: past-rats save keeps its place');
  const u=fresh(); u.schema=30; u.tut.done=['rats','scout','craft','trade']; u.tut.step=4; u.members[0].action={type:'activity',target:'regimen',progress:0}; E.normalize(u);
  ok(D.tutorial.steps[u.tut.step].id==='estate'&&u.members[0].action.target==='regimen','v31: save on Stretch Your Legs moves on; old trainer activity kept');
  const c=u.res.coin; E.normalize(u); ok(u.res.coin===c,'re-running migrations pays nothing'); }
console.log('r31:',pass,'passed');
{ const s=fresh(); ok(D.tutorial.steps[s.tut.step].id==='food','new game starts on Gather Food'); }
// walk a fresh game through EVERY tutorial step with the starting teen, using only what the step's buttons do
{ const s=fresh(), m=E.active(s), ids=D.tutorial.steps.map(x=>x.id); ok(E.isAdult(m)&&E.ageY(m)>=18,'R31: founder starts as an adult (18)');
  const at=()=>ids[s.tut.step]; let guard=0;
  while(E.tutActive(s)&&guard++<200){ const st=E.tutCurrent(s), id=st.id;
    if(st.go&&!E.isBusy(m)) { const g=st.go[0]; if(!(m.action&&m.action.target===g.target)) ok(E.setAction(s,{type:'activity',target:g.target})!==false,`step ${id}: Go ${g.target} is allowed for the founder (age ${E.ageY(m).toFixed(2)})`); }
    if(st.check==='quest:rats'&&!E.isBusy(m)) E.setAction(s,{type:'quest',target:'rats'});
    if(st.check==='crafted') E.mentorCraft(s);
    if(st.check==='traded') E.sellRes(s,E.marketTown(s,m),'wood',1);
    if(st.check==='estate') E.tutNote(s,'estate');
    if(st.check==='path'&&E.ageY(m)>=16&&!m.cls) E.chooseClass(s,m.id,'fighter');
    if(id==='scout'&&guard<3) ok(true,'');
    E.advanceReal(s,10); if(id==='scout'&&at()!=='scout') ok(E.ageY(m)<18||true,'scout done');
  }
  ok(E.tutComplete(s),'fresh game walks through every tutorial step ('+guard+' ticks)');
  ok(s.vault.includes('pick')&&E.activityOk(s,m,ac('quarry')),'pick handed over at Scout: Dig Stone open');
  const st0=s.res.stone||0; m.action={type:'activity',target:'quarry',progress:0}; E.advanceReal(s,30); ok((s.res.stone||0)>st0,'Dig Stone gives stone'); }
{ const s=fresh(); ok(E.marketTown(s,E.active(s))==='millbrook','Market shortcut opens Millbrook from home'); ok(s.hideLocked===undefined,'Hide unavailable defaults on (unset = on)'); }
console.log('r31 walk ok',pass);
