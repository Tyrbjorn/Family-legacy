// R59b layout check: creation screen and the game right after Begin must not scroll sideways at 360 px
import { chromium } from '/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core/index.mjs';
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']}); const errs=[];
const p=await b.newPage({viewport:{width:360,height:740}}); p.on('pageerror',e=>errs.push(e.message));
p.on('dialog',d=>d.accept());
await p.goto('http://localhost:'+(process.env.PORT||8137)+'/'); await p.waitForTimeout(1500);
const over=async tag=>{const r=await p.evaluate(()=>{const W=innerWidth;const bad=[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.right>W+1&&!e.closest('#modal')}).map(e=>e.tagName+'.'+e.className);const m=document.querySelector('#modal .card');return {sw:document.documentElement.scrollWidth,W,bad:bad.slice(0,5),modal:m?m.scrollWidth>m.clientWidth+1:false}});if(r.sw>r.W||r.modal)errs.push(tag+' overflow '+JSON.stringify(r));};
await over('start');
await p.evaluate(()=>document.querySelector('#modal:not([hidden]) [data-a="crequick"]')?.click());
await p.click('[data-a="slotnew"][data-v="2"]').catch(async()=>{await p.click('#savesbtn,[title*="Saves"]').catch(()=>{}); await p.click('[data-a="slotnew"][data-v="2"]');});
await p.waitForTimeout(700); await over('creation');
await p.click('[data-a="crestart"]'); await p.waitForTimeout(800); await over('after Begin');
for(const t of ['main','family','estate']){await p.evaluate(t=>document.querySelector(`[data-tab="${t}"]`)?.click(),t);await p.waitForTimeout(400);await over('tab '+t);}
console.log('r59 layout errs',JSON.stringify(errs)); await b.close(); process.exit(errs.length?1:0);
