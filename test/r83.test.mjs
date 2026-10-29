// R83 text-only cleanups: no "first draft" claims in R78-R81 changelog entries, singular "land slot" in Estate tab / map / log.
import fs from 'fs'; import * as E from '../js/engine.js'; import { BUILD } from '../js/config.js'; import { STEPS } from '../js/engine/save-steps.js';
const R=new URL('../data/',import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const src=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
ok(/^R8[3456]/.test(BUILD)&&E.SCHEMA===55&&STEPS.at(-1).n===55,'R83 build, save stays 55');
const CL=D.changelog.entries; ok(CL.some((e,i)=>e.build==='R83'&&e.title==='Small text cleanups'&&CL[i+1].build==='R82'),'changelog leads with R83 "Small text cleanups"');
for(const b of ['R78','R79','R80','R81']){ const e=CL.find(x=>x.build===b); ok(e&&e.items.length>=3&&!e.items.some(i=>/first draft|may change/i.test(i)),b+': no draft claim, entry kept'); }
const all=b=>CL.find(x=>x.build===b).items.join(' ');
ok(/Adults and the map are unchanged/.test(all('R78'))&&/shop-only: no recipes, no loot drops/.test(all('R80'))&&/Dwarf-only for now\. The map is unchanged/.test(all('R81'))&&/The map is unchanged/.test(all('R79')),'useful facts kept');
ok(CL.some(e=>e.build==='R82'&&e.items.some(i=>/keep their lifespan/.test(i))),'R82 entry untouched');
for(const p of ['js/ui/estate-tab.js','js/ui/estate-map.js','js/engine/estate.js']) ok(/land \$\{(l|p)\.slots === 1 \? "slot" : "slots"\}/.test(src(p)),p+': singular land slot');
ok(D.estate.lands.some(l=>l.slots===1),'a 1-slot parcel exists (Riverbank), so the singular matters');
console.log('r83 ok '+pass+' checks');
