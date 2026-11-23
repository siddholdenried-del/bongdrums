/* SPDX-License-Identifier: GPL-3.0-only */
#ifndef FM1_ORIGINAL_DRUM_BUS_H
#define FM1_ORIGINAL_DRUM_BUS_H
#include "fxbus.h"

enum { BUS_FRAMES = 256, BUS_PADS = 11, BUS_DELAY_SAMPLES = 32768 };
typedef struct {
    float level, pan, reverb_send, delay_send;
    int comp_on, transient_on, limiter_on;
    float threshold_db, ratio, attack_ms, release_ms, makeup_db;
    float transient_attack, transient_sustain; /* -1..1 */
    float ceiling_db, limiter_release_ms;
} BusPatch;
typedef struct { float level, pan, reverb, delay; } BusPad;
typedef struct {
    BusPatch bus;
    BusPad pad[BUS_PADS];
    int dry_only;
    unsigned char macro[4]; /* SAT, COMP, TRANS, LIMIT, 0..127 */
} BusMix;

/* Keep at a stable address: the stock delay holds a pointer to delay_line. */
typedef struct {
    fxbus_t returns;
    int16_t delay_line[BUS_DELAY_SAMPLES];
    float send[2][BUS_FRAMES];
    /* One shared ROOM and DIGI. Each pad's send is voiced for its drum before
       it joins them: one-pole high-pass then low-pass, coefficients per pad. */
    float send_hp_a[BUS_PADS], send_lp_b[BUS_PADS];
    float send_x[BUS_PADS], send_hp[BUS_PADS], send_lp[BUS_PADS];
    int returns_live;
    float comp_env, fast_env, slow_env, limiter_reduction;
    /* Positive maximum reduction in the most recently processed span, dB.
       Read on the render thread or publish a synchronized UI copy. */
    float comp_gr_db, limiter_gr_db;
#ifdef __wasm__
    /* Browser telemetry only: pre-bus stereo lane peak, accumulated until read. */
    unsigned meter_lanes;
    float lane_peaks[BUS_PADS];
#endif
} DrumBus;

BusMix bus_default_mix(void);
void bus_set_macro(BusMix *mix, unsigned which, unsigned value);
void drum_bus_init(DrumBus *b);
void drum_bus_tempo(DrumBus *b, float bpm);
/* Ordered mono lanes -> stereo dry + returns -> bus level/pan -> saturation -> compressor
   -> transient. Null lanes are silent. Caller supplies distinct L and R. */
void drum_bus_render(DrumBus *b, const BusMix *mix, float *lanes[BUS_PADS],
                     float *left, float *right, unsigned n);
/* Call AFTER the common audition trim and live de-click, immediately before
   handing samples to the sink. Stereo-linked, zero lookahead, sample peak. */
void drum_bus_limit_final(DrumBus *b, const BusMix *mix, float *left, float *right, unsigned n);
#endif
