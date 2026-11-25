#ifndef FM1_STATION_H
#define FM1_STATION_H
#include "kit.h"
#include "sequence.h"
#include "drum_bus.h"

#define STATION_VELOCITY 0.66f
#define STATION_ACCENT 0.94f

typedef struct {
    uint16_t hits[11], accents[11];
    int bpm;
} KitPattern;
enum { STATION_LFOS = 2 };
typedef struct {
    uint32_t phase, remainder;
    unsigned lane, wave, sync, rate, depth;
    unsigned param; /* 0 = pad level; k+1 = numeric parameter k, applied per hit */
    float offset[KIT_PADS];
} StationLFO;
typedef struct {
    Kit kit;
    Sequencer clock;
    DrumBus bus;
    BusMix mix;
    KitPatch patch[KIT_PADS];
    float last_l, last_r, fade_l, fade_r;
    float comp_gr_db, limiter_gr_db; /* strongest reduction in the last render */
    unsigned fade_left, has_rendered;
    StationLFO lfo[STATION_LFOS];
    unsigned mute_mask;
    unsigned lane_level[KIT_PADS];
    float recipe_gain[KIT_PADS], strike_gain[KIT_PADS];
    /* Tone/Drive captured at each strike, with one-pole filter state per lane. */
    float shape_a[KIT_PADS], shape_gain[KIT_PADS], shape_out[KIT_PADS];
    float shape_z[KIT_PADS], shape_x1[KIT_PADS];
    signed char shape_mode[KIT_PADS]; /* -1 low-pass, 0 none, +1 high-pass */
    unsigned char shape_drive[KIT_PADS];
    float samples[KIT_PADS][KIT_BLOCK];
} Station;

KitPattern station_preset(void);
void station_init(Station *s);
void station_set_patches(Station *s, const KitPatch patches[11]);
void station_set_pattern(Station *s, const KitPattern *pattern);
void station_set_bypass(Station *s, int bypass);
void station_set_mix(Station *s, const BusMix *mix);
void station_start(Station *s);
void station_stop(Station *s);
void station_lfo(Station *s, int slot, int lane, int wave, int sync, int rate, int depth);
void station_lfo_param(Station *s, int slot, int param);
void station_level(Station *s, int pad, float level);
/* which: 0 = ROOM reverb send, 1 = DIGI delay send; amount 0..1. */
void station_send(Station *s, int pad, int which, float amount);
/* Pan -1 (left) .. +1 (right) through the stock x0x pan law; 0 is centre. */
void station_pan(Station *s, int pad, float pan);
void station_mute(Station *s, int pad, int muted);
/* Hit with the pad's stored patch plus any per-hit LFO parameter offsets. */
void station_trigger(Station *s, int pad, float velocity);
void station_hit(Station *s, int pad, float velocity, const KitPatch *patch);
void station_render(Station *s, float *left, float *right, unsigned n);
#endif
