import fs from 'fs'; import * as E from '../js/engine.js';
const L=n=>JSON.parse(fs.readFileSync(new URL('../data/'+n+'.json',import.meta.url)));
const D={};for(const n of ['fields','skills','classes','traits','buildings','furniture','items','quests','regions','tuning','nodes','towns','minions','guilds','jobs','activities','estate','crafting','map','dungeons','legacy','chronicle','achievements','events','encounters','seasons','tutorial','notify','marriage','families','phases','intros','gear','paths','world','metals'])D[n]=L(n);
for(const f of D.estate.structureFiles)D['structures/'+f]=L('structures/'+f);
E.setData(D); let seed=11; E.setRng(()=>{seed=(seed*16807)%2147483647;return seed/2147483647;});
let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const ES=D.estate;
const s=E.newGame(1_700_000_000_000); E.active(s).ageDays=20*360; E.normalize(s);
for(const d of ES.structures){for(const k in d.cost||{})s.res[k]=(s.res[k]||0)+1e6;for(const u of d.upgrades||[])for(const k in u.cost)s.res[k]=(s.res[k]||0)+1e6;for(const t of d.tiers||[]){for(const k in t.cost)s.res[k]=(s.res[k]||0)+1e6;for(const u of t.upgrades)for(const k in u.cost)s.res[k]=(s.res[k]||0)+1e6;}}
s.res.coin=1e8; for(const l of ES.lands) E.buyLand(s,l.id);
const it=id=>D.items.find(i=>i.id===id), rc=id=>D.crafting.recipes.find(r=>r.id===id);
// metals + generated variants
const M=D.metals.metals, ladder=['bronze','iron','steel','mithril','adamantium'];
ok(ladder.every(m=>it(m+'_longsword')&&it(m+'_longsword').name.startsWith(M[m].name)),'Longsword exists per metal, metal in the name');
ok(ladder.every(m=>D.crafting.recipes.some(r=>r.base===m+'_sword'&&E.recipeMetal(r)===m)),'every metal sword has a recipe using that metal');
const hits=['bronze','iron','steel','mithril','adamantium'].map(m=>E.gstats(m+'_mace').hit); ok(hits.every((c,i)=>!i||c>hits[i-1]),'each metal step hits harder');
ok(E.gstats('mithril_mace').wt<E.gstats('steel_mace').wt&&E.gstats('adamantium_mace').wt>E.gstats('iron_mace').wt&&E.gstats('adamantium_mace').spd<E.gstats('mithril_mace').spd,'mithril light, adamantium heavy (slower)');
ok(ladder.every((m,i)=>!i||M[m].q>M[ladder[i-1]].q),'each metal step raises the quality bonus');
ok(it('iron_sword').cp===16&&rc('r_sword').base==='iron_sword'&&!D.crafting.recipes.some(r=>r.id==='r_iron_sword'),'hand-made iron items/recipes kept, not duplicated');
ok(!D.items.some(i=>/sunsteel|moonsilver/i.test(i.id+i.name)),'no sunsteel/moonsilver');
ok(new Set(D.items.map(i=>i.id)).size===D.items.length&&new Set(D.crafting.recipes.map(r=>r.id)).size===D.crafting.recipes.length,'no duplicate ids after expansion');
// one mine per vein type; rare veins need the mine tier
if(!s.land.includes('highclaim'))s.land.push('highclaim');
const mine=E.buildStructure(s,'mineshaft'); ok(mine.vein==='ore_vein'&&E.veinsFor(s,mine)[0].mine.res==='ore','first mine digs the iron vein only');
const cu=E.buildStructure(s,'mineshaft','copper_vein'); ok(cu.vein==='copper_vein'&&E.veinsFor(s,cu).length===1,'a second mine on the copper vein');
ok(!E.freeVeins(s).includes('copper_vein')&&E.buildStructure(s,'mineshaft','copper_vein').vein!=='copper_vein','one mine per vein type');
const mi=E.buildStructure(s,'mineshaft','mithril_vein'); ok(mi&&!E.veinsFor(s,mi).length,'mithril mine idle until Deep Mine');
for(let i=0;i<3;i++)E.upgradeSpecial(s,mi.uid); E.tierUp(s,mi.uid); ok(E.veinsFor(s,mi)[0].mine.res==='mithrilore','Deep Mine digs mithril');
const m0=s.res.mithrilore||0, c0=s.res.copperore||0; E.processDay(s,1); ok((s.res.mithrilore||0)>m0&&(s.res.copperore||0)>c0,'each mine yields its own ore');
const old={uid:'x',type:'mineshaft',pieces:['shaftlift'],up:0}; ok(E.veinOf(old)==='ore_vein','old saves: Mine Shaft keeps its iron vein');
ok(['oldmine','coppervein','silverseam','n_tinpit','n_coalseam','n_goldwash','n_gemvein'].every(id=>D.nodes.find(n=>n.id===id)&&D.map.points[id]),'each ore has its own map node');
ok(['iron_longsword','iron_mace','iron_sword','iron_chainmail','iron_scalemail'].every(id=>{const t=id.split('_')[1];return it('bronze_'+t).cp<it(id).cp&&it(id).cp<it('steel_'+t).cp;}),'iron sits between bronze and steel');
// smelting chain
const sm=E.buildStructure(s,'smithy'); ok(E.fixedOf(sm).includes('forge')&&!E.fixedOf(sm).includes('steelfurnace'),'Workshop: forge only');
sm.up=3; E.tierUp(s,sm.uid); ok(sm.pieces.includes('steelfurnace'),'Forge Hall adds the Steel Furnace');
s.res.coal=50; const st0=s.res.steel||0; E.processDay(s,1); ok((s.res.steel||0)>st0,'iron + coal → steel');
ok(E.placeIssue(s,sm.uid,'charcoalkiln')!=='not allowed here','Charcoal Kiln placeable in the smithy');
const steelR=D.crafting.recipes.find(r=>r.base==='steel_longsword'), bronzeR=D.crafting.recipes.find(r=>r.base==='bronze_longsword');
const q1=E.metalQuality(s,steelR); sm.up=3; // crafter-rank gates bypassed
ok(Math.abs(E.metalQuality(s,steelR)-q1-0.06)<1e-9,'Forge Hall upgrades boost metal quality (+.02 each)');
ok(E.metalQuality(s,steelR)>E.metalQuality(s,bronzeR),'steel beats bronze');
E.tierUp(s,sm.uid); ok(sm.pieces.includes('crucible'),'Foundry adds the Crucible');
// smokehouse fix
ok(!E.structDef('smokehouse').tiers[0].allowed.includes('smoker'),'Curing House no longer offers the Smoker it already has');
// loot
const Q=(cp,risk='risky',type='hunt',loot=[])=>({cp,risk,type,loot});
ok(E.dropChance(Q(0,'safe','errand'))>=0.1&&E.dropChance(Q(500,'deadly','dungeon'),1)<=0.6,'drop chance clamped');
ok(E.dropChance(Q(80))>E.dropChance(Q(10)),'harder fights drop more');
const lo=E.rarityOdds(Q(5,'safe')), hi=E.rarityOdds(Q(120,'deadly','dungeon'));
ok(hi.Legendary>lo.Legendary*10&&lo.Common>hi.Common,'difficulty shifts the rarity curve');
ok(hi.Legendary<0.2&&lo.Legendary>0,'legendary stays rare but possible');
let fav=0,any=new Set(); for(let i=0;i<4000;i++){const x=E.rollLoot(Q(60,'risky','hunt',['wolf_tooth']),0.5); if(x==='wolf_tooth')fav++; if(x)any.add(x);}
ok(fav>500&&any.size>30,'quest loot list = favorites, any item can drop ('+fav+' fav, '+any.size+' kinds)');
// migration 18
const o=E.newGame(1_700_000_000_000); E.normalize(o); o.vault=['steel_blade','c|bastard_sword|fine','scale_mail#fire']; o.found=['moonsilver_bow']; o.unlocks.push('recipe:r_sunsteel_mace');
const raw=JSON.parse(E.serialize(o,1_700_000_000_000)); raw.schema=17; raw._norm=false; E.normalize(raw);
ok(raw.vault.join()==='steel_sword,c|iron_longsword|fine,iron_scalemail#fire'&&raw.found.includes('mithril_bow')&&raw.unlocks.includes('recipe:r_iron_mace'),'save 18 renames old item ids everywhere');
console.log(pass+' metal/loot tests passed');
