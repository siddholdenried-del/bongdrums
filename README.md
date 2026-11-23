# BongDrums

BongDrums is an 11-voice, 16-step drum instrument by BongSoft, provided by BongTech, part of BongCult. It contains the portable C engine and a browser workbench. The same C compiles natively for tests and to WebAssembly for the browser. There are no drum samples, firmware images, Mac application binaries, project files, or third-party runtime services in this distribution.

## Play

Run `python3 -m http.server 48569 --bind 127.0.0.1 --directory web` from this folder and open http://127.0.0.1:48569 in a browser. On macOS, **Open BongDrums.command** does both.

The instrument fits one window with no page scrolling and shows one editor at a time. Only the transport (Play, Rec), tempo and five mode tabs stay on screen. Switching tabs never stops playback, changes the playing pattern or cuts tails.

- **SEQUENCE:** the full 11-lane, 16-step grid in groups of four, filling the view, with A/B and swing. Each lane starts with an audition button and ends with a mute button the same size. Accents carry a dot and the playhead has its own marker. On portrait phones the grid turns so all 16 steps fit on one screen: audition buttons run across the top, steps run down and mutes sit at the bottom.
- **DRUM:** the plot is the main panel. A thin readout above the trace shows the touched setting and its value, the preset and a hit light. The trace shows the live output, plus a graph of the touched setting (envelope, pitch, saturation, filter or option steps). Below it, one large ◀ PAGE ▶ pair steps through named pages: FILTER (Tone, Drive) on every drum, plus BODY, TRANSIENT, WIRES, METAL, OSC or SWEEP as fits the voice. The knobs are a compact strip under the plot, bottom-aligned so labels don't move the dials. The header holds a compact voice picker, **P** (presets) and AUDITION.
- **P** on SEQUENCE opens the factory kits. Pattern and the LFO drum use the same picker: a button that opens a sheet of large tiles (Escape or ✕ closes it). The LFO target is a row of buttons: LEVEL plus that drum's sliders.
- **LFO:** LFO 1 or LFO 2, with the live waveform, rate and depth in the centre. The read point stays fixed in the middle and the waveform scrolls through it, so the dot shows the value the LFO is applying right now. Drum, target, shape and sync/free sit around them.
- **MIXER:** per-drum fader, pan, mute, and signal peak. The mixer feeds the drum bus directly, with no spatial effects.
- **BUS:** a live output oscilloscope above Saturator, Compressor, Transient and Limiter, with gain-reduction meters under Compressor and Limiter.
- Editor knobs are sized from the space each view actually has, choosing the row layout that gives the largest knobs.
- **VHS:** a static screen overlay adds faint scanlines and subtle colour bleed at the edges without blurring or moving the controls. Plots retain their native pixel-art canvas. FX OFF removes the overlay, plot scanlines and phosphor trails.
- The ☰ menu holds FX OFF, file sharing, the key map and links.
- **Kits:** 11 factory kits (`web/library.js`), each a choice of factory recipes plus a few slider edits, levels, pans, sends, return levels, the four bus macros and Dry/Bus. Any edit turns the kit into *Custom kit*.
- **Patterns:** 16 factory patterns with their own tempo and swing. Loading writes into the bank you are editing (A or B).
- **Play it:** keys sound on press, and **Shift** plays an accent. Click a lane name to audition it. Lanes light when the sequencer hits them. **Rec** writes what you play into the playing bank, rounded to the nearest step. Drag across steps to paint them.
- **Keys, laid out musically:** left hand **A S D** = kick, snare, clap; toms climb above it on **E R T** (low → high); right hand **J K L** = closed hat, open hat, cymbal; percussion above it on **U I**. **1–9 0 -** also play the drums in order. **Space** plays/stops, **Enter** toggles Rec.
- **Sound:** 57 factory sounds with per-voice voicing knobs. The browser build has no Color processing, reverb or delay. Tone and Drive remain part of the individual drum voices.
- Knobs: drag up/down (Shift for fine), use the mouse wheel or arrow keys, double-click to reset. State saves in the browser only. The output meter shows peak, and the GR readouts show compressor and limiter gain reduction. The listening output has a fixed −6 dB safety trim.

The AudioWorklet runs the original V6 procedural drums at a fixed 44.1 kHz; it will not substitute browser oscillators or samples if a device cannot provide the rate. Serve via HTTPS away from localhost. Do not use file://.

## Build and verify

- On PATH: Bash, Emscripten SDK **4.0.11** (or set `EMCC`), a native C compiler, Node 22+ and Python 3.
- `./build.sh` builds `web/bongdrums.wasm` from files inside this folder. All compiler inputs are listed in `corresponding-build-inputs.txt`.
- `node verify-library.mjs` loads every factory kit and pattern through the C catalog.
- `node verify-shaping.mjs` (run by `verify-core.sh`) checks that every drum has at least four knobs, that Tone and Drive are bit-exact when neutral and audible when set, that presets reset them and that LFOs can target them.
- `./verify-core.sh` compares native C and WASM output for 720 stereo 128-frame blocks in each of Dry and Bus and checks all 57 preset round trips.
- `python3 tools/gen_tables.py` recreates the checked-in mathematical table header without reading or producing samples.
- With the local server above running, `node verify-browser.mjs` runs the browser smoke test using macOS Chrome, or point `CHROME_BIN` at another Chromium binary. The script writes ignored local screenshots.
- Browser checks cover 44.1 kHz audio, no page scroll at 320×568 through 1440×900, kits, patterns and hotkeys, editing/persistence, keyboard navigation and playback controls. Offscreen macOS WKWebView ran 44.1 kHz audio; physical iPhone/Safari user activation and unlisted sample rates are not established by those tests.

## License and redistribution

The code is GNU GPL v3 only (GPL-3.0-only). See [LICENSE](LICENSE) and [NOTICES.md](NOTICES.md) for attribution and asset exceptions. The checked-in WASM is built from the corresponding source and commands in this tree. When hosting/distributing the WASM, give recipients an equally accessible link or download for the exact tagged corresponding source, not just a moving repository branch.


## Performance controls and text files

- **A/B:** choose a bank to edit without interrupting playback. Select **Queue** to change the sounding bank on the next downbeat, or **Set live** to select it immediately while stopped. If you stop with a bank queued, it becomes the next start bank. Existing saved patterns migrate to A and B starts blank. Loading a factory groove writes to the edit bank only.
- **Swing:** 50% is straight; at higher values the even-numbered steps arrive later without moving the quarter-note or bar boundaries. A live change takes effect at the next pair of steps.
- **Mute:** gate each lane’s audio with a 64-sample ramp, not its triggers. Unmute reveals still-playing audio without retriggering a voice.
- **LFOs:** two independent sine, triangle or soft-square modulators for pad level. Depth defaults to zero and does not edit patches. Tempo sync follows the musical quarter rather than swung step boundaries and resets at Play; free mode runs on the audio clock. Changes are smoothed and both slots can target one lane.
- **Share .txt:** a Pattern file stores both banks, tempo and swing. A Drum Preset file stores one pad’s recipe and edits, valid on the matching pad. Pick or drop a file, then select **Apply**. Pattern imports require stopped playback. Files are read locally and never uploaded.
- Further verification: `node verify-performance.mjs` compares against the public `v0.1.0` tag and exercises phase, mute and file round trips; `./verify-core.sh` verifies exact event boundaries, bank switching and native/WASM parity.

### Mixer levels and DSP Bench

The eleven Mixer bars show per-drum sample peaks in dBFS after voice shaping,
LFO, mute, fader, and pan, before drum-bus processing. They aren't fader
positions. Levels clear on mute. Collection runs only while the Mixer is visible.

From the menu, open **DSP Bench → Run Bench** with playback stopped. The
benchmark runs the current live bank, tempo, voices, mixer and Dry/Bus settings
through the same WASM engine in a worker with metering off. It warms up, then
reports the median of three render passes as a fraction of the audio time
rendered. This is an offline browser throughput estimate. It does not measure
AudioWorklet deadlines, audio device latency, dropouts, or FM-1 CPU load.

Saved kit send and return fields are retained as inactive legacy data. Browser builds exclude the spatial engine and buffers. The optional drum bus keeps saturation, compression, transient shaping, and limiting.
