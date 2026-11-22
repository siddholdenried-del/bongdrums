import {boot,apply} from "./engine.js";
const $=id=>document.getElementById(id);
const make=(tag,text,attrs={})=>{const e=document.createElement(tag);if(text!==null)e.textContent=text;for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);return e;};
const names=["Kick","Snare","Clap","Low Tom","Mid Tom","High Tom","Closed Hat","Open Hat","Cymbal","Perc A","Perc B"];
const short=["BD","SD","CP","LT","MT","HT","CH","OH","CY","P1","P2",""];
const presets=["electro","house","break","clear"];
const scores={
  electro:["X..x..x.X.x.....","....X.......X...","............x...",".............x..","..............x.","...............X","X.x.x.x.X.x.x.x.",".......x...X....","x...............",".....X...x......","..x...........x."],
  house:  ["X...X...X...X...","....x.......x...","....X.......X...","................","................","...............x",".xxx.xxx.xxx.xxx","..X...X...X...X.","................","......x.x.....x.","...x.......x...."],
  break:  ["X.....x...X...x.","....X......xX...","............x...","..x.............","...............x","......x.........","X.x...x.X.x...x.","...x.......x....","........X.......","......x......x..","..x........X...."],
  clear: Array(11).fill("................")
};
const scoreValues=name=>scores[name].map(row=>[...row].map(n=>n==="X"?2:n==="x"?1:0));
const seed=()=>({rows:scoreValues("electro"),bpm:130,dry:true,macros:[22,64,86,64],voices:names.map(()=>({recipe:0,edits:[]}))});
const bounded=(v,lo,hi)=>Number.isInteger(v)&&v>=lo&&v<=hi;
const key="bongdrums-preview-v1";
let patchStore,timer=0;
const setup=()=>{
  const clean=seed();
  try{
    const k=JSON.parse(localStorage.getItem(key));
    if(!k)return clean;
    if(k.rows?.length===11&&k.rows.every(row=>Array.isArray(row)&&row.length===16&&row.every(v=>bounded(v,0,2))))clean.rows=k.rows;
    if(typeof k.dry==="boolean")clean.dry=k.dry;
    if(bounded(k.bpm,60,200))clean.bpm=k.bpm;
    if(k.macros?.length===4&&k.macros.every(n=>bounded(n,0,127)))clean.macros=k.macros;
    if(k.voices?.length===11)clean.voices=k.voices.map((r,i)=>({
      recipe:bounded(r?.recipe,0,patchStore.bd_recipe_count(i+1)-1)?r.recipe:0,
      edits:Array.isArray(r?.edits)?r.edits.slice(-256).filter(e=>Array.isArray(e)&&e.length===2&&bounded(e[0],0,patchStore.bd_params(i+1)-1)&&bounded(e[1],-20000,20000)):[]
    }));
  }catch{}return clean;
};
const persist=()=>{clearTimeout(timer);timer=setTimeout(()=>{try{localStorage.setItem(key,JSON.stringify(state));}catch{}},80);};
let state,ctx,port,node,module,connecting,playing=false,selected=1,active=-1,focus=[0,0];
let lanes=[],number=[],buttons=[],tabs=[];
const send=(kind,value)=>port?.postMessage({kind,...value});
const grid=$("score"), info=$("status");
const stepText=["·","•","✦"], stepWords=["off","hit","accent"];
const refreshCell=(p,n)=>{
  const b=buttons[p][n],v=state.rows[p][n];b.dataset.state=v;b.textContent=stepText[v];
  b.setAttribute("aria-label",names[p]+" step "+(n+1)+": "+stepWords[v]);
};
function activation(b){
  const p=+b.dataset.pad,n=+b.dataset.step;state.rows[p][n]=(state.rows[p][n]+1)%3;
  refreshCell(p,n);send("cell",{pad:p+1,step:n,value:state.rows[p][n]});persist();
}
function stepFocus(p,n){
  buttons[focus[0]][focus[1]].tabIndex=-1;focus=[p,n];buttons[p][n].tabIndex=0;
  buttons[p][n].focus({preventScroll:true});buttons[p][n].scrollIntoView({block:"nearest",inline:"nearest"});
}
function gridBuild(){
  grid.append(make("span","VOICE / STEP",{class:"axis"}));
  for(let n=0;n<16;n++){const b=make("span",String(n+1).padStart(2,"0"),{class:"hrow"});number.push(b);grid.append(b);}
  for(let p=0;p<11;p++){
    const lane=make("button",null,{type:"button",class:"lane","aria-label":"Select and audition "+names[p]});lane.append(make("b",String(p+1).padStart(2,"0")),make("span",names[p]));
    lane.onclick=()=>{selectVoice(p+1);audition(p+1);};lanes.push(lane);grid.append(lane);
    buttons[p]=[];for(let n=0;n<16;n++){const b=make("button",null,{type:"button",class:"step"+(n%4===0?" group":""),"data-pad":p,"data-step":n,tabindex:(p===0&&n===0)?0:-1});
      b.onclick=()=>activation(b);b.addEventListener("focus",()=>{buttons[focus[0]][focus[1]].tabIndex=-1;focus=[p,n];b.tabIndex=0;});buttons[p][n]=b;grid.append(b);refreshCell(p,n);}
  }
  grid.addEventListener("keydown",e=>{
    const b=e.target;if(!b.classList.contains("step"))return;
    let p=+b.dataset.pad,n=+b.dataset.step;
    switch(e.key){case "ArrowUp":p=Math.max(0,p-1);break;case "ArrowDown":p=Math.min(10,p+1);break;case "ArrowRight":n=Math.min(15,n+1);break;case "ArrowLeft":n=Math.max(0,n-1);break;case "Home":n=0;break;case "End":n=15;break;default:return;}
    e.preventDefault();stepFocus(p,n);
  });
}
const utf8=new TextDecoder();
const fromPtr=(p)=>{
  if(!p)return "";
  const v=new Uint8Array(patchStore.memory.buffer);let e=p;
  while(e<v.length&&v[e]!==0)e++;return utf8.decode(v.subarray(p,e));
};
function recipeSelection(p){
  const v=patchStore.bd_match(p),s=$("recipe");
  const option=s.querySelector("option[value='-1']");
  option.hidden=v!==-1;
  s.value=String(v);
}
function selectVoice(p){
  selected=p;$("sound-heading").textContent=names[p-1];
  lanes.forEach((e,i)=>e.classList.toggle("sel",i===p-1));
  tabs.forEach((e,i)=>e.setAttribute("aria-pressed",String(i===p-1)));
  const r=$("recipe");r.replaceChildren(make("option","Custom",{value:-1,disabled:""}));
  for(let n=0;n<patchStore.bd_recipe_count(p);n++)r.append(make("option",fromPtr(patchStore.bd_recipe_name(p,n)),{value:n}));
  recipeSelection(p);buildParams();
}
function tickDisplay(p,k,v){
  const d=patchStore.bd_decimals(p,k),unit=fromPtr(patchStore.bd_unit(p,k));
  return (v/(10**d)).toFixed(d)+(unit?" "+unit:"");
}
function buildParams(){
  const p=selected,area=$("params");area.replaceChildren();
  for(let k=0;k<patchStore.bd_params(p);k++){
    const min=patchStore.bd_min(p,k), max=patchStore.bd_max(p,k),v=patchStore.bd_get(p,k),cat=Boolean(patchStore.bd_option(p,k,min));
    const id="param-"+k,div=make("div",null,{class:"param"}), label=make("label",fromPtr(patchStore.bd_label(p,k)),{for:id});
    const out=make("output",cat?"":tickDisplay(p,k,v),{for:id});
    label.append(out);
    let ctl;
    if(cat){
      ctl=make("select",null,{id});
      for(let i=min;i<=max;i++)ctl.append(make("option",fromPtr(patchStore.bd_option(p,k,i)),{value:i}));
    }else ctl=make("input",null,{id,type:"range",min,max,step:1});
    ctl.value=v;ctl.dataset.param=k;ctl.disabled=!patchStore.bd_edit(p,k);
    ctl.addEventListener("input",()=>{
      const value=Number(ctl.value);if(!patchStore.bd_set(p,k,value))return;
      const edits=state.voices[p-1].edits;
      if(edits.at(-1)?.[0]===k)edits.pop();
      edits.push([k,value]);if(edits.length>256)edits.shift();
      out.value=cat?"":tickDisplay(p,k,value);send("param",{pad:p,index:k,value});recipeSelection(p);
      area.querySelectorAll("[data-param]").forEach(x=>{x.disabled=!patchStore.bd_edit(p,+x.dataset.param);});persist();
    });
    div.append(label,ctl);area.append(div);
  }
}
async function enableAudio(){
  if(ctx?.state==="running"&&port)return true;
  if(connecting)return connecting;
  connecting=(async()=>{
    try{
      if(!ctx){ctx=new AudioContext({sampleRate:44100});if(ctx.sampleRate!==44100)throw Error("This browser did not provide a 44.1 kHz audio clock.");
        await ctx.audioWorklet.addModule(new URL("worklet.js",import.meta.url));
        node=new AudioWorkletNode(ctx,"bongdrums",{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2],processorOptions:{module}});
        const gain=ctx.createGain();gain.gain.value=.5;node.connect(gain).connect(ctx.destination);port=node.port;
        port.onmessage=({data})=>{
          if(active!==data.step){
            if(active>=0){number[active].classList.remove("current");buttons.forEach(row=>row[active].classList.remove("current"));}
            active=data.step;
            if(active>=0){number[active].classList.add("current");buttons.forEach(row=>row[active].classList.add("current"));}
          }
          $("comp").value=data.c.toFixed(1)+" dB";$("limit").value=data.l.toFixed(1)+" dB";
        };
        node.addEventListener("processorerror",()=>{info.textContent="Audio processor stopped. Reload to retry.";playing=false;$("play").disabled=true;});
        send("state",{state});}
      await ctx.resume();if(ctx.state!=="running")throw Error("Audio is still suspended.");
      info.textContent=playing?"Playing":"Audio ready";return true;
    }catch(error){info.textContent=error.message;if(ctx){await ctx.close().catch(()=>{});ctx=null;port=null;} return false;}
    finally{connecting=null;}
  })();return connecting;
}
async function audition(p){if(await enableAudio())send("hit",{pad:p,accent:0});}
async function toggle(){
  if(playing){playing=false;send("play",{value:false});$("play").textContent="▶ Play";info.textContent="Stopped · tails ring";return;}
  if(await enableAudio()){playing=true;send("play",{value:true});$("play").textContent="■ Stop";info.textContent="Playing";}
}
try{
  const response=await fetch(new URL("bongdrums.wasm",import.meta.url));
  if(!response.ok)throw Error("Drum engine missing");
  module=await WebAssembly.compile(await response.arrayBuffer());patchStore=boot(module);state=setup();apply(patchStore,state);
  gridBuild();
  const scroll=grid.parentElement;
  for(const b of document.querySelectorAll("[data-bank]"))b.onclick=()=>{
    const step=buttons[0][+b.dataset.bank],first=buttons[0][0];
    scroll.scrollLeft=step.offsetLeft-first.offsetLeft;
  };
  for(let p=1;p<=11;p++){const b=make("button",short[p-1],{type:"button","aria-label":"Edit "+names[p-1],"aria-pressed":"false"});b.onclick=()=>selectVoice(p);tabs.push(b);$("voice-tabs").append(b);}
  selectVoice(1);
  $("recipe").onchange=()=>{const v=+$("recipe").value;if(v<0)return;patchStore.bd_recipe(selected,v);state.voices[selected-1]={recipe:v,edits:[]};send("recipe",{pad:selected,value:v});selectVoice(selected);persist();};
  $("audition").onclick=()=>audition(selected);$("play").onclick=toggle;
  $("tempo").value=state.bpm;
  $("tempo").onchange=()=>{state.bpm=Math.round(Math.max(60,Math.min(200,+$("tempo").value||state.bpm)));$("tempo").value=state.bpm;send("tempo",{value:state.bpm});persist();};
  $("groove").onchange=()=>{const g=$("groove").value;if(!presets.includes(g))return;state.rows=scoreValues(g);for(let p=0;p<11;p++)for(let n=0;n<16;n++)refreshCell(p,n);send("state",{state});$("groove").value="";persist();};
  const fmt=(i,v)=>i===2?(v===64?"0%":((v>64?"+":"")+Math.round((v-64)/(v>=64?63:64)*100)+"%")):Math.round(v/127*100)+"%";
  ["Saturator","Compressor","Transient","Limiter"].forEach((name,i)=>{
    const id="macro-"+i,div=make("div",null,{class:"macro"}), label=make("label",name,{for:id});
    const out=make("output",fmt(i,state.macros[i]),{for:id});
    const range=make("input",null,{type:"range",id,min:0,max:127,step:1,value:state.macros[i]});
    label.append(out);div.append(label,range);$("macros").append(div);
    range.oninput=()=>{const v=+range.value;state.macros[i]=v;out.value=fmt(i,v);send("macro",{index:i,value:v});persist();};
  });
  for(const ctl of document.querySelectorAll('input[name=busmode]')){
    ctl.checked=(ctl.value==="dry")===state.dry;
    ctl.onchange=()=>{state.dry=ctl.value==="dry";send("dry",{value:state.dry});persist();};
  }
  document.addEventListener("keydown",e=>{
    if(e.metaKey||e.altKey||e.ctrlKey||e.repeat||e.target.closest("button,input,select,textarea,a,summary,[contenteditable]"))return;
    if(e.code==="Space"){e.preventDefault();toggle();}
    else if(/^[1-9]$/.test(e.key))audition(Number(e.key));
    else if(e.key==="0"||e.key==="-")audition(e.key==="0"?10:11);
  });
}catch(error){info.textContent="BongDrums could not load: "+error.message;$("play").disabled=true;$("audition").disabled=true;}
