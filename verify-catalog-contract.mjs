// Saved kits, shared preset text and browser storage carry numeric recipe IDs and edit slots.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {boot} from './web/engine.js';

const contract=JSON.parse(readFileSync(process.argv[2]??new URL('./catalog-contract.json',import.meta.url)));
const x=boot(new WebAssembly.Module(readFileSync(new URL('./web/bongdrums.wasm',import.meta.url))));
function str(ptr){
 if(!ptr)return null;
 const view=new Uint8Array(x.memory.buffer);
 return Buffer.from(view.subarray(ptr,view.indexOf(0,ptr))).toString();
}
assert.equal(contract.length,11);
for(const [i,{recipes,knobs}] of contract.entries()){
 const p=i+1;
 assert.ok(x.bd_recipe_count(p)>=recipes.length,`pad ${p} removed recipes`);
 assert.ok(x.bd_params(p)>=knobs.length,`pad ${p} removed parameters`);
 for(const [r,name] of recipes.entries()){
  assert.equal(str(x.bd_recipe_name(p,r)),name,`pad ${p} recipe ${r}: maintain the saved ID or migrate existing files`);
 }
 for(const [k,[label,unit,min,max,decimals,options]] of knobs.entries()){
  const why=`pad ${p} parameter ${k}: maintain the saved slot and tick meanings or migrate existing files`;
  assert.deepEqual([str(x.bd_label(p,k)),str(x.bd_unit(p,k)),x.bd_decimals(p,k)],[label,unit,decimals],why);
  assert.ok(x.bd_min(p,k)<=min&&x.bd_max(p,k)>=max,why);
  assert.equal(x.bd_option(p,k,min)!==0,options!==null,why);
  if(options)for(const [t,name] of options.entries())assert.equal(str(x.bd_option(p,k,min+t)),name,why);
 }
}
console.log('Released recipe IDs, parameter slots and saved tick meanings are compatible.');
