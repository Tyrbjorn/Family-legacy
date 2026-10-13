// Food chains + Stronghold-style meals: Food panel, rations, menu toggles, town market (390px and desktop)
const {chromium}=await import(process.env.PW_CORE||'/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core/index.mjs');
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const go=async(p,t)=>{await p.evaluate(t=>{const g=window.__tabGroup(t);document.querySelector('#tabs [data-group="'+g+'"]').click();},t);await p.waitForTimeout(150);await p.evaluate(t=>{const b=document.querySelector('#subtabs [data-tab="'+t+'"]');if(b)b.click();},t);};
const out=[];let rc=0;
for(const [w,h,tag] of [[390,844,'phone'],[1200,900,'desk']]){
const p=await (await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:tag==='phone'?2:1})).newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:'+(process.env.PORT||8137)+'/');await p.waitForFunction(()=>window.__game);await p.evaluate(()=>localStorage.clear());await p.reload();await p.waitForFunction(()=>window.__game);await p.waitForTimeout(800);
const r=await p.evaluate(()=>{const g=__game,s=g.s,E=g.E;E.skipTutorial(s);s.members[0].ageDays=25*360;
Object.assign(s.res,{coin:1e5,wood:3e3,stone:3e3,planks:500,blocks:500,ingots:200,copper:200,thyme:80,salt:40,meat:30});
for(const l of ['plot','acre','meadow','hillside'])E.buyLand(s,l);
const built=['fields','kitchen','cowpen','gristmill','orchard'].map(t=>E.buildStructure(s,t));
const k=s.structures.find(x=>x.type==='kitchen');for(const pc of ['oven','churn','smoker'])E.placePiece(s,k.uid,pc);
for(let i=0;i<40;i++)E.dayTick(s,1,1);
return {built,menu:s.meal&&s.meal.menu,variety:s.meal&&s.meal.variety,morale:s.morale,bread:s.res.bread|0,cheese:s.res.cheese|0};});
await go(p,'estate');await p.waitForTimeout(500);
await p.evaluate(()=>document.querySelector('[data-a=ration][data-v=extra]').click());await p.waitForTimeout(300);
await p.evaluate(()=>document.querySelector('[data-a=diet][data-v=meat]').click());await p.waitForTimeout(400);
const st=await p.evaluate(()=>({ration:__game.s.ration,meat:__game.E.onMenu(__game.s,'meat'),panel:!!document.getElementById('foodpanel'),txt:document.getElementById('foodpanel')?.textContent.slice(0,140),overflow:document.documentElement.scrollWidth>innerWidth+1}));
await p.evaluate(()=>document.getElementById('foodpanel').scrollIntoView());await p.waitForTimeout(300);
await p.screenshot({path:`/workspace/fl-screenshots/screenshot-food-${tag}.png`});
await go(p,'map');await p.waitForTimeout(500);
const c0=await p.evaluate(()=>__game.s.res.salt);
await p.evaluate(()=>{const b=document.querySelector('[data-a=buyres][data-w=salt]');b&&b.scrollIntoView({block:'center'});b&&b.click();});await p.waitForTimeout(400);
const c1=await p.evaluate(()=>__game.s.res.salt);
await p.screenshot({path:`/workspace/fl-screenshots/screenshot-market-${tag}.png`});
await go(p,'main');await p.waitForTimeout(300);await p.evaluate(()=>{__game.s.morale=6;document.querySelector('[data-a=sheet]').click();});await p.waitForTimeout(600);
const sheet=await p.evaluate(()=>{const e=document.getElementById('sheet-morale');e&&e.scrollIntoView({block:'center'});return e&&e.textContent;});await p.waitForTimeout(300);
await p.screenshot({path:`/workspace/fl-screenshots/screenshot-sheet-morale-${tag}.png`});
const ok=!!sheet&&/speed \+\d+%/.test(sheet)&&/skill XP \+\d+%/.test(sheet)&&r.built.every(Boolean)&&st.panel&&st.ration==='extra'&&st.meat===true&&c1>c0&&!st.overflow&&errs.filter(e=>!/Failed to fetch/.test(e)).length===0;
if(!ok)rc=1;out.push({tag,sheet,st,salt:[c0,c1],errs,ok});await p.close();}
console.log(JSON.stringify(out,null,1));console.log('rc='+rc);await b.close();process.exit(rc);
