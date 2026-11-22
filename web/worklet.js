import {boot,apply,lfo} from "./engine.js";
class BongDrums extends AudioWorkletProcessor{
  constructor(options){
    super();this.x=boot(options.processorOptions.module);this.last=-2;this.bank=-1;this.queued=-2;this.ticks=0;this.peakC=0;this.peakL=0;this.peakO=0;
    const x=this.x;
    this.left=new Float32Array(x.memory.buffer,x.bd_left(),256);
    this.right=new Float32Array(x.memory.buffer,x.bd_right(),256);
    this.port.onmessage=({data:d})=>{
      switch(d.kind){
        case "state": apply(x,d.state);break;
        case "play": d.value?x.bd_start():x.bd_stop();break;
        case "hit": x.bd_hit(d.pad,d.accent);break;
        case "cell": x.bd_bank_cell(d.bank,d.pad,d.step,d.value);break;
        case "bank-rows": for(let p=0;p<11;p++)for(let n=0;n<16;n++)x.bd_bank_cell(d.bank,p+1,n,d.rows[p][n]);break;
        case "bank": x.bd_bank(d.bank);break;
        case "swing": x.bd_swing(d.value);break;
        case "lfo": lfo(x,d.slot,d.value);break;
        case "mute": x.bd_mute(d.pad,d.value);break;
        case "level": x.bd_level(d.pad,d.value);break;
        case "send": x.bd_send(d.pad,d.which,d.value);break;
        case "return": x.bd_return(d.which,d.value);break;
        case "pan": x.bd_pan(d.pad,d.value);break;
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
      for(let i=0;i<n;i++){const a=this.left[i],b=this.right[i];l[at+i]=a;r[at+i]=b;const m=a>b?(a>-b?a:-b):(b>-a?b:-a);if(m>this.peakO)this.peakO=m;}
      this.peakC=Math.max(this.peakC,x.bd_comp());this.peakL=Math.max(this.peakL,x.bd_limit());
    }
    const step=x.bd_step();
    const bank=x.bd_active(),queued=x.bd_queued();
    if(step!==this.last||bank!==this.bank||queued!==this.queued||++this.ticks>=18){
      this.port.postMessage({step,bank,queued,c:this.peakC,l:this.peakL,o:this.peakO,p:[x.bd_lfo_phase(0)>>>0,x.bd_lfo_phase(1)>>>0]});this.last=step;this.bank=bank;this.queued=queued;this.ticks=0;this.peakC=0;this.peakL=0;this.peakO=0;
    }
    return true;
  }
}
registerProcessor("bongdrums",BongDrums);
