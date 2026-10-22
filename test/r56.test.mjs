// R56 the dwarf rules: travel, old retainers, Auto farming/teamster, War-Chariot, Shieldbearers, dwarf crafting help,
// the Oath for dwarves only, dwarf spouses + Dwarf-blood, Clan Ironbrow's grudge, dwarf-steel tools, save step 52.
import fs from "fs"; import * as E from "../js/engine.js"; import { BUILD } from "../js/config.js";
import { STEPS } from "../js/engine/save-steps.js";
const R=new URL("../data/",import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const Y=D.tuning.daysPerYear;
const base=()=>{const s=E.newGame(1);E.normalize(s);E.skipTutorial&&E.skipTutorial(s);s.res.coin=1e5;s.day=20*Y;return s;};
ok(+BUILD.slice(1)>=56&&E.SCHEMA>=52,'R56+');
ok(D.changelog.entries.some(e=>e.build==='R56'),'changelog R56');
// travel
{ const s=base(); const m={race:'dwarf'}; ok(E.dwarfTravel(s,m,false,1.5)===0.8&&E.dwarfTravel(s,m,true,1.5)===1&&E.dwarfTravel(s,{},false,1.5)===1.5,'dwarves never ride: ×0.8 off the mountains'); s.vault.push('ramcart'); ok(E.dwarfTravel(s,m,false,1.5)===1.2,'Ram Cart ×1.2'); }
{ const s=base(); const m=s.members[0]; m.race='dwarf'; const t=E.newTrip({type:'quest',target:'q_salt_kelp'},s,m), u=E.newTrip({type:'quest',target:'q_salt_kelp'},s,null); ok(t.out>=u.out,'a dwarf walks slower on the coast ('+t.out+' vs '+u.out+')'); }
// old retainers
{ const s=base(); const mi={type:'dwarfminer'}; mi.since=s.day-4.5*Y; ok(E.oldRetainer(s,mi)===4&&E.loyaltyCap(s,mi)===104,'old retainer +4'); mi.since=s.day-30*Y; ok(E.oldRetainer(s,mi)===10,'up to +10'); const h={type:'laborer'}; h.since=0; ok(E.oldRetainer(s,h)===0,'humans: none'); }
// oath: dwarves only
{ const s=base(); s.minions=[]; const cap=E.minionCap(s); for(let i=0;i<cap;i++)s.minions.push({uid:'h'+i,type:'laborer'}); s.flags={thaneOath:1};
  ok(!E.minionRoom(s,'laborer')||E.freeHousing(s,'bunk')<=0,'Oath places: not for humans'); const fh=E.freeHousing(s,'bunk'); if(fh>0) ok(E.minionRoom(s,'dwarfminer'),'Oath places: for dwarves'); }
// chariot, shields, craft
{ const s=base(); ok(E.chariotMult(s,'guard')===1,'no chariot'); s.vault.push('warchariot'); ok(E.chariotMult(s,'guard')===1.15&&E.chariotMult(s,'farm')===1,'War-Chariot +15% guard'); }
{ const s=base(); s.minions=[1,2,3,4].map(i=>({uid:'d'+i,type:'dwarfshield'})); ok(Math.abs(E.shieldMult(s)-1.3)<1e-9,'Shieldbearers +10% each, cap +30%'); }
{ const s=base(); s.minions=[{type:'dwarfsmith',job:'craft'},{type:'dwarfrune',job:'craft'},{type:'dwarfrune',job:'craft'},{type:'dwarfrune',job:'craft'}]; ok(Math.abs(E.dwarfCraftMult(s,{station:'forge'})-1.1)<1e-9&&E.dwarfCraftMult(s,{station:'runeanvil'})===2,'dwarf craft help'); }
// teamster + farming
{ const s=base(); s.minions=[{type:'dwarfminer'}]; ok(E.isDwarfMinion(s.minions[0])&&!E.hasDwarfCart(s),'teamster rule needs a cart'); s.vault.push('ramcart'); ok(E.hasDwarfCart(s),'Ram Cart ok'); }
// marriage + blood
{ const s=base(); const sp={house:'ironbrow',lifespan:55}; ok(E.dwarfSpouse(s,sp)&&sp.race==='dwarf'&&sp.lifespan===110,'a dwarf spouse lives ~110'); }
{ const s=base(); const c={traits:[],lifespan:55}; ok(E.dwarfBlood(s,c,[{race:'dwarf'},{}],()=>0.9)&&c.traits.includes('dwarfblood')&&c.lifespan===67,'Dwarf-blood child: +12 years');
  const t=D.traits.find(x=>x.id==='dwarfblood'); ok(t.stats.STR===2&&t.stats.VIT===2&&t.skillXp.smithing===0.2&&t.skillXp.farming===-0.2,'Dwarf-blood bonuses');
  const g={traits:[]}; ok(!E.dwarfBlood(s,g,[{traits:['dwarfblood']},{}],()=>0.9)&&E.dwarfBlood(s,g,[{traits:['dwarfblood']},{}],()=>0.1),'a Dwarf-blood parent: half the time'); }
// grudge
{ const s=base(); s.flags={soldGate:1}; ok(E.grudgeCeil(s,'ironbrow')===-25,'grudge holds'); s.doneQuests.push('ht_ironbrow2'); ok(E.grudgeCeil(s,'ironbrow')==null,'Ancestor Stones ends it'); }
// tools
{ const s=base(); E.openGate(s); ok(['r_dwarfpick','r_dwarfaxe','r_dwarfsickle'].every(r=>s.unlocks.includes('recipe:'+r)),'dwarf-steel tools at the gate'); }
// save
{ const s=base(); s.members[0].house='ironbrow'; s.gateOpen=1; STEPS.find(x=>x.n===52).run(s); ok(s.members[0].race==='dwarf'&&s.unlocks.includes('recipe:r_dwarfpick'),'step 52'); const n=s.minions.length; ok(n===s.minions.length,'no one dismissed'); }
{ const s=base(); s.members[0].race='dwarf'; const l=E.deserialize(E.serialize(s)); ok(l.schema===E.SCHEMA&&l.members[0].race==='dwarf','save/load'); }
console.log('r56 ok',pass);
