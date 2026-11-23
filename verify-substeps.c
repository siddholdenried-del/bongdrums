/* SPDX-License-Identifier: GPL-3.0-only */
#include "sequence.h"
#include "kit_math.h"
#include <assert.h>

static void triplets(unsigned bpm, unsigned swing, unsigned block)
{
    Sequencer s; seq_init(&s); seq_clear(&s); seq_set_tempo(&s,bpm); seq_swing(&s,swing);
    seq_bank_cell(&s,0,1,0,12+3+18); /* first slot off, middle hit, late accent */
    seq_bank_cell(&s,0,2,1,12+9); /* short swung step, last triplet only */
    seq_bank_cell(&s,1,3,0,39+54); /* four-way split, last slot accent */
    seq_start(&s); seq_select(&s,1);
    unsigned frame=0, k=0;
    unsigned u=KIT_RATE*15, long_step=2*u*swing/100, short_step=2*u-long_step;
    const unsigned denominator[]={3,3,3,4};
    const unsigned numerator[]={long_step,2*long_step,3*long_step+2*short_step,64*u+3*long_step};
    const unsigned lane[]={1,1,2,4}, accent[]={0,1,0,4};
    while(k<4 && frame<(18*u/bpm)){
        uint16_t h,a; unsigned n=seq_span(&s,block,&h,&a); assert(n);
        if(h){
            const unsigned d=denominator[k]*bpm;
            assert(frame==(numerator[k]+d-1)/d);
            assert(h==lane[k] && a==accent[k] && s.bank==(k==3));
            ++k;
        }
        frame+=n;
    }
    assert(k==4);
}
int main(void)
{
    for(unsigned bpm=60;bpm<=200;bpm+=7)
        for(unsigned sw=50;sw<=75;sw+=5)
            for(unsigned chunk=7;chunk<260;chunk+=84)triplets(bpm,sw,chunk);
}
