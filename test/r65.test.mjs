// R65 ART-4 batch4: resource icons, layer2 lists (bowl fill+steam, meat bone), our palettes, coal stays emoji, Classic off-switch
import fs from "fs"; import * as E from "../js/engine.js"; import { BUILD } from "../js/config.js"; import { iconHtml } from "../js/art.js";
const ROOT=new URL("../",import.meta.url).pathname; let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const A=JSON.parse(fs.readFileSync(ROOT+'data/art.json')), C=JSON.parse(fs.readFileSync(ROOT+'data/changelog.json'));
ok(+BUILD.slice(1)>=65&&E.SCHEMA===55,'R65+, no save change'); ok(C.entries.some(e=>e.build==='R65'),'changelog');
const files=new Set();for(const s of Object.values(A.sprites)){files.add(s.file);for(const l of [].concat(s.layer2||[]))files.add(l.file||l);}
let kb=0;for(const f of files){ok(fs.existsSync(ROOT+f),'file '+f);if(/batch4/.test(JSON.stringify(Object.values(A.sprites).find(s=>s.file===f)||{}))||1)kb+=fs.statSync(ROOT+f).size;}
const b4=['block','clump','sheaf','gem-rough','gem-rough-shine','gem-cut','gem-cut-shine','pearl','mug','mug-drink','bottle','bottle-liquid','jar','jar-fill','vial','vial-liquid','sack','bowl','bowl-fill','bowl-steam','meat','meat-bone','fish','egg','bread','cheese','pie','vegetables','berries','mandrake','moonpetal','mushrooms','kelp','jug','salve','rope','dust','coin','runestone','idol','scale','amulet','crownband','crownstone','crowncrest'];
ok(b4.length===45,'45 files');let sz=0;for(const f of b4){const p=ROOT+'art/icons/'+f+'.webp';ok(fs.existsSync(p),f);sz+=fs.statSync(p).size;ok(fs.statSync(p).size<4096,f+' <4KB');}ok(sz<110000,'batch4 '+sz+' bytes');
for(const [id,s] of Object.entries(A.res)){ok(A.sprites[s],'res '+id+' sprite '+s);const t=(A.resTint||{})[id];if(t)ok(A.palettes[t]&&/^#[0-9a-f]{6}$/.test(A.palettes[t].base),'palette '+t);}
ok(!A.res.coal,'coal stays emoji');
const bowl=iconHtml(A,'res','stew',null,{emoji:'🍲'});
ok(bowl.indexOf('bowl.webp')<bowl.indexOf('bowl-fill.webp')&&bowl.indexOf('bowl-fill.webp')<bowl.indexOf('bowl-steam.webp'),'bowl order base, fill, steam');
ok(bowl.includes(A.palettes.stew.base)&&!/mask-image:url\(art\/icons\/bowl-steam/.test(bowl)&&!/mask-image:url\(art\/icons\/bowl\.webp/.test(bowl),'only the fill is tinted');
ok(iconHtml(A,'res','porridge',null,{}).includes(A.palettes.porridge.base),'porridge tint');
const meat=iconHtml(A,'res','smokedmeat',null,{emoji:'🥓'});
ok(/mask-image:url\(art\/icons\/meat\.webp/.test(meat)&&meat.includes(A.palettes.smoked.base)&&meat.indexOf('meat-bone')>meat.indexOf('meat.webp')&&!/mask-image:url\(art\/icons\/meat-bone/.test(meat),'meat tinted, bone untinted on top');
const ale=iconHtml(A,'res','ale',null,{});ok(ale.includes(A.palettes.oak.base)&&ale.includes(A.palettes.ale.base),'mug oak + ale');
ok(!/mask-image:url\(art\/icons\/vial\.webp/.test(iconHtml(A,'res','potions',null,{}))&&iconHtml(A,'res','potions',null,{}).includes(A.palettes.potion.base),'vial glass untinted, liquid tinted');
ok(!iconHtml(A,'res','bread',null,{}).includes('arttint'),'colour sprite untinted');
ok(iconHtml(A,'res','limeblocks',null,{}).includes(A.palettes.limestone.base),'limeblocks tinted');
ok(iconHtml(A,'res','marble',null,{}).includes('stone.webp')&&iconHtml(A,'res','marble',null,{}).includes(A.palettes.marble.base),'marble reuses stone');
for(const id of Object.keys(A.res))ok(iconHtml(A,'res',id,null,{emoji:'E',classic:true})==='E','classic '+id);
ok(iconHtml(A,'res','ore',null,{}).includes('ore-veins'),'ore unchanged');ok(iconHtml(A,'res','gold',null,{}).includes('ingot.webp'),'gold bar unchanged');
console.log('r65 ok',pass);
