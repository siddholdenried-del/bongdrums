/* SPDX-License-Identifier: GPL-3.0-only */
/* The standalone Mac engine links the stock ROOM/DIGI
   returns. In firmware drum909.c already owns the shared curve tables. */
#ifndef FM1_EXTERNAL_DRUM_TABLES
#define X0X_DRUM_TABLES_DEFINE
#endif
#include "drum_bus.h"
#include "macro.h"
#include "kit.h"
#include <math.h>
#include <string.h>

void bus_set_macro(BusMix *mix, unsigned which, unsigned value)
{
    if (which >= V3_FX_COUNT) return;
    if (value > 127) value = 127;
    if (mix->macro[which] == value) return;
    mix->macro[which] = (unsigned char)value;
    v3_macro_patch(&mix->bus, mix->macro);
}

BusMix bus_default_mix(void)
{
    static const float reverb[BUS_PADS] = {.10f,.65f,.68f,.38f,.43f,.48f,.16f,.30f,.45f,.46f,.48f};
    static const float delay[BUS_PADS]  = {.06f,.27f,.34f,.22f,.30f,.38f,.12f,.23f,.30f,.56f,.61f};
    BusMix m = {0};
    m.bus.level = 1;
    m.bus.reverb_send = .34f;
    m.bus.delay_send = .22f;
    static const unsigned char defaults[V3_FX_COUNT] = V3_FX_DEFAULTS;
    memcpy(m.macro, defaults, sizeof defaults);
    v3_macro_patch(&m.bus, m.macro);
    for (unsigned i = 0; i < BUS_PADS; ++i)
        m.pad[i] = (BusPad){1,0,reverb[i],delay[i]};
    return m;
}

void drum_bus_init(DrumBus *b)
{
    memset(b, 0, sizeof *b);
    fxbus_init(&b->returns, b->delay_line, BUS_DELAY_SAMPLES);
    /* Send voicing, Hz. Kick and toms keep their low end out of the room;
       hats and cymbal lose fizz before the delay repeats it. */
    static const float hp_hz[BUS_PADS] = {350,200,300,120,160,200,700,500,400,250,250};
    static const float lp_hz[BUS_PADS] = {4000,9000,9000,6000,6500,7000,9000,10000,11000,9000,9000};
    for (unsigned p = 0; p < BUS_PADS; ++p) {
        b->send_hp_a[p] = expf(-6.2831853f * hp_hz[p] / (float)KIT_RATE);
        b->send_lp_b[p] = 1.0f - expf(-6.2831853f * lp_hz[p] / (float)KIT_RATE);
    }
    /* Identical isolation to the FM-1's fx_init: this stage owns only the
       returns. No distortion/compression/trim from the firmware master. */
    fxbus_set(&b->returns, FX_VOLUME, 127);
    fxbus_set(&b->returns, FX_DIST, 0);
    fxbus_set(&b->returns, FX_COMP, 0);
    fxbus_set(&b->returns, FX_DL_WIDTH, 0);
    fxbus_set(&b->returns, FX_DL_TIME, 5); /* eighth note */
    b->returns.dcur = b->returns.dl_time_ms * (.001f * KIT_RATE);
}

void drum_bus_tempo(DrumBus *b, float bpm)
{
    if (isfinite(bpm) && bpm >= 30 && bpm <= 300) {
        fxbus_set_bpm(&b->returns, bpm);
        /* No echo in flight on an idle line, so start the first echo right on time. */
        if (b->returns.dl_quiet >= b->returns.dlen)
            b->returns.dcur = b->returns.dl_time_ms * (.001f * KIT_RATE);
    }
}

static void balance(float pan, float level, float *l, float *r)
{
    if (!isfinite(pan)) pan = 0;
    if (pan < -1) pan = -1;
    if (pan > 1) pan = 1;
    int pot = (int)(64.f + pan * (pan < 0.f ? 64.f : 63.f) + .5f);
    x0x_pan_gains(pot, l, r);
    float gain = kit_unit(level);
    *l *= gain;
    *r *= gain;
}

static float setting(float x, float low, float high, float fallback)
{
    if (!isfinite(x)) return fallback;
    return x < low ? low : x > high ? high : x;
}

/* One-pole 1/e time constant. All ranges are at least 8.8 samples. */
static float slew(float ms)
{
    return 1.f / (1.f + ms * (KIT_RATE * .001f));
}

static float stereo_peak(float l, float r)
{
    float a = fabsf(l), b = fabsf(r);
    return a > b ? a : b;
}

/* Positive reduction, before make-up or the transient shaper. */
static float reduction_db(float gain)
{
    return gain < 1.f ? -6.02059991f * fm_log2f(gain) : 0.f;
}

/* A stereo-linked feed-forward peak detector and a hard knee. For steady
   inputs above threshold, output dB changes by input dB divided by ratio. */
static float compress(DrumBus *b, const BusPatch *p, float *l, float *r, unsigned n)
{
    float threshold = fm_db2lin(setting(p->threshold_db,-36,0,-17));
    float ratio = setting(p->ratio,1,12,2.5f);
    float slope = 1.f/ratio - 1.f;
    float attack = slew(setting(p->attack_ms,.2f,60,14));
    float release = slew(setting(p->release_ms,20,500,115));
    float makeup = fm_db2lin(setting(p->makeup_db,0,12,0));
    float inv_threshold = 1.f/threshold;
    float env = b->comp_env, lowest = 1.f;
    for (unsigned i=0; i<n; ++i) {
        float peak = stereo_peak(l[i],r[i]);
        env += (peak > env ? attack : release) * (peak-env);
        float gain = 1.f;
        if (env > threshold && ratio > 1.f) {
            gain = fm_exp2f(slope * fm_log2f(env*inv_threshold));
            if (gain < lowest) lowest = gain;
        }
        l[i] *= gain*makeup;
        r[i] *= gain*makeup;
    }
    b->comp_env = env > 1.e-14f ? env : 0.f;
    return lowest;
}

/* A fast envelope opens before a slower envelope on a strike. Their
   relative separation assigns gain to the attack. The remainder shapes
   the body and decay, independent of absolute hit level. */
static void transients(DrumBus *b, const BusPatch *p, float *l, float *r, unsigned n)
{
    float attack = setting(p->transient_attack,-1,1,0);
    float sustain = setting(p->transient_sustain,-1,1,0);
    float attack_gain = attack*(attack < 0.f ? .82f : 1.0f);
    float body_gain = sustain*(sustain < 0.f ? .82f : .85f);
    float fast = b->fast_env, slow = b->slow_env;
    for (unsigned i=0; i<n; ++i) {
        float peak = stereo_peak(l[i],r[i]);
        fast += (peak>fast ? .01244f : .00118f)*(peak-fast);  /* 1.8 / 19 ms */
        slow += (peak>slow ? .000985f : .000206f)*(peak-slow); /* 23 / 110 ms */
        float onset = fast > slow ? (fast-slow)/(fast+1.e-9f) : 0.f;
        float gain = 1.f + body_gain + onset*(attack_gain-body_gain);
        l[i] *= gain;
        r[i] *= gain;
    }
    b->fast_env = fast>1.e-14f ? fast : 0.f;
    b->slow_env = slow>1.e-14f ? slow : 0.f;
}

static int tails_live(const fxbus_t *f)
{
    return f->dl_quiet < f->dlen || f->room.quiet < FX_RM_QUIET ||
           f->room.rh_yl != 0 || f->room.rh_yr != 0;
}

static float render_block(DrumBus *b, const BusMix *m, float *lanes[BUS_PADS],
                         unsigned offset, float *l, float *r, unsigned n)
{
    memset(l, 0, n * sizeof *l);
    memset(r, 0, n * sizeof *r);
    float *rev = b->send[0], *dly = b->send[1];
    memset(rev, 0, n * sizeof *rev);
    memset(dly, 0, n * sizeof *dly);
    float master_rv = m->dry_only ? 0 : kit_unit(m->bus.reverb_send);
    float master_dl = m->dry_only ? 0 : kit_unit(m->bus.delay_send);
    int send_lane = 0;
    for (unsigned p = 0; p < BUS_PADS; ++p) {
        if (!lanes[p]) continue;
        const BusPad *v = &m->pad[p];
        float level = kit_unit(v->level);
        if (level == 0) continue;
        float lg, rg;
        balance(v->pan,level,&lg,&rg);
        const float *src = lanes[p] + offset;
#ifdef __wasm__
        if (b->meter_lanes) {
            float peak = 0.f;
            for (unsigned i = 0; i < n; ++i) {
                const float x = src[i], a = x < 0 ? -x : x;
                if (a > peak) peak = a;
            }
            peak *= lg > rg ? lg : rg;
            if (peak > b->lane_peaks[p]) b->lane_peaks[p] = peak;
        }
#endif
        float rv = level * master_rv * kit_unit(v->reverb);
        float dl = level * master_dl * kit_unit(v->delay);
        if (rv != 0 || dl != 0) {
            send_lane = 1;
            const float ha = b->send_hp_a[p], lb = b->send_lp_b[p];
            float x1 = b->send_x[p], hp = b->send_hp[p], lp = b->send_lp[p];
            for (unsigned i = 0; i < n; ++i) {
                const float x = src[i];
                l[i] += lg*x; r[i] += rg*x;
                hp = ha * (hp + x - x1); x1 = x;
                lp += lb * (hp - lp);
                rev[i] += rv*lp; dly[i] += dl*lp;
            }
            b->send_x[p] = x1; b->send_hp[p] = hp; b->send_lp[p] = lp;
        } else {
            b->send_x[p] = b->send_hp[p] = b->send_lp[p] = 0;
            for (unsigned i = 0; i < n; ++i) {
                l[i] += lg*src[i]; r[i] += rg*src[i];
            }
        }
    }
    int incoming = 0;
    if (!m->dry_only && send_lane &&
        (!b->returns_live || b->returns.room.quiet >= FX_RM_QUIET)) {
        int rv_in = 0, dl_in = 0;
        for (unsigned i = 0; i < n; ++i) {
            rv_in |= rev[i] != 0.f;
            dl_in |= dly[i] != 0.f;
        }
        incoming = rv_in || dl_in;
        /* ROOM commits its quiet counter once per 16 half-rate samples.
           A note in a shorter event split can be in its staging buffer
           while the old counter still reads "idle". Wake it on input. */
        if (rv_in && b->returns.room.quiet >= FX_RM_QUIET)
            b->returns.room.quiet = 0;
    }
    if (b->returns_live || incoming) {
        if (m->dry_only) {
            /* Keep the old delay and room on the same clock while dry is
               auditioned. The independent zero input also keeps the output
               from aliasing either send inside the stock renderer. */
            static const float silence[BUS_FRAMES] = {0};
            fxbus_process_st(&b->returns,silence,silence,silence,silence,rev,dly,(int)n);
        } else {
            fxbus_process_st(&b->returns,l,r,rev,dly,l,r,(int)n);
        }
        b->returns_live = tails_live(&b->returns);
    }
    float lg, rg;
    balance(m->bus.pan,m->bus.level,&lg,&rg);
    for (unsigned i = 0; i < n; ++i) {
        l[i] *= .75f*lg;
        r[i] *= .75f*rg;
    }
    if (!m->dry_only && m->macro[V3_SAT])
        v3_saturate(l, r, n, m->macro[V3_SAT]);
    float lowest = 1.f;
    if (!m->dry_only && m->bus.comp_on) lowest = compress(b,&m->bus,l,r,n);
    else b->comp_env = 0;
    if (!m->dry_only && m->bus.transient_on) transients(b,&m->bus,l,r,n);
    else b->fast_env = b->slow_env = 0;
    return lowest;
}

void drum_bus_render(DrumBus *b, const BusMix *mix, float *lanes[BUS_PADS],
                     float *left, float *right, unsigned n)
{
    float lowest = 1.f;
    for (unsigned at = 0; at < n;) {
        unsigned part = n-at > BUS_FRAMES ? BUS_FRAMES : n-at;
        float g = render_block(b,mix,lanes,at,left+at,right+at,part);
        if (g < lowest) lowest = g;
        at += part;
    }
    b->comp_gr_db = reduction_db(lowest);
}

void drum_bus_limit_final(DrumBus *b, const BusMix *m, float *l, float *r, unsigned n)
{
    if (m->dry_only || !m->bus.limiter_on) {
        b->limiter_reduction = 0.f;
        b->limiter_gr_db = 0.f;
        return;
    }
    float ceiling = fm_db2lin(setting(m->bus.ceiling_db,-18,0,-5));
    float release = slew(setting(m->bus.limiter_release_ms,10,400,90));
    /* Store the distance from unity, which decays accurately even at a
       400 ms release. Adding tiny steps to a near-unity gain stalls. */
    float reduction = b->limiter_reduction, lowest = 1.f;
    for (unsigned i=0; i<n; ++i) {
        float peak = stereo_peak(l[i],r[i]);
        reduction *= 1.f-release;
        if (reduction < 1.e-8f) reduction = 0;
        float gain = 1.f-reduction;
        if (peak*gain > ceiling) {
            gain = ceiling/peak;
            reduction = 1.f-gain;
        }
        if (gain < lowest) lowest = gain;
        /* The linked gain enforces the ceiling. Clamp the last rounding
           bit so no digital sample exceeds the configured magnitude. */
        l[i] = fm_clampf(l[i]*gain,-ceiling,ceiling);
        r[i] = fm_clampf(r[i]*gain,-ceiling,ceiling);
    }
    b->limiter_reduction = reduction;
    b->limiter_gr_db = reduction_db(lowest);
}
