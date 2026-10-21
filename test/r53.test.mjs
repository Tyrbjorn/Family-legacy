// R53 the Gilded Hall: the Lodge of the Drowned Light (the Esoteric Order of Dagon) in Saltmere — outsider prices and
// refusals, earning trust, the 5-step investigation, the Old Bargain (expose / join / bargain), save step 49.
import fs from "fs"; import * as E from "../js/engine.js"; import { BUILD } from "../js/config.js";
import { STEPS } from "../js/engine/save-steps.js";
const R=new URL("../data/",import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const Y=D.tuning.daysPerYear, Q=id=>D.quests.find(q=>q.id===id);
const base=()=>{const s=E.newGame(1);E.normalize(s);E.skipTutorial&&E.skipTutorial(s);s.res.coin=1e5;return s;};
ok(BUILD==='R53'&&E.SCHEMA===49,'R53, save step 49');
ok(D.changelog.entries[0].build==='R53','changelog R53');
const H=D.families.list.find(h=>h.id==='dagon');
ok(H&&H.town==='saltmere'&&/Dagon/.test(H.known)&&H.thread.quests.length===5,'the Lodge is one group: the Order underneath');
// outsiders
{ const s=base(); ok(E.dagonOutsider(s)&&E.dagonBuyMult(s,'saltmere')===1.2&&E.dagonSellMult(s,'saltmere')===0.8&&E.dagonBuyMult(s,'ashford')===1,'outsiders: +20% / −20% in Saltmere only');
  ok(E.brewRefused(s,'saltmere')&&!E.brewRefused(s,'ashford'),'the Drowned Lamp refuses outsiders');
  const p0=E.perkBuy(s,'reefgold','saltmere'); s.houses.dagon={r:0,state:'peace'}; ok(E.perkBuy(s,'reefgold','saltmere')<p0&&!E.brewRefused(s,'saltmere'),'Neutral: normal prices');
  s.houses.dagon.r=-20; E.dagonFavour(s,5); ok(s.houses.dagon.r===-15,'helping Saltmere earns trust'); }
ok(Q('reef4').choice.options.find(o=>o.id==='keep').fx.rapport.dagon===25,'keeping the reef secret earns Neutral');
// investigation
ok(['inv1','inv2','inv3','inv4','inv5'].every((id,i)=>Q(id)&&Q(id).step===i+1&&D.map.points[id]),'five investigation steps on the map');
ok(/Deep Door/.test(Q('inv4').desc)&&Q('inv4').req.item==='seaboat'&&Q('inv4').gives.includes('gildedidol'),"the Gold's Mint: Sea Gate, the idol, the map to the Deep Door");
ok(/Hydra/.test(Q('inv3').desc)&&/angles/.test(D.world.locations.find(l=>l.id==='l_dagonhall').desc),'the hall, its sign, Mother Hydra');
// pact
const pick=(id)=>{const s=base(); s.members.push({...s.members[0],id:'x2',alive:true}); s.members.push({...s.members[0],id:'x3',alive:true}); s.choices=[{id:'dagon',q:'inv5',day:0}]; E.makeChoice(s,'dagon',id); return s;};
{ const s=pick('expose'); ok(s.dagonPact==='expose'&&E.tierOf(s,'dagon')==='feud'&&E.tierOf(s,'gilmane')==='feud'&&E.dagonBuyMult(s,'saltmere')>1.5&&E.inFeud(s,'dagon'),'expose: feud and dear prices'); }
{ const s=pick('join'); ok(s.dagonPact==='join'&&E.tierOf(s,'dagon')==='allied'&&!E.dagonOutsider(s)&&E.dagonFishMult(s)===1.25,'join: allied, more fish');
  const n=s.members.filter(m=>m.alive).length; ok(E.goDown(s)&&s.members.filter(m=>m.alive).length===n-1,'someone goes down to Father'); }
{ const s=pick('bargain'); ok(s.dagonPact==='bargain'&&E.tierOf(s,'dagon')==='neutral'&&s.res.reefgold>=10,'bargain: neutral, a cache');
  s.res.coin=0; s.day=s.dagonDue; E.dagonDay(s); ok(s.dagonPact==='lapsed'&&E.dagonOutsider(s),'a missed payment: Cold again'); }
// save step
{ const s=base(); delete s.houses.dagon; s.choices=[{id:'reef',pick:'keep'}]; STEPS.find(x=>x.n===49).run(s); ok(s.houses.dagon.r===0,'step 49: kept → Neutral'); }
{ const s=base(); delete s.houses.dagon; STEPS.find(x=>x.n===49).run(s); ok(s.houses.dagon.r===-25&&!s.dagonPact,'step 49: Cold, nothing given'); }
{ const s=base(); s.dagonPact='join'; const l=E.deserialize(E.serialize(s)); ok(l.schema===49&&l.dagonPact==='join','save/load keeps the pact'); }
console.log('r53 ok',pass);
