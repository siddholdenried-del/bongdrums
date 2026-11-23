#include "station.h"
#include "presets.h"
#include <stdint.h>
#include <stddef.h>
#include <string.h>
static Station s;
static float left[256],right[256];
void bd_init(void){station_init(&s);}
void bd_start(void){station_start(&s);}
void bd_stop(void){station_stop(&s);}
void bd_tempo(int bpm){KitPattern p={.bpm=bpm};for(unsigned i=0;i<11;i++){p.hits[i]=s.clock.hits[i];p.accents[i]=s.clock.accents[i];}station_set_pattern(&s,&p);}
void bd_bank_cell(int bank,int p,int n,int v){if((unsigned)bank<=1)seq_bank_cell(&s.clock,bank,p,n,v);}
void bd_bank(int bank){seq_select(&s.clock,bank);}
int bd_active(void){return s.clock.bank;}
int bd_queued(void){return s.clock.queued;}
void bd_swing(int v){seq_swing(&s.clock,v);}
void bd_lfo(int slot,int lane,int shape,int sync,int rate,int depth){station_lfo(&s,slot,lane,shape,sync,rate,depth);}
void bd_lfo_param(int slot,int param){station_lfo_param(&s,slot,param);}
/* Pad level 0..100, squared to gain so the travel feels even. */
void bd_level(int p,int v){if(v>=0&&v<=100)station_level(&s,p,(float)(v*v)/10000.0f);}
/* Send 0..100 into the shared ROOM (0) or DIGI (1); read back for defaults. */
void bd_send(int p,int which,int v){
#ifdef DRUM_BUS_NO_SPATIAL
(void)p;(void)which;(void)v;
#else
if(v>=0&&v<=100)station_send(&s,p,which,(float)v/100.0f);
#endif
}
int bd_send_get(int p,int which){if(p<1||p>11||(unsigned)which>1)return 0;const BusPad *v=&s.mix.pad[p-1];return (int)((which?v->delay:v->reverb)*100.0f+.5f);}
/* Return level 0..127 for the shared REVERB (0) or DELAY (1) output; 85 is the
   stock 0.8 gain. Applied at each return's output, so ringing tails follow it. */
void bd_return(int which,int v){
#ifdef DRUM_BUS_NO_SPATIAL
(void)which;(void)v;
#else
if((unsigned)which>1||v<0||v>127)return;const float g=v==85?0.8f:0.8f*(float)v/85.0f;if(which)s.bus.returns.dl_level=g;else s.bus.returns.rv_level=g;
#endif
}
/* Pan -100 (left) .. +100 (right); 0 is centre. */
void bd_pan(int p,int v){if(v>=-100&&v<=100)station_pan(&s,p,(float)v/100.0f);}
int bd_lfo_phase(int slot){return (unsigned)slot<STATION_LFOS?(int)s.lfo[slot].phase:0;}
void bd_mute(int p,int v){station_mute(&s,p,v);}
void bd_cell(int p,int n,int v){seq_cell(&s.clock,p,n,v);}
void bd_hit(int p,int accent){station_trigger(&s,p,accent?STATION_ACCENT:STATION_VELOCITY);}
int bd_step(void){return s.clock.current_step;}
void bd_dry(int v){station_set_bypass(&s,v);}
void bd_macro(int k,int v){BusMix m=s.mix;bus_set_macro(&m,k,v);station_set_mix(&s,&m);}
void bd_render(int n){if(n>0&&n<=256)station_render(&s,left,right,n);}
float *bd_left(void){return left;}
float *bd_right(void){return right;}
#ifdef __wasm__
float *bd_lane_peaks(void){return s.bus.lane_peaks;}
void bd_clear_lane_peaks(void){memset(s.bus.lane_peaks,0,sizeof s.bus.lane_peaks);}
void bd_meter_lanes(int enabled){bd_clear_lane_peaks();s.bus.meter_lanes=!!enabled;}
#endif
float bd_comp(void){return s.comp_gr_db;}
float bd_limit(void){return s.limiter_gr_db;}
int bd_recipe(int p,int r){return p>0&&p<=11?kit_preset_apply(&s.patch[p-1],p,r):0;}
int bd_recipe_count(int p){return kit_preset_count(p);}
const char *bd_recipe_name(int p,int r){return kit_preset_name(p,r);}
int bd_match(int p){return p>0&&p<=11?kit_preset_match(&s.patch[p-1],p):-1;}
int bd_params(int p){return kit_param_count(p);}
const char *bd_label(int p,int k){const KitParamSpec *x=kit_param_spec(p,k);return x?x->label:NULL;}
const char *bd_unit(int p,int k){const KitParamSpec *x=kit_param_spec(p,k);return x?x->unit:NULL;}
int bd_min(int p,int k){const KitParamSpec *x=kit_param_spec(p,k);return x?x->min_tick:0;}
int bd_max(int p,int k){const KitParamSpec *x=kit_param_spec(p,k);return x?x->max_tick:0;}
int bd_decimals(int p,int k){const KitParamSpec *x=kit_param_spec(p,k);return x?x->decimals:0;}
int bd_get(int p,int k){return p>0&&p<=11?kit_param_get(&s.patch[p-1],p,k):0;}
int bd_set(int p,int k,int v){return p>0&&p<=11?kit_param_set(&s.patch[p-1],p,k,v):0;}
int bd_edit(int p,int k){return p>0&&p<=11?kit_param_editable(&s.patch[p-1],p,k):0;}
const char *bd_option(int p,int k,int v){return kit_param_option(p,k,v);}
