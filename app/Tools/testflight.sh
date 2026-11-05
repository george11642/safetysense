#!/bin/zsh
# Archives a Release build and uploads it to TestFlight (Josh Jarrett's team, internal testing only).
# Release signs manually with the API-created App Store profiles. XcodeGen always writes the target's
# entitlements into every config, so this swaps in TestFlight.entitlements for Release after generating:
# App Groups and time-sensitive notifications can only be enabled in the developer portal.
# A Release entitlement belongs in the TestFlight.entitlements files. Adding it to project.yml alone
# does nothing here, because this patch replaces those paths after xcodegen runs.
# Build numbers must increase or the upload is rejected: the default is a timestamp, or set SS_BUILD.
# Usage: SS_ASC_ISSUER=<issuer id> [SS_BUILD=2] app/Tools/testflight.sh
set -euo pipefail
cd "${0:A:h:h}"
BUILD="${SS_BUILD:-$(date +%y%m%d.%H%M)}"
KEY_ID="${SS_ASC_KEY:-PFSQAU75V7}"
for f in SafetySense SafetySenseWidgets; do
  grep -q 'com.georgeteifel.SafetySense.shared' "$f/TestFlight.entitlements" \
    || { echo "$f/TestFlight.entitlements is missing the shared keychain group" >&2; exit 1; }
done
xcodegen generate >/dev/null
python3 - <<'PY'
import re
p = "SafetySense.xcodeproj/project.pbxproj"
s = open(p).read()
def fix(m):
    b = m.group(0)
    if "PROVISIONING_PROFILE_SPECIFIER" not in b:
        return b
    return re.sub(r"CODE_SIGN_ENTITLEMENTS = (\w+)/\w+\.entitlements;", r"CODE_SIGN_ENTITLEMENTS = \1/TestFlight.entitlements;", b)
open(p, "w").write(re.sub(r"isa = XCBuildConfiguration;.*?name = \w+;", fix, s, flags=re.S))
PY
rm -rf build/SafetySense.xcarchive build/export build/DerivedData/Build/Intermediates.noindex/ArchiveIntermediates
XB=(env -i HOME="$HOME" USER="$USER" TMPDIR="${TMPDIR:-/tmp}" PATH=/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin /usr/bin/xcodebuild)
$XB -project SafetySense.xcodeproj -scheme SafetySense -configuration Release -destination "generic/platform=iOS" \
  -derivedDataPath build/DerivedData -archivePath build/SafetySense.xcarchive archive CURRENT_PROJECT_VERSION="$BUILD" </dev/null >build/archive.log 2>&1 \
  || { grep -E "error:|\*\* ARCHIVE" build/archive.log | sort -u | cut -c1-260; exit 1; }
$XB -exportArchive -archivePath build/SafetySense.xcarchive -exportPath build/export -exportOptionsPlist Tools/ExportOptions.plist </dev/null >build/export.log 2>&1 \
  || { grep -E "error|\*\* EXPORT" build/export.log | sort -u | cut -c1-260; exit 1; }
xcrun altool --upload-package build/export/SafetySense.ipa --type ios --apple-id 6831354575 \
  --bundle-id com.georgeteifel.SafetySense --bundle-short-version-string "$(/usr/libexec/PlistBuddy -c 'Print ApplicationProperties:CFBundleShortVersionString' build/SafetySense.xcarchive/Info.plist)" \
  --bundle-version "$BUILD" --apiKey "$KEY_ID" --apiIssuer "$SS_ASC_ISSUER" 2>&1 | tail -8 | cut -c1-260
