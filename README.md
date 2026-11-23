# BongDrums

BongDrums is an 11-voice, 16-step drum instrument by BongSoft, provided by BongTech, part of BongCult. It contains the portable C engine and a browser workbench. The same C compiles natively for tests and to WebAssembly for the browser. There are no drum samples, firmware images, Mac application binaries, project files, or third-party runtime services in this distribution.

## Play

Run `python3 -m http.server 48569 --bind 127.0.0.1 --directory web` from this folder and open http://127.0.0.1:48569 in a browser. On macOS, **Open BongDrums.command** does both.

The instrument fits one window with no page scrolling and shows one editor at a time. Only the transport (Play, Rec), tempo and five mode tabs stay on screen. Switching tabs never stops playback, changes the playing pattern or cuts tails.

- **SEQUENCE:** the full 11-lane, 16-step grid in groups of four, filling the view, with A/B and swing. Each lane starts with an audition button and ends with a mute button the same size. Accents carry a dot and the playhead has its own marker. On portrait phones the grid turns so all 16 steps fit on one screen: audition buttons run across the top, steps run down and mutes sit at the bottom.
- **DRUM:** a four-knob desk modelled on the FM-1. The header holds ‹ drum ›, **P** (the drum's presets) and AUDITION. Below it, a screen shows the live output, a graph of whichever setting you touch (envelope, pitch, saturation, filter or option steps), a large readout, and four columns lined up over the four knobs. Every setting, options included, is a knob, four per page, with ‹ PAGE › to turn pages. A hit light flashes when the drum plays.
- **P** on SEQUENCE opens the factory kits. Pattern and the LFO drum use the same picker: a button that opens a sheet of large tiles (Escape or ✕ closes it). The LFO target is a row of buttons: LEVEL plus that drum's sliders.
- **LFO:** LFO 1 or LFO 2, with the live waveform, rate and depth in the centre. The read point stays fixed in the middle and the waveform scrolls through it, so the dot shows the value the LFO is applying right now. Drum, target, shape and sync/free sit around them.
- **MIXER:** per-drum level, pan, mute, and REVERB and DELAY sends. On phones each drum is one row with a horizontal level slider. The REVERB RETURN and DELAY RETURN faders sit on their own panel. Signal flow: DRUMS + REVERB RETURN + DELAY RETURN → DRUM BUS → OUTPUT. Both returns sum in before the bus processors.
- **BUS:** a live output oscilloscope above Saturator, Compressor, Transient and Limiter, with gain-reduction meters under Compressor and Limiter.
- Editor knobs are sized from the space each view actually has, choosing the row layout that gives the largest knobs.
- **VHS:** the interface is a mosaic of 3 px blocks (2 px on phones). Each block averages its area, so text stays legible. A 1 px dark scanline runs once per block, over a slow plum drift with a vignette. The whole design sits on that block grid: borders and strokes are one block, button edges two, corners are square and type is large. The LFO and bus scope draw as true pixel art, one canvas pixel per block. FX OFF removes the effect, and the drift and tracking ripple stop when the system asks for reduced motion.
- The ☰ menu holds FX OFF, file sharing, the key map and links.
- **Kits:** 11 factory kits (`web/library.js`), each a choice of factory recipes plus a few slider edits, levels, pans, sends, return levels, the four bus macros and Dry/Bus. Any edit turns the kit into *Custom kit*.
- **Patterns:** 16 factory patterns with their own tempo and swing. Loading writes into the bank you are editing (A or B).
- **Play it:** keys sound on press, and **Shift** plays an accent. Click a lane name to audition it. Lanes light when the sequencer hits them. **Rec** writes what you play into the playing bank, rounded to the nearest step. Drag across steps to paint them.
- **Keys, laid out musically:** left hand **A S D** = kick, snare, clap; toms climb above it on **E R T** (low → high); right hand **J K L** = closed hat, open hat, cymbal; percussion above it on **U I**. **1–9 0 -** also play the drums in order. **Space** plays/stops, **Enter** toggles Rec.
- **Sound:** 57 factory sounds with per-voice knobs. Each drum has its own level and pan, plus REVERB and DELAY sends into one shared reverb and one shared delay, each with its own return level. Each send is filtered for its drum type before it joins them, and sends sound in Bus mode only. Each LFO picks a drum, then that drum's level (continuous) or one of its sliders (sampled at every hit).
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
- **Mute:** gate each lane’s audio and sends with a 64-sample ramp, not its triggers. Unmute reveals still-playing audio without retriggering a voice. Existing shared delay and reverb tails ring naturally.
- **LFOs:** two independent sine, triangle or soft-square modulators for pad level. Depth defaults to zero and does not edit patches. Tempo sync follows the musical quarter rather than swung step boundaries and resets at Play; free mode runs on the audio clock. Changes are smoothed and both slots can target one lane.
- **Share .txt:** a Pattern file stores both banks, tempo and swing. A Drum Preset file stores one pad’s recipe and edits, valid on the matching pad. Pick or drop a file, then select **Apply**. Pattern imports require stopped playback. Files are read locally and never uploaded.
- Further verification: `node verify-performance.mjs` compares against the public `v0.1.0` tag and exercises phase, mute and file round trips; `./verify-core.sh` verifies exact event boundaries, bank switching and native/WASM parity.
