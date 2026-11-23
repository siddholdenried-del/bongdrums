import {spawn} from "node:child_process";
import {mkdtemp,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import assert from "node:assert/strict";
const dir=await mkdtemp(join(tmpdir(),"bd-chrome-"));
const proc=spawn(process.env.CHROME_BIN || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",["--headless","--disable-gpu","--disable-background-timer-throttling","--no-first-run","--autoplay-policy=no-user-gesture-required","--remote-debugging-port=48570","--user-data-dir="+dir,"about:blank"],{stdio:"ignore"});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
try{
let list;for(let i=0;i<50&&!list;i++){try{list=await(await fetch("http://127.0.0.1:48570/json/list")).json()}catch{await wait(150)}}
assert.ok(list?.length,"Chrome local debugging not reachable");
const ws=new WebSocket(list[0].webSocketDebuggerUrl); await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
const pending=new Map();let id=0;
ws.onmessage=({data})=>{let m=JSON.parse(data);if(pending.has(m.id)){const [yes,no]=pending.get(m.id);pending.delete(m.id);m.error?no(m.error):yes(m.result)}};
const call=(method,params={})=>new Promise((yes,no)=>{pending.set(++id,[yes,no]);ws.send(JSON.stringify({id,method,params}))});
await call("Page.enable");
await call("Page.addScriptToEvaluateOnNewDocument",{source:`const Base=AudioContext;
window.AudioContext=class extends Base{
 constructor(opts){super(opts);window.witness=this;window.scope=this.createAnalyser();}
 createGain(){const gain=super.createGain();gain.connect(window.scope);return gain;}
};`});
const js=async expression=>{
const r=await call("Runtime.evaluate",{expression,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;
};
const root="http://127.0.0.1:48795";
await call("Page.navigate",{url:root});await wait(600);
assert.equal(await js('document.querySelectorAll(".step").length'),176);
assert.equal(await js('typeof window.witness'),"undefined");
const q=()=>js('(()=>{let v=new Float32Array(window.scope.fftSize);window.scope.getFloatTimeDomainData(v);return Math.max(...v.map(Math.abs));})()');
await js('document.querySelector("#play").click()');
for(let i=0;i<30&&await js('document.querySelector("#status").innerText')!=="Playing";i++)await wait(100);
assert.equal(await js('document.querySelector("#status").innerText'),"Playing");
assert.equal(await js('window.witness.sampleRate'),44100);
let peak=0;
for(let i=0;i<20;i++){peak=Math.max(peak,await q());await wait(70);}
assert.ok(peak>.04,"live audio peak "+peak);
assert.ok(await js('document.querySelectorAll(".step.current").length')===11);
console.log("Web Audio started; actual 44.1 kHz worklet, peak",peak);

for(const [width,height] of [[390,844],[1440,900]]){
 await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});
 const sel='.step[data-pad="0"][data-step="0"]';
 await js("document.querySelector('#substeps').click()");
 const xy=await js(`(()=>{const r=document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);
 if(width<500){
   await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[xy]});
   await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }else await js(`document.querySelector(${JSON.stringify(sel)}).click()`);
 assert.equal(await js("document.querySelector('dialog').open"),true);
 await js("document.querySelector('#substep-count button:nth-child(3)').click();document.querySelector('#substep-cells button:nth-child(2)').click()");
 const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile('/tmp/bongdrums-substeps-'+width+'.png',Buffer.from(shot.data,'base64'));
 await js("document.querySelector('#substep-apply').click()");
 assert.equal(await js(`document.querySelector(${JSON.stringify(sel)}).textContent`),'3');
 assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'));
}
await wait(250);await call('Page.reload');await wait(800);
assert.equal(await js('document.querySelector(".step").textContent'),'3','split survives reload');
await js("document.querySelector('.step').focus()");
await call('Input.dispatchKeyEvent',{type:'rawKeyDown',code:'Enter',key:'Enter',windowsVirtualKeyCode:13,modifiers:8});
await call('Input.dispatchKeyEvent',{type:'keyUp',code:'Enter',key:'Enter',windowsVirtualKeyCode:13,modifiers:8});
assert.equal(await js("document.querySelector('dialog').open"),true);
assert.match(await js("document.querySelector('#substep-cells button:nth-child(2)').getAttribute('aria-label')"),/^Substep 2: /);
await call('Input.dispatchKeyEvent',{type:'rawKeyDown',code:'Escape',key:'Escape',windowsVirtualKeyCode:27});
await call('Input.dispatchKeyEvent',{type:'keyUp',code:'Escape',key:'Escape',windowsVirtualKeyCode:27});
assert.equal(await js("document.querySelector('dialog').open"),false);
await js("document.querySelector('#bench').click()");
for(let i=0;i<60&&!await js("document.querySelector('#dsp-load').value.includes('OFFLINE')");i++)await wait(150);
assert.match(await js("document.querySelector('#dsp-load').value"),/% OF BUDGET · OFFLINE$/);
console.log('Physical Shift+Enter, Escape and offline benchmark of split pattern passed.');
console.log('Verified 390 touch / 1440 mouse, compact dialog, active audio, persisted split.');
}finally{proc.kill();}
