// R62 browser check: Estate Map view draws, walkers move, pause when hidden, stand still with reduce-motion,
// no sideways scroll at 360 px (Classic on and off), plus early/developed screenshots.
import { chromium } from '/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core/index.mjs';
const URL='http://localhost:'+(process.env.PORT||8137)+'/', OUT='/workspace/fl-screenshots/';
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']}); const errs=[];
async function start(opts){
  const ctx=await b.newContext(opts); const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await ctx.addInitScript(()=>localStorage.setItem('fl-estview','map'));
  await p.goto(URL); await p.waitForTimeout(1200);
  await p.evaluate(()=>document.querySelector('#modal:not([hidden]) [data-a="crequick"]')?.click());
  await p.click('[data-a="slotnew"][data-v="2"]').catch(async()=>{await p.click('#savesbtn,[title*="Saves"]').catch(()=>{}); await p.click('[data-a="slotnew"][data-v="2"]');});
  await p.waitForTimeout(500); await p.click('[data-a="crestart"]'); await p.waitForTimeout(700);
  return {ctx,p};
}
const setup=(p,late)=>p.evaluate(late=>{const {s,E,D}=window.__game; E.skipTutorial&&E.skipTutorial(s);
  for(const k of Object.keys(s.res)) s.res[k]=1e7; s.res.coin=s.res.planks=s.res.stone=1e7;
  if(!s.land.includes('plot')) E.buyLand(s,'plot');
  if(late){ s.land=D.estate.lands.map(l=>l.id); for(const t of ['shack','smithy','herbgarden','sawmill','quarry','fields','kitchen','dock','warehouse']) E.buildStructure(s,t);
    for(const st of s.structures){ for(let i=0;i<3;i++) E.upgradeStructure&&E.upgradeStructure(s,st.uid); }
    for(const st of s.structures) if(st.type==='shack'){ E.upgradeStructure(s,st.uid,'cabin'); }
  } else E.buildStructure(s,'shack');
  document.querySelector('#modal')?.setAttribute('hidden','');
},late);
const goMap=async p=>{await p.evaluate(()=>document.querySelector('[data-tab="estate"]')?.click()); await p.waitForTimeout(300);
  await p.evaluate(()=>document.querySelector('[data-a="estview"][data-v="map"]')?.click()); await p.waitForTimeout(1500);};
const blank=p=>p.evaluate(()=>{const c=document.getElementById('estcanvas'); if(!c) return 'no canvas'; const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; const set=new Set(); for(let i=0;i<d.length;i+=4*97) set.add(d[i]+','+d[i+1]+','+d[i+2]); return set.size<20?'blank '+set.size:'';});
const over=async(p,tag)=>{const r=await p.evaluate(()=>({sw:document.documentElement.scrollWidth,W:innerWidth})); if(r.sw>r.W) errs.push(tag+' overflow '+JSON.stringify(r));};

// 1) normal size, early then developed
let {ctx,p}=await start({viewport:{width:1000,height:900}});
await setup(p,false); await goMap(p);
let bl=await blank(p); if(bl) errs.push('early '+bl);
const wc=await p.evaluate(()=>window.__estmap.walkers.size); if(wc<1) errs.push('no walkers');
const f1=await p.evaluate(()=>window.__estmap.frames); await p.waitForTimeout(1500); const f2=await p.evaluate(()=>window.__estmap.frames);
if(!(f2>f1+5)) errs.push('loop not running '+f1+'>'+f2);
await p.evaluate(()=>document.getElementById('estmap').scrollIntoView({block:'center'})); await p.waitForTimeout(300);
await p.screenshot({path:OUT+'r62-map-early.png'});
// hidden: loop must stop
await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}); document.dispatchEvent(new Event('visibilitychange'));});
await p.waitForTimeout(300); const h1=await p.evaluate(()=>window.__estmap.frames); await p.waitForTimeout(1500); const h2=await p.evaluate(()=>[window.__estmap.frames,window.__estmap.running]);
if(h2[0]!==h1||h2[1]) errs.push('walkers did not pause when hidden '+h1+' '+h2);
await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false}); document.dispatchEvent(new Event('visibilitychange'));});
await p.waitForTimeout(800); if(!(await p.evaluate(()=>window.__estmap.running))) errs.push('did not resume');
// taps: a building opens its card
await p.evaluate(()=>document.querySelector('.embld')?.click()); await p.waitForTimeout(400);
if(!(await p.evaluate(()=>document.querySelector('#estsel .card')))) errs.push('building tap opened nothing');
await setup(p,true); await p.waitForTimeout(1500);
bl=await blank(p); if(bl) errs.push('late '+bl);
const items=await p.evaluate(()=>document.querySelectorAll('#estmap .embld').length); if(items<6) errs.push('late items '+items);
await p.evaluate(()=>document.getElementById('estmap').scrollIntoView({block:'center'})); await p.waitForTimeout(500);
await p.screenshot({path:OUT+'r62-map-late.png'});
await ctx.close();
// 2) reduce motion: no loop, still drawn
({ctx,p}=await start({viewport:{width:1000,height:900},reducedMotion:'reduce'}));
await setup(p,false); await goMap(p);
const r=await p.evaluate(()=>[window.__estmap.running,window.__estmap.frames]); await p.waitForTimeout(1200); const r2=await p.evaluate(()=>window.__estmap.frames);
if(r[0]||r2>r[1]+2) errs.push('reduce-motion still animating '+r+' '+r2);
if(await blank(p)) errs.push('reduce-motion blank');
await ctx.close();
// 3) 360 px, Classic off and on
for(const classic of [false,true]){
  ({ctx,p}=await start({viewport:{width:360,height:740}}));
  await setup(p,true); await p.evaluate(c=>{window.__game.s.classicEmoji=c;},classic); await goMap(p);
  if(!(await p.evaluate(()=>!!document.getElementById('estmap')))) errs.push('no map at 360 classic='+classic);
  if(classic && !(await p.evaluate(()=>document.querySelectorAll('#estmap .emwalk').length))) errs.push('classic walkers missing');
  await over(p,'360 map classic='+classic);
  await ctx.close();
}
console.log('r62 map errs',JSON.stringify(errs)); await b.close(); process.exit(errs.length?1:0);
