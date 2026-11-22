// Every factory kit and pattern loads through the real C catalog: recipes exist, edits are in range and editable.
import {readFileSync} from "node:fs";import assert from "node:assert/strict";
const root=new URL(".",import.meta.url).pathname.replace(/\/$/,"");
const {boot}=await import(root+"/web/engine.js");const {kits,patterns,patternValues}=await import(root+"/web/library.js");
const m=new WebAssembly.Module(readFileSync(root+"/web/bongdrums.wasm"));
for(const p of patterns){assert.equal(p.rows.length,11,p.name);for(const r of p.rows)assert.ok(r.length===16&&/^[.xX]+$/.test(r),p.name+" "+r);
  if(p.bpm!==null)assert.ok(p.bpm>=60&&p.bpm<=200&&p.swing>=50&&p.swing<=75,p.name);assert.equal(patternValues(p).flat().length,176);}
for(const k of kits){const x=boot(m);assert.equal(k.voices.length,11,k.name);
  assert.ok(k.macros.length===4&&k.macros.every(v=>v>=0&&v<=127),k.name);
  if(k.returns)assert.ok(k.returns.length===2&&k.returns.every(v=>Number.isInteger(v)&&v>=0&&v<=127),k.name+" returns");
  if(k.pans)assert.ok(k.pans.length===11&&k.pans.every(v=>Number.isInteger(v)&&v>=-100&&v<=100),k.name+" pans");
  if(k.levels)assert.ok(k.levels.length===11&&k.levels.every(v=>v>=0&&v<=100));
  if(k.sends)assert.ok(k.sends.length===11&&k.sends.every(s=>s.length===2&&s.every(v=>v>=0&&v<=100)));
  k.voices.forEach((v,i)=>{const p=i+1;assert.equal(x.bd_recipe(p,v.recipe),1,k.name+" pad "+p+" recipe");
    for(const [n,val] of v.edits){assert.ok(val>=x.bd_min(p,n)&&val<=x.bd_max(p,n),k.name+" pad "+p+" edit "+n+" range");assert.equal(x.bd_set(p,n,val),1,k.name+" pad "+p+" edit "+n+" editable");}});}
console.log(kits.length,"kits and",patterns.length,"patterns valid against the engine");
