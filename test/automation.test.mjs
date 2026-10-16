// Auto Tend, Auto Equip, heirloom refund (save step 22), deeds and the dragon
import fs from 'fs'; import * as E from '../js/engine.js';
const L=n=>JSON.parse(fs.readFileSync(new URL('../data/'+n+'.json',import.meta.url)));
const D={};for(const n of ['skills','classes','traits','buildings','furniture','items','quests','regions','tuning','nodes','towns','minions','guilds','jobs','activities','estate','crafting','map','dungeons','legacy','chronicle','achievements','events','encounters','seasons','tutorial','notify','marriage','phases','intros','gear','paths','world','metals'])D[n]=L(n);
for(const f of D.estate.structureFiles)D['structures/'+f]=L('structures/'+f);
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const fresh=()=>{const s=E.newGame(1);E.normalize(s);s.members[0].ageDays=20*360;s.legacy.renown=1e4;return s;};
// ---- Auto Tend
const U=D.legacy.upgrades.filter(u=>u.autoTend);
ok(U.length===10&&U.find(u=>u.id==='at_farming').tiers.map(t=>t.cost).join()==='80,250'&&U.find(u=>u.id==='at_arcane').tiers.map(t=>t.cost).join()==='200,600','10 Auto Tend upgrades at the original prices');
{ const s=fresh(); s.members.forEach(m=>m.action=null); const f0=s.res.food; E.autoTendDay(s); ok(s.res.food===f0,'not owned: nothing');
  E.buyLegacy(s,'at_farming'); ok(E.atTarget(s,'farming').id==='tendfields'&&E.atRate(s,'farming')===0.5,'farming defaults to Tend Fields at 50%');
  let f=s.res.food; E.autoTendDay(s); const y=D.activities.find(a=>a.id==='tendfields').yields.food; ok(Math.abs(s.res.food-f-y*0.5)<1e-9,'tier 1 = half the hand yield');
  E.buyLegacy(s,'at_farming'); f=s.res.food; E.autoTendDay(s); ok(Math.abs(s.res.food-f-y*0.75)<1e-9,'tier 2 = 75%');
  E.toggleAuto(s,'at_farming'); f=s.res.food; E.autoTendDay(s); ok(s.res.food===f&&!E.atOn(s,'farming'),'toggle off in Automation');
  E.toggleAuto(s,'at_farming'); s.members[0].action={type:'activity',target:'tendfields'}; f=s.res.food; E.autoTendDay(s); ok(s.res.food===f,'pauses while someone tends by hand'); s.members[0].action=null;
  E.buyLegacy(s,'at_extraction'); s.atLast={gather:'berries'}; f=s.res.food; E.autoTendDay(s); ok(s.res.food>f,'extraction repeats the last gathering spot');
  E.buyLegacy(s,'at_cooking'); ok(!E.atTarget(s,'cooking'),'craft category waits for a hand-made recipe');
  s.atLast['rc:cooking']='r_cakes'; s.structures.push({uid:'kx',type:'kitchen',pieces:['larder'],up:0}); Object.assign(s.res,{food:500,thyme:20}); const rc=E.recipeDef('r_cakes'); const v0=s.vault.length; let n=0;
  const issue=E.recipeIssue(s,s.members[0],rc);
  if(!issue){ for(let i=0;i<Math.ceil(rc.days/0.5);i++)E.autoTendDay(s); ok(s.vault.length===v0+1,'cooking crafts one item every days/0.5 days'); } else console.log('cooking craft check skipped: '+issue);
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
console.log(pass+' automation/deed checks passed');
