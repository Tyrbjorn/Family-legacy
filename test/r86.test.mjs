// R86: two good traits need a bad one (Jeremy). Engine rule (creationIssue/applyCreation) + random + UI label. Existing saves untouched.
import fs from 'fs'; import * as E from '../js/engine.js'; import { BUILD } from '../js/config.js'; import { STEPS } from '../js/engine/save-steps.js';
const R=new URL('../data/',import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const src=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
ok(BUILD==='R86'&&E.SCHEMA===55&&STEPS.at(-1).n===55,'R86 build, save stays 55');
const CL=D.changelog.entries; ok(CL[0].build==='R86'&&CL[1].build==='R85','changelog leads with R86');
const base={ach:{},flags:{},bonuses:{off:true},unlocks:[],classUnlocks:{}};
const O=E.creationOptions(base); ok(O.freeGood===1&&O.maxPicks===2&&O.bonusForBad===1,'base: 1 free good, 2 picks, +1 for bad');
const bad=t=>(E.traitDef(t)||{}).rarity==='bad', iss=tr=>E.creationIssue({traits:tr},base);
ok(iss(['quick','hardy']),'two good, no bad: refused (the reported bug)');
ok(!iss(['quick']),'one good ok'); ok(!iss([]),'none ok'); ok(!iss(['quick','clumsy']),'good+bad ok');
ok(!iss(['quick','hardy','clumsy']),'two good + one bad ok'); ok(iss(['quick','hardy','charming','clumsy']),'three good + one bad refused');
ok(!iss(['clumsy','timid']),'two bad ok'); ok(iss(['quick','hardy','clumsy','timid']),'four picks refused (cap 3)');
// order of toggling does not matter; removing the bad trait from good+good+bad is refused (UI toggle path uses creationIssue)
ok(iss(['hardy','quick']),'reverse order refused');
// applyCreation (Begin / saved choice re-applied) enforces too and leaves founder alone on refusal
{ const s=E.newGame(1); E.normalize(s); const f=s.members[0], before=JSON.stringify(f.traits); const e=E.applyCreation(s,{traits:['quick','hardy']},base); ok(e&&JSON.stringify(f.traits)===before,'applyCreation refuses two good, founder unchanged'); ok(!E.applyCreation(s,{traits:['quick','hardy','clumsy']},base),'applyCreation accepts two good + bad'); }
// Random never gives an illegal set
for(let i=0;i<2000;i++){ const c=E.randomCreation(base); const g=c.traits.filter(t=>!bad(t)).length, b=c.traits.length-g; ok(!E.creationIssue(c,base)&&g<=1+b,'random legal'); }
// unlocked third pick = a free second good trait (its stated meaning)
const all={ach:Object.fromEntries((D.achievements.list||D.achievements||[]).slice?.(0,40).map(a=>[a.id,1])||[]),flags:{},bonuses:{off:true},unlocks:['third_pick'],classUnlocks:{}};
const O3=E.creationOptions(all); if(O3.maxPicks===3){ ok(O3.freeGood===2,'third pick adds a free good'); ok(!E.creationIssue({traits:['quick','hardy']},all),'two good ok with third pick'); ok(E.creationIssue({traits:['quick','hardy','charming']},all),'three good need a bad'); }
// UI label states the rule; old saves: creation only runs on a fresh founder (no load path)
ok(/O\.freeGood/.test(src('js/ui/creation-ui.js')),'UI shows the free-good count');
ok(!/applyCreation|creationIssue/.test(src('js/engine/save.js')+src('js/engine/save-steps.js')),'no save/load path re-checks traits');
console.log('r86 ok',pass);
