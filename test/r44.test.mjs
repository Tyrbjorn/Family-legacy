import fs from "fs"; import * as E from "../js/engine.js"; import { BUILD } from "../js/config.js";
const R=new URL("../data/",import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const A=D.fields.animals;
const ST0=JSON.parse(JSON.stringify(D.estate.stages)); const at=name=>{const i=ST0.findIndex(x=>x[1]===name);D.estate.stages=ST0.map((x,j)=>[j<=i?0:1e9,x[1]]);};
const seeded=(()=>{let a=44;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};})(); E.setRng(seeded);
const U=id=>D.legacy.upgrades.find(u=>u.id===id);
const base=()=>{const s=E.newGame(1);E.normalize(s);s.land=['plot'];s.members[0].ageDays=20*D.tuning.daysPerYear;s.members[0].skills.smithing.lvl=10;s.res.coin=1e4;s.minions=[];return s;};
const forge=s=>s.structures.push({uid:'sm'+s.nextId++,type:'smithy',pieces:['forge'],up:0});
const AC=D.legacy.autoCraft, fol=(s,job,uid)=>{const mi={uid:uid||'f'+s.nextId++,type:'laborer',job,equip:{},name:'F'+job,loyalty:100,lvl:1,skills:{}};s.minions.push(mi);return mi;};
ok(/^R4\d/.test(BUILD)&&E.SCHEMA>=40,'R44+, save step 40+');
// Auto-craft line (data)
{ const u=U('autocraft'); ok(u&&u.group==='workshop'&&u.free===0&&u.tiers.map(t=>t.cost).join()==='50,180,500','Auto-craft: Workshop line, off free, 50/180/500');
  ok(AC.basicTools.farm==='sickle'&&AC.basicTools.craft==='smithhammer'&&AC.maxOpen.length===4,'basic tools + slots in data'); }
// tier 0: nothing
{ const s=base(); forge(s); fol(s,'farm'); ok(!E.acOn(s)&&E.acWants(s).length===0,'tier 0: Auto-craft off, wants nothing'); E.autoCraftDay(s); ok(E.orderList(s).length===0,'tier 0: no orders placed');
  ok(/locked/.test(E.acStatus(s).text),'status says locked'); }
// tier 1: basic tools
{ const s=base(); forge(s); s.res.planks=10; s.legacy.ups.autocraft=1; const a=fol(s,'farm'), b=fol(s,'farm'), c=fol(s,'gather');
  const w=E.acWants(s); ok(w.find(x=>x.item==='sickle').n===2&&w.find(x=>x.item==='woodaxe').n===1,'tier 1: a basic tool per follower with none (2 sickles, 1 axe)');
  E.autoCraftDay(s); const ao=E.orderList(s).filter(o=>o.auto); ok(ao.length===2&&ao.every(o=>o.auto),'placed as 🤖 auto orders');
  ok(E.autoSlots(s)===AC.maxOpen[1],'tier 1 slots from data');
  E.addOrder(s,'planks',5); E.addOrder(s,'ingots',5); ok(E.activeOrders(s).length===4,'auto orders use their own slots (2 mine + 2 auto all working)');
  E.autoCraftDay(s); ok(E.orderList(s).filter(o=>o.auto).length===2,'no duplicate auto orders');
  s.vault.push('sickle','sickle','woodaxe'); E.autoCraftDay(s); ok(a.equip.tool&&b.equip.tool&&c.equip.tool,'finished tools handed out (no Workshop needed)');
  ok(E.acWants(s).length===0,'everyone has a tool: nothing wanted');
  const o=E.orderList(s).find(o=>o.auto&&!E.orderDone(s,o)); if(o){E.removeOrder(s,o.id); ok(s.acSkip[o.item]>s.day,'cancelling an auto order holds it off for a while');} else ok(true,'skip');
}
{ const s=base(); s.legacy.ups.autocraft=1; fol(s,'farm'); ok(E.acWants(s).length===0,'no forge / no crafter: nothing wanted'); }
// tier 2: refit
{ const s=base(); forge(s); s.legacy.ups.autocraft=2; const m=s.members[0]; m.equip.weapon='rusty_sword';
  const w=E.acWants(s); const r=w.find(x=>/refit/.test(x.why)&&E.itemDef(x.item).slot==='weapon'); ok(r&&E.itemDef(r.item).cp>4,'tier 2: refit the starter weapon with something better');
  m.equip.weapon='iron_sword'; m.autoEq={}; ok(!E.acWants(s).some(x=>/refit/.test(x.why)&&E.itemDef(x.item).slot==='weapon'),'hand-picked gear left alone');
  m.equip.weapon='rusty_sword'; s.vault.push(r.item); E.autoCraftDay(s); ok(m.equip.weapon===r.item,'refit pass equips it (starter gear counts as replaceable)'); }
// tier 3: spare
{ const s=base(); forge(s); s.res.planks=10; s.legacy.ups.autocraft=3; const a=fol(s,'farm'); a.equip.tool='sickle';
  ok(E.acWants(s).some(x=>x.item==='sickle'&&x.why==='spare'),'tier 3: keeps 1 spare of a gear type in use');
  s.vault.push('c|sickle|fine'); ok(!E.acWants(s).some(x=>x.item==='sickle'&&x.why==='spare'),'a spare in the vault (any quality) is enough'); }
// pause when done: auto lines
{ const s=base(); forge(s); s.res.planks=10; s.legacy.ups.autocraft=1; fol(s,'farm'); E.autoCraftDay(s); const n=E.orderList(s).length;
  E.setAutoPwd(s,'ac'); fol(s,'gather'); E.autoCraftDay(s); ok(E.orderList(s).length===n&&E.acOn(s),'Auto-craft when done: finishes what is open, places nothing new');
  for(const o of E.orderList(s)) E.removeOrder(s,o.id); E.autoCraftDay(s); ok(!E.acOn(s)&&!E.autoPwd(s,'ac'),'…then switches itself off');
  E.toggleAuto(s,'ac'); ok(E.acOn(s),'switch back on'); }
{ const s=base(); s.members[0].skills.farming.lvl=1; s.members.forEach(m=>m.action=null); s.structures.push({uid:'fx',type:'fields',pieces:['furrows'],up:0}); ok(E.atOn(s,'farming'),'farming auto on '+E.atIssue(s,'farming'));
  E.setAutoPwd(s,'at_farming'); E.autoTendDay(s); ok(!E.atOn(s,'farming')&&!E.autoPwd(s,'at_farming'),'Auto Tend line pauses after its day of work');
  E.setAutoPwd(s,'at_farming'); E.toggleAuto(s,'at_farming'); ok(!E.autoPwd(s,'at_farming'),'toggling clears pause-when-done'); }
// pause when done: people
{ const s=base(); const m=E.newMember?null:null; const k=s.members[0]; s.members.push(JSON.parse(JSON.stringify(k))); const m2=s.members[1]; m2.id=999; m2.name='Bea Test'; s.activeId=k.id;
  m2.order={type:'work'}; E.setPauseWhenDone(s,'999'); ok(m2.pwd,'set by id (string from the UI)');
  E.tick?0:0; const snap=E.memberSnap(m2); E.memberPwdCheck(s,m2,snap,'work'); ok(m2.paused&&!m2.pwd&&m2.action.type==='rest','daily work: pauses after the day');
  E.resumePerson(s,999); ok(!m2.paused,'resume');
  m2.action={type:'craft',target:'r_sword',progress:2}; E.setPauseWhenDone(s,999); let sn=E.memberSnap(m2); m2.action.progress=3; E.memberPwdCheck(s,m2,sn,'craft'); ok(!m2.paused,'crafting: keeps going mid-item');
  sn=E.memberSnap(m2); m2.action.progress=0; E.memberPwdCheck(s,m2,sn,'craft'); ok(m2.paused,'…pauses once the item is made');
  m2.paused=false; const tr={type:'gather',target:'berries',progress:1}; m2.action=tr; E.setPauseWhenDone(s,999); sn=E.memberSnap(m2); E.memberPwdCheck(s,m2,sn,'gather'); ok(!m2.paused,'trip under way: keeps going');
  m2.action=null; E.memberPwdCheck(s,m2,sn,'gather'); ok(m2.paused,'…pauses when the trip ends');
  E.setOrder(s,999,{type:'work'}); ok(!m2.paused,'a new order resumes them'); }
{ const s=base(); const f=fol(s,'craft'); f.prog=0.5; E.setPauseWhenDone(s,f.uid); E.followerPwdCheck(s,f,0.4); ok(!f.paused,'follower mid-item keeps going'); f.prog=0; E.followerPwdCheck(s,f,0.9); ok(f.paused,'…then pauses');
  const g=fol(s,'farm'); E.setPauseWhenDone(s,g.uid); E.followerPwdCheck(s,g,0); ok(g.paused,'daily follower job pauses after the day'); E.resumePerson(s,g.uid); ok(!g.paused,'resume follower'); }
// auto from day 1: craft defaults
{ ok(['cooking','masonry','hunting','smithing','carpentry','tailoring','alchemy','arcane'].every(k=>D.legacy.autoTend[k].default&&E.recipeDef(D.legacy.autoTend[k].default)),'every craft category has a default recipe in data');
  const s=base(); ok(!E.atTarget(s,'smithing')&&/Forge/i.test(E.atIssue(s,'smithing')),'no forge: says what is missing');
  forge(s); const t=E.atTarget(s,'smithing'); ok(t&&t.id===D.legacy.autoTend.smithing.default&&t.dflt,'with a forge: smithing starts on its default from day 1');
  ok(E.atOwned(s,'smithing'),'and the line counts as running (no hand-made recipe needed)');
  s.atLast={'rc:smithing':'r_axe'}; ok(E.atTarget(s,'smithing').id==='r_axe','the last hand-made recipe still wins');
  const d0=D.legacy.autoTend.smithing.default; D.legacy.autoTend.smithing.default='r_hammer'; s.atLast={}; ok(E.atTarget(s,'smithing').id==='r_hammer','default is data-driven'); D.legacy.autoTend.smithing.default=d0;
  s.res.ingots=50; s.res.planks=50; s.res.copper=50; const v=s.vault.length; for(let i=0;i<20;i++)E.autoTendDay(s); ok(s.vault.length>v,'default recipe actually crafts at the free rate'); }
{ const s=base(); forge(s); s.legacy.ups.autocraft=1; fol(s,'farm'); ok(!E.acWants(s).length,'an input nobody can make (planks, no Saw Table) means no auto order'); }
{ const s=base(); s.revealed=E.D?s.revealed:s.revealed; s.revealed=(D.nodes||[]).map(n=>n.id); E.addOrder(s,'copperore',5); E.quotaDay(s); let err=null; try{E.autoTendDay(s);}catch(e){err=e;} ok(!err,'auto gathering with an order for a skill-gated resource does not crash (R43 bug)'); }
console.log(pass+' checks passed');
