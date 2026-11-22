# BongDrums

BongDrums is an 11-voice, 16-step drum instrument by BongSoft, provided by BongTech, part of BongCult. It contains the portable C engine and a browser workbench. The same C compiles natively for tests and to WebAssembly for the browser. There are no drum samples, firmware images, Mac application binaries, project files, or third-party runtime services in this distribution.

## Play

Run `python3 -m http.server 48569 --bind 127.0.0.1 --directory web` from this folder and open http://127.0.0.1:48569 in a browser. On macOS, **Open BongDrums.command** does both. Click **Play** for the sequencer, or **Audition** for a selected voice. The workbench includes three starting patterns, a blank pattern, hit/accent entry, 57 factory sounds, per-voice editing, and Dry/Bus comparison. State saves in the browser only. The meters show gain reduction; the listening output has a fixed −6 dB safety trim.

The AudioWorklet runs the original V6 procedural drums at a fixed 44.1 kHz; it will not substitute browser oscillators or samples if a device cannot provide the rate. Serve via HTTPS away from localhost. Do not use file://.

## Build and verify

- On PATH: Bash, Emscripten SDK **4.0.11** (or set `EMCC`), a native C compiler, Node 22+ and Python 3.
- `./build.sh` builds `web/bongdrums.wasm` from files inside this folder. All compiler inputs are listed in `corresponding-build-inputs.txt`.
- `./verify-core.sh` compares native C and WASM output for 720 stereo 128-frame blocks in each of Dry and Bus and checks all 57 preset round trips.
- `python3 tools/gen_tables.py` recreates the checked-in mathematical table header without reading or producing samples.
- With the local server above running, `node verify-browser.mjs` runs the browser smoke test using macOS Chrome, or point `CHROME_BIN` at another Chromium binary. The script writes ignored local screenshots.
- Browser checks cover 44.1 kHz audio, desktop and narrow layouts, editing/persistence, keyboard navigation and playback controls. Offscreen macOS WKWebView ran 44.1 kHz audio; physical iPhone/Safari user activation and unlisted sample rates are not established by those tests.

## License and redistribution

The code is GNU GPL v3 only (GPL-3.0-only). See [LICENSE](LICENSE) and [NOTICES.md](NOTICES.md) for attribution and asset exceptions. The checked-in WASM is built from the corresponding source and commands in this tree. When hosting/distributing the WASM, give recipients an equally accessible link or download for the exact tagged corresponding source, not just a moving repository branch.


## Performance controls and text files

- **A/B:** choose a bank to edit without interrupting playback. Select **Queue** to change the sounding bank on the next downbeat, or **Set live** to select it immediately while stopped. If you stop with a bank queued, it becomes the next start bank. Existing saved patterns migrate to A and B starts blank. Loading a factory groove writes to the edit bank only.
- **Swing:** 50% is straight; at higher values the even-numbered steps arrive later without moving the quarter-note or bar boundaries. A live change takes effect at the next pair of steps.
- **Mute:** gate each lane’s audio and sends with a 64-sample ramp, not its triggers. Unmute reveals still-playing audio without retriggering a voice. Existing shared delay and reverb tails ring naturally.
- **LFOs:** two independent sine, triangle or soft-square modulators for pad level. Depth defaults to zero and does not edit patches. Tempo sync follows the musical quarter rather than swung step boundaries and resets at Play; free mode runs on the audio clock. Changes are smoothed and both slots can target one lane.
- **Share .txt:** a Pattern file stores both banks, tempo and swing. A Drum Preset file stores one pad’s recipe and edits, valid on the matching pad. Pick or drop a file, then select **Apply**. Pattern imports require stopped playback. Files are read locally and never uploaded.
- Further verification: `node verify-performance.mjs` compares against the public `v0.1.0` tag and exercises phase, mute and file round trips; `./verify-core.sh` verifies exact event boundaries, bank switching and native/WASM parity.
