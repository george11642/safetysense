#!/bin/sh
# Runs xcodebuild in a clean environment. Inside Claude Code sessions, the inherited environment
# makes SwiftBuild deadlock at "ExecuteExternalTool clang -v -E -dM" (SWBBuildService never reads
# clang's output pipe). Stripping the environment avoids it.
# Usage: app/Tools/xcb.sh build|test|build-for-testing [extra xcodebuild args...]
set -e
cd "$(dirname "$0")/.."
ACTION="${1:-build}"; shift 2>/dev/null || true
DEST="${SS_DEST:-platform=iOS Simulator,name=iPhone 17 Pro}"
exec env -i HOME="$HOME" USER="$USER" TMPDIR="${TMPDIR:-/tmp}" PATH=/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin \
  /usr/bin/xcodebuild -project SafetySense.xcodeproj -scheme SafetySense \
  -destination "$DEST" -derivedDataPath build/DerivedData "$ACTION" "$@" < /dev/null
