import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {boot} from './web/engine.js';
const x=boot(new WebAssembly.Module(readFileSync('web/bongdrums.wasm')));
const legacy=JSON.parse(readFileSync('legacy-catalog.json'));
const name=(f,p,k)=>new TextDecoder().decode(new Uint8Array(x.memory.buffer,f(p,k),64).slice(0,new Uint8Array(x.memory.buffer,f(p,k),64).indexOf(0)));
for(let p=1;p<=11;p++){
 const bank=legacy[p-1];
 assert.ok(x.bd_recipe_count(p)>=bank.length+12);
 for(const [i,row] of bank.entries()){
  assert.equal(name(x.bd_recipe_name,p,i),row.name);
  assert.equal(x.bd_recipe(p,i),1);
  assert.equal(x.bd_match(p),i);
  assert.deepEqual(row.ticks.map((_,k)=>x.bd_get(p,k)),row.ticks);
 }
}
assert.ok(x.bd_option(10,0,8));
assert.equal(x.bd_params(10),10);
console.log('All 57 legacy recipe IDs, labels and knob values preserved alongside the firmware catalog');
