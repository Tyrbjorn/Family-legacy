import fs from 'fs'; import * as E from '../js/engine.js';
const L=n=>JSON.parse(fs.readFileSync(new URL('../data/'+n+'.json',import.meta.url)));
const D={};for(const n of ['skills','classes','traits','buildings','furniture','items','quests','regions','tuning','nodes','towns','minions','guilds','jobs','activities','estate','crafting','map','dungeons','legacy','chronicle','achievements','events','encounters','seasons','tutorial','notify','marriage','phases','intros','gear','paths','world'])D[n]=L(n);
E.setData(D); let seed=11; E.setRng(()=>{seed=(seed*16807)%2147483647;return seed/2147483647;});
let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const ES=D.estate, all=[...ES.pieces,...D.furniture];
const home=['shack','cabin','house','mansion','fort','towerkeep','abbey'];
// data rules
ok(all.filter(p=>!p.mergedInto).every(p=>p.desc&&p.desc.length>3),'every item has a one-line effect');
ok(all.every(p=>E.pieceSlots(p.id)===1&&E.pieceSlots(p.id+'@3')===1),'every item costs 1 slot at any tier');
ok(ES.structures.filter(d=>!home.includes(d.id)&&d.allowed).every(d=>d.allowed.length<=4),'non-home buildings offer at most 4 slot items');
ok(['cradle','featherbed','minionbunk'].every(id=>E.pieceDef(id).id==='bunk')&&E.pieceDef('coldcellar').id==='larder','merged items resolve to their new item');
ok(home.every(id=>E.structDef(id).allowed.includes('studycorner')),'Study Corner placeable in every home');
// bed by placement
const s=E.newGame(1_700_000_000_000); E.active(s).ageDays=20*360; E.normalize(s); Object.assign(s.res,{coin:1e6,wood:1e5,stone:1e5,planks:1e4,blocks:1e4,ingots:1e4});
for(const l of ES.lands) E.buyLand(s,l.id);
const h=E.buildStructure(s,'shack'); const b0=E.bedrooms(s), f0=E.housingCap(s,'bunk');
ok(E.placePiece(s,h.uid,'bunk')&&E.bedrooms(s)>b0&&E.housingCap(s,'bunk')===f0,'Bed in a home = family bed');
ok(E.placePiece(s,h.uid,'bunk'),'Beds stack');
const bh=E.buildStructure(s,'bunkhouse'); const f1=E.housingCap(s,'bunk'), b1=E.bedrooms(s);
ok(E.placePiece(s,bh.uid,'bunk')&&E.housingCap(s,'bunk')>f1&&E.bedrooms(s)===b1,'Bed in a Bunkhouse = follower beds');
ok(E.placeIssue(s,h.uid,'cradle')&&E.placeIssue(s,h.uid,'hourglass'),'merged/fitting items cannot be placed as slot items');
// fittings
ok(E.fittingOptions(h).some(f=>f.id==='hourglass')&&E.buyFitting(s,h.uid,'hourglass')&&h.fittings.includes('hourglass')&&E.fittingIssue(s,h.uid,'hourglass')==='owned','fittings bought once, no slot');
ok(E.hasPiece(s,'hourglass'),'fitting counts as owned for effects');
// demolish bed check
const fam=E.living?E.living(s).length:s.members.length;
const ext=s.members.length; for(let i=0;i<E.bedrooms(s)-ext;i++) s.members.push({...JSON.parse(JSON.stringify(s.members[0])),id:500+i});
ok(/beds/.test(E.demolishIssue(s,h.uid)||''),'demolishing the only home is blocked (family beds)');
E.addMinion(s,'laborer','t');
let nm=0; while(E.addMinion(s,'laborer','t')&&nm<40)nm++;
ok(/follower/.test(E.demolishIssue(s,bh.uid)||''),'demolishing a full Bunkhouse is blocked (follower beds)');
// fort upgrade blocked if family would lack beds
ok(/beds/.test(E.typeBedIssue(s,h,'fort')||''),'turning the only home into a Fort is blocked when family lacks beds');
// migration
const o=E.newGame(1_700_000_000_000); E.normalize(o);
o.structures=[{uid:'a',type:'shack',pieces:['cradle','featherbed@2','bookshelf','trophy','forge'],up:0},{uid:'b',type:'smithy',pieces:['forge','runedanvil'],up:0}]; o.pieceStore=['mirror','minionbunk'];
const raw=JSON.parse(E.serialize(o,1_700_000_000_000)); raw.schema=13; raw._norm=false; E.normalize(raw);
const ha=raw.structures.find(x=>x.uid==='a'), sb=raw.structures.find(x=>x.uid==='b');
ok(ha.pieces.filter(p=>p.startsWith('bunk')).length===2&&ha.pieces.includes('bunk@2'),'cradle/featherbed → Bed (tier kept)');
ok(ha.pieces.includes('studycorner'),'bookshelf → Study Corner');
ok(ha.fittings.includes('trophy')&&ha.fittings.includes('mirror'),'stat items become home fittings (incl. from storage)');
ok(sb.fittings.includes('runedanvil'),'Rune Anvil becomes a Smithy fitting');
ok(raw.pieceStore.includes('forge')&&!ha.pieces.includes('forge'),'disallowed items go to storage');
ok(raw.pieceStore.includes('bunk'),'stored merged items remapped');
console.log(pass+' furniture tests passed');
