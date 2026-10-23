// R65 browser check: batch4 icons load (no broken images), Classic on/off, 360px; --shots saves Materials list + icon sheet
// usage: PORT=8138 node test/r65-browser.mjs [--shots]
const {chromium}=await import(process.env.PW_CORE||'/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core/index.mjs');
const shots=process.argv.includes('--shots'), SD='/workspace/fl-screenshots/';const fails=[];const ok=(c,m)=>{if(!c)fails.push(m)};
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const IDS='blocks limeblocks marbleblocks butter clay peat wheat barley hay flax gems amber cutgems pearls tidepearl ale mead dwarfale wine spirits honey preserves potions draught manatonic remedies flour salt kelpfert stew porridge meat smokedmeat fish saltedfish eggs deepegg bread cheese pie vegetables berries mandrake moonpetal mushrooms kelp milk salves rope dust runestone gildedidol hydrascale reefgold crownband crownstone crowncrest limestone marble granite leather coal'.split(' ');
for(const [w,classic] of [[390,false],[360,false],[390,true]]){
const p=await (await b.newContext({viewport:{width:w,height:844},deviceScaleFactor:2})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:'+(process.env.PORT||8138)+'/');await p.waitForFunction(()=>window.__game);await p.evaluate(()=>localStorage.clear());await p.reload();await p.waitForFunction(()=>window.__game);await p.waitForTimeout(1500);
await p.evaluate(([ids,c])=>{const g=__game;window.__noSave=true;g.s.classicEmoji=c;for(const k of ids)g.s.res[k]=(g.s.res[k]||0)+12;for(let i=0;i<3;i++){document.querySelector('#modal:not([hidden]) [data-a=close],[data-pp=closewn]')?.click();document.getElementById('wnpanel')?.remove();}
 const gr=window.__tabGroup('inv');document.querySelector('#tabs [data-group="'+gr+'"]')?.click();},[IDS,classic]);
await p.waitForTimeout(200);await p.evaluate(()=>document.querySelector('#subtabs [data-tab="inv"]')?.click());await p.waitForTimeout(1500);
const r=await p.evaluate(()=>{const im=[...document.querySelectorAll('#view .art img')];return {n:im.length,broken:im.filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src.split('/').pop()),b4:im.filter(i=>/bowl|meat|sheaf|vial|mug|crown/.test(i.src)).length,sw:document.documentElement.scrollWidth}});
ok(r.broken.length===0,'broken '+r.broken);ok(classic?r.b4===0:r.b4>5,`batch4 shown c${classic} ${r.b4}`);ok(r.sw<=w+1,'fits '+w);ok(!errs.length,'errs '+errs);
console.log('w',w,'classic',classic,JSON.stringify(r));
if(shots&&w===390){await p.evaluate(()=>{const h=[...document.querySelectorAll('h3')].find(x=>x.textContent.includes('Materials'));h&&h.scrollIntoView();});await p.waitForTimeout(300);await p.screenshot({path:SD+`r65-materials${classic?'-classic':''}.png`});}
if(shots&&w===390&&!classic){await p.evaluate(ids=>{const g=__game;const A=g.D.art;import('./js/art.js').then(m=>{const d=document.createElement('div');d.id='sheet';d.style.cssText='position:fixed;inset:0;z-index:9999;background:#2b2118;padding:8px;display:flex;flex-wrap:wrap;gap:6px;align-content:flex-start';d.innerHTML=ids.map(k=>`<div style="width:86px;color:#eee;font:10px sans-serif;text-align:center">${m.iconHtml(A,'res',k,null,{emoji:'·',size:48})}<br>${k}</div>`).join('');document.body.appendChild(d);});},IDS);await p.waitForTimeout(1500);await p.screenshot({path:SD+'r65-icon-sheet.png'});}
await p.close();}
await b.close();console.log('r65 browser fails',JSON.stringify(fails));process.exit(fails.length?1:0);
