import fs from 'fs'; import * as E from '../js/engine.js';
const L=n=>JSON.parse(fs.readFileSync(new URL('../data/'+n+'.json',import.meta.url)));
const D={};for(const n of ['fields','skills','classes','traits','buildings','furniture','items','quests','regions','tuning','nodes','towns','minions','guilds','jobs','activities','estate','crafting','map','dungeons','legacy','chronicle','achievements','events','encounters','seasons','tutorial','notify','marriage','families','phases','intros','gear','paths','world','metals'])D[n]=L(n);
for(const f of D.estate.structureFiles)D['structures/'+f]=L('structures/'+f);
E.setData(D); let seed=11; E.setRng(()=>{seed=(seed*16807)%2147483647;return seed/2147483647;});
let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const s=E.newGame(1_700_000_000_000); E.normalize(s);
// calibration sweep: a solo fight at equal HP/morale vs today's success formula 0.5 + (c−q)/(q+20)
const old=(c,q)=>Math.max(0.1,Math.min(0.98,0.5+(c-q)/(q+20)));
let worst=0; const rows=[];
for(const q of [10,40,100]) for(const k of [0.6,0.8,1,1.2,1.4]){ const c=Math.round((q+20)*k-20); if(c<1)continue; let w=0; const N=4000;
  for(let i=0;i<N;i++){ if(E.fight(s,[E.fighter('a',c)],[E.fighter('b',q)]).result==='win') w++; }
  const d=Math.abs(w/N-old(c,q)); worst=Math.max(worst,d); rows.push(`${c}v${q}:${(w/N).toFixed(2)}/${old(c,q).toFixed(2)}`); }
if(process.env.SHOW) console.log(rows.join(' '),'worst',worst.toFixed(3));
ok(worst<=0.05,'calibration: solo fight within ±5% of the old success formula (worst '+worst.toFixed(3)+')');
const wins=(A,B,o={},N=3000)=>{let w=0;for(let i=0;i<N;i++)if(E.fight(s,A(),B(),o).result==='win')w++;return w/N;};
const me=(sk={})=>[E.fighter('me',40,{skills:sk,leader:true})], foe=()=>[E.fighter('foe',40)];
// morale skills
ok(wins(()=>me({brawling:10}),foe)>wins(()=>me(),foe)+0.03,'War Shout (brawling) helps');
ok(wins(()=>me({monsterlore:5}),foe,{monsters:true})>wins(()=>me(),foe,{monsters:true})+0.03,'Know Your Foe vs monsters');
ok(wins(()=>me({tactics:5}),foe)>wins(()=>me(),foe),'Hold the Line helps');
ok(wins(()=>[...me({leadership:10}),E.fighter('ally',40)],()=>[E.fighter('f1',40),E.fighter('f2',40)])>wins(()=>[...me(),E.fighter('ally',40)],()=>[E.fighter('f1',40),E.fighter('f2',40)]),'Rally (leadership) helps a group');
ok(wins(()=>me({healing:10}),foe)>wins(()=>me(),foe),'Field Dressing helps');
// flee: only below the morale threshold; difficulty adjusts the flee roll only
const low=()=>[E.fighter('me',40,{mor:20})];
let fl=0; for(let i=0;i<2000;i++){const r=E.fight(s,low(),[E.fighter('foe',5,{mor:100})]); if(r.result==='fled'&&r.rounds===1)fl++;}
ok(fl>600,'below 25% morale a fighter rolls to flee each round ('+fl+'/2000 fled in round 1)');
const fr=lv=>{let n=0;for(let i=0;i<4000;i++){const r=E.fight(s,[E.fighter('me',40,{mor:20})],[E.fighter('foe',5)],{lvl:lv});if(r.result==='fled'&&r.rounds===1)n++;}return n/4000;};
ok(fr(1)>fr(5)+0.1,'Hearthside flees more easily than Grim Age');
ok(E.optionChance(s,E.active(s),{check:{stat:'STR',dc:5}})===E.optionChance(s,E.active(s),{check:{stat:'STR',dc:5}})&&(E.setDifficulty(s,5),E.optionChance(s,E.active(s),{check:{stat:'STR',dc:5}}))===(E.setDifficulty(s,1),E.optionChance(s,E.active(s),{check:{stat:'STR',dc:5}})),'encounter checks no longer use the flee adjust'); E.setDifficulty(s,3);
const gf=E.fight(s,[E.fighter('a',40,{mor:20}),E.fighter('b',40,{mor:20})],[E.fighter('foe',200)],{lvl:5}); ok(gf.result==='fled'&&gf.rounds===1,'group average below 25% → the whole side flees');
ok(['win','fled','defeat','withdraw'].includes(E.fight(s,me(),foe()).result)&&/after round \d/.test(E.fightWord({result:'fled',rounds:3})),'results + "fled after round 3" wording');
// dungeons: tiers, event counts, story/onClear hooks, loot per tier
const DG=D.dungeons; const tiers=DG.map(E.dungeonTier);
ok(tiers.join().startsWith('1,1,2,3,4,4,3'),'dungeon tiers by first-floor power ('+tiers.join()+')');
ok(DG.every(d=>E.dungeonEvents(d).length===2*E.dungeonTier(d)+2&&E.dungeonEvents(d).at(-1).kind==='fight'),'2·tier+2 events, ending on a fight');
const sd={...DG[0],id:'t_story',story:[{at:1,text:'An old carving.'}],onClear:{unlock:'recipe:r_sword',text:'You found plans.'}};
ok(E.dungeonEvents(sd).filter(e=>e.kind==='story').length===1,'story beats insert into the sequence');
const g=E.newGame(1_700_000_000_000); E.normalize(g); const gm=E.active(g); gm.ageDays=25*360; Object.assign(gm.stats,{STR:80,VIT:80,AGI:80,WIL:80}); g.unlocks=g.unlocks.filter(u=>u!=='recipe:r_sword');
const t={}; let okAll=true; for(let i=0;i<sd.floors.length;i++) okAll=okAll&&E.dungeonFloor(g,gm,sd,i,t); 
ok(okAll&&g.log.some(l=>/old carving/.test(l.msg)),'strong member clears a tier-1 run, story logged');
E.dungeonClear(g,gm,sd); ok(g.unlocks.includes('recipe:r_sword')&&g.log.some(l=>/found plans/.test(l.msg)),'onClear unlock fires');
// a weak member: the log names the round, beaten = injured, fled = not injured by fleeing
const w=E.newGame(1_700_000_000_000); E.normalize(w); const wm=E.active(w); wm.ageDays=20*360; let sawRound=false;
for(let i=0;i<20&&!sawRound;i++){wm.injured=0; E.dungeonFloor(w,wm,DG[4],0,{}); sawRound=w.log.some(l=>/after round \d+ in /.test(l.msg));}
ok(sawRound,'dungeon fights logged with the round they ended');
// bandits: turn-based, logged with the round
const before=E.winChance; ok(typeof before==='function','win estimate kept for the trade UI');
console.log(pass+' combat tests passed');
