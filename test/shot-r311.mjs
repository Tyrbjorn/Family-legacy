// R31.1 map zoom screenshots: TAG=before|after, phone width 470
const {chromium}=await import(process.env.PW_CORE||'/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core/index.mjs');
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const p=await (await b.newContext({viewport:{width:470,height:900},deviceScaleFactor:2})).newPage();
const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8080/');await p.waitForFunction(()=>window.__game);await p.evaluate(()=>localStorage.clear());await p.reload();await p.waitForTimeout(2000);
await p.evaluate(()=>{const g=__game;g.s.tut.skipped=true;g.E.revealAt&&['thornwick'].forEach(()=>{});g.E.setAction(g.s,{type:'quest',target:'rats'});});
await p.evaluate(()=>{const t=document.querySelector('#tabs [data-group="map"]')||[...document.querySelectorAll('#tabs button')].find(x=>/Map/.test(x.textContent));t.click();});await p.waitForTimeout(800);
const T=process.env.TAG||'after', O='/workspace/fl-screenshots/r31-1-';
const shot=async n=>{await p.waitForTimeout(700);const el=await p.$('#worldmap');await el.screenshot({path:O+T+'-'+n+'.png'});};
await shot('mid');
await p.click('[data-a=zoom][data-v="0"]');await shot('far');
await p.click('[data-a=zoom][data-v="0"]');await p.click('[data-a=zoom][data-v="0.7"]');await p.waitForTimeout(200);await p.click('[data-a=zoom][data-v="0.7"]');await p.waitForTimeout(200);await p.click('[data-a=zoom][data-v="0.7"]');await shot('near');
await p.click('[data-a=zoom][data-v="0"]');await p.click('[data-a=zoom][data-v="0.7"]');await p.waitForTimeout(300);
const hb=await p.evaluate(()=>{const t=[...document.querySelectorAll('#worldmap text')].find(x=>x.textContent==='🏡');const r=t.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
await p.mouse.move(hb.x,hb.y);for(let i=0;i<5;i++){await p.mouse.wheel(0,-120);await p.waitForTimeout(80);}await shot('home-near');
// glide check: marker transform changes smoothly between ticks
const tr=[];for(let i=0;i<6;i++){tr.push(await p.evaluate(()=>{const c=document.querySelector('#worldmap .tv');return c?c.style.transform:null;}));await p.waitForTimeout(120);}console.log('tv transforms',tr.join(' | '));
console.log('errors',errs);await b.close();
