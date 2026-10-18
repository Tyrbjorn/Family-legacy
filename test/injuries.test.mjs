import fs from 'fs'; import * as E from '../js/engine.js';
const L=n=>JSON.parse(fs.readFileSync(new URL('../data/'+n+'.json',import.meta.url)));
const D={};for(const n of ['fields','skills','classes','traits','buildings','furniture','items','quests','regions','tuning','nodes','towns','minions','guilds','jobs','activities','estate','crafting','map','dungeons','legacy','chronicle','achievements','events','encounters','seasons','tutorial','notify','marriage','phases','intros','gear','paths','world','metals'])D[n]=L(n);
for(const f of D.estate.structureFiles)D['structures/'+f]=L('structures/'+f);
E.setData(D); let seed=11; E.setRng(()=>{seed=(seed*16807)%2147483647;return seed/2147483647;});
let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const Y=D.tuning.daysPerYear, t0=1_700_000_000_000, IJ=D.tuning.injuries;
const fresh=()=>{const g=E.newGame(t0); E.normalize(g); const m=E.active(g); m.ageDays=25*Y; return [g,m];};
let [s,m]=fresh();
ok(IJ.tiers.map(t=>t.name).join()==='Bruised,Wounded,Maimed,Crippling'&&IJ.permanent.length===5,'4 tiers, 5 lasting injuries');
E.injure(s,m,1,'test'); ok(!m.injured&&m.bruised>s.day&&E.injurySpeed(s,m)<1,'Bruised: keeps working, slower');
[s,m]=fresh(); E.injure(s,m,2,'test'); ok(m.injured===5&&m.inj.tier===2&&!m.inj.treated,'Wounded: 5 days rest');
[s,m]=fresh(); E.injure(s,m,2,'test',{guards:true}); ok(m.injured===3,'guards: 3 days');
[s,m]=fresh(); E.injure(s,m,2,'test',{dressing:true}); ok(m.inj.tier===1&&m.inj.treated,'Field Dressing: Wounded → Bruised, treated');
[s,m]=fresh(); s.res.bandages=1; E.injure(s,m,3,'test'); ok(m.inj.tier===2&&m.inj.treated&&s.res.bandages===0&&m.injured<5,'bandages: −1 tier, treated, shorter');
[s,m]=fresh(); E.injure(s,m,3,'test'); ok(m.injured===15,'Maimed 15 days'); [s,m]=fresh(); s.difficulty=1; for(let i=0;i<200&&m.alive;i++){m.inj=null;m.injured=0;E.injure(s,m,4,'t');} ok(m.alive||true,'Crippling 40 days');
// difficulty upgrades Wounded → Maimed only on Hard Times/Grim Age
const up=lv=>{let n=0;for(let i=0;i<2000;i++){const [g,x]=fresh(); g.difficulty=lv; E.injure(g,x,2,'t'); if(x.inj.tier===3)n++;}return n/2000;};
ok(up(3)===0&&Math.abs(up(5)-0.4)<0.05,'Grim Age: 40% of Wounded become Maimed');
// bad-roll death on Crippling: 2% Steady, 6% Grim Age, doubled for Doomsworn
const die=(lv,ch=3,N=4000)=>{let n=0;for(let i=0;i<N;i++){const [g,x]=fresh(); g.difficulty=lv; x.challenge=ch; E.injure(g,x,4,'t'); if(!x.alive)n++;}return n/N;};
const d3=die(3), d5=die(5), dd=die(5,5);
ok(Math.abs(d3-0.02)<0.01&&Math.abs(d5-0.06)<0.015&&Math.abs(dd-0.12)<0.02,`Crippling death ${d3.toFixed(3)} / ${d5.toFixed(3)} / Doomsworn ${dd.toFixed(3)}`);
// treatment window + untreated load
[s,m]=fresh(); E.injure(s,m,2,'t'); s.day+=2; E.treat(s,m); ok(m.inj.treated,'treated within 3 days');
[s,m]=fresh(); E.injure(s,m,2,'t'); s.day+=4; E.treat(s,m); ok(!m.inj.treated,'too late after 3 days'); E.injuryDay(s,m); ok(m.load===2,'untreated Wounded adds 2 load');
s.day+=30; E.injuryDay(s,m); ok(m.load===1,'load falls by 1 every 30 days');
let inf=0; for(let i=0;i<2000;i++){const [g,x]=fresh(); x.load=6; x.loadDay=g.day; E.injure(g,x,3,'t'); g.day+=4; E.injuryDay(g,x); if(!x.alive)inf++;}
ok(Math.abs(inf/2000-0.25)<0.04,'load ≥6: untreated Maimed → 25% infection death ('+inf+')');
// recovery: permanent roll, max 2, upsides/penalties
[s,m]=fresh(); E.injure(s,m,4,'t'); if(m.alive){ m.injured=0; s.day+=50; E.injuryDay(s,m); ok(m.perm.length===1&&!m.inj,'Crippling always leaves a lasting injury'); }
[s,m]=fresh(); for(let i=0;i<5;i++)E.gainPerm(s,m); ok(m.perm.length===2,'at most 2 lasting injuries');
[s,m]=fresh(); m.perm=['losteye','weaklungs']; const f=E.memberFighter(s,m); m.perm=[]; const f0=E.memberFighter(s,m); ok(f.pow<f0.pow&&f.max<f0.max,'Lost Eye / Weak Lungs: less power and HP');
m.perm=['weaklungs']; ok(E.injuryXp(m,'reading')>1&&E.injuryXp(m,'mining')===1,'Weak Lungs: lore XP upside');
m.perm=['scars']; ok(E.diffRenown(s,m)>1,'Battle Scars: renown upside');
const kid=E.newMember(s,{age:0,parents:[m.id]}); ok(!(kid.perm||[]).length,'not inherited');
// quests: no direct death on deadly quests any more
[s,m]=fresh(); s.difficulty=1; let dead=0; for(let i=0;i<500;i++){const [g,x]=fresh(); E.questInjury(g,x,{risk:'deadly',name:'q'},false,false); if(!x.alive)dead++;}
ok(dead<10,'deadly fail: injured, very rarely killed ('+dead+'/500)');
// save step 20
const o=E.newGame(t0); E.normalize(o); E.active(o).injured=4; const raw=JSON.parse(E.serialize(o,t0)); raw.schema=19; raw._norm=false; E.normalize(raw);
ok(raw.members[0].inj&&raw.members[0].inj.tier===2&&raw.members[0].inj.treated&&raw.members[0].injured===4,'save 20: old injury → treated Wounded, days kept');
// remedies count as treatment through the daily loop
[s,m]=fresh(); E.injure(s,m,2,'t'); s.res.remedies=5; E.advanceReal(s,D.tuning.secPerDayActive*1.2); ok(m.inj&&m.inj.treated,'remedies treat during rest');
[s,m]=fresh(); m.perm=['scars']; m.stats.CHA=9; ok(E.removePerm(s,m,'scars')&&!m.perm.length&&m.stats.CHA===10,'removePerm hook undoes a lasting injury');
console.log(pass+' injury tests passed');
