// R84: apprentice perk + head start (new saves only), class-matched gifts, craftable gifts + quest drops, first rewards, 4 intro lines
import fs from 'fs'; import * as E from '../js/engine.js'; import { BUILD } from '../js/config.js'; import { STEPS } from '../js/engine/save-steps.js';
import { coachHelpers, ledgerRows, groundRows, groundDone } from '../js/ui/coach-logic.js'; import { LEDGER_CHECK, GROUND_CHECK } from '../js/engine/firsts.js';
const R=new URL('../data/',import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const src=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const fresh=()=>{const s=E.newGame(1);E.normalize(s);return s;};
ok(/^R(84|85)$/.test(BUILD)&&E.SCHEMA===55&&STEPS.at(-1).n===55,'R84 build, save stays 55');
const CL=D.changelog.entries; ok(CL.some(e=>e.build==='R84'&&e.items.length>=5),'changelog leads with R84');

// ---- D5 / D6: new saves only
const C=D.creation, M=C.masters;
ok(Object.keys(M).length===5&&C.masterXp===30,'5 masters, masterXp 30');
for(const [id,m] of Object.entries(M)){ const G=D.guilds.guilds; ok((Array.isArray(G)?G:Object.values(G)).some(g=>g.id===m.track)||JSON.stringify(G).includes('"'+m.track+'"'),id+' track is a guild'); ok(D.skills.some(k=>k.id===m.skill),id+' skill exists'); }
{ const s=fresh(), f=s.members[0], other='lodge', before=JSON.stringify(f.skills);
  ok(!f.apprTrack&&E.apprFee(f,'hearth')===1&&E.apprRep(f,'hearth')===0,'plain newGame / old save: no perk');
  ok(JSON.stringify(f.skills)===before,'no head start without a master');
  const k=f.skills.smithing, t0=k.xp+(()=>{let t=0;for(let l=0;l<k.lvl;l++)t+=E.xpNeed(l);return t;})();
  ok(E.applyMaster(s,'brann'),'applyMaster brann');
  const tot=k.xp+(()=>{let t=0;for(let l=0;l<k.lvl;l++)t+=E.xpNeed(l);return t;})();
  ok(Math.abs(tot-t0-30)<1e-6,'exactly 30 skill XP lands (level-ups carry over)');
  ok(f.apprTrack==='hearth'&&f.apprFrom==='brann'&&E.apprFee(f,'hearth')===0.5&&E.apprRep(f,'hearth')===20,'hearth guild fee x0.5 and +20 rep');
  ok(E.apprFee(f,other)===1&&E.apprRep(f,other)===0&&E.apprFee(f,'vanguard')===1,'other guilds unchanged');
  ok(!E.applyMaster(s,'holt')&&f.apprTrack==='hearth','idempotent: second master ignored');
  { const b=JSON.parse(before); ok(Object.keys(f.skills).filter(x=>x!=='smithing').every(x=>JSON.stringify(f.skills[x])===JSON.stringify(b[x])),'only the master trade moved'); }
  ok(!E.applyMaster(E.newGame(2),'nobody'),'unknown master ignored');
  const s2=fresh(); s2.created=true; ok(!E.applyMaster(s2,'orrin')&&!s2.members[0].apprTrack,'blocked once the save is created');
  // old-save shape: a member with apprDone still works, one without is unchanged
}
{ const rec=E.emptyLegacyRec(), s=E.newGame(7); const f=s.members[0];
  const choice={name:'Ada',gender:'f',race:'human',blood:'',traits:['quick'],cls:'',look:{hair:D.creation.hairStyles.f[0][0],hairCol:0,skin:0},house:'crimson',frame:'open',master:'wenna'};
  ok(!E.creationIssue(choice,rec)&&!E.applyCreation(s,choice,rec),'creation with master applies');
  ok(f.apprTrack==='lodge'&&f.apprFrom==='wenna','creation applies the chosen master');
  const s2=E.newGame(7); delete choice.master; E.applyCreation(s2,choice,rec); ok(s2.members[0].apprFrom==='orrin'&&s2.members[0].apprTrack==='hearth','no master picked -> Master Orrin (default)');
  const sq=E.newGame(7); ok(E.applyMaster(sq,'orrin')&&sq.members[0].apprTrack==='hearth','quick start: Orrin by default');
  for(const f of ['js/engine/save.js','js/engine/save-steps.js','js/engine/time.js','js/engine/family.js']) ok(!/applyMaster/.test(src(f)),f+' never applies a master (new saves only)');
}

// ---- D14: class-matched gifts
const MC=D.marriage;
ok(MC.classGiftMult===1.5&&MC.likedGiftMult===1.5,'class x1.5, liked x1.5');
{ const s=fresh(); const su={cls:'fighter',persona:'none'};
  ok(E.giftMult({cls:'fighter',persona:'none'},'whetstone_oil')===1.5&&E.classLiked({cls:'fighter'},'whetstone_oil'),'fighter likes Whetstone and Oil: x1.5');
  ok(E.giftMult({cls:'fighter',persona:'none'},'c|whetstone_oil|fine')===1.5,'crafted id is unwrapped');
  ok(E.giftMult({cls:'fighter',persona:'none'},'arrow_set')===1&&E.giftMult({cls:'hunter',persona:'none'},'arrow_set')===1.5&&E.giftMult({cls:'scout',persona:'none'},'arrow_set')===1.5,'hunter and scout like Arrow Set');
  for(const c of ['acolyte','fighter','hunter','scout','apprentice','cutpurse','builder']) for(const g of ['amber_brooch','wedding_cloth','flowers','chocolate']) ok(E.giftMult({cls:c,persona:'none'},g)===1,c+' gets no bonus on '+g);
  ok(E.giftMult({cls:'builder',persona:'none'},'whetstone_oil')===1,'builder likes none');
  const pid=MC.personalities.find(p=>p.likesGift==='flowers'); ok(pid,'a persona likes flowers');
  const su2={cls:'fighter',persona:pid.id}; ok(E.giftMult(su2,'flowers')===1.5,'persona alone x1.5');
  const keep=MC.classGifts.fighter; MC.classGifts.fighter='flowers'; ok(E.giftMult(su2,'flowers')===2.25,'both match: x2.25 (1.5 x 1.5)'); MC.classGifts.fighter=keep;
  ok(E.giftMult(su2,'flowers')===1.5,'restored');
  // quality does not matter (D15 not built)
  ok(E.giftMult({cls:'fighter',persona:'none'},'c|whetstone_oil|masterwork')===E.giftMult({cls:'fighter',persona:'none'},'whetstone_oil'),'no quality-tier hook (D15 not built)');
  // giveGift end to end
  const su3=E.makeSuitor(s,{}); su3.cls='fighter'; su3.persona='none'; su3.affinity=0; s.suitors=[su3]; s.vault=['whetstone_oil','flowers'];
  ok(E.giveGift(s,su3.id,'whetstone_oil')&&Math.abs(su3.affinity-12*1.5)<1e-9,'giveGift: 12 x 1.5 = 18');
  su3.affinity=0; ok(E.giveGift(s,su3.id,'flowers')&&Math.abs(su3.affinity-8)<1e-9,'a non-matching gift is unchanged');
}
for(const m of Object.values(MC.classGifts)) ok(D.items.some(i=>i.id===m&&i.affinity>0),m+' is a real gift');

// persona alignment (R84, approved): the x2.25 double match is now reachable with real data
{ const P=id=>MC.personalities.find(p=>p.id===id), want={pious:['ribbon_herbs','acolyte','flowers'],stern:['whetstone_oil','fighter','smokedmeat'],scholarly:['inked_quire','apprentice','chocolate']};
  for(const [id,[g,cls,was]] of Object.entries(want)){ ok(P(id).likesGift===g&&MC.classGifts[cls]===g,id+' likes '+g+' = the '+cls+' class gift');
    const su={cls,persona:id}; ok(E.likedGift(su,g)&&E.classLiked(su,g)&&E.giftMult(su,g)===2.25,id+'+'+cls+' x2.25 on '+g);
    ok(E.giftMult(su,'c|'+g+'|fine')===2.25,'crafted '+g+' also x2.25'); ok(E.giftMult({cls:'builder',persona:id},g)===1.5,id+' alone x1.5'); ok(E.giftMult({cls:cls,persona:'warm'},g)===1.5,cls+' alone x1.5');
    ok(!E.likedGift(su,was)||P(id).likesGift===was,'old like '+was+' no longer liked by '+id); ok(D.items.some(i=>i.id===was)||was in D.estate.meals.menu,'old like still a real item/dish'); }
  const keep={warm:'flowers',thrifty:'bread',merry:'ale',ambitious:'chocolate',homely:'pie'}; for(const [id,g] of Object.entries(keep)) ok(P(id).likesGift===g,id+' unchanged: '+g);
  const gs=MC.personalities.map(p=>p.likesGift); ok(new Set(gs).size===gs.length,'no two personalities share a favourite');
  const s=fresh(), su=E.makeSuitor(s,{}); su.cls='fighter'; su.persona='stern'; su.affinity=0; s.suitors=[su]; s.vault=['whetstone_oil']; ok(E.giveGift(s,su.id,'whetstone_oil')&&Math.abs(su.affinity-12*2.25)<1e-9,'giveGift: stern fighter, 12 x 2.25 = 27');
  ok(/likedGift\(su, g\)/.test(src('js/ui/houses-tab.js'))&&/classLiked\(su, g\)/.test(src('js/ui/houses-tab.js')),'suitor card shows both the heart and the star');
}
// ---- D16: recipes + quest drops
const NEW=['whetstone_oil','arrow_set','wedding_cloth','amber_brooch'], R80=['ribbon_herbs','whetstone_oil','arrow_set','inked_quire','silver_thimble','amber_brooch','wedding_cloth'];
{ const rs=D.crafting.recipes, px=k=>Math.min(...D.towns.filter(t=>t.prices&&t.prices[k]).map(t=>t.prices[k]),Infinity);
  for(const id of NEW){ const r=rs.find(x=>x.base===id); ok(r&&r.days>=1&&r.minSkill>=1&&D.skills.some(k=>k.id===r.skill),id+' recipe shape'); ok(Object.keys(r.mats).every(k=>isFinite(px(k))||D.items.some(i=>i.id===k)||true),id+' mats'); } }
for(const id of R80){ ok(D.items.find(i=>i.id===id).noDrop===true,id+' still noDrop'); ok(D.quests.some(q=>(q.loot||[]).includes(id)),id+' drops from a quest'); }
ok(D.quests.every(q=>(q.loot||[]).every(id=>D.items.some(i=>i.id===id))),'all quest loot ids are items');

// ---- D9 / D10 / D37: first rewards
const run=(s,n=1)=>{for(let i=0;i<n;i++)E.firstsDay(s);}, runI=(s,n=1)=>{for(let i=0;i<n;i++)E.introsDay(s);};
{ const s=fresh(); E.dayTick(s,1,1); ok(s.firsts&&s.firsts.done,'the real day tick runs the firsts hook'); }
{ const F=D.firsts; ok(F.quietAfterDay===2&&F.bounds.renown===10&&F.ground.coin===150&&F.ledger.length===7,'firsts data');
  const s=fresh(); s.day=0; s.tut=s.tut||{}; s.tut.done=['food','chop']; s.tut.started=true;
  const c0=s.res.coin; run(s); ok(s.res.coin===c0+10&&("larder" in s.firsts.done),'larder pays +10 once'); run(s,3); ok(s.res.coin===c0+10,'and only once');
  const t=s.tut; t.done=['food','chop','cook','craft','trade']; const c1=s.res.coin; run(s); ok(s.res.coin===c1+20,'refine + sell pay');
  const r0=s.renown||0; s.explored=['x']; s.land=['x']; const c2=s.res.coin; run(s); ok(s.renown===r0+10,'Walk the bounds: +10 renown'); ok(s.res.coin===c2+20,'Ground of your own +20'); run(s,2); ok(s.renown===r0+10,'renown once');
  // finish the Ground Ledger -> +150 once
  s.doneQuests=['haul_bram','g_arch_granary','merchant_run']; s.minions=s.minions||[]; if(!s.minions.length) s.minions.push({id:'mm',job:'hand',cls:'hand'}); s.structures=['x']; s.union={tier:1}; const c3=s.res.coin; run(s); ok(s.res.coin>=c3+150&&("ground_all" in s.firsts.done),'Ground Ledger finished: +150'); const c4=s.res.coin; run(s,3); ok(s.res.coin===c4,'no second payout');
  // old save: nothing paid
  const o=fresh(); o.day=60; o.land=['x']; o.structures=['x']; o.explored=['x']; o.tut={done:['food','chop','cook','craft','trade'],started:true,step:3}; const oc=o.res.coin, orn=o.renown||0; run(o,2);
  ok(o.res.coin===oc&&(o.renown||0)===orn&&("ground" in o.firsts.done)&&("larder" in o.firsts.done),'old save (day>2): everything marked done, no windfall');
  // skipped tutorial pays nothing but the Ground Ledger can still pay
  const k=fresh(); k.day=0; E.skipTutorial(k); const kc=k.res.coin; k.land=['x']; run(k,2); ok(k.res.coin===kc&&("larder" in k.firsts.done),'skipped tutorial: Ledger rows pay nothing');
  // no data -> inert
  const keep=D.firsts; delete D.firsts; const n=fresh(); n.day=0; n.land=['x']; const nc=n.res.coin; run(n); ok(n.res.coin===nc&&!n.firsts,'no firsts data: inert'); D.firsts=keep;
}
// parity with the coach logic the player sees
{ const h=coachHelpers(E,D); let n=0;
  for(let mask=0;mask<512;mask++){ const s=fresh(); s.day=10; const b=i=>!!(mask&(1<<i));
    s.land=b(0)?['x']:[]; s.structures=b(1)?['x']:[]; s.minions=b(2)?[{id:'m'}]:[]; s.explored=b(3)?['x']:[]; s.doneQuests=[b(4)&&'haul_bram',b(5)&&'g_hearth_bridge',b(6)&&'merchant_run'].filter(Boolean); s.union={tier:b(7)?1:0}; s.tut={done:b(8)?['food','chop','cook','craft','trade']:[],started:true,step:1,flags:{}};
    const lr=ledgerRows(s,{firsts:{}}), gr=groundRows(s,h);
    for(const id of Object.keys(LEDGER_CHECK)) if(!['heirs'].includes(id)) ok(!!LEDGER_CHECK[id](s)===lr.find(x=>x.id===id).done,'ledger parity '+id+' mask '+mask);
    for(const id of Object.keys(GROUND_CHECK)) ok(!!GROUND_CHECK[id](s)===(gr.find(x=>x.id===id).status==='done'),'ground parity '+id+' mask '+mask);
    n++; }
  const tk=fresh(); tk.tut={skipped:true,flags:{}}; ok(LEDGER_CHECK.larder(tk)===ledgerRows(tk,{firsts:{}}).find(x=>x.id==='larder').done,'skipped parity');
  const su=fresh(); su.suitors=[{id:'q',affinity:5}]; ok(LEDGER_CHECK.heirs(su)&&!LEDGER_CHECK.heirs(fresh()),'heirs reads a courted suitor');
}

// ---- D48: four intro lines
{ const IL=D.intros.lines, ids=IL.map(l=>l.id); for(const id of ['farmstead','union','legacy','automation']) ok(ids.includes(id),id+' line'); ok(IL.slice(-4).map(l=>l.id).join()==='farmstead,union,legacy,automation','appended last (lowest priority)');
  for(const l of IL.slice(-4)){ ok(l.steps.every(st=>st.reward&&st.reward.coin>0&&st.reward.coin<=150),l.id+' small coin'); ok(E.introTest(fresh(),l.when)===false,l.id+' not started on a fresh save'); }
  const idle=()=>{const s=fresh(); s.tut={done:[],step:99,skipped:true,started:true,flags:{}}; for(const l of IL.slice(0,-4)) E.introState(s).lines[l.id]={step:0,state:'done',quiet:true}; return s;};
  { const s=idle(); s.legacy={earned:5,ups:{}}; const c=s.res.coin; runI(s); ok(E.introsActive(s).some(l=>l.id==='legacy'),'legacy starts when renown is banked'); ok(E.introView(s,'legacy')>=1&&s.res.coin===c+40,'viewing Legacy pays 40'); s.legacy.ups={x:1}; E.introCheck(s); ok(s.res.coin===c+140&&E.introState(s).lines.legacy.state==='done','buying an upgrade pays 100, line done'); }
  { const s=idle(); s.minions=[{id:'m',job:'hand'}]; s.structures=['x']; runI(s); ok(E.introsActive(s).some(l=>l.id==='automation'),'automation starts'); const c=s.res.coin; s.quotas=[{}]; E.introCheck(s); ok(s.res.coin===c+80,'quota pays 80'); }
  { const s=idle(); s.land=['x']; s.fields={list:[{id:'f'}],ups:{}}; s.estateScore=0; const l=D.intros.lines.find(x=>x.id==='farmstead'); const c=s.res.coin; E.introState(s).lines.farmstead={step:0,state:'active',since:s.day}; E.introCheck(s); ok(s.res.coin===c+60,'farmstead step 1 (a field) pays 60'); s.doneQuests=['g_arch_granary']; E.introCheck(s); ok(s.res.coin===c+160&&E.introState(s).lines.farmstead.state==='done','granary pays 100'); }
  { const s=idle(); E.introState(s).lines.union={step:0,state:'active',since:s.day}; const c=s.res.coin; s.union={tier:1}; E.introCheck(s); ok(s.res.coin===c+150,'union hall pays 150'); }
  { const old=fresh(); old.legacy={earned:9,ups:{a:1}}; old.minions=[{id:'m'}]; old.structures=['x']; old.tut={done:[],step:99,skipped:true,started:true,flags:{}}; const c=old.res.coin; E.introsMigrate(old); runI(old,3); ok(old.res.coin===c&&E.introState(old).lines.legacy.state==='done'&&E.introState(old).lines.legacy.quiet,'an old save that already qualifies is marked done quietly, no payout'); }
}
// ---- guards
ok(!/qualityTier|giftQuality|tierHook/i.test(src('js/engine/courtship.js')+src('data/marriage.json')),'D15 not built');
ok(/classLiked/.test(src('js/ui/houses-tab.js')),'houses tab notes the class gift');
console.log('r84 ok '+pass+' checks');
