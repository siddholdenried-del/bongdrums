// SPDX-License-Identifier: GPL-3.0-only
import {boot,apply} from "./engine.js";
// Measure whole DSP's warm steady-state throughput, excluding startup,
// state serialization, audio device, worklet messaging, scope and painting.
self.onmessage=({data:{module,state}})=>{
  try{
    const rate=44100, block=128;
    const x=boot(module), frames=Math.ceil((60/state.bpm)*4*rate/block);
    const blocks=Math.ceil(4096/frames)*frames;  // near a whole-bar count; constant sample count per trial
    apply(x,state);x.bd_start();
    function render(count){
      for(let i=0;i<count;i++)x.bd_render(block);
    }
    render(frames*2);
    const timings=[];
    for(let i=0;i<3;i++){const t=performance.now();render(blocks);timings.push(performance.now()-t);}
    timings.sort((a,b)=>a-b);
    const ms=timings[1],budget=blocks*block*1000/rate;
    if(!Number.isFinite(ms)||ms<=0)throw Error("Timer unavailable");
    self.postMessage({pct:100*ms/budget,ms,blocks});
  }catch(error){self.postMessage({error:String(error.message||error)});}
};
