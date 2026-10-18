const {chromium}=await import('/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core/index.mjs');
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const go=async(p,t)=>{await p.evaluate(t=>{const g=window.__tabGroup(t);document.querySelector('#tabs [data-group="'+g+'"]').click();},t);await p.waitForTimeout(150);await p.evaluate(t=>{const b=document.querySelector('#subtabs [data-tab="'+t+'"]');if(b)b.click();},t);await p.waitForTimeout(400);};
const p=await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2})).newPage();
const errs=[];p.on('console',m=>{if(m.text().startsWith('dbg'))console.log(m.text())});p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});p.on('pageerror',e=>errs.push(String(e)));
const O='/workspace/fl-screenshots/';
const unhide=()=>p.evaluate(()=>{for(const x of document.querySelectorAll('*'))if(x.style.display==='none')x.style.display='';});
const clip=async(sel,path,pre=0,post=0)=>{const r=await p.evaluate(([sel,pre,post])=>{for(const x of document.querySelectorAll('*')){const c=getComputedStyle(x);if(c.position==='fixed'||c.position==='sticky')x.style.display='none';}const e=document.querySelector(sel);e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY-pre,width:r.width,height:Math.min(r.height+pre+post,1700)};},[sel,pre,post]);await p.waitForTimeout(150);await p.screenshot({path,clip:r,fullPage:true});await unhide();};
await p.goto('http://localhost:8080/');await p.waitForFunction(()=>window.__game);await p.evaluate(()=>{localStorage.clear();localStorage.setItem('fl-whatsnew','R47');});await p.reload();await p.waitForTimeout(2000);
// 1) second guild open (tier-3 Warriors' class) + Auto's pick
await p.evaluate(()=>{const g=__game,E=g.E,s=g.s,D=g.D;s.tut.skipped=true;const m=s.members[0];m.ageDays=30*D.tuning.daysPerYear;m.action=null;s.res.coin=6000;
  const t3=D.classes.find(c=>c.tier===2&&E.guildOfCls(c.id)==='vanguard'&&!c.retired&&!c.needsQuest&&!c.needsBuildings);
  for(const [k,v] of Object.entries({swordsmanship:42,shield:38,leadership:16,tactics:14,brawling:20,masonry:24,carpentry:22,reading:12,history:9}))m.skills[k].lvl=v;
  m.guild={id:'vanguard',rank:2,rep:260};m.cls=t3.id;m.clsHist=['fighter','knight'];m.secondGuild={via:'tier3',cls:t3.id,day:s.day};g.save();});
await p.reload();await p.waitForTimeout(2000);await go(p,'main');await p.waitForTimeout(500);
await clip('#guildtiers',O+'r47-second-guild-open.png',8,8);
// 2) Guilds tab: the Architects' Guild hall with "Join as second guild"
await go(p,'guilds');await p.waitForTimeout(500);await clip('[data-guild="architects"]',O+'r47-architects-hall.png',8,8);
await p.evaluate(()=>document.querySelector('[data-a="join2"][data-v="architects"]').click());await p.waitForTimeout(500);
// 3) second class card (Builder → Master Builder / Surveyor)
await p.evaluate(()=>{const g=__game,s=g.s,m=s.members[0];m.guild2.rep=22;g.save();});
await p.reload();await p.waitForTimeout(2000);await go(p,'main');await p.waitForTimeout(500);
await clip('#second-guild',O+'r47-second-class.png',8,8);
// 4) Town Planner: two village projects at once
await p.evaluate(()=>{const g=__game,E=g.E,s=g.s,D=g.D;const m=s.members[0];m.guild={id:'architects',rank:2,rep:200};m.cls='b_planner';m.guild2=null;m.class2=null;
  if(!s.land.includes('valley'))s.land.push(...D.estate.lands.map(l=>l.id).filter(id=>!s.land.includes(id)));
  if(!s.structures.length)s.structures.push({uid:'stx',type:'shack',pieces:[],up:0});
  s.village={tier:1,auto:true};for(const k of ['planks','blocks','stone','wood','ingots'])s.res[k]=400;s.res.coin=40000;
  const vt=E.villageTypes();E.buildVillage(s,vt[0],0);E.buildVillage(s,vt[1],0);E.deliver(s,'coin',600,0);E.deliver(s,'coin',300,1);
  s.unlocks.push('upgrade:roadworks');E.buildRoad(s,'track');E.buildRoad(s,'track');E.buildRoad(s,'road');s.roads.cond=0.9;g.save();});
await p.reload();await p.waitForTimeout(2000);await go(p,'estate');await p.waitForTimeout(600);
await clip('#village-card',O+'r47-town-planner.png',8,8);
// 5) holdings: Architects' discounts + road works
await clip('#holdings',O+'r47-roadworks.png',8,8);
console.log('errors',errs);await b.close();if(errs.length)process.exit(1);
