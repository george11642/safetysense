#!/bin/zsh
# Render every submission HTML to PDF with headless Chrome, then PNG previews for QA.
# Usage: submission/_assets/render.sh [preview_dir]
set -euo pipefail
ROOT="${0:A:h:h}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PREVIEW="${1:-}"
docs=(
  "01-team-bio/SafetySense-TeamBio"
  "02-screenshots/SafetySense-Screenshots"
  "03-purpose-audience-functions/SafetySense-Purpose-Audience-Functions"
  "04-technical-aspects/SafetySense-Technical"
  "05-security/SafetySense-Security"
)
for d in $docs; do
  "$CHROME" --headless=new --disable-gpu --no-pdf-header-footer --run-all-compositor-stages-before-draw \
    --virtual-time-budget=15000 --print-to-pdf="$ROOT/$d.pdf" "file://$ROOT/$d.html" 2>/dev/null
  pages=$(pdfinfo "$ROOT/$d.pdf" 2>/dev/null | awk '/^Pages/{print $2}')
  echo "$d.pdf  pages=$pages"
  if [[ -n "$PREVIEW" ]]; then
    mkdir -p "$PREVIEW"
    pdftoppm -r 70 -png "$ROOT/$d.pdf" "$PREVIEW/${d:t}"
  fi
done
