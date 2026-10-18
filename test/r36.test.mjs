// R36: Talents
import fs from 'fs'; import * as E from '../js/engine.js'; import { T } from '../js/engine/state.js';
const R=new URL('../data/',import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const L=D.talents, Q=D.quests.quests||D.quests, ranks=D.guilds.ranks.map(r=>r.name);
const fresh=()=>{const s=E.newGame(1);E.normalize(s);return s;}; const Y=T.daysPerYear;
const adult=(s,cls)=>{const m=E.newMember(s,{gender:'m',age:30});m.cls=cls||null;s.members.push(m);return m;};
// data
ok(L.talents.length===10,'10 talents'); ok(L.slots.base===2&&L.slots.perTier===1&&L.slots.cap===4&&L.slots.max===5&&L.shrines.max===3,'slots 2+1/tier cap 4 (5), 3 shrines');
const FX=['xp','skillXp','magicCap','craft','injury','hunt','travel','buy','slots'];
for(const t of L.talents){ const f=t.from; ok(f.class?D.classes.find(c=>c.id===f.class&&!c.retired):f.guild?D.guilds.guilds.find(g=>g.id===f.guild)&&ranks.includes(f.rank):f.quest?Q.find(q=>q.id===f.quest):f.tutorial,'source real: '+t.id);
  ok(Object.keys(t.fx).every(k=>FX.includes(k)),'fx known: '+t.id); for(const k of Object.keys(t.fx.skillXp||{})) ok(D.skills.find(x=>x.id===k),'skill '+k); }
ok(!L.talents.some(t=>t.id==='nimble')&&D.traits.find(t=>t.id==='nimble'),'Nimble stays a trait (no duplicate talent)');
// earning: class pick, evolution line, guild rank, quest, tutorial
{ const s=fresh(); const m=adult(s,'fighter'); E.talentDay(s); ok(m.talents.own.includes('shieldwall')&&m.talents.on.includes('shieldwall'),'class pick earns + auto-activates'); ok(s.log.some(l=>/earned the talent/.test(l.msg)),'log line');
  m.cls='knight'; E.talentDay(s); ok(m.talents.own.filter(x=>x==='shieldwall').length===1,'earned once; kept after evolving');
  const e=adult(s,'elementalist'); E.talentDay(s); ok(e.talents.own.includes('spellfocus')&&e.talents.own.includes('quickstudy'),'evolution: tier-1 talent + line talent');
  const r=adult(s); r.guild={id:'rogues',rank:0,rep:0}; E.talentDay(s); ok(!(r.talents.own||[]).includes('haggler'),'Initiate: no Haggler'); r.guild.rank=1; E.talentDay(s); ok(r.talents.own.includes('haggler'),'Journeyman: Haggler');
  const h=adult(s); h.craft={id:'hearth',rank:1,rep:0}; E.talentDay(s); ok(h.talents.own.includes('steadyhands'),'craft guild rank: Steady Hands');
  const q=adult(s); E.talentQuest(s,q,'rq_millbridge'); ok(q.talents.own.includes('bridgebuilder'),'quest doer earns');
  ok(fs.readFileSync(new URL('../js/engine/quests.js',import.meta.url)).toString().includes('talentQuest(s, m, q.id)'),'quest hook');
  const k=E.newMember(s,{gender:'f',age:10}); s.members.push(k); k.cls='fighter'; E.talentDay(s); ok(!(k.talents&&k.talents.own.length),'adults only');
  const s2=fresh(); s2.tut.step=999; s2.tut.skipped=false; s2.members[0].ageDays=30*Y; E.talentDay(s2); ok(s2.members[0].talents.own.includes('orrinspupil'),'prologue: Orrin\'s Pupil to founder'); }
// slots
{ const s=fresh(); const m=adult(s,'fighter'); ok(E.talentSlots(m)===2,'tier 0: 2'); m.cls='knight'; ok(E.talentSlots(m)===3,'tier 1: 3'); m.cls='warlord'; ok(E.talentSlots(m)===4,'tier 2: 4');
  m.cls='fighter'; for(const id of ['shieldwall','pathfinder','haggler']) E.grantTalent(s,m,id); ok(m.talents.on.length===2&&m.talents.own.length===3,'full slots: learned only');
  ok(!E.toggleTalent(s,m,'haggler'),'cannot exceed slots'); ok(E.toggleTalent(s,m,'pathfinder')&&E.toggleTalent(s,m,'haggler')&&m.pins.talents,'swap free + pins');
  m.cls='warlord'; E.grantTalent(s,m,'heirofvael'); ok(E.talentSlots(m)===5&&m.talents.on.includes('heirofvael'),'Heir of Vael: 5'); ok(!E.toggleTalent(s,m,'heirofvael'),'Heir cannot free its own slot');
  const n=adult(s,'fighter'); E.grantTalent(s,n,'heirofvael'); ok(E.talentSlots(n)===3,'tier 0 + Heir = 3'); }
// effects
{ const s=fresh(); const m=adult(s,'fighter'); const x0=E.xpMult(s,m,'carpentry'); E.grantTalent(s,m,'bridgebuilder'); ok(Math.abs(E.xpMult(s,m,'carpentry')-x0-0.1)<1e-9,'skillXp reaches xpMult');
  m.traits=['quick']; const tq=E.traitSum(m,'xp'); E.grantTalent(s,m,'orrinspupil'); ok(Math.abs(E.traitSum(m,'xp')-tq-0.05)<1e-9,'trait + talent add');
  const b=adult(s); const it=(D.items.items||D.items).find(i=>i.value>50); const t=D.towns[0]; const p0=E.buyPrice(it,s,t.id); E.grantTalent(s,b,'haggler'); ok(E.buyPrice(it,s,t.id)<p0,'Haggler cuts buy price');
  const w=adult(s); w.action={type:'quest',target:Q[0].id}; const v0=E.injurySpeed(s,w); E.grantTalent(s,w,'pathfinder'); ok(Math.abs(E.injurySpeed(s,w)-v0*1.1)<1e-9,'Pathfinder trips +10%');
  const c=adult(s); c.action={type:'craft'}; const c0=E.injurySpeed(s,c); E.grantTalent(s,c,'steadyhands'); ok(Math.abs(E.injurySpeed(s,c)-c0*1.1)<1e-9,'Steady Hands craft +10%');
  const sw=adult(s); E.grantTalent(s,sw,'shieldwall'); let hurt=0; for(let i=0;i<400;i++){sw.inj=null;sw.injured=0;sw.alive=true;const was=JSON.stringify([sw.inj,sw.injured]);E.injure(s,sw,1,'test'); if(sw.injured>0||sw.inj)hurt++;} ok(hurt>250&&hurt<380,'Shield Wall skips ~20% injuries ('+hurt+')');
  ok(fs.readFileSync(new URL('../js/engine/map.js',import.meta.url)).toString().includes('talentSum(m, "hunt")'),'Tracker\'s Eye hook'); }
// shrines
{ const s=fresh(); const a=adult(s,'fighter'); E.talentDay(s); E.kill(s,a,'test'); ok(!(s.shrines||[]).length,'no Hall: no shrine');
  s.structures.push({uid:'h1',type:'ancestorhall',pieces:[],up:0});
  for(const id of ['pathfinder','haggler','spellfocus']){const d=adult(s); E.grantTalent(s,d,id); E.kill(s,d,'t');} ok(s.shrines.length===3,'3 shrines');
  const d=adult(s); E.grantTalent(s,d,'bridgebuilder'); E.kill(s,d,'t'); ok(s.shrines.length===3&&s.shrineOffer&&s.shrineOffer.ids.includes('bridgebuilder'),'full: offer to replace');
  ok(E.enshrine(s,'bridgebuilder','haggler')&&s.shrines.includes('bridgebuilder')&&!s.shrines.includes('haggler')&&s.shrines.length===3,'replace keeps cap 3');
  const p=adult(s); const kid=E.newMember(s,{gender:'f',age:17,parents:[p.id]}); kid.parents=[p.id]; s.members.push(kid); E.talentDay(s); ok(!(kid.talents&&kid.talents.own.length),'17: not yet');
  kid.ageDays=18*Y; E.talentDay(s); ok(['pathfinder','spellfocus','bridgebuilder'].every(id=>kid.talents.own.includes(id))&&kid.talents.on.length===2,'descendant learns shrines at 18, slots apply');
  const sp=adult(s); E.talentDay(s); ok(!(sp.talents.own||[]).some(id=>s.shrines.includes(id)),'married-in adults do not'); }
// next hint / hidden
{ const s=fresh(); const m=adult(s,'fighter'); E.talentDay(s); const nx=E.nextTalents(s,m); ok(!nx.some(x=>x.t.from.quest),'quest talents never hinted'); ok(E.hiddenTalents(m)===2,'2 hidden quest talents');
  const a=adult(s,'apprentice'); ok(E.nextTalents(s,a).some(x=>x.t.id==='spellfocus'),'apprentice → Elementalist hint'); const r=adult(s); r.guild={id:'rogues',rank:0}; ok(E.nextTalents(s,r).some(x=>x.t.id==='haggler'),'guild rank hint'); }
// auto
{ const s=fresh(); const m=adult(s,'fighter'); for(const id of ['shieldwall','orrinspupil','trackerseye']) E.grantTalent(s,m,id); m.action={type:'gather'}; E.talentAuto(s,m); ok(m.talents.on.includes('trackerseye')&&m.talents.on.length===2,'auto swaps in the gather talent');
  m.pins={talents:true}; m.action={type:'craft'}; const on=[...m.talents.on]; E.talentAuto(s,m); ok(JSON.stringify(on)===JSON.stringify(m.talents.on),'pinned loadout kept'); }
// migration v36
{ const s=fresh(); s.schema=35; const m=adult(s,'knight'); m.guild={id:'rogues',rank:2}; delete m.talents; s.doneQuests.push('rq_millbridge'); s.head=m.id; E.normalize(s);
  ok(m.talents.own.includes('shieldwall')&&m.talents.own.includes('haggler')&&m.talents.own.includes('bridgebuilder'),'v36: class line, guild rank, head quest talents'); ok(Array.isArray(s.shrines)&&s.shrines.length===0,'no shrines');
  const j=JSON.stringify(m.talents); E.talentMigrate(s); ok(JSON.stringify(m.talents)===j,'idempotent'); ok(E.SCHEMA===36,'schema 36'); }
console.log('r36 ok',pass);
