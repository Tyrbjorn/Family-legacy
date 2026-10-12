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
const furn=(s,k)=>s.furniture.map(id=>D.furniture.find(f=>f.id===id)).filter(f=>f);

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
export function newGame(now=Date.now()){ const _s=_newGame(now); _s.land=[]; _s.rooms=[]; normalize(_s); return _s; }
function _newGame(now){
  const s={v:SAVE_VERSION,day:0,nextId:1,members:[],activeId:1,head:1,
    res:{coin:50,food:60,wood:0,stone:0,herbs:0},revealed:[],buildings:{},furniture:[],vault:['rusty_sword','padded_vest'],
    log:[],turbo:{charge:0,on:false},lastSave:now,unlocks:[],doneQuests:[],specialGranted:[],minions:[],repLevel:0,gameOver:false,suitors:[],renown:0,deeds:[],acc:0,pendingClass:[]};
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
  for(const id of Object.values(m.equip)){const it=D.items.find(i=>i.id===id); if(it) v+=it.cp||0;}
  v*=1+traitSum(m,'cp');
  return Math.round(v);
}
export function softCap(m){const c=cls(m);return T.softCap[c?c.tier:0];}
function xpMult(s,m,skillId){
  const sk=D.skills.find(x=>x.id===skillId); let mult=1;
  mult+=traitSum(m,'xp'); mult+=rooms(s).filter(r=>r.xpFamily===sk.family).length*0.03;
  if(['lore','magic'].includes(sk.family)) mult+=m.skills.reading.lvl*0.01 + bl(s,'library')*0.02;
  for(const f of furn(s)){ if(f.bonus.skill===skillId) mult+=f.bonus.xp; if(f.bonus.family===sk.family) mult+=f.bonus.xp; }
  if(ageY(m)>=50) mult+=.1;
  if(s.res.food<=0) mult*=.5;
  if(m.guild){ const g=guildDef(m.guild.id); if(g.skills.includes(skillId)) mult+=0.05*(m.guild.rank+1); }
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
export const roomDef=id=>ES().rooms.find(r=>r.id===id);
const rooms=s=>(s.rooms||[]).map(roomDef).filter(Boolean);
export const bedrooms=s=>1+rooms(s).reduce((a,r)=>a+(r.beds||0),0);
export const hasLand=s=>(s.land||[]).length>0;
export const established=s=>hasLand(s)&&bl(s,'house')>=1;
export const landSlots=s=>(s.land||[]).reduce((a,id)=>a+ES().lands.find(l=>l.id===id).slots,0);
export const landUsed=s=>D.buildings.reduce((a,b)=>a+(bl(s,b.id)>0?b.land:0),0);
export const interiorSlots=s=>D.buildings.reduce((a,b)=>a+bl(s,b.id)*(b.interiorPerLevel||0),0);
export const buildingLevelName=(b,lv)=>b.levelNames?b.levelNames[Math.max(0,lv-1)]:b.name;
export function canBuyLand(s,id){ const l=ES().lands.find(x=>x.id===id); return !!l&&!(s.land||[]).includes(id)&&(!l.requires||s.land.includes(l.requires))&&afford(s,l.cost); }
export function buyLand(s,id){ if(!canBuyLand(s,id)) return false; const l=ES().lands.find(x=>x.id===id); pay(s,l.cost); s.land.push(id); log(s,`📜 Bought ${l.name} (+${l.slots} land slots).`); s.deeds.push(`Bought ${l.name}.`); return true; }
export function canAddRoom(s,id){ const r=roomDef(id); if(!r||!established(s)||s.rooms.length>=interiorSlots(s)||!afford(s,r.cost)) return false;
  if(!s.rooms.includes('living')&&id!=='living') return false; // first Shack room must be a living space
  return true; }
export function addRoom(s,id){ if(!canAddRoom(s,id)) return false; const r=roomDef(id); pay(s,r.cost); s.rooms.push(id); log(s,`🚪 Added a ${r.name}.`); return true; }
export function removeRoom(s,i){ if(i<0||i>=s.rooms.length) return false; if(s.rooms[i]==='living'&&s.rooms.filter(x=>x==='living').length===1) return false; s.rooms.splice(i,1); return true; }
export function jobCap(s,job){ if(job==='idle'||job==='guard') return Infinity; let c=rooms(s).reduce((a,r)=>a+((r.jobs||{})[job]||0),0);
  if(job==='farm') c+=bl(s,'farm')*2+bl(s,'garden'); if(job==='gather') c+=bl(s,'lumber')*2; if(job==='tutor') c+=bl(s,'library'); return c; }
export function estateStage(s){ if(!hasLand(s)) return 'Landless'; const t=Object.values(s.buildings).reduce((a,b)=>a+b,0)+s.rooms.length; const STAGES=ES().stages; let n=STAGES[0][1];for(const[k,v]of STAGES)if(t>=k)n=v;return n;}
export const known=(s,x)=>!x.hidden||s.revealed.includes(x.id);
export function successChance(s,m,q){const c=cp(s,m);return Math.max(.1,Math.min(.98,0.5+(c-q.cp)/(q.cp+20)+Math.min(.15,minionPower(s,'guard')*.03)));}

function doAction(s,m,a,eff){
  if(!a) return;
  if(a.type==='train'){ gainXp(s,m,a.target,T.xpPerDay*eff); }
  else if(a.type==='work'){ const c=(4+level(m)*0.5+m.skills.haggling.lvl*0.2)*eff*(1+traitSum(m,'coin'))*(1+furn(s).reduce((x,f)=>x+(f.bonus.coin||0),0)); s.res.coin+=c; gainXp(s,m,'haggling',T.xpPerDay*.3*eff); }
  else if(a.type==='gather'){ const n=D.nodes.find(x=>x.id===a.target); if(!n){m.action=null;return;} const mul=(1+m.skills[n.skill].lvl*0.03)*eff; for(const[k,v]of Object.entries(n.res)) s.res[k]=(s.res[k]||0)+v*mul; gainXp(s,m,n.skill,T.xpPerDay*.6*eff); }
  else if(a.type==='craft'){ if(!established(s)) return; a.progress=(a.progress||0)+eff; gainXp(s,m,'smithing',T.xpPerDay*.5*eff); if(a.progress>=T.craftDays){ a.progress=0; if(afford(s,T.craftCost)){ pay(s,T.craftCost); const pool=D.items.filter(i=>i.slot!=='gift'&&(i.rarity==='Common'||(i.rarity==='Fine'&&m.skills.smithing.lvl>=15))); const it=r(pool); s.vault.push(it.id); log(s,`🔨 ${m.name} crafted ${it.name}.`);} } }
  else if(a.type==='job'){ const j=D.jobs.find(x=>x.id===a.target); if(!j||!jobOk(m,j)){m.action=null;return;}
    s.res.coin+=(isAdult(m)?j.payAdult:j.payChild)*(1+level(m)*0.02)*eff*(1+traitSum(m,'coin'));
    for(const[k,v]of Object.entries(j.stats)) m.stats[k]+=v*eff; for(const k of j.skills) gainXp(s,m,k,T.xpPerDay*.5*eff); }
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
  if(q.loot.length && rng()<0.35){ const id=r(q.loot); s.vault.push(id); gain.push(D.items.find(i=>i.id===id).name); }
  s.renown+= Math.ceil(q.cp/20);
  m.questsDone=(m.questsDone||0)+1; if(!s.doneQuests.includes(q.id)) s.doneQuests.push(q.id);
  if(q.unlocks&&!s.unlocks.includes(q.unlocks)){ s.unlocks.push(q.unlocks); const [k,id]=q.unlocks.split(':'); log(s,`🔓 ${q.name} unlocked ${k==='skill'?'training: '+D.skills.find(x=>x.id===id).name:'activity: '+D.activities.find(x=>x.id===id).name}!`); }
  if(m.adv) m.adv.rep+=Math.ceil(q.cp/10)+1;
  if(m.guild){ const g=guildDef(m.guild.id); if(q.guild===g.id) m.guild.rep+=D.guilds.repPerGuildQuest; else if(g.skills.includes(q.skill)) m.guild.rep+=D.guilds.repPerQuestSkill; }
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
  // suitors spawn
  if(s.suitors.length<2 && s.day%45===0) spawnSuitor(s);
  for(const m of [...living(s)]){
    m.ageDays++;
    const a=ageY(m);
    if(m.ageDays%Y()===0){ // birthday
      if(a===T.adultAge){ if(m.parents) inherit(s,m); if(!m.cls){ if(m.id===s.activeId) s.pendingClass.push(m.id); else { m.cls=r(D.classes.filter(c=>c.tier===0)).id; log(s,`🎓 ${m.name} came of age and became a ${cls(m).name}.`);} } }
      if(a>=m.lifespan-3 && !m.warned){ m.warned=true; log(s,`⚠️ ${m.name} is growing frail (lifespan ~${m.lifespan}).`); }
    }
    if(a>=m.lifespan && rng()<(0.002*(a-m.lifespan+1))){ kill(s,m,'died of old age'); if(s.gameOver) return; continue; }
    if(a<T.adultAge && !(m.id===s.activeId&&actionAllowed(s,m,m.action))){ // child passive xp
      const f=1+furn(s).reduce((x,f)=>x+(f.bonus.childxp||0),0)+rooms(s).reduce((x,r)=>x+(r.childxp||0),0); gainXp(s,m,r(D.skills).id,T.xpPerDay*.15*f); continue; }
    const isAct=m.id===s.activeId; const eff=isAct?effActive:effIdle;
    if(m.injured>0){ m.injured=hasService(s,'healer')?0:Math.max(0,m.injured-1); continue; }
    if(isAct) doAction(s,m,m.action,eff);
    else { const o=established(s)?m.order:{type:'work'}; if(o.type==='quest'){ if(!m.action||m.action.type!=='quest'){ const q=autoQuest(s,m,o.target); m.action=q?{type:'quest',target:q.id,progress:0}:null; } doAction(s,m,m.action,eff); }
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
function spawnSuitor(s){ const g=r(['m','f']); const su={id:'su'+s.day,name:r(NAMES[g]),gender:g,cls:r(D.classes.filter(c=>c.tier===0)).id,affinity:0,age:18+Math.floor(rng()*8)}; s.suitors.push(su); log(s,`💌 A suitor, ${su.name} the ${D.classes.find(c=>c.id===su.cls).name}, appeared in town.`); }

// ---- player actions
export function setAction(s,a){ const m=active(s); if(['train','job','activity'].includes(a.type)&&!actionAllowed(s,m,a)) return false; if(a.type==='quest'&&!questOk(m,D.quests.find(q=>q.id===a.target))) return false; if(!m||!isAdult(m)&&a.type!=='rest'&&a.type!=='train') {} m.action={...a,progress:0}; }
export function chooseClass(s,mid,cid){ const m=s.members.find(x=>x.id===mid); m.cls=cid; s.pendingClass=s.pendingClass.filter(x=>x!==mid); log(s,`🎓 ${m.name} became a ${cls(m).name}.`); }
export function canEvolve(s,m,c){ return c.from===m.cls && (!c.guild||(m.guild&&m.guild.id===c.guild&&m.guild.rank>=c.guildRank)) && Object.entries(c.req).every(([k,v])=>m.skills[k].lvl>=v) && s.res.coin>=c.cost; }
export function evolve(s,m,cid){ const c=D.classes.find(x=>x.id===cid); if(!canEvolve(s,m,c)) return false; s.res.coin-=c.cost; m.cls=cid; log(s,`🌟 ${m.name} evolved into a ${c.name}!`); s.deeds.push(`${m.name} became a ${c.name}.`); return true; }
export function propose(s,suitorId){
  const m=active(s); const su=s.suitors.find(x=>x.id===suitorId); const cost=200;
  if(!su||su.affinity<100||m.spouse||s.res.coin<cost||living(s).length>=bedrooms(s)) return false;
  s.res.coin-=cost; const sp=newMember(s,{gender:su.gender,age:su.age,cls:su.cls}); sp.name=su.name; sp.spouse=m.id; m.spouse=sp.id;
  sp.order={type:'work'}; s.members.push(sp); s.suitors=s.suitors.filter(x=>x!==su);
  if(m.gender===sp.gender){ sp.gender=m.gender==='m'?'f':'m'; } // MVP: births need one f partner
  log(s,`💍 ${m.name} married ${sp.name}!`); s.deeds.push(`${m.name} married ${sp.name}.`); return true;
}
export function giveGift(s,suitorId,itemId){ const i=s.vault.indexOf(itemId); const su=s.suitors.find(x=>x.id===suitorId); const it=D.items.find(x=>x.id===itemId); if(i<0||!su||!it.affinity) return false; s.vault.splice(i,1); su.affinity=Math.min(100,su.affinity+it.affinity); return true; }
export function cost(s,b){ const lv=s.buildings[b.id]; return Object.fromEntries(Object.entries(b.cost).map(([k,v])=>[k,Math.round(v*Math.pow(T.buildCostMult,lv))])); }
export const afford=(s,c)=>Object.entries(c).every(([k,v])=>s.res[k]>=v);
const pay=(s,c)=>{for(const[k,v]of Object.entries(c)) s.res[k]-=v;};
export function buildIssue(s,b){ if(!hasLand(s)) return 'buy land first'; if(s.buildings[b.id]>=b.max) return 'max level'; if(b.id!=='house'&&!established(s)) return 'build a Shack first'; if(!s.buildings[b.id]&&landUsed(s)+b.land>landSlots(s)) return 'no free land slot'; if(!afford(s,cost(s,b))) return 'cannot afford'; return null; }
export function build(s,id){ const b=D.buildings.find(x=>x.id===id); if(buildIssue(s,b)) return false; const c=cost(s,b); if(!afford(s,c)) return false; pay(s,c); s.buildings[id]++; log(s,`🏗️ ${buildingLevelName(b,s.buildings[id])} ${s.buildings[id]>1?'upgraded to Lv'+s.buildings[id]:'built'}.`); if(id==='house'&&s.buildings.house===1&&!s.rooms.length){ s.rooms.push('living'); log(s,'🛏️ The Shack has a living space; choose its second room.'); } return true; }
export const furnSlots=s=>established(s)?s.rooms.length*ES().furniturePerRoom+(hasService(s,'storage')?3:0):0;
export function buyFurniture(s,id){ const f=D.furniture.find(x=>x.id===id); if(s.furniture.includes(id)||s.furniture.length>=furnSlots(s)||!afford(s,f.cost)) return false; pay(s,f.cost); s.furniture.push(id); log(s,`🪑 Placed ${f.name}.`); return true; }
export function equip(s,m,itemId,from='vault'){ const src=from==='bag'?m.bag:s.vault; const i=src.indexOf(itemId); const it=D.items.find(x=>x.id===itemId); if(i<0||it.slot==='gift') return false; src.splice(i,1); if(m.equip[it.slot]) m.bag.push(m.equip[it.slot]); m.equip[it.slot]=itemId; return true; }
export const sellValue=(s,it)=>Math.round(it.value*(hasService(s,'appraisal')?1:.5));
export function sell(s,itemId){ const i=s.vault.indexOf(itemId); if(i<0) return; s.vault.splice(i,1); s.res.coin+=sellValue(s,D.items.find(x=>x.id===itemId)); }
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
export function moveItem(s,m,id,toBag){ const a=toBag?s.vault:m.bag, b=toBag?m.bag:s.vault; const i=a.indexOf(id); if(i<0) return false; a.splice(i,1); b.push(id); return true; }
export const buyPrice=(it)=>Math.round(it.value*T.buyMarkup);
export function buyItem(s,townId,itemId){ const t=D.towns.find(x=>x.id===townId); const it=D.items.find(x=>x.id===itemId); if(!t.shop.includes(itemId)||s.res.coin<buyPrice(it)) return false; s.res.coin-=buyPrice(it); s.vault.push(itemId); log(s,`🛒 Bought ${it.name}.`); return true; }
export function sellRes(s,townId,res,n){ const t=D.towns.find(x=>x.id===townId); n=Math.min(n,Math.floor(s.res[res])); if(n<=0) return false; s.res[res]-=n; s.res.coin+=n*t.prices[res]; return true; }
export function rumor(s,regionId){ if(s.res.coin<T.rumorCost) return null; const pool=[...D.quests,...D.nodes].filter(x=>x.region===regionId&&x.hidden&&!s.revealed.includes(x.id)); s.res.coin-=T.rumorCost; gainXp(s,active(s),'etiquette',T.xpPerDay);
  if(rng()<D.minions.rumorRecruitChance && minionRoom(s)){ addMinion(s,r(D.minions.types.filter(t=>!t.special&&t.id!=='refugee')).id,'found through a rumor'); return {recruit:true}; }
  if(!pool.length||rng()<0.3){ log(s,'🗣️ The tavern talk was idle gossip.'); return false; } const x=r(pool); s.revealed.push(x.id); log(s,`🗣️ Rumor: ${x.name} discovered!`); return x; }

// ---- minions (followers, hired help, retainers)
export const minionCap=s=>D.minions.baseCap+bl(s,'house')*D.minions.capPerHouse+(hasService(s,'storage')?2:0);
export const minionRoom=s=>s.minions.filter(x=>!x.special).length<minionCap(s);
const mtype=id=>D.minions.types.find(t=>t.id===id);
export function minionPower(s,job){ return (s.minions||[]).filter(x=>x.job===job).reduce((a,x)=>a+(mtype(x.type).apt[job]||1),0); }
export function addMinion(s,type,why){ if(!mtype(type).special&&!minionRoom(s)) { log(s,`🚪 No room for a new follower (${why}).`); return null; }
  const t=mtype(type); const mi={uid:'mi'+(s.nextId++),type,name:t.special?t.name:r(D.minions.names),job:'idle',loyalty:100,since:s.day}; if(t.special){mi.special=true;mi.source=why;}
  s.minions.push(mi); log(s,`🤝 ${mi.name} the ${t.name} joined (${why}).`); return mi; }
export const hireable=(s,townId)=>(D.minions.hireAt[townId]||[]).map(mtype);
export function hire(s,townId,type){ const t=mtype(type); if(!(D.minions.hireAt[townId]||[]).includes(type)||s.res.coin<t.hire||!minionRoom(s)) return null; s.res.coin-=t.hire; return addMinion(s,type,'hired in town'); }
export function jobOpen(s,jobId){ const j=D.minions.jobs.find(x=>x.id===jobId); return !!j&&(jobId==='idle'||(established(s)&&jobCap(s,jobId)>0)); }
export const jobUsed=(s,job,except)=>s.minions.filter(x=>x.job===job&&x.uid!==except).length;
export function assignMinion(s,uid,job){ const mi=s.minions.find(x=>x.uid===uid); if(!mi||!jobOpen(s,job)||jobUsed(s,job,uid)>=jobCap(s,job)) return false; mi.job=job; return true; }
export function dismiss(s,uid){ const i=s.minions.findIndex(x=>x.uid===uid); if(i<0) return false; log(s,`👋 ${s.minions[i].name} was dismissed.`); s.minions.splice(i,1); return true; }
export const monthlyWages=s=>s.minions.reduce((a,x)=>a+mtype(x.type).wage,0);
function minionDay(s){
  if(!s.minions){s.minions=[];s.repLevel=0;}
  checkSpecialMinions(s);
  for(const mi of s.minions){ const a=mtype(mi.type).apt[mi.job]||1;
    if(mi.job==='farm') s.res.food+=3*a*(1+bl(s,'farm')*.2);
    else if(mi.job==='gather'){ s.res.wood+=2*a; s.res.stone+=1*a; }
    else if(mi.job==='herbs') s.res.herbs=(s.res.herbs||0)+1.5*a;
    else if(mi.job==='craft'){ mi.prog=(mi.prog||0)+0.2*a; if(mi.prog>=T.craftDays){ mi.prog=0; if(afford(s,T.craftCost)){ pay(s,T.craftCost); const it=r(D.items.filter(i=>i.slot!=='gift'&&i.rarity==='Common')); s.vault.push(it.id); log(s,`🔧 ${mi.name} crafted ${it.name}.`);} } } }
  s.res.food=Math.max(0,s.res.food-s.minions.length*0.5);
  if(s.day%30===0 && s.minions.length){ const w=monthlyWages(s);
    if(s.res.coin>=w){ s.res.coin-=w; for(const mi of s.minions) mi.loyalty=Math.min(100,mi.loyalty+10); }
    else { s.res.coin=0; for(const mi of [...s.minions]){ mi.loyalty-=D.minions.loyaltyLossUnpaid; if(mi.loyalty<=0){ s.minions=s.minions.filter(x=>x!==mi); log(s,`💸 ${mi.name} left over unpaid wages.`);} } log(s,'💸 Wages went unpaid; loyalty fell.'); } }
  const lvl=Math.floor(s.renown/D.minions.reputationEveryRenown); if(lvl>s.repLevel){ s.repLevel=lvl; if(established(s)&&minionRoom(s)) addMinion(s,r(D.minions.types.filter(t=>!t.special&&t.id!=='refugee'&&t.id!=='tutor')).id,"drawn by the estate's reputation"); }
}

// ---- guilds
export function normalize(s){ if(!s.unlocks) s.unlocks=[];
  for(const b of D.buildings) if(s.buildings[b.id]===undefined) s.buildings[b.id]=0;
  if(!s.land){ s.land=[]; s.rooms=[]; // migrate pre-land saves
    if(D.buildings.some(b=>bl(s,b.id)>0)){ for(const l of ES().lands){ if(landSlots(s)>=landUsed(s)&&s.land.length) break; s.land.push(l.id); }
      if(bl(s,'house')>0){ const need=Math.max(1,Math.ceil((s.members.filter(m=>m.alive).length-1)/2)); const cap=interiorSlots(s); for(let i=0;i<need&&s.rooms.length<cap;i++) s.rooms.push('living'); const fill=['workshop','post','study']; let k=0; while(s.rooms.length<cap&&k<fill.length) s.rooms.push(fill[k++]); }
      log(s,`📜 Your existing holdings were deeded: ${s.land.length} land parcel(s), ${s.rooms.length} rooms.`); } } if(!s.doneQuests) s.doneQuests=[]; if(!s.specialGranted) s.specialGranted=[]; for(const m of s.members){ if(fixTraits(m)) log(s,`🔧 ${m.name}'s conflicting traits were resolved: ${m.traits.map(t=>traitDef(t).name).join(', ')}.`); for(const sk of D.skills) if(!m.skills[sk.id]) m.skills[sk.id]={lvl:0,xp:0}; if(m.guild===undefined) m.guild=null; if(m.guild&&!guildDef(m.guild.id)) m.guild=null; const okI=id=>D.items.some(i=>i.id===id); m.bag=(m.bag||[]).filter(okI); for(const k in m.equip) if(!okI(m.equip[k])) delete m.equip[k]; if(m.adv===undefined) m.adv=null; if(!m.bag) m.bag=[]; } s.vault=s.vault.filter(id=>D.items.some(i=>i.id===id)); if(!s.minions){s.minions=[];s.repLevel=0;} s._norm=true; }
export const guildDef=id=>D.guilds.guilds.find(g=>g.id===id);
export const rankName=r=>D.guilds.ranks[r].name;
export function trainIssue(m,skillId,s){ const sk=D.skills.find(x=>x.id===skillId); if(!sk) return 'unknown'; const a=ageY(m);
  if(sk.guild&&!(m.guild&&m.guild.id===sk.guild)) return 'guild';
  if(sk.unlockQuest&&s&&!(s.unlocks||[]).includes('skill:'+skillId)) return 'quest';
  if(a<12) return 'age12'; if(sk.family==='magic'&&a<14) return 'age14'; return null; }
export function canTrain(m,skillId,s,ignoreAge){ const i=trainIssue(m,skillId,s); return !i||(ignoreAge&&i.startsWith('age')); }
export const jobOk=(m,j)=>ageY(m)>=j.minAge;
export function activityOk(s,m,ac){ const a=ageY(m); if(a<ac.minAge||(ac.maxAge&&a>ac.maxAge)) return false; const u=ac.unlock; if(!u) return true;
  if(u.quest) return (s.unlocks||[]).includes('activity:'+ac.id); if(u.building) return bl(s,u.building)>0; return true; }
export function actionAllowed(s,m,a){ if(!a) return false; const t=a.type;
  if(t==='train') return canTrain(m,a.target,s); if(t==='job') return jobOk(m,D.jobs.find(j=>j.id===a.target)||{minAge:99});
  if(t==='activity'){ const ac=D.activities.find(x=>x.id===a.target); return !!ac&&activityOk(s,m,ac); }
  if(t==='gather'||t==='rest') return ageY(m)>=10; return false; }
export function questOk(m,q){ return !!q&&(!q.adv||(m.adv&&m.adv.rank>=q.adv))&&(!q.guild||(m.guild&&m.guild.id===q.guild&&m.guild.rank>=(q.rank||0))); }
export function joinIssues(s,m,gid){ const g=guildDef(gid), q=g.req, out=[];
  if(m.guild) out.push(m.guild.id===gid?'already a member':`sworn to ${guildDef(m.guild.id).name}`);
  if(!isAdult(m)) out.push('must be an adult');
  if(q.classAny&&!q.classAny.includes(m.cls)) out.push('class: '+q.classAny.join('/'));
  for(const[k,v]of Object.entries(q.skills||{})) if(m.skills[k].lvl<v) out.push(`${D.skills.find(x=>x.id===k).name} ${m.skills[k].lvl}/${v}`);
  if(s.res.coin<(q.coin||0)) out.push(`${q.coin} coin`);
  return out; }
export function joinGuild(s,m,gid){ if(joinIssues(s,m,gid).length) return false; const g=guildDef(gid); s.res.coin-=g.req.coin||0; m.guild={id:gid,rank:0,rep:0};
  log(s,`${g.icon} ${m.name} joined the ${g.name} as ${rankName(0)}.`); s.deeds.push(`${m.name} joined the ${g.name}.`); return true; }
export function nextRank(m){ return m.guild&&D.guilds.ranks[m.guild.rank+1]; }
export function canRankUp(s,m){ const n=nextRank(m); return !!n&&m.guild.rep>=n.rep&&s.res.coin>=n.cost; }
export function rankUp(s,m){ if(!canRankUp(s,m)) return false; const n=nextRank(m); s.res.coin-=n.cost; m.guild.rank++; s.renown+=10*m.guild.rank;
  log(s,`🎖️ ${m.name} rose to ${n.name} of the ${guildDef(m.guild.id).name}.`); s.deeds.push(`${m.name} became ${n.name} of the ${guildDef(m.guild.id).name}.`); return true; }
export const guildShop=gid=>D.items.filter(i=>i.guild===gid);
export function buyGuildItem(s,m,itemId){ const it=D.items.find(i=>i.id===itemId); if(!it||!it.guild||!m.guild||m.guild.id!==it.guild||m.guild.rank<it.rank||s.res.coin<buyPrice(it)) return false; s.res.coin-=buyPrice(it); s.vault.push(it.id); log(s,`🛒 Bought ${it.name} from the guild.`); return true; }

// ---- Adventurers' Guild (open to everyone; separate from the one-guild lock)
const AG=()=>D.guilds.adventurers;
export const advRankName=r=>AG().ranks[r].name;
export function hasService(s,svc){ const need=AG().ranks.findIndex(r=>r.unlocks===svc); return (s.members||[]).some(m=>m.alive&&m.adv&&m.adv.rank>=need); }
export function services(s){ return Object.keys(AG().services).filter(k=>hasService(s,k)); }
export function joinAdventurers(s,m){ if(m.adv||!isAdult(m)||s.res.coin<AG().joinCost) return false; s.res.coin-=AG().joinCost; m.adv={rank:0,rep:0}; log(s,`⚔️ ${m.name} registered with the Adventurers' Guild (Rank F).`); return true; }
export const advNext=m=>m.adv&&AG().ranks[m.adv.rank+1];
export function canAdvRankUp(s,m){ const n=advNext(m); return !!n&&m.adv.rep>=n.rep&&s.res.coin>=n.cost; }
export function advRankUp(s,m){ if(!canAdvRankUp(s,m)) return false; const n=advNext(m); s.res.coin-=n.cost; m.adv.rank++; s.renown+=5*m.adv.rank;
  log(s,`⚔️ ${m.name} is now Rank ${n.name} in the Adventurers' Guild${n.unlocks?' – unlocked '+n.unlocks:''}.`); return true; }
export const advShop=()=>D.items.filter(i=>i.adv);
export function buyAdvItem(s,m,id){ const it=D.items.find(i=>i.id===id); if(!it||!it.adv||!m.adv||m.adv.rank<it.adv||s.res.coin<buyPrice(it)) return false; s.res.coin-=buyPrice(it); s.vault.push(id); log(s,`🛒 Bought ${it.name} from the Adventurers' Guild.`); return true; }

// ---- special minions (from classes, guild ranks, quests)
export function specialSource(s,t){ const src=t.source, L=living(s);
  if(src.class){ const m=L.find(x=>x.cls===src.class); return m?`${cls(m).name} ${m.name}`:null; }
  if(src.guild){ const m=L.find(x=>x.guild&&x.guild.id===src.guild&&x.guild.rank>=src.rank); return m?`${rankName(src.rank)} of ${guildDef(src.guild).name}`:null; }
  if(src.quest) return (s.doneQuests||[]).includes(src.quest)?`quest: ${D.quests.find(q=>q.id===src.quest).name}`:null; return null; }
export function sourceLabel(t){ const src=t.source; if(src.class) return `Class: ${D.classes.find(c=>c.id===src.class).name}`; if(src.guild) return `${guildDef(src.guild).name} – ${rankName(src.rank)}`; return `Quest: ${D.quests.find(q=>q.id===src.quest).name}`; }
export function checkSpecialMinions(s){ for(const t of D.minions.types.filter(x=>x.special)){ if(s.specialGranted.includes(t.id)) continue; const why=specialSource(s,t); if(why){ s.specialGranted.push(t.id); addMinion(s,t.id,why); } } }
