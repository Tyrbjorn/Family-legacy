const {chromium}=await import('/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core/index.mjs');
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const p=await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2})).newPage();
const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8080/');await p.waitForFunction(()=>window.__game);await p.evaluate(()=>localStorage.clear());await p.reload();await p.waitForTimeout(2500);
const O='/workspace/fl-screenshots/';
const clip=async(sel,path)=>{await p.waitForTimeout(250);const r=await p.evaluate(sel=>{const e=eval(sel);e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height};},sel);await p.screenshot({path,clip:r,fullPage:true});};
await p.evaluate(()=>{const g=__game,s=g.s;s.tut.skipped=true;s.vault.push('smallboat');for(const m of s.members)m.skills.fishing.lvl=30;s.res.fish=0;s.fishBag={};
  const m=s.members[0];for(let i=0;i<40;i++)g.E.landFish(s,1.5,m);});
await p.waitForTimeout(1200);
await clip(`document.querySelector('[data-a=activity][data-v=fishing]').closest('.card')`,O+'r32-fish-task-picker.png');
// catch log: the newest log lines (species catches)
const logSel=await p.evaluate(()=>{const el=[...document.querySelectorAll('*')].filter(e=>e.children.length<60&&/🎣/.test(e.textContent)&&/Mirror Trout|Sturgeon/.test(e.textContent)&&!e.querySelector('[data-a=activity]'));return el.length?1:0;});
if(!logSel){await p.evaluate(()=>{const t=[...document.querySelectorAll('#tabs button, #tabs [data-group]')].find(x=>/Log|Chron|📜/.test(x.textContent));t&&t.click();});await p.waitForTimeout(800);}
await p.waitForTimeout(300);{const r=await p.evaluate(()=>{const h=[...document.querySelectorAll('h3')].find(x=>/📜 Recent/.test(x.textContent));for(const x of document.querySelectorAll('*')){const c=getComputedStyle(x);if(c.position==='fixed'||c.position==='sticky')x.style.display='none';}h.scrollIntoView({block:'center'});let e=h,last=h;for(let i=0;i<8&&e.nextElementSibling&&e.nextElementSibling.tagName==='DIV'&&e.nextElementSibling.className==='muted';i++){e=e.nextElementSibling;last=e;}const a=h.getBoundingClientRect(),z=last.getBoundingClientRect();return {x:a.x+scrollX-6,y:a.y+scrollY-4,width:Math.max(a.width,z.width)+12,height:z.bottom-a.top+8};});await p.screenshot({path:O+'r32-fish-catch-log.png',clip:r,fullPage:true});}
console.log('errors',errs);await b.close();
