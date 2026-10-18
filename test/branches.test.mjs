import fs from 'fs'; import * as E from '../js/engine.js';
const L=n=>JSON.parse(fs.readFileSync(new URL('../data/'+n+'.json',import.meta.url)));
const D={};for(const n of ['fields','skills','classes','traits','buildings','furniture','items','quests','regions','tuning','nodes','towns','minions','guilds','jobs','activities','estate','crafting','map','dungeons','legacy','chronicle','achievements','events','encounters','seasons','tutorial','notify','marriage','families','phases','intros','gear','paths','world','metals'])D[n]=L(n);
for(const f of D.estate.structureFiles)D['structures/'+f]=L('structures/'+f);
E.setData(D); let seed=11; E.setRng(()=>{seed=(seed*16807)%2147483647;return seed/2147483647;});
let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const s=E.newGame(1_700_000_000_000); const f=E.active(s); f.ageDays=20*D.tuning.daysPerYear; E.normalize(s);
const rich=()=>{const ks=new Set(['coin']);for(const d of D.estate.structures){for(const k in d.cost||{})ks.add(k);for(const u of d.upgrades||[])for(const k in u.cost)ks.add(k);}for(const k of ks) s.res[k]=(s.res[k]||0)+1e5;}; rich();
['plot','acre','meadow'].forEach(l=>E.buyLand(s,l)); for(const l of D.estate.lands) E.buyLand(s,l.id);
const B=['mansion','fort','towerkeep','abbey'];
ok(B.every(id=>{const d=E.structDef(id);return d.upgradeFrom==='house'&&d.land===3&&d.slots===8&&d.level===4&&d.branch;}),'four tier-4 branches after House, 3 land, 8 slots');
ok(E.upgradeOptions('house').length===4&&E.upgradeOptions('cabin').length===1,'House has 4 options, Cabin 1');
const h=E.buildStructure(s,'shack'); ok(E.upgradeStructure(s,h.uid)&&E.upgradeStructure(s,h.uid)&&h.type==='house','shack→cabin→house');
for(const id of B) ok(E.upgradeIssue(s,h.uid,id),'locked without reqs: '+id+' ('+E.upgradeIssue(s,h.uid,id)+')');
// Manor branches (Oct 16): Manor-stage estate + Established phase (+ Trading Post for the Mansion)
const w=E.buildStructure(s,'warehouse'); E.upgradeStructure(s,w.uid);
ok(/Manor estate/.test(E.upgradeIssue(s,h.uid,'mansion')),'mansion needs a Manor estate ('+E.upgradeIssue(s,h.uid,'mansion')+')');
s.buildings.farm=(s.buildings.farm||0)+80; s.renown=Math.max(s.renown,400);
ok(E.estateStage(s)!=='Homestead'&&!E.upgradeIssue(s,h.uid,'mansion'),'mansion unlocked ('+E.upgradeIssue(s,h.uid,'mansion')+')');
const slots0=E.routeSlots(s), p0=E.townSellPrice(s,'millbrook','wood'), land0=E.landUsed?E.landUsed(s):0;
ok(E.upgradeStructure(s,h.uid,'mansion')&&h.type==='mansion','built mansion');
ok(E.routeSlots(s)===slots0+1,'mansion +1 route slot'); ok(E.townSellPrice(s,'millbrook','wood')>p0,'mansion +sell price');
// Fort: fighter line + Guardhouse up 3; reqs on ONE member
const g=E.buildStructure(s,'barracks'); for(let i=0;i<3;i++) E.upgradeSpecial(s,g.uid);
ok(/class/.test(E.respecIssue(s,h.uid,'fort')),'fort needs warrior line');
const m2={...JSON.parse(JSON.stringify(f)),id:9999,cls:'knight'}; s.members.push(m2); f.cls=null;
ok(!E.respecIssue(s,h.uid,'fort'),'knight (fighter line) unlocks fort');
// respec: refund half old cost, pay full new
const c0=s.res.coin, cm=E.structDef('mansion').cost.coin, cf=E.structDef('fort').cost.coin;
ok(E.respecStructure(s,h.uid,'fort')&&h.type==='fort'&&s.res.coin===c0+Math.floor(cm/2)-cf,'respec refunds half, pays full');
ok(E.routeSlots(s)===slots0,'mansion bonus gone'); const gp=E.eff(s,'guardPower'); ok(gp>=0.25&&E.eff(s,'banditCut')===0.25,'fort guard/bandit');
ok(E.housingCap(s,'bunk')>=4,'fort houses followers');
// Tower Keep: enchanting table built in
m2.cls='scholar'; rich(); const mt=E.buildStructure(s,'magestower'); for(let i=0;i<3;i++) E.upgradeSpecial(s,mt.uid);
ok(E.respecStructure(s,h.uid,'towerkeep')&&E.hasPiece(s,'enchtable'),'tower keep has enchanting table');
ok(E.xpMult(s,m2,'arcana')>E.xpMult(s,m2,'swordsmanship')-0.0001,'arcane xp boost');
// Abbey
m2.cls='priest'; rich(); const sh=E.buildStructure(s,'shrinehouse'); for(let i=0;i<3;i++) E.upgradeSpecial(s,sh.uid);
ok(E.respecStructure(s,h.uid,'abbey')&&!E.hasPiece(s,'enchtable')&&E.eff(s,'familyMorale')===2&&E.eff(s,'rest')>=1,'abbey morale/rest, keep table gone');
ok(E.respecIssue(s,h.uid,'abbey')==='already this','no respec to same');
// demolish
const st2=E.buildStructure(s,'shack'); s.pieceStore.push('larder'); E.placePiece(s,st2.uid,'larder',true);
const coin1=s.res.coin, wood1=s.res.wood, n=s.structures.length, store=s.pieceStore.length;
ok(E.demolishStructure(s,st2.uid)&&s.structures.length===n-1&&s.res.coin===coin1+20&&s.res.wood===wood1+7,'demolish refunds half');
ok(s.pieceStore.length===store+1,'furniture to storage');
{ const home=E.buildStructure(s,'shack'); s.pieceStore.push('bunk'); E.placePiece(s,home.uid,'bunk',true);
  const others=s.structures.filter(x=>x!==home); const keep=s.structures; s.structures=[home];
  while(E.living(s).length<E.bedrooms(s)) s.members.push({...JSON.parse(JSON.stringify(f)),id:5000+s.members.length});
  ok(/beds/.test(E.demolishIssue(s,home.uid)||'')&&!E.demolishStructure(s,home.uid),'demolish blocked: family beds');
  const bh=E.buildStructure(s,'bunkhouse'); s.minions=[{uid:'mz',type:'laborer',equip:{},name:'Z',job:'idle',loyalty:100,cls:'n_peasant'}];
  ok(E.isHoused(s,s.minions[0])&&/follower/.test(E.demolishIssue(s,bh.uid)||''),'demolish blocked: follower beds');
  s.minions=[]; ok(!E.demolishIssue(s,bh.uid),'ok when nobody needs it');
  s.structures=keep; s.members=s.members.filter(m=>m.id<5000); }
const pc=E.paidChain('abbey'); ok(pc.coin===40+200+600+3000,'chain cost');
ok(E.demolishStructure(s,h.uid)&&!s.structures.includes(h),'demolish manor');
const ser=E.deserialize(E.serialize(s,1_700_000_000_000)); ok(ser.structures.length===s.structures.length,'save ok');
console.log(pass+' branch checks passed');
