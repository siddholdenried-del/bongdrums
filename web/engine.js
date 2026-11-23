export function boot(module){
  const x=new WebAssembly.Instance(module).exports;
  x._initialize();x.bd_init();return x;
}
export function lfo(x,i,l){
  x.bd_lfo(i,l.lane,l.wave,l.sync?1:0,l.sync?l.div:l.hz,l.depth);
  x.bd_lfo_param(i,l.lane?(l.param||0):0);
}
export function apply(x,s){
  x.bd_bank(s.playBank);x.bd_swing(s.swing);
  x.bd_tempo(s.bpm);x.bd_dry(s.dry?1:0);
  for(let k=0;k<4;k++)x.bd_macro(k,s.macros[k]);
  for(let p=1;p<=11;p++){
    x.bd_recipe(p,s.voices[p-1].recipe);
    for(const [k,v] of s.voices[p-1].edits)x.bd_set(p,k,v);
    x.bd_mute(p,s.mutes[p-1]?1:0);
    x.bd_level(p,s.levels?.[p-1]??100);
    if(s.pans)x.bd_pan(p,s.pans[p-1]);
    for(let b=0;b<2;b++)for(let n=0;n<16;n++)x.bd_bank_cell(b,p,n,s.banks[b][p-1][n]);
  }
  s.lfos.forEach((l,i)=>lfo(x,i,l));
}
