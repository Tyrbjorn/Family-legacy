import { chromium } from "playwright";
const b=await chromium.launch(),p=await b.newPage({deviceScaleFactor:1,viewport:{width:640,height:120}});
await p.goto('http://localhost:8137/');await p.waitForFunction(()=>window.__game);
await p.evaluate(async()=>{const {iconHtml}=await import('/js/art.js');const A=await (await fetch('/data/art.json')).json();
document.body.innerHTML='<div id=st style="background:#201c24;padding:8px;display:flex;gap:16px;color:#ddd;font:12px sans-serif">'+['ore','copperore','tinore','silverore','goldore','mithrilore','adamantore'].map(k=>'<div style="text-align:center">'+iconHtml(A,'res',k,null,{emoji:'x',size:64})+'<br>'+k+'</div>').join('')+'</div>';});
await p.waitForTimeout(500);await p.locator('#st').screenshot({path:'/tmp/strip1.png'});await b.close();
