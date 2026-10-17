// The tutorial's 'Rats in the Cellar' step: the quest is findable (known, in an open region, takeable, its map pin
// outside the fog) for a new founder, and an advanced save never gets stuck on the step.
import fs from 'fs'; import * as E from '../js/engine.js';
const R=new URL('../data/',import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const q=D.quests.find(x=>x.id==='rats'), st=D.tutorial.steps.find(x=>x.check==='quest:rats');
ok(q&&st&&D.map.points.rats,'quest, tutorial step and map pin exist');
const s=E.newGame(1_700_000_000_000); E.normalize(s); const m=E.active(s);
ok(E.known(s,q)&&E.regionKnown(s,q.region)&&E.regionOpen(s,q.region),'new game: quest known in an open, known region');
ok(E.fogSeen(s,D.map.points.rats.x,D.map.points.rats.y),'new game: map pin is outside the fog');
ok(!E.questIssue(s,m,q)&&E.canQuest(m,q,s)&&E.actionAllowed(s,m,{type:'quest',target:'rats'}),'new game: founder can take it');
ok(/Map tab/.test(st.text),'tutorial text says where to find it');
// step reached, quest done -> step completes
s.tut.step=D.tutorial.steps.indexOf(st); ok(!E.stepDone(s,st),'step open before the quest');
s.doneQuests.push('rats'); ok(E.stepDone(s,st),'done after the quest');
// advanced save: adult, estate founded, other quests done -> step counts as outgrown
const a=E.newGame(1); E.normalize(a); const am=E.active(a); am.ageDays=40*360; a.land=['plot']; a.doneQuests=['wolves','bandits','herbs'];
ok(E.stepDone(a,st),'advanced save: step auto-completes');
ok(E.canQuest(am,q,a)&&!E.questIssue(a,am,q),'advanced save: the quest itself is still takeable');
console.log(pass+' tests passed');
