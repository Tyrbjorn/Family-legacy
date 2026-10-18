import fs from "fs"; import * as E from "../js/engine.js"; import { BUILD } from "../js/config.js";
const R=new URL("../data/",import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const C=id=>E.needId(D.classes,id,'class'), Y=D.tuning.daysPerYear, T=D.guilds.tiers;
const base=()=>{const s=E.newGame(1);E.normalize(s);const m=s.members[0];m.ageDays=25*Y;s.res.coin=1e5;return s;};
const setSk=(m,o)=>{for(const[k,v]of Object.entries(o))m.skills[k].lvl=v;};
const zero=m=>{for(const k in m.skills)m.skills[k].lvl=0;};
const meet=(m,c)=>setSk(m,E.classReq(c));
const lvTo=(m,lv,avoid=[])=>{const ks=Object.keys(m.skills).filter(k=>!avoid.includes(k));let i=0;while(E.level(m)<lv)m.skills[ks[i++%ks.length]].lvl++;};
const rogue=(s,rank=1)=>{const m=s.members[0];m.guild={id:'rogues',rank,rep:999};m.cls='cutpurse';return m;};
// ---- data
ok(BUILD==='R46'&&E.SCHEMA===42,'R46, save step 42');
ok(T.length===4&&T.every((t,i)=>t.n===i+1)&&T[1].lv<T[2].lv&&T[2].lv<T[3].lv,'4 tiers with rising Lv gates');
ok(T.map(t=>t.cost).join()==='0,500,2000,5000'&&T[1].rank===1&&T[2].rank===2&&T[3].rank===3&&T[3].expansion,'coin 500/2000/5000; Journeyman/Adept/Master; tier 4 is expansion');
ok(T[1].skillScale>0&&T[1].skillScale<=1&&T[2].skillScale>0&&T[2].skillScale<=1,'pacing scale lives in guilds.json');
ok(E.classReq(C('knight')).swordsmanship===Math.round(25*T[1].skillScale),'class skill needs scale by tier');
ok(C('swindler').tier===1&&C('spy').tier===2&&C('spy').from==='swindler','Swindler is tier 2 and leads into Spy (tier 3)');
ok(C('fence').tier===2&&C('fence').needsQuest==='g_rogues_ledger','Fence is tier 3 and needs the Ledger of Debts');
{ const by={}; for(const c of D.classes.filter(c=>!c.retired&&!c.profession&&c.tier>0)){const k=E.guildOfCls(c.id)+'|'+c.tier+'|'+Object.keys(c.req).slice(0,2).sort().join('+');(by[k]||=[]).push(c.id);} const d=Object.entries(by).filter(([,v])=>v.length>1); ok(!d.length,'no two classes on a tier share the same two main skills '+JSON.stringify(d)); }
ok(D.classes.filter(c=>!c.retired&&!c.profession).every(c=>E.guildOfCls(c.id)),'every guild class belongs to a guild');
{ const ids=new Set(D.quests.map(q=>q.id)), rc=new Set(D.crafting.recipes.map(r=>r.id)); const st=Object.values(D.guilds.chains).flat(); ok(st.every(x=>ids.has(x.quest))&&st.flatMap(x=>x.unlock||[]).every(u=>u.startsWith('recipe:')&&rc.has(u.slice(7))),'chains point at real quests and recipes'); ok(st.every(x=>D.map.points[x.quest]),'chain quests have map pins'); }
ok(['g_vanguard_patrol','g_vanguard_siege','g_collegium_rift','g_rogues_heist','g_church_plague','g_church_crypt','g_lodge_hunt','g_hearth_bridge'].every(q=>E.chainStep(q)),'the 8 existing guild quests sit in the chains');
ok(D.crafting.recipes.filter(r=>/^r_g_/.test(r.id)).every(r=>r.hidden&&E.itemDef(r.base)),'chain recipes are hidden until unlocked, for real items');
// ---- tier rules
{ const s=base(), m=rogue(s,0); zero(m); meet(m,C('swindler')); lvTo(m,T[1].lv);
  ok(E.classIssues(s,m,C('swindler')).some(t=>/Journeyman rank/.test(t)),'tier 2 needs Journeyman rank (why-stuck line)');
  m.guild.rank=1; ok(E.canEvolve(s,m,C('swindler')),'Swindler open at Journeyman with skills and Lv');
  ok(E.classIssues(s,m,C('spy')).some(t=>/tier 2 class first/.test(t)),'tier 3 needs a tier 2 class first');
  ok(/another guild/.test(E.classIssues(s,m,C('knight'))[0]),'other guild classes are not offered'); }
{ const s=base(), m=rogue(s,2); zero(m); meet(m,C('spy')); m.cls='swindler'; const lv=E.level(m);
  ok(lv<T[2].lv&&E.classIssues(s,m,C('spy')).includes('Lv '+lv+'/'+T[2].lv),'Lv gate shows Lv n/'+T[2].lv);
  lvTo(m,T[2].lv,['brawling','thievery','haggling','appraisal']); ok(E.canEvolve(s,m,C('spy')),'Spy open at Lv '+T[2].lv);
  m.cls='rogue'; ok(E.canEvolve(s,m,C('spy')),'any tier 2 class leads up (Rogue → Spy, no fixed from)');
  const c0=s.res.coin; ok(E.evolve(s,m,'spy')&&m.cls==='spy'&&c0-s.res.coin===2000&&m.clsHist.includes('rogue'),'advancing costs the tier coin and keeps history');
  ok(E.inLine(m,'rogue'),'old classes still count as the line');
  const c1=s.res.coin; meet(m,C('assassin')); ok(E.moveKind(m,C('assassin'))==='side'&&E.evolve(s,m,'assassin')&&c1-s.res.coin===1000,'sideways switch costs half the tier coin');
  meet(m,C('thief')); ok(E.classIssues(s,m,C('thief')).includes('sideways change once a year'),'sideways once a year');
  s.day+=Y; ok(E.canEvolve(s,m,C('thief')),'sideways again a year later');
  meet(m,C('fence')); ok(E.classIssues(s,m,C('fence')).some(t=>/Ledger of Debts/.test(t)),'Fence waits for the chain quest'); s.doneQuests.push('g_rogues_ledger'); ok(E.canEvolve(s,m,C('fence')),'Fence open after the chain quest'); }
// joining retrains a mismatched entry class (tiers only advance inside one guild)
{ const s=base(), m=s.members[0]; m.cls='hunter'; m.guild=null; for(const k in m.skills)m.skills[k].lvl=Math.max(m.skills[k].lvl,10); m.stats&&Object.keys(m.stats).forEach(k=>m.stats[k]=20); s.res.coin=1e5;
  const ok1=E.joinGuild(s,m,'rogues'); ok(ok1&&m.cls==='cutpurse'&&m.clsHist.includes('hunter'),'joining the Rogues as a Hunter retrains to Cutpurse (hunter kept as history)'); }
// nearest hints + drill
{ const s=base(), m=rogue(s,1); zero(m); lvTo(m,T[1].lv,['etiquette','haggling','thievery','brawling']); const q=E.classReq(C('swindler')); setSk(m,{etiquette:q.etiquette-2,haggling:q.haggling});
  const h=E.nearestClasses(s,m); ok(h.length===2&&h[0].c.id==='swindler'&&h[0].miss.some(t=>t===`Etiquette ${q.etiquette-2}/${q.etiquette}`),'2 nearest hints, only what is missing');
  ok(/Swindler/.test(E.classStuck(s,m)),'why-stuck line names the nearest class'); ok(E.drillSkill(s,m)==='etiquette','drill picks the missing skill of the nearest next tier'); }
{ const s=base(), m=s.members[0]; m.guild={id:'vanguard',rank:2,rep:999}; m.cls='knight'; zero(m); lvTo(m,T[2].lv-1,['brawling','swordsmanship','tactics','leadership']); setSk(m,{brawling:0});
  ok(E.drillSkill(s,m)!=='brawling','drill aims up a tier, never at a sideways class'); }
// ---- chains + guild-first adventure
{ const s=base(), m=rogue(s,0); E.chainDone(s,E.findId(D.quests,'g_rogues_heist')); ok(s.unlocks.includes('recipe:r_g_lockpicks'),'chain quest grants its recipe unlock');
  ok(E.chainNext(s,'rogues').quest==='g_rogues_heist','chain next skips only done quests'); s.doneQuests.push('g_rogues_heist'); ok(E.chainNext(s,'rogues').quest==='g_rogues_cellar','next chain step');
  m.guild.rank=1; m.guild.rep=0; const gq=E.guildQuestFor(s,m,q=>q.cp<=999); ok(gq&&gq.id==='g_rogues_cellar','guild first: next chain quest');
  ok(E.guildQuestFor(s,m,q=>q.id==='g_rogues_heist').id==='g_rogues_heist','short of rep: repeat a guild quest they can win');
  m.guild.rep=1e4; ok(!E.guildQuestFor(s,m,q=>q.id==='g_rogues_heist'),'not short of rep and chain blocked: nothing forced'); }
{ const s=base(), m=rogue(s,1); m.guild.rep=0; s.doneQuests.push('g_rogues_heist'); m.standing='adventure'; m.action=null; for(const k in m.skills)m.skills[k].lvl=60; const a=E.pickAdventure(s,m); ok(a&&a.type==='quest'&&E.findId(D.quests,a.target).guild==='rogues','Auto-Adventure takes the own guild chain quest first'); }
// ---- role bonuses
{ const s=base(), m=rogue(s,1), it=E.itemDef('steel_sword'); const p0=E.buyPrice(it,s); m.cls='swindler'; const p1=E.buyPrice(it,s); ok(p1<p0&&Math.abs(p1/p0-0.92)<0.02,'Swindler: family buys ~8% cheaper'); const v0=E.sellValue(s,it); m.cls='fence'; ok(E.sellValue(s,it)===Math.round(it.value*0.9)&&E.sellValue(s,it)>v0,'Fence sells at 90%'); }
// ---- crafter slots + Clerk
const P=D.paths, SLO=P.slots;
ok(['woodsman','farmer','mason'].every(id=>E.pathKind(id)==='gathering')&&P.paths.filter(p=>!['woodsman','farmer','mason'].includes(p.id)).every(p=>E.pathKind(p.id)==='crafting'),'Woodsman/Farmer/Mason are gathering; the rest crafting');
ok(E.slotCapOf('main')===3&&SLO.second.belowMain===1&&E.slotCapOf('gather')===2&&E.slotCapOf('dabble')===0&&SLO.gather.n===2,'caps (base game): main Grandmaster, secondary a rank below main, 2 gathering Master, dabbling Apprentice');
{ const s=base(), m=s.members[0]; m.craft={id:'hearth',rank:0,rep:0}; for(const id of ['smithing','woodsman','farmer','mason','tailor','cook','clerk']) ok(E.openPath(s,m,id),'open '+id);
  const sl=id=>E.pathOf(m,id).slot; ok(sl('smithing')==='main'&&sl('tailor')==='second'&&sl('woodsman')==='gather'&&sl('farmer')==='gather'&&sl('mason')==='dabble'&&sl('cook')==='dabble'&&sl('clerk')==='dabble','slots fill main → secondary → 2 gathering; the rest dabble');
  for(const k of ['smithing','mining','tailoring','masonry','foraging','cooking'])m.skills[k].lvl=99; for(const k of ['smithing','tailoring','masonry','foraging','cooking'])E.gainXp(s,m,k,1e6);
  ok(E.pathOf(m,'smithing').rank===3&&E.pathOf(m,'tailor').rank===2&&E.pathOf(m,'woodsman').rank===2&&E.pathOf(m,'mason').rank===0&&E.pathOf(m,'cook').rank===0,'ranks stop at the slot caps (main Grandmaster, secondary Master)'); ok(m.secondGuild&&m.secondGuild.via==='craft','reaching Master in a slotted trade records the second-guild unlock (R47)');
  ok(E.slotSwitchIssue(s,m,'mason','second')&&/crafting trades/.test(E.slotSwitchIssue(s,m,'mason','second')),'gathering trades cannot take a crafting slot');
  ok(E.setPathSlot(s,m,'mason','gather')&&E.pathOf(m,'mason').slot==='gather'&&E.pathOf(m,'woodsman').slot==='dabble','switch: Mason in, Woodsman out to dabbling');
  ok(E.pathOf(m,'woodsman').rank===2&&E.effRank(m,E.pathOf(m,'woodsman'))===0,'a path above its new cap keeps its rank; bonuses count at the cap');
  ok(/once a year/.test(E.slotSwitchIssue(s,m,'cook','second')||''),'slot switch once a year'); s.day+=360; ok(E.setPathSlot(s,m,'cook','second')&&E.pathOf(m,'tailor').slot==='dabble','a year later: Cook becomes secondary');
  ok(E.nextSlotFor(m,'alchemy')==='dabble','a new trade with full slots dabbles'); }
{ const s=base(), m=s.members[0]; m.craft={id:'hearth',rank:0,rep:0}; const q0=E.quotaSlots(s), o0=E.queueSize(s), mc0=E.matCap(s);
  m.paths=[{id:'clerk',xp:1e5,rank:1,spec:null,sxp:0,srank:0}]; ok(E.quotaSlots(s)===q0+2&&E.matCap(s)>mc0,'Clerk: +1 quota slot per rank, more storage');
  m.paths[0].rank=2; m.paths[0].spec='steward'; s.structures.push({uid:'w9',type:'warehouse',pieces:[],up:0}); ok(E.routeSlotParts(s).steward===1&&E.queueSize(s)===o0+1&&E.quotaSlots(s)===q0+3,'Steward (tier 3): +1 route, +1 Orders slot; quota bonus maxes at +3');
  m.paths[0].rank=3; m.paths[0].srank=3; ok(E.routeSlotParts(s).steward===2,'Seneschal (Grandmaster) is in the base game: +2 routes'); }
// ---- save step 42
{ const s=base(), m=rogue(s,2); m.cls='spy'; delete m.clsHist; s.unlocks=s.unlocks.filter(u=>!/r_g_/.test(u)); s.schema=41; E.normalize(s); ok(s.schema===42&&m.clsGrandfathered&&m.cls==='spy','step 42: Spies keep their class (grandfathered)'); ok(s.unlocks.includes('recipe:r_g_lockpicks')&&s.unlocks.includes('recipe:r_g_shadow')&&!s.unlocks.includes('recipe:r_g_signet'),'step 42: unlocks for chain quests below the rank held'); ok(m.clsHist.includes('swindler')&&m.clsHist.includes('cutpurse'),'step 42: lineage kept as history'); }
{ const s=base(), m=s.members[0]; m.cls='knight'; m.guild={id:'vanguard',rank:0,rep:0}; s.schema=41; E.normalize(s); ok(m.cls==='knight','step 42: classes taken under old rules are kept'); }
{ const s=base(), m=s.members[0]; m.cls='hunter'; m.guild={id:'rogues',rank:1,rep:60}; s.schema=41; E.normalize(s); ok(m.cls==='cutpurse'&&m.clsHist.includes('hunter'),'step 42: an entry class from another guild becomes the sworn guild\'s entry class'); }
{ const s=base(), m=s.members[0]; m.craft={id:'hearth',rank:2,rep:0}; m.paths=[{id:'smithing',xp:1e5,rank:3,spec:null,sxp:0,srank:0},{id:'scribe',xp:9e3,rank:2,spec:'steward',sxp:500,srank:2},{id:'farmer',xp:9e3,rank:2,spec:null,sxp:0,srank:0},{id:'cook',xp:2e3,rank:1,spec:null,sxp:0,srank:0}]; s.schema=41; E.normalize(s);
  const p=id=>E.pathOf(m,id); ok(p('clerk')&&p('clerk').spec==='steward'&&p('clerk').rank===2&&p('clerk').srank===2&&!p('scribe').spec,'step 42: Scribe-Stewards move onto the Clerk path at the same rank');
  ok(p('smithing').slot==='main'&&p('smithing').rank===3&&p('farmer').slot==='gather'&&p('scribe').slot==='second','step 42: highest crafting = main, next = secondary, gathering slotted');
  ok(m.paths.map(e=>e.id).slice(0,2).join()==='smithing,scribe','step 42: path order unchanged'); }
ok(E.DAY_HOOKS.map(h=>h.name).indexOf('boards')<E.DAY_HOOKS.map(h=>h.name).indexOf('fields'),'day hooks keep a fixed order regardless of import order');
ok((()=>{try{E.needId(D.classes,'nope','class');return false}catch(e){return /Unknown class id: nope/.test(e.message)}})(),'needId fails clearly');
// auto-main: highest-ranked crafting trade becomes main (nobody loses rank or bonuses)
{ const s=base(), m=s.members[0]; m.craft={id:'hearth',rank:2,rep:0}; m.paths=[{id:'scribe',xp:9e3,rank:2,spec:'loremaster',sxp:0,srank:1},{id:'smithing',xp:5e4,rank:3,spec:'goldsmith',sxp:5e4,srank:3,spec2:'gemcutter',s2xp:5e4,s2rank:3},{id:'woodsman',xp:9e3,rank:2,spec:null,sxp:0,srank:0}]; s.schema=41; E.normalize(s);
  const p=id=>E.pathOf(m,id); ok(p('smithing').slot==='main'&&p('scribe').slot==='second'&&p('woodsman').slot==='gather','step 42: Grandmaster Jeweler with a Scribe main becomes the Jeweler main');
  ok(p('smithing').rank===3&&E.effRank(m,p('smithing'))===3&&E.specName(p('smithing'))==='Jeweler'&&E.mainPath(m)===p('smithing'),'Grandmaster and the Jeweler title kept at full strength');
  ok(E.effRank(m,p('scribe'))===2,'the old main is secondary at Master (one below the Grandmaster main), nothing lost');
  ok(m.secondGuild&&m.secondGuild.via==='craft','an existing Master records the second-guild unlock'); }
{ const s=base(), m=s.members[0]; m.paths=[{id:'cook',xp:0,rank:1,spec:null,sxp:0,srank:0},{id:'tailor',xp:0,rank:2,spec:null,sxp:0,srank:0}];
  ok(E.pathSlotOf(m,m.paths[1])==='main'&&E.pathSlotOf(m,m.paths[0])==='second','slots evaluated with no explicit choice: highest crafting rank is main');
  s.day=1; m.slotDay=null; ok(E.setPathSlot(s,m,'cook','main')&&m.slotChosen&&E.pathOf(m,'cook').slot==='main'&&E.pathOf(m,'tailor').slot==='second','a player swap holds (once a year)');
  E.assignSlots(m); ok(E.pathOf(m,'cook').slot==='main','an explicit choice is not overridden by auto-main'); }
console.log(pass+' checks passed');
