#include "station.h"
#include "kit_math.h"
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

enum { LANE_RAMP = 64 };

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
    memset(s->lfo, 0, sizeof(s->lfo));
    s->mute_mask = 0;
    for (unsigned i = 0; i < KIT_PADS; ++i) s->lane_level[i] = LANE_RAMP;
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
void station_start(Station *s)
{
    seq_start(&s->clock);
    for (unsigned i = 0; i < STATION_LFOS; ++i) if (s->lfo[i].sync)
        s->lfo[i].phase = s->lfo[i].remainder = 0;
}
void station_stop(Station *s) { seq_stop(&s->clock); }
void station_lfo(Station *s, int slot, int lane, int wave, int sync, int rate, int depth)
{
    if ((unsigned)slot >= STATION_LFOS || (unsigned)lane > KIT_PADS ||
        (unsigned)wave > 2 || (unsigned)depth > 100 ||
        (sync ? (unsigned)rate >= 7 : (rate < 5 || rate > 1200))) return;
    StationLFO *l = &s->lfo[slot];
    if (l->sync != (unsigned)!!sync) l->remainder = 0;
    l->lane = lane; l->wave = wave; l->sync = !!sync; l->rate = rate; l->depth = depth;
}

/* Common denominator in each clock mode. A sample-rate phase increment and a
 * retained fractional remainder avoid drift even at awkward BPMs. */
static void render_lfo(StationLFO *l, int bpm, float *lanes[KIT_PADS], unsigned span)
{
    static const unsigned cycles_per_8_beats[7] = {1,2,4,8,16,32,64};
    const unsigned den = KIT_RATE * (l->sync ? 480u : 100u);
    const uint64_t num = (uint64_t)(l->sync ? bpm * cycles_per_8_beats[l->rate] : l->rate) << 32;
    const uint32_t inc = (uint32_t)(num / den), rem = (uint32_t)(num % den);
    unsigned active = l->depth && l->lane;
    if (!active) for (unsigned p=0; p<KIT_PADS; ++p) active |= l->offset[p] != 0;
    if (!active) {
        uint64_t advance = l->remainder + (uint64_t)rem * span;
        l->phase += inc*span + (uint32_t)(advance / den);
        l->remainder = advance % den;
        return;
    }
    const float depth = l->depth * .01f;
    for (unsigned i=0; i<span; ++i) {
        float wave;
        if (l->wave == 1) {
            const float t = (float)(l->phase >> 8) * (1.0f/16777216.0f);
            wave = 1.0f - 4.0f * (t < .5f ? .5f-t : t-.5f);
        } else {
            wave = kit_sine(l->phase);
            if (l->wave == 2) wave = 2.0f*kit_unit(.5f+2.0f*wave)-1.0f;
        }
        const float value = depth * (.5f + .5f * wave);
        for (unsigned p=0; p<KIT_PADS; ++p) {
            const float target = p+1 == l->lane ? value : 0;
            float level = l->offset[p];
            if (level < target) level = target-level < .015625f ? target : level+.015625f;
            else if (level > target) level = level-target < .015625f ? target : level-.015625f;
            l->offset[p]=level;
            if (level && lanes[p]) lanes[p][i] *= 1.0f-level;
        }
        l->phase += inc;
        l->remainder += rem;
        if (l->remainder >= den) { l->remainder -= den; ++l->phase; }
    }
}
void station_mute(Station *s, int pad, int muted)
{
    if (pad < 1 || pad > KIT_PADS) return;
    unsigned bit = 1u << (pad - 1);
    if (muted) s->mute_mask |= bit;
    else s->mute_mask &= ~bit;
}
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
        /* Render triggers and envelopes even while muted. Gate the lane going
           into both dry and sends; existing shared returns ring naturally. */
        for (unsigned pad = 0; pad < KIT_PADS; ++pad) {
            unsigned level = s->lane_level[pad];
            unsigned goal = (s->mute_mask & (1u << pad)) ? 0 : LANE_RAMP;
            if (level == goal) {
                if (!level) lanes[pad] = NULL;
                continue;
            }
            for (unsigned i = 0; i < span; ++i) {
                if (level < goal) ++level;
                else if (level > goal) --level;
                if (lanes[pad]) lanes[pad][i] *= (float)level / (float)LANE_RAMP;
            }
            s->lane_level[pad] = level;
        }
        for (unsigned j = 0; j < STATION_LFOS; ++j) render_lfo(&s->lfo[j], s->clock.bpm, lanes, span);
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
