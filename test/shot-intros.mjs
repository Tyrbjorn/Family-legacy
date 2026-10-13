// Unlock intro cards: shown on Main and in the matching tab, skippable (390px and desktop)
const {chromium}=await import(process.env.PW_CORE||'/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core/index.mjs');
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const go=async(p,t)=>{await p.evaluate(t=>{const g=window.__tabGroup(t);document.querySelector('#tabs [data-group="'+g+'"]').click();},t);await p.waitForTimeout(150);await p.evaluate(t=>{const b=document.querySelector('#subtabs [data-tab="'+t+'"]');if(b)b.click();},t);};
const out=[];let rc=0;
for(const [w,h,tag] of [[390,844,'phone'],[1200,900,'desk']]){
const p=await (await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:tag==='phone'?2:1})).newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:'+(process.env.PORT||8137)+'/');await p.waitForFunction(()=>window.__game);await p.evaluate(()=>localStorage.clear());await p.reload();await p.waitForFunction(()=>window.__game);await p.waitForTimeout(800);
const r=await p.evaluate(()=>{const g=__game,s=g.s,E=g.E;E.skipTutorial(s);s.members[0].ageDays=20*360;s.res.coin=5000;E.buyLand(s,'plot');E.introsDay(s);E.introSkip(s,'food');E.introsDay(s);return E.introsActive(s).map(l=>l.id).join();});
await go(p,'main');await p.waitForTimeout(300);
const main=await p.evaluate(()=>document.querySelectorAll('#view .card.tut, .card.tut').length);
await p.screenshot({path:`/workspace/fl-screenshots/screenshot-intros-main-${tag}.png`});
await go(p,'minions');await p.waitForTimeout(300);
const inTab=await p.evaluate(()=>[...document.querySelectorAll('.card.tut')].some(c=>/Minions/.test(c.textContent)));
await p.screenshot({path:`/workspace/fl-screenshots/screenshot-intros-tab-${tag}.png`});
const sk=await p.evaluate(()=>{const b=[...document.querySelectorAll('[data-a=introskip]')].find(x=>x.dataset.v==='minions');b&&b.click();return __game.s.intros.lines.minions.state;});
const ov=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
const o={tag,r,main,inTab,sk,ov,errs,ok:main===1&&inTab&&sk==='skipped'&&!ov&&!errs.length};out.push(o);if(!o.ok)rc=1;
}
console.log(JSON.stringify(out,null,1));await b.close();console.log('rc='+rc);process.exit(rc);
