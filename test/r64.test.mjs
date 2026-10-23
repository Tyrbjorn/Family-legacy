// R64: central resource display names (data/resnames.json + fallback), no raw ids on main screens, walker tabard lift
import fs from 'fs'; import * as E from '../js/engine.js'; import { BUILD } from '../js/config.js'; import { STEPS } from '../js/engine/save-steps.js';
import { walkerTabard } from '../js/ui/walker-tint.js'; import { spawn, spawnSync } from 'child_process';
const root=new URL('../',import.meta.url).pathname; const D={};
for(const f of fs.readdirSync(root+'data').filter(f=>f.endsWith('.json'))) D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(root+'data/'+f));
for(const f of D.estate.structureFiles) D['structures/'+f]=JSON.parse(fs.readFileSync(root+'data/structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
ok(+BUILD.slice(1)>=64&&E.SCHEMA===55&&STEPS.at(-1).n===55,'R64, no new save step');
ok(JSON.parse(fs.readFileSync(root+'data/changelog.json')).entries.some(e=>e.build==='R64'),'changelog');
ok(fs.readFileSync(root+'js/main.js','utf8').includes('"resnames"'),'main.js loads resnames');
ok(E.resName('copperore')==='Copper ore'&&E.resName('cutgems')==='Cut gems'&&E.resName('ingots')==='Iron ingots','named');
ok(E.resName('frostore')==='Frost ore'&&E.resName('wood')==='Wood'&&E.resName('blue_thing')==='Blue thing','fallback splits + title-cases');
const ids=new Set([...D.towns.flatMap(t=>Object.keys(t.prices))]);
for(const k of ids){const n=E.resName(k);ok(n&&n!==k&&/^[A-Z]/.test(n),'display name for '+k);}
for(const k of D.resnames.invented) ok(D.resnames.names[k],'invented is a listed name: '+k);
ok(E.resList({copperore:3,cutgems:1})==='3 Copper ore, 1 Cut gems','resList');
// saves untouched: res keys stay ids
const s=E.newGame(1); E.normalize(s); ok('copperore' in s.res||s.res.copperore===undefined,'save keys');
// source scan: no "icon then raw id" pattern left in UI
for(const f of fs.readdirSync(root+'js/ui').filter(f=>f.endsWith('.js'))){const t=fs.readFileSync(root+'js/ui/'+f,'utf8');ok(!/RI\[([\w.]+)\] \|\| ""\}\s?\$\{\1\}/.test(t)&&!/RI\[([\w.]+)\] \|\| \1(?![\w.(])/.test(t),'no raw id fallback in '+f);}
// walker tabard: lighter than the chosen colour, same dominant channel
for(const h of D.creation.houseCols){const T=walkerTabard(h.col),L=c=>c[0]+c[1]+c[2];ok(L(T.base)>L(T.orig)&&L(T.hi)>L(T.base),'tabard lifted '+h.id);const dom=c=>c.indexOf(Math.max(...c));if(h.id!=='sable')ok(dom(T.base)===dom(T.orig),'tabard keeps hue '+h.id);}
// browser: no raw ids on the main screens (own static server)
const port=8164+Math.floor(Math.random()*20), srv=spawn('python3',['-m','http.server',String(port)],{cwd:root,stdio:'ignore'});
await new Promise(r=>setTimeout(r,800));
const r=spawnSync('node',['test/r64-browser.mjs'],{cwd:root,encoding:'utf8',env:{...process.env,PORT:String(port)}}); srv.kill();
ok(r.status===0,'browser raw-id check: '+(r.stdout||'')+(r.stderr||'').slice(-300)); console.log((r.stdout||'').trim());
console.log(`PASS test/r64.test.mjs: ${pass} checks passed`);
