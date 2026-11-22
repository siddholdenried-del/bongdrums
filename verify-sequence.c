// SPDX-License-Identifier: GPL-3.0-only
#include "sequence.h"
#include "kit_math.h"
#include <assert.h>
#include <stdio.h>

static void run(int bpm, int swing, int chunk)
{
    Sequencer s; seq_init(&s); seq_clear(&s); seq_set_tempo(&s,bpm); seq_swing(&s,swing);
    for (int n=0;n<16;n++) {seq_cell(&s,1,n,1);seq_bank_cell(&s,1,2,n,2);}
    assert(s.bank==0 && s.queued==-1);
    seq_select(&s,1); assert(s.bank==1 && s.queued==-1);
    seq_select(&s,0); seq_start(&s); seq_select(&s,1); assert(s.bank==0 && s.queued==1);
    uint64_t frame=0;
    int n=0;
    while(n<193){
        uint16_t hit,accent;
        unsigned span=seq_span(&s,chunk,&hit,&accent);
        assert(span>0);
        if(hit){
            const uint64_t u= KIT_RATE * 15;
            uint64_t threshold=n/2*(2*u)+(n&1 ? 2*u*swing/100:0);
            assert(frame==(threshold+bpm-1)/bpm);
            assert(hit==(n<16?1:2) && accent==(n<16?0:2));
            assert(s.bank==(n<16?0:1) && s.queued==(n<16?1:-1));
            n++;
        }
        frame+=span;
    }
    seq_select(&s,0);seq_select(&s,1);assert(s.queued==-1);
    seq_select(&s,0);seq_stop(&s);assert(s.bank==0&&s.queued==-1);
}
int main(void){
    for(int bpm=60;bpm<=200;bpm+=7)
        for(int sw=50;sw<=75;sw+=5)
            for(int chunk=7;chunk<=259;chunk+=84)run(bpm,sw,chunk);
    puts("Straight/swing exact sample and bar boundaries, next-bar A/B, cancellation and stop verified");
}
