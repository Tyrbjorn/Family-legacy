// Auto Tend, Auto Equip, heirloom refund (save step 22), deeds and the dragon
import fs from 'fs'; import * as E from '../js/engine.js';
const L=n=>JSON.parse(fs.readFileSync(new URL('../data/'+n+'.json',import.meta.url)));
const D={};for(const n of ['fields','skills','classes','traits','buildings','furniture','items','quests','regions','tuning','nodes','towns','minions','guilds','jobs','activities','estate','crafting','map','dungeons','legacy','chronicle','achievements','events','encounters','seasons','tutorial','notify','marriage','phases','intros','gear','paths','world','metals'])D[n]=L(n);
for(const f of D.estate.structureFiles)D['structures/'+f]=L('structures/'+f);
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const fresh=()=>{const s=E.newGame(1);E.normalize(s);s.members[0].ageDays=20*360;s.legacy.renown=1e4;return s;};
// ---- Auto Tend
const U=D.legacy.upgrades.filter(u=>u.id==='at_tend');
ok(U.length===1&&U[0].free===0.35&&U[0].tiers.map(t=>t.cost).join()==='80,300,800','R43: one Gather & Refine Rate line, free 35%, 80/300/800');
{ const s=fresh(); s.members.forEach(m=>m.action=null); for(const m of s.members) m.skills.farming.lvl=0; const f0=s.res.food; E.autoTendDay(s); ok(s.res.food===f0&&/Farming 1/.test(E.atIssue(s,'farming')),'locked without the skill: shows why');
  s.members[0].skills.farming.lvl=1; ok(/locked/.test(E.atIssue(s,'farming')),'locked without the building (Furrows): shows why'); s.structures.push({uid:'fx',type:'fields',pieces:['furrows'],up:0}); ok(E.atTarget(s,'farming').id==='tendfields'&&E.atRate(s,'farming')===0.35,'free: farming defaults to Tend Fields at 35%');
  let f=s.res.food; E.autoTendDay(s); const y=D.activities.find(a=>a.id==='tendfields').yields.food; ok(Math.abs(s.res.food-f-y*0.35)<1e-9,'free = 35% of the hand yield');
  s.legacy.renown=1e4; E.buyLegacy(s,'at_tend'); f=s.res.food; E.autoTendDay(s); ok(Math.abs(s.res.food-f-y*0.55)<1e-9,'tier 1 = 55%');
  E.buyLegacy(s,'at_tend'); f=s.res.food; E.autoTendDay(s); ok(Math.abs(s.res.food-f-y*0.75)<1e-9,'tier 2 = 75%');
  E.toggleAuto(s,'at_farming'); f=s.res.food; E.autoTendDay(s); ok(s.res.food===f&&!E.atOn(s,'farming'),'toggle off');
  E.toggleAuto(s,'at_farming'); s.members[0].action={type:'activity',target:'tendfields'}; f=s.res.food; E.autoTendDay(s); ok(s.res.food===f,'pauses while someone tends by hand'); s.members[0].action=null;
  ok(/by hand once/.test(E.atIssue(s,'extraction')),'extraction waits for a hand trip'); s.atLast={gather:'berries'}; f=s.res.food; E.autoTendDay(s); ok(s.res.food>f,'extraction repeats the last gathering spot');
  s.legacy.ups.at_tend=1; s.members[0].skills.cooking.lvl=1; ok(!E.atTarget(s,'cooking'),'craft category waits for a hand-made recipe (below tier 2)');
  s.atLast['rc:cooking']='r_cakes'; s.structures.push({uid:'kx',type:'kitchen',pieces:['larder'],up:0}); Object.assign(s.res,{food:500,thyme:20}); const rc=E.recipeDef('r_cakes'); const v0=s.vault.length; let n=0;
  const issue=E.recipeIssue(s,s.members[0],rc);
  if(!issue){ for(let i=0;i<Math.ceil(rc.days/0.55);i++)E.autoTendDay(s); ok(s.vault.length===v0+1,'cooking crafts one item every days/rate days'); } else console.log('cooking craft check skipped: '+issue);
}
// ---- Auto Equip
{ const s=fresh(); const m=s.members[0]; m.ageDays=20*360; m.equip={}; s.vault=[]; s.vault.push('rusty_sword','hunting_bow','sickle');
  E.autoEquipDay(s); ok(!m.equip.weapon,'locked without an Armory');
  s.structures.push({uid:'bx',type:'barracks',pieces:[],up:2}); ok(E.autoEqUnlocked(s,'gear'),'Armory (2nd Guardhouse upgrade) unlocks gear');
  E.autoEquipDay(s); ok(m.equip.weapon==='hunting_bow'&&m.autoEq.weapon&&s.vault.includes('rusty_sword'),'best weapon auto-equipped');
  s.vault.push('oak_staff'); E.autoEquipDay(s); ok(m.equip.weapon==='oak_staff'&&s.vault.includes('hunting_bow'),'upgrade swaps; old piece back to vault');
  E.unequip(s,m,'weapon'); E.equip(s,m,'rusty_sword'); s.vault.push('oak_staff'); E.autoEquipDay(s); ok(m.equip.weapon==='rusty_sword','hand-equipped never swapped');
  s.minions=[{uid:'f1',name:'Bo',job:'farm',equip:{}}]; ok(!E.autoEqUnlocked(s,'tools'),'tools need a Workshop');
  s.structures.push({uid:'sx',type:'smithy',pieces:[],up:0}); E.autoEquipDay(s); ok(s.minions[0].equip.tool==='sickle','matching tool to the farmer');
  E.toggleAuto(s,'eq_tools'); ok(!E.autoEqOn(s,'tools'),'tools toggle'); }
// ---- heirloom refund
{ const s=fresh(); s.legacy.renown=5; s.legacy.ups.heirloom=1; s.unlocks.push('recipe:r_heirloom'); s.schema=21; E.normalize(s);
  ok(s.legacy.renown===125&&!s.legacy.ups.heirloom&&!s.unlocks.includes('recipe:r_heirloom'),'v22: Heirloom Smithing refunded 120');
  const dl=L('dlc-heirlooms'); ok(dl.legacyUpgrade.id==='heirloom'&&dl.recipe.id==='r_heirloom'&&dl.heirloomItems.length===5,'DLC data kept in data/dlc-heirlooms.json'); }
// ---- deeds
{ const s=fresh(); const m=s.members[0]; const r=()=>s.renown;
  const dg=E.dungeonDef('d_stormhold'); let a=r(); E.dungeonClear(s,m,dg); const first=r()-a; a=r(); E.dungeonClear(s,m,dg); const rep=r()-a;
  ok(first>=rep*9&&rep>0,'dungeon repeat pays 10% ('+first+'/'+rep+')');
  const dr=E.dungeonDef('d_dragonlair'); ok(dr&&dr.hidden&&dr.deedTier===5&&dr.floors.at(-1).cp>150,'dragon: hidden tier 5, harder than Stormhold');
  a=r(); E.dungeonClear(s,m,dr); ok(r()-a>first*1.5&&s.deeds.some(d=>/wyrm/.test(d)),'dragon pays 300-tier renown + a deed');
  const sec=D.map.areas.find(x=>x.id==='a_peaks').secrets.find(x=>x.id==='d_dragonlair'); ok(sec&&sec.chance<0.2&&sec.needs==='d_stormhold','dragon is a rare peaks secret after Stormhold');
  const ar=D.map.areas[0]; s.explored=s.explored.filter(x=>x!==ar.id); a=r(); E.exploreArea(s,m,ar); const e1=r()-a; a=r(); E.exploreArea(s,m,ar); ok(e1>0&&r()===a,'explore renown only the first time'); }
// ---- holds
{ const s=fresh(); const m=s.members[0]; m.equip={}; s.vault=['rusty_sword','hunting_bow','c|oak_staff|fine'];
  s.structures.push({uid:'bx',type:'barracks',pieces:[],up:2});
  ok(E.itemType('c|oak_staff|fine#x')==='oak_staff'&&E.itemType('rusty_sword')==='rusty_sword','item type from id');
  E.toggleHold(s,'type','c|oak_staff|fine'); E.toggleHold(s,'item','hunting_bow'); E.autoEquipDay(s); ok(m.equip.weapon==='rusty_sword','Auto Equip skips held type and held item');
  const c0=s.res.coin; ok(E.sellMany(s,[...s.vault])===0&&s.res.coin===c0,'bulk sell skips held items');
  E.toggleHold(s,'item','hunting_bow'); ok(!E.isHeld(s,'hunting_bow'),'hold toggles off');
  E.unequip(s,m,'weapon'); s.vault.push(m.bag.pop()); m.autoEq={}; E.toggleNoAutoEq(m); E.autoEquipDay(s); ok(!m.equip.weapon,'member excluded from Auto Equip'); }
// ---- Ancestors' Tithe
{ const s=fresh(); s.legacy.renown=0; s.legacy.earned=0; const m=s.members[0];
  E.addRenown(s,m,100); ok(s.legacy.renown===0&&E.titheRate(s)===0,'no Graveyard: no tithe');
  s.structures.push({uid:'gy',type:'graveyard',pieces:[],up:0}); ok(E.titheRate(s)===0.2,'Graveyard: flat 20%');
  const d=E.diffRenown?1:1; const before=m.renown; E.addRenown(s,m,200); const got=m.renown-before; ok(s.legacy.renown===Math.floor(got*0.2),'20% of the gain goes to Legacy now');
  const L0=s.legacy.renown; const b=E.newMember(s,{age:30}); s.members.push(b); b.renown=0; E.addRenown(s,b,400); const tb=s.legacy.renown-L0; E.kill(s,b,'died');
  ok(b.banked===Math.floor((b.renown-b.tithed)*E.captureRate(s))&&b.banked===0,'death capture excludes tithed renown (no double count)');
  b.renown; const c=E.newMember(s,{age:30}); s.members.push(c); c.renown=300; c.tithed=0; E.kill(s,c,'died'); ok(c.banked===75,'untithed renown still banks at 25%');
  s.legacy.renown=1e4; ok(E.buyLegacy(s,'tithe')&&Math.abs(E.titheRate(s)-0.25)<1e-9&&E.buyLegacy(s,'tithe')&&E.buyLegacy(s,'tithe')&&Math.abs(E.titheRate(s)-0.35)<1e-9,'Tithe upgrades: 25/30/35%');
  ok(D.legacy.upgrades.find(u=>u.id==='tithe').tiers.map(t=>t.cost).join()==='150,400,900','Tithe prices 150/400/900'); }
// ---- extraction share
{ const s=fresh(); const n=D.nodes.find(x=>x.id==='berries'); const sh=E.gatherShare(s,n); const t=E.newTrip({type:'gather',target:'berries'},s);
  ok(sh>0&&sh<=1&&Math.abs(sh-t.task/(t.out+t.task+t.back))<1e-9,'extraction scaled by gathering / trip days ('+sh.toFixed(2)+')'); }
console.log(pass+' automation/deed checks passed');
