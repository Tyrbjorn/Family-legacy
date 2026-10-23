// R66 browser check: roof-off room view in List + Map, Classic on/off, 360px, reduced motion; --shots saves room PNGs
// usage: PORT=8137 node test/r66-browser.mjs [--shots]
const {chromium}=await import(process.env.PW_CORE||'/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core/index.mjs');
const shots=process.argv.includes('--shots'), SD='/workspace/fl-screenshots/';
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};
async function run(w,classic,rm){
const p=await (await b.newContext({viewport:{width:w,height:844},deviceScaleFactor:2,reducedMotion:rm?'reduce':'no-preference'})).newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:'+(process.env.PORT||8137)+'/');await p.waitForFunction(()=>window.__game);await p.evaluate(()=>localStorage.clear());await p.reload();await p.waitForFunction(()=>window.__game);await p.waitForTimeout(1500);
await p.evaluate(c=>{const g=__game,s=g.s;window.__noSave=true;s.classicEmoji=c;s.land=g.D.estate.lands.slice(0,3).map(l=>l.id);
 const smith=g.D.structures?.find?.(d=>d.id==='smithy');
 s.structures.push({uid:'st900',type:'smithy',pieces:['forge','workbench'],up:2,fittings:['runedanvil']},{uid:'st901',type:'house',pieces:['bunk','bunk','bunk','larder'],up:0});
 const d=g.E.structDef('mill')||g.E.structDef('kitchen');if(d)s.structures.push({uid:'st902',type:d.id,pieces:[...(d.fixed||[])],up:(d.upgrades||[]).length});
 for(let i=0;i<3;i++){document.querySelector('#modal:not([hidden]) [data-a=close],[data-pp=closewn]')?.click();document.getElementById('wnpanel')?.remove();}
 const gr=window.__tabGroup('estate');document.querySelector('#tabs [data-group="'+gr+'"]')?.click();},classic);
await p.waitForTimeout(200);await p.evaluate(()=>document.querySelector('#subtabs [data-tab="estate"]')?.click());await p.waitForTimeout(400);
await p.evaluate(()=>document.querySelector('[data-a=estview][data-v=list]')?.click());await p.waitForTimeout(300);
const out=[];
for(const uid of ['st901','st900','st902']){
 const has=await p.evaluate(u=>{const b=document.querySelector('.rmbtn[data-v="'+u+'"]');b?.click();return !!b;},uid);
 await p.waitForTimeout(rm?100:1100);
 const r=await p.evaluate(()=>{const e=document.querySelector('.estroom');if(!e)return null;e.scrollIntoView({block:'center'});const bx=e.getBoundingClientRect();return {w:bx.width,right:bx.right,roof:(()=>{const r=e.querySelector('.rmroof');if(!r)return false;const c=getComputedStyle(r);return c.display!=='none'&&+c.opacity>0.05})(),stack:e.innerHTML.includes('×3'),sw:document.documentElement.scrollWidth}});
 ok(r,`room open ${uid} w${w}`);if(!r)continue;
 ok(r.right<=w+1&&r.sw<=w+1,`fits ${uid} w${w}`);ok(!r.roof,`roof gone ${uid}`);if(uid==='st901')ok(r.stack,'beds ×3');
 if(shots&&w===390&&!rm)await (await p.$('.estroom')).screenshot({path:SD+`r66-room-${uid}${classic?'-classic':''}.png`});
 out.push(uid);
 await p.evaluate(()=>document.querySelector('.estroom [data-a=estroom]')?.click());await p.waitForTimeout(200);ok(!(await p.$('.estroom')),'closes '+uid);
}
if(rm){await p.evaluate(()=>document.querySelector('.rmbtn')?.click());const roofShown=await p.evaluate(()=>{const r=document.querySelector('.estroom .rmroof');return r?getComputedStyle(r).display!=='none':false});ok(!roofShown,'reduced motion no roof');}
else{await p.evaluate(()=>document.querySelector('.estroom [data-a=estroom]')?.click());await p.evaluate(()=>document.querySelector('.rmbtn')?.click());await p.waitForTimeout(80);ok(await p.$('.estroom .rmroof'),'roof shows at start');}
// map view: tap a building
await p.evaluate(()=>{document.querySelector('.estroom [data-a=estroom]')?.click();document.querySelector('[data-a=estview][data-v=map]')?.click()});await p.waitForTimeout(400);
await p.evaluate(()=>{const e=document.querySelector('[data-a=estsel][data-v="b:st901"]')||document.querySelector('[data-a=estsel][data-v^="b:"]');e?.dispatchEvent(new MouseEvent('click',{bubbles:true}));});await p.waitForTimeout(1100);
ok(await p.$('.estroom'),`map tap opens room w${w} c${classic}`);
if(shots&&w===390&&!rm&&!classic){const e=await p.$('.estroom');if(e)await e.screenshot({path:SD+'r66-room-map-tap.png'});}
ok(errs.length===0,'errors '+errs.join('|'));console.log('w',w,'classic',classic,'rm',rm,'rooms',out.join(','),'errs',errs.length);await p.close();}
for(const c of [false,true])for(const w of [390,360])await run(w,c,false);
await run(360,false,true);
await b.close();console.log('r66 browser fails',JSON.stringify(fails));process.exit(fails.length?1:0);
