// Craft paths UI: rank bars, open-path buttons, specialty choice, locked combo requirements (390px and desktop)
const {chromium}=await import(process.env.PW_CORE||'/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core/index.mjs');
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const go=async(p,t)=>{await p.evaluate(t=>{const g=window.__tabGroup(t);document.querySelector('#tabs [data-group="'+g+'"]').click();},t);await p.waitForTimeout(150);await p.evaluate(t=>{const b=document.querySelector('#subtabs [data-tab="'+t+'"]');if(b)b.click();},t);};
const out=[];let rc=0;
for(const [w,h,tag] of [[390,844,'phone'],[1200,900,'desk']]){
const p=await (await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:tag==='phone'?2:1})).newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.stack.slice(0,300)));p.on('console',m=>{if(m.type()==='error')errs.push('console:'+m.text())});
await p.goto('http://localhost:'+(process.env.PORT||8137)+'/');await p.waitForFunction(()=>window.__game);await p.evaluate(()=>localStorage.clear());await p.reload();await p.waitForFunction(()=>window.__game);await p.waitForTimeout(800);
await p.evaluate(()=>{const g=__game,s=g.s,E=g.E;E.skipTutorial(s);const m=s.members[0];m.ageDays=25*360;s.res.coin=9000;m.skills.carpentry.lvl=10;m.skills.smithing.lvl=5;E.joinGuild(s,m,'hearth');});
await go(p,'main');await p.waitForTimeout(400);
const pick=await p.evaluate(()=>/Choose your main path/.test(document.body.innerText)&&!!document.querySelector('[data-a=openpath][data-v=carpenter]'));
await p.evaluate(()=>document.querySelector('[data-a=openpath][data-v=carpenter]').click());await p.waitForTimeout(300);
const opened=await p.evaluate(()=>__game.E.mainPath(__game.s.members[0])?.id==='carpenter');
await p.evaluate(()=>{const g=__game,s=g.s,E=g.E,m=s.members[0];m.skills.carpentry.lvl=40;E.gainXp(s,m,'carpentry',9000);E.openPath(s,m,'mason');E.openPath(s,m,'scribe');});await p.waitForTimeout(700);
const ui=await p.evaluate(()=>({bars:document.querySelectorAll('.pb.thin').length>=3,spec:!!document.querySelector('[data-a=pickspec][data-w=cooper]'),combo:/Combo paths/.test(document.body.innerText),badge:/🎯/.test(document.body.innerText)}));
await p.evaluate(()=>{const d=[...document.querySelectorAll('details')].find(x=>/Combo paths/.test(x.textContent));if(d){d.open=true;d.scrollIntoView();}});await p.waitForTimeout(200);
const locked=await p.evaluate(()=>/🔒 Journeyman Mason/.test(document.body.innerText)&&/line class/.test(document.body.innerText));
await p.screenshot({path:`/workspace/fl-screenshots/screenshot-paths-${tag}.png`});
await p.evaluate(()=>document.querySelector('[data-a=pickspec][data-w=cooper]').click());await p.waitForTimeout(300);
const spec=await p.evaluate(()=>__game.E.pathOf(__game.s.members[0],'carpenter').spec==='cooper');
const ov=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
const o={tag,pick,opened,ui,locked,spec,ov,errs,ok:pick&&opened&&ui.bars&&ui.spec&&ui.combo&&ui.badge&&locked&&spec&&!ov&&!errs.length};out.push(o);if(!o.ok)rc=1;
}
console.log(JSON.stringify(out,null,1));await b.close();console.log('rc='+rc);process.exit(rc);
