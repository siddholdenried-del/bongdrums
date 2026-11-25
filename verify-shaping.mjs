// Every drum exposes at least four knobs; Tone and Drive change the sound, are bit-exact at 0,
// reset with a factory preset and can be targeted by an LFO.
import {readFileSync} from "node:fs";import assert from "node:assert/strict";import {boot} from "./web/engine.js";
const x=boot(new WebAssembly.Module(readFileSync("web/bongdrums.wasm")));
const str=p=>{if(!p)return "";const v=new Uint8Array(x.memory.buffer);let e=p;while(v[e])e++;return Buffer.from(v.subarray(p,e)).toString();};
const knobs=[];
for(let p=1;p<=11;p++){let n=0;const labels=[];for(let k=0;k<x.bd_params(p);k++){if(!str(x.bd_option(p,k,x.bd_min(p,k)))){n++;labels.push(str(x.bd_label(p,k)));}}knobs.push(n);assert.ok(n>=4,`pad ${p} has ${n} knobs`);
  assert.ok(labels.includes("Tone")&&labels.includes("Drive"));}
console.log("Knobs per drum:",knobs.join(" "));
const paramIdx=(p,name)=>Array.from({length:x.bd_params(p)},(_,i)=>str(x.bd_label(p,i))).indexOf(name);
const toneIdx=p=>paramIdx(p,"Tone"),driveIdx=p=>paramIdx(p,"Drive");
const render=(pad,setup)=>{x.bd_init();x.bd_dry(1);setup();x.bd_hit(pad,1);const out=[];for(let i=0;i<120;i++){x.bd_render(128);out.push(...new Float32Array(x.memory.buffer,x.bd_left(),128));}return Float32Array.from(out);};
const diff=(a,b)=>a.reduce((m,v,i)=>Math.max(m,Math.abs(v-b[i])),0);
const rms=a=>Math.sqrt(a.reduce((s,v)=>s+v*v,0)/a.length);
for(const pad of [1,3,4,7,9,10]){
  const base=render(pad,()=>{}),zero=render(pad,()=>{x.bd_set(pad,toneIdx(pad),0);x.bd_set(pad,driveIdx(pad),0);});
  assert.equal(diff(base,zero),0,"neutral is bit-exact on pad "+pad);
  const dark=render(pad,()=>x.bd_set(pad,toneIdx(pad),-800)),thin=render(pad,()=>x.bd_set(pad,toneIdx(pad),800)),hot=render(pad,()=>x.bd_set(pad,driveIdx(pad),900));
  assert.ok(diff(base,dark)>1e-3&&diff(base,thin)>1e-3&&diff(base,hot)>1e-3,"tone/drive audible on pad "+pad);
  assert.ok(Math.max(...hot.map(Math.abs))<=1.0001,"drive stays bounded");
}
x.bd_init();x.bd_set(7,toneIdx(7),-500);assert.equal(x.bd_match(7),-1);x.bd_recipe(7,1);assert.equal(x.bd_get(7,toneIdx(7)),0);assert.equal(x.bd_match(7),1);
// Free LFO at 1 Hz on BD Tone; let it travel a quarter cycle, then strike.
const preroll=()=>{for(let i=0;i<86;i++)x.bd_render(128);};
const plain=render(1,preroll),mod=render(1,()=>{x.bd_lfo(0,1,0,0,100,100);x.bd_lfo_param(0,toneIdx(1)+1);preroll();});
assert.ok(diff(plain,mod)>1e-3,"LFO on Tone changes the strike");
console.log("Tone/Drive bit-exact at 0, audible on BD CP LT CH CY P1, reset by presets, LFO-targetable");
