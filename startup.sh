#!/usr/bin/env bash
# App preview entrypoint. Always listen on 8080.
set -euo pipefail
cd "$(dirname "$0")"
if [[ ! -d node_modules ]]; then
  npm install
fi
exec npm run dev
