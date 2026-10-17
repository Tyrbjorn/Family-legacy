// Item stat lines: power role, quality, enchants, free slots, inlay, set, follower effects, gift; equip comparison.
import fs from 'fs'; import * as E from '../js/engine.js';
const R=new URL('../data/',import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const T=id=>E.itemStats(id).map(l=>l.t).join(' | ');
ok(/attack \+4 CP/.test(T('rusty_sword')),'weapon shows attack CP: '+T('rusty_sword'));
const arm=D.items.find(i=>i.slot==='armor'&&i.cp); ok(/defense \+\d+ CP/.test(T(arm.id))&&/fall risk/.test(T(arm.id)),'armor: defense + follower fall risk: '+T(arm.id));
ok(/follower farm work \+15%/.test(T('sickle')),'tool: follower job bonus: '+T('sickle'));
const Q=D.crafting.qualities.at(-1); ok(new RegExp(Q.name+' quality').test(T('c|iron_sword|'+Q.id)),'crafted quality shown');
ok(/Keen: \+4 CP/.test(T('iron_sword#keen')),'enchant effect shown: '+T('iron_sword#keen'));
const vig=T('c|'+arm.id+'|'+Q.id+'#vigor'); ok(/VIT \+1/.test(vig),'stat enchant shows VIT: '+vig);
const st=D.items.find(i=>i.set); ok(/2pc/.test(T(st.id)),'set bonuses shown');
const gift=D.items.find(i=>i.affinity); ok(/courtship/.test(T(gift.id)),'gift affinity shown');
ok(D.items.every(i=>E.itemStats(i.id).length>0),'every item shows at least one stat line');
const c=E.itemCompare({weapon:'rusty_sword'},'iron_sword'); ok(c.cur==='Rusty Sword'&&c.dcp===(E.itemDef('iron_sword').cp-4),'compare with equipped');
ok(E.itemCompare({},'iron_sword').cur===null,'compare with empty slot');
console.log(pass+' tests passed');
