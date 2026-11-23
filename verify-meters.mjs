import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import assert from "node:assert/strict";
import {boot} from "./web/engine.js";
const x=boot(new WebAssembly.Module(readFileSync("web/bongdrums.wasm")));
const base=boot(new WebAssembly.Module(execFileSync("git",["show","68fa6fd:web/bongdrums.wasm"])));
const lane=new Float32Array(x.memory.buffer,x.bd_lane_peaks(),11);
const block=(e,p)=>new Float32Array(e.memory.buffer,p?e.bd_right():e.bd_left(),128);
for(const wet of [0,1]){
  for(const e of [x,base]){e.bd_init();e.bd_dry(!wet);for(let p=1;p<=11;p++)for(let i=0;i<2;i++)e.bd_send(p,i,0);e.bd_start();}
  for(let i=0;i<720;i++){
    if(i===360)x.bd_meter_lanes(1);
    x.bd_render(128);base.bd_render(128);
    for(const p of [0,1])assert.deepEqual(block(x,p),block(base,p));
    if(i%18===17)x.bd_clear_lane_peaks();
  }
}
function peak(p,fader=100,pan=0,muted=false){
  x.bd_init();x.bd_meter_lanes(1);x.bd_dry(1);x.bd_level(p,fader);x.bd_pan(p,pan);x.bd_mute(p,muted);x.bd_render(128);x.bd_hit(p,1);
  let output=0;
  for(let i=0;i<24;i++){x.bd_render(128);for(const j of [0,1])for(const v of block(x,j))output=Math.max(output,Math.abs(v));}
  // The dry bus applies 0.75 group headroom, then Station applies -4 dB trim.
  assert.ok(Math.abs(lane[p-1]*.75*.63095734-output)<1e-6);
  for(const j of lane.keys())if(j!==p-1)assert.equal(lane[j],0);
  return lane[p-1];
}
for(let p=1;p<=11;p++)assert.ok(peak(p)>.001);
const full=peak(1);assert.ok(Math.abs(peak(1,50)/full-.25)<1e-6);
assert.ok(peak(1,100,100)>0);assert.equal(peak(1,0),0);assert.equal(peak(1,100,0,true),0);
x.bd_clear_lane_peaks();assert.ok(lane.every(v=>v===0));
console.log("11 true lane peaks; level, pan, mute, read/reset; WASM output byte-exact versus release with spatial sends disabled");
