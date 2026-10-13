const {chromium}=await import(process.env.PW_CORE||'/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core/index.mjs');
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const p=await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2})).newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:'+(process.env.PORT||8137)+'/');await p.waitForFunction(()=>window.__game);await p.evaluate(()=>localStorage.clear());await p.reload();await p.waitForTimeout(2000);
await p.evaluate(()=>{const g=__game,s=g.s,E=g.E;s.members[0].ageDays=25*360;Object.assign(s.res,{coin:1e6,wood:9e3,stone:9e3,planks:3e3,blocks:3e3,ingots:2e3,copper:900,cloth:300,dust:300,food:1e4,herbs:500});
 for(let k=0;k<3;k++) for(const l of g.D.estate.lands) E.buyLand(s,l.id); window.__iss=['barracks','shrinehouse','magestower'].map(t=>E.structIssue(s,t));
 const bh=E.buildStructure(s,'bunkhouse')||s.structures.push({uid:'bhz',type:'bunkhouse',pieces:[],up:0});
 const g1=E.buildStructure(s,'barracks'); for(let i=0;i<3;i++)E.upgradeSpecial(s,g1.uid);
 const sh=E.buildStructure(s,'shrinehouse'); for(let i=0;i<3;i++)E.upgradeSpecial(s,sh.uid); E.specialize(s,g1.uid,'knightshall');
 const tw=E.buildStructure(s,'magestower'); for(let i=0;i<3;i++)E.upgradeSpecial(s,tw.uid);
 if(!s.structures.some(x=>x.type==='bunkhouse')) s.structures.push({uid:'bhz',type:'bunkhouse',pieces:[],up:0});
 const a=E.addMinion(s,'laborer','t'); if(a){a.cls='n_knighterrant';a.lvl=20;a.xp=0;a.name='Sir Aldric';}
 const c=E.addMinion(s,'laborer','t'); if(c){c.cls='n_adept';c.lvl=15;c.name='Mira';}
 window.__tw=tw.uid; g.save&&g.save();});
await p.click('[data-tab="estate"]');await p.waitForTimeout(500);
const card=await p.evaluateHandle(()=>[...document.querySelectorAll('.card')].find(x=>x.textContent.includes("Hedge Mage's Hut")&&x.textContent.includes('Specialise')));
await card.asElement().scrollIntoViewIfNeeded(); await card.asElement().screenshot({path:'screenshot-estate-chain.png'});
await p.click('[data-tab="minions"]');await p.waitForTimeout(500);
const mc=await p.evaluateHandle(()=>[...document.querySelectorAll('.card')].find(x=>x.textContent.includes('Sir Aldric')));
await mc.asElement().scrollIntoViewIfNeeded(); await mc.asElement().screenshot({path:'screenshot-evolve-picker.png'});
console.log('pal',await mc.asElement().evaluate(x=>x.textContent.match(/Paladin[^)]*\)/)?.[0]));
const w=await p.evaluate(()=>[...document.querySelectorAll('div')].map(x=>x.textContent).find(t=>/Witch/.test(t)&&/Estate needs/.test(t)&&t.length<200));
console.log('witch',w,'errs',errs);await b.close();
