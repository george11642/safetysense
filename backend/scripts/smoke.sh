#!/usr/bin/env bash
# SafetySense backend smoke test (dry run: no Twilio calls or texts are placed).
# Usage: backend/scripts/smoke.sh   (reads SAFETYSENSE_GEORGE_PHONE / SAFETYSENSE_MARY_PHONE from ~/.config/global.env)
# Prints responses with secrets and phone numbers redacted. Writes state to $STATE (default: mktemp).
# Cleans up after itself with account/delete. KEEP=1 leaves the rows (and the stale session) for the watchdog.
set -euo pipefail
set -a; source ~/.config/global.env; set +a
API=${API:-https://uvunyysuyuonhoviszmc.supabase.co/functions/v1/api}
KEY=${KEY:-sb_publishable__JyRQ8x_BXI2FWlRsgUULA__5tdSYuh}
STATE=${STATE:-$(mktemp -d)}

redact() { sed -E 's/"device_secret":"[^"]+"/"device_secret":"<redacted>"/; s/\+1[0-9]{10}/<phone>/g'; }
post() { # route json [device]
  local h=(-H "content-type: application/json" -H "apikey: $KEY")
  if [ "${3:-}" = dev ]; then h+=(-H "x-device-id: $(cat "$STATE/id")" -H "x-device-secret: $(cat "$STATE/secret")"); fi
  curl -sS -X POST "$API/$1" "${h[@]}" --data-binary "$2"
}
step() { printf '\n== %s\n' "$1"; }

step "register"
R=$(post register "$(jq -n '{name:"Smoke Test", phone: env.SAFETYSENSE_GEORGE_PHONE, campus:"UNM"}')")
echo "$R" | redact
echo "$R" | jq -r .device_id > "$STATE/id"; echo "$R" | jq -r .device_secret > "$STATE/secret"

step "bad secret is rejected"
curl -sS -X POST "$API/contacts/set" -H "content-type: application/json" -H "x-device-id: $(cat "$STATE/id")" -H "x-device-secret: wrongwrongwrongwrong" -d '{"contacts":[]}'; echo

step "contacts/set (George + Mary)"
post contacts/set "$(jq -n '{contacts:[{name:"George", phone: env.SAFETYSENSE_GEORGE_PHONE},{name:"Mary", phone: env.SAFETYSENSE_MARY_PHONE}]}')" dev; echo

step "session/start (date mode, sealed details, dry run)"
S=$(post session/start '{"mode":"date","check_in_interval_s":60,"grace_s":180,"dry_run":true,"sealed_details":"Date: Alex R. (Hinge, alex_r_abq). Meeting at Frontier Restaurant, Central Ave."}' dev)
echo "$S"; echo "$S" | jq -r .session_id > "$STATE/session"

step "session/heartbeat"
post session/heartbeat "$(jq -n --arg s "$(cat "$STATE/session")" '{session_id:$s, lat:35.0844, lng:-106.6198, accuracy:12, battery:0.64}')" dev; echo

step "alert/create (level 2, dry run)"
A=$(post alert/create "$(jq -n --arg s "$(cat "$STATE/session")" '{session_id:$s, level:2, reason:"Possible scream detected", trigger:"risk_engine", lat:35.0846, lng:-106.6201, accuracy:10, battery:0.63, dry_run:true, dispatch_policy:"contacts_first"}')" dev)
echo "$A" | redact
echo "$A" | jq -r .alert_id > "$STATE/alert"; echo "$A" | jq -r .share_url > "$STATE/share_url"
TOKEN=$(basename "$(cat "$STATE/share_url")" | sed -E 's/^(.{32})-p$/\1/'); echo "$TOKEN" > "$STATE/token"

step "alert/location"
post alert/location "$(jq -n --arg a "$(cat "$STATE/alert")" '{alert_id:$a, lat:35.0850, lng:-106.6210, accuracy:8, battery:0.62}')" dev; echo

step "evidence/upload"
CT=$(head -c 64 /dev/urandom | base64); SHA=$(printf %s "$CT" | shasum -a 256 | cut -d' ' -f1)
post evidence/upload "$(jq -n --arg a "$(cat "$STATE/alert")" --arg c "$CT" --arg h "$SHA" '{alert_id:$a, seq:0, sha256:$h, ciphertext_b64:$c}')" dev; echo

step "share page HTML at the public URL"
curl -sS -o /dev/null -w "%{http_code} %{content_type}\n" "$(cat "$STATE/share_url")"

step "share/get (public)"
post share/get "{\"token\":\"$TOKEN\"}" | jq '{first_name,status,level,reason,dry_run,location,battery,sealed_details,events:(.events|length)}'

step "share/action on_my_way"
post share/action "{\"token\":\"$TOKEN\",\"action\":\"on_my_way\",\"responder_name\":\"Mary\"}"; echo

step "alert/cancel duress=true (must look like a normal cancel)"
post alert/cancel "$(jq -n --arg a "$(cat "$STATE/alert")" '{alert_id:$a, duress:true}')" dev; echo

step "alert/status from the phone (must hide the dispatch)"
post alert/status "$(jq -n --arg a "$(cat "$STATE/alert")" '{alert_id:$a}')" dev | jq '{status,dispatch,events:(.events|map(.action))}'

step "share/get after duress (contacts see the dispatch)"
post share/get "{\"token\":\"$TOKEN\"}" | jq '{status,level,dispatch,sealed_details:(.sealed_details!=null)}'

step "stale session for the watchdog (grace 5 s, dry run)"
S2=$(post session/start '{"mode":"walk","check_in_interval_s":15,"grace_s":5,"dry_run":true}' dev)
echo "$S2"; echo "$S2" | jq -r .session_id > "$STATE/session2"
post session/heartbeat "$(jq -n --arg s "$(cat "$STATE/session2")" '{session_id:$s, lat:35.0786, lng:-106.6189, accuracy:15, battery:0.41}')" dev; echo

if [ "${KEEP:-}" = 1 ]; then echo "KEEP=1: rows left in place. state dir: $STATE"; exit 0; fi

step "account/delete (removes every row and evidence object for this test device)"
post account/delete '{}' dev | jq -c .

step "old credentials no longer work (expect unauthorized)"
post alert/status "$(jq -n --arg a "$(cat "$STATE/alert")" '{alert_id:$a}')" dev; echo

step "share link is gone (expect link not found)"
post share/get "{\"token\":\"$TOKEN\"}"; echo
echo "state dir: $STATE"
