# BongSoft instrument style guide

How the BongDrums browser instrument is designed, written so that other BongSoft instruments (BongSynth first) can follow the same system. It covers structure, type, controls, screens and the VHS treatment. It deliberately does not specify colours: each instrument keeps its own palette and maps it onto the colour roles below.

The reference implementation is this repository's `web/` folder: `desk.css` for the system, `app.js` for the components named in each section.

---

## 1. Principles

1. **One screen, no scrolling.** The whole instrument fits the window at every supported size. Nothing scrolls and nothing is clipped. When space runs out, remove things (duplicate labels, nested borders, padding) before shrinking anything. Never scale the whole interface down to get rid of a scrollbar.
2. **One editor at a time.** Only the transport, tempo and mode tabs stay on screen. Each tab shows one editor and nothing else. No sidebars, and no hidden editors squeezed into a footer.
3. **The visual leads, the controls follow.** In an editor the display (plot or scope) is the main panel. Controls are a compact strip beneath it.
4. **Hardware, not a web form.** Four knobs at a time, pages you step through, a screen that answers what you touch. The model is a small hardware synth or drum machine (the M-Vave FM-1 is the reference), not a settings page.
5. **Crisp interfaces, pixel scopes.** Use the block grid (section 2) for proportions, but never rasterize the whole instrument. Text and controls stay sharp with or without VHS.
6. **Switching views never touches audio.** Changing tabs never stops playback, changes the playing pattern or cuts tails.

## 2. The pixel unit

Everything is measured in `--u`, the scope’s logical pixel size:

| | `--u` |
|---|---|
| Desktop | 3 px |
| Phones (≤ 640 px wide) | 2 px |

- **Borders and strokes:** exactly 1u. Draw frames with `box-shadow: inset 0 0 0 var(--u) …` so they don't change layout.
- **Button lower edge:** 2u, a solid offset shadow (`0 calc(var(--u)*2) 0 …`). Pressing moves the button down 1u and shortens the edge to 1u.
- **Gaps and padding:** whole multiples of `--u` (2u, 3u, 4u, 6u …).
- **Corners:** square (radius 0). Knobs are the only round shapes.
- **Shadows:** solid offset blocks only. No blur, no glow.
- **Never:** hairlines thinner than 1u, dashed or dotted lines, gradients across controls, soft shadows.
- **SVG strokes:** `vector-effect: non-scaling-stroke` with `stroke-width: var(--u)` (2u for knob pointers), so strokes stay whole blocks at any knob size.

## 3. Type

- **One face:** a monospace stack (`"Courier New", Courier, monospace`). No second typeface, no pixel font. Hierarchy comes from size and weight only.
- **All caps, bold 700,** letter-spacing about `.08em` (tags `.12em`).
- **Size tokens:**

| Token | Desktop | Phone | Used for |
|---|---|---|---|
| `--t-s` | 22 px | 18 px | tags, readout labels, secondary text |
| `--t-m` | 25 px | 20 px | buttons, values, tabs |
| `--t-l` | 34 px | 25 px | big readout values, page names, arrows |
| `--t-xl` | 46–64 px | 34 px | rare display text |

  Inside dense strips (knob labels and values) text may drop to 17–18 px on desktop and 14–15 px on phones, and should scale up with the knob on large windows (`clamp(17px, dial × .13, 24px)`).
- **Minimums:** nothing below these strip sizes. If text doesn't fit, wrap it or shorten the wording; don't shrink it.
- **Short names in menus:** two-letter voice codes (BD, SD, CP …) in grids, mixers and pickers; full names in headings and tooltips. Tabs use short words (SEQ, not SEQUENCE).
- **No fake technical labels, no counts** ("BODY", not "PAGE 1/2").

## 4. Colour roles (bring your own palette)

Map your palette onto these roles; the rules apply whatever the colours are.

| Role | Used for |
|---|---|
| background | the deck behind everything |
| raised / cell | buttons, empty steps, knob faces |
| ink | primary text, frames, knob pointers |
| dim ink | tags, inactive labels |
| trace | normal hits, live signal, value bars |
| accent | the touched or selected thing, accents, the playhead step, values in strips |
| alert | active tab, record, mute engaged |
| frame | secondary frames (segment groups, knob rings) |
| screen | display panels (plot, scope, readouts), with a matching screen-ink |

Rules:
- Never rely on colour alone. Accented steps also carry a dot, the playhead also has its own marker, and the active tab is also raised.
- The touched control is always marked the same way everywhere: accent on its label, value and ring.
- Display panels are the only place the screen colour is used.

## 5. Layout

### Frame
- **Header row (always visible):** wordmark · ▶ PLAY · ● REC · tempo · tabs · ☰ menu. The tabs move to their own row below the transport when the window is narrower than about 1366 px. On the smallest phones (≤ 360 px) the wordmark goes, so the menu stays on the transport row.
- **☰ menu:** FX OFF, file sharing, the key map and links. Nothing essential lives only here.
- **BongSoft mark:** on tall desktop windows (≥ 900 px high) the official BongSoft sticker artwork sits centred along the bottom, used as-is with a 2u solid offset drop. It is hidden on phones and short windows.

### Reference sizes

| Size | Must hold |
|---|---|
| 1280 × 1280 | the main desktop target: larger knobs (strip ≈ 300 px), scope with roughly twice the 720 room, BongSoft mark at the bottom |
| 1280 × 720 | plot trace 260–320 px, knob row 110–140 px |
| 375 × 812 | everything visible, labels legible, plot tall enough to read its shape |

Also test 320 × 568, 390 × 844 and 1440 × 900.

### Breakpoints
- `≤ 640 px`: phone. `--u` becomes 2 px and the type tokens step down.
- `≤ 1366 px`: tabs wrap under the transport.
- `≥ 900 px tall` (desktop): show the BongSoft mark.
- `≤ 360 px`: drop the wordmark.

Grids must not be widened by their content: use `minmax(0, 1fr)` columns and give the page column `minmax(0, 1fr)`.

## 6. The editor desk (one voice, four knobs)

The pattern for any per-voice or per-part editor, top to bottom:

1. **Header (one compact row):** voice picker (`01 KICK ▾`, opens a tile sheet), **P** (presets, opens a tile sheet), **▶ AUDITION**. No big arrow pair here.
2. **Plot (the main panel):** one framed screen.
   - A **thin readout bar** above the trace shows the touched setting and its value, the preset name, and a hit light. It never overlaps the trace.
   - The **trace** fills the rest. It shows the live output faintly, and a **contextual graph** of the touched setting in accent. The graph changes as you turn:

     | Setting kind | Graph |
     |---|---|
     | decay, tail, time | envelope |
     | tune, pitch, sweep, speed | decaying pitch wave |
     | drive | saturation curve |
     | tone / filter | filter slope |
     | brightness, colour, click | spectral tilt |
     | option (model, mode) | its steps, the chosen one lit |
     | anything else | level bar |

   - The plot grows with the window; the knob strip does not compete with it.
3. **Page arrows beside the knobs:** a tall framed ◀ at the left end of the knob row and ▶ at the right end, so paging costs no vertical space. The page name (BODY, TRANSIENT …, never a count) sits as a framed tag at the start of the readout bar. Group settings into named pages of up to four, split where the sound splits (for drums: BODY, TRANSIENT, WIRES, METAL, OSC, SWEEP, and FILTER for tone and drive on every voice).
4. **Knob strip:** at most four knobs, spread evenly across the full width between the arrows, without frames or cards. Titles and values are large (desktop at least 22 px titles and 26 px values, growing with the dial; on phones values may wrap onto two lines, with every value given two lines of room so dials stay level). Each knob has its label above, dial, then value. **Bottom-aligned,** so a two-line label grows upward and never pushes its dial down; all dials share one baseline. The touched knob is marked with accent. Option settings (model, profile, mode) are knobs too, stepping through named options.

Other editors keep the same spirit: the scope or waveform as the main panel, a pop-up LCD readout of whatever you touch (fades after about 1.3 s, sits at the top of the view), and controls under the display.

## 7. Controls

All of these are in `app.js`.

| Component | Rule | Code |
|---|---|---|
| Chunky button | square, 2u lower edge, 1u press; filled when on | `.chunk` |
| Framed step bar | one frame around `‹ \| selection \| ›`, 1u dividers beside each arrow, arrows in accent. Every arrow control uses it. | `stepBar()` |
| More than 3 options | one step bar with a fixed-width value (the longest option), so the arrows never move | `stepper()` |
| Exactly 3 options | a three-notch slider: a track, three notches, labels underneath, the thumb on the chosen notch | `slide3()` |
| 2 options | a switch (two segments in one frame) | `segment()` |
| Picker | a button showing the current choice and ▾; opens a tile sheet | `pickerFor()`, `openSheet()` |
| Tile sheet | large tiles (name plus a small sub-line) in a grid; the current tile is filled; Esc or ✕ closes; arrow keys move; slides up from the bottom on phones | `openSheet()` |
| P button | a single framed "P" that opens presets (or kits on the sequencer); its tooltip names the current choice; it shows a changed state when edited away from a factory preset | `#preset-p`, `#kit-p` |
| Knob | a real `<input type=range>` drives a drawn dial (so keyboard and screen readers work); drag up/down (Shift for fine), mouse wheel, arrow keys and Page Up/Down; double-click resets; 11-tick ring; locked knobs dim | `knob()` |
| Fader | vertical on desktop; on phones the mixer turns into one row per channel with a horizontal fader | `.fader` |

Hard rules:
- Never use a native `<select>` as the visible control. Keep it hidden as the source of truth and drive it from a picker, stepper or slider.
- Arrow positions never move when the selection changes: give the selection a fixed width.
- The sequencer grid keeps groups of four; on portrait phones it turns, with voices across the top and steps 1–16 down, so all 16 steps fit on one screen. No paging.

## 8. Screens and displays

- **Pixel art, not anti-aliased lines.** Plots and scopes are canvases with one canvas pixel per block (`width = clientWidth / --u`), scaled up with `image-rendering: pixelated`. Lines are drawn column by column as connected pixel runs. See `pixelCanvas()` and `plot()`.
- **Live trace:** faint, behind any graph, trigger-locked on a rising zero crossing so it holds still.
- **Phosphor:** fade the previous frame slightly instead of clearing it; clear outright when FX is off.
- **Hit light:** a small square in the readout that flashes on every hit of the shown voice, brighter for accents, using a `steps()` animation.
- **LFO view:** the read point stays fixed in the centre and the waveform scrolls through it. Project the phase from the rate between audio-thread updates for smooth motion.
- Never draw text into the low-resolution canvas. Readouts are HTML over or above it.

## 9. The VHS treatment

- **Overlay only:** a fixed, click-through CSS overlay provides subtle scanlines and a little bleed at the left and right edges. No SVG/post-processing filter on the app; do not animate, scale, or blur its controls.
- **Scopes:** still render their own low-resolution pixel canvas. Scope-only scanlines and phosphor trails stay local to the screen.
- **FX OFF** (☰ menu) removes the overlay, scope scanlines, and trails without changing the audio or native canvas resolution. The overlay is static at all times, including reduced motion.
- **No** full-screen animation, jitter, blur, or flicker.

## 10. Motion

- Short and stepped (`steps()`), 0.15–0.3 s: hit flashes and press states.
- Nothing moves on its own except the displays (trace, LFO, meters).

## 11. Accessibility

- Every control is a real button or input with a name. Knobs expose `aria-valuetext` with the displayed value.
- Keyboard: tabs, pickers, steppers and sliders all work with arrow keys; Escape closes sheets and menus. The focus outline is 1u in accent.
- Text never drops below the minimums in section 3, and colour is never the only signal (section 4).

## 12. Hosting constraints

The instruments are served under a strict Content Security Policy (`script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self'; font-src 'self'`). So:
- no inline `<script>` or `style=""` attributes, and no `setAttribute("style", …)`;
- dynamic styling goes through the CSSOM (`el.style.setProperty(...)`), which the policy allows;
- all fonts, images and engines are self-hosted; no CDNs.

## 13. Verification checklist

Before calling a layout done:

1. **No page scroll and no clipped content in any view** at 320×568, 375×812, 390×844, 1280×720, 1440×900 and 1280×1280. Hidden overflow hides clipping, so assert that no visible element's right edge passes the viewport, not just that nothing scrolls. `verify-browser.mjs` does both.
2. **Sizes at 1280×720:** trace 260–320 px, knob strip 110–140 px, all dials on one baseline.
3. **At 1280×1280:** a larger knob strip and plot, with the BongSoft mark fully on screen.
4. **Readable text:** check true-resolution (100% zoom, 1:1 pixel) screenshots of every view at desktop and phone size. Downscaled previews aren’t suitable for judging text legibility.
5. **Views:** switch through every tab while playing and confirm audio keeps sounding.
6. **Security policy:** load the real hosted wrapper page and confirm zero CSP violations and zero console errors.
