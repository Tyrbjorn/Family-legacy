// Gear sets + enchanting UI: set progress card, enchant card with timed job bar, tags on items (390px and desktop)
const {chromium}=await import(process.env.PW_CORE||'/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core/index.mjs');
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const go=async(p,t)=>{await p.evaluate(t=>{const g=window.__tabGroup(t);document.querySelector('#tabs [data-group="'+g+'"]').click();},t);await p.waitForTimeout(150);await p.evaluate(t=>{const b=document.querySelector('#subtabs [data-tab="'+t+'"]');if(b)b.click();},t);};
const out=[];let rc=0;
for(const [w,h,tag] of [[390,844,'phone'],[1200,900,'desk']]){
const p=await (await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:tag==='phone'?2:1})).newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.stack.slice(0,300)));p.on('console',m=>{if(m.type()==='error')errs.push('console:'+m.text())});
await p.goto('http://localhost:'+(process.env.PORT||8137)+'/');await p.waitForFunction(()=>window.__game);await p.evaluate(()=>localStorage.clear());await p.reload();await p.waitForFunction(()=>window.__game);await p.waitForTimeout(800);
const r=await p.evaluate(()=>{const g=__game,s=g.s,E=g.E;E.skipTutorial(s);const m=s.members[0];m.ageDays=25*360;m.cls='apprentice';Object.assign(s.res,{coin:9000,wood:500,stone:500,planks:200,dust:40,copper:20,mandrake:10,moonpetal:10,thyme:20});
E.buyLand(s,'plot');E.buyLand(s,'acre');const st=E.buildStructure(s,'shack');E.placePiece(s,st.uid,'enchdesk');s.craftUnlocked=true;s.res.ingots=50;E.placePiece(s,st.uid,'forge');s.vault.push('c|warden_blade|fine','c|warden_shield|superior','c|iron_sword|masterwork#keen*');E.equip(s,m,'c|warden_blade|fine');E.equip(s,m,'c|warden_shield|superior');return {jobs:E.stationFx(s).jobs};});
await go(p,'inv');await p.waitForTimeout(400);
const ui=await p.evaluate(()=>({sets:/Sets/.test(document.body.innerText)&&/2\/4 pieces/.test(document.body.innerText),ench:!!document.querySelector('[data-a=enchgo]'),tags:document.body.innerText.includes('◇')}));
await p.evaluate(()=>{const b=document.querySelector('[data-a=enchgo]');b&&!b.disabled&&b.click();});await p.waitForTimeout(400);
const job=await p.evaluate(()=>__game.s.enchants.length===1&&[...document.querySelectorAll('.pb span')].some(x=>/←/.test(x.textContent)));
await p.evaluate(()=>{const el=[...document.querySelectorAll('h3')].find(h=>/Enchanting/.test(h.textContent));if(el){el.scrollIntoView();let c=el.parentElement;while(c&&c.scrollHeight<=c.clientHeight+2)c=c.parentElement;if(c)c.scrollTop-=200;}});await p.waitForTimeout(200);
await p.screenshot({path:`/workspace/fl-screenshots/screenshot-gear-enchant-${tag}.png`});
await go(p,'estate');await p.waitForTimeout(300);await p.click('#subtabs [data-tab="craft"]');await p.waitForTimeout(400);const lock=await p.evaluate(()=>/🎓/.test(document.body.innerText)&&/only/.test(document.body.innerText));
await p.screenshot({path:`/workspace/fl-screenshots/screenshot-gear-recipes-${tag}.png`});
const ov=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
const o={tag,r,ui,job,lock,ov,errs,ok:ui.sets&&ui.ench&&ui.tags&&job&&lock&&!ov&&!errs.length};out.push(o);if(!o.ok)rc=1;
}
console.log(JSON.stringify(out,null,1));await b.close();console.log('rc='+rc);process.exit(rc);
