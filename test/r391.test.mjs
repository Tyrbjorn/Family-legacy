// R39.1: tester play pass links + What's new
import fs from 'fs'; import * as E from '../js/engine.js'; import { BUILD } from '../js/config.js';
const R=new URL('../data/',import.meta.url).pathname, D={};
for(const f of fs.readdirSync(R).filter(f=>f.endsWith('.json')))D[f.slice(0,-5)]=JSON.parse(fs.readFileSync(R+f));
for(const f of D.estate.structureFiles)D['structures/'+f]=JSON.parse(fs.readFileSync(R+'structures/'+f+'.json'));
E.setData(D); let pass=0; const ok=(c,m)=>{if(!c){console.error('FAIL',m);process.exit(1);}pass++;};
const store=()=>{const m=new Map();return{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),_m:m};};
ok(BUILD==='R39.1','build R39.1');
ok(D.testers.tokens.length===5&&D.testers.tokens.map(t=>t.token).join()==='tester1,tester2,tester3,tester4,tester5','5 placeholder tokens');
ok(fs.readFileSync(new URL('../js/main.js',import.meta.url),'utf8').includes('"testers"'),'testers.json loaded via names list');
// link turns pass on, stored in its own key
{ const st=store(); ok(!E.initPlayPass(st,null).on&&!E.hasPlayPass(),'no link: no pass');
  const r=E.initPlayPass(st,'tester3'); ok(r.on&&r.name==='Tester 3'&&r.changed==='on'&&st.getItem(E.PASS_KEY)==='tester3','?tester=tester3 turns pass on');
  ok(E.hasPlayPass()&&E.contentUnlocked({paid:true})&&E.contentUnlocked({}),'pass unlocks paid content');
  ok(!E.devOn(),'play pass is not Dev Mode');
  ok(E.initPlayPass(st,null).on,'pass remembered on next load without the link');
  ok(E.initPlayPass(st,' TESTER3 ').on,'token match ignores case/space');
  ok(E.badgeShown(st),'badge shown by default'); E.setBadge(st,false); ok(!E.badgeShown(st)&&E.hasPlayPass(),'badge hideable, pass stays'); E.setBadge(st,true); ok(E.badgeShown(st),'badge back');
  // retire: remove token from data
  const keep=D.testers.tokens; D.testers.tokens=keep.filter(t=>t.token!=='tester3');
  const x=E.initPlayPass(st,null); ok(!x.on&&x.changed==='off'&&st.getItem(E.PASS_KEY)===null&&!E.hasPlayPass(),'retired token turns pass off on next load');
  ok(!E.contentUnlocked({paid:true})&&E.contentUnlocked({}),'without pass: paid locked, free open');
  ok(E.initPlayPass(st,'tester3').changed==='bad'&&!E.hasPlayPass(),'retired link no longer works'); D.testers.tokens=keep; }
{ const st=store(); ok(E.initPlayPass(st,'nope').changed==='bad'&&!E.hasPlayPass()&&st.getItem(E.PASS_KEY)===null,'bad token ignored'); }
// never in saves/exports
{ const st=store(); E.initPlayPass(st,'tester1'); const s=E.newGame(1); E.normalize(s); const txt=E.serialize(s); ok(!/tester1|fl-pass|playPass/i.test(txt),'pass not in the save'); E.clearPlayPass(st); ok(!E.hasPlayPass(),'clear'); }
// What's new
{ const L=E.changelog(); ok(L[0].build===BUILD,'newest changelog entry = BUILD'); ok(['R36','R37','R38','R39'].every(b=>L.some(e=>e.build===b&&e.items.length)),'covers R36-R39');
  ok(L.every(e=>e.items.every(i=>!/\b(js|json|function|undefined)\b/.test(i))),'plain language (no code words)');
  const st=store(); ok(E.whatsNewDue(st,BUILD,false),'existing player: due'); ok(E.whatsNewEntries(st).length===L.length,'unknown last build: all entries');
  E.markWhatsNewSeen(st,BUILD); ok(!E.whatsNewDue(st,BUILD,false),'shown once per update');
  st.setItem(E.SEEN_KEY,'R38'); ok(E.whatsNewDue(st,BUILD,false)&&E.whatsNewEntries(st).map(e=>e.build).join()==='R39.1,R39','only entries since last seen');
  ok(E.whatsNewEntries(st,true).length===L.length,'reopen shows all');
  const f=store(); ok(!E.whatsNewDue(f,BUILD,true)&&f.getItem(E.SEEN_KEY)===BUILD,'brand-new player skips it'); }
// release channel: Dev Mode locked off, tester links still work
{ ok(D.build.channel==='dev','source stays on the dev channel');
  const st=store(); let r=E.resolveDevMode(st,'1'); ok(r.on&&r.reveal&&E.devOn()&&st.getItem(E.DEV_KEY)==='1','dev build: ?dev=1 works');
  r=E.resolveDevMode(st,'0'); ok(!r.on&&!E.devOn(),'dev build: ?dev=0 disables');
  D.build.channel='release'; E.setData(D); st.setItem(E.DEV_KEY,'1');
  r=E.resolveDevMode(st,'1'); ok(!r.on&&r.locked&&!E.devOn()&&E.devLocked()&&st.getItem(E.DEV_KEY)===null,'release build ignores ?dev=1 and wipes stored flag');
  E.setDevMode(true); ok(!E.devOn(),'release: Dev Mode cannot be switched on');
  const s=E.newGame(1); E.normalize(s); const c0=s.res.coin; ok(!E.devCheat(s,'coin')&&s.res.coin===c0,'release: cheats do nothing');
  ok(E.initPlayPass(store(),'tester2').on&&E.contentUnlocked({paid:true}),'release: tester link still works');
  D.build.channel='dev'; E.setData(D); }
console.log('r391 ok',pass);
