// Auto Ascend (title slots, closest-to-qualifying, key-job training, cascade, auto-evolve) and Auto Recruit
import fs from 'fs'; import * as E from '../js/engine.js';
const L=n=>JSON.parse(fs.readFileSync(new URL('../data/'+n+'.json',import.meta.url)));
const D={};for(const n of ['fields','skills','classes','traits','buildings','furniture','items','quests','regions','tuning','nodes','towns','minions','guilds','jobs','activities','estate','crafting','map','dungeons','legacy','chronicle','achievements','events','encounters','seasons','tutorial','notify','marriage','families','phases','intros','gear','paths','world','metals'])D[n]=L(n);
for(const f of D.estate.structureFiles)D['structures/'+f]=L('structures/'+f);
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const s=E.newGame(1); E.normalize(s); s.land=['plot']; s.structures=[{uid:'bk',type:'barracks',pieces:[],up:2}];
const C=E.npcClass;
ok(E.established(s)&&E.keyJob(C('n_militia'))==='guard'&&E.titleSkill(C('n_militia'))===2&&E.titleSkill(C('n_sergeant'))===6,'key job + skill by tier');
let k=0; const mk=(cls,lvl,pts,job='idle')=>{const mi={uid:'m'+(k++),type:'laborer',name:'F'+k,cls,lvl,xp:0,job,loyalty:80,since:k,equip:{},skills:{guard:pts}};s.minions.push(mi);return mi;};
const m1=mk('n_militia',10,10), m2=mk('n_militia',10,100), m3=mk('n_militia',4,100), m4=mk('n_militia',2,0), kp=mk('n_militia',12,400);
kp.keepJob=true; for(const id of ['n_horseman','n_scoutnpc','n_huntsman','n_lookout'])E.toggleAuto(s,'asc_'+id);
ok(/skill/.test(E.minionEvolveIssue(s,m1,'n_soldier')||''),'titles need key-job skill');
E.autoAscendDay(s); if(process.env.DBG)console.log(s.minions.map(x=>[x.cls,x.trainFor,x.job]),E.minionEvolveIssue(s,{cls:'n_militia',lvl:99,skills:{guard:1e9,adventure:1e9}},'n_soldier'));
ok([m1,m2,m3].every(x=>x.trainFor==='n_soldier')&&!m4.trainFor&&!kp.trainFor,'3 Soldier slots go to the 3 closest; keep-job follower skipped');
ok(m1.job==='guard','trainee moved to the key job');
E.autoAscendDay(s); ok(m2.cls==='n_soldier'&&!m2.trainFor,'qualified trainee evolves automatically');
ok(!m4.trainFor,'slots still full (holder + 2 trainees)');
// cascade: Sergeant opens (barracks up 3) → the Soldier trains for it, freeing a Soldier slot for the next Militia
s.structures[0].up=3; m2.skills.guard=200; m2.lvl=12; E.autoAscendDay(s);
ok(m2.trainFor==='n_sergeant'&&m4.trainFor==='n_soldier','cascade: Soldier → Sergeant trainee, next Militia takes the Soldier slot');
// peasants aim for a tier-1 title by branch priority (economic has no building → military)
const p=mk('n_peasant',1,0); E.autoAscendDay(s); ok(p.trainFor==='n_militia','peasant trains toward the first buildable tier-1 title');
E.raiseBranch(s,'military'); ok(E.ascPriority(s)[0]==='military','priority can be reordered');
E.toggleAuto(s,'asc_n_soldier'); E.autoAscendDay(s); ok(!m4.trainFor,'title switched off clears its trainees');
E.toggleAuto(s,'ascend'); ok(!E.ascendOn(s),'Auto Ascend toggle');
// Auto Recruit
const r=E.newGame(1); E.normalize(r); r.land=['plot']; r.structures=[{uid:'h',type:'bunkhouse',pieces:['bunk'],up:0}]; r.minions=[]; r.res.coin=5000; r.day=30;
E.autoRecruitDay(r); ok(r.minions.length===0,'Auto Recruit is off by default');
E.toggleRecruit(r); const room=E.minionRoom(r); E.autoRecruitDay(r); if(!room)console.log('recruit: no room');ok(!room||r.minions.length===1,'Auto Recruit hires when on'+(room?'':' (no room in test estate)'));
r.res.coin=10; r.day=60; const n=r.minions.length; E.autoRecruitDay(r); ok(r.minions.length===n,'keeps the coin reserve');
console.log(pass+' minion auto checks passed');
