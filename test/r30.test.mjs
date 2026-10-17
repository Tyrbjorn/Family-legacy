// R30: rats first + Go from Main/Quests/map, bigger fogged map, fog/known pin gating, greyed major places, quadrant maps,
// special maps, starting kit, save step 30 (fog kept, trip times kept, Gear Up step migrated)
import fs from 'fs'; import * as E from '../js/engine.js';
const R=new URL('../data/',import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const fresh=()=>{const s=E.newGame(1_700_000_000_000);E.normalize(s);return s;};
// --- tutorial: rats is step 1, nothing blocks it
ok(D.tutorial.steps[0].id==='rats'&&!D.tutorial.steps.some(x=>x.id==='gear'),'rats is tutorial step 1; Gear Up removed');
ok(D.tutorial.steps[0].reward.coin===50&&D.tutorial.steps[0].reward.wood===4,'Gear Up reward folded into rats');
ok(!/list below the map/.test(JSON.stringify(D.tutorial)),'no stale quest-list text');
{ const s=fresh(), m=E.active(s), q=D.quests.find(x=>x.id==='rats');
  ok(m.equip.weapon==='rusty_sword'&&m.equip.armor==='apprentice_clothes'&&m.equip.accessory==='travel_cloak'&&!s.vault.length,'start kit: blade + clothes + cloak equipped, no armor in the vault');
  ok(E.gstats('apprentice_clothes').cls==='unarmored','clothes are unarmored');
  ok(E.questVisible(s,q)&&!E.questIssue(s,m,q)&&E.actionAllowed(s,m,{type:'quest',target:'rats'}),'day 1: rats visible on the map/Quests and takeable');
  E.setAction(s,{type:'quest',target:'rats'}); for(let i=0;i<60&&!s.doneQuests.includes('rats');i++) E.advanceReal(s,10);
  ok(s.doneQuests.includes('rats')&&s.tut.step===1&&!s.log.some(l=>/failed Rats/.test(l.msg)),'rats is won on day 1 with the starting kit (step 1 done)'); }
// --- map size, start reveal
ok(D.map.size.w===1600&&D.map.size.h===1400,'map 1600x1400');
{ const s=fresh(); const pc=E.fogPct(s);
  ok(pc>0.03&&pc<0.1,'start: ~7% charted (home + Millbrook) '+pc.toFixed(3));
  const th=D.towns.find(t=>t.id==='thornwick'); ok(!E.townKnown(s,th)&&E.townKnown(s,D.towns.find(t=>t.id==='millbrook')),'Thornwick not known at start, Millbrook is');
  const vis=D.quests.filter(q=>E.questVisible(s,q)); ok(vis.length>=4&&vis.length<=14,'day-1 quest pins: a short list ('+vis.length+')');
  ok(D.quests.filter(q=>E.known(s,q)&&E.regionKnown(s,q.region)).length>vis.length,'fog hides known-but-unseen quest pins');
  const hq=D.quests.find(q=>q.hidden&&!s.revealed.includes(q.id)&&D.map.points[q.id]); E.reveal(s,D.map.points[hq.id].x,D.map.points[hq.id].y,80); ok(!E.questVisible(s,hq),'a hidden quest stays hidden when its spot is seen (known gates it)'); }
// --- trip times unchanged by the x1.5 scale
{ const old=JSON.parse(fs.readFileSync(new URL('./fixtures/r29-travel-days.json',import.meta.url))); const bad=Object.keys(old).filter(k=>Math.abs(E.travelDays(k)-old[k])>0.05);
  ok(!bad.length,'all '+Object.keys(old).length+' trip times equal R29 '+bad.join()); }
// --- quadrant maps
{ const s=fresh(); s.res.coin=1000; ok(E.townQuad('millbrook')==='nw'&&E.quadPrice('nw')<E.quadPrice('se'),'home quadrant map is the cheap one');
  const q0=D.quests.filter(q=>E.questVisible(s,q)).length, n0=D.nodes.filter(n=>E.nodeVisible(s,n)).length, f0=E.fogPct(s);
  const ash=D.towns.find(t=>t.id==='ashford'); ok(!E.townKnown(s,ash),'Ashford unknown before');
  ok(E.buyQuadMap(s,'millbrook')&&E.quadOwned(s,'nw')&&!E.buyQuadMap(s,'millbrook'),'buy the NW map once');
  ok(E.fogPct(s)>f0+0.15&&E.townKnown(s,ash),'map charts the quarter and marks its towns');
  ok(D.quests.filter(q=>E.questVisible(s,q)).length===q0&&D.nodes.filter(n=>E.nodeVisible(s,n)).length===n0,'quests and resource nodes still need exploring');
  ok(D.dungeons.filter(d=>E.townQuad&&E.quadOf(D.map.points[d.id].x,D.map.points[d.id].y)==='nw').every(d=>s.revealed.includes(d.id)),'dungeons in the quarter marked');
  const hid=D.world.locations.filter(l=>l.hidden&&E.quadOf(l.x,l.y)==='nw'); ok(hid.every(l=>!E.locKnown(s,l)),'hidden spots stay hidden');
  const sw=E.quadOf(D.map.points.creek.x,D.map.points.creek.y); ok(sw==='nw'||sw==='sw','quadrants by position'); }
// --- special maps
{ const s=fresh(); const q=D.quests.find(x=>x.id==='q_buried_cache');
  ok(E.isSpecialMap('treasure_map')&&E.isSpecialMap('miners_chart')&&E.isSpecialMap('thieves_chart'),'three special maps defined');
  ok(!E.questVisible(s,q),'cache hidden before the map');
  s.vault.push('treasure_map'); const f=E.readMap(s,'treasure_map'); ok(f&&f.includes(q.name)&&E.questVisible(s,q)&&!s.vault.includes('treasure_map'),'treasure map marks the buried cache (pin visible) and is used up');
  ok(s.log.some(l=>/Read the Treasure Map/.test(l.msg)),'reading is logged');
  s.vault.push('miners_chart'); E.readMap(s,'miners_chart'); ok(['oldmine','n_starfall'].every(id=>s.revealed.includes(id)&&E.nodeVisible(s,D.nodes.find(n=>n.id===id))),'miner\'s chart reveals hidden ore nodes in the Outskirts');
  s.vault.push('thieves_chart'); E.readMap(s,'thieves_chart'); ok(s.revealed.includes('d_ruinvault'),'guild chart reveals a secret dungeon');
  const t=fresh(); const dg=D.dungeons.find(d=>d.id==='d_barrow'); E.dungeonClear(t,E.active(t),dg); ok(t.vault.includes('treasure_map'),'Barrow first clear drops the Treasure Map');
  const v=t.vault.length; E.dungeonClear(t,E.active(t),dg); ok(t.vault.filter(x=>x==='treasure_map').length===1,'a map drops only once while held');
  ok(D.quests.find(x=>x.id==='g_rogues_heist').mapDrop.item==='thieves_chart','guild quest reward is a map'); }
// --- save step 30: fog re-projected (nothing lost), Gear Up save advances
{ const s=fresh(); const old='0'.repeat(360).split(''); old[8*20+6]='1'; old[2*20+19]='1';
  s.fog=old.join(''); s.schema=29; s.tut={step:0,done:[],skipped:false,flags:{},tourSeen:true,started:true};
  const m=E.active(s); m.equip={}; s.vault=['rusty_sword']; const c0=s.res.coin; E.normalize(s);
  ok(s.fog.length===32*28,'fog on the new grid');
  ok(E.fogSeen(s,(6*50+25)*1.5,(8*50+25)*1.5)&&E.fogSeen(s,(19*50+25)*1.5,(2*50+25)*1.5),'every old revealed cell stays revealed (scaled)');
  ok(m.equip.weapon==='rusty_sword'&&s.tut.step===0&&D.tutorial.steps[0].id==='rats'&&s.res.coin===c0+20,'mid-Gear-Up save: blade equipped, old reward paid, now on rats');
  const s2=JSON.parse(JSON.stringify(s)); delete s2.schema; E.normalize(s2); ok(s2.res.coin===s.res.coin,'re-running the step pays nothing twice'); }
console.log('r30: '+pass+' passed');
