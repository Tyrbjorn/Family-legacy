// Houses view: courtship cards, household, diplomacy, feud warning and war (390px and desktop)
const {chromium}=await import(process.env.PW_CORE||'/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core/index.mjs');
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const go=async(p,t)=>{await p.evaluate(t=>{const g=window.__tabGroup(t);document.querySelector('#tabs [data-group="'+g+'"]').click();},t);await p.waitForTimeout(150);await p.evaluate(t=>{const b=document.querySelector('#subtabs [data-tab="'+t+'"]');if(b)b.click();},t);};
const out=[];let rc=0;
for(const [w,h,tag] of [[390,844,'phone'],[1200,900,'desk']]){
const p=await (await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:tag==='phone'?2:1})).newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:'+(process.env.PORT||8137)+'/');await p.waitForFunction(()=>window.__game);await p.evaluate(()=>localStorage.clear());await p.reload();await p.waitForFunction(()=>window.__game);await p.waitForTimeout(800);
const r=await p.evaluate(()=>{const g=__game,s=g.s,E=g.E,Y=360;E.skipTutorial(s);const m=s.members[0];m.ageDays=24*Y;s.res.coin=20000;s.renown=1000;for(let i=0;i<2;i++)s.members.push(E.newMember(s,{age:5}));if(!s.land.length)E.buyLand(s,"plot");s.buildings.farm=(s.buildings.farm||0)+12;s.res.pie=20;s.res.wood=500;s.res.stone=500;
 for(const l of ['plot','acre'])E.buyLand(s,l);const st=E.buildStructure(s,'shack');st.pieces=['bunk','bunk'];
 const a=E.makeSuitor(s,{house:'marlowe'});a.affinity=72;const c=E.makeSuitor(s,{house:null});c.affinity=20;s.suitors=[a,c];
 const sib=E.newMember(s,{age:19});s.members.push(sib);const sp=E.newMember(s,{age:30});sp.persona='warm';sp.house='skye';s.members.push(sp);
 E.addRapport(s,'skye',70);E.addRapport(s,'tallow',30);E.addRapport(s,'vey',-80);E.addRapport(s,'corran',-90);E.declareWar(s,'corran');s.houses.vey.warned=s.day-10;
 return {tiers:E.houseList().map(h=>E.tierOf(s,h.id)).join()};});
await go(p,'houses');await p.waitForTimeout(600);
const ok1=await p.evaluate(()=>!!document.querySelector('#house-corran .war')&&document.querySelectorAll('.suitor').length===2);
await p.screenshot({path:`/workspace/fl-screenshots/screenshot-houses-${tag}.png`});
await p.evaluate(()=>document.getElementById('house-corran').scrollIntoView());await p.waitForTimeout(300);
await p.screenshot({path:`/workspace/fl-screenshots/screenshot-war-${tag}.png`});
const r2=await p.evaluate(()=>{const s=__game.s,E=__game.E;const r0=E.rapport(s,'ashbrook');document.querySelector('[data-a=hgift][data-v=ashbrook]').click();
 document.querySelector('[data-a=truce][data-v=corran]').click();const fg=document.querySelector('[data-a=foodgift]');const a0=s.suitors[0].affinity;fg&&fg.click();
 return {gift:E.rapport(s,'ashbrook')>r0,peace:!E.atWar(s,'corran'),food:s.suitors[0].affinity>a0,overflow:document.documentElement.scrollWidth>innerWidth+1};});
await p.waitForTimeout(400);
const r3=await p.evaluate(()=>{const s=__game.s,E=__game.E;const sib=s.members.find(x=>x.alive&&x.id!==s.activeId&&!x.spouse&&!x.persona&&E.ageY(x)>=16);const sel=document.querySelector('#house-tallow select[data-a=mosel]');if(sel){sel.value=String(sib.id);sel.dispatchEvent(new Event('change',{bubbles:true}));}return sib.id;});
await p.waitForTimeout(400);
const mo=await p.evaluate(id=>{document.querySelector('[data-a=marryout][data-v=tallow]').click();const m=__game.s.members.find(x=>x.id===id);return m.marriedOut==='tallow';},r3);
await go(p,'family');await p.waitForTimeout(500);await p.screenshot({path:`/workspace/fl-screenshots/screenshot-tree-marriedout-${tag}.png`});
const tree=await p.evaluate(()=>/wed into House Tallow/.test(document.body.textContent));
const ok=ok1&&r2.gift&&r2.peace&&r2.food&&!r2.overflow&&mo&&tree&&errs.filter(e=>!/Failed to fetch/.test(e)).length===0;
if(!ok)rc=1;out.push({tag,r,ok1,r2,mo,tree,errs,ok});await p.close();}
console.log(JSON.stringify(out,null,1));console.log('rc='+rc);await b.close();process.exit(rc);
