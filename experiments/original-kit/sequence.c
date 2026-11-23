/* SPDX-License-Identifier: GPL-3.0-only */
#include "sequence.h"
#include "kit_math.h"

enum { STEP_UNITS = KIT_RATE * 15 };

void seq_bank_cell(Sequencer *s, int bank, int pad, int step, int state)
{
    if (pad < 1 || pad > SEQ_PADS || (unsigned)step >= SEQ_STEPS || (unsigned)bank > 1 || (unsigned)state > 119)
        return;
    s->subcells[bank][pad-1][step] = state > 2 ? (uint8_t)state : 0;
    if (state > 2) state = 0;
    uint16_t bit = (uint16_t)(1u << step);
    unsigned i = (unsigned)(pad - 1);
    uint16_t *h = bank ? s->hits_b : s->hits;
    uint16_t *a = bank ? s->accents_b : s->accents;
    if (state) h[i] |= bit;
    else h[i] &= (uint16_t)~bit;
    if (state == 2) a[i] |= bit;
    else a[i] &= (uint16_t)~bit;
}

void seq_cell(Sequencer *s, int pad, int step, int state)
{
    seq_bank_cell(s, 0, pad, step, state);
}

void seq_select(Sequencer *s, int bank)
{
    if ((unsigned)bank > 1) return;
    if (s->running) s->queued = bank == s->bank ? -1 : bank;
    else s->bank = bank;
}

void seq_swing(Sequencer *s, int percent)
{
    s->swing = percent < 50 ? 50 : percent > 75 ? 75 : percent;
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
    for (int pad = 0; pad < SEQ_PADS; ++pad) {
        s->hits[pad] = s->accents[pad] = 0;
        for (int step = 0; step < SEQ_STEPS; ++step) s->subcells[0][pad][step] = 0;
    }
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
    if (s->queued >= 0) s->bank = s->queued;
    s->queued = -1;
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
    s->swing = s->pair_swing = 50;
    s->queued = -1;
    seq_stop(s);
    seq_preset(s);
}

/* Each adjacent pair remains two straight steps long. STEP_UNITS is divisible
 * by 50 at the fixed kit rate, so integer percentages add no truncation. */
static unsigned step_units(const Sequencer *s)
{
    unsigned share = (s->current_step & 1) ? 100u - s->pair_swing : (unsigned)s->pair_swing;
    return share * (STEP_UNITS / 50u);
}

unsigned seq_span(Sequencer *s, unsigned max_frames, uint16_t *hits, uint16_t *accents)
{
    *hits = *accents = 0;
    if (!s->running || !max_frames) return max_frames;
    unsigned units = step_units(s);
    if (s->phase >= units || s->downbeat_pending) {
        int initial = s->downbeat_pending;
        if (initial) s->downbeat_pending = 0;
        else {
            /* Carry any fractional overshoot into the new step. */
            s->phase -= units;
            s->current_step = (s->current_step + 1) % SEQ_STEPS;
        }
        if (!(s->current_step & 1)) s->pair_swing = s->swing;
        if (!initial && s->current_step == 0 && s->queued >= 0) {
            s->bank = s->queued;
            s->queued = -1;
        }
        units = step_units(s);
        const uint16_t *h = s->bank ? s->hits_b : s->hits;
        const uint16_t *a = s->bank ? s->accents_b : s->accents;
        uint16_t bit = (uint16_t)(1u << s->current_step);
        for (int j = 0; j < 12; ++j) s->subhits[j] = s->subaccents[j] = 0;
        s->next_sub = 0;
        for (unsigned pad = 0; pad < SEQ_PADS; ++pad) {
            uint16_t lane = (uint16_t)(1u << pad);
            unsigned v = s->subcells[s->bank][pad][s->current_step];
            if (!v) {
                if (h[pad] & bit) s->subhits[0] |= lane;
                if (a[pad] & bit) s->subaccents[0] |= lane;
            } else {
                unsigned div = v < 12 ? 2 : v < 39 ? 3 : 4;
                v -= div == 2 ? 3 : div == 3 ? 12 : 39;
                for (unsigned j = 0; j < div; ++j, v /= 3) {
                    unsigned slot = j * (12 / div);
                    if (v % 3) s->subhits[slot] |= lane;
                    if (v % 3 == 2) s->subaccents[slot] |= lane;
                }
            }
        }
    }
    while (s->next_sub < 12) {
        unsigned j = s->next_sub;
        if (!s->subhits[j]) { ++s->next_sub; continue; }
        unsigned mark = (units*j + 11u)/12u;
        if (s->phase < mark) break;
        *hits |= s->subhits[j];
        *accents |= s->subaccents[j];
        ++s->next_sub;
    }
    unsigned boundary = s->next_sub < 12 ? (units*s->next_sub + 11u)/12u : units;
    unsigned remaining = boundary - s->phase;
    unsigned bpm = (unsigned)s->bpm;
    unsigned span = max_frames;
    /* Avoid a divide for ordinary callback spans that end before a boundary.
     * The bound on max_frames also makes the multiplication safe for UINT_MAX. */
    if (max_frames > (STEP_UNITS / 60u) * 2u || max_frames * bpm > remaining)
        span = (remaining + bpm - 1u) / bpm;
    s->phase += span * bpm;
    return span;
}
