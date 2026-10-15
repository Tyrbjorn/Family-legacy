import fs from 'fs'; import * as E from '../js/engine.js';
const L=n=>JSON.parse(fs.readFileSync(new URL('../data/'+n+'.json',import.meta.url)));
const D={};for(const n of ['skills','classes','traits','buildings','furniture','items','quests','regions','tuning','nodes','towns','minions','guilds','jobs','activities','estate','crafting','map','dungeons','legacy','chronicle','achievements','events','encounters','seasons','tutorial','notify','marriage','phases','intros','gear','paths','world','metals'])D[n]=L(n);
for(const f of D.estate.structureFiles)D['structures/'+f]=L('structures/'+f);
E.setData(D); let seed=11; E.setRng(()=>{seed=(seed*16807)%2147483647;return seed/2147483647;});
let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const Y=D.tuning.daysPerYear, t0=1_700_000_000_000;
const s=E.newGame(t0); E.normalize(s); const m=E.active(s); m.ageDays=20*Y;
ok(E.gameLvl(s)===3&&E.chalLvl(m)===3&&E.diffName(3)==='Steady'&&E.chalName(5)==='Doomsworn','defaults: Steady / Driven (level 3)');
const q={cp:40,risk:'risky',type:'hunt',loot:[]};
const qq={cp:Math.max(5,E.cp(s,m))}; const p3=E.successChance(s,m,qq), g3=E.resGain(s);
E.setDifficulty(s,5);ok(E.successChance(s,m,qq)<p3&&Math.abs(E.resGain(s)-g3*0.8)<1e-9,'Grim Age: tougher enemies, slower production');
E.setDifficulty(s,1); ok(E.successChance(s,m,qq)>p3,'Hearthside: easier fights');
// snapshot: an action keeps the level it started with
E.setDifficulty(s,5); m.action={type:'quest',target:'x',progress:0}; E.stampDiff(s,m.action); E.setDifficulty(s,1);
ok(E.actLvl(s,m)===5&&E.successChance(s,m,qq)<p3,'switching mid-quest changes nothing (snapshot)');
m.action=null;
// renown / xp, combined cap
const fam=E.newMember(s,{age:0}); s.members.push(fam);
ok(E.setChallenge(s,fam.id,5)&&fam.challenge===5,'challenge chosen in the first year');
fam.ageDays+=Y; ok(!E.setChallenge(s,fam.id,1)&&fam.challenge===5,'challenge fixed after the first year');
ok(!E.setChallenge(s,m.id,1),'existing members cannot change challenge');
E.setDifficulty(s,5); ok(Math.abs(E.diffRenown(s,fam)-1.8)<1e-9,'combined renown capped at ×1.8 (1.3×1.5)');
ok(Math.abs(E.diffXp(s,fam)-1.2*0.8)<1e-9,'XP: game ×1.2, Doomsworn ×0.8');
fam.ageDays=20*Y; const fq={cp:Math.max(5,E.cp(s,fam))}; const p5=E.successChance(s,fam,fq); fam.challenge=3; ok(E.successChance(s,fam,fq)-p5>0.09,'Doomsworn: −0.10 on rolls');
ok(E.chalFx({minion:true},'roll')===0&&E.chalFx({minion:true},'xp')===1,'challenge is family only');
// loot reads base power; Legendary cap unchanged
const top={cp:400,risk:'deadly',type:'dungeon',loot:[]};
ok(Math.abs(E.rarityOdds(top,5).Legendary-E.rarityOdds(top,3).Legendary)<1e-9,'Legendary cap holds at Grim Age');
ok(E.rarityOdds(q,5).Epic>E.rarityOdds(q,3).Epic&&E.dropChance(q,0,5)>E.dropChance(q,0,3)&&E.dropChance(top,1,5)<=0.6,'harder game: more and better loot, still clamped');
ok(E.lootDiff(q)===1,'loot uses base quest power');
// bandits + events
const r={guard:null,escorts:[]}; s.trade=s.trade||{patrols:[]}; s.trade.patrols=s.trade.patrols||[];
E.setDifficulty(s,3); const b3=E.segRisk(s,r,'a','b'); E.setDifficulty(s,5); ok(Math.abs(E.segRisk(s,r,'a','b')-b3*1.5)<1e-9,'bandits ×1.5 at Grim Age');
ok(D.events.types.filter(t=>t.bad).length>=5,'bad world events marked');
// renames + migration 19
ok(D.paths.comboPaths.find(c=>c.id==='apothecary').name==='Remedist','Apothecary combo shown as Remedist (id kept)');
ok(D.paths.paths.find(p=>p.id==='woodsman').specs.find(x=>x.id==='herbalist').name==='Forest Sense','Woodsman Herbalist → Forest Sense');
ok(!D.paths.paths.find(p=>p.id==='farmer').specs.some(x=>x.id==='brewer'),'Brewer specialty cut');
const o=E.newGame(t0); E.normalize(o); E.active(o).paths=[{id:'farmer',xp:50,rank:2,spec:'brewer',sxp:30,srank:1}];
const raw=JSON.parse(E.serialize(o,t0)); raw.schema=18; raw._norm=false; E.normalize(raw);
const fp=raw.members[0].paths[0]; ok(fp.spec===null&&fp.rank===2&&fp.xp===50&&raw.schema>=19,'save 19: Brewer cleared, path rank kept');
console.log(pass+' difficulty tests passed');
