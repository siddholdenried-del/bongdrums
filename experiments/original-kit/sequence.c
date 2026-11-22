/* SPDX-License-Identifier: GPL-3.0-only */
#include "sequence.h"
#include "kit_math.h"

enum { STEP_UNITS = KIT_RATE * 15, MAX_STEP_FRAMES = STEP_UNITS / 60 };

void seq_cell(Sequencer *s, int pad, int step, int state)
{
    if (pad < 1 || pad > SEQ_PADS || (unsigned)step >= SEQ_STEPS || (unsigned)state > 2)
        return;
    uint16_t bit = (uint16_t)(1u << step);
    unsigned i = (unsigned)(pad - 1);
    if (state) s->hits[i] |= bit;
    else s->hits[i] &= (uint16_t)~bit;
    if (state == 2) s->accents[i] |= bit;
    else s->accents[i] &= (uint16_t)~bit;
}

void seq_preset(Sequencer *s)
{
    static const char pattern[SEQ_PADS][SEQ_STEPS + 1] = {
        "X..x" "..x." "X.x." "....", /* kick */
        "...." "X..." "...." "X...", /* snare */
        "...." "...." "...." "x...", /* clap */
        "...." "...." "...." ".x..", /* low tom */
        "...." "...." "...." "..x.", /* mid tom */
        "...." "...." "...." "...X", /* high tom */
        "X.x." "x.x." "X.x." "x.x.", /* closed hat */
        "...." "...x" "...X" "....", /* open hat */
        "x..." "...." "...." "....", /* cymbal */
        "...." ".X.." ".x.." "....", /* perc 1 */
        "..x." "...." "...." "..x."  /* perc 2 */
    };
    for (int pad = 1; pad <= SEQ_PADS; ++pad) {
        for (int step = 0; step < SEQ_STEPS; ++step) {
            char x = pattern[pad - 1][step];
            seq_cell(s, pad, step, x == 'X' ? 2 : x == 'x' ? 1 : 0);
        }
    }
}

void seq_clear(Sequencer *s)
{
    for (int pad = 0; pad < SEQ_PADS; ++pad) s->hits[pad] = s->accents[pad] = 0;
}

void seq_start(Sequencer *s)
{
    s->running = 1;
    s->current_step = 0;
    s->phase = 0;
    s->downbeat_pending = 1;
}

void seq_stop(Sequencer *s)
{
    s->running = 0;
    s->current_step = -1;
    s->phase = 0;
    s->downbeat_pending = 0;
}

void seq_set_tempo(Sequencer *s, int bpm)
{
    /* The phase measures a fraction of a step at every tempo. A BPM change
     * adjusts the slope from this sample forward, preserving elapsed time. */
    s->bpm = bpm < 60 ? 60 : bpm > 200 ? 200 : bpm;
}

void seq_init(Sequencer *s)
{
    *s = (Sequencer){0};
    s->bpm = 130;
    seq_stop(s);
    seq_preset(s);
}

unsigned seq_span(Sequencer *s, unsigned max_frames, uint16_t *hits, uint16_t *accents)
{
    *hits = *accents = 0;
    if (!s->running || !max_frames) return max_frames;
    if (s->phase >= STEP_UNITS || s->downbeat_pending) {
        if (s->downbeat_pending) s->downbeat_pending = 0;
        else {
            /* Carry any fractional overshoot into the new step. */
            s->phase -= STEP_UNITS;
            s->current_step = (s->current_step + 1) % SEQ_STEPS;
        }
        uint16_t bit = (uint16_t)(1u << s->current_step);
        for (int pad = 0; pad < SEQ_PADS; ++pad) {
            uint16_t lane = (uint16_t)(1u << pad);
            if (s->hits[pad] & bit) *hits |= lane;
            if (s->accents[pad] & bit) *accents |= lane;
        }
    }
    unsigned remaining = STEP_UNITS - s->phase;
    unsigned bpm = (unsigned)s->bpm;
    unsigned span = max_frames;
    /* Avoid a divide for ordinary callback spans that end before a boundary.
     * The bound on max_frames also makes the multiplication safe for UINT_MAX. */
    if (max_frames > MAX_STEP_FRAMES || max_frames * bpm > remaining)
        span = (remaining + bpm - 1u) / bpm;
    s->phase += span * bpm;
    return span;
}
