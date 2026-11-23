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
// Change the edited bank without disturbing the live one.
await js(`document.querySelector('[data-pattern="1"]').click();document.querySelector(".step").click();`);
assert.deepEqual(await js(`[document.querySelector("#bank-readout").textContent,document.querySelector("#load-label").textContent]`),["Ready A","Load into B"]);
await js(`document.querySelector("#play").click();`);
for(let i=0;i<30&&await js('document.querySelector("#status").textContent')!=="Playing";i++)await wait(50);
await js(`document.querySelector("#activate-bank").click();`);
assert.match(await js(`document.querySelector("#bank-readout").textContent`),/Queued B/);
for(let i=0;i<45&&!((await js('document.querySelector("#bank-readout").textContent'))==="Playing B");i++)await wait(90);
assert.equal(await js('document.querySelector("#bank-readout").textContent'),"Playing B");
await js(`const update=(id,value,type)=>{const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event(type));};
document.querySelector(".mute").click();update("swing",68,"input");update("lfo-0-depth",55,"input");update("lfo-1-lane",1,"change");update("lfo-1-depth",30,"input");`);
const pp={kind:"BongDrums Pattern",version:1,bpm:155,swing:63,banks:Array.from({length:2},(_,b)=>Array.from({length:11},(_,p)=>(p===0&&b===1?"X...............":"................")))};
const dd={kind:"BongDrums Drum Preset",version:1,voice:"kick",recipe:0,edits:[[0,620]]};
async function drop(id,s){
  await js(`(()=>{const f=new DataTransfer();f.items.add(new File([${JSON.stringify(JSON.stringify(s))}],"bongdrums.txt",{type:"text/plain"}));
  document.getElementById(${JSON.stringify(id)}).dispatchEvent(new DragEvent("drop",{dataTransfer:f}));})()`);
  await wait(80);
}
await drop("pattern-drop",pp);
await js('document.querySelector("#pattern-apply").click()');assert.match(await js('document.querySelector("#pattern-notice").textContent'),/Stop playback/);
await js('document.querySelector("#play").click();document.querySelector("#pattern-apply").click()');
assert.equal(await js('document.querySelector("#swing").value'),"63");
await drop("preset-drop",{...dd,voice:"snare"});assert.match(await js('document.querySelector("#preset-notice").textContent'),/matching pad/);
await drop("preset-drop",dd);await js('document.querySelector("#preset-apply").click()');
assert.equal(await js('document.querySelector("#param-0").value'),"620");
await js(`window.offered=null;const mk=URL.createObjectURL;URL.createObjectURL=(f)=>{window.offered=f;return mk(f);};document.querySelector("#pattern-export").click();`);
const offered=await call("Runtime.evaluate",{expression:"window.offered.text()",returnByValue:true,awaitPromise:true});assert.deepEqual(JSON.parse(offered.result.value),pp);
await wait(180);await call("Page.reload");await wait(550);
assert.deepEqual(await js(`[document.querySelector(".step").dataset.state,document.querySelector(".mute").getAttribute("aria-pressed"),document.querySelector("#swing").value,document.querySelector("#lfo-0-depth").value,document.querySelector("#lfo-1-depth").value,document.querySelector("#bank-readout").textContent]`),["2","true","63","55","30","Ready B"]);
await js(`localStorage.removeItem("bongdrums-preview-v2");localStorage.setItem("bongdrums-preview-v1",JSON.stringify({bpm:116,rows:Array.from({length:11},()=>Array(16).fill(1))}));`);
await call("Page.reload");await wait(550);
assert.deepEqual(await js(`[document.querySelector(".step").dataset.state,document.querySelector("#swing").value,document.querySelector("#lfo-0-depth").value,document.querySelector("#tempo").value]`),["1","50","0","116"]);
await js(`document.querySelector('[data-pattern="1"]').click()`);assert.equal(await js('document.querySelector(".step").dataset.state'),"0");
console.log("Real browser A/B queue, mute/swing/LFO persistence, staged file import/export and v1 migration passed");
// Kits, patterns and the musical key layout (A S D / E R T / J K L / U I).
await js(`(()=>{const k=document.getElementById("kit");k.value="2";k.dispatchEvent(new Event("change"));})()`);
assert.deepEqual(await js(`[document.querySelector("#kit").selectedOptions[0].text,document.querySelector("#recipe").selectedOptions[0].text]`),["909 WAREHOUSE","909 PUNCH"]);
await js(`document.querySelector("#groove-next").click()`);
assert.ok(await js(`document.querySelector("#groove").value!=="-1"&&document.querySelector("#tempo").value>0`));
for(const [code,name] of [["KeyA","01 KICK"],["KeyR","05 MID TOM"],["KeyK","08 OPEN HAT"],["KeyI","11 PERC B"]]){
  await js(`document.body.dispatchEvent(new KeyboardEvent("keydown",{code:"${code}",bubbles:true}))`);
  assert.equal(await js(`document.querySelector("#sound-heading").textContent`),name);
}
await js(`(()=>{const l=document.getElementById("mix-level-1");l.value=40;l.dispatchEvent(new Event("input"));})()`);
assert.equal(await js(`document.querySelector("#kit").value`),"-1");
// Pickers: a button opens a tile sheet; a tile sets the hidden select; Escape closes.
await js(`document.querySelector('.modes [data-tab=sequence]').click();document.getElementById("kit-p").click()`);
assert.deepEqual(await js('[document.getElementById("sheet").hidden,document.querySelectorAll("#sheet-grid .tile").length]'),[false,11]);
await js('document.querySelectorAll("#sheet-grid .tile")[5].click()');
assert.deepEqual(await js('[document.getElementById("sheet").hidden,document.querySelector("#kit").value,document.getElementById("kit-p").title]'),[true,"5","Kit: DUB CHAMBER"]);
await js(`document.querySelector('.modes [data-tab=drum]').click()`);
await js('document.getElementById("drum-pick").click()');
await call("Input.dispatchKeyEvent",{type:"keyDown",key:"Escape",code:"Escape",windowsVirtualKeyCode:27});
assert.equal(await js('document.getElementById("sheet").hidden'),true);
await js('document.getElementById("preset-p").click()');await js('document.querySelectorAll("#sheet-grid .tile")[1].click()');
assert.equal(await js('document.querySelector("#recipe").value'),"1");
console.log("Kit and pattern library, musical hotkeys and custom-kit marking, tile pickers and preset buttons passed");
// Views are display only: switching through all five keeps playback, the playing bank and tails.
await js('document.querySelector("#play").click()');
for(let i=0;i<30&&await js('document.querySelector("#status").textContent')!=="Playing";i++)await wait(50);
const before=await js('document.querySelector("#bank-readout").textContent');
for(const v of ["drum","lfo","mixer","bus","sequence"])await js(`document.querySelector('.modes [data-tab=${v}]').click()`);
await wait(200);
assert.deepEqual(await js('[document.querySelector("#status").textContent,document.querySelector("#bank-readout").textContent,document.body.dataset.view]'),["Playing",before,"sequence"]);
let livePeak=0;for(let i=0;i<10;i++){livePeak=Math.max(livePeak,await q());await wait(60);}assert.ok(livePeak>.02,"still sounding after view changes "+livePeak);
// Returns: real controls, saved with the rest of the state.
await js(`(()=>{const r=document.getElementById("return-0");r.value=120;r.dispatchEvent(new Event("input"));})()`);
await js('document.querySelector("#play").click()');
// Editors size their knobs to the space; the BUS scope draws the live output; mutes sit at the right.
await call("Emulation.setDeviceMetricsOverride",{width:1280,height:720,deviceScaleFactor:1,mobile:false});await wait(200);
await js(`document.querySelector('.modes [data-tab=drum]').click()`);await wait(120);
assert.ok(await js('parseFloat(getComputedStyle(document.querySelector("#params .dial")).width)')>=90,"drum knobs fill their space");
await js(`document.querySelector('.modes [data-tab=sequence]').click()`);await wait(80);
assert.deepEqual(await js('(()=>{const l=document.querySelector(".score .lane").getBoundingClientRect(),m=document.querySelector(".score .mute").getBoundingClientRect(),s=document.querySelector(".score .step[data-step=\'15\']").getBoundingClientRect();return [Math.abs(l.width-m.width)<1&&Math.abs(l.height-m.height)<1,m.left>s.right]})()'),[true,true],"audition and mute buttons match; mute is right of step 16");
await js('document.querySelector("#play").click()');for(let i=0;i<30&&await js('document.querySelector("#status").textContent')!=="Playing";i++)await wait(50);
await js(`document.querySelector('.modes [data-tab=bus]').click()`);await wait(500);
assert.ok(await js('(()=>{const c=document.getElementById("bus-scope"),d=c.getContext("2d").getImageData(0,0,c.width,c.height).data;let lit=0;for(let i=0;i<d.length;i+=4)if(d[i+2]>150&&d[i]<120)lit++;return lit})()')>50,"scope draws the output");
// LFO view: the read point stays centred while the waveform scrolls through it.
await js(`document.querySelector('.modes [data-tab=lfo]').click();(()=>{const l=document.getElementById("lfo-0-lane");l.value="1";l.dispatchEvent(new Event("change"));const d=document.getElementById("lfo-0-depth");d.value=80;d.dispatchEvent(new Event("input"));})()`);
const lfoRead=`(()=>{const c=document.querySelector('.lfo-slot[data-slot="0"] canvas');return [c.dataset.read,String(Math.floor(c.width/2)),c.dataset.phase]})()`;
await wait(200);const lfoA=await js(lfoRead);await wait(350);const lfoB=await js(lfoRead);
assert.equal(lfoA[0],lfoA[1]);assert.equal(lfoB[0],lfoB[1]);assert.notEqual(lfoA[2],lfoB[2],"waveform scrolls through the fixed centre read column");
// VHS pixelation is on by default and FX OFF removes it.
assert.match(await js('getComputedStyle(document.querySelector(".app")).filter'),/pixelate/);
await js('(()=>{const f=document.getElementById("fx-off");f.checked=true;f.dispatchEvent(new Event("change"))})()');
assert.equal(await js('getComputedStyle(document.querySelector(".app")).filter'),"none");
await js('(()=>{const f=document.getElementById("fx-off");f.checked=false;f.dispatchEvent(new Event("change"))})()');
// FM-1 style: at most four knobs per page, a page bar, a screen that follows what you touch, and pop-up readouts elsewhere.
await js(`document.querySelector('.modes [data-tab=drum]').click();document.querySelector("#voice-tabs, #drum-pick");`);
await js(`(()=>{const s=document.getElementById("voice-next");while(document.getElementById("sound-heading").textContent!=="01 KICK")s.click();})()`);
assert.deepEqual(await js('[document.querySelectorAll("#params .knob").length,document.getElementById("page-val").textContent]'),[4,"PAGE 1/2"]);
await js('document.getElementById("page-next").click()');
assert.deepEqual(await js('[document.querySelectorAll("#params .knob").length,document.getElementById("page-val").textContent,document.querySelector("#params .knob .kl").textContent]'),[4,"PAGE 2/2","CLICK LEVEL"]);
await js('(()=>{const i=document.querySelectorAll("#params .knob-input")[2];i.value=-400;i.dispatchEvent(new Event("input",{bubbles:true}))})()');
assert.deepEqual(await js('[document.getElementById("lcd-label").textContent,document.getElementById("lcd-value").value]'),["TONE","DARK 40%"]);
await js('document.getElementById("page-prev").click()');
await js(`document.querySelector('.modes [data-tab=mixer]').click();(()=>{const f=document.getElementById("mix-level-2");f.value=60;f.dispatchEvent(new Event("input",{bubbles:true}))})()`);
assert.deepEqual(await js('[document.getElementById("lcd-pop").classList.contains("on"),document.querySelector("#lcd-pop span").textContent]'),[true,"SD LEVEL"]);
await js('document.querySelector("#play").click()');await js(`document.querySelector('.modes [data-tab=sequence]').click()`);
console.log("Five views switch without stopping playback; return controls, knob fitting, scope, scrolling LFO, pixelation toggle and mute placement wired");
// One-screen instrument: no page scroll at phone or desktop sizes.
for(const [w,h] of [[320,568],[390,844],[1280,720],[1440,900]]){
 await call("Emulation.setDeviceMetricsOverride",{width:w,height:h,deviceScaleFactor:1,mobile:w<760});await wait(250);
 for(const v of ["drum","lfo","mixer","bus","sequence"]){
  await js(`document.querySelector('.modes [data-tab=${v}]').click()`);
  const o=await js('({sh:document.documentElement.scrollHeight,h:innerHeight,sw:document.documentElement.scrollWidth,w:innerWidth})');
  assert.ok(o.sh<=o.h&&o.sw<=o.w,`${v} scrolls at ${w}x${h}`);
  // Nothing visible may be clipped off the right edge (overflow is hidden, so scroll checks can't see it).
  const clipped=await js(`[...document.querySelectorAll(".app *")].filter(e=>e.offsetParent&&e.getClientRects().length&&!e.closest(".menu-body")).map(e=>[e,e.getBoundingClientRect()]).filter(([e,r])=>r.width>0&&r.right>innerWidth+1).map(([e,r])=>(e.id||e.className||e.tagName)+"@"+Math.round(r.right)).slice(0,5)`);
  assert.deepEqual(clipped,[],`${v} clips at ${w}x${h}`);
  // The menu stays on the transport row.
  const rowGap=await js('(()=>{const m=document.querySelector(".menu summary").getBoundingClientRect(),p=document.getElementById("play").getBoundingClientRect();return [Math.round(m.top),Math.round(m.bottom),Math.round(p.top),Math.round(p.bottom),Math.round(m.right),innerWidth,document.querySelector(".bar").scrollWidth]})()');
  assert.ok(rowGap[0]<rowGap[3]&&rowGap[1]>rowGap[2],`menu wraps at ${w}x${h}: ${JSON.stringify(rowGap)}`);
 }
 const p=await js('({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,steps:[...document.querySelectorAll(".step")].filter(s=>s.offsetParent).length})');
 assert.ok(p.sw<=p.w&&p.sh<=p.h,`page scrolls at ${w}x${h}: ${JSON.stringify(p)}`);
 assert.equal(p.steps,176,"all 16 steps of all 11 drums on one screen at "+w);
 const s=await call("Page.captureScreenshot",{format:"png"});await writeFile(`BongDrums-${w}.png`,Buffer.from(s.data,"base64"));
}
console.log("No page scroll or clipped content in any view at 320x568, 390x844, 1280x720 and 1440x900; all 176 steps on one screen at every size");
ws.close();
}finally{proc.kill();}
