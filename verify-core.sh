#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
ROOT=.
E="$ROOT/experiments/original-kit"
trap 'rm -f native.tmp native-reference.tmp' EXIT
cc -O2 -std=c11 -ffp-contract=off -DPLAT_HOST -I"$E" -I"$ROOT/app/dsp" -I"$E/stock_tables" bridge.c native-reference.c "$E"/{kit,presets,kit_math,shells,metal,perc,station,sequence,drum_bus,macro}.c "$ROOT/app/dsp/fxbus.c" -lm -o native-reference.tmp
./native-reference.tmp
node verify-core.mjs
