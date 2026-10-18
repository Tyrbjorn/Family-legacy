// R37: free automation + Legacy panel
import fs from 'fs'; import * as E from '../js/engine.js'; import { T } from '../js/engine/state.js';
const R=new URL('../data/',import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const LG=D.legacy, up=id=>LG.upgrades.find(u=>u.id===id);
const fresh=()=>{const s=E.newGame(1);E.normalize(s);s.members[0].ageDays=20*360;return s;};
// data
ok(up('at_tend')&&up('at_tend').free===0.35&&up('at_tend').tiers.map(t=>t.cost+':'+t.value).join()==='300:0.55,900:0.75','Tireless Hands 35% free / 300 55% / 900 75%');
ok(!LG.upgrades.some(u=>/^at_(?!tend)/.test(u.id)),'per-skill Auto Tend upgrades removed');
ok(up('quotas').free===2&&up('quotas').tiers.map(t=>t.cost+':'+t.value).join()==='400:5,1200:999','quotas 2 free / 400 5 / 1200 unlimited');
for(const [k,a] of [['orders',150],['advance',150],['kids',100],['court',100]]) ok(up('fa_'+k).free===1&&up('fa_'+k).tiers[0].cost===a&&up('fa_'+k).tiers[1].cost===a*3,'fa_'+k+' '+a+'/'+a*3);
ok(up('tick').name==='Quick Hands','tick upgrade renamed Quick Hands');
ok(LG.upgrades.every(u=>LG.groups[u.group]),'every upgrade has a Legacy panel group');
const keep={speed:'50,150,400,1200',life:'40,100,250,600',resgain:'40,120,300,800',hall:'200',goodblood:'60,160,400',rareblood:'100,300,800',bloodline:'350',tithe:'150,400,900',tick:'60,180,500'};
for(const [k,c] of Object.entries(keep)) ok(up(k).tiers.map(t=>t.cost).join()===c,'non-automation upgrade unchanged: '+k);
ok(Object.values(LG.v37Refund.costs).flat().reduce((a,b)=>a+b,0)===7680,'refund table = 7,680 renown of R36 automation');
// free gates
{ const s=fresh(); ok(E.quotaSlots(s)===2,'2 quota slots free'); ok(E.faOn(s,'orders')&&E.faOn(s,'advance')&&E.faOn(s,'kids'),'family automation free and on'); ok(!E.faOn(s,'court'),'Matchmaker free but off by default');
  ok(E.atStatus(s,'smithing').locked&&/Smithing 1|by hand|forge|station/i.test(E.atStatus(s,'smithing').why),'locked automation says what is missing: '+E.atStatus(s,'smithing').why);
  ok(!/renown|⭐|\d+ ?coin/.test(E.atCats().map(k=>E.atStatus(s,k).why||'').join(' ')),'locked reasons never show a price'); }
// tiers add behaviour
{ const s=fresh(); s.legacy.renown=1e5; const a=E.newMember(s,{gender:'m',age:25}); s.members.push(a);
  ok(E.faTier(s,'advance')===0,'advance free tier'); ok(E.buyLegacy(s,'fa_advance')&&E.faTier(s,'advance')===1,'advance T1'); 
  ok(E.buyLegacy(s,'fa_orders')&&E.buyLegacy(s,'fa_kids')&&E.buyLegacy(s,'fa_court'),'buy family T1s');
  E.buyLegacy(s,'quotas'); ok(E.quotaSlots(s)===5,'Ledger T1 = 5'); E.buyLegacy(s,'quotas'); ok(E.quotaSlots(s)>99,'Ledger T2 = unlimited'); }
{ // tutor tier gates teen placement
  const s=fresh(); s.fog=false; const t=E.newMember(s,{gender:'f',age:0}); t.ageDays=15*360; t.lean=['lodge']; s.members.push(t); E.legacyState(s).ups.fa_kids=0;
  for(let d=0;d<31;d++){s.day++;E.familyAutoDay(s);} ok(!t.appr,'free Tutor does not place teens'); E.legacyState(s).ups.fa_kids=1; s.day=Math.ceil(s.day/30)*30-1; s.day++; E.familyAutoDay(s); ok(t.appr,'Tutor T1 places teens'); }
// quotas: paused beyond slots, ⚙ toggle
{ const s=fresh(); s.legacy.ups.quotas=1; for(const k of ['bread','planks','stew','cheese']) E.addQuota(s,k,10); s.legacy.ups.quotas=0; const L=E.quotaList(s);
  ok(L.length===4&&E.quotaPaused(s,L[2])&&!E.quotaPaused(s,L[1])&&/paused/.test(E.quotaStatus(s,L[3]).text),'quotas beyond 2 slots stay listed but pause');
  ok(E.openQuotas(s).every(q=>!E.quotaPaused(s,q)),'paused quotas never drive production'); E.toggleAuto(s,'quotas'); ok(E.openQuotas(s).length===0,'⚙ Auto off pauses all quotas'); }
// migration v37
{ const s=fresh(); s.schema=36; delete s.autoOff; Object.assign(E.legacyState(s).ups,{at_farming:2,at_cooking:1,at_arcane:2,fa_orders:1,fa_court:1,quotas:2,speed:2}); s.legacy.renown=10;
  E.normalize(s); const want=330+100+800+40+50+2400;
  ok(s.legacy.renown===10+want,'v37 full refund to banked renown ('+want+')'); ok(!s.legacy.ups.at_farming&&!s.legacy.ups.fa_orders&&!s.legacy.ups.quotas&&s.legacy.ups.speed===2,'old keys cleared; other upgrades kept');
  ok(s.legacyRefund&&s.legacyRefund.amt===want&&s.legacyRefund.suggest,'refund note with Tireless Hands suggestion'); ok(!(s.autoOff||{}).fam_court,'Matchmaker stays on when it had been bought'); ok(s.log.some(l=>/Legacy reworked/.test(l.msg)),'refund log line');
  const r=s.legacy.renown; E.refundV37(s); ok(s.legacy.renown===r,'re-running refunds nothing (idempotent)'); ok(E.SCHEMA>=37,'schema 37+'); }
{ const s=fresh(); s.schema=36; delete s.autoOff; E.normalize(s); ok(!s.legacyRefund&&s.autoOff.fam_court,'nothing bought: no refund, Matchmaker off'); }
// UI sources
const src=f=>fs.readFileSync(new URL('../js/ui/'+f,import.meta.url)).toString();
ok(!src('estate-tab.js').includes('h += legacyPanel()'),'Legacy list left the Estate tab'); ok(!/renown\)|Legacy shop/.test(src('automation-tab.js')),'Automation tab shows no prices');
ok(src('render.js').includes('legacy: ["🏛️"')&&src('common.js').includes('data-tab="legacy"'),'Legacy panel opened from the top bar');
ok(['estate-card.js','family-tab.js','minions-tab.js','estate-tab.js'].every(f=>src(f).includes('autoChip(')),'⚙ Auto chips on stations, Family, Minions, Quotas');
console.log('r37 ok',pass);
