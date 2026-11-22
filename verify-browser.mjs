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
const root="http://127.0.0.1:48569";
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
await js(`document.querySelector("[name=busmode][value=bus]").click();document.querySelector("#macro-3").value=100;document.querySelector("#macro-3").dispatchEvent(new Event("input"));`);
let gr=0;for(let i=0;i<21;i++){gr=Math.max(gr,await js('parseFloat(document.querySelector("#limit").value)'));await wait(80);}
assert.ok(gr>0,"bus limiter activated "+gr);
await js(`document.querySelector("#play").click();document.querySelector(".step").click();document.querySelector("#tempo").value=141;document.querySelector("#tempo").dispatchEvent(new Event("change"));document.querySelector("#recipe").value=1;document.querySelector("#recipe").dispatchEvent(new Event("change"));`);
assert.equal(await js('document.querySelector("#status").innerText'),"Stopped · tails ring");
await wait(160);
await call("Page.reload");await wait(600);
assert.deepEqual(await js(`[document.querySelector(".step").dataset.state,document.querySelector("#recipe").value,document.querySelector("#tempo").value,document.querySelector("[name=busmode]:checked").value]`),["0","1","141","bus"]);
await js('document.querySelector("#audition").click()');await wait(100);
assert.ok(await q()>.002,"voice audition");
await js('document.querySelector(".step").focus()');
await call("Input.dispatchKeyEvent",{type:"keyDown",key:"ArrowRight"});
assert.equal(await js('document.activeElement.dataset.step'),"1");
console.log("Bus gain reduction",gr,"dB; persistence, preset audition, keyboard navigation passed");
for(const w of [320,390,1440]){
 await call("Emulation.setDeviceMetricsOverride",{width:w,height:1000,deviceScaleFactor:1,mobile:w<600});await wait(250);
 const p=await js('({w:innerWidth,viewport:document.documentElement.scrollWidth,grid:document.querySelector(".score-wrap").scrollWidth,clip:document.querySelector(".score-wrap").clientWidth})');
 assert.ok(p.viewport<=p.w);
 if(w<600){
   assert.ok(p.grid>p.clip);
   await js('document.querySelectorAll(".banks button")[3].click()');
   assert.ok(await js('document.querySelector(".score-wrap").scrollLeft')>400);
   await js('document.querySelectorAll(".banks button")[0].click()');
   assert.equal(await js('document.querySelector(".score-wrap").scrollLeft'),0);
 }
 const s=await call("Page.captureScreenshot",{format:"png"});await writeFile(`BongDrums-${w}.png`,Buffer.from(s.data,"base64"));
}
ws.close();
}finally{proc.kill();}
