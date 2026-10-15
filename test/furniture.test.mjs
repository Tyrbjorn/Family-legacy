import fs from 'fs'; import * as E from '../js/engine.js';
const L=n=>JSON.parse(fs.readFileSync(new URL('../data/'+n+'.json',import.meta.url)));
const D={};for(const n of ['skills','classes','traits','buildings','furniture','items','quests','regions','tuning','nodes','towns','minions','guilds','jobs','activities','estate','crafting','map','dungeons','legacy','chronicle','achievements','events','encounters','seasons','tutorial','notify','marriage','phases','intros','gear','paths','world'])D[n]=L(n);
E.setData(D); let seed=11; E.setRng(()=>{seed=(seed*16807)%2147483647;return seed/2147483647;});
let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const ES=D.estate, all=[...ES.pieces,...D.furniture];
const home=['shack','cabin','house','mansion','fort','towerkeep','abbey'];
// data rules
ok(all.filter(p=>!p.mergedInto).every(p=>p.desc&&p.desc.length>3),'every item has a one-line effect');
ok(all.every(p=>E.pieceSlots(p.id)===1&&E.pieceSlots(p.id+'@3')===1),'every item costs 1 slot at any tier');
ok(ES.structures.filter(d=>!home.includes(d.id)&&d.allowed&&d.id!=='countinghouse').every(d=>d.allowed.length<=4),'non-home buildings offer at most 4 slot items');
ok(['cradle','featherbed','minionbunk'].every(id=>E.pieceDef(id).id==='bunk')&&E.pieceDef('coldcellar').id==='larder','merged items resolve to their new item');
ok(home.every(id=>E.structDef(id).fittings.includes('studycorner')),'Study Corner placeable in every home');
// bed by placement
const s=E.newGame(1_700_000_000_000); E.active(s).ageDays=20*360; E.normalize(s); Object.assign(s.res,{coin:1e6,wood:1e5,stone:1e5,planks:1e4,blocks:1e4,ingots:1e4});
for(const l of ES.lands) E.buyLand(s,l.id);
const h=E.buildStructure(s,'shack'); const b0=E.bedrooms(s), f0=E.housingCap(s,'bunk');
ok(E.placePiece(s,h.uid,'bunk')&&E.bedrooms(s)>b0&&E.housingCap(s,'bunk')===f0,'Bed in a home = family bed');
ok(E.placePiece(s,h.uid,'bunk'),'Beds stack');
const bh=E.buildStructure(s,'bunkhouse'); const f1=E.housingCap(s,'bunk'), b1=E.bedrooms(s);
ok(E.placePiece(s,bh.uid,'bunk')&&E.housingCap(s,'bunk')>f1&&E.bedrooms(s)===b1,'Bed in a Bunkhouse = follower beds');
ok(E.placeIssue(s,h.uid,'cradle')&&E.placeIssue(s,h.uid,'hourglass'),'merged/fitting items cannot be placed as slot items');
// fittings
ok(E.fittingOptions(h).some(f=>f.id==='hourglass')&&E.buyFitting(s,h.uid,'hourglass')&&h.fittings.includes('hourglass')&&E.fittingIssue(s,h.uid,'hourglass')==='owned','fittings bought once, no slot');
ok(E.hasPiece(s,'hourglass'),'fitting counts as owned for effects');
// demolish bed check
const fam=E.living?E.living(s).length:s.members.length;
const ext=s.members.length; for(let i=0;i<E.bedrooms(s)-ext;i++) s.members.push({...JSON.parse(JSON.stringify(s.members[0])),id:500+i});
ok(/beds/.test(E.demolishIssue(s,h.uid)||''),'demolishing the only home is blocked (family beds)');
E.addMinion(s,'laborer','t');
let nm=0; while(E.addMinion(s,'laborer','t')&&nm<40)nm++;
ok(/follower/.test(E.demolishIssue(s,bh.uid)||''),'demolishing a full Bunkhouse is blocked (follower beds)');
// fort upgrade blocked if family would lack beds
ok(/beds/.test(E.typeBedIssue(s,h,'fort')||''),'turning the only home into a Fort is blocked when family lacks beds');
// migration
const o=E.newGame(1_700_000_000_000); E.normalize(o);
o.structures=[{uid:'a',type:'shack',pieces:['cradle','featherbed@2','bookshelf','trophy','forge'],up:0},{uid:'b',type:'smithy',pieces:['forge','runedanvil'],up:0}]; o.pieceStore=['mirror','minionbunk'];
const raw=JSON.parse(E.serialize(o,1_700_000_000_000)); raw.schema=13; raw._norm=false; E.normalize(raw);
const ha=raw.structures.find(x=>x.uid==='a'), sb=raw.structures.find(x=>x.uid==='b');
ok(ha.pieces.filter(p=>p.startsWith('bunk')).length===2&&ha.pieces.includes('bunk@2'),'cradle/featherbed → Bed (tier kept)');
ok(ha.fittings.includes('studycorner'),'bookshelf → Study Corner (slot-free)');
ok(ha.fittings.includes('trophy')&&ha.fittings.includes('mirror'),'stat items become home fittings (incl. from storage)');
ok(sb.fittings.includes('runedanvil'),'Rune Anvil becomes a Smithy fitting');
ok(raw.pieceStore.includes('forge')&&!ha.pieces.includes('forge'),'disallowed items go to storage');
ok(raw.pieceStore.includes('bunk'),'stored merged items remapped');

// specialty picks: every option has its own tradeoff line, no duplicates
const spec=ES.structures.filter(d=>d.special&&d.allowed&&!home.includes(d.id)&&d.slots===1);
ok(spec.every(d=>d.picks&&d.allowed.every(a=>d.picks[a]&&d.picks[a].length>10)&&new Set(Object.values(d.picks)).size===d.allowed.length&&new Set(d.allowed).size===d.allowed.length&&d.allowed.length<=4),'specialty picks: distinct options, each with a tradeoff line');
ok(spec.every(d=>!(d.fixed||[]).some(f=>d.allowed.includes(f))),'no pick duplicates the building\'s built-in');
// Root Cellar & Nursery fittings
const q=E.newGame(1_700_000_000_000); E.normalize(q); Object.assign(q.res,{coin:1e5,wood:1e4,stone:1e4,planks:1e3}); for(const l of ES.lands) E.buyLand(q,l.id);
const qh=E.buildStructure(q,'shack'); ok(/quest|Glowcap|mushroom/i.test(E.fittingIssue(q,qh.uid,'rootcellar')||''),'Root Cellar locked until the mushroom quest ('+E.fittingIssue(q,qh.uid,'rootcellar')+')');
q.doneQuests.push('mushrooms'); const fc=E.foodCap(q); ok(E.buyFitting(q,qh.uid,'rootcellar')&&E.foodCap(q)===fc+800,'Root Cellar: +800 food storage, slot-free');
const cx=E.eff(q,'childxp'); ok(E.buyFitting(q,qh.uid,'nursery')&&E.eff(q,'childxp')>cx,'Nursery fitting restores childhood XP');
const cx2=E.eff(q,'childxp'); E.placePiece(q,qh.uid,'bunk'); ok(E.activeSynergies(qh).some(y=>y.id==='nursery')&&E.eff(q,'childxp')>cx2,'Bed + Nursery combo');
ok(/Combo/.test(E.pieceLine('bunk'))&&/Nursery/.test(E.pieceLine('bunk'))&&/Combo/.test(E.pieceLine('workbench','smithy')),'one-liners list combos');
// clear bed reason
{ const r=E.typeBedIssue(s,h,'fort')||''; ok(/Fort beds house followers; family would be short \d+ beds?/.test(r),'bed block reason is clear: '+r); }
// migration grants
{ const o=E.newGame(1_700_000_000_000); E.normalize(o); o.structures=[{uid:'a',type:'shack',pieces:['cradle'],up:0}]; o.pieceStore=['coldcellar'];
  const raw=JSON.parse(E.serialize(o,1_700_000_000_000)); raw.schema=13; raw._norm=false; E.normalize(raw);
  ok(raw.structures[0].fittings.includes('nursery')&&raw.structures[0].fittings.includes('rootcellar'),'old Cradle → Nursery fitting, old Cold Cellar → Root Cellar fitting'); }

// thin buildings: new items, combos, slot-free small things
{ const g=E.newGame(1_700_000_000_000); E.active(g).ageDays=20*360; E.normalize(g); for(const d of ES.structures)for(const k in d.cost||{})g.res[k]=(g.res[k]||0)+1e5; Object.assign(g.res,{coin:1e6,wood:1e5,stone:1e5,planks:1e4,blocks:1e4,ingots:1e4,barley:1e3}); for(const l of ES.lands) E.buyLand(g,l.id);
  const hs0=E.haulTier(g).haulSpeed, bc0=E.eff(g,'banditCut');
  const w=E.buildStructure(g,'warehouse'); w.up=3; ok(w&&E.placePiece(g,w.uid,'loadingdock')&&E.haulTier(g).haulSpeed>hs0*1.14,'Loading Dock: wagons 15% faster');
  const ws0=E.wagonSpeed(g); ok(E.buyFitting(g,w.uid,'lanterns')&&E.eff(g,'nightBanditCut')>=0.3&&Math.abs(E.wagonSpeed(g)-ws0-E.nightShare()*0.3)<1e-9,'Lanterns: slot-free, faster at night + safer at night');
  E.upgradeStructure(g,w.uid); w.up=3; ok(w.type==='tradingpost'&&E.placePiece(g,w.uid,'guardpost')&&E.eff(g,'banditCut')>=0.15,'Guard Post cuts bandit chance');
  E.upgradeStructure(g,w.uid); w.up=3; ok(w.type==='countinghouse'&&E.placePiece(g,w.uid,'storage')&&E.activeSynergies(w).some(y=>y.id==='depot'),'Depot combo (Loading Dock + Storage)');
  E.removePiece(g,w.uid,'guardpost'); ok(E.placePiece(g,w.uid,'stall')&&!E.activeSynergies(w).some(y=>y.id==='shopfront'),'no Shopfront in the Counting House'); E.removePiece(g,w.uid,'storage'); const ts0=E.eff(g,'tradeSell'); ok(E.placePiece(g,w.uid,'studydesk')&&E.activeSynergies(w).some(y=>y.id==='ledgerhall')&&E.eff(g,'tradeSell')>=ts0+0.1,'Ledger Hall combo (Study Desk + Stall): +10% trade sell');
  const g2=E.newGame(1_700_000_000_000); E.normalize(g2); g2.structures=[{uid:'c',type:'countinghouse',pieces:['studydesk'],up:0}];
  ok(E.effects(g2).some(f=>f.bonus.skill==='haggling'),'Counting House desk teaches Haggling');
  const br=E.buildStructure(g,'brewery'); br.up=1; ok(br&&E.placePiece(g,br.uid,'caskrack')&&E.activeSynergies(br).some(y=>y.id==='cellaredale'),'Cellared Ale combo');
  const my=E.buildStructure(g,'masonyard'); my.up=1; ok(my&&E.placePiece(g,my.uid,'splitbench')&&E.activeSynergies(my).some(y=>y.id==='stoneworks'),'Stoneworks combo');
  ok(['studycorner','shrine','perch','brazier','reagentshelf','glyphlectern','lanterns'].every(id=>E.pieceDef(id).fitting),'small items are slot-free');
  ok(ES.structures.every(d=>!(d.allowed||[]).some(a=>E.pieceDef(a)&&E.pieceDef(a).fitting)),'no building offers a small item as a slot item');
  const hm=E.buildStructure(g,'shack'); const pc=E.housingCap(g,'perch'); ok(E.buyFitting(g,hm.uid,'perch')&&E.housingCap(g,'perch')===pc+1,'Perch fitting still houses a familiar'); }
// step 15: placed small items move to fittings
{ const o=E.newGame(1_700_000_000_000); E.normalize(o); o.structures=[{uid:'a',type:'shack',pieces:['shrine','perch'],up:0}];
  const raw=JSON.parse(E.serialize(o,1_700_000_000_000)); raw.schema=14; raw._norm=false; E.normalize(raw);
  ok(raw.structures[0].fittings.includes('shrine')&&raw.structures[0].fittings.includes('perch')&&!raw.structures[0].pieces.length,'old placed Shrine/Perch become fittings'); }

// rank gating: upgrades add slots and unlock better items
{ const g=E.newGame(1_700_000_000_000); E.active(g).ageDays=20*360; E.normalize(g); for(const d of ES.structures){for(const k in d.cost||{})g.res[k]=(g.res[k]||0)+1e5;for(const u of d.upgrades||[])for(const k in u.cost)g.res[k]=(g.res[k]||0)+1e5;} g.res.coin=1e7; for(const l of ES.lands) E.buyLand(g,l.id);
  const br=E.buildStructure(g,'brewery'); ok(/needs upgrade 1/.test(E.placeIssue(g,br.uid,'caskrack')||''),'Cask Rack locked until upgrade 1');
  const f0=E.freeSlots(g,br); E.upgradeSpecial(g,br.uid); ok(!E.placeIssue(g,br.uid,'caskrack'),'upgrade 1 unlocks it');
  E.upgradeSpecial(g,br.uid); ok(E.freeSlots(g,br)===f0+1,'upgrade 2 adds a slot');
  ok(ES.structures.filter(d=>d.unlockUp).every(d=>Object.entries(d.unlockUp).every(([i,l])=>d.allowed.includes(i)&&l<=(d.upgrades||[]).length)),'unlock levels reference real items and upgrade levels');
  ok(E.rankSlots({type:'shack',up:3})===0,'manor line unaffected'); }

// day/night
{ const z=E.newGame(1_700_000_000_000); z.acc=0.5; ok(!E.isNight(z)&&/Day/.test(E.todLabel(z)),'midday is day'); z.acc=0.9; ok(E.isNight(z)&&/Night/.test(E.todLabel(z)),'late is night'); z.acc=0.1; ok(E.isNight(z),'night wraps past midnight'); ok(E.nightShare()>0.4&&E.nightShare()<0.5,'night share from tuning'); }
// five thin buildings + Shopfront auto-sell
{ const g=E.newGame(1_700_000_000_000); E.active(g).ageDays=20*360; E.normalize(g); for(const d of ES.structures){for(const k in d.cost||{})g.res[k]=(g.res[k]||0)+1e5;for(const u of d.upgrades||[])for(const k in u.cost)g.res[k]=(g.res[k]||0)+1e5;} Object.assign(g.res,{coin:1e7,dust:100,cloth:100}); for(const l of ES.lands) E.buyLand(g,l.id);
  ok(['herbalistshack','magestower','shrinehouse','graveyard','ancestorhall'].every(id=>{const a=E.structDef(id).allowed.length;return a>=3&&a<=4;}),'five thin buildings now have 3-4 slot choices');
  ok(E.structDef('ancestorhall').upgrades.map(u=>u.name).join()==='Portrait Gallery,Family Archive,Heirloom Vault','Hall of Ancestors upgrade line');
  g.structures.push({uid:'ahx',type:'ancestorhall',pieces:['ancestorshrine'],up:0}); const ah=g.structures.find(x=>x.uid==='ahx'); ok(ah&&/needs upgrade 1/.test(E.placeIssue(g,ah.uid,'feasttable')||''),'Feast Table locked at L0');
  ok(E.upgradeSpecial(g,ah.uid)&&E.placePiece(g,ah.uid,'feasttable')&&E.activeSynergies(ah).some(y=>y.id==='remembrance'),'Feast Table at L1 + Remembrance Feast');
  E.upgradeSpecial(g,ah.uid); ok(E.freeSlots(g,ah)===1,'L2 slot bonus');
  const sh=E.buildStructure(g,'shrinehouse'); sh.up=2; ok(sh&&E.placePiece(g,sh.uid,'infirmary')&&E.activeSynergies(sh).some(y=>y.id==='hospice'),'Infirmary Beds + Hospice');
  const gy=E.buildStructure(g,'graveyard'); ok(gy&&E.placePiece(g,gy.uid,'yewgrove'),'Yew Grove placeable at L0'); const w0=g.res.wood; E.processDay(g); ok(g.res.wood>w0,'Yew Grove grows wood');
  const mt=E.buildStructure(g,'magestower'); mt.up=1; const mp=g.res.moonpetal||0; ok(mt&&E.placePiece(g,mt.uid,'moonplanter'),'Moonpetal Planter at L1'); E.processDay(g); ok((g.res.moonpetal||0)>mp,'planter grows moonpetal');
  const hb=E.buildStructure(g,'herbalistshack'); hb.up=2; g.res.thyme=1e3; g.res.potions=0; g.res.remedies=0;
  ok(hb&&E.placePiece(g,hb.uid,'stall')&&E.placePiece(g,hb.uid,'storage')&&E.activeSynergies(hb).some(y=>y.id==='shopfront'),'Shopfront in the Herbalist\'s Shack');
  const c0=g.res.coin; E.processDay(g); ok(g.res.coin>c0&&g.autoSold>0,'Shopfront auto-sells the building\'s own output');
  ok(E.structDef('shrinehouse').unlockUp.infirmary===2,'unlock levels set'); }
// old saves: gated items stay placed
{ const o=E.newGame(1_700_000_000_000); E.normalize(o); o.structures=[{uid:'b',type:'brewery',pieces:['brewvats','caskrack'],up:0}];
  const raw=JSON.parse(E.serialize(o,1_700_000_000_000)); raw.schema=15; raw._norm=false; E.normalize(raw); ok(raw.structures[0].pieces.includes('caskrack'),'gated item stays placed on old saves'); }
{ ok(!E.activeSynergies({type:'thievesden',pieces:['fencetable','stall','studydesk']}).some(y=>y.id==='ledgerhall'),'Ledger Hall only in the Counting House'); }
console.log(pass+' furniture tests passed');
