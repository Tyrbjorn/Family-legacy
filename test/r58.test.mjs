// R58 ART-1: art.json, sprite files, palettes, iconHtml fallbacks, wiring, sim-neutral (no engine changes).
import fs from "fs"; import * as E from "../js/engine.js"; import { BUILD } from "../js/config.js";
import { iconHtml, spriteFor, matFor } from "../js/art.js";
const ROOT=new URL("../",import.meta.url).pathname, R=ROOT+"data/", D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const A=D.art;
ok(+BUILD.slice(1)>=58&&E.SCHEMA>=53,'R58+, SCHEMA stays 53');
ok(D.changelog.entries.some(e=>e.build==='R58'),'changelog R58');
ok(fs.readFileSync(ROOT+'js/main.js','utf8').includes('"art"'),'art.json loaded');
for(const [k,sp] of Object.entries(A.sprites)){ ok(fs.existsSync(ROOT+sp.file)&&sp.file.endsWith('.webp'),'file '+k); ok(sp.grey?[64,128].includes(sp.size):(sp.size===64||(sp.size===24&&/-sm$/.test(k))),'size '+k); /* R73: 24px -sm list icons */ /* R65: grey res icons 64px */ if(sp.veins)ok(fs.existsSync(ROOT+sp.veins),'veins '+k); ok(fs.statSync(ROOT+sp.file).size<20000,'small '+k); }
const mats=Object.keys(D.gear.kinds.mats); ok(mats.length===29&&mats.every(m=>/^#[0-9a-f]{6}$/.test((A.palettes[m]||{}).base||'')),'29 material palettes');
for(const map of [A.res,A.types,A.items,A.ui]) for(const v of Object.values(map)) ok(A.sprites[v],'known sprite '+v);
for(const t of Object.keys(A.types)) ok(D.gear.kinds.types[t],'gear type '+t);
const ids=new Set(D.items.map(x=>x.id)); for(const i of Object.keys(A.items)) ok(ids.has(i),'item '+i);
const sw=D.items.find(x=>x.id==='iron_sword'), h=iconHtml(A,'item','iron_sword',sw,{emoji:'⚔️'});
ok(h.includes('sword.webp')&&h.includes(A.palettes.iron.base)&&h.includes('onerror'),'iron sword: art + iron tint + fallback');
ok(iconHtml(A,'item','iron_sword',sw,{emoji:'⚔️',classic:true})==='⚔️','Classic emoji');
ok(iconHtml(A,'item','x',{type:'dagger'},{emoji:'🗡️'})==='🗡️','no art: emoji');
ok(iconHtml(null,'res','wood',null,{emoji:'🪵'})==='🪵','no table: emoji');
ok(iconHtml(A,'res','wood',null,{emoji:'🪵'}).includes('log.webp')&&!iconHtml(A,'res','wood',null,{}).includes('arttint'),'resources: full colour');
ok(matFor(A,'dwarfpick',{})==='steel'&&spriteFor(A,'item','steel_sword+keen',{type:'sword'})==='sword','enchanted/generated items map by type');
const n=E.setData&&(()=>{const DD={...D};for(const f of D.estate.structureFiles)DD['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));E.setData(DD);return D.items.filter(x=>spriteFor(A,'item',x.id,x)).length;})();
ok(n>=30,'items with art: '+n);
const css=fs.readFileSync(ROOT+'style.css','utf8'); ok(css.includes('.art{')&&css.includes('mix-blend-mode:multiply'),'css');
ok(fs.readFileSync(ROOT+'js/ui/guide.js','utf8').includes('classicemoji'),'setting in Settings');
for(const [k,m] of Object.entries(A.resMat)){ok(A.res[k]===(k==='ore'||k.endsWith('ore')?'ore':'ingot')&&A.palettes[m],'ingot art '+k);ok(iconHtml(A,'res',k,null,{emoji:'x'}).includes(((k==='ore'||k.endsWith('ore'))&&(A.veinPal||{})[m])||A.palettes[m].base),'tinted '+k);}
ok(A.resMat.copperore==='copper'&&A.resMat.copper==='copper','copper ore and ingot look copper');
console.log('r58 ok',pass,'items with art',n);
