#!/bin/bash
# Render verification stills of a composition: scripts/kit3d_stills.sh <CompId> <outPrefix> <frame> [frame...]
# Bundles once, then renders each frame with the ANGLE GL backend (works headless on macOS).
set -e
cd "$(dirname "$0")/.."
COMP=$1; PREFIX=$2; shift 2
BUNDLE=$(mktemp -d)/bundle
npx remotion bundle src/index.ts --out-dir "$BUNDLE" >/dev/null 2>&1
mkdir -p "$(dirname "$PREFIX")"
export BUNDLE COMP PREFIX
printf '%s\n' "$@" | xargs -P "${JOBS:-5}" -I{} sh -c 'npx remotion still "$BUNDLE" "$COMP" "${PREFIX}_$(printf %04d {}).png" --frame={} --gl=angle --log=error >/dev/null' 
rm -rf "$(dirname "$BUNDLE")"
ls -1 "${PREFIX}"_*.png
