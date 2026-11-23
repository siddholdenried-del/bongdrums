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
const root="http://127.0.0.1:48796";
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


await js("document.querySelector('[data-tab=drum]').click()");
for(const [width,height] of [[390,844],[1440,900]]){
 await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});
 const geo=()=>js(`(()=>{const rect=e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]};return {slots:[...document.querySelectorAll('#params .dial')].map(rect),labels:[...document.querySelectorAll('.deck-readbacks > *')].map(rect),rows:['#lcd','.desk-row','.desk-top'].map(s=>rect(document.querySelector(s))),page:document.querySelector('#page-val').textContent}})()`);
 let previous=await geo();
 for(let i=0;i<6;i++){
   await js("document.querySelector('#page-next').click()");
   const next=await geo();
   assert.equal(next.slots.length,4);assert.equal(next.labels.length,4);
   assert.notEqual(next.page,previous.page);
   assert.deepEqual(next.slots,previous.slots);assert.deepEqual(next.rows,previous.rows);
   next.slots.forEach((d,k)=>assert.ok(Math.abs(d[0]+d[2]/2-next.labels[k][0]-next.labels[k][2]/2)<1));
   previous=next;
 }
 await js("(()=>{const x=document.querySelector('#params input:not(:disabled)');x.value=Number(x.max);x.dispatchEvent(new Event('input',{bubbles:true}));})()");
 assert.equal(await js("document.querySelector('.deck-readbacks output').value"),await js("document.querySelector('#params .kv').value"));
 assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'));
 assert.ok(await q()>=0);
 const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile('/tmp/bong-fixed-drums-'+width+'.png',Buffer.from(shot.data,'base64'));
 console.log(width,'aligned four controls; stable pages and matching shown value');
}
}finally{proc.kill();}
