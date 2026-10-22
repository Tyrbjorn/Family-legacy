// R57 the Deep One mix
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
ok(BUILD==='R57'&&E.SCHEMA===53,'R57, save step 53');
ok(D.changelog.entries[0].build==='R57','changelog R57');
const kid=()=>({traits:[],lifespan:55});
{ const s=base(); const c=kid(); ok(!E.seaBirth(s,c,[{},{}],()=>0)&&!c.traits.length,'humans: no roll'); }
{ const s=base(); s.dagonPact='join'; const c=kid(); ok(E.seaBirth(s,c,[{},{}],()=>0.2)&&c.lifespan===65,'joined families get Sea-touched children (+10 years)'); ok(!E.seaBirth(s,kid(),[{},{}],()=>0.3),'25% only'); }
{ const s=base(); ok(E.seaBirth(s,kid(),[{traits:['seatouched']},{}],()=>0.4)&&!E.seaBirth(s,kid(),[{traits:['seatouched']},{}],()=>0.6),'a Sea-touched parent: half the time'); const d={traits:['dwarfblood']}; ok(!E.seaBirth(s,d,[{traits:['seatouched']},{}],()=>0),'one bloodline per child'); }
{ const s=base(); s.dagonPact='join'; const c={...kid(),name:'Wen'}; let n=0; for(let i=0;i<200;i++){const k={...kid(),name:'k'}; E.houseBirthTrait(s,k,[{},{}]); if(k.traits.includes('seatouched')) n++;} ok(n>20&&n<90,'real births in a joined family: about 1 in 4 Sea-touched ('+n+'/200)'); }
ok(E.seaFishMult({traits:['seatouched']})===1.15&&E.seaFishMult({})===1,'Sea-touched fishers +15%');
// the change
{ const s=base(); const Y2=D.tuning.daysPerYear; const old=s.members[0]; while(s.members.filter(m=>m.alive).length<4) s.members.push({...E.newMember(s,{age:30}),alive:true});
  const m=s.members[1]; m.traits=['seatouched']; m.ageDays=60*Y2; s.day=30*Y2; const deps={church:()=>{},addMinion:()=>({}),goDown:E.goDown};
  let tries=0; while(m.tideCall==null&&tries++<200){E.seaDay(s,deps); if(m.tideCall==null) s.day+=Y2;} ok(m.tideCall===s.day+30,'the tide calls, 30 days warning');
  s.day=m.tideCall; E.seaDay(s,deps); ok(!m.alive&&m.wentDown!=null&&m.changed!=null,'they go down to Father');
  const h=s.members.find(x=>x.id===s.head); h.traits=['seatouched']; h.ageDays=70*Y2; for(let i=0;i<300;i++){s.day+=Y2;E.seaDay(s,deps);} ok(h.alive&&h.tideCall==null,'never the head'); }
{ const s=base(); s.dagonPact='join'; let got=0; const m={alive:true,name:'x',id:'zz',traits:['seatouched']}; s.members.push(m,{alive:true,id:'a'},{alive:true,id:'b'}); E.seaChange(s,m,{goDown:(s,w)=>{w.alive=false;},addMinion:()=>(got++,{})}); ok(got===1,'joined: they come back as a Young Deep One'); }
// reactions
{ const s=base(); s.members[1]&&(s.members[1].traits=['seatouched']); const h=s.members.find(x=>x.id===s.head); h.traits=['seatouched']; let ch=0; s.houses.dagon={r:0}; s.day=31*D.tuning.daysPerYear; E.seaDay(s,{church:(s,n)=>ch+=n,addMinion:()=>null,goDown:()=>{}}); ok(ch<0&&ch>=-10&&s.houses.dagon.r>0&&s.houses.dagon.r<=5,'Church frowns, Lodge smiles');
  ok(E.seaBuyMult(s,'oakbridge')===1.05&&E.seaBuyMult(s,'saltmere')===1,'outsider prices +5%'); s.houses.dagon.r=-40; ok(!E.dagonOutsider(s),'a local in Saltmere'); ok(D.families.dagonLocals.seaKin.length>=10,'"one of us" lines'); }
// raids
{ const s=base(); s.dagonPact='expose'; for(const m of s.members) m.traits=['seatouched'],m.ageDays=30*D.tuning.daysPerYear; while(s.members.length<3) s.members.push({...E.newMember(s,{age:30}),alive:true,traits:['seatouched']});
  let taken=0; for(let i=0;i<200;i++){ const r=E.deepRaid(s,{defense:()=>0,addRenown:()=>0,church:()=>0,addMinion:()=>null,hasBoat:()=>false}); if(r==='kidnap') taken++; } ok(taken===0,'the deep never takes its own'); }
// save
{ const s=base(); s.members[0].traits=['seatouched']; s.members[0].lifespan=55; delete s.members[0].seaLife; STEPS.find(x=>x.n===53).run(s); STEPS.find(x=>x.n===53).run(s); ok(s.members[0].lifespan===65,'step 53: +10 once'); const l=E.deserialize(E.serialize(s)); ok(l.schema===53,'save/load'); }
console.log('r57 ok',pass);
