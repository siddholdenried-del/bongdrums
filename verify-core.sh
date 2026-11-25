#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
ROOT=.
E="$ROOT/experiments/original-kit"
trap 'rm -f native.tmp native-reference.tmp sequence.tmp mix.tmp substeps.tmp' EXIT
cc -O2 -std=c11 -I"$E" verify-sequence.c "$E/sequence.c" -o sequence.tmp
./sequence.tmp
cc -O2 -std=c11 -I"$E" verify-substeps.c "$E/sequence.c" -o substeps.tmp
./substeps.tmp
node verify-substep-files.mjs
cc -O2 -std=c11 -ffp-contract=off -DPLAT_HOST -DDRUM_BUS_NO_SPATIAL -I"$E" -I"$ROOT/app/dsp" -I"$E/stock_tables" bridge.c native-reference.c "$E"/{kit,presets,kit_math,shells,metal,perc,station,sequence,drum_bus,macro}.c -lm -o native-reference.tmp
./native-reference.tmp
cc -O2 -std=c11 -ffp-contract=off -DPLAT_HOST -DDRUM_BUS_NO_SPATIAL -I"$E" -I"$ROOT/app/dsp" -I"$E/stock_tables" verify-mix.c bridge.c "$E"/{kit,presets,kit_math,shells,metal,perc,station,sequence,drum_bus,macro}.c -lm -o mix.tmp
./mix.tmp
node verify-core.mjs
node verify-firmware-catalog.mjs
node verify-shaping.mjs
