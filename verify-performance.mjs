import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import assert from "node:assert/strict";
import {boot} from "./web/engine.js";
import {exportPattern,exportPreset,parseFile,MAX_FILE} from "./web/files.js";
const module=new WebAssembly.Module(readFileSync("web/bongdrums.wasm"));
const x=boot(module);
const old=boot(new WebAssembly.Module(execFileSync("git",["show","v0.1.0:web/bongdrums.wasm"])));
const channel=(e,c=0,n=128)=>new Float32Array(e.memory.buffer,c?e.bd_right():e.bd_left(),n);
for(let mode=0;mode<2;mode++){
 for(const e of [x,old]){e.bd_init();e.bd_dry(mode);e.bd_start();}
 x.bd_swing(50);x.bd_lfo(0,1,2,1,2,0);x.bd_lfo(1,2,0,0,1120,0);
 for(let i=0;i<720;i++){
  x.bd_render(128);old.bd_render(128);
  for(let c=0;c<2;c++)assert.deepEqual(channel(x,c),channel(old,c));
 }
}
const ref=boot(module);x.bd_init();
x.bd_mute(1,1);x.bd_render(128);
x.bd_hit(1,1);ref.bd_hit(1,1);
for(let i=0;i<30;i++){
  x.bd_render(128);ref.bd_render(128);
  assert.ok(channel(x).every(v=>v===0));
}
x.bd_mute(1,0);x.bd_render(128);ref.bd_render(128);
for(let i=0;i<64;i++)assert.ok(Math.abs(channel(x)[i]-channel(ref)[i]*(i+1)/64)<1e-7);
assert.deepEqual(channel(x).slice(64),channel(ref).slice(64));
assert.ok(channel(x).slice(64).some(v=>Math.abs(v)>.005));
x.bd_init();x.bd_hit(9,1);x.bd_start();x.bd_bank(1);
for(let i=0;i<640;i++)x.bd_render(128);
assert.equal(x.bd_active(),1);
for(let speed of [61,117,130,200]){
  x.bd_init();x.bd_tempo(speed);x.bd_lfo(0,1,0,1,3,100);x.bd_lfo(1,2,1,1,0,50);x.bd_start();
  const frames=700003;
  let left=frames;
  while(left){const count=Math.min(245,left);x.bd_render(count);left-=count;}
  for(const [slot,ratio] of [[0,8],[1,1]]){
    const phase=Number(((BigInt(frames)*BigInt(speed*ratio)<<32n)/(44100n*480n))&0xffffffffn);
    assert.equal(x.bd_lfo_phase(slot)>>>0,phase);
  }
}
const renderWith=(lfo0,lfo1)=>{
 x.bd_init();
 x.bd_lfo(0,1,0,0,1200,lfo0);x.bd_lfo(1,1,1,0,140,lfo1);
 x.bd_hit(1,1);const signal=[];
 for(let i=0;i<16;i++){x.bd_render(128);signal.push(...channel(x));}
 return signal;
};
const dry=renderWith(0,0),s1=renderWith(80,0),s2=renderWith(0,65),both=renderWith(80,65);
for(const s of [s1,s2,both])assert.notDeepEqual(s,dry);
assert.notDeepEqual(both,s1);assert.notDeepEqual(both,s2);
const s={bpm:137,swing:64,banks:Array.from({length:2},(_,b)=>Array.from({length:11},(_,p)=>Array.from({length:16},(_,n)=>(b+p+n)%3)))};
assert.deepEqual(parseFile(exportPattern(s),"Pattern"),s);
const preset={recipe:0,edits:[[0,570]]};
assert.deepEqual(parseFile(exportPreset(1,preset),"Drum Preset",1,ref),preset);
for(const text of ["nope","x".repeat(MAX_FILE+1),exportPattern({...s,bpm:900}),exportPattern({...s,swing:49}),exportPreset(1,preset),exportPattern({...s,banks:[s.banks[0]]})])assert.throws(()=>parseFile(text,"Pattern"));
assert.throws(()=>parseFile(exportPreset(2,preset),"Drum Preset",1,ref));
assert.throws(()=>parseFile(exportPreset(1,{recipe:999,edits:[]}),"Drum Preset",1,ref));
assert.throws(()=>parseFile(exportPreset(1,{recipe:0,edits:[[0,10000000]]}),"Drum Preset",1,ref));
console.log("v0.1.0 byte-equal PCM in both modes; muted hits resume mid-tail; 2 LFOs modulate and stay phase-locked; both .txt types round trip and reject malformed input");
