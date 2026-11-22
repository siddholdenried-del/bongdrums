#include "station.h"
#include <string.h>

KitPattern station_preset(void)
{
    Sequencer seq;
    seq_init(&seq);
    KitPattern pattern;
    memcpy(pattern.hits, seq.hits, sizeof(pattern.hits));
    memcpy(pattern.accents, seq.accents, sizeof(pattern.accents));
    pattern.bpm = seq.bpm;
    return pattern;
}

void station_init(Station *s)
{
    kit_init(&s->kit);
    seq_init(&s->clock);
    drum_bus_init(&s->bus);
    drum_bus_tempo(&s->bus, (float)s->clock.bpm);
    s->last_l = s->last_r = s->fade_l = s->fade_r = 0;
    s->fade_left = s->has_rendered = 0;
    s->comp_gr_db = s->limiter_gr_db = 0;
    s->mix = bus_default_mix();
    s->mix.dry_only = 1;
    const KitPatch patch = kit_default_patch();
    for (unsigned i = 0; i < KIT_PADS; ++i) s->patch[i] = patch;
}

void station_set_patches(Station *s, const KitPatch patches[11])
{
    memcpy(s->patch, patches, sizeof(s->patch));
}

void station_set_pattern(Station *s, const KitPattern *pattern)
{
    memcpy(s->clock.hits, pattern->hits, sizeof(pattern->hits));
    for (unsigned i = 0; i < KIT_PADS; ++i)
        s->clock.accents[i] = pattern->hits[i] & pattern->accents[i];
    if (pattern->bpm != s->clock.bpm) {
        seq_set_tempo(&s->clock, pattern->bpm);
        drum_bus_tempo(&s->bus, (float)s->clock.bpm);
    }
}

enum { MIX_CHANGE_FRAMES = 64 };

void station_set_mix(Station *s, const BusMix *mix)
{
    if (memcmp(&s->mix, mix, sizeof(*mix)) == 0) return;
    /* Hardware edits to the inactive chain leave the dry PCM continuous. */
    int bypassed_controls = s->mix.dry_only && mix->dry_only &&
        s->mix.bus.level == mix->bus.level && s->mix.bus.pan == mix->bus.pan &&
        s->mix.bus.reverb_send == mix->bus.reverb_send && s->mix.bus.delay_send == mix->bus.delay_send &&
        memcmp(s->mix.pad, mix->pad, sizeof mix->pad) == 0;
    if (s->has_rendered && !bypassed_controls) {
        s->fade_l = s->last_l;
        s->fade_r = s->last_r;
        s->fade_left = MIX_CHANGE_FRAMES;
    }
    s->mix = *mix;
}

void station_set_bypass(Station *s, int bypass)
{
    BusMix mix = s->mix;
    mix.dry_only = !!bypass;
    station_set_mix(s, &mix);
}
void station_start(Station *s) { seq_start(&s->clock); }
void station_stop(Station *s) { seq_stop(&s->clock); }
void station_hit(Station *s, int pad, float velocity, const KitPatch *patch)
{
    kit_hit(&s->kit, pad, velocity, patch);
}

void station_render(Station *s, float *left, float *right, unsigned n)
{
    float *lanes[KIT_PADS];
    const float gain = 0.63095734f; /* same -4 dB audition trim on both paths */
    s->comp_gr_db = s->limiter_gr_db = 0;
    while (n) {
        uint16_t hits, accents;
        const unsigned span = seq_span(&s->clock, n < KIT_BLOCK ? n : KIT_BLOCK,
                                       &hits, &accents);
        for (unsigned pad = 0; hits; ++pad, hits >>= 1, accents >>= 1)
            if (hits & 1) kit_hit(&s->kit, (int)pad+1,
                                  (accents & 1) ? STATION_ACCENT : STATION_VELOCITY, &s->patch[pad]);
        kit_render_active_lanes(&s->kit, s->samples, lanes, span);
        drum_bus_render(&s->bus, &s->mix, lanes, left, right, span);
        for (unsigned i = 0; i < span; ++i) {
            left[i] *= gain;
            right[i] *= gain;
        }
        const unsigned transition = s->fade_left < span ? s->fade_left : span;
        for (unsigned i = 0; i < transition; ++i) {
            float t = (float)(MIX_CHANGE_FRAMES - s->fade_left) / (float)MIX_CHANGE_FRAMES;
            left[i] = s->fade_l + t * (left[i] - s->fade_l);
            right[i] = s->fade_r + t * (right[i] - s->fade_r);
            --s->fade_left;
        }
        /* Returns, makeup, output trim and live control transitions must all
           pass this final sample-peak check. The master chain is separate. */
        drum_bus_limit_final(&s->bus, &s->mix, left, right, span);
        if (s->bus.comp_gr_db > s->comp_gr_db) s->comp_gr_db = s->bus.comp_gr_db;
        if (s->bus.limiter_gr_db > s->limiter_gr_db) s->limiter_gr_db = s->bus.limiter_gr_db;
        s->last_l = left[span-1];
        s->last_r = right[span-1];
        s->has_rendered = 1;
        left += span;
        right += span;
        n -= span;
    }
}
