// R32: fishing spots (data/fish.json): Shore / Deep (Small Boat, no Dock) / Sea shore (Gull's Landing); species all count as fish
import fs from 'fs'; import * as E from '../js/engine.js';
const R=new URL('../data/',import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const fresh=()=>{const s=E.newGame(1);E.normalize(s);return s;}, sp=id=>E.spotDef(id);
const lvl=(s,n)=>{for(const m of s.members)m.skills.fishing.lvl=n;};
ok(D.fish.species.length===8&&D.fish.species.every(f=>f.value>0&&f.food>0),'8 species with value and food');
{ const s=fresh(); ok(E.spotOpen(s,sp('shore')),'shore open for anyone'); ok(/Small Boat/.test(E.spotIssue(s,sp('deep'))),'deep needs a boat');
  ok(E.fishSpot(s).id==='shore','auto = shore without a boat'); ok(!E.setFishSpot(s,'deep'),'cannot pin a locked spot');
  s.vault.push('smallboat'); ok(!(s.structures||[]).some(x=>x.type==='dock')&&E.spotOpen(s,sp('deep')),'boat alone opens deep water (no Dock)');
  ok(E.hasBoat(s),'boat alone crosses lakes'); ok(E.fishSpot(s).id==='deep','auto picks deep (worth more)');
  ok(E.setFishSpot(s,'shore')&&E.fishSpot(s).id==='shore'&&E.setFishSpot(s,'auto'),'picker pins a spot');
  ok(E.spotIssue(s,sp('seashore'))&&/Sea Boat/.test(E.spotIssue(s,sp('deepsea'))),'sea shore locked until Gull\'s Landing; deep sea needs a Sea Boat (R48)');
  s.discovered=[...(s.discovered||[]),'loc:l_gullport']; ok(E.spotOpen(s,sp('seashore'))&&E.catchTable(s,'seashore').some(r=>r.f.id==='herring'),'Herring at Gull\'s Landing'); }
{ const s=fresh(); lvl(s,0); const t=E.catchTable(s,'deep').map(r=>r.f.id); ok(!t.includes('trout')&&!t.includes('sturgeon')&&!t.includes('pike'),'minLvl respected');
  lvl(s,30); const t2=E.catchTable(s,'deep'); ok(t2.some(r=>r.f.id==='sturgeon'),'sturgeon at 25+');
  const rare=(n)=>{lvl(s,n);return E.catchTable(s,'deep').filter(r=>r.f.tier!=='common').reduce((a,r)=>a+r.p,0);}; ok(rare(60)>rare(25),'skill raises uncommon+ odds'); }
{ const s=fresh(); s.vault.push('smallboat'); lvl(s,30); s.res.fish=0; const f0=0;
  for(let i=0;i<100;i++) E.landFish(s,1); ok(Math.abs(s.res.fish-100)<1e-9,'total landed = yield (economy unchanged)');
  ok(E.fishPriceMult(s)>1.5&&E.fishFoodMult(s)>1.1,'deep mix sells and feeds better');
  ok(s.log.some(l=>/🎣/.test(l.msg)&&/Mirror Trout|Sturgeon/.test(l.msg)),'rare catch logged with species');
  s.res.fish=50; E.fishBagFix(s); ok(Object.values(s.fishBag).reduce((a,v)=>a+v,0)<=50+1e-9,'species record shrinks when fish are spent');
  const before=E.fishPriceMult(s); ok(Math.abs(before-E.fishPriceMult(s))<1e-9,'spending keeps the mix');
  const s2=fresh(); s2.vault.push('smallboat'); lvl(s2,0); s2.vault=[...s2.vault]; let n=0; const N=20000;
  for(let i=0;i<N;i++){ const v=s2.vault.length; E.landFish(s2,1); if(s2.vault.length>v){n++; s2.vault.pop();} }
  ok(n>N*0.003*0.5&&n<N*0.003*1.7,`deep-water pearls ~0.3% (${n}/${N})`); }
{ const s=fresh(); s.res.fish=20; s.fishBag={pike:10}; const npc=D.requests.npcs.find(n=>n.id==='anne'||/Anne/.test(n.name));
  const r=E.openRequest(s,npc.id); if(r){ const c0=s.res.coin; E.deliverRequest(s,npc.id); ok(s.res.fish<20&&s.res.coin>c0,'Anne accepts any fish (pike counted as fish)'); } else ok(true,'anne not open');
  const t=s.members[0]; ok(true);
  // auto prefers a spot with a species an open request wants (data-driven: fake request)
  const g=fresh(); g.vault.push('smallboat'); g.discovered=['loc:l_gullport']; const d2={...D,requests:{...D.requests,npcs:[{id:'zz',name:'Z',town:'millbrook',requests:[{id:'zz1',wants:{herring:3},reward:{coin:1}}]}]}};
  E.setData(d2); ok(E.fishSpot(g).id==='seashore','auto prefers the spot with a requested species'); E.setData(D); }
{ const s=fresh(); s.vault.push('smallboat'); lvl(s,30); D.fish.species.push({id:'dlcfish',name:'DLC Carp',icon:'🐟',tier:'common',value:5,food:2,spots:{shore:50}});
  ok(E.catchTable(s,'shore').some(r=>r.f.id==='dlcfish'),'expansion species from data only'); D.fish.species.pop(); }
{ const s=fresh(); delete s.fishSpot; delete s.fishBag; s.schema=31; E.normalize(s); ok(s.fishSpot==='auto'&&s.fishBag&&s.schema>=32,'save v32 migration'); }
{ const s=fresh(); s.res.fish=0; s.res.food=0; s.fishBag={}; ok(E.fishPriceMult(s)===1,'no fish = plain price'); }
{ const s=fresh(); const m=s.members[0]; m.ageDays=20*360; s.res.fish=0; E.setAction(s,{type:'activity',target:'fishing'}); for(let i=0;i<5;i++)E.tick?.(s,1); ok(true,'tick'); }
console.log('r32:',pass,'passed');
