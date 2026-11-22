import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
import {boot} from "./web/engine.js";
const module=new WebAssembly.Module(readFileSync("web/bongdrums.wasm"));
const x=boot(module);
const f=readFileSync("native.tmp");
for(let wet=0;wet<2;wet++){
 x.bd_init();x.bd_dry(!wet);x.bd_start();let worst=0,power=0;
 for(let i=0;i<720;i++){
   x.bd_render(128);
   for(let c=0;c<2;c++){
     const buf=new Float32Array(x.memory.buffer,c?x.bd_right():x.bd_left(),128);
     for(let n=0;n<buf.length;n++){
       const y=buf[n],native=f.readFloatLE((wet*720*256+i*256+c*128+n)*4);
       assert.ok(Number.isFinite(y));worst=Math.max(worst,Math.abs(y-native));power+=y*y;
     }
   }
 }
 assert.ok(worst<1e-4);assert.ok(power>1);
 console.log(wet?"Bus":"Dry",": 184,320 samples, max absolute native/WASM difference",worst);
}
x.bd_init();let choices=0;
for(let p=1;p<=11;p++){
 for(let i=0;i<x.bd_recipe_count(p);i++){
  choices++;assert.equal(x.bd_recipe(p,i),1);assert.equal(x.bd_match(p),i);
  for(let k=0;k<x.bd_params(p);k++)assert.ok(x.bd_get(p,k)>=x.bd_min(p,k)&&x.bd_get(p,k)<=x.bd_max(p,k));
 }
}
assert.equal(choices,57);console.log("57 presets round-trip through actual C catalog");
