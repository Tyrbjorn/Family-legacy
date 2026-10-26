// R82 text-only fixes: trait descriptions, Land and renown entry, heritage wording, lineage-mark tail in the marriage preview.
import fs from 'fs'; import * as E from '../js/engine.js'; import { BUILD } from '../js/config.js'; import { STEPS } from '../js/engine/save-steps.js';
const R=new URL('../data/',import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
ok(/^R82/.test(BUILD)&&E.SCHEMA===55&&STEPS.at(-1).n===55,'R82 build, save stays 55');
ok(D.changelog.entries[0].build==='R82'&&D.changelog.entries[0].items.length>=1,'changelog leads with R82');
const tr=id=>D.traits.find(t=>t.id===id);
ok(!/placeholder/i.test(tr('dwarfblood').desc)&&!/placeholder/i.test(tr('dwarfblooded').desc)&&/First-generation half-dwarf/.test(tr('dwarfblood').desc)&&/faint, lasting trace/.test(tr('dwarfblooded').desc),'trait descriptions: no placeholder suffix, text kept');
{ const e=E.encCatalog(D).lore.find(x=>x.id==='land:renown'); ok(e&&!/\b1 land slots/.test(e.text),'no "1 land slots"');
  const lands=D.estate.lands, one=lands.filter(l=>l.slots===1); for(const l of one) ok(new RegExp(l.name+': 1 land slot,').test(e.text),'singular for '+l.name);
  const order=[...lands].sort((a,b)=>(a.renown||0)-(b.renown||0)||lands.indexOf(a)-lands.indexOf(b)), pos=order.map(l=>e.text.indexOf(l.name+':'));
  ok(pos.every(p=>p>=0)&&pos.every((p,i)=>i===0||p>pos[i-1]),'parcel lines sorted by renown ascending'); }
{ const e=E.encCatalog(D).lore.find(x=>x.id==='heritage:blood'); ok(e&&!/full dwarf/.test(e.text)&&/unmixed dwarven blood/.test(e.text),'heritage wording'); }
{ const hum={traits:[]}, ib={house:'ironbrow',traits:[]}, tail=p=>/lineage mark/.test(p.tip);
  ok(!tail(E.bloodPreview(hum,ib)),'human x Ironbrow: no lineage-mark tail (no Dwarf outcome)');
  ok(!tail(E.bloodPreview({traits:['dwarfblooded']},hum)),'blooded x human: no tail');
  ok(!tail(E.bloodPreview({traits:['dwarfblood']},hum)),'half x human: no tail');
  ok(tail(E.bloodPreview({traits:['dwarfblood']},ib)),'half x Ironbrow: tail (Dwarf child possible)');
  ok(tail(E.bloodPreview({traits:['dwarfblood']},{traits:['dwarfblood']})),'half x half: tail');
  ok(tail(E.bloodPreview({traits:['dwarfblooded']},ib)),'blooded x Ironbrow: tail'); }
// migration (Jeremy's option B): converted members swap the trait but keep every year of lifespan; nothing else about them moves
{ const s=E.newGame(1); E.normalize(s); const BASE=s.members[0].lifespan;
  const mk=(id,o)=>{const m=E.newMember(s,{age:60,parents:o.parents||null}); m.id=id; delete m.bloodV; m.traits=o.traits; m.lifespan=o.lifespan; m.warned=o.warned; s.members.push(m); return m;};
  const f=mk(951,{traits:['dwarfblood'],lifespan:67}), h=mk(952,{traits:[],lifespan:55}), k=mk(953,{parents:[951,952],traits:['dwarfblood'],lifespan:67,warned:true});
  const before={life:k.lifespan,age:k.age,warned:k.warned,flife:f.lifespan};
  E.normalize(s);
  ok(k.traits.join()==='dwarfblooded'&&k.bloodV===1,'converted: trait swapped');
  ok(k.lifespan===before.life&&k.age===before.age&&k.warned===before.warned,'converted: lifespan, age and frailty flag unchanged');
  ok(f.traits.join()==='dwarfblood'&&f.lifespan===before.flife,'founder untouched');
  const snap=JSON.stringify(s.members); E.normalize(s); ok(JSON.stringify(s.members)===snap,'idempotent, no second cut'); }
console.log('r82 ok '+pass+' checks');
