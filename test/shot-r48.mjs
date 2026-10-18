// R48 phone screenshots: Gull's Landing (map town detail), its villagers, the coast card (Sea Boat + ferry), the Families view, the coast quests
const {chromium}=await import('/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core/index.mjs');
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const go=async(p,t)=>{await p.evaluate(t=>{const g=window.__tabGroup(t);document.querySelector('#tabs [data-group="'+g+'"]').click();},t);await p.waitForTimeout(150);await p.evaluate(t=>{const b=document.querySelector('#subtabs [data-tab="'+t+'"]');if(b)b.click();},t);await p.waitForTimeout(400);};
const p=await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2})).newPage();
const errs=[];p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});p.on('pageerror',e=>errs.push(String(e)));
const O='/workspace/fl-screenshots/';
const unhide=()=>p.evaluate(()=>{for(const x of document.querySelectorAll('*'))if(x.style.display==='none')x.style.display='';});
const clip=async(sel,path,pre=0,post=0,maxH=1700)=>{const r=await p.evaluate(([sel,pre,post,maxH])=>{for(const x of document.querySelectorAll('*')){const c=getComputedStyle(x);if(c.position==='fixed'||c.position==='sticky')x.style.display='none';}const e=typeof sel==='string'?document.querySelector(sel):null;e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY-pre,width:r.width,height:Math.min(r.height+pre+post,maxH)};},[sel,pre,post,maxH]);await p.waitForTimeout(150);await p.screenshot({path,clip:r,fullPage:true});await unhide();};
await p.goto('http://localhost:8080/');await p.waitForFunction(()=>window.__game);await p.evaluate(()=>{localStorage.clear();localStorage.setItem('fl-whatsnew','R48');});await p.reload();await p.waitForTimeout(2000);
// a family two years in: Gull's Landing found and visited, chapter 2 done, ferry open, a few houses warmed up
await p.evaluate(()=>{const g=__game,E=g.E,s=g.s,D=g.D;s.tut.skipped=true;const m=s.members[0];m.ageDays=28*D.tuning.daysPerYear;m.action=null;s.day=2*D.tuning.daysPerYear+40;s.res.coin=9000;
  for(const k in m.stats)m.stats[k]=30;for(const k of ['sailing','fishing','tactics','carpentry','haggling'])m.skills[k].lvl=14;
  Object.assign(s.res,{planks:60,blocks:20,flax:40,rope:6,ale:10,fish:30,salt:20,saltedfish:6});
  const G=D.map.towns.gullport;E.reveal(s,G.x,G.y,140);E.reveal(s,60,420,60);E.reveal(s,66,985,60);E.locationsDay(s);E.sellRes(s,'gullport','fish',4);
  s.doneQuests.push('st1','st2');s.unlocks.push('ferry:gullport');s.doneQuests.push('b_lights');
  for(const id of ['q_gull_nets','q_gull_crabs','q_gull_lantern','q_gull_skiff','q_gull_storm','q_gull_tar'])if(!s.revealed.includes(id))s.revealed.push(id);
  s.houses.ashbrook={r:64,state:'peace'};s.houses.corwen={r:34,state:'peace'};s.houses.marlowe={r:28,state:'peace'};s.houses.sallow={r:-20,state:'peace'};s.houses.dawnward={r:8,state:'peace'};
  for(const id of ['ht_ashbrook1','ht_corwen1','ht_dawnward1'])if(!s.revealed.includes(id))s.revealed.push(id);s.doneQuests.push('ht_ashbrook1','ht_ashbrook2');s.revealed.push('ht_ashbrook2','ht_ashbrook3');
  s.req=s.req||{};s.req.odile={i:2,at:0,n:2,fav:20};s.req.pell={i:12,at:s.day+40,n:12,fav:100,done:{pell1:4,pell2:4,pell3:4}};s.unlocks.push('recipe:r_seaboat');g.save();});
await p.reload();await p.waitForTimeout(2000);
// 1) the town on the map (selected) + its detail
await go(p,'map');await p.waitForTimeout(500);await p.evaluate(()=>{const e=document.querySelector('[data-v="t:gullport"]');e&&e.dispatchEvent(new MouseEvent('click',{bubbles:true}));});await p.waitForTimeout(700);
await p.evaluate(()=>{const m=document.querySelector('svg');m&&m.scrollIntoView({block:'start'});});
await clip('#mapdetail',O+'r48-town.png',430,10);
// 2) the coast card: Sea Boat path + ferry
await clip('#seacard',O+'r48-boat-ferry.png',8,8);
// 3) Gull's Landing villagers + coast jobs and the Act 1 beat (Quests tab)
await go(p,'quests');await p.waitForTimeout(500);
await p.evaluate(()=>{const h=[...document.querySelectorAll('h3')].find(x=>x.textContent.includes('Requests'));h&&h.setAttribute('id','r48req');});
await clip('#r48req',O+'r48-villagers.png',4,640);
await p.evaluate(()=>{const c=[...document.querySelectorAll('.card')].filter(x=>/Odile|Pell|Merrow/.test(x.textContent)&&x.textContent.length<600);c[0]&&c[0].setAttribute('id','r48gull');});
await clip('#r48gull',O+'r48-gull-villagers.png',4,330);
await p.evaluate(()=>{const c=[...document.querySelectorAll('.card')].find(x=>x.textContent.includes('Lantern Watch'));c&&c.setAttribute('id','r48q');});
await clip('#r48q',O+'r48-coast-quests.png',260,380);
// 4) Families view
await go(p,'houses');await p.waitForTimeout(500);
await clip('#famvael',O+'r48-families.png',90,1000,1500);
await p.evaluate(()=>{document.querySelector('#house-corwen').setAttribute('data-x','1');});
await clip('#house-corwen',O+'r48-house-corwen.png',8,8);
// 5) Sea Boat owned: deep sea + quicker coast trips
await p.evaluate(()=>{const g=__game,s=g.s;s.vault.push('seaboat');g.save();});await p.reload();await p.waitForTimeout(2000);await go(p,'map');await p.waitForTimeout(500);
await clip('#seacard',O+'r48-seaboat-owned.png',8,8);
console.log('errors',errs);await b.close();if(errs.length)process.exit(1);
