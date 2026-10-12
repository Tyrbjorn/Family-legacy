// Pure game engine (no DOM). Works in browser and Node.
export const SAVE_VERSION = 1;
let D, T; // data, tuning
export function setData(d){ D=d; T=d.tuning; }
export const STATS=['STR','AGI','INT','WIL','CHA','VIT'];
const NAMES={m:['Aldric','Tobin','Bram','Corin','Edric','Fenn','Garret','Hale','Ivo','Joren','Kell','Lorn'],f:['Mara','Ysolde','Brina','Cela','Dara','Elsa','Faye','Greta','Hilde','Isla','Jessa','Lira']};
let rng=Math.random; export function setRng(f){rng=f;}
const r=a=>a[Math.floor(rng()*a.length)];
const Y=()=>T.daysPerYear;
export const ageY=m=>Math.floor(m.ageDays/Y());
export const xpNeed=l=>T.xpBase*Math.pow(T.xpGrowth,l);
const bl=(s,id)=>s.buildings[id]||0;
const furn=(s,k)=>effects(s);

function newMember(s,{gender,age,cls=null,parents=null,stats}={}){
  gender=gender||(rng()<.5?'m':'f');
  const m={id:s.nextId++,name:r(NAMES[gender]),gender,ageDays:(age||0)*Y(),alive:true,cls,
    stats:stats||Object.fromEntries(STATS.map(k=>[k,5])),skills:{},traits:[],spouse:null,parents,
    order:{type:'train',target:'swordsmanship'},action:null,injured:0,equip:{},bag:[],kids:0,lastChild:0,warned:false,diedDay:null};
  m.traits=pickTraits(2);
  m.lifespan=T.baseLifespan+traitSum(m,'life')+Math.round((rng()-.5)*8);
  for(const sk of D.skills) m.skills[sk.id]={lvl:0,xp:0};
  return m;
}
export const traitDef=id=>D.traits.find(t=>t.id===id);
export const conflicts=(a,b)=>{const x=traitDef(a),y=traitDef(b);return a===b||(x&&x.opposes===b)||(y&&y.opposes===a);};
export function pickTraits(n,have=[]){ const out=[...have]; const pool=[...D.traits].sort(()=>rng()-.5); for(const t of pool){ if(out.length>=n) break; if(!out.some(o=>conflicts(o,t.id))) out.push(t.id); } return out; }
export const traitSum=(m,k)=>m.traits.reduce((a,t)=>a+((traitDef(t)||{})[k]||0),0);
export function fixTraits(m){ const kept=[]; let changed=false; for(const t of m.traits){ if(!traitDef(t)||kept.some(k=>conflicts(k,t))){ changed=true; m.lifespan-=((traitDef(t)||{}).life||0); } else kept.push(t); }
  if(!changed) return false; m.traits=pickTraits(2,kept); for(const t of m.traits.slice(kept.length)) m.lifespan+=(traitDef(t).life||0); return true; }
export function newGame(now=Date.now()){ const _s=_newGame(now); _s.land=[]; _s.structures=[]; _s.pieceStore=[]; normalize(_s); return _s; }
function _newGame(now){
  const s={v:SAVE_VERSION,day:0,nextId:1,members:[],activeId:1,head:1,
    res:{coin:50,food:60,wood:0,stone:0,herbs:0},revealed:[],buildings:{},furniture:[],vault:['rusty_sword','padded_vest'],
    log:[],turbo:{charge:0,on:false},lastSave:now,reserve:{...DEFAULT_RESERVE},paused:[],forSale:[],saleProg:0,unlocks:[],doneQuests:[],specialGranted:[],minions:[],repLevel:0,gameOver:false,suitors:[],renown:0,deeds:[],acc:0,pendingClass:[]};
  for(const b of D.buildings) s.buildings[b.id]=b.start;
  const f=newMember(s,{age:15}); s.members.push(f);
  f.action={type:'train',target:'swordsmanship',progress:0};
  log(s,`🏡 ${f.name} founds the family estate.`);
  return s;
}
export function log(s,msg){ s.log.unshift({d:s.day,msg}); if(s.log.length>80) s.log.length=80; }
export const living=s=>s.members.filter(m=>m.alive);
export const active=s=>s.members.find(m=>m.id===s.activeId);
export const isAdult=m=>ageY(m)>=T.adultAge;
const cls=m=>D.classes.find(c=>c.id===m.cls);

export function lifeStageMult(m){const a=ageY(m);return a>=65?.75:a>=50?.9:1;}
export function statVal(m,k){
  let v=m.stats[k];
  for(const sk of D.skills) if(sk.stat===k) v+=m.skills[sk.id].lvl*0.2;
  if(['STR','AGI','VIT'].includes(k)) v*=lifeStageMult(m);
  return Math.round(v*10)/10;
}
export function level(m){return Math.floor(Object.values(m.skills).reduce((a,b)=>a+b.lvl,0)/5)+1;}
export function cp(s,m){
  const c=cls(m); let v=0;
  if(c){ v+=c.stats.reduce((a,k)=>a+statVal(m,k),0); v+=c.cpSkills.reduce((a,k)=>a+m.skills[k].lvl*2,0); v*=c.cpMult||1; }
  else v=(statVal(m,'STR')+statVal(m,'AGI'))/2;
  for(const id of Object.values(m.equip)){const it=itemDef(id); if(it) v+=it.cp||0;}
  v*=1+traitSum(m,'cp');
  return Math.round(v);
}
export function softCap(m){const c=cls(m);return T.softCap[c?c.tier:0];}
function xpMult(s,m,skillId){
  const sk=D.skills.find(x=>x.id===skillId); let mult=1;
  mult+=traitSum(m,'xp'); if(s.res.food>0) mult+=eff(s,'foodQuality');
  if(['lore','magic'].includes(sk.family)) mult+=m.skills.reading.lvl*0.01 + bl(s,'library')*0.02;
  for(const f of furn(s)){ if(f.bonus.skill===skillId) mult+=f.bonus.xp; if(f.bonus.family===sk.family) mult+=f.bonus.xp; }
  if(ageY(m)>=50) mult+=.1;
  if(s.res.food<=0) mult*=.5;
  for(const mg of guildsOf(m)){ const g=guildDef(mg.id); if(g.skills.includes(skillId)) mult+=0.05*(mg.rank+1); }
  mult+=Math.min(.2,minionPower(s,'tutor')*.05);
  return mult;
}
export function gainXp(s,m,skillId,amt){
  const k=m.skills[skillId]; if(!k) return;
  if(k.lvl>=softCap(m)) amt*=0.1;
  k.xp+=amt*xpMult(s,m,skillId);
  while(k.xp>=xpNeed(k.lvl)){k.xp-=xpNeed(k.lvl);k.lvl++; if(k.lvl%10===0) log(s,`⭐ ${m.name} reached ${D.skills.find(x=>x.id===skillId).name} ${k.lvl}.`);
    const before=level(m); if(level(m)>before){} }
  // stat point per level: auto-allocate to class stats
  const L=level(m); m._lv=m._lv||1; while(m._lv<L){m._lv++; const c=cls(m); const st=c?r(c.stats):r(STATS); m.stats[st]+=1;}
}
export const idleEff=s=>T.idleEff+bl(s,'yard')*0.05;
export const turboCapSec=s=>(T.turboCapMin+bl(s,'hourglass')*30)*60;
export const offlineCapSec=s=>(T.offlineCapHours+bl(s,'hourglass')*2)*3600;
const ES=()=>D.estate;
export const baseId=id=>String(id).split('@')[0];
export const pieceTier=id=>+(String(id).split('@')[1]||0);
export const pieceDef=id=>{ const b=baseId(id); return ES().pieces.find(p=>p.id===b)||D.furniture.find(p=>p.id===b); };
export const tierName=id=>ES().pieceTiers[pieceTier(id)].name;
export const structLevel=st=>structDef(st.type).level||1;
export const pieceMult=(st,id)=>ES().pieceTiers[pieceTier(id)].mult*(1+ES().levelBonus*(structLevel(st)-1));
const INTK=new Set(['beds']);
function scaleBonus(b,m){ const o={}; for(const[k,v]of Object.entries(b)){
  if(typeof v==='number') o[k]=INTK.has(k)?Math.floor(v*m+1e-9):v*m;
  else if(k==='jobs'||k==='housing') o[k]=Object.fromEntries(Object.entries(v).map(([j,n])=>[j,Math.floor(n*m+1e-9)]));
  else if(k==='process'||k==='processes') o.processes=[...(o.processes||[]),...[].concat(v).map(p=>({...p,rate:p.rate*m}))];
  else o[k]=v; } return o; }
export const scaledPiece=(st,id)=>{ const p=pieceDef(id); return p&&{...p,bonus:scaleBonus(p.bonus,pieceMult(st,id))}; };
const STAGE_ORDER=()=>ES().stages.map(x=>x[1]);
export function pieceLock(s,p){ const u=p.unlock; if(!u) return null;
  if(u.stage&&STAGE_ORDER().indexOf(estateStage(s))<STAGE_ORDER().indexOf(u.stage)) return 'estate tier '+u.stage;
  if(u.quest&&!s.doneQuests.includes(u.quest)) return 'quest: '+((D.quests.find(q=>q.id===u.quest)||{}).name||u.quest);
  if(u.guild&&!living(s).some(m=>{const g=memberGuild(m,u.guild);return g&&(g.rank||0)>=(u.rank||0);})) return ((guildDef(u.guild)||{}).name||u.guild)+' rank '+((u.rank||0)+1);
  return null; }
export function pieceUpIssue(s,uid,pid){ const st=s.structures.find(x=>x.uid===uid); if(!st||!st.pieces.includes(pid)) return 'missing'; const t=pieceTier(pid); const nx=ES().pieceTiers[t+1]; if(!nx) return 'max'; if(!afford(s,nx.cost)) return 'cannot afford'; return null; }
export function upgradePiece(s,uid,pid){ if(pieceUpIssue(s,uid,pid)) return false; const st=s.structures.find(x=>x.uid===uid); const t=pieceTier(pid)+1, nx=ES().pieceTiers[t]; pay(s,nx.cost); st.pieces[st.pieces.indexOf(pid)]=baseId(pid)+'@'+t; log(s,`🔧 ${pieceDef(pid).name} upgraded to ${nx.name}.`); return true; }
export const structDef=id=>ES().structures.find(x=>x.id===id);
const placed=s=>(s.structures||[]).flatMap(st=>st.pieces.map(id=>scaledPiece(st,id)).filter(Boolean));
export function activeSynergies(st){ return ES().synergies.filter(y=>y.pieces.every(p=>st.pieces.map(baseId).includes(p))); }
export const allSynergies=s=>(s.structures||[]).flatMap(st=>activeSynergies(st).map(y=>({...y,where:st.uid})));
// every placed piece + every active synergy, as {bonus} objects (old furniture code reads f.bonus)
const effects=s=>[...placed(s),...allSynergies(s)];
export const eff=(s,k)=>effects(s).reduce((a,f)=>a+(typeof f.bonus[k]==='number'?f.bonus[k]:0),0);
export const hasPiece=(s,id)=>(s.structures||[]).some(st=>st.pieces.map(baseId).includes(baseId(id)));
export const bedrooms=s=>1+eff(s,'beds');
export const hasLand=s=>(s.land||[]).length>0;
export const established=s=>hasLand(s)&&(s.structures||[]).length>0;
export const landSlots=s=>(s.land||[]).reduce((a,id)=>a+ES().lands.find(l=>l.id===id).slots,0);
export const landUsed=s=>D.buildings.reduce((a,b)=>a+(bl(s,b.id)>0?b.land:0),0)+(s.structures||[]).reduce((a,st)=>a+structDef(st.type).land,0);
export const foodCap=s=>ES().caps.foodBase+eff(s,'foodCap')+bl(s,'farm')*100;
export const matCap=s=>ES().caps.matBase+eff(s,'matCap');
export const craftQuality=s=>eff(s,'craftQuality');
export const buildingLevelName=(b,lv)=>b.name;
export function canBuyLand(s,id){ const l=ES().lands.find(x=>x.id===id); return !!l&&!(s.land||[]).includes(id)&&(!l.requires||s.land.includes(l.requires))&&afford(s,l.cost); }
export function buyLand(s,id){ if(!canBuyLand(s,id)) return false; const l=ES().lands.find(x=>x.id===id); pay(s,l.cost); s.land.push(id); log(s,`📜 Bought ${l.name} (+${l.slots} land slots).`); s.deeds.push(`Bought ${l.name}.`); return true; }
export function structIssue(s,type){ const d=structDef(type); if(!hasLand(s)) return 'buy land first'; if(landUsed(s)+d.land>landSlots(s)) return 'no free land slot'; if(!afford(s,d.cost)) return 'cannot afford'; return null; }
export function buildStructure(s,type){ if(structIssue(s,type)) return null; const d=structDef(type); pay(s,d.cost); const st={uid:'st'+(s.nextId++),type,pieces:[]}; s.structures.push(st); log(s,`🛖 Built a ${d.name} (${d.slots} slots).`); return st; }
export function upgradeIssue(s,uid){ const st=s.structures.find(x=>x.uid===uid); if(!st) return 'missing'; const nx=ES().structures.find(x=>x.upgradeFrom===st.type); if(!nx) return 'max'; if(landUsed(s)-structDef(st.type).land+nx.land>landSlots(s)) return 'no free land slot'; if(!afford(s,nx.cost)) return 'cannot afford'; return null; }
export function upgradeStructure(s,uid){ if(upgradeIssue(s,uid)) return false; const st=s.structures.find(x=>x.uid===uid); const nx=ES().structures.find(x=>x.upgradeFrom===st.type); pay(s,nx.cost); log(s,`🏗️ ${structDef(st.type).name} upgraded to ${nx.name}.`); st.type=nx.id; return true; }
export const freeSlots=(s,st)=>structDef(st.type).slots-st.pieces.length;
export function placeIssue(s,uid,pid,fromStore){ const st=s.structures.find(x=>x.uid===uid), p=pieceDef(pid); if(!st||!p) return 'missing'; if(freeSlots(s,st)<=0) return 'building full'; if(st.pieces.map(baseId).includes(baseId(pid))) return 'already here'; if(!fromStore&&pieceLock(s,p)) return '🔒 '+pieceLock(s,p); if(!fromStore&&!afford(s,p.cost)) return 'cannot afford'; if(fromStore&&!s.pieceStore.includes(pid)) return 'not in storage'; return null; }
export function placePiece(s,uid,pid,fromStore=false){ if(placeIssue(s,uid,pid,fromStore)) return false; const st=s.structures.find(x=>x.uid===uid), p=pieceDef(pid);
  if(fromStore) s.pieceStore.splice(s.pieceStore.indexOf(pid),1); else pay(s,p.cost); st.pieces.push(pid);
  const before=new Set(); log(s,`🪑 Placed ${p.name} in the ${structDef(st.type).name}.`); for(const y of activeSynergies(st)) if(y.pieces.includes(pid)) log(s,`✨ Synergy: ${y.name} (${y.desc}).`); return true; }
export function removePiece(s,uid,pid){ const st=s.structures.find(x=>x.uid===uid); if(!st||!st.pieces.includes(pid)) return false; st.pieces.splice(st.pieces.indexOf(pid),1); s.pieceStore.push(pid); return true; }
export function operatorLvl(s,skill){ if(!skill) return 0; const sp=ES().skillProcess; let b=0; for(const m of living(s)) if(isAdult(m)||ageY(m)>=12) b=Math.max(b,m.skills[skill]?.lvl||0);
  for(const mi of s.minions||[]) if(mi.job==='craft') b=Math.max(b,(mtype(mi.type).apt.craft||1)*sp.minionLvlPerApt); return b; }
export const skillSpeed=(s,p)=>1+ES().skillProcess.speedPerLvl*operatorLvl(s,p&&p.skill);
export const skillYield=(s,p)=>1+ES().skillProcess.yieldPerLvl*operatorLvl(s,p&&p.skill);
export const resTier=k=>+(Object.entries(ES().resourceTiers).find(([,t])=>t.res.includes(k))||[0])[0];
export const DEFAULT_RESERVE={wood:50,stone:50,ore:0,copperore:0,hides:0,herbs:0};
export const reserveOf=(s,k)=>((s.reserve||{})[k]||0);
export function setReserve(s,k,n){ if(!(k in DEFAULT_RESERVE)) return false; s.reserve[k]=Math.max(0,Math.floor(+n||0)); return true; }
const pkey=(uid,id)=>uid+':'+baseId(id);
export const isPaused=(s,uid,id)=>(s.paused||[]).includes(pkey(uid,id));
export function togglePiece(s,uid,id){ const k=pkey(uid,id); const i=s.paused.indexOf(k); if(i>=0) s.paused.splice(i,1); else s.paused.push(k); return i<0; }
function processDay(s,mul=1){ for(const st of s.structures||[]){ const syn=activeSynergies(st); for(const p of st.pieces.filter(id=>!isPaused(s,st.uid,id)).map(id=>scaledPiece(st,id))) for(const pr0 of (p&&p.bonus.processes)||[]){ const pr={...pr0,rate:pr0.rate*skillSpeed(s,p)}; const yl=skillYield(s,p);
  let n=pr.rate*mul*syn.reduce((a,y)=>a*((y.bonus.processMult||{})[pr.out]||1),1); for(const[k,v]of Object.entries(pr.in)) n=Math.min(n,Math.max(0,(s.res[k]||0)-reserveOf(s,k))/v); if(n<=0) continue;
  for(const[k,v]of Object.entries(pr.in)) s.res[k]-=v*n; s.res[pr.out]=(s.res[pr.out]||0)+n*yl; } } }
export const processRates=(s,st,pid)=>((scaledPiece(st,pid).bonus.processes)||[]).map(pr=>({out:pr.out,rate:Math.round(pr.rate*skillSpeed(s,pieceDef(pid))*skillYield(s,pieceDef(pid))*activeSynergies(st).reduce((a,y)=>a*((y.bonus.processMult||{})[pr.out]||1),1)*100)/100}));
export const processRate=(s,st,pid)=>{ const r=processRates(s,st,pid); return r.length?r[0].rate:0; };
export function jobCap(s,job){ if(job==='idle'||job==='guard') return Infinity; let c=placed(s).reduce((a,p)=>a+((p.bonus.jobs||{})[job]||0),0);
  if(job==='farm') c+=bl(s,'farm')*2+bl(s,'garden'); if(job==='gather') c+=bl(s,'lumber')*2; if(job==='tutor') c+=bl(s,'library'); return c; }
export function estateStage(s){ if(!hasLand(s)) return 'Landless'; const t=Object.values(s.buildings).reduce((a,b)=>a+b,0)+s.structures.reduce((a,st)=>a+structDef(st.type).slots/2+st.pieces.length,0); const STAGES=ES().stages; let n=STAGES[0][1];for(const[k,v]of STAGES)if(t>=k)n=v;return n;}
export const known=(s,x)=>!x.hidden||s.revealed.includes(x.id);
export function successChance(s,m,q){const c=cp(s,m);return Math.max(.1,Math.min(.98,0.5+(c-q.cp)/(q.cp+20)+Math.min(.15,minionPower(s,'guard')*.03)));}

function doAction(s,m,a,eff){
  if(!a) return;
  if(a.type==='train'){ gainXp(s,m,a.target,T.xpPerDay*eff); }
  else if(a.type==='work'){ const c=(4+level(m)*0.5+m.skills.haggling.lvl*0.2)*eff*(1+traitSum(m,'coin'))*(1+furn(s).reduce((x,f)=>x+(f.bonus.coin||0),0)); s.res.coin+=c; gainXp(s,m,'haggling',T.xpPerDay*.3*eff); }
  else if(a.type==='gather'){ const n=D.nodes.find(x=>x.id===a.target); if(!n){m.action=null;return;} const mul=(1+m.skills[n.skill].lvl*0.03)*eff; for(const[k,v]of Object.entries(n.res)) s.res[k]=(s.res[k]||0)+v*mul; gainXp(s,m,n.skill,T.xpPerDay*.6*eff); }
  else if(a.type==='craft'){ const rc=a.target?recipeDef(a.target):bestRecipe(s,m); if(!rc||recipeIssue(s,m,rc)){ if(!a.target) a.progress=0; return; } a.target=a.target||null; a.rc=rc.id;
    a.progress=(a.progress||0)+eff; gainXp(s,m,rc.skill,T.xpPerDay*.8*eff); if(a.progress>=rc.days){ a.progress=0; craftItem(s,m,rc,null); } }
  else if(a.type==='job'){ const j=D.jobs.find(x=>x.id===a.target); if(!j||!jobOk(m,j)){m.action=null;return;}
    s.res.coin+=(isAdult(m)?j.payAdult:j.payChild)*(1+level(m)*0.02)*eff*(1+traitSum(m,'coin'));
    for(const[k,v]of Object.entries(j.stats)) m.stats[k]+=v*eff; for(const k of j.skills) gainXp(s,m,k,T.xpPerDay*.5*eff); if(j.id==='shop') sellTick(s,eff*(1+m.skills.haggling.lvl*0.02)); }
  else if(a.type==='activity'){ const ac=D.activities.find(x=>x.id===a.target); if(!ac||!activityOk(s,m,ac)){m.action=null;return;}
    for(const[k,v]of Object.entries(ac.stats)) m.stats[k]+=v*eff; for(const k of ac.skills) if(canTrain(m,k,s,true)) gainXp(s,m,k,T.xpPerDay*.6*eff); if(ac.id==='fishing') s.res.food+=1*eff; }
  else if(a.type==='rest'){ m.injured=Math.max(0,m.injured-1-furn(s).reduce((x,f)=>x+(f.bonus.rest||0),0)); }
  else if(a.type==='court'){ const su=s.suitors.find(x=>x.id===a.target); if(!su){m.action=null;return;}
    su.affinity=Math.min(100,su.affinity+(1+statVal(m,'CHA')*0.1+m.skills.etiquette.lvl*0.1)*eff*(1+traitSum(m,'court'))*(1+furn(s).reduce((x,f)=>x+(f.bonus.court||0),0)));
    gainXp(s,m,'etiquette',T.xpPerDay*.5*eff); }
  else if(a.type==='quest'){
    const q=D.quests.find(x=>x.id===a.target); a.progress=(a.progress||0)+eff;
    gainXp(s,m,q.skill,T.xpPerDay*0.6*eff);
    if(a.progress>=q.days){ a.progress=0; resolveQuest(s,m,q,eff); }
  }
}
function resolveQuest(s,m,q,eff){
  const ok=rng()<successChance(s,m,q);
  if(!ok){ log(s,`❌ ${m.name} failed ${q.name}.`); if(q.risk!=='safe'){ m.injured=minionPower(s,'guard')>0?3:5; log(s,`🤕 ${m.name} was injured and rests.`);} 
    if(q.risk==='deadly' && rng()<T.deadlyDeathChance*4){ kill(s,m,`fell during ${q.name}`); } return; }
  const scale=eff>=1?1:Math.max(eff,0.2)*(1/Math.max(eff,0.2))*eff; // eff already applied via time; loot scaled
  const gain=[]; for(const [k,v] of Object.entries(q.reward)){ const n=Math.round(v*(eff>=1?1:Math.max(eff*2,.4))); s.res[k]=(s.res[k]||0)+n; gain.push(`+${n} ${k}`);}
  gainXp(s,m,q.skill,T.xpPerDay*2);
  if(q.loot.length && rng()<0.35+((cls(m)||{}).lootBonus||0)){ const id=r(q.loot); if(addToVault(s,id)) gain.push(itemDef(id).name); else gain.push('(vault full – loot lost)'); }
  s.renown+= Math.ceil(q.cp/20);
  m.questsDone=(m.questsDone||0)+1; if(!s.doneQuests.includes(q.id)) s.doneQuests.push(q.id);
  if(q.unlocks&&!s.unlocks.includes(q.unlocks)){ s.unlocks.push(q.unlocks); const [k,id]=q.unlocks.split(':'); log(s,`🔓 ${q.name} unlocked ${k==='skill'?'training: '+D.skills.find(x=>x.id===id).name:'activity: '+D.activities.find(x=>x.id===id).name}!`); }
  if(m.adv) m.adv.rep+=Math.ceil(q.cp/10)+1;
  for(const mg of guildsOf(m)){ const g=guildDef(mg.id); if(q.guild===g.id) mg.rep+=D.guilds.repPerGuildQuest; else if(g.skills.includes(q.skill)) mg.rep+=D.guilds.repPerQuestSkill; }
  const rc=D.minions.rescueQuests[q.id]; if(rc&&rng()<rc) addMinion(s,'refugee',`rescued on ${q.name}`);
  log(s,`✅ ${m.name} finished ${q.name}: ${gain.join(', ')}`);
  if(q.risk==='deadly' && rng()<T.deadlyDeathChance) kill(s,m,`was slain on ${q.name}`);
}
export function kill(s,m,why){
  if(!m.alive) return; m.alive=false; m.diedDay=s.day; m.action=null;
  for(const id of [...Object.values(m.equip),...(m.bag||[])]) s.vault.push(id); m.equip={}; m.bag=[];
  const sp=s.members.find(x=>x.id===m.spouse); if(sp) sp.widowed=true;
  log(s,`🕯️ ${m.name} (${ageY(m)}) ${why}.`); s.deeds.push(`${m.name} ${why} at ${ageY(m)}.`);
  s.renown+=level(m)*5;
  const alive=living(s);
  if(!alive.length){ s.gameOver=true; s.turbo.on=false; log(s,'⚰️ The family line has ended.'); return; }
  if(s.head===m.id){ const h=alive.filter(isAdult).sort((a,b)=>b.ageDays-a.ageDays)[0]||alive.sort((a,b)=>b.ageDays-a.ageDays)[0]; s.head=h.id; log(s,`📜 ${h.name} is now Head of Family.`);}
  if(s.activeId===m.id){ s.needSuccession=true; const h=alive.filter(isAdult).sort((a,b)=>b.ageDays-a.ageDays)[0]||alive[0]; s.activeId=h.id; }
}
function inherit(s,child){
  const ps=(child.parents||[]).map(id=>s.members.find(x=>x.id===id)).filter(Boolean);
  const share=T.inheritShare+bl(s,'library')*0.01;
  for(const sk of D.skills){ const best=Math.max(0,...ps.map(p=>p.skills[sk.id].lvl)); child.skills[sk.id].lvl=Math.max(child.skills[sk.id].lvl,Math.floor(best*share)); }
  if(ps.length && rng()<.5){ const t=r(r(ps).traits); if(t&&!child.traits.includes(t)) child.traits[1]=t; }
}
function dayTick(s,effActive,effIdle){
  if(s.gameOver) return;
  if(!s._norm) normalize(s);
  s.day++;
  // estate production & food
  const lv=s.buildings;
  s.res.food+=lv.farm*5+(lv.garden||0)*2+furn(s).reduce((x,f)=>x+(f.bonus.food||0),0);
  s.res.wood+=lv.lumber*3; s.res.stone+=lv.lumber*1;
  s.res.food-=living(s).length; if(s.res.food<0) s.res.food=0;
  if(s.day%30===0){ const up=Object.values(lv).reduce((a,b)=>a+b,0)*T.upkeepPerBuildingMonth; s.res.coin=Math.max(0,s.res.coin-up); s.renown+=furn(s).reduce((x,f)=>x+(f.bonus.renown||0),0)*30; }
  minionDay(s);
  processDay(s);
  s.res.food=Math.min(s.res.food,foodCap(s)); for(const k of ES().caps.capped) if((s.res[k]||0)>matCap(s)) s.res[k]=matCap(s);
  for(const m of living(s)) if(m.injured>1&&(s.res.potions||0)>=1){ s.res.potions-=1; m.injured=0; }
  // suitors spawn
  if(s.suitors.length<2 && s.day%45===0) spawnSuitor(s);
  for(const m of [...living(s)]){
    m.ageDays++;
    const a=ageY(m);
    if(m.ageDays%Y()===0){ // birthday
      if(a===T.adultAge){ if(m.parents) inherit(s,m); log(s,`🎂 ${m.name} came of age (16): guild halls will now consider them.`); }
      if(a>=m.lifespan-3 && !m.warned){ m.warned=true; log(s,`⚠️ ${m.name} is growing frail (lifespan ~${m.lifespan}).`); }
    }
    if(a>=m.lifespan && rng()<(0.002*(a-m.lifespan+1))){ kill(s,m,'died of old age'); if(s.gameOver) return; continue; }
    if(a<T.adultAge && !(m.id===s.activeId&&actionAllowed(s,m,m.action))){ // child passive xp
      const f=1+furn(s).reduce((x,f)=>x+(f.bonus.childxp||0),0); gainXp(s,m,r(D.skills).id,T.xpPerDay*.15*f); continue; }
    const isAct=m.id===s.activeId; const eff=isAct?effActive:effIdle;
    if(m.injured>0){ m.injured=hasService(s,'healer')?0:Math.max(0,m.injured-1); continue; }
    if(isAct) doAction(s,m,m.action,eff);
    else { const o=established(s)?m.order:{type:'work'}; if(o.type==='quest'){ if(!m.action||m.action.type!=='quest'){ const q=autoQuest(s,m,o.target); m.action=q?{type:'quest',target:q.id,progress:0}:null; } doAction(s,m,m.action,eff); }
      else if(o.type==='craft'){ if(!m.action||m.action.type!=='craft') m.action={type:'craft',target:o.target,progress:0}; doAction(s,m,m.action,eff); }
      else doAction(s,m,{type:o.type,target:o.target},eff); }
    // children
    const sp=s.members.find(x=>x.id===m.spouse&&x.alive);
    if(sp && m.gender==='f' && a<45 && m.kids<T.maxKidsPerCouple && s.day-m.lastChild>=T.childEvery && living(s).length<bedrooms(s) && rng()<0.01){
      const c=newMember(s,{age:0,parents:[m.id,sp.id]}); c.ageDays=0; s.members.push(c); m.kids++; sp.kids++; m.lastChild=s.day;
      log(s,`👶 ${c.name} was born to ${m.name} and ${sp.name}!`); }
  }
}
export function autoQuest(s,m,region){
  const qs=D.quests.filter(q=>q.region===region&&known(s,q)&&questOk(m,q)&&q.risk!=='deadly'&&q.cp<=cp(s,m)&&regionOpen(s,region));
  return qs.sort((a,b)=>b.cp-a.cp)[0]||D.quests.find(q=>q.id==='rats');
}
export function regionOpen(s,id){const rg=D.regions.find(x=>x.id===id);return living(s).some(m=>cp(s,m)>=rg.cp)||id==='outskirts';}
function spawnSuitor(s){ const g=r(['m','f']); const su={id:'su'+s.day,name:r(NAMES[g]),gender:g,cls:r(D.classes.filter(c=>c.tier===0&&!c.line)).id,affinity:0,age:18+Math.floor(rng()*8)}; s.suitors.push(su); log(s,`💌 A suitor, ${su.name} the ${D.classes.find(c=>c.id===su.cls).name}, appeared in town.`); }

// ---- player actions
export function setAction(s,a){ const m=active(s); if(['train','job','activity'].includes(a.type)&&!actionAllowed(s,m,a)) return false; if(a.type==='quest'&&!questOk(m,D.quests.find(q=>q.id===a.target))) return false; if(!m||!isAdult(m)&&a.type!=='rest'&&a.type!=='train') {} m.action={...a,progress:0}; }
export function chooseClass(s,mid,cid){ const m=s.members.find(x=>x.id===mid); m.cls=cid; s.pendingClass=s.pendingClass.filter(x=>x!==mid); log(s,`🎓 ${m.name} became a ${cls(m).name}.`); }
export function canEvolve(s,m,c){ const mg=c.guild&&memberGuild(m,c.guild); return c.from===(c.profession?m.prof:m.cls) && (!c.guild||(mg&&mg.rank>=c.guildRank)) && (c.advRank==null||(m.adv&&m.adv.rank>=c.advRank)) && (c.crafterRank==null||(m.craft&&m.craft.rank>=c.crafterRank)) && Object.entries(c.req).every(([k,v])=>m.skills[k].lvl>=v) && s.res.coin>=c.cost; }
export function evolve(s,m,cid){ const c=D.classes.find(x=>x.id===cid); if(!canEvolve(s,m,c)) return false; s.res.coin-=c.cost; if(c.profession) m.prof=cid; else m.cls=cid; log(s,`🌟 ${m.name} evolved into a ${c.name}!`); s.deeds.push(`${m.name} became a ${c.name}.`); return true; }
export function propose(s,suitorId){
  const m=active(s); const su=s.suitors.find(x=>x.id===suitorId); const cost=200;
  if(!su||su.affinity<100||m.spouse||s.res.coin<cost||living(s).length>=bedrooms(s)) return false;
  s.res.coin-=cost; const sp=newMember(s,{gender:su.gender,age:su.age,cls:su.cls}); sp.name=su.name; sp.spouse=m.id; m.spouse=sp.id;
  sp.order={type:'work'}; s.members.push(sp); s.suitors=s.suitors.filter(x=>x!==su);
  if(m.gender===sp.gender){ sp.gender=m.gender==='m'?'f':'m'; } // MVP: births need one f partner
  log(s,`💍 ${m.name} married ${sp.name}!`); s.deeds.push(`${m.name} married ${sp.name}.`); return true;
}
export function giveGift(s,suitorId,itemId){ const i=s.vault.indexOf(itemId); const su=s.suitors.find(x=>x.id===suitorId); const it=itemDef(itemId); if(i<0||!su||!it.affinity) return false; s.vault.splice(i,1); su.affinity=Math.min(100,su.affinity+it.affinity); return true; }
export function cost(s,b){ const lv=s.buildings[b.id]; return Object.fromEntries(Object.entries(b.cost).map(([k,v])=>[k,Math.round(v*Math.pow(T.buildCostMult,lv))])); }
export const afford=(s,c)=>Object.entries(c).every(([k,v])=>s.res[k]>=v);
const pay=(s,c)=>{for(const[k,v]of Object.entries(c)) s.res[k]-=v;};
export function buildIssue(s,b){ if(!hasLand(s)) return 'buy land first'; if(s.buildings[b.id]>=b.max) return 'max level'; if(!established(s)) return 'build a Shack first'; if(!s.buildings[b.id]&&landUsed(s)+b.land>landSlots(s)) return 'no free land slot'; if(!afford(s,cost(s,b))) return 'cannot afford'; return null; }
export function build(s,id){ const b=D.buildings.find(x=>x.id===id); if(buildIssue(s,b)) return false; const c=cost(s,b); if(!afford(s,c)) return false; pay(s,c); s.buildings[id]++; log(s,`🏗️ ${b.name} ${s.buildings[id]>1?'upgraded to Lv'+s.buildings[id]:'built'}.`); return true; }
export function equip(s,m,itemId,from='vault'){ const src=from==='bag'?m.bag:s.vault; const i=src.indexOf(itemId); const it=itemDef(itemId); if(i<0||!['weapon','offhand','armor','accessory'].includes(it.slot)) return false; src.splice(i,1); if(m.equip[it.slot]) m.bag.push(m.equip[it.slot]); m.equip[it.slot]=itemId; return true; }
export const sellValue=(s,it)=>Math.round(it.value*(hasService(s,'appraisal')?0.8:.5));
export function sell(s,itemId){ const i=s.vault.indexOf(itemId); if(i<0) return; s.vault.splice(i,1); s.res.coin+=sellValue(s,itemDef(itemId)); }
export function switchTo(s,id){ const m=s.members.find(x=>x.id===id&&x.alive); if(!m) return false; s.activeId=id; s.needSuccession=false; if(!m.action) m.action={type:m.order.type,target:m.order.target,progress:0}; return true; }
export function setOrder(s,id,order){ const m=s.members.find(x=>x.id===id); m.order=order; m.action=null; }
export function toggleTurbo(s){ if(!s.turbo.on && s.turbo.charge<T.turboMinMin*60) return false; s.turbo.on=!s.turbo.on; return true; }

// ---- time
// real seconds elapsed while app is open. Turbo: 3x game time (aging included) and burns 1s charge per real second.
export function advanceReal(s,sec){
  if(s.gameOver) return;
  let mult=1;
  if(s.turbo.on){ const use=Math.min(sec,s.turbo.charge); s.turbo.charge-=use; s._turboSec=(s._turboSec||0)+use; if(s.turbo.charge<=0){s.turbo.on=false;s.turbo.charge=0;}
    s.acc+=use*T.turboMult/T.secPerDayActive + (sec-use)/T.secPerDayActive; }
  else s.acc+=sec/T.secPerDayActive;
  while(s.acc>=1 && !s.gameOver){ s.acc--; dayTick(s,1,idleEff(s)); }
}
export function applyOffline(s,now=Date.now()){
  let elapsed=(now-s.lastSave)/1000;
  if(!(elapsed>0) || elapsed>3600*24*365) { s.lastSave=now; return null; }
  const sim=Math.min(elapsed,offlineCapSec(s)); const days=Math.floor(sim/T.secPerDayOffline);
  const before={coin:s.res.coin,food:s.res.food,wood:s.res.wood,stone:s.res.stone,day:s.day,turbo:s.turbo.charge,log:s.log.length,members:living(s).length};
  const logStart=s.log[0];
  for(let i=0;i<days&&!s.gameOver;i++) dayTick(s,T.offlineEffActive,T.idleEff*T.offlineEffActive+bl(s,'yard')*0.05*T.offlineEffActive);
  const charge=elapsed*T.turboChargeRatio; s.turbo.charge=Math.min(turboCapSec(s),s.turbo.charge+charge);
  s.lastSave=now;
  const idx=s.log.indexOf(logStart); const events=(idx<0?s.log:s.log.slice(0,idx)).slice(0,12).map(l=>l.msg);
  return {elapsed,sim,days,coin:Math.round(s.res.coin-before.coin),food:Math.round(s.res.food-before.food),wood:s.res.wood-before.wood,stone:s.res.stone-before.stone,
    turboAdded:Math.round(s.turbo.charge-before.turbo),turboFull:s.turbo.charge>=turboCapSec(s),events};
}
export function serialize(s,now=Date.now()){ s.lastSave=now; return JSON.stringify(s); }
export function deserialize(str){ const s=JSON.parse(str); if(!s||s.v!==SAVE_VERSION) throw new Error('bad save version'); return s; }

export function unequip(s,m,slot){ if(m.equip[slot]){ m.bag.push(m.equip[slot]); delete m.equip[slot]; } }
export function moveItem(s,m,id,toBag){ if(toBag?m.bag.length>=packCap():!vaultRoom(s)) return false; const a=toBag?s.vault:m.bag, b=toBag?m.bag:s.vault; const i=a.indexOf(id); if(i<0) return false; a.splice(i,1); b.push(id); return true; }
export const buyPrice=(it)=>Math.round(it.value*T.buyMarkup);
export function buyItem(s,townId,itemId){ const t=D.towns.find(x=>x.id===townId); const it=itemDef(itemId); if(!t.shop.includes(itemId)||s.res.coin<buyPrice(it)||!vaultRoom(s)) return false; s.res.coin-=buyPrice(it); s.vault.push(itemId); log(s,`🛒 Bought ${it.name}.`); return true; }
export function sellRes(s,townId,res,n){ const t=D.towns.find(x=>x.id===townId); n=Math.min(n,Math.floor(s.res[res])); if(n<=0) return false; s.res[res]-=n; s.res.coin+=n*t.prices[res]; return true; }
export function rumor(s,regionId){ if(s.res.coin<T.rumorCost) return null; const pool=[...D.quests,...D.nodes].filter(x=>x.region===regionId&&x.hidden&&!s.revealed.includes(x.id)); s.res.coin-=T.rumorCost; gainXp(s,active(s),'etiquette',T.xpPerDay);
  if(rng()<D.minions.rumorRecruitChance && minionRoom(s)){ addMinion(s,r(D.minions.types.filter(t=>!t.special&&t.id!=='refugee')).id,'found through a rumor'); return {recruit:true}; }
  if(!pool.length||rng()<0.3){ log(s,'🗣️ The tavern talk was idle gossip.'); return false; } const x=r(pool); s.revealed.push(x.id); log(s,`🗣️ Rumor: ${x.name} discovered!`); return x; }

// ---- minions (followers, hired help, retainers)
export const minionCap=s=>D.minions.baseCap+(s.structures||[]).length*D.minions.capPerHouse+(hasService(s,'storage')?2:0);
export function housingCap(s,kind){ if(kind==='none') return Infinity; if(kind==='garden') return bl(s,'garden')>0?Infinity:0;
  return (s.structures||[]).reduce((a,st)=>a+(((structDef(st.type).builtin||{}).housing||{})[kind]||0)+st.pieces.map(id=>scaledPiece(st,id)).reduce((b,p)=>b+(((p&&p.bonus.housing)||{})[kind]||0),0),0); }
export const housingKind=mi=>(D.minions.types.find(t=>t.id===(mi.type||mi.id))||{}).housing||'bunk';
export function isHoused(s,mi){ const k=housingKind(mi); const same=s.minions.filter(x=>housingKind(x)===k); return same.indexOf(mi)<housingCap(s,k); }
export const housingUsed=(s,kind)=>Math.min(s.minions.filter(x=>housingKind(x)===kind).length,housingCap(s,kind));
export const freeHousing=(s,kind='bunk')=>housingCap(s,kind)-s.minions.filter(x=>housingKind(x)===kind).length;
export const minionFood=s=>s.minions.length*ES().minionFoodPerDay;
export const minionRoom=s=>s.minions.filter(x=>!x.special).length<minionCap(s)&&freeHousing(s,'bunk')>0;
const mtype=id=>D.minions.types.find(t=>t.id===id);
export function minionPower(s,job){ return (s.minions||[]).filter(x=>x.job===job).reduce((a,x)=>a+(mtype(x.type).apt[job]||1)*minionGearMult(x,job),0); }
export function addMinion(s,type,why){ if(!mtype(type).special&&!minionRoom(s)) { log(s,`🚪 No room or no bunk for a new follower (${why}).`); return null; }
  const t=mtype(type); const mi={uid:'mi'+(s.nextId++),type,name:t.special?t.name:r(D.minions.names),job:'idle',loyalty:100,since:s.day}; if(t.special){mi.special=true;mi.source=why;}
  s.minions.push(mi); log(s,`🤝 ${mi.name} the ${t.name} joined (${why}).`); return mi; }
export const hireable=(s,townId)=>(D.minions.hireAt[townId]||[]).map(mtype);
export function hire(s,townId,type){ const t=mtype(type); if(!(D.minions.hireAt[townId]||[]).includes(type)||s.res.coin<t.hire||!minionRoom(s)) return null; s.res.coin-=t.hire; return addMinion(s,type,'hired in town'); }
export function jobOpen(s,jobId){ const j=D.minions.jobs.find(x=>x.id===jobId); return !!j&&(jobId==='idle'||(established(s)&&jobCap(s,jobId)>0)); }
export const jobUsed=(s,job,except)=>s.minions.filter(x=>x.job===job&&x.uid!==except).length;
export function assignMinion(s,uid,job){ const mi=s.minions.find(x=>x.uid===uid); if(!mi||!jobOpen(s,job)||(job!=='idle'&&!isHoused(s,mi))||jobUsed(s,job,uid)>=jobCap(s,job)) return false; mi.job=job; return true; }
export function dismiss(s,uid){ const i=s.minions.findIndex(x=>x.uid===uid); if(i<0) return false; for(const id of Object.values(s.minions[i].equip||{})) s.vault.push(id); log(s,`👋 ${s.minions[i].name} was dismissed.`); s.minions.splice(i,1); return true; }
export const monthlyWages=s=>s.minions.reduce((a,x)=>a+mtype(x.type).wage,0);
function minionDay(s){
  if(!s.minions){s.minions=[];s.repLevel=0;}
  checkSpecialMinions(s);
  const fed=s.res.food>=minionFood(s);
  for(const mi of s.minions){ if(!fed){ mi.hunger=(mi.hunger||0)+1; mi.loyalty-=D.minions.hungerLoyaltyLoss*minionSurvival(mi); } else mi.hunger=0;
    if(!isHoused(s,mi)){ mi.unhoused=true; continue; } mi.unhoused=false;
    const a=(mtype(mi.type).apt[mi.job]||1)*(fed?1:D.minions.hungryOutput)*minionGearMult(mi,mi.job);
    if(mi.job==='farm') s.res.food+=3*a*(1+bl(s,'farm')*.2);
    else if(mi.job==='gather'){ s.res.wood+=2*a; s.res.stone+=1*a; }
    else if(mi.job==='mine'){ s.res.ore=(s.res.ore||0)+1*a; s.res.copperore=(s.res.copperore||0)+0.8*a; s.res.stone+=0.5*a; }
    else if(mi.job==='herbs') s.res.herbs=(s.res.herbs||0)+1.5*a;
    else if(mi.job==='craft'){ mi.prog=(mi.prog||0)+0.2*a; const rc=bestRecipe(s,null); if(rc&&mi.prog>=rc.days){ mi.prog=0; craftItem(s,null,rc,mi,a); } }
    else if(mi.job==='merchant'){ sellTick(s,a*(1+(mi.equip?0:0))); } }
  s.res.food=Math.max(0,s.res.food-minionFood(s));
  for(const mi of [...s.minions]) if(mi.loyalty<=0){ s.minions=s.minions.filter(x=>x!==mi); log(s,`🍽️ ${mi.name} left: ${mi.hunger?'not enough food':'unhappy'}.`); }
  if(s.day%30===0 && s.minions.length){ const w=monthlyWages(s);
    if(s.res.coin>=w){ s.res.coin-=w; for(const mi of s.minions) mi.loyalty=Math.min(100,mi.loyalty+10); }
    else { s.res.coin=0; for(const mi of [...s.minions]){ mi.loyalty-=D.minions.loyaltyLossUnpaid; if(mi.loyalty<=0){ s.minions=s.minions.filter(x=>x!==mi); log(s,`💸 ${mi.name} left over unpaid wages.`);} } log(s,'💸 Wages went unpaid; loyalty fell.'); } }
  const lvl=Math.floor(s.renown/D.minions.reputationEveryRenown); if(lvl>s.repLevel){ s.repLevel=lvl; if(established(s)&&minionRoom(s)) addMinion(s,r(D.minions.types.filter(t=>!t.special&&t.id!=='refugee'&&t.id!=='tutor')).id,"drawn by the estate's reputation"); }
}

// ---- guilds
export function classGuild(cid){ let c=D.classes.find(x=>x.id===cid); while(c&&c.from) c=D.classes.find(x=>x.id===c.from); return c&&(D.guilds.guilds.find(g=>g.grantsClass===c.id||g.profession===c.id)||(D.guilds.adventurers.grantsClass===c.id?D.guilds.adventurers:null)); }
export function normalize(s){ if(!s.unlocks) s.unlocks=[]; s.reserve={...DEFAULT_RESERVE,...(s.reserve||{})}; if(!Array.isArray(s.paused)) s.paused=[]; s.pendingClass=[];
  for(const m of s.members){ if(m.guild&&m.guild.id==='hearth'){ m.craft={id:'hearth',rank:m.guild.rank,rep:m.guild.rep}; m.guild=null; if(!m.prof) m.prof='artisan'; delete m.title; }
    if(m.cls&&!m.guild&&(D.classes.find(c=>c.id===m.cls)||{}).line==='adventurer'){ if(!m.adv) m.adv={rank:0,rep:0}; }
    else if(m.cls&&!m.guild){ const g=classGuild(m.cls); if(g){ m.guild={id:g.id,rank:0,rep:0}; log(s,`📜 ${m.name} (${cls(m).name}) was enrolled in the ${g.name}.`); } } }
  if(!s.forSale) s.forSale=[]; if(s.saleProg==null) s.saleProg=0; for(const mi of s.minions||[]) if(!mi.equip) mi.equip={};
  for(const b of D.buildings) if(s.buildings[b.id]===undefined) s.buildings[b.id]=0;
  if(!s.land) s.land=[];
  if(!s.structures){ s.structures=[]; s.pieceStore=[]; // migrate house/room/furniture saves
    const hlv=s.buildings.house||0, oldRooms=s.rooms||[], oldF=s.furniture||[]; const any=hlv>0||D.buildings.some(b=>bl(s,b.id)>0);
    if(any&&!s.land.length) s.land.push('plot');
    if(hlv>0){ const st={uid:'st'+(s.nextId++),type:hlv>=3?'house':hlv===2?'cabin':'shack',pieces:[]}; s.structures.push(st);
      const map={living:'bunk',workshop:'workbench',post:'toolrack',study:'studydesk',nursery:'cradle',shrine:'shrine'};
      let want=oldRooms.length?oldRooms.map(r=>map[r]).filter(Boolean):['bunk','workbench']; if(!want.includes('bunk')) want.unshift('bunk');
      if(s.minions&&s.minions.length) want.push('minionbunk'); want=[...want,...oldF];
      for(const pid of want){ if(freeSlots(s,st)>0&&!st.pieces.includes(pid)) st.pieces.push(pid); else s.pieceStore.push(pid); } }
    else s.pieceStore.push(...oldF);
    for(const l of ES().lands){ if(landSlots(s)>=landUsed(s)) break; if(!s.land.includes(l.id)) s.land.push(l.id); }
    delete s.buildings.house; delete s.rooms; s.furniture=[];
    if(any) log(s,`📜 Estate converted to buildings & stations: ${s.structures.length} building(s), ${s.pieceStore.length} piece(s) in storage.`); } if(!s.doneQuests) s.doneQuests=[]; if(!s.specialGranted) s.specialGranted=[]; for(const m of s.members){ if(fixTraits(m)) log(s,`🔧 ${m.name}'s conflicting traits were resolved: ${m.traits.map(t=>traitDef(t).name).join(', ')}.`); for(const sk of D.skills) if(!m.skills[sk.id]) m.skills[sk.id]={lvl:0,xp:0}; if(m.guild===undefined) m.guild=null; if(m.guild&&!guildDef(m.guild.id)) m.guild=null; const okI=id=>!!itemDef(id); m.bag=(m.bag||[]).filter(okI); for(const k in m.equip) if(!okI(m.equip[k])) delete m.equip[k]; if(m.adv===undefined) m.adv=null; if(!m.bag) m.bag=[]; } s.vault=s.vault.filter(id=>!!itemDef(id)); if(!s.minions){s.minions=[];s.repLevel=0;} s._norm=true; }
export const guildDef=id=>D.guilds.guilds.find(g=>g.id===id);
export const rankName=r=>D.guilds.ranks[r].name;
export function trainIssue(m,skillId,s){ const sk=D.skills.find(x=>x.id===skillId); if(!sk) return 'unknown'; const a=ageY(m);
  if(sk.guild&&!memberGuild(m,sk.guild)) return 'guild';
  if(sk.unlockQuest&&s&&!(s.unlocks||[]).includes('skill:'+skillId)) return 'quest';
  if(a<12) return 'age12'; if(sk.family==='magic'&&a<14) return 'age14'; return null; }
export function canTrain(m,skillId,s,ignoreAge){ const i=trainIssue(m,skillId,s); return !i||(ignoreAge&&i.startsWith('age')); }
export const jobOk=(m,j)=>ageY(m)>=j.minAge;
export function activityOk(s,m,ac){ const a=ageY(m); if(a<ac.minAge||(ac.maxAge&&a>ac.maxAge)) return false; const u=ac.unlock; if(!u) return true;
  if(u.guild){ const g=memberGuild(m,u.guild); return !!g&&(g.rank||0)>=(u.rank||0); } if(u.quest) return (s.unlocks||[]).includes('activity:'+ac.id); if(u.building) return bl(s,u.building)>0; return true; }
export function actionAllowed(s,m,a){ if(!a) return false; const t=a.type;
  if(t==='train') return canTrain(m,a.target,s); if(t==='job') return jobOk(m,D.jobs.find(j=>j.id===a.target)||{minAge:99});
  if(t==='activity'){ const ac=D.activities.find(x=>x.id===a.target); return !!ac&&activityOk(s,m,ac); }
  if(t==='gather'||t==='rest') return ageY(m)>=10; return false; }
export function memberGuild(m,gid){ const g=guildDef(gid); if(!g) return null; if(g.open) return m.craft&&gid==='hearth'?{id:gid,...m.craft,_ref:m.craft}:null; return m.guild&&m.guild.id===gid?m.guild:null; }
export function guildsOf(m){ return [m.guild,m.craft?Object.assign(m.craft,{id:'hearth'}):null].filter(Boolean); }
export function questOk(m,q){ const mg=q&&q.guild&&memberGuild(m,q.guild); return !!q&&(!q.adv||(m.adv&&m.adv.rank>=q.adv))&&(!q.guild||(mg&&mg.rank>=(q.rank||0))); }
export function joinIssues(s,m,gid){ const g=guildDef(gid), q=g.req, out=[];
  if(memberGuild(m,gid)) out.push('already a member'); else if(!g.open&&m.guild) out.push(`sworn to ${guildDef(m.guild.id).name}`);
  if(!isAdult(m)) out.push('must be an adult');
  if(ageY(m)<(D.guilds.minJoinAge||16)) out.push('age 16+');
  for(const[k,v]of Object.entries(q.stats||{})) if(statVal(m,k)<v) out.push(`${k} ${statVal(m,k)}/${v}`);
  for(const[k,v]of Object.entries(q.skills||{})) if(m.skills[k].lvl<v) out.push(`${D.skills.find(x=>x.id===k).name} ${m.skills[k].lvl}/${v}`);
  if(s.res.coin<(q.coin||0)) out.push(`${q.coin} coin`);
  return out; }
export function joinGuild(s,m,gid){ if(joinIssues(s,m,gid).length) return false; const g=guildDef(gid); s.res.coin-=g.req.coin||0;
  if(g.open){ m.craft={id:gid,rank:0,rep:0}; if(g.profession&&!m.prof){ m.prof=g.profession; log(s,`🧑‍🔧 ${m.name} took up the ${D.classes.find(c=>c.id===m.prof).name} profession.`);} }
  else { m.guild={id:gid,rank:0,rep:0}; if(g.grantsClass&&(!m.cls||m.cls==='adventurer')){ const was=m.cls; m.cls=g.grantsClass; log(s,`🎓 ${m.name} was trained as a ${cls(m).name}${was?' (Adventurer becomes their rank track only)':''}.`); } }
  log(s,`${g.icon} ${m.name} joined the ${g.name} as ${rankName(0)}.`); s.deeds.push(`${m.name} joined the ${g.name}.`); return true; }
const mgOf=(m,gid)=>gid?memberGuild(m,gid):m.guild;
const store=(m,gid)=>gid==='hearth'?m.craft:m.guild;
export function nextRank(m,gid){ const g=mgOf(m,gid); return g&&D.guilds.ranks[g.rank+1]; }
export function canRankUp(s,m,gid){ const g=mgOf(m,gid), n=nextRank(m,gid); return !!n&&g.rep>=n.rep&&s.res.coin>=n.cost; }
export function rankUp(s,m,gid){ if(!canRankUp(s,m,gid)) return false; const n=nextRank(m,gid), st=store(m,gid||m.guild.id); s.res.coin-=n.cost; st.rank++; s.renown+=10*st.rank; const gn=guildDef(gid||m.guild.id).name;
  log(s,`🎖️ ${m.name} rose to ${n.name} of the ${gn}.`); s.deeds.push(`${m.name} became ${n.name} of the ${gn}.`); return true; }
export const guildShop=gid=>D.items.filter(i=>i.guild===gid);
export function buyGuildItem(s,m,itemId){ const it=itemDef(itemId); const mg=it&&it.guild&&memberGuild(m,it.guild); if(!mg||mg.rank<it.rank||s.res.coin<buyPrice(it)||!vaultRoom(s)) return false; s.res.coin-=buyPrice(it); s.vault.push(it.id); log(s,`🛒 Bought ${it.name} from the guild.`); return true; }

// ---- Adventurers' Guild (open to everyone; separate from the one-guild lock)
const AG=()=>D.guilds.adventurers;
export const advRankName=r=>AG().ranks[r].name;
export function hasService(s,svc){ const need=AG().ranks.findIndex(r=>r.unlocks===svc); return (s.members||[]).some(m=>m.alive&&m.adv&&m.adv.rank>=need); }
export function services(s){ return Object.keys(AG().services).filter(k=>hasService(s,k)); }
export function joinAdventurers(s,m){ if(m.adv||!isAdult(m)||s.res.coin<AG().joinCost) return false; s.res.coin-=AG().joinCost; m.adv={rank:0,rep:0}; if(!m.cls){ m.cls='adventurer'; log(s,`🧭 ${m.name} becomes an Adventurer (their primary class).`); } log(s,`⚔️ ${m.name} registered with the Adventurers' Guild (Rank F).`); return true; }
export const advNext=m=>m.adv&&AG().ranks[m.adv.rank+1];
export function canAdvRankUp(s,m){ const n=advNext(m); return !!n&&m.adv.rep>=n.rep&&s.res.coin>=n.cost; }
export function advRankUp(s,m){ if(!canAdvRankUp(s,m)) return false; const n=advNext(m); s.res.coin-=n.cost; m.adv.rank++; s.renown+=5*m.adv.rank;
  log(s,`⚔️ ${m.name} is now Rank ${n.name} in the Adventurers' Guild${n.unlocks?' – unlocked '+n.unlocks:''}.`); return true; }
export const advShop=()=>D.items.filter(i=>i.adv);
export function buyAdvItem(s,m,id){ const it=itemDef(id); if(!it||!it.adv||!m.adv||m.adv.rank<it.adv||s.res.coin<buyPrice(it)||!vaultRoom(s)) return false; s.res.coin-=buyPrice(it); s.vault.push(id); log(s,`🛒 Bought ${it.name} from the Adventurers' Guild.`); return true; }

// ---- special minions (from classes, guild ranks, quests)
export function specialSource(s,t){ const src=t.source, L=living(s);
  if(src.class){ const m=L.find(x=>x.cls===src.class); return m?`${cls(m).name} ${m.name}`:null; }
  if(src.guild){ const m=L.find(x=>x.guild&&x.guild.id===src.guild&&x.guild.rank>=src.rank); return m?`${rankName(src.rank)} of ${guildDef(src.guild).name}`:null; }
  if(src.quest) return (s.doneQuests||[]).includes(src.quest)?`quest: ${D.quests.find(q=>q.id===src.quest).name}`:null; return null; }
export function sourceLabel(t){ const src=t.source; if(src.class) return `Class: ${D.classes.find(c=>c.id===src.class).name}`; if(src.guild) return `${guildDef(src.guild).name} – ${rankName(src.rank)}`; return `Quest: ${D.quests.find(q=>q.id===src.quest).name}`; }
export function checkSpecialMinions(s){ for(const t of D.minions.types.filter(x=>x.special)){ if(s.specialGranted.includes(t.id)) continue; const why=specialSource(s,t); if(why){ s.specialGranted.push(t.id); addMinion(s,t.id,why); } } }

// ---- items, crafting & inventory
const CR=()=>D.crafting;
export const qualities=()=>CR().qualities;
export function itemDef(id){ if(typeof id!=='string') return null; if(id.startsWith('c|')){ const [,b,q]=id.split('|'); const base=D.items.find(i=>i.id===b), Q=CR().qualities.find(x=>x.id===q); if(!base||!Q) return null;
  return {...base,id,name:`${Q.name} ${base.name}`,rarity:Q.name,quality:q,crafted:true,cp:Math.round((base.cp||0)*Q.mult),value:Math.round(base.value*Q.mult*CR().craftedValueMult),affinity:base.affinity?Math.round(base.affinity*Q.mult):undefined}; }
  return D.items.find(i=>i.id===id)||null; }
export const vaultCap=s=>CR().vaultBase+Math.floor(eff(s,'matCap')/400*CR().vaultPerStorage+1e-9);
export const vaultRoom=s=>s.vault.length<vaultCap(s);
export const packCap=()=>CR().packCap;
export function addToVault(s,id){ if(!vaultRoom(s)) return false; s.vault.push(id); return true; }
export const recipeDef=id=>CR().recipes.find(r=>r.id===id);
export function recipeIssue(s,m,rc){ if(!hasPiece(s,rc.station)) return `needs ${pieceDef(rc.station).name}`; if(m&&m.skills[rc.skill].lvl<(rc.minSkill||0)) return `${D.skills.find(k=>k.id===rc.skill).name} ${rc.minSkill}`; if(!afford(s,rc.mats)) return 'missing materials'; if(!vaultRoom(s)) return 'vault full'; return null; }
export function bestRecipe(s,m){ return CR().recipes.filter(r=>!recipeIssue(s,m,r)).sort((a,b)=>itemDef(b.base).value-itemDef(a.base).value)[0]||null; }
export function profBonus(m,rc){ const p=m&&m.prof&&D.classes.find(c=>c.id===m.prof); if(!p) return 0; return p.craftBonus+(p.spec&&p.spec===rc.line?0.15:0); }
export function qualityScore(s,m,rc,mi,apt=1){ const sk=m?m.skills[rc.skill].lvl:10*apt; return sk/50+craftQuality(s)+profBonus(m,rc); }
export function rollQuality(score){ const x=score+rng()*0.5; let q=CR().qualities[0]; for(const Q of CR().qualities) if(x>=Q.score) q=Q; return q.id; }
export function craftItem(s,m,rc,mi,apt=1){ if(recipeIssue(s,m,rc)) return null; pay(s,rc.mats); const q=rollQuality(qualityScore(s,m,rc,mi,apt)); const id=`c|${rc.base}|${q}`; s.vault.push(id);
  if(m){ gainXp(s,m,rc.skill,T.xpPerDay*3); if(m.craft) m.craft.rep+=2+CR().qualities.findIndex(x=>x.id===q); }
  log(s,`🔨 ${(m||mi).name} crafted ${itemDef(id).name}.`); return id; }
export const stallValue=(s,it)=>Math.round(it.value*CR().stallSellRate);
export function listForSale(s,id){ const i=s.vault.indexOf(id); if(i<0) return false; s.vault.splice(i,1); s.forSale.push(id); return true; }
export function unlist(s,id){ const i=s.forSale.indexOf(id); if(i<0||!vaultRoom(s)) return false; s.forSale.splice(i,1); s.vault.push(id); return true; }
export function sellTick(s,power=1){ if(!s.forSale.length) return; s.saleProg=(s.saleProg||0)+power; if(s.saleProg>=CR().stallDaysPerItem){ s.saleProg=0; const id=s.forSale.shift(); const it=itemDef(id); const v=stallValue(s,it); s.res.coin+=v; log(s,`🏷️ Sold ${it.name} for ${v}🪙.`); } }
export function sellMany(s,ids){ let n=0; for(const id of ids){ if(s.vault.includes(id)){ sell(s,id); n++; } } return n; }
export function sellAllRes(s,townId,res){ return sellRes(s,townId,res,Math.floor(s.res[res]||0)); }
export function minionGearMult(mi,job){ const g=mi.equip||{}, cp=sl=>(itemDef(g[sl])||{}).cp||0; let m=1+cp('charm')/100;
  if(job==='guard') m+=(cp('weapon')+cp('armor'))/50; const t=itemDef(g.tool); if(t&&(t.toolFor===job)) m+=t.cp/40; return m; }
export const minionSurvival=mi=>1/(1+((itemDef((mi.equip||{}).armor)||{}).cp||0)/20);
export function equipMinion(s,uid,id){ const mi=s.minions.find(x=>x.uid===uid); const it=itemDef(id); const i=s.vault.indexOf(id); if(!mi||!it||i<0||!CR().minionSlots.includes(it.slot)||(it.companion&&!['kennel','perch','brazier'].includes(housingKind(mi)))) return false; mi.equip=mi.equip||{}; s.vault.splice(i,1); if(mi.equip[it.slot]) s.vault.push(mi.equip[it.slot]); mi.equip[it.slot]=id; return true; }
export function unequipMinion(s,uid,slot){ const mi=s.minions.find(x=>x.uid===uid); if(!mi||!mi.equip||!mi.equip[slot]||!vaultRoom(s)) return false; s.vault.push(mi.equip[slot]); delete mi.equip[slot]; return true; }

// ---- eras (eras only ADD systems; nothing earlier is ever locked)
export const ERAS=[{n:1,name:'Solo Adventurer',icon:'🧭'},{n:2,name:'Established Family',icon:'🏡'},{n:3,name:'Ruling Power',icon:'👑'}];
export function era(s){ const fam=living(s).length>1||s.members.some(m=>m.spouse); if(s.renown>=5000&&['Manor','Prosperous Estate'].includes(estateStage(s))) return ERAS[2]; if(established(s)&&fam||s.renown>=300) return ERAS[1]; return ERAS[0]; }
export function nextEraHint(s){ const e=era(s).n; return e===1?'Next: build a home on your land and start a family (or reach 300 Renown).':e===2?'Next: 5,000 Renown and a Manor-tier estate (Era 3 systems coming in a later update).':'Era 3 systems (titles, vassals, taxes) are planned.'; }

export const ACT_TIERS={basic:1,advanced:2,master:3};
export const activityGains=ac=>({stats:Object.entries(ac.stats),skills:ac.skills});
