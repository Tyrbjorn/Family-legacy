// Map round 2: impassable mountains/lakes + detours, boats (Dock + Small Boat), livestock feed, hand-pulled wagon,
// daily node regrowth, follower convoy loyalty/skill, intro steps, save v21.
import fs from 'fs'; import * as E from '../js/engine.js';
const L=n=>JSON.parse(fs.readFileSync(new URL('../data/'+n+'.json',import.meta.url)));
const D={};for(const n of ['skills','classes','traits','buildings','furniture','items','quests','regions','tuning','nodes','towns','minions','guilds','jobs','activities','estate','crafting','map','dungeons','legacy','chronicle','achievements','events','encounters','seasons','tutorial','notify','marriage','phases','intros','gear','paths','world','metals'])D[n]=L(n);
for(const f of D.estate.structureFiles)D['structures/'+f]=L('structures/'+f);
E.setData(D); let seed=11; E.setRng(()=>{seed=(seed*16807)%2147483647;return seed/2147483647;});
let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const M=D.map, W=D.world, imp=(x,y)=>!!W.terrain[E.terrainAt(x,y)].impassable;
const ids=[...Object.keys(M.towns),...Object.keys(M.points),...M.areas.map(a=>a.id)];
// geometry
ok(W.terrain.mountains.impassable&&W.terrain.lake.impassable&&W.terrain.lake.boat&&!W.terrain.mountains.boat,'mountains and lakes impassable; only lakes take boats');
ok(ids.every(id=>!imp(E.ptOf(id).x,E.ptOf(id).y))&&W.locations.every(l=>!imp(l.x,l.y))&&!imp(M.home.x,M.home.y),'no town, spot, area, location or home sits inside a mountain or lake');
E.setBoatAccess(false);
ok(ids.every(id=>!E.pathBetween(M.home,E.ptOf(id)).blocked),'every route from home avoids mountains and lakes');
const ts=Object.keys(M.towns); ok(ts.every(a=>ts.every(b=>!E.pathBetween(M.towns[a],M.towns[b]).blocked)),'town-to-town paths avoid them too');
ok(ids.every(id=>E.routeTo(E.ptOf(id)).detours<=W.routing.maxDetours)&&ids.some(id=>E.routeTo(E.ptOf(id)).detours>0),'some routes detour, none beyond maxDetours');
const det=ids.find(id=>{const r=E.routeTo(E.ptOf(id));return r.detours>0;}), r0=E.routeTo(E.ptOf(det));
ok(r0.dist>Math.hypot(E.ptOf(det).x-M.home.x,E.ptOf(det).y-M.home.y),'a detour is longer than the straight line');
// mountain/lake edge spots keep their bonus terrain
for(const id of ['silverseam','n_gemvein','n_lake']){const n=D.nodes.find(x=>x.id===id),p=M.points[id];ok(['highlands','lake'].includes(n.terrain)&&!imp(p.x,p.y),id+' is reachable and keeps its '+n.terrain+' bonus');}
{const s=E.newGame(1); const n=D.nodes.find(x=>x.id==='n_lake'), t={}; E.gatherInto(s,t,n,1,()=>0); ok(Math.abs(t.load.fish-4*W.terrain.lake.gather.fish)<1e-9,'edge spot gathers with the lake bonus');}
// boats
{const s=E.newGame(1); E.normalize(s);
 const lakeIds=ids.filter(id=>{E.setBoatAccess(true);const a=E.routeTo(E.ptOf(id));E.setBoatAccess(false);const b=E.routeTo(E.ptOf(id));return a.boat&&a.dist<b.dist;});
 ok(lakeIds.length>0,'with a boat some routes cross a lake and get shorter');
 E.setBoatAccess(true); ok(ids.every(id=>{const pb=E.pathBetween(M.home,E.ptOf(id));return !pb.samples.some(p=>E.terrainAt(p.x,p.y)==='mountains');}),'even with a boat, routes never cross mountains'); E.setBoatAccess(false);
 ok(!E.hasBoat(s),'no boat at start');
 s.vault.push('c|smallboat|crude'); ok(!E.hasBoat(s),'a boat without a Dock does nothing');
 s.structures.push({uid:'d1',type:'dock',pieces:['boatslip'],up:0}); ok(E.hasBoat(s),'boat + Dock = lake crossing');
 E.advanceReal(s,10); ok(E.boatAccess(),'the day tick turns boat routing on');
 const rc=E.recipeDef('r_smallboat'); ok(rc&&rc.line==='carpenter'&&rc.needsStruct==='dock'&&rc.station==='workbench','Small Boat is a Carpenter recipe that needs a Dock');
 const t=E.newGame(1); const m=t.members[0]; ok(/Dock/.test(E.recipeIssue(t,m,rc)||'')||/Workbench|Carpenter|carpenter/.test(E.recipeIssue(t,m,rc)||''),'recipe blocked without a Dock/bench');
 ok(D.estate.structures.find(x=>x.id==='dock')&&D.estate.pieces.find(x=>x.id==='boatslip'),'Dock building with a boat slip');
 E.setBoatAccess(false);
}
// feed
{const s=E.newGame(1); s.animals={ox:1}; s.res.hay=10; s.res.wheat=10; s.res.vegetables=10; E.feedAnimals(s); ok(s.res.hay===8&&s.res.wheat===10,'grazers eat hay first');
 s.res.hay=1; E.feedAnimals(s); ok(s.res.wheat===8,'then grain');
 s.structures.push({uid:'c1',type:'chickencoop',pieces:['nestboxes'],up:0}); s.res.hay=100; s.res.wheat=0; s.res.vegetables=5; E.feedAnimals(s);
 ok(s.res.hay===98&&Math.abs(s.res.vegetables-(5-0.6))<1e-9,'hens never eat hay: they take vegetables when grain is out');
 ok(E.herdMult(s,'chickencoop')===1,'fed coop works');
 s.res.vegetables=0; E.feedAnimals(s); ok(E.herdMult(s,'chickencoop')===0&&s.unfed.chickencoop===1,'unfed coop stops');
 for(let i=0;i<9;i++)E.feedAnimals(s); ok(E.herdHead(s,'chickencoop')===5,'after 10 unfed days one hen runs off');
 s.res.wheat=1000; E.feedAnimals(s); ok(E.herdMult(s,'chickencoop')>0.8&&E.herdMult(s,'chickencoop')<1,'fed again: works with fewer hens');
 for(let i=0;i<W.feed.regrowDays;i++)E.feedAnimals(s); ok(E.herdHead(s,'chickencoop')===6,'the flock regrows while fed');
 const h=E.newGame(1); h.animals={mule:2}; h.structures.push({uid:'st',type:'shack',pieces:['stablestall'],up:0});
 for(let i=0;i<10;i++)E.feedAnimals(h); ok(h.animals.mule===1,'unfed 10 days: a mule runs off');
 ok(!E.animalWorks(h,'mule')&&h.animalsFed===false,'unfed mule does not haul');
 ok(Object.values(W.feed.kinds).every(k=>W.feed.diets[k.diet])&&W.feed.diets.grain.indexOf('hay')<0&&['mule','ox','horse','cattle','sheep','goats'].every(k=>W.feed.kinds[k].diet==='graze')&&['fowl','pigs'].every(k=>W.feed.kinds[k].diet==='grain'),'diets: grazers hay→grain→veg; fowl/pigs grain→veg');
 ok(W.features.pasture.res.hay>0&&W.landFeatures.meadow.includes('pasture')&&D.nodes.find(n=>n.id==='n_meadow').res.hay>0,'hay from pasture, the meadow and wild meadows');
}
// hand-pulled wagon
{const s=E.newGame(1); s.vault.push('c|wagon|crude'); const t=E.haulTier(s); ok(t.id==='wagoncart'&&t.haulSpeed===0.6&&t.carry===Math.round(400*0.5),'wagon with no animal: half cargo, ×0.6 speed');
 s.vault.push('c|handcart|crude'); ok(E.haulTier(s).id==='handcart','a real handcart moves more per day than a hand-pulled wagon');}
// daily regrowth
{const s=E.newGame(1); const n=D.nodes.find(x=>x.id==='scrub'); s.nodeStock={scrub:0}; E.advanceReal(s,10*3); ok(E.nodeStock(s,n)>0&&E.nodeStock(s,n)<E.nodeMax(n)*0.2,'nodes regrow a little each day');}
// convoys
{const C=D.tuning.trade; ok(E.driverIssue({loyalty:20})&&!E.driverIssue({loyalty:30}),'loyalty under 30 will not lead');
 ok(E.driverSkim({loyalty:45})===0.1&&E.driverSkim({loyalty:60})===0,'loyalty 30-59 skims 10%');
 ok(E.driverLvlEdge({lvl:6})===0.05&&E.driverLvlEdge({lvl:40})===C.driverLvlEdgeMax,'+1% per level, capped');}
// tutorial + migration
{ok(D.tutorial.steps.map(x=>x.id).join()==='gear,rats,scout,craft,trade,activity,estate,path','intro steps: scout after rats, first trade after craft');
 const s=E.newGame(1); s.tut.step=4; s.tut.done=['gear','rats','craft','activity']; s.schema=20; s.animalsFed=false; s.animals={mule:1}; E.normalize(s);
 ok(s.tut.done.includes('scout')&&s.tut.done.includes('trade')&&D.tutorial.steps[s.tut.step].id==='estate'&&s.unfed.mule===1&&s.schema>=21,'v21: old saves skip passed intro steps, keep their place, carry unfed state');}
console.log(pass+' map round 2 checks passed');
{const H=D.world.terrain.highlands; ok(H.speed===0.6&&!H.impassable&&H.gather.ore===1.25&&H.gather.gems===1.3&&D.world.terrain.hills.speed===0.8&&D.world.terrain.mountains.impassable,'elevation: hills 0.8 → highlands 0.6 (ore/gem bonus) → tall mountains impassable');
 ok(E.terrainAt(820,790)==='highlands'&&E.terrainAt(600,820)==='highlands','highlands region is mostly highlands terrain');
 console.log(pass+' map round 2 checks passed (incl. elevation)');}
