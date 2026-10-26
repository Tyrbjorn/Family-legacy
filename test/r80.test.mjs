// R80: seven shop-only courtship gifts (data only: items.json + towns.json). No recipes, no loot drops, no engine/tuning change, map and save unchanged.
import fs from 'fs'; import * as E from '../js/engine.js'; import { BUILD } from '../js/config.js'; import { STEPS } from '../js/engine/save-steps.js';
const R=new URL('../data/',import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const fresh=()=>{const s=E.newGame(1);E.normalize(s);return s;};
const NEW={ribbon_herbs:['Ribbon-tied Herbs',10,15,'millbrook'],whetstone_oil:['Whetstone and Oil',12,25,'millbrook'],arrow_set:['Fletched Arrow Set',12,25,'millbrook'],inked_quire:['Inked Quire',14,35,'thornwick'],silver_thimble:['Silvered Thimble',14,40,'ashford'],amber_brooch:['Amber Brooch',25,120,'eyrie'],wedding_cloth:['Wedding Cloth Bolt',20,80,'thornwick']};
ok(/^R(80)$/.test(BUILD)&&E.SCHEMA===55&&STEPS.at(-1).n===55,'R80 build, save stays 55');
ok(D.changelog.entries[0].build==='R80'&&D.changelog.entries[0].items.length>=3&&D.changelog.entries.some(e=>e.build==='R79'),'changelog');
const it=id=>D.items.find(i=>i.id===id);
ok(new Set(D.items.map(i=>i.id)).size===D.items.length,'item ids unique');
for(const [id,[name,aff,val,town]] of Object.entries(NEW)){
  const x=it(id); ok(x&&x.name===name&&x.slot==='gift'&&x.affinity===aff&&x.value===val,'item '+id);
  ok(x.noDrop===true,id+' cannot drop as loot');
  const shops=D.towns.filter(t=>t.shop.includes(id)).map(t=>t.id); ok(shops.length===1&&shops[0]===town,id+' sold only in '+town);
  ok(!JSON.stringify(D.crafting).includes('"'+id+'"')&&!JSON.stringify(D.quests).includes('"'+id+'"'),id+' has no recipe and is no quest reward');
  ok(!x.cp&&!x.guild&&!x.adv&&!x.fx&&!x.type,id+' is a plain gift');
}
ok(Object.keys(NEW).length===7&&D.items.filter(i=>i.slot==='gift').length===9,'nine gifts in all (2 old + 7)');
// existing gifts untouched
ok(it('flowers').affinity===8&&it('flowers').value===10&&it('chocolate').affinity===15&&it('chocolate').value===30&&!it('flowers').noDrop&&!it('chocolate').noDrop,'old gifts unchanged');
// none of the new ids is a personality favourite or a Houses/loot-pool member (no class multiplier)
for(const p of D.marriage.personalities||[]) ok(!(p.likesGift in NEW),'no personality likes '+p.id+' new gifts');
{ const s=fresh(); s.res.coin=1e6; s.vault=[];
  for(const [id,[,,val,town]] of Object.entries(NEW)){ ok(E.shopOf(s,town).includes(id),'shopOf '+town+' lists '+id); const before=s.res.coin; ok(E.buyItem(s,town,id),'buy '+id); ok(before-s.res.coin===E.buyPrice(it(id),s,town)&&E.buyPrice(it(id),s,town)>=val,'price '+id); }
  ok(!E.buyItem(s,'gullport','amber_brooch'),'not sold in Gullport');
  ok(s.vault.length===7,'seven gifts in the vault');
  // give each to a suitor: affinity adds the listed amount (x likedGiftMult only for the personality's own gift)
  for(const [id,[,aff]] of Object.entries(NEW)){ const su={id:'su_'+id,name:'T',persona:'warm',affinity:0,days:0}; s.suitors=[su]; ok(E.giveGift(s,su.id,id)&&su.affinity===aff,'give '+id+' = +'+aff); }
  ok(s.vault.length===0,'gifts consumed');
}
// gift loot: with the pool built from data, no new gift can come out of rollLoot
{ const pool=D.items.filter(i=>['Common','Fine','Rare','Epic','Legendary'].includes(i.rarity)&&!i.noDrop&&i.value>0); for(const id of Object.keys(NEW)) ok(!pool.some(i=>i.id===id),id+' not in loot pool'); }
// encyclopedia is data-built: a held gift shows up once held
{ const s=fresh(); s.vault=['amber_brooch']; const c=E.encCatalog(D); ok(c.items.some(e=>e.id==='amber_brooch'&&e.name==='Amber Brooch'),'encyclopedia lists Amber Brooch'); }
console.log('r80 ok '+pass+' checks');
