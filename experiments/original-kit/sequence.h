/* SPDX-License-Identifier: GPL-3.0-only */
#ifndef ORIGINAL_KIT_SEQUENCE_H
#define ORIGINAL_KIT_SEQUENCE_H
#include <stdint.h>

enum { SEQ_PADS = 11, SEQ_STEPS = 16 };

typedef struct {
    uint16_t hits[SEQ_PADS], accents[SEQ_PADS]; /* bit 0 is the first step */
    int bpm, running, current_step;              /* -1 when stopped */
    uint32_t phase;
    int downbeat_pending;
    uint16_t hits_b[SEQ_PADS], accents_b[SEQ_PADS];
    int bank, queued, swing, pair_swing;
} Sequencer;

/* The caller owns transport and pattern state on the rendering thread.
 * Preset and Clear edit the pattern without changing clock position or tempo. */
void seq_init(Sequencer *seq);
void seq_preset(Sequencer *seq);
void seq_clear(Sequencer *seq);
void seq_start(Sequencer *seq);
void seq_stop(Sequencer *seq);
void seq_set_tempo(Sequencer *seq, int bpm);
void seq_select(Sequencer *seq, int bank);
void seq_swing(Sequencer *seq, int percent);
void seq_bank_cell(Sequencer *seq, int bank, int pad1, int step0, int state);
void seq_cell(Sequencer *seq, int pad1, int step0, int state);

/* One run of samples from the present time up to the next event or buffer end.
 * Apply output masks (bit 0 = pad 1) before rendering the returned frame count.
 * A zero-length request consumes no event. Call again for any remaining frames. */
unsigned seq_span(Sequencer *seq, unsigned max_frames, uint16_t *hits, uint16_t *accents);
#endif
