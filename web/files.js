// SPDX-License-Identifier: GPL-3.0-only
export const MAX_FILE = 16 * 1024;
export const voiceIds=["kick","snare","clap","low-tom","mid-tom","high-tom","closed-hat","open-hat","cymbal","perc-a","perc-b"];
const bounded=(v,a,b)=>Number.isInteger(v)&&v>=a&&v<=b;
const chars=".xX";
export function exportPattern(s){
  return JSON.stringify({kind:"BongDrums Pattern",version:1,bpm:s.bpm,swing:s.swing,banks:s.banks.map(bank=>bank.map(row=>row.map(x=>chars[x]).join("")))},null,2)+"\n";
}
export function exportPreset(voice,voicePatch){
  return JSON.stringify({kind:"BongDrums Drum Preset",version:1,voice:voiceIds[voice-1],recipe:voicePatch.recipe,edits:voicePatch.edits},null,2)+"\n";
}
export function parseFile(text,expected,pad,probe){
  if(new TextEncoder().encode(text).length>MAX_FILE)throw Error("File exceeds the 16 KB limit.");
  let p;
  try{p=JSON.parse(text);}catch{throw Error("Not a valid BongDrums text file.");}
  if(!p||p.kind!=="BongDrums "+expected||p.version!==1)throw Error("Choose a BongDrums "+expected+" v1 text file.");
  if(expected==="Pattern"){
    if(!bounded(p.bpm,60,200)||!bounded(p.swing,50,75)||!Array.isArray(p.banks)||p.banks.length!==2||
      !p.banks.every(b=>Array.isArray(b)&&b.length===11&&b.every(r=>typeof r==="string"&&r.length===16&&/^[.xX]+$/.test(r))))
      throw Error("Pattern needs two banks of 11 rows × 16 steps, tempo 60–200, and swing 50–75.");
    return {bpm:p.bpm,swing:p.swing,banks:p.banks.map(b=>b.map(r=>Array.from(r,c=>chars.indexOf(c))))};
  }
  if(p.voice!==voiceIds[pad-1])throw Error("This preset belongs to "+(voiceIds.includes(p.voice)?p.voice:"an unknown voice")+". Select the matching pad.");
  if(!bounded(p.recipe,0,probe.bd_recipe_count(pad)-1)||!Array.isArray(p.edits)||p.edits.length>256)throw Error("Invalid factory recipe or parameter list.");
  probe.bd_recipe(pad,p.recipe);
  for(const e of p.edits){
    if(!Array.isArray(e)||e.length!==2||!bounded(e[0],0,probe.bd_params(pad)-1)||
       !bounded(e[1],probe.bd_min(pad,e[0]),probe.bd_max(pad,e[0]))||
       !probe.bd_set(pad,e[0],e[1]))throw Error("Preset has an invalid or unavailable voice parameter.");
  }
  return {recipe:p.recipe,edits:p.edits};
}
