#include "station.h"
#include "presets.h"
#include <stdint.h>
#include <stddef.h>
static Station s;
static float left[256],right[256];
void bd_init(void){station_init(&s);}
void bd_start(void){station_start(&s);}
void bd_stop(void){station_stop(&s);}
void bd_tempo(int bpm){KitPattern p={.bpm=bpm};for(unsigned i=0;i<11;i++){p.hits[i]=s.clock.hits[i];p.accents[i]=s.clock.accents[i];}station_set_pattern(&s,&p);}
void bd_cell(int p,int n,int v){seq_cell(&s.clock,p,n,v);}
void bd_hit(int p,int accent){if(p>0&&p<=11)station_hit(&s,p,accent?STATION_ACCENT:STATION_VELOCITY,&s.patch[p-1]);}
int bd_step(void){return s.clock.current_step;}
void bd_dry(int v){station_set_bypass(&s,v);}
void bd_macro(int k,int v){BusMix m=s.mix;bus_set_macro(&m,k,v);station_set_mix(&s,&m);}
void bd_render(int n){if(n>0&&n<=256)station_render(&s,left,right,n);}
float *bd_left(void){return left;}
float *bd_right(void){return right;}
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
