// R49 phone screenshots: Saltmere (map town detail), the Lodge / Blackwater Reef on the map, the reef chain + its choice, House Gilmane
const {chromium}=await import('/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core/index.mjs');
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const go=async(p,t)=>{await p.evaluate(t=>{const g=window.__tabGroup(t);document.querySelector('#tabs [data-group="'+g+'"]').click();},t);await p.waitForTimeout(150);await p.evaluate(t=>{const b=document.querySelector('#subtabs [data-tab="'+t+'"]');if(b)b.click();},t);await p.waitForTimeout(400);};
const p=await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2})).newPage();
const errs=[];p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});p.on('pageerror',e=>errs.push(String(e)));
const O='/workspace/fl-screenshots/';
const unhide=()=>p.evaluate(()=>{for(const x of document.querySelectorAll('*'))if(x.style.display==='none')x.style.display='';});
const clip=async(sel,path,pre=0,post=0,maxH=1700)=>{const r=await p.evaluate(([sel,pre,post,maxH])=>{for(const x of document.querySelectorAll('*')){const c=getComputedStyle(x);if(c.position==='fixed'||c.position==='sticky')x.style.display='none';}const e=typeof sel==='string'?document.querySelector(sel):null;e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY-pre,width:r.width,height:Math.min(r.height+pre+post,maxH)};},[sel,pre,post,maxH]);await p.waitForTimeout(150);await p.screenshot({path,clip:r,fullPage:true});await unhide();};
await p.goto('http://localhost:8080/');await p.waitForFunction(()=>window.__game);await p.evaluate(()=>{localStorage.clear();localStorage.setItem('fl-whatsnew','R49');});await p.reload();await p.waitForTimeout(2000);
// a family three years in: Saltmere found and visited, chapter 4 done, Tobiah's stories begun, Gilmane warming
await p.evaluate(()=>{const g=__game,E=g.E,s=g.s,D=g.D;s.tut.skipped=true;const m=s.members[0];m.ageDays=30*D.tuning.daysPerYear;m.action=null;s.day=3*D.tuning.daysPerYear+40;s.res.coin=14000;
  for(const k in m.stats)m.stats[k]=30;for(const k of ['sailing','fishing','tactics','etiquette','tracking','thievery'])if(m.skills[k])m.skills[k].lvl=14;
  Object.assign(s.res,{planks:60,blocks:20,ale:12,fish:30,salt:20,kelp:8,pearls:2,reefgold:1});
  const G=D.map.towns.gullport,S=D.map.towns.saltmere;E.reveal(s,G.x,G.y,140);E.reveal(s,66,985,80);E.reveal(s,64,1200,80);E.reveal(s,S.x,S.y,150);E.reveal(s,48,1560,90);E.reveal(s,470,1510,150);
  for(const r of ['saltcoast','saltmere'])if(!s.discovered.includes(r))s.discovered.push(r);(s.charts||=[]).push('saltcoast');E.locationsDay(s);E.sellRes(s,'gullport','fish',4);E.sellRes(s,'saltmere','fish',4);
  s.doneQuests.push('st1','st2','st3','st4','b_lights','reef1');s.unlocks.push('ferry:gullport');
  for(const id of ['q_salt_pans','q_salt_kelp','q_salt_lighthouse','q_salt_fog','reef2','b_bell','ht_gilmane1'])if(!s.revealed.includes(id))s.revealed.push(id);
  s.req=s.req||{};s.req.tobiah={i:1,at:0,n:1,fav:10};s.req.merrow={i:3,at:0,n:3,fav:60};
  s.houses.gilmane={r:22,state:'peace'};s.vault.push('seaboat');g.save();});
await p.reload();await p.waitForTimeout(2000);
const pan=async(dy)=>{const r=await p.evaluate(()=>{const e=document.querySelector('#worldmap');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width*0.93,y:r.y+r.height*0.7};});for(let i=0;i<Math.abs(dy)/200;i++){await p.mouse.move(r.x,r.y);await p.mouse.down();await p.mouse.move(r.x,r.y-Math.sign(dy)*Math.min(200,Math.abs(dy)),{steps:8});await p.mouse.up();await p.waitForTimeout(200);}};
// 1) Saltmere on the map (selected) + its detail
await go(p,'map');await p.waitForTimeout(500);await pan(200);await pan(150);await p.evaluate(()=>{const e=document.querySelector('[data-v="t:saltmere"]');e&&e.dispatchEvent(new MouseEvent('click',{bubbles:true}));});await p.waitForTimeout(700);
await clip('#mapdetail',O+'r49-town.png',430,10);
await clip('#brewery-gullport',O+'r49-brewery.png',6,6);
// 2) the Lodge of the Drowned Light (selected) with Blackwater Reef in view
await p.evaluate(()=>{const e=document.querySelector('[data-v="l:l_lodge"]')||[...document.querySelectorAll('[data-v]')].find(x=>/l_lodge/.test(x.getAttribute('data-v')));e&&e.dispatchEvent(new MouseEvent('click',{bubbles:true}));});await p.waitForTimeout(700);
await clip('#mapdetail',O+'r49-lodge-reef.png',430,10);
// 3) the reef chain card + the Saltmere rows (Quests tab)
await go(p,'quests');await p.waitForTimeout(500);
await clip('#chain-reef',O+'r49-chain.png',8,8);
// 3b) end of the chain: the choice card
await p.evaluate(()=>{const g=__game,E=g.E,s=g.s,D=g.D;s.doneQuests.push('reef2','reef3','reef4');E.askChoice(s,D.quests.find(q=>q.id==='reef4'));g.save();});await p.reload();await p.waitForTimeout(2000);await go(p,'quests');await p.waitForTimeout(500);
await clip('#choice-reef',O+'r49-choice.png',8,8);
// 4) House Gilmane
await go(p,'houses');await p.waitForTimeout(500);
await clip('#house-gilmane',O+'r49-gilmane.png',8,8);
console.log('errors',errs);await b.close();if(errs.length)process.exit(1);
