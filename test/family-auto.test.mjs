// Auto Tend, Auto Equip, heirloom refund (save step 22), deeds and the dragon
import fs from 'fs'; import * as E from '../js/engine.js';
const L=n=>JSON.parse(fs.readFileSync(new URL('../data/'+n+'.json',import.meta.url)));
const D={};for(const n of ['fields','skills','classes','traits','buildings','furniture','items','quests','regions','tuning','nodes','towns','minions','guilds','jobs','activities','estate','crafting','map','dungeons','legacy','chronicle','achievements','events','encounters','seasons','tutorial','notify','marriage','phases','intros','gear','paths','world','metals'])D[n]=L(n);
for(const f of D.estate.structureFiles)D['structures/'+f]=L('structures/'+f);
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
// Family automation (R29): Auto Orders / Advance / Upbringing / Courtship
const T=D.tuning, Y=T.yearDays||360;
const mk=(s,age,o={})=>{const m=E.newMember(s,{gender:o.g||'m',age,parents:o.parents||null});m.ageDays=age*Y;s.members.push(m);return m;};
const fresh=()=>{const s=E.newGame(1);E.normalize(s);E.skipTutorial&&E.skipTutorial(s);s.members[0].ageDays=30*Y;s.legacy.renown=1e4;s.res.coin=1e4;return s;};
const day=(s,d)=>{s.day=d;E.familyAutoDay(s);};
ok(['orders','advance','kids','court'].every(k=>{const u=D.legacy.upgrades.find(x=>x.id==='fa_'+k);return u&&u.free===1&&u.tiers[0].cost>=100&&u.tiers[0].cost<=150&&u.tiers[1].cost===u.tiers[0].cost*3;}),'R37: four free Family Auto upgrades, tiers 100-150 / x3');
// not owned: nothing happens (old saves unchanged)
{ const s=fresh(); const a=mk(s,20); a.order=null; day(s,30); ok(a.order&&a.order.type,'R37: free Family Orders give an order with nothing bought'); }
// Auto Orders
{ const s=fresh(); const a=mk(s,20); a.order=null; E.buyLegacy(s,'fa_orders'); ok(E.faOn(s,'orders'),'on by default once bought');
  day(s,30); ok(a.order&&a.order.type,'idle adult gets an order'); ok(s.log.some(l=>/🤖 Auto Orders/.test(l.msg)),'choice logged');
  ok(!s.members[0].order||s.members[0].order.type!=='auto','active member untouched');
  const act=s.members.find(m=>m.id===s.activeId); const before=JSON.stringify(act.order); day(s,60); ok(JSON.stringify(act.order)===before,'never the active member');
  E.setOrder(s,a.id,{type:'rest'}); day(s,90); ok(a.order.type==='rest'&&E.pinned(a,'order'),'hand-set order pinned');
  E.unpin(s,a.id,'order'); day(s,120); ok(a.order.type!=='rest','unpinned: automation resumes');
  const b=mk(s,22); b.order=null; b.noAutoEq=true; day(s,150); ok(!b.order,'excluded member skipped');
  E.toggleAuto(s,'fam_orders'); ok(!E.faOn(s,'orders'),'toggle off'); }
// Auto Advance: guild join, reserve
{ const s=fresh(); E.buyLegacy(s,'fa_advance'); const a=mk(s,20); a.stats.STR=10; a.skills.swordsmanship.lvl=8; a.cls=null; a.guild=null;
  s.res.coin=1000; day(s,30); ok(a.guild&&a.guild.id==='vanguard'&&a.cls==='fighter','joins the guild that fits and gets its class');
  ok(s.log.some(l=>/🤖 Auto Advance/.test(l.msg)),'advance logged');
  const b=mk(s,20); b.stats.STR=10; b.skills.swordsmanship.lvl=8; b.cls=null; b.guild=null; s.res.coin=120; day(s,60); ok(!b.guild&&s.res.coin===120,'25% coin reserve kept (100 of 120 would break it)');
  const c=D.classes.find(x=>x.from==='fighter'); if(c){ const opts=D.classes.filter(x=>x.from==='fighter'); a.prefCls=opts[opts.length-1].id; for(const [k,v] of Object.entries(opts[opts.length-1].req||{})) if(a.skills[k]) a.skills[k].lvl=v+5; else if(a.stats[k]!=null) a.stats[k]=v+5; s.res.coin=1e5; a.guild.rep=1e6; for(let i=1;i<20&&a.cls==='fighter';i++) day(s,60+30*i); ok(a.cls===a.prefCls||a.cls!=='fighter','evolves (preference honoured when eligible)'); } }
// Auto Upbringing
{ const s=fresh(); const p=s.members[0]; p.guild={id:'collegium',rank:0,rep:0}; E.buyLegacy(s,'fa_kids'); const k=mk(s,6,{parents:[p.id]}); k.parents=[p.id];
  ok(E.kidSkill(s,k)&&k.track==='collegium','child follows the parent guild track'); const xs=new Set(); for(let i=0;i<6;i++){k.ageDays++;xs.add(E.kidSkill(s,k));} ok([...xs].every(x=>D.legacy.familyAuto.tracks.collegium.includes(x)),'lessons come from the track');
  E.setTrack(s,k.id,'lodge'); ok(k.track==='lodge'&&E.pinned(k,'track'),'hand-set track pinned'); k.noAutoEq=true; ok(E.kidSkill(s,k)===null,'excluded child: random lessons'); }
// Auto Courtship
{ const s=fresh(); E.buyLegacy(s,'fa_court'); delete s.autoOff.fam_court; for(let i=0;i<4;i++)s.structures.push({uid:'bx'+i,type:'shack',pieces:['bunk','bunk'],up:0});
  const a=mk(s,22); a.order=null; const su=E.makeSuitor(s,{}); su.house=null; su.affinity=0; s.suitors=[su];
  day(s,7); ok(a.order&&a.order.type==='court'&&a.order.target===su.id&&a.faCourt,'unmarried adult courts the best suitor');
  const head=s.members.find(m=>m.id===s.head); ok(!head||head.id===s.activeId||!head.faCourt,'Head off by default');
  su.affinity=100; const n=s.members.length; day(s,14); ok(a.spouse&&s.members.length===n+1&&!a.faCourt,'marries in at 100 affinity'); ok(a.order&&a.order.type==='work','order reset to work, never null');
  ok(s.log.some(l=>/🤖 Auto Courtship: .* married/.test(l.msg)),'marriage logged');
  ok(!s.log.some(l=>/married out|marries out/i.test(l.msg)),'never marries out');
  const b=mk(s,24); b.order=null; const su2=E.makeSuitor(s,{}); su2.house='hx'; s.houses={hx:{r:-100,state:'war'}}; s.suitors=[su2]; day(s,21); ok(!b.faCourt,'never a feuding house'); }
// save step 29: old orders pinned; at_all bundle converted
{ const s=fresh(); const a=mk(s,20); a.order={type:'quest',target:'outskirts'}; s.legacy.ups={at_all:2}; s.schema=28; E.normalize(s);
  ok(E.pinned(a,'order'),'migration pins existing orders'); const r0=s.legacy.renown; ok(!s.legacy.ups.at_all&&!s.legacy.ups.at_farming&&s.legacyRefund&&s.legacyRefund.amt===5090,'old buy-all bundle becomes single tiers, then refunded in full at v37 (5090)'); }
console.log('family-auto: '+pass+' passed');
