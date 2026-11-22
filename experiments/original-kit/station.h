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
typedef struct {
    Kit kit;
    Sequencer clock;
    DrumBus bus;
    BusMix mix;
    KitPatch patch[KIT_PADS];
    float last_l, last_r, fade_l, fade_r;
    float comp_gr_db, limiter_gr_db; /* strongest reduction in the last render */
    unsigned fade_left, has_rendered;
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
void station_hit(Station *s, int pad, float velocity, const KitPatch *patch);
void station_render(Station *s, float *left, float *right, unsigned n);
#endif
