// Village: charter resource-request quest, slots/tiers, one construction project at a time with part deliveries,
// Auto Deliver from surplus, relocation (half refund, pieces/tier move, land freed), 3× output / 2× job spots,
// cottages, upkeep, save step, estate stages.
import fs from 'fs'; import * as E from '../js/engine.js'; import { STEPS } from '../js/engine/save-steps.js';
const L=n=>JSON.parse(fs.readFileSync(new URL('../data/'+n+'.json',import.meta.url)));
const D={};for(const n of ['skills','classes','traits','buildings','furniture','items','quests','regions','tuning','nodes','towns','minions','guilds','jobs','activities','estate','crafting','map','dungeons','legacy','chronicle','achievements','events','encounters','seasons','tutorial','notify','marriage','phases','intros','gear','paths','world','metals'])D[n]=L(n);
for(const f of D.estate.structureFiles)D['structures/'+f]=L('structures/'+f);
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
E.setRng(()=>0.01);
const s=E.newGame(1); E.normalize(s); E.skipTutorial&&E.skipTutorial(s); const m=E.active(s); m.ageDays=30*360;
const V=D.estate.village, q=D.quests.find(x=>x.id==='q_charter');
// charter
s.land=['plot']; ok(/deed/.test(E.questIssue(s,m,q)||''),'charter needs the Valley (Greenvale) deed');
s.land.push('valley'); if(process.env.DBG)console.log(E.questIssue(s,m,q),E.era(s)); ok(/Era 3/.test(E.questIssue(s,m,q)||''),'charter needs the Dynasty phase');
const realEra=E.era; s.renown=1e4; s.structures=[{uid:'h',type:'house',pieces:['bunk','larder','storage','workbench'],up:0}]; s.buildings.farm=80;
for(let i=0;i<2;i++){const k=E.newMember(s,{age:25}); s.members.push(k);} ok(E.era(s).n>=3,'test estate reaches Dynasty');
ok(/deliver/.test(E.questIssue(s,m,q)||''),'charter asks for the goods');
Object.assign(s.res,{coin:30000,blocks:400,planks:300});
ok(!E.questIssue(s,m,q),'charter quest open with goods in store');
E.resolveQuest(s,m,q,1); ok(s.village&&s.village.tier===0&&s.res.coin===30000-25000+200&&s.res.blocks===100&&s.res.planks===100,'charter delivered: village founded');
ok(E.villageSlots(s)===8&&E.villageUsed(s)===0,'Hamlet: 8 slots');
// projects
ok(E.villageCost('fields').coin===D['structures/production'].find(d=>d.id==='fields').cost.coin*40,'village price 40× coin');
const lu0=E.landUsed(s); ok(E.buildVillage(s,'fields')&&E.project(s)&&!E.buildVillage(s,'sawmill'),'one project at a time');
const need=E.villageCost('fields'); s.res.coin=1000; ok(E.deliver(s,'coin')===1000&&E.project(s).paid.coin===1000,'partial delivery');
s.res.coin=1e5; s.res.wood=1e4; E.deliverAll(s); ok(!E.project(s)&&s.structures.some(x=>x.site==='village'&&x.type==='fields'),'complete delivery builds it');
ok(E.villageUsed(s)===2&&E.landUsed(s)===lu0,'village building uses 2 village slots, no land');
// output and job spots
const vf=s.structures.find(x=>x.site==='village'), ef={uid:'ef',type:'fields',pieces:[...vf.pieces],up:0};
const pr=st=>E.scaledPiece(st,st.pieces[0]).bonus.processes[0].rate; ok(Math.abs(pr(vf)/pr(ef)-V.outMult)<1e-9,'3× output');
const tr={uid:'t',type:'fields',pieces:['toolrack'],up:0}, vt={...tr,site:'village'}; const jg=st=>E.scaledPiece(st,'toolrack').bonus.jobs.gather; ok(jg(vt)===jg(tr)*V.jobMult,'2× follower spots');
// cancel refunds
const c0=s.res.coin; E.buildVillage(s,'cottage'); E.deliver(s,'coin',500); ok(E.cancelProject(s)&&s.res.coin===c0&&!E.project(s),'cancel returns deliveries');
// cottage beds + estate cannot build it
ok(E.structIssue(s,'cottage')==='village only','cottage is village only'); const b0=E.housingCap(s,'bunk'); E.buildVillage(s,'cottage'); s.res.planks=1e3; s.res.blocks=1e3; E.deliverAll(s); ok(E.housingCap(s,'bunk')===b0+4,'cottage houses 4 followers');
// relocation
s.land.push('acre'); const sm=E.buildStructure(s,'sawmill'); s.res.coin=1e6; s.res.wood=1e4; s.res.stone=1e4; sm.pieces.push('storage'); sm.tier=1; const lu=E.landUsed(s), w0=s.res.wood;
ok(E.relocate(s,sm.uid)&&E.project(s).uid===sm.uid,'relocation is a project'); E.deliverAll(s);
ok(sm.site==='village'&&sm.tier===1&&sm.pieces.includes('storage')&&E.landUsed(s)===lu-1,'relocated: pieces and tier move, land freed');
ok(/stays/.test(E.relocateIssue(s,s.structures.find(x=>x.type==='house').uid)),'homes stay on the estate');
ok(E.villageCost('sawmill',1).limeblocks===40&&E.villageCost('sawmill',2).graniteblocks===40&&!E.villageCost('sawmill').limeblocks,'higher village tiers need higher stone ranks'); ok(E.villageBuildIssue(s,'sawmill',1)===null&&/estate first/.test(E.villageBuildIssue(s,'sawmill',2)),'any raised tier can be built directly');
// tiers
s.res.coin=1e6; ok(!E.upgradeVillage(s),'Village needs limestone blocks'); s.res.limeblocks=100; s.res.graniteblocks=150; ok(E.upgradeVillage(s)&&E.villageSlots(s)===12&&E.upgradeVillage(s)&&E.villageSlots(s)===16&&E.villageUpIssue(s)==='max','Village 12, Market Village 16');
// Auto Deliver keeps a surplus floor
E.buildVillage(s,'gristmill'); E.toggleAutoDeliver(s); s.res.coin=V.autoCoin+100; s.day=31; E.villageDay(s); ok(E.project(s).paid.coin===100&&s.res.coin===V.autoCoin,'Auto Deliver only spends surplus coin');
// upkeep
s.day=60; const up=E.villageUpkeep(s); s.res.coin=up; E.villageDay(s); ok(s.res.coin===0&&!s.structures.some(x=>x.unpaid),'monthly upkeep paid'); s.day=90; E.villageDay(s); ok(s.structures.some(x=>x.unpaid),'unpaid upkeep idles village buildings');
// save step + stages
const z={structures:[{uid:'a',type:'fields',pieces:[],site:'village',vcost:1}]}; STEPS.find(x=>x.n===25).run(z); ok(!z.structures[0].site,'save step: strays without a charter return to the estate');
ok(D.estate.stages.map(x=>x[0]).join()==='0,10,30,60,80','estate stages 0/10/30/60/80');
// stone ranks
{ const z={structures:[{uid:'q',type:'quarry',pieces:['quarrypit'],tier:2}]}; STEPS.find(x=>x.n===26).run(z); ok(['limecut','granitecut'].every(p=>z.structures[0].pieces.includes(p)),'save step: tiered quarries get limestone/granite faces');
  const mt={uid:'m',type:'quarry',pieces:['masontable'],up:1}; ok(E.scaledPiece(mt,'masontable').bonus.processes.map(p=>p.out).join()==='blocks,limeblocks,graniteblocks,marbleblocks','Mason cuts every rank');
  ok(E.structDef('hall').cost.marbleblocks>0&&E.structDef('mansion').cost.marbleblocks>0&&E.structDef('ancestorhall').cost.marbleblocks>0,'fine buildings need marble'); ok(D.towns.find(t=>t.id==='eyrie').market.includes('marble'),'marble sold in the Eyrie'); }
console.log(pass+' village checks passed');
