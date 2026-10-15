const {chromium}=await import('/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core/index.mjs');
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const go=async(p,t)=>{await p.evaluate(t=>{const g=window.__tabGroup(t);document.querySelector('#tabs [data-group="'+g+'"]').click();},t);await p.waitForTimeout(150);await p.evaluate(t=>{const b=document.querySelector('#subtabs [data-tab="'+t+'"]');if(b)b.click();},t);};
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});const p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>m.type()==='error'&&errs.push(m.text()));p.on('dialog',d=>d.accept());
const U='http://localhost:8137/';
await p.goto(U);await p.waitForFunction(()=>window.__game);await p.evaluate(()=>localStorage.clear());await p.reload();await p.waitForFunction(()=>window.__game);await p.waitForTimeout(1500);
await p.screenshot({path:'/workspace/fl-screenshots/screenshot-tutorial.png'});
await p.click('[data-a="tourstart"]');await p.waitForTimeout(400);await p.click('[data-a="tournext"]');await p.waitForTimeout(700);await p.screenshot({path:'/workspace/fl-screenshots/screenshot-tour.png'});
await p.click('.tourtip [data-a="tourend"]');
// tutorial step 1 equip via engine, then craft button
await p.evaluate(()=>{const g=__game;g.E.equip(g.s,g.E.active(g.s),'rusty_sword');g.E.tutCheck(g.s);});
await go(p,'main');await p.waitForTimeout(800);
console.log('step',await p.evaluate(()=>__game.s.tut.step));
// make a family for the tree
await p.evaluate(()=>{const g=__game,s=g.s,E=g.E,F=E.active(s);F.ageDays=40*g.D.tuning.daysPerYear;F.traits=['chosen','nimble'];s.res.coin=9000;
 const sp=E.newMember(s,{gender:F.gender==='m'?'f':'m',age:38});sp.name='Ysolde';sp.spouse=F.id;F.spouse=sp.id;s.members.push(sp);
 for(let i=0;i<3;i++){const k=E.newMember(s,{age:16+i*2,parents:[F.id,sp.id]});k.traits=[['ironblood','curious'],['prodigy'],['lazy','keeneyed']][i];s.members.push(k);}
 const k0=s.members[2];const sp2=E.newMember(s,{gender:k0.gender==='m'?'f':'m',age:20});sp2.spouse=k0.id;k0.spouse=sp2.id;s.members.push(sp2);
 const gk=E.newMember(s,{age:1,parents:[k0.id,sp2.id]});s.members.push(gk);
 const old=E.newMember(s,{age:70});old.name='Elder Bram';s.members.push(old);F.parents=[old.id];E.kill(s,old,'died of old age');
 E.notify(s,'family','👶 A child was born.');E.notify(s,'craft','🔨 Crafted a Charm.');E.notify(s,'craft','🔨 Crafted a Charm.');});
await go(p,'family');await p.waitForTimeout(800);await p.click('.tnode >> nth=1');await p.waitForTimeout(500);await p.screenshot({path:'/workspace/fl-screenshots/screenshot-family-tree.png',fullPage:true});
await p.click('[data-a="dock"]');await p.waitForTimeout(600);await p.screenshot({path:'/workspace/fl-screenshots/screenshot-timers-dock.png'});
console.log('dock persisted',await p.evaluate(()=>localStorage.getItem('fl-dock')));
await p.click('button.bell');await p.waitForTimeout(400);await p.screenshot({path:'/workspace/fl-screenshots/screenshot-notifications.png'});await p.click('.bellpanel [data-a="bell"]');
await p.goto(U+'?dev=1');await p.waitForFunction(()=>window.__game);await p.waitForTimeout(800);
const opts=await p.$$eval('select[data-a="speed"] option',o=>o.map(x=>x.value));console.log('dev speeds',opts);
await p.selectOption('select[data-a="speed"]','50');await p.waitForTimeout(1500);
console.log('devRun',await p.evaluate(()=>__game.s.devRun),'devkey in save',await p.evaluate(()=>/fl-dev|devMode/.test(__game.E.serialize(__game.s))));
await go(p,'main');await p.waitForTimeout(300);
await p.evaluate(()=>document.querySelector('[data-a="devmode"]').scrollIntoView());await p.waitForTimeout(300);await p.screenshot({path:'/workspace/fl-screenshots/screenshot-devmode.png'});
console.log('errs',errs);await b.close();
