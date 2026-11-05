#!/bin/bash
# v2 verification stills: scripts/v2_stills.sh <outPrefix> <frame...>  (bundles once; shows errors)
cd "$(dirname "$0")/.."
PREFIX=$1; shift
BUNDLE=$(mktemp -d)/bundle
npx remotion bundle src/index.ts --out-dir "$BUNDLE" >/dev/null 2>&1 || { echo bundle failed; exit 1; }
mkdir -p "$(dirname "$PREFIX")"
export BUNDLE PREFIX
printf '%s\n' "$@" | xargs -P "${JOBS:-6}" -I{} sh -c 'npx remotion still "$BUNDLE" ReelV2 "${PREFIX}_$(printf %04d {}).png" --frame={} --gl=angle --log=error 2>&1 | grep -v "^$" | head -5'
rm -rf "$(dirname "$BUNDLE")"
