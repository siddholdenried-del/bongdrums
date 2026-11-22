/* Per-pad level, shared-send voicing and LFO slider targets, natively. */
#include "station.h"
#include "presets.h"
#include <assert.h>
#include <math.h>
#include <stdio.h>
void bd_init(void),bd_render(int),bd_dry(int),bd_hit(int,int),bd_level(int,int),bd_send(int,int,int);
void bd_lfo(int,int,int,int,int,int),bd_lfo_param(int,int);
int bd_send_get(int,int),bd_params(int),bd_min(int,int),bd_max(int,int);
float *bd_left(void),*bd_right(void);
static double energy(int pad,int frames){double e=0;bd_hit(pad,0);for(int i=0;i<frames;i+=128){bd_render(128);for(int n=0;n<128;n++)e+=bd_left()[n]*bd_left()[n]+bd_right()[n]*bd_right()[n];}return e;}
int main(void){
  /* Level: half travel = -12 dB (squared), zero = silence. Dry, no returns. */
  bd_init();bd_dry(1);double full=energy(2,22050);
  bd_init();bd_dry(1);bd_level(2,50);double half=energy(2,22050);
  bd_init();bd_dry(1);bd_level(2,0);double off=energy(2,22050);
  printf("Snare dry level: 100%%=%.3f 50%%=%.4f (%.1f dB) 0%%=%g\n",full,half,10*log10(half/full),off);
  assert(full>0&&fabs(10*log10(half/full)+12.04)<0.3&&off<1e-12);
  /* Sends: defaults read back, zero sends removes the bus tail. */
  bd_init();assert(bd_send_get(1,0)==10&&bd_send_get(2,0)==65&&bd_send_get(11,1)==61);
  bd_init();bd_dry(0);for(int p=1;p<=11;p++){bd_send(p,0,0);bd_send(p,1,0);}
  bd_hit(2,0);for(int i=0;i<22050/128;i++)bd_render(128);double dry_tail=energy(0,22050);
  bd_init();bd_dry(0);bd_send(2,0,100);bd_send(2,1,100);
  bd_hit(2,0);for(int i=0;i<22050/128;i++)bd_render(128);double wet_tail=energy(0,22050);
  printf("Snare tail 0.5-1.0 s after hit: sends 0 = %g, sends 100 = %.4f\n",dry_tail,wet_tail);
  assert(wet_tail>dry_tail*100&&wet_tail>1e-6);
  /* LFO slider target: per-hit values vary, level target untouched. */
  int k=-1;for(int i=0;i<bd_params(1);i++)if(!kit_param_option(1,i,bd_min(1,i))&&bd_max(1,i)>bd_min(1,i)){k=i;break;}
  assert(k>=0);
  /* Same first hit, LFO off vs depth 0 (identical) vs depth 100 (different). */
  static float run[3][2048];
  for(int c=0;c<3;c++){bd_init();bd_dry(1);if(c){bd_lfo(0,1,0,0,1200,c==2?100:0);bd_lfo_param(0,k+1);}
    for(int i=0;i<9;i++)bd_render(128);bd_hit(1,0);
    for(int i=0;i<16;i++){bd_render(128);for(int n=0;n<128;n++)run[c][i*128+n]=bd_left()[n];}}
  double d0=0,d1=0;for(int n=0;n<2048;n++){d0=fmax(d0,fabs(run[1][n]-run[0][n]));d1=fmax(d1,fabs(run[2][n]-run[0][n]));}
  printf("Kick '%s' target: depth 0 max diff %g, depth 100 max diff %.4f\n",kit_param_spec(1,k)->label,d0,d1);
  assert(d0==0&&d1>1e-3);
  /* Level target still ducks continuously; a slider target does not. */
  bd_init();bd_dry(1);bd_lfo(0,2,0,0,1200,100);bd_lfo_param(0,0);double duck=energy(2,4410);
  bd_init();bd_dry(1);double plain=energy(2,4410);
  printf("Snare level target at 100%%: %.1f dB vs plain\n",10*log10(duck/plain));
  assert(duck<plain*0.9);
  puts("Mix and modulation checks passed");return 0;}
