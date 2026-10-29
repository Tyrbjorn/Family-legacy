// R85: tab tours: tab named + ringed, spotlight cut-out, card avoids the tab, pinned strip, reliable first scroll (UI only, no engine change)
import fs from 'fs'; import * as E from '../js/engine.js'; import { BUILD } from '../js/config.js'; import { STEPS } from '../js/engine/save-steps.js';
import { VIEWS, GROUPS, groupOfView } from '../js/ui/nav-data.js'; import { CHAPTERS } from '../js/ui/coach-data.js';
const R=new URL('../data/',import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const src=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
ok(/^R8[56]$/.test(BUILD)&&E.SCHEMA===55&&STEPS.at(-1).n===55,'R85 build, save stays 55');
const CL=D.changelog.entries; ok(CL.some((e,i)=>e.build==='R85'&&e.items.length>=2&&CL[i+1].build==='R84'),'changelog leads with R85');
const ui=src('js/ui/coach-ui.js'), css=src('style.css');
ok(/export const tabTitle/.test(ui)&&/tourtabn/.test(ui),'card names the tab');
ok(/tourdim/.test(ui)&&/clip-path:path\(evenodd/.test(ui)&&/\.tourwrap \.tourmask\{background:transparent\}/.test(css)&&/\.tourwrap\.nocut \.tourmask\{background:#0009\}/.test(css),'dim has cut-outs, with a plain fallback');
ok(/tourhole tourtab|"tourtab"/.test(ui)&&/\.tourhole\.tourtab\{[^}]*animation:tourpulse/.test(css)&&/@keyframes tourpulse/.test(css)&&/prefers-reduced-motion/.test(css),'tab ring pulses (and respects reduced motion)');
ok(/body\.touring #subtabs\{position:sticky;top:0/.test(css)&&/classList\.add\("touring"\)/.test(ui)&&/classList\.remove\("touring"\)/.test(ui),'strip pinned only during a tour');
ok(/hit\(pa, ?q|cost\(pa\)/.test(ui)&&/\*\s*20/.test(ui),'card placement avoids the tab rings');
ok(/tries < 3/.test(ui),'scroll retried up to 3 times per stop');
ok(/st\.sel !== "#allbtn"/.test(ui),'the All-arrow stop does not ring a tab');
// every tab a tour stop opens has a name for the card and sits in a group
const tabs=new Set(); for(const c of CHAPTERS) for(const st of c.stops) if(st.tab) tabs.add(st.tab);
ok(tabs.size>=8,'tour stops open '+tabs.size+' tabs');
for(const t of tabs){ ok(VIEWS[t],'view exists for stop tab '+t); ok(GROUPS.some(g=>g[0]===groupOfView(t)),'group for '+t); }
console.log('r85 ok',pass);
