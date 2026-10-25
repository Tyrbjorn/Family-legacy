import fs from 'fs';
const rd=f=>Object.fromEntries(fs.readFileSync(f,'utf8').trim().split('\n').map(l=>JSON.parse(l)).map(r=>[r.seed,r]));
const A=rd('test/r75-m-nohall.txt'),B=rd('test/r75-m-hall.txt');
const med=a=>{a=[...a].sort((x,y)=>x-y);const n=a.length;return n?(n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2):NaN;};
const seeds=Object.keys(A).filter(k=>B[k]).sort((a,b)=>a-b);
const sum=(a,i,j)=>a.slice(i,j).reduce((x,y)=>x+y,0);
const pc=(a,b)=>((b-a)/a*100);
console.log('paired seeds',seeds.join(','),'n=',seeds.length);
const rows=[];
for(const k of seeds){const a=A[k],b=B[k];rows.push({k,hall:b.hall.join(' '),inc10:pc(sum(a.inc,0,10),sum(b.inc,0,10)),inc20:pc(sum(a.inc,0,20),sum(b.inc,0,20)),inc40:pc(sum(a.inc,0,40),sum(b.inc,0,40)),yr11_40:pc(sum(a.inc,10,40),sum(b.inc,10,40)),late:pc(sum(a.inc,30,40),sum(b.inc,30,40)),ren:pc(a.renown,b.renown),fol:b.followers-a.followers,coin:pc(a.coin,b.coin),pileA:a.pile,pileB:b.pile});}
const f=x=>(x>=0?'+':'')+x.toFixed(1)+'%';
console.log('seed hall | gross coin y1-10, y1-20, y1-40, y11-40, y31-40 | renown | followers d | final coin | pile A->B');
for(const r of rows)console.log(r.k,r.hall,'|',f(r.inc10),f(r.inc20),f(r.inc40),f(r.yr11_40),f(r.late),'|',f(r.ren),'|',r.fol,'|',f(r.coin),'|',r.pileA.toFixed(0),'->',r.pileB.toFixed(0));
const M=k=>f(med(rows.map(r=>r[k])));
console.log('MEDIAN paired % diff: inc y1-10',M('inc10'),'y1-20',M('inc20'),'y1-40',M('inc40'),'y11-40',M('yr11_40'),'y31-40',M('late'),'renown',M('ren'),'final coin',M('coin'),'followers d',med(rows.map(r=>r.fol)));
const mx=k=>f(Math.max(...rows.map(r=>Math.abs(r[k])))); console.log('MAX |diff|: inc y1-40',mx('inc40'),'renown',mx('ren'),'final coin',mx('coin'));
console.log('median hall T1 year',med(seeds.map(k=>parseFloat((B[k].hall[0]||'T1@y0').split('@y')[1]))),'T3',med(seeds.map(k=>parseFloat((B[k].hall[2]||'T3@y0').split('@y')[1]))));
console.log('median pile loss nohall',med(seeds.map(k=>A[k].pile)).toFixed(1),'hall',med(seeds.map(k=>B[k].pile)).toFixed(1));
console.log('--- median gross coin per year by decade (nohall -> hall)');
for(const [i,j] of [[0,10],[10,20],[20,30],[30,40]]){const a=med(seeds.map(k=>sum(A[k].inc,i,j)/10)),b=med(seeds.map(k=>sum(B[k].inc,i,j)/10));console.log(`y${i+1}-${j}:`,Math.round(a),'->',Math.round(b),f(pc(a,b)));}
