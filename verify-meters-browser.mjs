import {spawn} from "node:child_process";
import {mkdtemp,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import assert from "node:assert/strict";
const dir=await mkdtemp(join(tmpdir(),"bd-chrome-"));
const proc=spawn(process.env.CHROME_BIN || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",["--headless","--disable-gpu","--disable-background-timer-throttling","--no-first-run","--autoplay-policy=no-user-gesture-required","--remote-debugging-port=48639","--user-data-dir="+dir,"about:blank"],{stdio:"ignore"});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
try{
let list;for(let i=0;i<150&&!list;i++){try{list=await(await fetch("http://127.0.0.1:48639/json/list")).json()}catch{await wait(150)}}
assert.ok(list?.length,"Chrome local debugging not reachable");
const ws=new WebSocket(list[0].webSocketDebuggerUrl); await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
const pending=new Map();let id=0;
ws.onmessage=({data})=>{let m=JSON.parse(data);if(pending.has(m.id)){const [yes,no]=pending.get(m.id);pending.delete(m.id);m.error?no(m.error):yes(m.result)}};
const call=(method,params={})=>new Promise((yes,no)=>{pending.set(++id,[yes,no]);ws.send(JSON.stringify({id,method,params}))});
await call("Page.enable");
await call("Runtime.enable");
let errors=[];const original=ws.onmessage;ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.method==="Runtime.exceptionThrown")errors.push(m.params.exceptionDetails.text);original(e);};
const js=async expression=>{const r=await call("Runtime.evaluate",{expression,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};

await call("Page.addScriptToEvaluateOnNewDocument",{source:`const AC=AudioContext;window.AudioContext=class extends AC{constructor(...a){super(...a);window.witness=this;}createGain(){const g=super.createGain();window.scope=super.createAnalyser();g.connect(window.scope);return g;}};`});
await call("Page.navigate",{url:"http://127.0.0.1:48627/"});for(let i=0;i<100&&await js('document.querySelectorAll(".lane-meter").length')!==11;i++)await wait(200);
await js(`document.querySelector('[data-tab=mixer]').click()`);
assert.equal(await js('document.querySelectorAll(".lane-meter").length'),11);
assert.equal(await js('document.querySelectorAll("#returns,[id^=mix-send-]").length'),0);
const codes=["KeyA","KeyS","KeyD","KeyE","KeyR","KeyT","KeyJ","KeyK","KeyL","KeyU","KeyI"];
const peaks=await js(`new Array(11).fill(-60)`);
for(const code of codes){
 await js(`document.body.dispatchEvent(new KeyboardEvent("keydown",{code:"${code}",bubbles:true}))`);await wait(160);
 const d=await js('[...document.querySelectorAll(".lane-meter")].map(m=>Number(m.getAttribute("aria-valuenow")))');for(let i=0;i<11;i++)peaks[i]=Math.max(peaks[i],d[i]);
}
console.log("all 11 browser meter peaks",peaks);assert.ok(peaks.every(v=>v>-45));
assert.equal(await js('window.witness.sampleRate'),44100);
await js(`document.querySelector('[data-tab=bus]').click();document.querySelector('#play').click();`);await wait(420);
const c=await js(`(()=>{const c=document.querySelector('#bus-scope'),a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return [...a].filter((v,i)=>i%4===2&&v>=100).length;})()`);
assert.ok(c>20,"scope should paint audio trace");
await js(`document.querySelector('#bench').click()`);assert.match(await js('document.querySelector("#dsp-load").value'),/STOP/);
await js(`document.querySelector('#play').click();document.querySelector('#bench').click();`);
for(let i=0;i<150&&!((await js('document.querySelector("#dsp-load").value')).includes("OFFLINE"));i++)await wait(120);
console.log("bench",await js('document.querySelector("#dsp-load").value'));assert.match(await js('document.querySelector("#dsp-load").value'),/^[0-9.]+% OF BUDGET · OFFLINE$/);

await js(`document.querySelector('#play').click()`);
for(let i=0;i<40&&await js('document.querySelector("#play").getAttribute("aria-pressed")!=="true"');i++)await wait(50);
assert.equal(await js('document.querySelector("#play").getAttribute("aria-pressed")'),"true");
await js(`document.querySelector('#play').click()`);
await js(`document.querySelector("#mixer button.strip-name").click()`);

const file={kind:"BongDrums Drum Preset",version:1,voice:"kick",recipe:0,edits:[[0,620]]};
await js(`(()=>{const f=new DataTransfer();f.items.add(new File([${JSON.stringify(JSON.stringify(file))}],"old-bongdrums.txt",{type:"text/plain"}));document.querySelector('#preset-drop').dispatchEvent(new DragEvent('drop',{dataTransfer:f}));})()`);
for(let i=0;i<30&&await js('document.querySelector("#preset-apply").disabled');i++)await wait(60);
await js(`document.querySelector('#preset-apply').click()`);
assert.match(await js('document.querySelector("#preset-notice").textContent'),/Imported/);
assert.deepEqual(errors,[]);ws.close();
}finally{proc.kill();}
