// R47.1: the Architects' Guild teaches masonry (skills.json alsoGuilds) and lets anyone drill its join skills up to
// the join level (guilds.json entryTrain), so a heir can reach the Architects' without the Crafters' Guild.
import fs from "fs"; import * as E from "../js/engine.js";
const R=new URL("../data/",import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const Y=D.tuning.daysPerYear;
const base=()=>{const s=E.newGame(1);E.normalize(s);const m=s.members[0];m.ageDays=20*Y;s.res.coin=1e5;delete m.craft;m.guild=null;m.cls=null;for(const k in m.skills)m.skills[k].lvl=0;for(const k in m.stats)m.stats[k]=8;return s;};
const sk=id=>E.findId(D.skills,id);
ok(sk('masonry').guild==='hearth'&&sk('masonry').alsoGuilds.includes('architects')&&E.guildDef('architects').entryTrain===true,'data: masonry is a Crafters\' skill also taught by the Architects\'; Architects\' allow the entry drill');
ok(D.skills.filter(x=>x.alsoGuilds).every(x=>x.alsoGuilds.every(g=>E.guildDef(g))),'alsoGuilds name real guilds');
{ const s=base(), m=s.members[0];
  ok(E.canTrain(m,'masonry',s),'no guild: masonry trainable for the Architects\' entry drill');
  m.skills.masonry.lvl=5; ok(E.trainIssue(m,'masonry',s)==='guild','…only up to the join level (5)');
  m.guild={id:'architects',rank:0,rep:0}; ok(E.canTrain(m,'masonry',s),'an Architects\' member trains masonry fully');
  m.guild=null; m.craft={id:'hearth',rank:0,rep:0}; ok(E.canTrain(m,'masonry',s),'Crafters\' members still train it');
  delete m.craft; m.skills.appraisal.lvl=0; ok(E.trainIssue(m,'appraisal',s)==='guild','other guild-only skills unchanged (appraisal still Crafters\' only)');
  m.guild={id:'vanguard',rank:0,rep:0}; ok(E.trainIssue(m,'tactics',s)===null&&(()=>{m.guild=null;return E.trainIssue(m,'tactics',s)==='guild';})(),'sworn guild skills unchanged'); }
// Auto: a builder-leaning heir with no guild drills masonry, then joins the Architects' as main guild
{ const s=base(), m=s.members[0]; m.track='architects'; m.skills.carpentry.lvl=6;
  ok(E.trackFor(s,m)==='architects'&&E.drillSkill(s,m)==='masonry','no guild yet: Auto drills the track guild\'s join skill (masonry)');
  m.skills.masonry.lvl=5; ok(!E.joinIssues(s,m,'architects').length&&E.joinGuild(s,m,'architects')&&m.cls==='builder','then joins the Architects\' as main guild (Builder)'); }
{ const s=base(), m=s.members[0]; m.skills.masonry.lvl=12; m.skills.carpentry.lvl=14; m.skills.reading.lvl=6; ok(E.bestTrack(m)==='architects','a heir strongest in masonry/carpentry leans to the Architects\' track'); }
// second guild: a tier-3 member with no masonry can now reach the Architects'
{ const s=base(), m=s.members[0]; m.guild={id:'vanguard',rank:2,rep:300}; m.cls=D.classes.find(c=>c.tier===2&&E.guildOfCls(c.id)==='vanguard'&&!c.retired).id; m.skills.carpentry.lvl=6; for(const k in m.stats)m.stats[k]=10;
  ok(E.join2Issues(s,m,'architects').join()==='Masonry 0/5'&&E.canTrain(m,'masonry',s),'second guild: masonry 0/5 is now trainable (entry drill)');
  m.skills.masonry.lvl=5; ok(E.joinSecond(s,m,'architects')&&E.canTrain(m,'masonry',s),'joins as second guild and keeps training masonry'); }
console.log(pass+' R47.1 checks passed');
