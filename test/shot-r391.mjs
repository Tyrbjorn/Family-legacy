const {chromium}=await import('/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core/index.mjs');
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const go=async(p,t)=>{await p.evaluate(t=>{const g=window.__tabGroup(t);document.querySelector('#tabs [data-group="'+g+'"]').click();},t);await p.waitForTimeout(150);await p.evaluate(t=>{const b=document.querySelector('#subtabs [data-tab="'+t+'"]');if(b)b.click();},t);await p.waitForTimeout(400);};
const p=await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2})).newPage();
const errs=[];p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});p.on('pageerror',e=>errs.push(String(e)));
const O='/workspace/fl-screenshots/';
const unhide=()=>p.evaluate(()=>{for(const x of document.querySelectorAll('*'))if(x.style.display==='none')x.style.display='';});
const clip=async(sel,path,pre=0,post=0)=>{const r=await p.evaluate(([sel,pre,post])=>{for(const x of document.querySelectorAll('*')){const c=getComputedStyle(x);if(c.position==='fixed'||c.position==='sticky')x.style.display='none';}const e=document.querySelector(sel);e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY-pre,width:r.width,height:Math.min(r.height+pre+post,1700)};},[sel,pre,post]);await p.waitForTimeout(150);await p.screenshot({path,clip:r,fullPage:true});await unhide();};
const fail=m=>{console.error('FAIL',m);process.exitCode=1;};
await p.goto('http://localhost:8080/');await p.waitForFunction(()=>window.__game);await p.evaluate(()=>localStorage.clear());await p.reload();await p.waitForTimeout(2000);
{const f=await (await b.newContext({viewport:{width:390,height:844}})).newPage();await f.goto('http://localhost:8080/');await f.waitForFunction(()=>window.__game);await f.waitForTimeout(1200);
 if(await f.evaluate(()=>!!document.querySelector('#wnpanel:not([hidden])')||localStorage.getItem('fl-whatsnew')===null))fail('fresh player should not see What\'s new');await f.close();}
// existing player after an update: popup once
await p.evaluate(()=>{__game.s.tut.skipped=true;localStorage.removeItem('fl-whatsnew');});await p.waitForTimeout(700);await p.reload();await p.waitForTimeout(2000);
if(!await p.evaluate(()=>!!document.querySelector('#wnpanel:not([hidden])')))fail('What\'s new should show after update');
await p.screenshot({path:O+'r391-whats-new.png'});
await p.evaluate(()=>document.querySelector('#wnpanel [data-pp="closewn"]').click());await p.reload();await p.waitForTimeout(2000);
if(await p.evaluate(()=>!!document.querySelector('#wnpanel:not([hidden])')))fail('What\'s new shown twice');
// tester link
await p.goto('http://localhost:8080/?tester=tester1');await p.waitForTimeout(2200);
const t=await p.evaluate(()=>({badge:!!document.querySelector('#testerbadge'),dev:__game.E.devOn(),key:localStorage.getItem('fl-pass'),inSave:/tester1/.test(localStorage.getItem('familyLegacy.slot.1')||'')}));
if(!t.badge||t.dev||t.key!=='tester1'||t.inSave)fail('tester link '+JSON.stringify(t));
{const r=await p.evaluate(()=>{const e=document.querySelector('#top').getBoundingClientRect();return e.height});await p.screenshot({path:O+'r391-tester-badge.png',clip:{x:0,y:0,width:390,height:Math.min(220,Math.ceil(r))}});}
await p.evaluate(()=>document.querySelector('#savesbtn').click());await p.waitForTimeout(800);
await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:O+'r391-saves-whatsnew.png'});
await p.evaluate(()=>document.querySelector('[data-pp="whatsnew"]').click());await p.waitForTimeout(400);
if(await p.evaluate(()=>document.querySelectorAll('#wnpanel .wnentry').length)<5)fail('reopen shows all entries');
await p.evaluate(()=>document.querySelector('#wnpanel [data-pp="closewn"]').click());
// hide badge
await p.evaluate(()=>document.querySelector('[data-pp="hidebadge"]').click());await p.waitForTimeout(900);
if(await p.evaluate(()=>!!document.querySelector('#testerbadge')))fail('badge hide');
// release build (served by the caller on :8091): ?dev=1 ignored, tester link works
if(process.env.REL){const q=await (await b.newContext({viewport:{width:390,height:844}})).newPage();q.on('pageerror',e=>errs.push('rel '+e));
  await q.goto('http://localhost:8091/?dev=1&tester=tester2');await q.waitForFunction(()=>window.__game);await q.waitForTimeout(1500);
  const r=await q.evaluate(()=>({dev:__game.E.devOn(),locked:__game.E.devLocked(),key:localStorage.getItem('fl-dev'),devbadge:!!document.querySelector('.devbadge'),tester:!!document.querySelector('#testerbadge')}));
  console.log('release',JSON.stringify(r));if(r.dev||!r.locked||r.key||r.devbadge||!r.tester)fail('release build');}
console.log('errors',errs);if(errs.length)process.exitCode=1;await b.close();
