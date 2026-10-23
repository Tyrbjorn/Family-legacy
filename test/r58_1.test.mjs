// R58.1: copper ore + copper listed in inventory, copper-tinted ingot art.
import fs from "fs"; import * as E from "../js/engine.js"; import { BUILD } from "../js/config.js"; import { iconHtml } from "../js/art.js";
const ROOT=new URL("../",import.meta.url).pathname; let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const A=JSON.parse(fs.readFileSync(ROOT+'data/art.json')), C=JSON.parse(fs.readFileSync(ROOT+'data/changelog.json'));
ok(+BUILD.slice(1)>=58.1,'R58.1+'); ok(E.SCHEMA===53,'SCHEMA 53'); ok(C.entries.some(e=>e.build==='R58.1'),'changelog');
const src=fs.readFileSync(ROOT+'js/ui/common.js','utf8').replace(/\s/g,''); ok(src.includes('"ingots","copperore","copper","tinore"'),'copper rows listed after ingots');
for(const k of ['copperore','copper']){const h=iconHtml(A,'res',k,null,{emoji:'x'});ok(h.includes(k==='copper'?'ingot.webp':'ore-veins.webp')&&h.includes(k==='copper'?A.palettes.copper.base:A.veinPal.copper),k+' copper ingot');}
console.log('r58.1 ok',pass);
