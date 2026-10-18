const {chromium}=await import('/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core/index.mjs');
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const go=async(p,t)=>{await p.evaluate(t=>{const g=window.__tabGroup(t);document.querySelector('#tabs [data-group="'+g+'"]').click();},t);await p.waitForTimeout(150);await p.evaluate(t=>{const b=document.querySelector('#subtabs [data-tab="'+t+'"]');if(b)b.click();},t);await p.waitForTimeout(400);};
const p=await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2})).newPage();
const errs=[];p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8080/');await p.waitForFunction(()=>window.__game);await p.evaluate(()=>localStorage.clear());await p.reload();await p.waitForTimeout(2500);
const O='/workspace/fl-screenshots/';
const unhide=()=>p.evaluate(()=>{for(const x of document.querySelectorAll('*'))if(x.style.display==='none')x.style.display='';});
const clip=async(sel,path,pre=0,post=0)=>{const r=await p.evaluate(([sel,pre,post])=>{for(const x of document.querySelectorAll('*')){const c=getComputedStyle(x);if(c.position==='fixed'||c.position==='sticky')x.style.display='none';}const e=document.querySelector(sel);e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY-pre,width:r.width,height:Math.min(r.height+pre+post,1700)};},[sel,pre,post]);await p.waitForTimeout(150);await p.screenshot({path,clip:r,fullPage:true});await unhide();};
// R39 label check: no visible "undefined"/"NaN" text on any tab, with many goods held and towns open
await p.evaluate(()=>{const g=__game,E=g.E,s=g.s,D=g.D;s.tut.skipped=true;for(const t of D.towns)for(const k of Object.keys(t.prices))s.res[k]=50;s.res.coin=1e5;
  s.wevents=[];E.startEvent(s,'shortage','ashford',16,'leather');E.startEvent(s,'glut','millbrook',12,'wheat');});
const tabs=await p.evaluate(()=>[...document.querySelectorAll('#tabs [data-group]')].map(x=>x.dataset.group));
const bad=[];
for(const grp of tabs){await p.evaluate(g=>document.querySelector('#tabs [data-group="'+g+'"]').click(),grp);await p.waitForTimeout(250);
  const subs=await p.evaluate(()=>[...document.querySelectorAll('#subtabs [data-tab]')].map(x=>x.dataset.tab));
  for(const t of (subs.length?subs:[null])){if(t){await p.evaluate(t=>document.querySelector('#subtabs [data-tab="'+t+'"]').click(),t);await p.waitForTimeout(250);}
    const hits=await p.evaluate(()=>{const out=[];const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode()))if(/undefined|NaN/.test(n.textContent))out.push(n.textContent.trim().slice(0,60));for(const e of document.querySelectorAll('[title]'))if(/undefined|NaN/.test(e.title))out.push('title:'+e.title.slice(0,60));return out;});
    for(const h of hits)bad.push(grp+'/'+t+': '+h);}}
console.log('tabs',tabs.length,'bad',bad.length);for(const x of [...new Set(bad)].slice(0,40))console.log(' ',x);
console.log('errors',errs);await b.close();if(bad.length||errs.length)process.exit(1);
