import {boot,apply} from "./engine.js";
class BongDrums extends AudioWorkletProcessor{
  constructor(options){
    super();this.x=boot(options.processorOptions.module);this.last=-2;this.ticks=0;this.peakC=0;this.peakL=0;
    const x=this.x;
    this.left=new Float32Array(x.memory.buffer,x.bd_left(),256);
    this.right=new Float32Array(x.memory.buffer,x.bd_right(),256);
    this.port.onmessage=({data:d})=>{
      switch(d.kind){
        case "state": apply(x,d.state);break;
        case "play": d.value?x.bd_start():x.bd_stop();break;
        case "hit": x.bd_hit(d.pad,d.accent);break;
        case "cell": x.bd_cell(d.pad,d.step,d.value);break;
        case "tempo": x.bd_tempo(d.value);break;
        case "recipe": x.bd_recipe(d.pad,d.value);break;
        case "param": x.bd_set(d.pad,d.index,d.value);break;
        case "dry": x.bd_dry(d.value?1:0);break;
        case "macro": x.bd_macro(d.index,d.value);break;
      }
    };
  }
  process(_,outputs){
    const [l,r]=outputs[0];if(!l||!r)return true;const x=this.x;
    for(let at=0;at<l.length;at+=256){
      const n=Math.min(256,l.length-at);x.bd_render(n);
      for(let i=0;i<n;i++){l[at+i]=this.left[i];r[at+i]=this.right[i];}
      this.peakC=Math.max(this.peakC,x.bd_comp());this.peakL=Math.max(this.peakL,x.bd_limit());
    }
    const step=x.bd_step();
    if(step!==this.last||++this.ticks>=18){
      this.port.postMessage({step,c:this.peakC,l:this.peakL});this.last=step;this.ticks=0;this.peakC=0;this.peakL=0;
    }
    return true;
  }
}
registerProcessor("bongdrums",BongDrums);
