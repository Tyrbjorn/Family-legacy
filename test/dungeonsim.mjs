// Dungeon clear-rate check (not a pass/fail test): old per-floor rolls vs the new event runs, member power = last floor × 1/1.25/1.5.
import fs from 'fs'; import * as E from '../js/engine.js';
const L=n=>JSON.parse(fs.readFileSync(new URL('../data/'+n+'.json',import.meta.url)));
const D={};for(const n of ['skills','classes','traits','buildings','furniture','items','quests','regions','tuning','nodes','towns','minions','guilds','jobs','activities','estate','crafting','map','dungeons','legacy','chronicle','achievements','events','encounters','seasons','tutorial','notify','marriage','phases','intros','gear','paths','world','metals'])D[n]=L(n);
for(const f of D.estate.structureFiles)D['structures/'+f]=L('structures/'+f);
E.setData(D); let seed=11; E.setRng(()=>{seed=(seed*16807)%2147483647;return seed/2147483647;});
let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const s=E.newGame(1e12); const C=D.tuning.combat;
const old=(c,q)=>Math.max(0.1,Math.min(0.98,0.5+(c-q)/(q+20)));
for(const dg of D.dungeons){ const row=[];
 for(const k of [1,1.25,1.5]){ const c=Math.round(dg.floors.at(-1).cp*k);
  const pOld=dg.floors.reduce((a,f)=>a*old(c,f.cp),1); let w=0,N=2000;
  for(let i=0;i<N;i++){ const me=E.fighter('me',c,{hp:100,leader:true}); let ok=true;
    for(const ev of E.dungeonEvents(dg)){ if(ev.kind==='check'){ if(Math.random()<0.5){me.hp-=C.dungeon.checkFail*100; me.mor-=C.morPerHp*C.dungeon.checkFail;} if(me.hp<=0){ok=false;break;} continue;}
      const start=me.mor; const r=E.fight(s,[me],[E.fighter('foe',ev.cp)]); if(r.result!=='win'){ok=false;break;} me.mor=Math.min(100,me.mor+C.between); me.hp=Math.min(100,me.hp+30);}
    if(ok)w++; }
  row.push(`×${k}: old ${pOld.toFixed(2)} new ${(w/N).toFixed(2)}`);}
 console.log(dg.id,'tier',E.dungeonTier(dg),row.join(' | '));}
