// R67 browser check: painted rooms (scene + legend), map exteriors (reuse + batch3c), Classic on/off, 390/360px.
// usage: PORT=8137 node test/r67-browser.mjs [--shots]
const {chromium}=await import(process.env.PW_CORE||'/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core/index.mjs');
const shots=process.argv.includes('--shots'), SD='/workspace/fl-screenshots/';
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};
const ROOMS=[['st901','house-beds'],['st900','workshop-forge'],['st903','mine'],['st904','sacred']];
async function run(w,classic){
const p=await (await b.newContext({viewport:{width:w,height:844},deviceScaleFactor:2})).newPage();
const errs=[],bad=[],art=new Set();p.on('pageerror',e=>errs.push(e.message));
p.on('response',r=>{const u=r.url();if(r.status()>=400)bad.push(u);if(/\/art\/(rooms|estate)\//.test(u))art.add(u.replace(/.*\/art\//,''));});
await p.goto('http://localhost:'+(process.env.PORT||8137)+'/');await p.waitForFunction(()=>window.__game);await p.evaluate(()=>localStorage.clear());await p.reload();await p.waitForFunction(()=>window.__game);await p.waitForTimeout(1500);
await p.evaluate(c=>{const g=__game,s=g.s;window.__noSave=true;s.classicEmoji=c;s.land=g.D.estate.lands.slice(0,8).map(l=>l.id);
 s.structures.push({uid:'st900',type:'smithy',pieces:['forge','workbench','steelanvil'],up:2,fittings:['runedanvil']},{uid:'st901',type:'house',pieces:['bunk','bunk','bunk','larder','loom'],up:0},
  {uid:'st903',type:'mineshaft',pieces:['shaftlift','orecart'],up:1},{uid:'st904',type:'shrinehouse',pieces:['altar','infirmary'],up:1},
  {uid:'st905',type:'fishinghut',pieces:['fishrack'],up:0},{uid:'st906',type:'magestower',pieces:['arcanefocus'],up:0},{uid:'st907',type:'barracks',pieces:['weaponrack'],up:3},
  {uid:'st908',type:'apiary',pieces:['hives'],up:1},{uid:'st909',type:'brewery',pieces:['brewvats'],up:0},{uid:'st910',type:'herbalistshack',pieces:['remedybench'],up:0},{uid:'st911',type:'tannery',pieces:['tanvats'],up:2});
 for(let i=0;i<3;i++){document.querySelector('#modal:not([hidden]) [data-a=close],[data-pp=closewn]')?.click();document.getElementById('wnpanel')?.remove();}
 const gr=window.__tabGroup('estate');document.querySelector('#tabs [data-group="'+gr+'"]')?.click();},classic);
await p.waitForTimeout(200);await p.evaluate(()=>document.querySelector('#subtabs [data-tab="estate"]')?.click());await p.waitForTimeout(400);
// map
await p.evaluate(()=>document.querySelector('[data-a=estview][data-v=map]')?.click());await p.waitForTimeout(1500);
const mp=await p.evaluate(()=>{const e=document.getElementById('estmap');if(!e)return null;e.scrollIntoView();const L=window.__estmap.layout;return {n:L?L.items.length:0,imgs:L?L.items.filter(i=>i.img).map(i=>i.img):[],sw:document.documentElement.scrollWidth}});
ok(mp,'map '+w);
if(mp&&!classic){for(const k of ['hut-1','tower-1','fort-3']) ok(mp.imgs.includes(k),'map uses '+k);ok([...art].some(a=>a.startsWith('estate/hut-')),'hut loaded');}
if(classic) ok(![...art].length,'classic loads no art: '+[...art].join());
if(shots&&w===390&&!classic){await p.waitForTimeout(500);await (await p.$('#estmap')).screenshot({path:SD+'r67-map-reuse-new.png'});}
// rooms via List
await p.evaluate(()=>document.querySelector('[data-a=estview][data-v=list]')?.click());await p.waitForTimeout(300);
for(const [uid,nm] of ROOMS){
 await p.evaluate(u=>document.querySelector('.rmbtn[data-v="'+u+'"]')?.click(),uid);await p.waitForTimeout(1100);
 const r=await p.evaluate(async()=>{const e=document.querySelector('.estroom');if(!e)return null;e.scrollIntoView({block:'center'});
  const im=[...e.querySelectorAll('.rmscene img')];await Promise.all(im.map(i=>i.decode().catch(()=>0)));
  const sc=e.querySelector('.rmscene'),bx=e.getBoundingClientRect(),sb=sc&&sc.getBoundingClientRect();
  return {hit:e.querySelectorAll('.rmscene .rmhit').length,scene:!!sc,imgs:im.length,broken:im.filter(i=>!i.naturalWidth).length,emo:e.querySelectorAll('.rmscene .rmemo:not(.rmatt)').length,att:e.querySelectorAll('.rmscene .rmatt').length,free:e.querySelectorAll('.rmfree').length,right:bx.right,sr:sb?sb.right:0,sw:document.documentElement.scrollWidth,bed:e.innerHTML.includes('pieces/bed.webp'),forge:e.innerHTML.includes('pieces/forge.webp')}});
 ok(r,'room '+uid);if(!r)continue;
 ok(r.right<=w+1&&r.sw<=w+1,`fits ${uid} ${w}`);
 if(classic) ok(!r.scene&&!r.imgs,'classic no scene '+uid);
 else{ok(r.scene&&(r.imgs>0||r.hit>0)&&!r.broken&&!r.emo,`scene ${uid} ${JSON.stringify(r)}`);if(uid==='st901')ok(r.bed,'beds drawn');if(uid==='st900')ok(r.hit>=4&&!r.bed,'painted forge, no bed (R68.2)');if(uid==='st903')ok(!r.bed,'no bed in mine');}
 if(shots&&!classic){const e=await p.$('.estroom');if(w===390)await e.screenshot({path:SD+`r67-room-${nm}.png`});if(w===360&&uid==='st901')await e.screenshot({path:SD+'r67-room-house-360.png'});}
 await p.evaluate(()=>document.querySelector('.estroom [data-a=estroom]')?.click());await p.waitForTimeout(200);
}
ok(!bad.length,'404s '+bad.join());ok(!errs.length,'errors '+errs.join('|'));
console.log('w',w,'classic',classic,'mapItems',mp&&mp.n,'art files',art.size,'errs',errs.length,'404',bad.length);await p.close();}
for(const c of [false,true])for(const w of [390,360])await run(w,c);
await b.close();console.log('r67 browser fails',JSON.stringify(fails));process.exit(fails.length?1:0);
