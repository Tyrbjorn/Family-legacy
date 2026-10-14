// Map round UI: parchment terrain + roads + fog, locations, node stock/route, hauling card, parcel work, noderun picker (390px and desktop)
const {chromium}=await import(process.env.PW_CORE||'/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core/index.mjs');
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const go=async(p,t)=>{await p.evaluate(t=>{const g=window.__tabGroup(t);document.querySelector('#tabs [data-group="'+g+'"]').click();},t);await p.waitForTimeout(150);await p.evaluate(t=>{const b=document.querySelector('#subtabs [data-tab="'+t+'"]');if(b)b.click();},t);};
const out=[];let rc=0;
for(const [w,h,tag] of [[390,844,'phone'],[1200,900,'desk']]){
const p=await (await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:tag==='phone'?2:1})).newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.stack.slice(0,300)));p.on('console',m=>{if(m.type()==='error')errs.push('console:'+m.text())});
await p.goto('http://localhost:'+(process.env.PORT||8137)+'/');await p.waitForFunction(()=>window.__game);await p.evaluate(()=>localStorage.clear());await p.reload();await p.waitForFunction(()=>window.__game);await p.waitForTimeout(800);
await p.evaluate(()=>{const g=__game,s=g.s,E=g.E;E.skipTutorial(s);const m=s.members[0];m.ageDays=25*360;s.res.coin=9000;E.buyLand(s,'plot');E.buyLand(s,'acre');});
await go(p,'map');await p.waitForTimeout(500);
const svg=await p.evaluate(()=>{const t=document.querySelector('#worldmap');return {pat:t.querySelectorAll('pattern').length>=8,roads:t.querySelectorAll('polyline').length>=5,fog:t.querySelectorAll('g[pointer-events=none] rect').length>0,locs:t.querySelectorAll('[data-v^="l:"]').length>0,charted:/% charted/.test(document.body.innerText)};});
const cards=await p.evaluate(()=>({haul:/Hauling/.test(document.body.innerText)&&!!document.querySelector('[data-a=buyanimal]'),parcel:!!document.querySelector('[data-a=parcel]')}));
await p.screenshot({path:`/workspace/fl-screenshots/screenshot-map-${tag}.png`});
await p.evaluate(()=>{document.querySelector('[data-v^="n:"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));});await p.waitForTimeout(300);
const node=await p.evaluate(()=>/stock \d+\/\d+/.test(document.body.innerText)&&/risk ×/.test(document.body.innerText));
await p.evaluate(()=>{const e=document.querySelector('[data-v^="l:"]');e&&e.dispatchEvent(new MouseEvent('click',{bubbles:true}));});await p.waitForTimeout(300);
await p.screenshot({path:`/workspace/fl-screenshots/screenshot-map-detail-${tag}.png`,fullPage:true});
await p.evaluate(()=>document.querySelector('[data-a=parcel]').click());await p.waitForTimeout(300);
const work=await p.evaluate(()=>__game.s.members[0].action?.type==='parcel');
await p.evaluate(()=>{const s=__game.s;s.minions.push({uid:'mz1',type:'laborer',equip:{},name:'Bo',job:'noderun',loyalty:100,since:0,cls:'n_peasant'});});
await go(p,'minions');await p.waitForTimeout(500);
const pick=await p.evaluate(()=>!!document.querySelector('select[data-a=setnode]'));
const ov=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
const o={tag,svg,cards,node,work,pick,ov,errs,ok:Object.values(svg).every(Boolean)&&cards.haul&&cards.parcel&&node&&work&&pick&&!ov&&!errs.length};out.push(o);if(!o.ok)rc=1;
}
console.log(JSON.stringify(out,null,1));await b.close();console.log('rc='+rc);process.exit(rc);
