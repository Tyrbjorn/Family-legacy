// R54 Mother's Pool: Mother Hydra behind the Deep Door; mood from the R53 pact + Lodge trust; once per line;
// violent retry until won; yearly pearls; save step 50.
import fs from "fs"; import * as E from "../js/engine.js"; import { BUILD } from "../js/config.js";
import { STEPS } from "../js/engine/save-steps.js";
const R=new URL("../data/",import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const Y=D.tuning.daysPerYear, Q=id=>D.quests.find(q=>q.id===id);
const base=(pact,r)=>{const s=E.newGame(1);E.normalize(s);E.skipTutorial&&E.skipTutorial(s);s.res.coin=1e5;s.day=10*Y;s.dagonPact=pact;s.houses.dagon={r:r??-25,state:'peace'};s.cleared=[...(s.cleared||[]),'d_olddeeps'];s.choices=[{id:'dagon',pick:pact||'bargain'}];for(const id of ['highlands','dwarfhold'])s.discovered.push(id);(s.townsVisited||=[]).push('dwarfhold');const m=s.members[0];m.ageDays=25*Y;for(const k in m.stats)m.stats[k]=80;for(const k in m.skills)m.skills[k].lvl=60;return s;};
ok(+BUILD.slice(1)>=54&&E.SCHEMA>=50,'R54+, save step 50+');
ok(D.changelog.entries.some(e=>e.build==='R54'),'changelog R54');
// mood
ok(E.hydraMood(base('join',0))==='peaceful'&&E.hydraMood(base('join',-30))==='tested','join: peaceful; tested if trust fell to Cold');
ok(E.hydraMood(base(undefined,70))==='peaceful'&&E.hydraMood(base(undefined,0))==='tested'&&E.hydraMood(base(undefined,-25))==='violent','no pact: by trust');
ok(E.hydraMood(base('bargain',-50))==='tested'&&E.hydraMood(base('lapsed',50))==='violent','bargain tested, lapsed violent');
{ const s=base('expose',70); s.flags={dagonExpose:s.day-Y}; ok(E.hydraMood(s)==='violent','expose: violent during the penalty'); s.flags.dagonExpose=s.day-3*Y; ok(E.hydraMood(s)==='peaceful','after it, trust counts'); }
// door
{ const s=base('join',0); ok(!E.deepDoorOpen(s)&&/sealed/.test(E.hydraIssue(s,Q('hy_audience'))||''),'sealed at first'); E.dagonDay(s); ok(E.deepDoorOpen(s)&&s.revealed.includes('hy_fight'),'the door opens'); }
{ const s=base('join',0); s.cleared=s.cleared.filter(x=>x!=='d_olddeeps'); E.dagonDay(s); ok(!E.deepDoorOpen(s),'needs the Old Deeps cleared'); }
// peaceful
{ const s=base('join',0); E.dagonDay(s); const m=s.members[0]; ok(!E.questIssue(s,m,Q('hy_audience'))&&/not now/.test(E.questIssue(s,m,Q('hy_fight'))),'only the audience');
  const p0=s.res.pearls||0; for(let i=0;i<20&&!s.hydra;i++)E.resolveQuest(s,m,Q('hy_audience'),1); ok(s.hydra.result==='blessed'&&s.res.pearls>=p0+20&&E.dagonFishMult(s)>1.4&&E.hydraSellMult(s,'reefgold')===1.1,'blessing');
  ok(/met your family/.test(E.questIssue(s,m,Q('hy_audience'))),'once per line'); const p1=s.res.pearls; E.hydraYear(s); ok(s.res.pearls===p1+5,'yearly pearls'); }
// tested
{ const s=base('bargain',0); E.dagonDay(s); const m=s.members[0]; for(let i=0;i<30&&!s.hydra;i++){s.hydraRetry=0;E.resolveQuest(s,m,Q('hy_trial'),1);} ok(s.hydra&&s.hydra.result==='passed'&&s.res.tidepearl>=1,'trial passed: a Tide-Pearl'); }
{ const s=base('bargain',0); E.dagonDay(s); const m=s.members[0]; for(const k in m.skills)m.skills[k].lvl=0; m.skills.faith.lvl=99; E.hydraDone(s,m,Q('hy_trial'),()=>{}); ok(!s.hydra&&s.hydraRetry===s.day+30,'trial failed: back in 30 days'); }
ok(D.crafting.inlays.mats.tidepearl,'Tide-Pearl inlay');
// violent
{ const s=base('lapsed',-30); E.dagonDay(s); for(let i=0;i<3;i++)E.hydraFail(s,Q('hy_fight')); ok(s.hydraFlood>s.day&&/flooded/.test(E.questIssue(s,s.members[0],Q('hy_fight'))),'three losses flood the Deeps');
  s.hydraFlood=0; E.hydraDone(s,s.members[0],Q('hy_fight'),()=>{}); ok(s.hydra.result==='slain'&&E.marketClosed(s,'saltmere')&&!E.marketClosed(s,'ashford'),'slain: Saltmere shut'); s.day+=Y+1; ok(!E.marketClosed(s,'saltmere'),'for a year'); }
ok(!Q('hy_fight').once&&Q('hy_fight').gives.includes('hydrascale'),'the fight can be retried');
// save
{ const s=base('join',0); s.hydra={x:1}; STEPS.find(x=>x.n===50).run(s); ok(!s.hydra&&E.deepDoorOpen(s),'step 50: door found, encounter unplayed'); }
{ const s=base('join',0); s.flags={}; s.choices=[]; STEPS.find(x=>x.n===50).run(s); ok(!E.deepDoorOpen(s),'step 50: no choice, still sealed'); }
{ const s=base('join',0); s.hydra={mood:'peaceful',result:'blessed',day:1}; const l=E.deserialize(E.serialize(s)); ok(l.schema===E.SCHEMA&&l.hydra.result==='blessed','save/load'); }
// Deep One eggs
ok(D.towns.every(t=>t.prices.deepegg>=150)&&D.minions.types.find(t=>t.id==='deepone').special,'eggs: a rare trade good, hatch into a Young Deep One');
ok(D.dungeons.find(d=>d.id==='d_olddeeps').floors.slice(1).every(f=>f.drop&&f.drop.res==='deepegg'),'lower Old Deeps floors may hold an egg');
{ const s=base('lapsed',-30); E.dagonDay(s); E.hydraDone(s,s.members[0],Q('hy_fight'),()=>{}); ok(s.res.deepegg===2,'the fight leaves 2 eggs'); }
{ const s=base('join',0); s.res.deepegg=1; s.guildFavour={}; ok(E.hatchEgg(s,E.guildsOf)&&s.hatch.clean&&s.guildFavour.church===-50&&!E.hatchEgg(s,E.guildsOf),'hatch: costs Church rep, one at a time');
  const n=s.minions.length; s.day=s.hatch.due; E.hatchDay(s,E.addMinion); ok(s.minions.length===n+1&&s.minions.at(-1).type==='deepone'&&!s.hatch,'joined: a clean hatch'); }
{ let bad=0, ang=0; for(let i=0;i<40;i++){ const s=base(undefined,0); s.res.deepegg=1; E.hatchEgg(s,E.guildsOf); s.day=s.hatch.due; const n=s.minions.length; E.hatchDay(s,E.addMinion); if(s.minions.length===n)bad++; if(s.houses.dagon.r===-15)ang++; }
  ok(bad>0&&bad<40&&ang===40,'outsiders: bad hatches happen, the Lodge is angry ('+bad+'/40 bad)'); }
console.log('r54 ok',pass);
