// R61: carry-over bonus effects (travel, Quickened Years, road), side perks, whole-coin sale bonus; no save step
import fs from 'fs'; import * as E from '../js/engine.js'; import { BUILD } from '../js/config.js'; import { STEPS } from '../js/engine/save-steps.js';
const root=new URL('../',import.meta.url).pathname; const D={};
for(const f of fs.readdirSync(root+'data').filter(f=>f.endsWith('.json'))) D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(root+'data/'+f));
for(const f of D.estate.structureFiles) D['structures/'+f]=JSON.parse(fs.readFileSync(root+'data/structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const Y=D.tuning.daysPerYear;
const fresh=()=>{const s=E.newGame(1);E.normalize(s);E.skipTutorial&&E.skipTutorial(s);s.res.coin=1e5;return s;};
ok(+BUILD.slice(1)>=61&&E.SCHEMA===55&&STEPS.at(-1).n===55,'R61, no new save step'); ok(JSON.parse(fs.readFileSync(root+'data/changelog.json')).entries.some(e=>e.build==='R61'),'changelog first');
{const s=fresh(); const t0=E.tickBonus(s); s.lb={quick:1,ids:[]}; ok(Math.abs(E.tickBonus(s)-t0-0.05)<1e-9,'quick +5% tick'); s.speed=1e6; ok(E.globalTick(s)<=D.legacy.tickCap||D.legacy.tickCap==null,'tick cap holds');}
{const s=fresh(); const rec={ach:{a_enc5:1},flags:{thaneOath:1},bonuses:{}}; E.applyLegacyBonuses(s,rec); ok(s.lb.travel===0.05,'travel fx'); ok(s.discovered.includes('dwarfhold')&&s.discovered.includes('loc:l_dwarfhold'),'road: Dwarfhold known'); ok(E.perkTravel(s,'highlands')>=1.05-1e-9,'road boon x1.05'); ok(!E.gateOpen(s),'gate still shut');}
{const s=fresh(); s.res.coin=0; s.lb={coin:0.02,ids:[]}; let c=0; for(let i=0;i<100;i++){const g=E.lbCoin(s,7); ok(Number.isInteger(g),'whole coin'); c+=g;} ok(c===700+14,'carry adds up ('+c+')');}
{const s=fresh(); s.r60f={gate_sealed:'b'}; s.raidFreeTo=(s.day||0)+360; ok(s.raidFreeTo>s.day,'sealed: raid-free window');}
{const s=fresh(); const m=s.members[0]; const x0=m.skills.faith.xp; E.gainXp(s,m,'faith',1); const a=m.skills.faith.xp-x0; s.r60f={church_side:'b'}; const x1=m.skills.faith.xp; E.gainXp(s,m,'faith',1); ok(Math.abs((m.skills.faith.xp-x1)/a-1.05)<0.02||a===0,'church +5% faith xp');}
console.log('PASS test/r61.test.mjs: '+pass+' R61 checks passed');
