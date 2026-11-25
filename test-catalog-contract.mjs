import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {test} from 'node:test';
const file=new URL('./catalog-contract.json',import.meta.url);
const contract=JSON.parse(readFileSync(file));
test('saved preset IDs and numeric edit slots cannot be reused or reordered',()=>{
 const dir=mkdtempSync(join(tmpdir(),'bong-catalog-'));
 try {
  const candidate=structuredClone(contract);
  const rows=candidate[0].recipes;
  [rows[6],rows[7]]=[rows[7],rows[6]];
  const path=join(dir,'reordered.json');
  writeFileSync(path,JSON.stringify(candidate));
  const result=spawnSync(process.execPath,['verify-catalog-contract.mjs',path],{encoding:'utf8'});
  assert.equal(result.status,1);
  assert.match(result.stderr,/pad 1 recipe 6/);
  const slots=structuredClone(contract);
  const knobs=slots[1].knobs;
  [knobs[1],knobs[2]]=[knobs[2],knobs[1]];
  writeFileSync(path,JSON.stringify(slots));
  const changed=spawnSync(process.execPath,['verify-catalog-contract.mjs',path],{encoding:'utf8'});
  assert.equal(changed.status,1);
  assert.match(changed.stderr,/pad 2 parameter 1/);
 } finally {rmSync(dir,{recursive:true,force:true});}
});
