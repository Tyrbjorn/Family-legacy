// R47: second guilds, Architects' Guild (buildMult hook, roles, chain, Builder's Yard, road works), save step 43,
// Steward route from the data `route` effect.
import fs from "fs"; import * as E from "../js/engine.js"; import { BUILD } from "../js/config.js";
const R=new URL("../data/",import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const Y=D.tuning.daysPerYear;
const base=()=>{const s=E.newGame(1);E.normalize(s);const m=s.members[0];m.ageDays=25*Y;s.res.coin=1e6;for(const k of ['wood','stone','planks','blocks','ingots','cloth','marbleblocks','dust','copper'])s.res[k]=1e5;return s;};
const setSk=(m,o)=>{for(const[k,v]of Object.entries(o))m.skills[k].lvl=v;};
const lvTo=(m,lv)=>{const ks=Object.keys(m.skills);let i=0;while(E.level(m)<lv)m.skills[ks[i++%ks.length]].lvl++;};
const kid=(s,par,age=25)=>{const m=JSON.parse(JSON.stringify(s.members[0]));m.id=s.nextId++;m.name='Kid'+m.id;m.parents=par;m.ageDays=age*Y;m.guild=null;m.guild2=null;m.class2=null;m.cls=null;m.secondGuild=null;m.paths=[];s.members.push(m);return m;};
// ---- data + build + schema
ok(BUILD==='R47'&&E.SCHEMA===43,'R47, save step 43');
const A=E.guildDef('architects'); ok(A&&!A.open&&A.town==='ashford'&&A.board==='millbrook'&&A.grantsClass==='builder'&&A.req.skills.masonry===5&&A.req.skills.carpentry===5&&A.req.coin===120,"Architects' Guild: sworn, Ashford (board Millbrook), masonry 5 + carpentry 5 + 120 coin, entry Builder");
const T=id=>E.findId(D.classes,id).tier; ok(T('builder')===0&&T('b_masterbuilder')===1&&T('b_surveyor')===1&&T('b_architect')===2&&T('b_fortwright')===2&&T('b_planner')===2,'Builder → Master Builder/Surveyor → Architect/Fortwright/Town Planner');
ok(['builder','b_masterbuilder','b_surveyor','b_architect','b_fortwright','b_planner'].every(id=>E.guildOfCls(id)==='architects')&&!D.classes.find(c=>c.id==='architect').guild,"all six classes belong to the Architects' Guild; the retired architect id is untouched");
ok(E.chainOf('architects').length===4&&E.chainOf('architects').every(x=>E.findId(D.quests,x.quest)&&D.map.points[x.quest]),'4 chain quests with map pins (the Master trial is expansion)');
ok(E.findId(D.skills,'drafting').guild==='architects'&&E.guildShop('architects').length>=2&&E.structDef('buildersyard').guildBoost.guild==='architects'&&D.activities.some(a=>a.skills.includes('drafting')),"Architects' guild skill (Drafting), shop, class building and activity");
// ---- buildMult hook
{ const s=base(), m=s.members[0];
  ok(E.buildDisc(s,'estate')===0&&E.bcost(s,{coin:100},'estate').coin===100,'no Architect: full price');
  m.cls='builder'; ok(Math.abs(E.buildDisc(s,'defense')-0.05)<1e-9&&E.bcost(s,{coin:100,stone:40},'field').coin===95&&E.bcost(s,{coin:100,stone:40},'field').stone===38,'Builder: −5% coin and materials on every build');
  m.cls='b_architect'; ok(Math.abs(E.buildDisc(s,'manor')-0.2)<1e-9&&Math.abs(E.buildDisc(s,'field')-0.05)<1e-9,'Architect: −20% on estate and manor, −5% elsewhere');
  ok(E.bcost(s,{marbleblocks:100},'manor').marbleblocks===68,'Architect: fine buildings use 15% fewer marble blocks (on top of the discount)');
  m.cls='b_fortwright'; ok(Math.abs(E.buildDisc(s,'defense')-0.25)<1e-9&&Math.abs(E.buildDisc(s,'barracks')-0.15)<1e-9,'Fortwright: −25% walls/towers/palisades, −15% barracks');
  m.paths=[{id:'mason',xp:1e5,rank:2,spec:'castellan',sxp:0,srank:1}]; ok(Math.abs(E.buildDisc(s,'barracks')-0.2)<1e-9&&E.buildDisc(s,'defense')===0.25,'Castellan helps a Fortwright lightly; the 25% cap holds');
  const k2=kid(s,[]); k2.cls='b_masterbuilder'; ok(Math.abs(E.buildDisc(s,'estate')-0.1)<1e-9,'best holder per tag counts, not stacked (Fortwright 5% + Master Builder 10% → 10%)');
  s.structures.push({uid:'by1',type:'buildersyard',pieces:[],up:0}); ok(Math.abs(E.buildDisc(s,'estate')-0.15)<1e-9,"Builder's Yard adds −5%");
  const hall={uid:'h1',type:'hall',pieces:[],up:0,fittings:['draftingroom']}; s.structures.push(hall); ok(Math.abs(E.buildDisc(s,'estate',true)-0.2)<1e-9&&Math.abs(E.buildDisc(s,'estate')-0.15)<1e-9,'Drafting Room: −5% on upgrades only'); }
{ const s=base(), m=s.members[0]; s.land=[D.estate.lands[0].id]; m.cls='builder';
  const c0=s.res.coin, d=E.structDef('bunkhouse'); const st=E.buildStructure(s,'bunkhouse'); ok(st&&c0-s.res.coin===Math.round(d.cost.coin*0.95)&&s.buildSaved===d.cost.coin-Math.round(d.cost.coin*0.95),'buildStructure pays the discounted price; the saving is tallied');
  ok(E.fieldCost(s).coin===Math.round(D.fields.build.coin*0.95),'fields use the hook');
  const dc=E.bcost(s,D.endgame.defenses.wall.tiers[0].cost,'defense'); ok(dc.coin===Math.round(D.endgame.defenses.wall.tiers[0].cost.coin*0.95),'wall price discounted'); }
// ---- Surveyor land, Fortwright defence, Town Planner village
{ const s=base(), m=s.members[0]; s.land=[D.estate.lands[0].id]; const l0=E.landSlots(s); m.cls='b_surveyor'; m.guild={id:'architects',rank:0,rep:0};
  ok(E.landSlots(s)===l0,'Surveyor: no land slot below Journeyman'); m.guild.rank=1; ok(E.landSlots(s)===l0+1,'Surveyor at Journeyman: +1 land slot');
  s.eg={quarries:{},defs:{wall:1},funded:[],mount:0}; m.cls='builder'; const p0=E.defensePower(s); m.cls='b_fortwright'; ok(E.defensePower(s)===Math.round(p0*1.1),'Fortwright: defence power +10%'); }
{ const s=base(), m=s.members[0]; s.village={tier:0,auto:false}; const vt=E.villageTypes()[0];
  ok(E.buildVillage(s,vt,0)&&E.villageBuildIssue(s,vt,0)==='a project is underway','one village project at a time');
  m.cls='b_planner'; ok(E.projectCap(s)===2&&!E.villageBuildIssue(s,vt,0)&&E.buildVillage(s,vt,0)&&E.projects(s).length===2,'Town Planner: 2 projects at once');
  ok(E.villageBuildIssue(s,vt,0)==='both project slots are busy','a third waits');
  const p=E.projects(s)[1], k=Object.keys(p.need)[0], need=p.need[k], r0=s.res[k]; E.deliver(s,k,Infinity,1);
  ok(r0-s.res[k]===Math.ceil(need/1.25)&&(p.paid[k]===need||!E.projects(s).includes(p)),'deliveries into project 2 count ×1.25');
  m.cls='builder'; const u0=E.upkeepMult(s); m.cls='b_planner'; ok(Math.abs(u0-E.upkeepMult(s)-0.2)<1e-9,'Town Planner: upkeep −20%');
  ok(E.cancelProject(s,0)&&E.projects(s).length<=1,'cancel a project (refund)'); }
// ---- class needs: combo cut, village charter
{ const s=base(), m=s.members[0]; const c=E.findId(D.classes,'b_architect'), r=E.classReq(c);
  m.paths=[{id:'architect',xp:1e5,rank:1}]; const r2=E.reqFor(m,c); ok(Object.keys(r).every(k=>r2[k]===Math.max(1,r[k]-10)),'Architect combo path cuts the Architect class needs by 10');
  m.cls='b_surveyor'; m.guild={id:'architects',rank:2,rep:999}; ok(E.classIssues(s,m,E.findId(D.classes,'b_planner')).includes('needs the village charter'),'Town Planner needs the village charter'); }
// ---- road works
{ const s=base(), m=s.members[0];
  ok(/Old Keep|Surveyor/.test(E.roadIssue(s,'track')),'road works closed at first');
  m.cls='b_surveyor'; ok(E.roadIssue(s,'track')==="road works need a Builder's Yard",'Surveyor: road works need a Builder\'s Yard');
  m.cls=null; s.unlocks.push('upgrade:roadworks'); ok(!E.roadIssue(s,'track')&&E.roadIssue(s,'road')==='lay another track first','the Old Keep Survey unlock opens road works; tracks before roads');
  const c0=s.res.coin; ok(E.buildRoad(s,'track')&&c0-s.res.coin===D.world.roadWorks.build.track.coin&&E.buildRoad(s,'road'),'build a track and a road');
  ok(Math.abs(E.roadEdge(s)-0.06)<1e-9,'roads add trade-route earnings (+2% track, +4% road)');
  s.day=359; E.roadsDay(s); s.day=360; E.roadsDay(s); ok(s.roads.cond===0.95&&Math.abs(E.roadEdge(s)-0.057)<1e-9,'roads wear 5% a year');
  ok(!E.repairIssue(s)&&E.repairRoads(s)&&s.roads.cond===1,'repair restores them'); }
// ---- chain unlocks: pieces, Builder's Yard
{ const s=base(); s.land=[D.estate.lands[0].id]; s.structures.push({uid:'x',type:'shack',pieces:[],up:0});
  ok(/Architects/.test(E.structIssue(s,'buildersyard')||''),"Builder's Yard needs the chain");
  E.grantUnlock(s,'structure:buildersyard','test'); ok(E.structIssue(s,'buildersyard')!=="needs the Architects' Guild chain","the chain unlock opens the Builder's Yard");
  ok(/Architects/.test(E.pieceLock(s,E.pieceDef('draftingroom'))||''),'Drafting Room locked until its chain step'); E.grantUnlock(s,'piece:draftingroom','t'); ok(!E.pieceLock(s,E.pieceDef('draftingroom')),'then open');
  const m=s.members[0]; const x0=E.xpMult(s,m,'masonry'), f0=E.xpMult(s,m,'fire'); m.equip=m.equip||{}; m.equip.charm='builders_square'; ok(Math.abs(E.xpMult(s,m,'masonry')-x0-0.05)<1e-9&&E.xpMult(s,m,'fire')===f0,"Builder's Square: +5% masonry XP, other skills unchanged");
  const st={uid:'by',type:'buildersyard',pieces:[],up:0}; const mc=E.matCap(s); s.structures.push(st); ok(E.matCap(s)>mc,"Builder's Yard: more material storage"); }
// ---- Steward route from data
{ const s=base(), m=s.members[0]; s.structures.push({uid:'w',type:'warehouse',pieces:[],up:0}); m.craft={id:'hearth',rank:0,rep:0};
  m.paths=[{id:'clerk',xp:1e5,rank:2,spec:'steward',sxp:0,srank:1,slot:'main'}]; ok(E.routeSlotParts(s).steward===1,'Steward: +1 route from its route effect');
  const sp=D.paths.paths.find(p=>p.id==='clerk').specs[0]; const v=sp.fx.find(f=>f.kind==='route'); v.v=0; ok(E.routeSlotParts(s).steward===0,'the route slot follows the data value (no hard-coded spec check)'); v.v=1;
  m.paths[0].rank=3; m.paths[0].srank=3; ok(E.routeSlotParts(s).steward===2,'Seneschal title fx: +2 in all');
  m.paths.unshift({id:'smithing',xp:1e6,rank:3,slot:'main'}); m.paths[1].slot='second'; m.slotChosen=true; ok(E.effRank(m,m.paths[1])===2&&E.routeSlotParts(s).steward===1,'a Seneschal held as secondary (capped at Master) counts as Steward');
  const k=kid(s,[]); k.paths=[{id:'clerk',xp:1e5,rank:2,spec:'steward',sxp:0,srank:1}]; ok(E.routeSlotParts(s).steward===2,'Stewards across the family add up (cap 2)'); }
// ---- second guilds
{ const s=base(), m=s.members[0]; m.guild={id:'vanguard',rank:2,rep:999}; m.cls='knight';
  ok(!E.secondVia(m)&&/reach tier 3, or Master in a trade/.test(E.stuck2(s,m)),'before eligibility: one quiet hint');
  ok(/reach tier 3/.test(E.join2Issues(s,m,'architects')[0]),'cannot join before eligibility');
  m.cls='paladin'; m.guild.id='church'; ok(E.secondVia(m)==='tier3','a tier-3 class in the main guild opens it');
  m.cls='fighter'; m.guild.id='vanguard'; lvTo(m,20); setSk(m,{swordsmanship:60,shield:60,leadership:30,tactics:30,brawling:40}); m.guild.rank=2;
  const t3=D.classes.find(c=>c.tier===2&&E.guildOfCls(c.id)==='vanguard'&&!c.retired&&!c.needsQuest&&!c.needsBuildings); m.cls='knight'; m.clsHist=['fighter'];
  for(const [k,v] of Object.entries(E.classReq(t3)))m.skills[k].lvl=Math.max(m.skills[k].lvl,v);
  ok(E.evolve(s,m,t3.id)&&m.secondGuild&&m.secondGuild.via==='tier3'&&E.secondOpenText(m)===`Second guild open: Adept ${t3.name}`,'evolving to tier 3 records the opening; the card names the rule');
  ok(E.join2Issues(s,m,'vanguard')[0]==='already their main guild'&&E.join2Issues(s,m,'hearth')[0]==='not a sworn guild','not the main guild, not an open guild');
  setSk(m,{masonry:30,carpentry:30,reading:20,history:12}); const cp0=E.cp(s,m), coin0=s.res.coin;
  ok(E.joinSecond(s,m,'architects')&&m.guild2.id==='architects'&&m.guild2.rank===0&&m.class2==='builder'&&coin0-s.res.coin===120,'join: tier 1, Initiate, pays the fee, entry class is the second class');
  ok(E.memberGuild(m,'architects')===m.guild2&&E.memberGuild(m,'vanguard')===m.guild,'both guilds count as memberships');
  ok(E.cp(s,m)===cp0,'power (CP) still from the main class only'); ok(Math.abs(E.buildDisc(s,'estate')-0.05)<1e-9,'the second class gives its role bonus');
  ok(E.join2Issues(s,m,'lodge')[0]==="can't join: already in a second guild",'only one second guild');
  const n=D.guilds.ranks[1]; m.guild2.rep=Math.ceil(n.rep/2)-1; ok(E.stuck2(s,m)===`${n.name} (second guild): rep ${m.guild2.rep}/${Math.ceil(n.rep/2)}`,'why it\'s stuck: Journeyman (second guild) rep x/half');
  m.guild2.rep++; ok(E.canRankUp(s,m,'architects')&&E.rankUp(s,m,'architects')&&m.guild2.rank===1,'Journeyman with half the rep');
  m.guild2.rep=9999; ok(!E.canRankUp(s,m,'architects')&&E.rank2Issue(s,m)==='second guild capped at tier 2','rank capped at the tier-2 rank');
  const mb=E.findId(D.classes,'b_masterbuilder'); setSk(m,{masonry:60,carpentry:60}); ok(!E.class2Issues(s,m,mb).length&&E.evolve2(s,m,'b_masterbuilder')&&m.class2==='b_masterbuilder'&&m.cls===t3.id,'second class advances to tier 2; main class untouched');
  ok(E.class2Issues(s,m,E.findId(D.classes,'b_architect'))[0]==='second guild capped at tier 2','second class capped at tier 2');
  ok(Math.abs(E.buildDisc(s,'estate')-0.1)<1e-9,'Master Builder (second class) discount applies');
  const q={id:'zz',guild:'architects',skill:'masonry'}; const r0=m.guild2.rep; for(const mg of E.guildsOf(m)) if(mg.id===q.guild) mg.rep+=D.guilds.repPerGuildQuest; ok(m.guild2.rep===r0+D.guilds.repPerGuildQuest&&E.guildsOf(m).includes(m.guild2),'guild quests earn second-guild rep');
  // bloodline
  const c=kid(s,[m.id]); c.cls='fighter'; c.guild={id:'vanguard',rank:0,rep:0}; c.secondGuild={via:'craft',path:'mason',day:0}; lvTo(c,10); setSk(c,{masonry:30,carpentry:30});
  ok(E.bloodline(s,c,'architects')&&E.join2Fee(s,c,'architects')===0,'bloodline: a parent at tier 2 waives the fee');
  ok(E.joinSecond(s,c,'architects')&&E.cls2(c).tier===1&&c.guild2.rank===1,'bloodline: starts at tier 2 when Lv and skills fit');
  const g=kid(s,[c.id]); g.cls='fighter'; g.guild={id:'vanguard',rank:0,rep:0}; ok(E.bloodline(s,g,'architects'),'grandparents count too'); }
// ---- Auto's pick
{ const s=base(), m=s.members[0]; m.cls='fighter'; m.guild={id:'vanguard',rank:0,rep:0}; m.secondGuild={via:'craft',path:'mason',day:0}; m.craft={id:'hearth',rank:2,rep:0}; setSk(m,{masonry:40,carpentry:12}); for(const k in m.stats)m.stats[k]=10;
  const others=['lodge','collegium','church','rogues','architects']; others.forEach(g=>{ const k=kid(s,[]); k.guild={id:g,rank:0,rep:0}; });
  ok(E.pick2(s,m).gid==='architects','Auto: a Master Mason → Architects\' (fits the trade)');
  s.members.filter(x=>x.guild&&x.guild.id==='rogues').forEach(x=>x.alive=false); setSk(m,{brawling:6,haggling:6}); ok(E.pick2(s,m).gid==='rogues'&&/no Rogues/.test(E.pick2(s,m).why),'a role the family lacks comes first');
  E.setPref2(s,m.id,'lodge'); ok(E.pick2(s,m).gid==='lodge'&&m.pins.guild2,'a hand choice is pinned'); }
{ const s=base(), m=s.members[0]; m.cls='fighter'; m.guild={id:'vanguard',rank:0,rep:0}; m.secondGuild={via:'craft',path:'mason',day:0}; delete m.craft; m.skills.masonry.lvl=0; for(const k in m.stats)m.stats[k]=10;
  const p=E.pick2(s,m); ok(p.gid!=='architects'&&E.joinDrill(s,m)&&Object.keys(E.guildDef(p.gid).req.skills).includes(E.joinDrill(s,m)),"Auto skips a guild it can't train toward (masonry needs the Crafters' Guild) and drills the pick's join skill");
  ok(E.drillSkill(s,m)===E.joinDrill(s,m)||Math.floor(s.day/30)%2===1,'drillSkill alternates in the join skill'); }
// ---- save step 43
{ const s=base(), m=s.members[0]; m.cls='paladin'; m.guild={id:'church',rank:2,rep:300}; delete m.guild2; delete m.class2; delete m.secondGuild;
  const k=kid(s,[]); k.secondGuild={via:'craft',path:'mason',day:5}; delete k.guild2; s.schema=42; E.normalize(s);
  ok(s.schema===43&&m.guild2===null&&m.class2===null&&m.secondGuild.via==='tier3'&&k.secondGuild.via==='craft'&&k.guild2===null,'step 43: empty second guild fields; tier-3 marks it open; craft openings kept; nobody joined'); }
console.log(pass+' R47 checks passed');
