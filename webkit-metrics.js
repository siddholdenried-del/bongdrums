const delay=ms=>new Promise(r=>setTimeout(r,ms));
let context, scope;
const Klass=AudioContext;
window.AudioContext=class extends Klass{
 constructor(config){super(config);context=this;scope=this.createAnalyser();}
 createGain(){const bus=super.createGain();bus.connect(scope);return bus;}
};
if(document.querySelectorAll(".step").length!==176)throw Error("Grid not initialized");
if(context)throw Error("Audio started before opt in");
document.querySelector("#play").click();
for(let i=0;i<50&&document.querySelector("#status").innerText!=="Playing";i++)await delay(80);
if(document.querySelector("#status").innerText!=="Playing")throw Error(document.querySelector("#status").innerText);
let peak=0;
const sample=new Float32Array(scope.fftSize);
for(let i=0;i<25;i++){scope.getFloatTimeDomainData(sample);for(const n of sample)peak=Math.max(peak,Math.abs(n));await delay(70);}
if(peak<.04)throw Error("Audio graph is silent: "+peak);
if(context.sampleRate!==44100)throw Error("Unexpected clock");
return {peak,sampleRate:context.sampleRate,ua:navigator.userAgent,scope:"native WKWebView; test harness permits playback"};
