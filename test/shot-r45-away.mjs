const {chromium}=await import('/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core/index.mjs');
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const go=async(p,t)=>{await p.evaluate(t=>{const g=window.__tabGroup(t);document.querySelector('#tabs [data-group="'+g+'"]').click();},t);await p.waitForTimeout(150);await p.evaluate(t=>{const b=document.querySelector('#subtabs [data-tab="'+t+'"]');if(b)b.click();},t);await p.waitForTimeout(400);};
const p=await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2})).newPage();
const errs=[];p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});p.on('pageerror',e=>errs.push(String(e)));
const O='/workspace/fl-screenshots/';
const unhide=()=>p.evaluate(()=>{for(const x of document.querySelectorAll('*'))if(x.style.display==='none')x.style.display='';});
const clip=async(sel,path,pre=0,post=0)=>{const r=await p.evaluate(([sel,pre,post])=>{for(const x of document.querySelectorAll('*')){const c=getComputedStyle(x);if(c.position==='fixed'||c.position==='sticky')x.style.display='none';}const e=document.querySelector(sel);e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY-pre,width:r.width,height:Math.min(r.height+pre+post,1700)};},[sel,pre,post]);await p.waitForTimeout(150);await p.screenshot({path,clip:r,fullPage:true});await unhide();};
await p.goto('http://localhost:8080/');await p.waitForFunction(()=>window.__game);await p.evaluate(()=>{localStorage.clear();localStorage.setItem('fl-whatsnew','R45');});await p.reload();await p.waitForTimeout(2000);
await p.evaluate(()=>{const g=__game;g.s.tut.skipped=true;g.s.lastSave=Date.now()-3*3600e3;document.dispatchEvent(new Event('visibilitychange'));});await p.waitForTimeout(1500);
const ok=await p.evaluate(()=>[...document.querySelectorAll('h3')].some(h=>/While you were away/.test(h.textContent)));console.log('away',ok);
if(ok){await p.evaluate(()=>{const h=[...document.querySelectorAll('h3')].find(h=>/While you were away/.test(h.textContent));h.closest('.card').id='awaycard';});await p.evaluate(()=>{for(const b of document.querySelectorAll('button'))if(b.textContent.trim()==='×'&&b.closest('.card')?.textContent.includes("What's new"))b.click();});await p.waitForTimeout(400);await p.screenshot({path:O+'r45-away-banked.png'});}
console.log('errors',errs);await b.close();
