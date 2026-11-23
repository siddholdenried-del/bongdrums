#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
ROOT=.
E="$ROOT/experiments/original-kit"
SOURCES=(bridge.c "$E"/{kit,presets,kit_math,shells,metal,perc,station,sequence,drum_bus,macro}.c)
names=$(sed -nE 's/^(int|void|float|float \*|const char \*) *([a-z_]+)\(.*/_\2/p' bridge.c | paste -sd, -)
emcc="${EMCC:-emcc}"
"$emcc" -O2 -std=c11 -ffp-contract=off -DPLAT_HOST -DDRUM_BUS_NO_SPATIAL -I"$E" -I"$ROOT/app/dsp" -I"$E/stock_tables" "${SOURCES[@]}" --no-entry -sSTANDALONE_WASM -sEXPORTED_FUNCTIONS="$names" -o web/bongdrums.wasm
