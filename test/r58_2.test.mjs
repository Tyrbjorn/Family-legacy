// R58.2: ores = neutral rock + metal-tinted veins; ingots/metals stay tinted bars; fallbacks intact.
import fs from "fs"; import * as E from "../js/engine.js"; import { BUILD } from "../js/config.js"; import { iconHtml } from "../js/art.js";
const ROOT=new URL("../",import.meta.url).pathname; let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const A=JSON.parse(fs.readFileSync(ROOT+'data/art.json')), C=JSON.parse(fs.readFileSync(ROOT+'data/changelog.json'));
ok(+BUILD.slice(1)>=58.2&&E.SCHEMA===53,'R58.2+, SCHEMA 53'); ok(C.entries.some(e=>e.build==='R58.2'),'changelog');
const ores={ore:'iron',copperore:'copper',tinore:'tin',silverore:'silver',goldore:'gold',mithrilore:'mithril',adamantore:'adamantium'};
for(const [k,m] of Object.entries(ores)){const h=iconHtml(A,'res',k,null,{emoji:'⛏️'});
 ok(h.includes('ore-rock.webp')&&h.includes('ore-veins.webp'),k+' two layers');
 ok(h.includes(((A.veinPal||{})[m])||A.palettes[m].base),k+' veins tinted '+m);
 ok(!/background:[^;]*;-webkit-mask-image:url\(art\/icons\/ore-rock/.test(h),k+' rock untinted');
 ok(iconHtml(A,'res',k,null,{emoji:'⛏️',classic:true})==='⛏️',k+' classic');}
ok(A.veinPal.iron!==A.palettes.iron.base,'iron veins brightened (ore only)');
for(const k of ['ingots','copper','tin','bronze','steel','silver','gold','mithril','adamantium'])ok(iconHtml(A,'res',k,null,{emoji:'x'}).includes('ingot.webp'),k+' bar');
for(const f of ['ore-rock','ore-veins']){const p=ROOT+'art/icons/'+f+'.webp';ok(fs.existsSync(p)&&fs.statSync(p).size<20000,f);}
ok(iconHtml(A,'res','ore',null,{emoji:'⛏️'}).includes('onerror'),'emoji fallback on load error');
console.log('r58.2 ok',pass);
