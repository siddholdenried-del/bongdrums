// SPDX-License-Identifier: GPL-3.0-only
import {exportPattern,exportPreset,parseFile,MAX_FILE,voiceIds} from "./files.js";
import {boot,apply} from "./engine.js";
import {kits,patterns,patternValues} from "./library.js";
const $=id=>document.getElementById(id);
const make=(tag,text,attrs={})=>{const e=document.createElement(tag);if(text!==null)e.textContent=text;for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);return e;};
const names=["Kick","Snare","Clap","Low Tom","Mid Tom","High Tom","Closed Hat","Open Hat","Cymbal","Perc A","Perc B"];
const short=["BD","SD","CP","LT","MT","HT","CH","OH","CY","P1","P2"];
// Musical layout: left hand plays the body (A S D), toms climb above it (E R T),
// right hand plays the metals (J K L) with percussion above (U I). Digits follow pad order.
const keyCodes=["KeyA","KeyS","KeyD","KeyE","KeyR","KeyT","KeyJ","KeyK","KeyL","KeyU","KeyI"];
const digitCodes=["Digit1","Digit2","Digit3","Digit4","Digit5","Digit6","Digit7","Digit8","Digit9","Digit0","Minus"];
const letters=["A","B"],views=["sequence","drum","lfo","mixer","bus"];
const blank=patterns.findIndex(p=>p.name==="Blank");
const lfoDefault=lane=>({lane,param:0,wave:0,sync:true,div:3,hz:100,depth:0});
const bounded=(v,lo,hi)=>Number.isInteger(v)&&v>=lo&&v<=hi;
const key="bongdrums-preview-v2",oldKey="bongdrums-preview-v1",uiKey="bongdrums-ui-v2";
const RETURN_DEFAULT=85;
let patchStore,scratch,defaultSends,timer=0;
const seed=()=>({banks:[patternValues(patterns[0]),patternValues(patterns[blank])],playBank:0,editBank:0,lfos:[lfoDefault(7),lfoDefault(9)],
  mutes:Array(11).fill(false),levels:Array(11).fill(100),pans:Array(11).fill(0),sends:defaultSends.map(s=>[...s]),returns:[RETURN_DEFAULT,RETURN_DEFAULT],
  swing:50,bpm:130,dry:true,macros:[22,64,86,64],voices:names.map(()=>({recipe:0,edits:[]})),kit:0,loaded:[0,blank]});
function setup(){
  const clean=seed();
  try{
    const k=JSON.parse(localStorage.getItem(key))||JSON.parse(localStorage.getItem(oldKey));
    if(!k)return clean;
    clean.kit=-1;clean.loaded=[-1,-1];
    const validRows=rows=>Array.isArray(rows)&&rows.length===11&&rows.every(row=>Array.isArray(row)&&row.length===16&&row.every(v=>bounded(v,0,2)));
    if(validRows(k.rows))clean.banks[0]=k.rows;
    if(Array.isArray(k.banks))for(let b=0;b<2;b++)if(validRows(k.banks[b]))clean.banks[b]=k.banks[b];
    if(bounded(k.playBank,0,1))clean.playBank=k.playBank;
    if(bounded(k.editBank,0,1))clean.editBank=k.editBank;
    if(bounded(k.swing,50,75))clean.swing=k.swing;
    if(Array.isArray(k.mutes)&&k.mutes.length===11&&k.mutes.every(v=>typeof v==="boolean"))clean.mutes=k.mutes;
    if(Array.isArray(k.lfos))for(let i=0;i<2;i++){
      const l=k.lfos[i];
      if(l&&bounded(l.lane,0,11)&&bounded(l.wave,0,2)&&typeof l.sync==="boolean"&&bounded(l.div,0,6)&&bounded(l.hz,5,1200)&&bounded(l.depth,0,100))
        clean.lfos[i]={...l,param:l.lane&&bounded(l.param,0,patchStore.bd_params(l.lane))?l.param:0};
    }
    if(Array.isArray(k.levels)&&k.levels.length===11&&k.levels.every(v=>bounded(v,0,100)))clean.levels=k.levels;
    if(Array.isArray(k.sends)&&k.sends.length===11&&k.sends.every(v=>Array.isArray(v)&&v.length===2&&v.every(n=>bounded(n,0,100))))clean.sends=k.sends;
    if(Array.isArray(k.pans)&&k.pans.length===11&&k.pans.every(n=>bounded(n,-100,100)))clean.pans=k.pans;
    if(Array.isArray(k.returns)&&k.returns.length===2&&k.returns.every(n=>bounded(n,0,127)))clean.returns=k.returns;
    if(typeof k.dry==="boolean")clean.dry=k.dry;
    if(bounded(k.bpm,60,200))clean.bpm=k.bpm;
    if(k.macros?.length===4&&k.macros.every(n=>bounded(n,0,127)))clean.macros=k.macros;
    if(k.voices?.length===11)clean.voices=k.voices.map((r,i)=>({
      recipe:bounded(r?.recipe,0,patchStore.bd_recipe_count(i+1)-1)?r.recipe:0,
      edits:Array.isArray(r?.edits)?r.edits.slice(-256).filter(e=>Array.isArray(e)&&e.length===2&&bounded(e[0],0,patchStore.bd_params(i+1)-1)&&bounded(e[1],-20000,20000)):[]
    }));
    if(bounded(k.kit,-1,kits.length-1))clean.kit=k.kit;
    if(Array.isArray(k.loaded)&&k.loaded.length===2&&k.loaded.every(n=>bounded(n,-1,patterns.length-1)))clean.loaded=k.loaded;
  }catch{}
  return clean;
}
const persist=()=>{clearTimeout(timer);timer=setTimeout(()=>{try{localStorage.setItem(key,JSON.stringify(state));}catch{}},80);};
const ui=(()=>{try{return JSON.parse(localStorage.getItem(uiKey))||{};}catch{return {};}})();
const saveUI=()=>{try{localStorage.setItem(uiKey,JSON.stringify(ui));}catch{}};

let state,ctx,port,module,connecting,playing=false,recording=false,selected=1,active=-1,focus=[0,0],stepAt=0,lfoShown=0;
let playingBank=0,queuedBank=-1,lfoPhase=[0,0];
const lanes=[],number=[],buttons=[],muteButtons=[],strips=[];
const rows=()=>state.banks[state.editBank];
const send=(kind,value)=>port?.postMessage({kind,...value});
const info=$("status"),grid=$("score");
const utf8=new TextDecoder();
const fromPtr=p=>{if(!p)return "";const v=new Uint8Array(patchStore.memory.buffer);let e=p;while(e<v.length&&v[e]!==0)e++;return utf8.decode(v.subarray(p,e));};
const turned=matchMedia("(max-width:640px) and (orientation:portrait)");

/* ---------- knob: a real range input drives a drawn dial ---------- */
const DIAL=`<svg viewBox="0 0 48 48"><g class="ticks"><line x1="24" y1="1.5" x2="24" y2="7"/><line x1="24" y1="41" x2="24" y2="46.5"/><line x1="1.5" y1="24" x2="7" y2="24"/><line x1="41" y1="24" x2="46.5" y2="24"/></g><circle class="face" cx="24" cy="24" r="18.5"/><path class="fill"/><line class="ptr" x1="24" y1="24" x2="24" y2="10"/></svg>`;
const polar=a=>{const r=(a-90)*Math.PI/180;return [24+18.5*Math.cos(r),24+18.5*Math.sin(r)];};
const arc=(a0,a1)=>{if(Math.abs(a1-a0)<.5)return "";const [x0,y0]=polar(Math.min(a0,a1)),[x1,y1]=polar(Math.max(a0,a1));return `M${x0.toFixed(2)} ${y0.toFixed(2)}A18.5 18.5 0 ${Math.abs(a1-a0)>180?1:0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;};
function knob({id,label,min,max,value,def=value,fmt=String,onInput,cls=""}){
  const wrap=make("div",null,{class:"knob "+cls});
  const input=make("input",null,{type:"range",id,min,max,step:1,class:"knob-input"});input.value=value;
  const lab=make("label",label.toUpperCase(),{for:id,class:"kl"});
  const dial=make("div",null,{class:"dial","aria-hidden":"true"});dial.innerHTML=DIAL;
  const fill=dial.querySelector(".fill"),ptr=dial.querySelector(".ptr");
  const out=make("output",null,{for:id,class:"kv"});
  wrap.append(lab,dial,out,input);
  const span=max-min,origin=min<0&&max>0?0:min,angle=v=>-135+270*(v-min)/span;
  const draw=()=>{const v=+input.value;fill.setAttribute("d",arc(angle(origin),angle(v)));ptr.setAttribute("transform",`rotate(${angle(v)} 24 24)`);
    const t=fmt(v).toUpperCase();out.value=t;input.setAttribute("aria-valuetext",t);};
  const commit=v=>{v=Math.max(min,Math.min(max,Math.round(v)));if(v===+input.value)return;input.value=v;input.dispatchEvent(new Event("input",{bubbles:true}));};
  input.addEventListener("input",()=>{draw();onInput(+input.value);});
  input.addEventListener("keydown",e=>{
    const step=Math.max(1,Math.round(span/100)),page=Math.max(1,Math.round(span/10));
    const d={ArrowUp:step,ArrowRight:step,ArrowDown:-step,ArrowLeft:-step,PageUp:page,PageDown:-page}[e.key];
    if(d){e.preventDefault();commit(+input.value+(e.shiftKey?Math.sign(d):d));}
    else if(e.key==="Home"||e.key==="End"){e.preventDefault();commit(e.key==="Home"?min:max);}
  });
  dial.addEventListener("pointerdown",e=>{
    e.preventDefault();dial.setPointerCapture(e.pointerId);input.focus({preventScroll:true});
    const y0=e.clientY,v0=+input.value;wrap.classList.add("turning");
    const move=ev=>commit(v0+(y0-ev.clientY)/(ev.shiftKey?700:170)*span);
    const up=()=>{wrap.classList.remove("turning");dial.removeEventListener("pointermove",move);dial.removeEventListener("pointerup",up);dial.removeEventListener("pointercancel",up);};
    dial.addEventListener("pointermove",move);dial.addEventListener("pointerup",up);dial.addEventListener("pointercancel",up);
  });
  dial.addEventListener("dblclick",()=>commit(def));
  dial.addEventListener("wheel",e=>{e.preventDefault();commit(+input.value+(e.deltaY<0?1:-1)*Math.max(1,Math.round(span/(e.shiftKey?400:60))));},{passive:false});
  wrap.input=input;wrap.set=v=>{input.value=v;draw();};
  draw();return wrap;
}
/* Size an editor's knobs to its box: try every row count, keep the layout with the largest dial. */
function fitKnobs(box){
  const ks=[...box.children].filter(k=>k.classList.contains("knob")&&!k.hidden),n=ks.length;
  const w=box.clientWidth,h=box.clientHeight;if(!n||!w||!h)return;
  const cs=getComputedStyle(box),gx=parseFloat(cs.columnGap)||16,gy=parseFloat(cs.rowGap)||12,extra=ks.some(k=>k.querySelector(".gr"))?18:0;
  let best=0,cols=n;
  for(let r=1;r<=n;r++){const c=Math.ceil(n/r);const size=Math.min((w-(c-1)*gx)/c/1.12,((h-(r-1)*gy)/r-extra-16)/1.62);if(size>best){best=size;cols=c;}}
  box.style.setProperty("--dial",Math.round(Math.max(38,Math.min(200,best)))+"px");box.style.gridTemplateColumns=`repeat(${cols},auto)`;
}
function fitCentre(box){const w=box.clientWidth,h=box.clientHeight;if(!w||!h)return;box.style.setProperty("--dial",Math.round(Math.max(46,Math.min(170,(h-40)/1.6,w*.17)))+"px");}
const fitter=new ResizeObserver(es=>es.forEach(e=>e.target.classList.contains("lfo-centre")?fitCentre(e.target):fitKnobs(e.target)));
/* Tile sheet: one big grid of choices instead of a native dropdown. */
let sheetReturn=null;
function openSheet(title,items,current,onPick,cols,from){
  const sheet=$("sheet"),grid=$("sheet-grid");$("sheet-title").textContent=title;
  grid.style.setProperty("--cols",cols);grid.replaceChildren();
  let first=null;
  for(const it of items){
    const b=make("button",null,{type:"button",class:"tile","aria-pressed":String(String(it.value)===String(current))});
    b.append(make("b",it.label));if(it.sub)b.append(make("small",it.sub));
    b.onclick=()=>{closeSheet();onPick(it.value);};grid.append(b);
    if(String(it.value)===String(current)||!first)first=String(it.value)===String(current)?b:first||b;
  }
  sheetReturn=from;sheet.hidden=false;(grid.querySelector("[aria-pressed=true]")||first)?.focus({preventScroll:true});
}
function closeSheet(){const s=$("sheet");if(s.hidden)return;s.hidden=true;sheetReturn?.focus({preventScroll:true});sheetReturn=null;}
/* Picker: hides a native select and shows a button that opens the tile sheet. The select stays the source of truth. */
function pickerFor(sel,{title,cols=3,label=o=>o.text,sub=()=>"",cls=""}){
  sel.classList.add("sr");sel.tabIndex=-1;sel.setAttribute("aria-hidden","true");
  const b=make("button",null,{type:"button",class:"pick "+cls,"aria-haspopup":"dialog"});sel.after(b);
  const sync=()=>{const o=sel.selectedOptions[0];b.replaceChildren(make("span",o?label(o):"—"),make("i","▾",{"aria-hidden":"true"}));b.disabled=sel.disabled;b.setAttribute("aria-label",title+": "+(o?o.text:"none"));};
  b.onclick=()=>openSheet(title,[...sel.options].filter(o=>!o.hidden&&!o.disabled).map(o=>({value:o.value,label:label(o),sub:sub(o)})),sel.value,v=>{sel.value=v;sel.dispatchEvent(new Event("change",{bubbles:true}));sync();},cols,b);
  sel.addEventListener("change",sync);new MutationObserver(sync).observe(sel,{childList:true,subtree:true,attributes:true});
  sel.sync=sync;sync();return b;
}
/* chunky segmented buttons */
function segment(host,labels,value,onPick,{label="",cls=""}={}){
  host.replaceChildren();host.className="seg "+cls;host.setAttribute("role","group");if(label)host.setAttribute("aria-label",label);
  const bs=labels.map((t,i)=>{const b=make("button",t,{type:"button","aria-pressed":String(i===value)});b.onclick=()=>{bs.forEach((x,j)=>x.setAttribute("aria-pressed",String(j===i)));onPick(i);};host.append(b);return b;});
  host.set=v=>bs.forEach((x,j)=>x.setAttribute("aria-pressed",String(j===v)));return host;
}
const pct=v=>v+"%";
const levelText=v=>v===0?"OFF":v===100?"0 dB":(40*Math.log10(v/100)).toFixed(1)+" dB";
const panText=v=>v===0?"C":(v<0?"L":"R")+Math.abs(v);
const returnText=v=>v===0?"OFF":(20*Math.log10(.8*v/85)).toFixed(1)+" dB";

/* ---------- kit / pattern library ---------- */
function markCustom(){if(state.kit!==-1){state.kit=-1;viewKit();}}
function viewKit(){const s=$("kit");s.querySelector("option[value='-1']").hidden=state.kit!==-1;s.value=String(state.kit);s.sync?.();}
function viewGroove(){const s=$("groove"),v=state.loaded[state.editBank];s.querySelector("option[value='-1']").hidden=v!==-1;s.value=String(v);s.sync?.();}
function applyKit(i){
  const k=kits[i];
  for(let p=1;p<=11;p++){
    const vc=k.voices[p-1];patchStore.bd_recipe(p,vc.recipe);send("recipe",{pad:p,value:vc.recipe});
    const edits=[];for(const [n,val] of vc.edits)if(patchStore.bd_set(p,n,val)){edits.push([n,val]);send("param",{pad:p,index:n,value:val});}
    state.voices[p-1]={recipe:vc.recipe,edits};
    setLevel(p,k.levels?.[p-1]??100,true);setPan(p,k.pans?.[p-1]??0,true);
    const s=k.sends?.[p-1]??defaultSends[p-1];setSend(p,0,s[0],true);setSend(p,1,s[1],true);
  }
  (k.returns??[RETURN_DEFAULT,RETURN_DEFAULT]).forEach((v,w)=>setReturn(w,v,true));
  k.macros.forEach((v,n)=>setMacro(n,v,true));setDry(k.dry,true);
  state.kit=i;viewKit();selectVoice(selected);persist();
}
function loadPattern(i){
  const p=patterns[i];state.banks[state.editBank]=patternValues(p);state.loaded[state.editBank]=i;
  for(let r=0;r<11;r++)for(let n=0;n<16;n++)refreshCell(r,n);
  send("bank-rows",{bank:state.editBank,rows:state.banks[state.editBank]});
  if(p.bpm){state.bpm=p.bpm;$("tempo").value=p.bpm;send("tempo",{value:p.bpm});}
  if(p.swing){state.swing=p.swing;swingKnob.set(p.swing);send("swing",{value:p.swing});}
  viewGroove();persist();
}

/* ---------- mix setters keep every view in step ---------- */
let macroKnobs=[],returnKnobs=[];
function setLevel(p,v,quiet){state.levels[p-1]=v;patchStore.bd_level(p,v);send("level",{pad:p,value:v});strips[p-1]?.level.set(v);if(!quiet){markCustom();persist();}}
function setPan(p,v,quiet){state.pans[p-1]=v;patchStore.bd_pan(p,v);send("pan",{pad:p,value:v});strips[p-1]?.pan.set(v);if(!quiet){markCustom();persist();}}
function setSend(p,w,v,quiet){state.sends[p-1][w]=v;patchStore.bd_send(p,w,v);send("send",{pad:p,which:w,value:v});strips[p-1]?.sends[w].set(v);if(!quiet){markCustom();persist();}}
function setReturn(w,v,quiet){state.returns[w]=v;patchStore.bd_return(w,v);send("return",{which:w,value:v});returnKnobs[w]?.set(v);if(!quiet){markCustom();persist();}}
function setMacro(i,v,quiet){state.macros[i]=v;send("macro",{index:i,value:v});macroKnobs[i]?.set(v);if(!quiet){markCustom();persist();}}
function setDry(d,quiet){state.dry=d;send("dry",{value:d});for(const c of document.querySelectorAll("input[name=busmode]"))c.checked=(c.value==="dry")===d;document.body.classList.toggle("is-dry",d);if(!quiet){markCustom();persist();}}
function toggleMute(p){
  const v=state.mutes[p]=!state.mutes[p];
  muteButtons[p].setAttribute("aria-pressed",String(v));muteButtons[p].closest(".lane-row").classList.toggle("muted",v);
  strips[p]?.mute.setAttribute("aria-pressed",String(v));
  send("mute",{pad:p+1,value:v});persist();
}

/* ---------- transport ---------- */
function viewTransport(){
  const edit=state.editBank,current=playing?playingBank:state.playBank;
  for(const x of document.querySelectorAll("[data-pattern]"))x.setAttribute("aria-pressed",String(+x.dataset.pattern===edit));
  const text=(playing?"Playing ":"Ready ")+letters[current]+(queuedBank<0?"":" · Queued "+letters[queuedBank]);
  if($("bank-readout").textContent!==text)$("bank-readout").textContent=text;
  $("activate-bank").textContent=(playing?(queuedBank>=0&&(queuedBank===edit||current===edit)?"Cancel queue":"Queue "+letters[edit]):"Set "+letters[edit]+" live").toUpperCase();
  $("activate-bank").disabled=current===edit&&queuedBank<0;
  for(let n=0;n<16;n++){const live=active===n&&playing&&current===edit;number[n].classList.toggle("current",live);buttons.forEach(row=>row[n].classList.toggle("current",live));}
}
function chooseBank(bank){
  state.editBank=bank;$("load-label").textContent="Load into "+letters[bank];
  for(let p=0;p<11;p++)for(let n=0;n<16;n++)refreshCell(p,n);
  viewGroove();viewTransport();persist();
}

/* ---------- grid ---------- */
const stepText=["","","•"],stepWords=["off","hit","accent"];
function refreshCell(p,n){const b=buttons[p][n],v=rows()[p][n];b.dataset.state=v;b.textContent=stepText[v];b.setAttribute("aria-label",names[p]+" step "+(n+1)+": "+stepWords[v]);}
function setCell(p,n,v){
  rows()[p][n]=v;refreshCell(p,n);send("cell",{bank:state.editBank,pad:p+1,step:n,value:v});
  if(state.loaded[state.editBank]!==-1){state.loaded[state.editBank]=-1;viewGroove();}persist();
}
function stepFocus(p,n){
  buttons[focus[0]][focus[1]].tabIndex=-1;focus=[p,n];buttons[p][n].tabIndex=0;
  buttons[p][n].focus({preventScroll:true});
}
function gridBuild(){
  grid.append(make("span","",{class:"axis"}));
  // Steps sit in explicit columns with a spacer column after each group of four.
  // Phones turn the grid: drums across the top, steps 1-16 down the screen (--sr / --pc).
  const place=(el,n)=>{const at=String(2+n+Math.floor(n/4));el.style.setProperty("--c",at);el.style.setProperty("--sr",at);};
  for(let n=0;n<16;n++){const b=make("span",String(n+1),{class:"hrow"+(n%4===0?" beat":""),"data-half":n<8?0:1,"data-step":n});place(b,n);number.push(b);grid.append(b);}
  for(let p=0;p<11;p++){
    const lane=make("button",short[p],{type:"button",class:"lane",title:names[p],"aria-label":"Audition "+names[p]});
    lane.onclick=()=>{selectVoice(p+1);audition(p+1,0);};lanes.push(lane);
    const mute=make("button","M",{type:"button",class:"mute","aria-label":"Mute "+names[p],"aria-pressed":String(state.mutes[p])});mute.onclick=()=>toggleMute(p);
    for(const el of [lane,mute]){el.style.setProperty("--r",String(p+2));el.style.setProperty("--pc",String(p+2));}
    const row=make("div",null,{class:"lane-row"+(state.mutes[p]?" muted":"")});row.append(lane,mute);grid.append(row);muteButtons.push(mute);
    buttons[p]=[];
    for(let n=0;n<16;n++){
      const b=make("button",null,{type:"button",class:"step","data-pad":p,"data-step":n,"data-half":n<8?0:1,tabindex:(p===0&&n===0)?0:-1});place(b,n);
      b.style.setProperty("--r",String(p+2));b.style.setProperty("--pc",String(p+2));
      b.addEventListener("click",e=>{if(e.detail===0)setCell(p,n,(rows()[p][n]+1)%3);});
      b.addEventListener("focus",()=>{buttons[focus[0]][focus[1]].tabIndex=-1;focus=[p,n];b.tabIndex=0;});
      buttons[p][n]=b;grid.append(b);refreshCell(p,n);
    }
  }
  let paint=null;
  grid.addEventListener("pointerdown",e=>{
    const b=e.target.closest(".step");if(!b||e.button>0)return;e.preventDefault();
    const p=+b.dataset.pad,n=+b.dataset.step;paint=(rows()[p][n]+1)%3;setCell(p,n,paint);
  });
  addEventListener("pointermove",e=>{
    if(paint===null)return;
    const b=document.elementFromPoint(e.clientX,e.clientY)?.closest?.(".step");
    if(b&&grid.contains(b)&&rows()[+b.dataset.pad][+b.dataset.step]!==paint)setCell(+b.dataset.pad,+b.dataset.step,paint);
  });
  const end=()=>{paint=null;};addEventListener("pointerup",end);addEventListener("pointercancel",end);
  grid.addEventListener("keydown",e=>{
    const b=e.target;if(!b.classList.contains("step"))return;
    let p=+b.dataset.pad,n=+b.dataset.step;
    const k=turned.matches?{ArrowUp:"ArrowLeft",ArrowDown:"ArrowRight",ArrowLeft:"ArrowUp",ArrowRight:"ArrowDown"}[e.key]||e.key:e.key;
    switch(k){case "ArrowUp":p=Math.max(0,p-1);break;case "ArrowDown":p=Math.min(10,p+1);break;case "ArrowRight":n=Math.min(15,n+1);break;case "ArrowLeft":n=Math.max(0,n-1);break;case "Home":n=0;break;case "End":n=15;break;default:return;}
    e.preventDefault();stepFocus(p,n);
  });
}

/* ---------- drum view ---------- */
function recipeSelection(p){const v=patchStore.bd_match(p),s=$("recipe");s.querySelector("option[value='-1']").hidden=v!==-1;s.value=String(v);$("recipe-seg").set?.(v);$("custom-tag").classList.toggle("on",v===-1);}
function tickDisplay(p,k,v){const d=patchStore.bd_decimals(p,k),unit=fromPtr(patchStore.bd_unit(p,k));return (v/(10**d)).toFixed(d)+(unit?" "+unit:"");}
function selectVoice(p){
  selected=p;$("sound-heading").textContent=String(p).padStart(2,"0")+" "+names[p-1].toUpperCase();
  lanes.forEach((e,i)=>e.classList.toggle("sel",i===p-1));
  const r=$("recipe");r.replaceChildren(make("option","CUSTOM",{value:-1,disabled:""}));
  const recipes=[];for(let n=0;n<patchStore.bd_recipe_count(p);n++){const name=fromPtr(patchStore.bd_recipe_name(p,n)).toUpperCase();recipes.push(name);r.append(make("option",name,{value:n}));}
  segment($("recipe-seg"),recipes,patchStore.bd_match(p),n=>{r.value=String(n);r.dispatchEvent(new Event("change"));},{label:"Preset",cls:"presets"});
  recipeSelection(p);buildParams();
}
function buildParams(){
  const p=selected,area=$("params"),choices=$("choices");area.replaceChildren();choices.replaceChildren();
  const defaults=scratch;defaults.bd_recipe(p,state.voices[p-1].recipe);
  const knobs=[];
  const refreshLocks=()=>knobs.forEach(([k,kn])=>{const off=!patchStore.bd_edit(p,k);kn.input.disabled=off;kn.classList.toggle("locked",off);});
  const changed=(k,value)=>{
    const edits=state.voices[p-1].edits;if(edits.at(-1)?.[0]===k)edits.pop();edits.push([k,value]);if(edits.length>256)edits.shift();
    send("param",{pad:p,index:k,value});recipeSelection(p);refreshLocks();markCustom();persist();
  };
  for(let k=0;k<patchStore.bd_params(p);k++){
    const min=patchStore.bd_min(p,k),max=patchStore.bd_max(p,k),v=patchStore.bd_get(p,k),label=fromPtr(patchStore.bd_label(p,k));
    if(patchStore.bd_option(p,k,min)){
      const box=make("div",null,{class:"choice"}),seg=make("div");
      const opts=[];for(let i=min;i<=max;i++)opts.push(fromPtr(patchStore.bd_option(p,k,i)).toUpperCase());
      segment(seg,opts,v-min,i=>{if(patchStore.bd_set(p,k,i+min))changed(k,i+min);},{label});
      seg.id="param-"+k;box.append(make("span",label.toUpperCase(),{class:"tag"}),seg);choices.append(box);
    }else{
      const kn=knob({id:"param-"+k,label,min,max,value:v,def:defaults.bd_get(p,k),fmt:val=>tickDisplay(p,k,val),onInput:value=>{if(patchStore.bd_set(p,k,value))changed(k,value);}});
      knobs.push([k,kn]);area.append(kn);
    }
  }
  refreshLocks();fitKnobs(area);
}

/* ---------- mixer view ---------- */
function buildMixer(){
  const area=$("mixer");
  const legend=make("div",null,{class:"strip legend","aria-hidden":"true"});
  [["","lg-name"],["LEVEL","lg-level"],["REV","lg-k"],["DLY","lg-k"],["PAN","lg-k"],["M","lg-m"]].forEach(([t,c])=>legend.append(make("span",t,{class:c})));
  area.append(legend);
  for(let p=1;p<=11;p++){
    const strip=make("div",null,{class:"strip"}),id="mix-level-"+p;
    const sends=[0,1].map(w=>knob({id:"mix-send-"+w+"-"+p,label:w?"DLY":"REV",min:0,max:100,value:state.sends[p-1][w],def:defaultSends[p-1][w],fmt:pct,onInput:v=>setSend(p,w,v),cls:"mini"}));
    sends[0].title=names[p-1]+" reverb send";sends[1].title=names[p-1]+" delay send";
    const fader=make("input",null,{type:"range",id,min:0,max:100,step:1,class:"fader","aria-label":names[p-1]+" level"});fader.value=state.levels[p-1];
    const read=make("output",levelText(state.levels[p-1]),{for:id,class:"read"});
    fader.oninput=()=>{read.value=levelText(+fader.value);setLevel(p,+fader.value);};
    const level={set:v=>{fader.value=v;read.value=levelText(v);}};
    const mute=make("button","M",{type:"button",class:"mute","aria-label":"Mute "+names[p-1],"aria-pressed":String(state.mutes[p-1])});mute.onclick=()=>toggleMute(p-1);
    const name=make("button",short[p-1],{type:"button",class:"strip-name",title:names[p-1],"aria-label":"Edit "+names[p-1]});name.onclick=()=>{selectVoice(p);showView("drum");};
    const pan=knob({id:"mix-pan-"+p,label:"PAN",min:-100,max:100,value:state.pans[p-1],def:0,fmt:panText,onInput:v=>setPan(p,v),cls:"mini pan"});
    pan.title=names[p-1]+" pan";
    strip.append(name,sends[0],sends[1],pan,fader,read,mute);area.append(strip);
    strips[p-1]={level,sends,mute,pan};
  }
  // The two returns are faders too, set apart on their own panel.
  const ret=$("returns");
  returnKnobs=[["REV","REVERB RETURN"],["DLY","DELAY RETURN"]].map(([tag,label],w)=>{
    const strip=make("div",null,{class:"strip return"}),id="return-"+w;
    const fader=make("input",null,{type:"range",id,min:0,max:127,step:1,class:"fader","aria-label":label});fader.value=state.returns[w];
    const read=make("output",returnText(state.returns[w]),{for:id,class:"read"});
    fader.oninput=()=>{read.value=returnText(+fader.value);setReturn(w,+fader.value);};
    fader.addEventListener("dblclick",()=>{fader.value=RETURN_DEFAULT;fader.dispatchEvent(new Event("input"));});
    strip.append(make("span",tag,{class:"strip-name",title:label}),make("span","RETURN",{class:"ret-tag"}),fader,read);ret.append(strip);
    return {set:v=>{fader.value=v;read.value=returnText(v);}};
  });
}

/* ---------- LFO view ---------- */
const lfoDraw=[];
const lfoY=(wave,ph)=>{if(wave===1)return 1-4*Math.abs(ph-.5);const y=Math.sin(2*Math.PI*ph);return wave===2?2*Math.min(1,Math.max(0,.5+2*y))-1:y;};
function wavePath(wave,depth){
  const pts=[];for(let i=0;i<=160;i++)pts.push([4+i/160*312,60-lfoY(wave,(i/160*2)%1)*48*(.15+.85*depth/100)]);
  return "M"+pts.map(p=>p[0].toFixed(1)+" "+p[1].toFixed(1)).join("L");
}
function buildLFOs(){
  for(let i=0;i<2;i++){
    const spec=state.lfos[i],slot=make("div",null,{class:"lfo-slot","data-slot":i});
    let redraw=()=>{};
    const update=(k,value)=>{spec[k]=value;send("lfo",{slot:i,value:spec});persist();redraw();};
    const route=make("div",null,{class:"lfo-route"});
    const drum=make("select",null,{id:"lfo-"+i+"-lane"});["OFF",...short].forEach((n,j)=>drum.append(make("option",n,{value:j})));drum.value=spec.lane;
    const target=make("select",null,{id:"lfo-"+i+"-param"});
    let fill=()=>{
      target.replaceChildren(make("option","LEVEL",{value:0}));
      if(spec.lane)for(let k=0;k<patchStore.bd_params(spec.lane);k++){if(patchStore.bd_option(spec.lane,k,patchStore.bd_min(spec.lane,k)))continue;target.append(make("option",fromPtr(patchStore.bd_label(spec.lane,k)).toUpperCase(),{value:k+1}));}
      target.value=String(spec.param);if(target.value!==String(spec.param)){spec.param=0;target.value="0";}target.disabled=!spec.lane;
    };
    drum.onchange=()=>{spec.lane=+drum.value;spec.param=0;fill();send("lfo",{slot:i,value:spec});persist();redraw();};
    target.onchange=()=>update("param",+target.value);
    target.classList.add("sr");target.tabIndex=-1;target.setAttribute("aria-hidden","true");
    const targetSeg=make("div");
    const fillSeg=()=>{const opts=[...target.options];segment(targetSeg,opts.map(o=>o.text),opts.findIndex(o=>o.value===target.value),j=>{target.value=opts[j].value;target.dispatchEvent(new Event("change"));},{label:"Target",cls:"targets"+(target.disabled?" off":"")});};
    const fill0=fill;fill=()=>{fill0();fillSeg();};fill();
    const field=(title,ctl)=>{const b=make("div",null,{class:"field"});b.append(make("span",title,{class:"tag"}),ctl);return b;};
    const shape=segment(make("div"),["SINE","TRI","SQR"],spec.wave,v=>update("wave",v),{label:"Shape"});
    let reveal=()=>{};
    const clock=segment(make("div"),["FREE","SYNC"],spec.sync?1:0,v=>{update("sync",v===1);reveal();},{label:"Clock"});
    const tf=field("TARGET",target);tf.append(targetSeg);tf.classList.add("wide");
    route.append(field("DRUM",drum),tf,field("SHAPE",shape),field("CLOCK",clock));
    pickerFor(drum,{title:"LFO "+(i+1)+" DRUM",cols:4,label:o=>o.text,sub:o=>+o.value?names[o.value-1].toUpperCase():"NO TARGET"});
    const scope=make("div",null,{class:"scope"});
    scope.innerHTML=`<svg viewBox="0 0 320 120" preserveAspectRatio="none" aria-hidden="true"><line class="axis" x1="0" y1="60" x2="320" y2="60"/><path class="wave"/><circle class="dot" r="5"/></svg><span class="scope-label"></span>`;
    const wave=scope.querySelector(".wave"),dot=scope.querySelector(".dot"),slabel=scope.querySelector(".scope-label");
    const divs=["2 BARS","1 BAR","1/2","1/4","1/8","1/16","1/32"];
    const cycle=knob({id:"lfo-"+i+"-div",label:"RATE",min:0,max:6,value:spec.div,def:3,fmt:v=>divs[v],onInput:v=>update("div",v)});
    const hz=knob({id:"lfo-"+i+"-hz",label:"RATE",min:5,max:1200,value:spec.hz,def:100,fmt:v=>(v/100).toFixed(2)+" HZ",onInput:v=>update("hz",v)});
    const depth=knob({id:"lfo-"+i+"-depth",label:"DEPTH",min:0,max:100,value:spec.depth,def:0,fmt:pct,onInput:v=>update("depth",v)});
    const centre=make("div",null,{class:"lfo-centre"}),rate=make("div",null,{class:"rate-slot"});
    rate.append(cycle,hz);centre.append(rate,scope,depth);
    reveal=()=>{cycle.hidden=!spec.sync;hz.hidden=spec.sync;};reveal();
    redraw=()=>{
      wave.setAttribute("d",wavePath(spec.wave,spec.depth));
      slabel.textContent=spec.lane?short[spec.lane-1]+" · "+(spec.param?target.selectedOptions[0]?.text||"":"LEVEL"):"OFF";
      slot.classList.toggle("idle",!spec.lane||!spec.depth);
    };
    redraw();
    lfoDraw[i]=()=>{const ph=(lfoPhase[i]>>>0)/4294967296;dot.setAttribute("cx",(4+ph*156).toFixed(1));dot.setAttribute("cy",(60-lfoY(spec.wave,ph)*48*(.15+.85*spec.depth/100)).toFixed(1));};
    lfoDraw[i]();
    slot.append(route,centre);$("lfo-controls").append(slot);fitter.observe(centre);
  }
  showLFO(bounded(ui.lfo,0,1)?ui.lfo:0);
}
function showLFO(i){lfoShown=i;$("lfo-controls").dataset.show=i;for(const b of document.querySelectorAll("[data-lfo]"))b.setAttribute("aria-pressed",String(+b.dataset.lfo===i));ui.lfo=i;saveUI();}

/* ---------- playing it ---------- */
function flash(p,accent){const el=lanes[p-1];if(!el)return;el.classList.remove("hit","acc");void el.offsetWidth;el.classList.add("hit");if(accent)el.classList.add("acc");}
async function hitPad(p,accent){
  if(p!==selected)selectVoice(p);flash(p,accent);
  if(!await enableAudio())return;
  send("hit",{pad:p,accent:accent?1:0});
  if(recording&&playing&&active>=0){
    const dur=60/state.bpm/4,late=performance.now()/1000-stepAt>dur/2;
    const n=late?(active+1)%16:active,bank=playingBank;
    state.banks[bank][p-1][n]=accent?2:Math.max(1,state.banks[bank][p-1][n]);
    send("cell",{bank,pad:p,step:n,value:state.banks[bank][p-1][n]});
    if(bank===state.editBank){refreshCell(p-1,n);if(state.loaded[bank]!==-1){state.loaded[bank]=-1;viewGroove();}}
    else state.loaded[bank]=-1;
    persist();
  }
}

/* ---------- views: pure display, never touch audio ---------- */
function showView(t){
  if(!views.includes(t))t="sequence";
  const changed=document.body.dataset.view!==t;
  document.body.dataset.view=t;ui.view=t;saveUI();
  for(const b of document.querySelectorAll(".modes [data-tab]"))b.setAttribute("aria-selected",String(b.dataset.tab===t));
  // Size the knobs of the view now shown at once, without waiting for a resize callback.
  if(t==="drum")fitKnobs($("params"));else if(t==="bus")fitKnobs($("macros"));else if(t==="lfo")document.querySelectorAll(".lfo-centre").forEach(fitCentre);
  if(changed){const s=$("screen");s.classList.remove("fringe");void s.offsetWidth;s.classList.add("fringe");}
}

/* ---------- files ---------- */
const offer=(name,body)=>{const url=URL.createObjectURL(new Blob([body],{type:"text/plain;charset=utf-8"}));const a=make("a",null,{href:url,download:name});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);};
function wireFile(prefix,kind){
  const input=$(prefix+"-file"),area=$(prefix+"-drop"),applyButton=$(prefix+"-apply"),notice=$(prefix+"-notice");let pending=null,serial=0;
  async function load(file){
    if(!file)return;const run=++serial;pending=null;applyButton.disabled=true;notice.textContent="Reading locally…";
    try{
      if(file.size>MAX_FILE)throw Error("File exceeds the 16 KB limit.");
      const pad=selected,txt=await file.text();if(run!==serial)return;
      const data=parseFile(txt,kind,pad,kind==="Pattern"?null:boot(module));
      pending={data,pad};applyButton.disabled=false;
      notice.textContent=kind==="Pattern"?"Ready to replace A, B, tempo and swing. Stop playback before applying.":"Ready for "+names[pad-1]+".";
    }catch(e){if(run===serial)notice.textContent=e.message;}
  }
  input.onchange=()=>{load(input.files[0]);input.value="";};
  area.ondragover=e=>{if(e.dataTransfer.types.includes("Files"))e.preventDefault();};
  area.ondrop=e=>{e.preventDefault();if(e.dataTransfer.files.length!==1){++serial;pending=null;applyButton.disabled=true;notice.textContent="Drop one text file at a time.";return;}load(e.dataTransfer.files[0]);};
  $(prefix+"-export").onclick=()=>kind==="Pattern"?offer("bongdrums-pattern.txt",exportPattern(state)):offer("bongdrums-"+voiceIds[selected-1]+".txt",exportPreset(selected,state.voices[selected-1]));
  applyButton.onclick=()=>{
    if(!pending)return;const {data,pad}=pending;
    if(kind==="Pattern"){
      if(playing){notice.textContent="Stop playback, then press Apply.";return;}
      Object.assign(state,data);state.loaded=[-1,-1];chooseBank(state.editBank);
      for(let b=0;b<2;b++)send("bank-rows",{bank:b,rows:state.banks[b]});
      $("tempo").value=state.bpm;swingKnob.set(state.swing);send("tempo",{value:state.bpm});send("swing",{value:state.swing});
    }else{
      if(pad!==selected){notice.textContent="Select "+names[pad-1]+" again before applying.";return;}
      state.voices[pad-1]=data;patchStore.bd_recipe(pad,data.recipe);send("recipe",{pad,value:data.recipe});
      for(const [k,v] of data.edits){patchStore.bd_set(pad,k,v);send("param",{pad,index:k,value:v});}
      markCustom();selectVoice(pad);
    }
    persist();pending=null;applyButton.disabled=true;notice.textContent="Imported.";
  };
}

/* ---------- audio ---------- */
let outBar,analyser,scopeBuf;const grBars=[];
/* BUS scope: the output waveform, triggered on a rising zero crossing, with a faint phosphor trail. */
function drawScope(){
  requestAnimationFrame(drawScope);
  if(document.body.dataset.view!=="bus"||document.hidden)return;
  const c=$("bus-scope"),g=c.getContext("2d"),dpr=devicePixelRatio||1,w=Math.round(c.clientWidth*dpr),h=Math.round(c.clientHeight*dpr);
  if(!w||!h)return;if(c.width!==w||c.height!==h){c.width=w;c.height=h;}
  const plain=document.body.classList.contains("fx-off");
  g.shadowBlur=0;g.fillStyle=plain?"#1A0A14":"rgba(26,10,20,.32)";g.fillRect(0,0,w,h);
  g.strokeStyle="#5A3A4D";g.lineWidth=dpr;g.setLineDash([4*dpr,4*dpr]);g.beginPath();g.moveTo(0,h/2);g.lineTo(w,h/2);g.stroke();g.setLineDash([]);
  if(!analyser)return;
  if(!scopeBuf)scopeBuf=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(scopeBuf);
  const N=1024;let start=0;for(let i=1;i<scopeBuf.length-N;i++)if(scopeBuf[i-1]<=0&&scopeBuf[i]>0){start=i;break;}
  g.strokeStyle="#55A0C9";g.lineWidth=2*dpr;if(!plain){g.shadowColor="#55A0C9";g.shadowBlur=8*dpr;}
  g.beginPath();for(let i=0;i<N;i++){const y=h/2-Math.max(-1,Math.min(1,scopeBuf[start+i]*1.4))*h*.44;i?g.lineTo(i/(N-1)*w,y):g.moveTo(0,y);}g.stroke();
}
async function enableAudio(){
  if(ctx?.state==="running"&&port)return true;
  if(connecting)return connecting;
  connecting=(async()=>{
    try{
      if(!ctx){
        ctx=new AudioContext({sampleRate:44100,latencyHint:"interactive"});
        if(ctx.sampleRate!==44100)throw Error("This browser did not provide a 44.1 kHz audio clock.");
        await ctx.audioWorklet.addModule(new URL("worklet.js",import.meta.url));
        const node=new AudioWorkletNode(ctx,"bongdrums",{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2],processorOptions:{module}});
        const gain=ctx.createGain();gain.gain.value=.5;node.connect(gain).connect(ctx.destination);port=node.port;
        analyser=ctx.createAnalyser();analyser.fftSize=2048;analyser.smoothingTimeConstant=0;node.connect(analyser);
        port.onmessage=({data})=>{
          if(active!==data.step||playingBank!==data.bank||queuedBank!==data.queued){
            const promoted=playing&&playingBank!==data.bank&&data.queued<0;
            if(active!==data.step&&data.step>=0){stepAt=performance.now()/1000;
              if(playing)for(let p=0;p<11;p++){const v=state.banks[data.bank][p][data.step];if(v&&!state.mutes[p])flash(p+1,v===2);}}
            active=data.step;playingBank=data.bank;queuedBank=data.queued;
            if((promoted||(!playing&&data.step===-1))&&state.playBank!==data.bank){state.playBank=data.bank;persist();}
            viewTransport();
          }
          $("comp").value=data.c.toFixed(1)+" dB";$("limit").value=data.l.toFixed(1)+" dB";
          grBars[0].style.transform=`scaleX(${Math.min(1,data.c/12).toFixed(3)})`;grBars[1].style.transform=`scaleX(${Math.min(1,data.l/12).toFixed(3)})`;
          if(data.o!==undefined)outBar.style.transform=`scaleX(${Math.min(1,data.o*.5/.7).toFixed(3)})`;
          if(data.p){lfoPhase=data.p;if(document.body.dataset.view==="lfo")lfoDraw[lfoShown]?.();}
        };
        node.addEventListener("processorerror",()=>{info.textContent="Audio processor stopped. Reload to retry.";playing=false;$("play").disabled=true;});
        send("state",{state});
      }
      await ctx.resume();if(ctx.state!=="running")throw Error("Audio is still suspended.");
      info.textContent=playing?"Playing":"Audio ready";return true;
    }catch(error){info.textContent=error.message;if(ctx){await ctx.close().catch(()=>{});ctx=null;port=null;}return false;}
    finally{connecting=null;}
  })();return connecting;
}
async function audition(p,accent){if(await enableAudio())send("hit",{pad:p,accent});}
function setPlaying(v){playing=v;$("play").textContent=v?"■ STOP":"▶ PLAY";$("play").setAttribute("aria-pressed",String(v));document.body.classList.toggle("running",v);}
async function toggle(){
  if(playing){setPlaying(false);if(queuedBank>=0){state.playBank=queuedBank;queuedBank=-1;persist();}send("play",{value:false});viewTransport();info.textContent="Stopped · tails ring";return;}
  if(await enableAudio()){setPlaying(true);playingBank=state.playBank;viewTransport();send("play",{value:true});info.textContent="Playing";}
}
function setRec(v){recording=v;$("rec").setAttribute("aria-pressed",String(v));document.body.classList.toggle("recording",v);}
function setFx(off){document.body.classList.toggle("fx-off",off);$("fx-off").checked=off;ui.fxOff=off;saveUI();}

/* ---------- boot ---------- */
let swingKnob;
try{
  const response=await fetch(new URL("bongdrums.wasm",import.meta.url));
  if(!response.ok)throw Error("Drum engine missing");
  module=await WebAssembly.compile(await response.arrayBuffer());
  const probe=boot(module);defaultSends=names.map((_,i)=>[probe.bd_send_get(i+1,0),probe.bd_send_get(i+1,1)]);
  scratch=boot(module);patchStore=boot(module);state=setup();apply(patchStore,state);
  outBar=$("out-bar");
  for(const [id,list,custom] of [["kit",kits,"CUSTOM KIT"],["groove",patterns,"EDITED PATTERN"]]){const sel=$(id);sel.append(make("option",custom,{value:-1,disabled:""}));list.forEach((x,i)=>sel.append(make("option",x.name.toUpperCase(),{value:i})));}
  gridBuild();buildMixer();buildLFOs();
  pickerFor($("kit"),{title:"KIT",cols:3,cls:"wide"});
  pickerFor($("groove"),{title:"PATTERN · LOADS INTO THE EDIT BANK",cols:4,cls:"wide",sub:o=>{const p=patterns[+o.value];return p&&p.bpm?p.bpm+" BPM · SWING "+p.swing+"%":""}});
  $("drum-pick").onclick=()=>openSheet("DRUM",names.map((n,i)=>({value:i+1,label:String(i+1).padStart(2,"0")+" "+short[i],sub:n.toUpperCase()})),selected,v=>selectVoice(+v),4,$("drum-pick"));
  $("sheet-close").onclick=closeSheet;
  $("sheet").addEventListener("pointerdown",e=>{if(e.target.id==="sheet")closeSheet();});
  $("sheet").addEventListener("keydown",e=>{
    if(e.key==="Escape"){e.preventDefault();closeSheet();return;}
    const tiles=[...$("sheet-grid").children],i=tiles.indexOf(document.activeElement);if(i<0)return;
    const cols=getComputedStyle($("sheet-grid")).gridTemplateColumns.split(" ").length;
    const d={ArrowRight:1,ArrowLeft:-1,ArrowDown:cols,ArrowUp:-cols}[e.key];
    if(d){e.preventDefault();tiles[Math.max(0,Math.min(tiles.length-1,i+d))].focus();}
  });
  swingKnob=knob({id:"swing",label:"Swing",min:50,max:75,value:state.swing,def:50,fmt:pct,onInput:v=>{state.swing=v;send("swing",{value:v});persist();},cls:"inline"});
  $("swing-slot").append(swingKnob);
  ["Saturator","Compressor","Transient","Limiter"].forEach((name,i)=>{
    const fmt=v=>i===2?(v===64?"0%":((v>64?"+":"")+Math.round((v-64)/(v>=64?63:64)*100)+"%")):Math.round(v/127*100)+"%";
    const k=knob({id:"macro-"+i,label:name,min:0,max:127,value:state.macros[i],def:[22,64,86,64][i],fmt,onInput:v=>setMacro(i,v)});
    if(i===1||i===3){const m=make("div",null,{class:"gr"}),bar=make("span",null,{class:"meter"}),fillBar=make("i");bar.append(fillBar);grBars.push(fillBar);
      m.append(make("span","GR"),bar,make("output","0.0 dB",{id:i===1?"comp":"limit"}));k.append(m);}
    macroKnobs.push(k);$("macros").append(k);
  });
  for(const c of document.querySelectorAll("input[name=busmode]"))c.onchange=()=>setDry(c.value==="dry");
  fitter.observe($("params"));fitter.observe($("macros"));requestAnimationFrame(drawScope);
  setDry(state.dry,true);
  selectVoice(1);wireFile("pattern","Pattern");wireFile("preset","Drum Preset");
  viewKit();
  $("kit").onchange=()=>applyKit(+$("kit").value);
  const step=(count,applyFn,current,d)=>applyFn(((Math.max(current,0)+(current<0&&d>0?0:d))%count+count)%count);
  $("kit-prev").onclick=()=>step(kits.length,applyKit,state.kit,-1);
  $("kit-next").onclick=()=>step(kits.length,applyKit,state.kit,1);
  $("groove").onchange=()=>loadPattern(+$("groove").value);
  $("groove-prev").onclick=()=>step(patterns.length,loadPattern,state.loaded[state.editBank],-1);
  $("groove-next").onclick=()=>step(patterns.length,loadPattern,state.loaded[state.editBank],1);
  $("voice-prev").onclick=()=>selectVoice(selected===1?11:selected-1);
  $("voice-next").onclick=()=>selectVoice(selected===11?1:selected+1);
  $("recipe").onchange=()=>{const v=+$("recipe").value;if(v<0)return;patchStore.bd_recipe(selected,v);state.voices[selected-1]={recipe:v,edits:[]};send("recipe",{pad:selected,value:v});markCustom();selectVoice(selected);persist();};
  $("audition").onclick=()=>audition(selected,0);$("play").onclick=toggle;$("rec").onclick=()=>setRec(!recording);
  $("tempo").value=state.bpm;
  $("tempo").onchange=()=>{state.bpm=Math.round(Math.max(60,Math.min(200,+$("tempo").value||state.bpm)));$("tempo").value=state.bpm;send("tempo",{value:state.bpm});persist();};
  $("tempo").addEventListener("wheel",e=>{e.preventDefault();$("tempo").value=Math.max(60,Math.min(200,state.bpm+(e.deltaY<0?1:-1)));$("tempo").dispatchEvent(new Event("change"));},{passive:false});
  for(const b of document.querySelectorAll("[data-pattern]"))b.onclick=()=>chooseBank(+b.dataset.pattern);
  $("activate-bank").onclick=()=>{
    const bank=playing&&queuedBank===state.editBank?playingBank:state.editBank;
    if(!playing){state.playBank=bank;playingBank=bank;persist();}else queuedBank=bank===playingBank?-1:bank;
    send("bank",{bank});viewTransport();
  };
  for(const b of document.querySelectorAll(".modes [data-tab]"))b.onclick=()=>showView(b.dataset.tab);
  for(const b of document.querySelectorAll("[data-lfo]"))b.onclick=()=>showLFO(+b.dataset.lfo);
  $("fx-off").onchange=()=>setFx($("fx-off").checked);setFx(!!ui.fxOff);
  showView(ui.view);$("screen").classList.remove("fringe");
  playingBank=state.playBank;chooseBank(state.editBank);
  document.addEventListener("pointerdown",e=>{const m=$("menu");if(m.open&&!m.contains(e.target))m.open=false;});
  document.addEventListener("keydown",e=>{
    if(e.metaKey||e.altKey||e.ctrlKey||!$("sheet").hidden)return;
    const t=e.target;
    if(t.closest?.("select,textarea,[contenteditable]")||(t.tagName==="INPUT"&&t.type!=="range"&&t.type!=="checkbox"))return;
    if(e.key==="Escape"){$("menu").open=false;return;}
    if(e.repeat)return;
    const pad=Math.max(keyCodes.indexOf(e.code),digitCodes.indexOf(e.code));
    if(pad>=0){e.preventDefault();hitPad(pad+1,e.shiftKey);return;}
    if(t.closest?.("button,a,summary"))return;
    if(e.code==="Space"){e.preventDefault();toggle();}
    else if(e.code==="Enter"){e.preventDefault();setRec(!recording);}
  });
}catch(error){info.textContent="BongDrums could not load: "+error.message;$("play").disabled=true;$("audition").disabled=true;console.error(error);}
