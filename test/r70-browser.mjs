// R70 browser check: each painted room opens at 390 and 360px, loads its own background (no 404, no page errors, no overflow),
// has its hit areas and add-ons inside the scene, and Classic emoji mode draws no art. PORT=8137 node test/r70-browser.mjs
const {chromium}=await import(process.env.PW_CORE||'/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core/index.mjs');
const PORT=process.env.PORT||8137, fails=[];
const ROOMS={barracks:['weaponrack','bunk','pells','storage'],chickencoop:['nestboxes','oven','larder','storage'],cowpen:['milkstalls','churn','larder','storage'],kitchen:['range','oven','smoker','churn','hearth'],sawmill:['sawtable','storage','workbench','charcoalkiln'],tannery:['tanvats','loom','workbench','storage'],bunkhouse:['bunk','storage'],brewery:['brewvats','caskrack','storage'],hall:['feasttable','workbench','storage']};
const FILE={barracks:'room-barracks',chickencoop:'room-chickencoop',cowpen:'room-cowpen',kitchen:'room-kitchen-hearth',sawmill:'room-sawmill',tannery:'room-tannery',bunkhouse:'room-bunkhouse',brewery:'room-kitchen',hall:'room-lodge'};
const HITS={barracks:3,chickencoop:4,cowpen:4,kitchen:4,sawmill:3,tannery:4,bunkhouse:4,brewery:0,hall:0};
const b=await chromium.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',args:['--no-sandbox']});
for(const [w,classic] of [[390,false],[360,false],[360,true]]){
  const p=await (await b.newContext({viewport:{width:w,height:800}})).newPage(); const errs=[],bad=[];
  p.on('pageerror',e=>errs.push(e.message)); p.on('response',r=>{if(r.status()>=400)bad.push(r.url());});
  await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(()=>window.__game); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForFunction(()=>window.__game); await p.waitForTimeout(1200);
  const names=Object.keys(ROOMS);
  await p.evaluate(([R,classic])=>{const g=__game,s=g.s; s.classicEmoji=classic; s.land=g.D.estate.lands.slice(0,8).map(l=>l.id); let i=0; for(const t in R) s.structures.push({uid:'rb'+(i++),type:t,pieces:R[t],up:3,fittings:[]}); },[ROOMS,classic]);
  await p.evaluate(()=>document.querySelector('#tabs [data-group="'+window.__tabGroup('estate')+'"]')?.click()); await p.waitForTimeout(200); await p.evaluate(()=>document.querySelector('#subtabs [data-tab="estate"]')?.click()); await p.waitForTimeout(400);
  await p.evaluate(()=>document.querySelector('[data-a=estview][data-v=list]')?.click()); await p.waitForTimeout(300);
  for(const [i,t] of names.entries()){
    await p.evaluate(u=>document.querySelector('.rmbtn[data-v="'+u+'"]')?.click(),'rb'+i); await p.waitForTimeout(900);
    const r=await p.evaluate(()=>{const e=document.querySelector('.estroom'); if(!e)return null; const sc=e.querySelector('.rmscene'),R=sc&&sc.getBoundingClientRect();
      const att=[...e.querySelectorAll('.rmatt')].map(a=>{const q=a.getBoundingClientRect();return R&&q.left>=R.left-1&&q.right<=R.right+1&&q.top>=R.top-1&&q.bottom<=R.bottom+1;});
      return {scene:!!sc,bg:sc?sc.style.backgroundImage:'',hits:e.querySelectorAll('.rmhit').length,att,ok:att.every(Boolean),sw:document.documentElement.scrollWidth,imgs:e.querySelectorAll('img').length}; });
    const tag=`${w} classic ${classic} ${t}`;
    if(!r){fails.push(tag+' no room');continue;}
    if(r.sw>w)fails.push(tag+' overflow '+r.sw);
    if(classic){ if(r.scene||r.imgs||r.hits)fails.push(tag+' classic shows art'); }
    else { if(!r.bg.includes(FILE[t]+'.webp'))fails.push(tag+' bg '+r.bg); if(r.hits!==HITS[t])fails.push(tag+' hits '+r.hits); if(!r.ok)fails.push(tag+' add-on outside scene'); }
    await p.evaluate(()=>document.querySelector('.estroom [data-a=estroom]')?.click()); await p.waitForTimeout(150);
  }
  console.log('w',w,'classic',classic,'errs',errs.length,'404',bad.length); if(errs.length||bad.length)fails.push(`${w} ${classic} errs ${errs} 404 ${bad}`);
  await p.context().close();
}
await b.close(); console.log('r70 browser fails',JSON.stringify(fails)); process.exit(fails.length?1:0);
