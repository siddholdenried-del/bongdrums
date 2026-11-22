#!/bin/bash
set -e
cd "$(dirname "$0")"
port=48569
python3 -m http.server "$port" --bind 127.0.0.1 --directory web &
server=$!
trap 'kill "$server" 2>/dev/null || true' EXIT
for i in {1..30}; do
  if ! kill -0 "$server" 2>/dev/null; then exit 1; fi
  if curl -fsS "http://127.0.0.1:$port/index.html" >/dev/null; then break; fi
  sleep .1
done
open "http://127.0.0.1:$port/"
echo 'BongDrums is running at http://127.0.0.1:48569/. Close this Terminal window to stop.'
wait "$server"
