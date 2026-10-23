// R63: every inventory material (except food) has a sell price in every town; copper Sell all works; no save step
import fs from 'fs'; import * as E from '../js/engine.js'; import { BUILD } from '../js/config.js'; import { STEPS } from '../js/engine/save-steps.js';
const root=new URL('../',import.meta.url).pathname; const D={};
for(const f of fs.readdirSync(root+'data').filter(f=>f.endsWith('.json'))) D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(root+'data/'+f));
for(const f of D.estate.structureFiles) D['structures/'+f]=JSON.parse(fs.readFileSync(root+'data/structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
ok(+BUILD.slice(1)>=63&&E.SCHEMA===55&&STEPS.at(-1).n===55,'R63, no new save step');
ok(JSON.parse(fs.readFileSync(root+'data/changelog.json')).entries.some(e=>e.build==='R63'),'changelog');
const src=fs.readFileSync(root+'js/ui/common.js','utf8'), i=src.indexOf('export const MATS = ['), MATS=[...src.slice(i,src.indexOf(']',i)).matchAll(/"(\w+)"/g)].map(m=>m[1]);
for(const k of MATS) if(k!=='food') for(const t of D.towns) ok(t.prices[k]>0,`price ${k} @ ${t.id}`);
const p=D.towns[0].prices; ok(p.copperore<p.tinore&&p.copper<p.tin&&p.copper<p.ingots,'copper below tin and iron');
const s=E.newGame(1); E.normalize(s); s.res.copper=10; const c0=s.res.coin;
E.sellRes(s,'thornwick','copper',10); ok(s.res.copper===0&&s.res.coin>c0,'copper sells');
console.log(`PASS test/r63.test.mjs: ${pass} checks passed`);
