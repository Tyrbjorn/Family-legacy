// R81 bloodlines: half-dwarf (1st generation only) / Dwarf-blooded (permanent, 50%) / pure Dwarf; the pair table, the odds, one rng draw per
// birth only when non-human blood is involved, several tags, gates, the save migration (no schema bump) and the UI hooks.
import fs from 'fs'; import * as E from '../js/engine.js'; import { BUILD } from '../js/config.js'; import { STEPS } from '../js/engine/save-steps.js'; import { T } from '../js/engine/state.js';
const R=new URL('../data/',import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const fresh=()=>{const s=E.newGame(1);E.normalize(s);return s;};
ok(/^R(81)$/.test(BUILD)&&E.SCHEMA===55&&STEPS.at(-1).n===55,'R81 build, save stays 55 (no SAVE_VERSION / schema bump)');
ok(D.changelog.entries[0].build==='R81'&&D.changelog.entries[0].items.length>=3&&D.changelog.entries.some(e=>e.build==='R80'),'changelog');
const s0=fresh(), BASE=T.baseLifespan;
const P=()=>({race:'dwarf',traits:[]}), H=()=>({traits:['dwarfblood']}), B=()=>({traits:['dwarfblooded']}), X=()=>({traits:[]});
const kid=()=>({name:'Kid',traits:[],lifespan:BASE});
// trait data
const th=D.traits.find(t=>t.id==='dwarfblood'), tb=D.traits.find(t=>t.id==='dwarfblooded');
ok(th.name==='Half-dwarf'&&th.blood.kind==='half'&&th.stats.STR===2&&th.stats.VIT===2&&th.skillXp.smithing===0.2&&th.life===12,'half-dwarf = today\'s dwarfblood bonuses');
ok(tb&&tb.name==='Dwarf-blooded'&&tb.houseOnly&&tb.blood.kind==='blooded'&&tb.stats.STR===1&&tb.stats.VIT===1&&tb.skillXp.smithing===0.1&&tb.skillXp.farming===-0.1&&tb.life===6,'blooded = exactly 50%, flat');
ok(new Set(D.traits.map(t=>t.id)).size===D.traits.length,'trait ids unique');
// the pair table with a stubbed rng; draws counted
const born=(a,b,u)=>{ let n=0; const c=kid(); const o=E.bloodTrait(s0,c,[a,b],()=>(n++,u)); return {c,o,n}; };
const kindOf=c=>E.heritageOf(c).dwarf||'none';
for(const u of [0,0.5,0.99]){
  let r=born(P(),X(),u); ok(kindOf(r.c)==='half'&&r.c.traits.includes('dwarfblood')&&r.c.lifespan===BASE+12&&r.c.race!=='dwarf'&&r.n===1,'pure x human = always half '+u);
  r=born(X(),P(),u); ok(kindOf(r.c)==='half','human x pure = half '+u);
  r=born(H(),X(),u); ok(kindOf(r.c)==='blooded'&&r.c.traits.join()==='dwarfblooded'&&r.c.lifespan===BASE+6&&r.n===1,'half x human = blooded '+u);
  r=born(B(),X(),u); ok(kindOf(r.c)==='blooded'&&r.c.traits.join()==='dwarfblooded'&&r.n===1,'blooded x human = blooded, no dilution '+u);
  r=born(X(),B(),u); ok(kindOf(r.c)==='blooded','human x blooded');
  r=born(B(),B(),u); ok(kindOf(r.c)==='blooded','blooded x blooded stays blooded');
  r=born(H(),B(),u); ok(kindOf(r.c)==='blooded','half x blooded = blooded');
  r=born(P(),P(),u); ok(kindOf(r.c)==='pure'&&r.c.race==='dwarf'&&r.c.lifespan===110&&r.c.traits.length===0&&r.n===1,'pure x pure = pure, no tag, the Ironbrow-spouse kit only '+u);
}
{ let r=born(H(),H(),0.7); ok(kindOf(r.c)==='half'&&r.n===1,'half x half u=0.7 -> half (75%)'); r=born(H(),H(),0.8); ok(kindOf(r.c)==='pure'&&r.c.race==='dwarf'&&r.c.lifespan===110&&r.c.traits.join()==='dwarfblooded'&&r.n===1,'half x half u=0.8 -> pure + lineage tag');
  r=born(H(),P(),0.59); ok(kindOf(r.c)==='half','half x pure u=0.59 -> half'); r=born(P(),H(),0.61); ok(kindOf(r.c)==='pure'&&r.c.traits.includes('dwarfblooded'),'half x pure u=0.61 -> pure + tag');
  r=born(B(),P(),0.89); ok(kindOf(r.c)==='half','blooded x pure u=0.89 -> half'); r=born(P(),B(),0.91); ok(kindOf(r.c)==='pure'&&r.c.traits.includes('dwarfblooded'),'blooded x pure u=0.91 -> pure + tag'); }
// human-only births draw NOTHING
{ for(const [a,b] of [[X(),X()],[{traits:['hardy']},{traits:['seatouched']}],[X(),null],[{house:'gilmane',traits:[]},X()]]){ const r=born(a,b,0.1); ok(r.n===0&&r.o.length===0&&r.c.traits.length===0&&r.c.lifespan===BASE,'human-only: zero draws, child untouched'); } }
// odds distribution, fixed seeds (mulberry32)
const mul=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
const share=(a,b,seed)=>{const rr=mul(seed);let pure=0,N=20000;for(let i=0;i<N;i++){const c=kid();E.bloodTrait(s0,c,[a(),b()],rr);if(c.race==='dwarf')pure++;}return pure/N;};
const near=(x,y)=>Math.abs(x-y)<0.015;
{ const a=share(H,H,81), b=share(H,P,82), c=share(B,P,83); ok(near(a,0.25)&&near(b,0.40)&&near(c,0.10),'odds distribution pure share: half x half '+a+', half x pure '+b+', blooded x pure '+c);
  ok(a===share(H,H,81),'same seed, same births (deterministic)'); }
// several blood tags: a second race in the data gives a child of half-dwarf x half-elf BOTH blooded tags, from ONE draw
{ const hr=D.creation.heritage, saveT=D.traits.slice();
  hr.races.elf={name:'elf',Name:'Elf',half:'elfblood',blooded:'elfblooded',house:'x',lifespan:140,icon:'🌿'};
  D.traits.push({id:'elfblood',name:'Half-elf',icon:'🌿',rarity:'good',houseOnly:true,life:10,blood:{race:'elf',kind:'half'}},{id:'elfblooded',name:'Elf-blooded',icon:'🌿',rarity:'good',houseOnly:true,life:5,blood:{race:'elf',kind:'blooded'}});
  const he=()=>({traits:['elfblood']}); let r=born(H(),he(),0.5);
  ok(r.c.traits.includes('dwarfblooded')&&r.c.traits.includes('elfblooded')&&!r.c.race&&r.n===1&&r.c.lifespan===BASE+6+5,'half-dwarf x half-elf = human baseline carrying BOTH blooded tags, one draw');
  ok(E.heritageLabels(r.c).join()==='Dwarf-blooded,Elf-blooded','two labels');
  r=born(H(),H(),0.8); ok(kindOf(r.c)==='pure'&&!r.c.traits.includes('elfblooded'),'unrelated race adds nothing');
  delete hr.races.elf; D.traits.length=0; D.traits.push(...saveT); }
// strength: pure dwarf's lineage tag is bookkeeping only
{ const pt={race:'dwarf',traits:['dwarfblooded']}, hb={traits:['dwarfblood']}, bb={traits:['dwarfblooded']}, hu={traits:[]};
  ok(E.traitStat(hb,'STR')===2&&E.traitStat(bb,'STR')===1&&E.traitStat(pt,'STR')===0&&E.traitStat(hu,'STR')===0,'STR: half 2, blooded 1, pure+tag 0, human 0');
  ok(E.traitStat(bb,'VIT')===1&&E.traitSkillXp(bb,'smithing')===0.1&&E.traitSkillXp(pt,'smithing')===0&&E.traitSkillXp(hb,'smithing')===0.2,'XP bonuses: half 0.2, blooded 0.1, pure+tag 0');
  ok(E.heritageLabels(pt).join()==='Dwarf'&&E.heritageLabels(hb).join()==='Half-dwarf'&&E.heritageLabels(bb).join()==='Dwarf-blooded'&&E.heritageLabels(hu).length===0,'UI labels'); }
// gates: half, pure and blooded all qualify
{ const c=D.classes.find(x=>x.bar&&x.bar.dwarf); ok(!!c,'a dwarf-gated class exists'); const s=fresh(), has=m=>E.specialIssues(s,m,c,false).some(x=>/dwarf, half-dwarf/.test(x));
  const mk=(race,traits)=>{const m=E.newMember(s,{age:20}); if(race)m.race=race; m.traits=traits; return m;};
  ok(!has(mk('dwarf',[]))&&!has(mk(undefined,['dwarfblood']))&&!has(mk(undefined,['dwarfblooded']))&&has(mk(undefined,[])),'class gate: pure, half, blooded pass; human fails'); }
{ const s=fresh(); const m=s.members[0]; ok(!E.saveMilestones(s).flags.dwarfBorn,'no dwarfBorn at start'); const c={id:77,parents:[m.id],traits:['dwarfblooded']}; s.members.push(c); ok(E.saveMilestones(s).flags.dwarfBorn===1,'blooded child counts for the Dwarf-blood bloodline unlock'); }
// the old parent-pool leak is closed: blood tags pass ONLY through bloodTrait
{ const s=fresh(); s.bloodline='dwarfblood'; let leaks=0; for(let i=0;i<60;i++){ const c=E.newMember(s,{age:0,parents:[1,2]}); E.inheritTraits(s,c,[{traits:['dwarfblood','dwarfblooded']},{traits:['dwarfblooded']}]); if(c.traits.some(t=>t==='dwarfblood'||t==='dwarfblooded'))leaks++; } ok(leaks===0,'inheritTraits never copies a blood tag'); }
{ const s=fresh(); const m=s.members[0]; m.traits=['dwarfblood']; E.noteBloodline(s,m); ok(s.bloodline!=='dwarfblood','blood tags are not the family Bloodline trait'); }
// houseBirthTrait: the live hook
{ const s=fresh(); const c=E.newMember(s,{age:0,parents:[1,2]}); E.houseBirthTrait(s,c,[P(),X()]); ok(c.traits.includes('dwarfblood')&&s.log.some(l=>/half-dwarf/i.test(JSON.stringify(l))||/Half-dwarf/.test(JSON.stringify(l))),'houseBirthTrait: half-dwarf child + birth line'); }
// Sea-touched stays out of blooded children and pure dwarves
{ const s=fresh(); ok(!E.seaBirth(s,{traits:['dwarfblooded']},[{traits:['seatouched']},{}],()=>0)&&!E.seaBirth(s,{race:'dwarf',traits:[]},[{traits:['seatouched']},{}],()=>0),'one bloodline per child: Sea roll skipped'); }
// save migration: idempotent, no schema bump
{ const s=fresh(), mk=(id,o)=>{const m=E.newMember(s,{age:20,parents:o.parents||null}); m.id=id; delete m.bloodV; m.traits=o.traits||[]; if(o.race)m.race=o.race; m.lifespan=o.lifespan||BASE+12; s.members.push(m); return m;};
  const f=mk(901,{traits:['dwarfblood']}), hum=mk(902,{}), sp=mk(903,{race:'dwarf',lifespan:110}), a=mk(904,{parents:[901,902],traits:['dwarfblood']}), b=mk(905,{parents:[903,902],traits:['dwarfblood']}), c=mk(906,{parents:[904,902],traits:['dwarfblood','hardy']}), d=mk(907,{parents:[903,903],race:'dwarf',lifespan:110}), g=mk(908,{parents:[404,405],traits:['dwarfblood']});
  E.normalize(s); const snap=JSON.stringify(s.members);
  ok(f.traits.join()==='dwarfblood'&&f.lifespan===BASE+12,'founder keeps half');
  ok(a.traits.join()==='dwarfblooded'&&a.lifespan===BASE+6,'half child of a half founder + human -> blooded, -6 years');
  ok(b.traits.join()==='dwarfblood'&&b.lifespan===BASE+12,'child of a pure dwarf keeps half');
  ok(c.traits.join()==='dwarfblooded,hardy'&&c.lifespan===BASE+6,'other traits kept');
  ok(d.race==='dwarf'&&d.lifespan===110&&d.traits.length===0,'pure member unchanged');
  ok(g.traits.join()==='dwarfblood','unknown parents: left alone');
  ok(s.members.filter(m=>m.id>=901).every(m=>m.bloodV===1),'every member marked');
  E.normalize(s); E.normalize(s); ok(JSON.stringify(s.members)===snap,'migration is idempotent (normalize x3)');
  const n=E.newMember(s,{age:0,parents:[901,902]}); ok(n.bloodV===1,'new members are born marked');
  ok(E.SCHEMA===55&&s.schema===55,'schema unchanged'); }
// preview line: words in the line, numbers in the tooltip
{ const hum={traits:[]}, ib={house:'ironbrow',traits:[]};
  let p=E.bloodPreview(hum,ib); ok(p&&/will be Half-dwarf/.test(p.text)&&!/\d/.test(p.text)&&/100%/.test(p.tip),'human x Ironbrow suitor: heirs will be half-dwarf');
  p=E.bloodPreview({traits:['dwarfblood']},ib); ok(/may be Half-dwarf or Dwarf/.test(p.text)&&!/\d/.test(p.text)&&/60%/.test(p.tip)&&/40%/.test(p.tip),'half x Ironbrow: may be half or pure, 60/40 in the tooltip');
  p=E.bloodPreview({traits:['dwarfblood']},{traits:['dwarfblood']}); ok(/may be/.test(p.text)&&/75%/.test(p.tip)&&/25%/.test(p.tip),'half x half-dwarf suitor 75/25');
  p=E.bloodPreview({traits:['dwarfblooded']},hum); ok(/will be Dwarf-blooded/.test(p.text),'blooded x human');
  ok(E.bloodPreview(hum,{traits:[]})===null&&E.bloodPreview(hum,{house:'gilmane',traits:[]})===null,'no line when no dwarf blood is involved'); }
// Encyclopedia: one Heritage entry, found once the family has dwarf blood
{ const c=E.encCatalog(D), e=c.lore.filter(x=>x.id==='heritage:blood'); ok(e.length===1&&e[0].name==='Heritage and bloodlines'&&/75%/.test(e[0].text)&&/Half-dwarf/.test(e[0].text),'Encyclopedia heritage entry');
  const s=fresh(); ok(!E.encObserve(D,s).lore.includes('heritage:blood'),'hidden with no dwarf blood'); s.members[0].traits=['dwarfblooded']; ok(E.encObserve(D,s).lore.includes('heritage:blood'),'found once someone has dwarf blood'); }
// UI hooks present
{ const ft=fs.readFileSync(new URL('../js/ui/family-tab.js',import.meta.url),'utf8'), ht=fs.readFileSync(new URL('../js/ui/houses-tab.js',import.meta.url),'utf8'); ok(/heritageHtml\(m\)/.test(ft)&&/bloodPreview\(m, su\)/.test(ht),'Family-tab label and marriage-preview line wired'); }
// map unchanged
ok(D.world&&D.regions.length>0,'map data present');
console.log('r81 ok '+pass+' checks');
