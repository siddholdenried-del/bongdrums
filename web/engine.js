export function boot(module){
  const x=new WebAssembly.Instance(module).exports;
  x._initialize();x.bd_init();return x;
}
export function apply(x,s){
  x.bd_tempo(s.bpm);x.bd_dry(s.dry?1:0);
  for(let k=0;k<4;k++)x.bd_macro(k,s.macros[k]);
  for(let p=1;p<=11;p++){
    x.bd_recipe(p,s.voices[p-1].recipe);
    for(const [k,v] of s.voices[p-1].edits)x.bd_set(p,k,v);
    for(let n=0;n<16;n++)x.bd_cell(p,n,s.rows[p-1][n]);
  }
}
