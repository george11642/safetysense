#!/usr/bin/env bash
# SafetySense privacy-route tests. No Twilio calls or texts are placed and nothing is dispatched.
#
#   backend/scripts/privacy_test.sh            auth checks, account/delete (incl. Storage), signature checks
#   backend/scripts/privacy_test.sh sms-setup  makes a dry-run alert and prints the text_sent event to tag (see below)
#   backend/scripts/privacy_test.sh sms-finish <MessageSid> <state dir>
#                                              posts Twilio-signed sms-status callbacks (signed locally with
#                                              TWILIO_AUTH_TOKEN; Twilio itself is never contacted), checks
#                                              alert/status + share/get show "undelivered" / 30034, then deletes
#   backend/scripts/privacy_test.sh deferred   live alert with NO contacts (nobody can be called), then
#                                              account/delete: creds die at once, the share link keeps working.
#                                              Afterwards mark the alert cancelled in SQL and run cron/retention.
#   RATE=1 backend/scripts/privacy_test.sh     also checks the register rate limit (uses up this IP's hourly quota;
#                                              clear it with: delete from public.register_hits;)
#
# sms-setup leaves provider_sid empty (dry runs never reach Twilio). Tag it in SQL first:
#   update public.events set provider_sid='<MessageSid>', delivery_status='queued' where id=<event id>;
set -euo pipefail
set -a; source ~/.config/global.env; set +a
API=${API:-https://uvunyysuyuonhoviszmc.supabase.co/functions/v1/api}
KEY=${KEY:-sb_publishable__JyRQ8x_BXI2FWlRsgUULA__5tdSYuh}
MODE=${1:-all}

pass=0; fail=0
ok()   { pass=$((pass+1)); printf '  PASS %s\n' "$1"; }
bad()  { fail=$((fail+1)); printf '  FAIL %s (got: %s)\n' "$1" "$2"; }
expect() { # name actual pattern
  if printf %s "$2" | grep -Eq "$3"; then ok "$1"; else bad "$1" "$(printf %s "$2" | head -c 300)"; fi
}
step() { printf '\n== %s\n' "$1"; }

post() { # route json [state-dir-for-device-auth]
  local h=(-H "content-type: application/json" -H "apikey: $KEY")
  if [ -n "${3:-}" ]; then h+=(-H "x-device-id: $(cat "$3/id")" -H "x-device-secret: $(cat "$3/secret")"); fi
  curl -sS -X POST "$API/$1" "${h[@]}" --data-binary "$2"
}
code() { # route json [extra curl args...] -> http status
  local r=$1 b=$2; shift 2
  curl -sS -o /dev/null -w '%{http_code}' -X POST "$API/$r" -H "content-type: application/json" -H "apikey: $KEY" "$@" --data-binary "$b"
}
new_device() { # name -> state dir
  local d; d=$(mktemp -d)
  local R; R=$(post register "$(jq -n --arg n "$1" '{name:$n, campus:"UNM"}')")
  echo "$R" | jq -r .device_id > "$d/id"; echo "$R" | jq -r .device_secret > "$d/secret"
  if [ "$(cat "$d/id")" = null ]; then echo "register failed: $R" >&2; exit 1; fi
  echo "$d"
}
# Twilio signature: base64(HMAC-SHA1(auth token, url + sorted key+value pairs)). The token is read from env, never printed.
twilio_sig() { # url k1 v1 k2 v2 ...
  local url=$1; shift
  python3 -I -c '
import sys, hmac, hashlib, base64, os
url = sys.argv[1]; kv = sys.argv[2:]
pairs = sorted(zip(kv[0::2], kv[1::2]))
data = url + "".join(k + v for k, v in pairs)
print(base64.b64encode(hmac.new(os.environ["TWILIO_AUTH_TOKEN"].encode(), data.encode(), hashlib.sha1).digest()).decode())
' "$url" "$@"
}
alert_for() { # state-dir -> creates a dry-run alert with one contact; writes alert + token
  post contacts/set "$(jq -n '{contacts:[{name:"Test Contact", phone: env.SAFETYSENSE_GEORGE_PHONE}]}')" "$1" > /dev/null
  local A; A=$(post alert/create '{"level":2,"reason":"Privacy test","trigger":"manual_sos","lat":35.0844,"lng":-106.6198,"accuracy":10,"battery":0.5,"dry_run":true,"dispatch_policy":"contacts_first"}' "$1")
  echo "$A" | jq -r .alert_id > "$1/alert"; basename "$(echo "$A" | jq -r .share_url)" | sed -E 's/^(.{32})-p$/\1/' > "$1/token"
}

if [ "$MODE" = all ]; then
  step "cron/retention and cron/watchdog refuse callers without the cron secret"
  expect "retention without secret -> 401" "$(code cron/retention '{}')" '^401$'
  expect "retention with wrong secret -> 401" "$(code cron/retention '{}' -H 'x-cron-secret: nope')" '^401$'
  expect "watchdog without secret -> 401" "$(code cron/watchdog '{}')" '^401$'

  step "twilio/sms-status refuses unsigned or wrongly signed callbacks"
  expect "no signature -> 403" "$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$API/twilio/sms-status?token=x&c=y" -d 'MessageSid=SM00000000000000000000000000000000&MessageStatus=delivered')" '^403$'
  expect "bad signature -> 403" "$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$API/twilio/sms-status?token=x&c=y" -H 'x-twilio-signature: AAAA' -d 'MessageSid=SM00000000000000000000000000000000&MessageStatus=delivered')" '^403$'
  URL="$API/twilio/sms-status?token=x&c=y"
  SIG=$(twilio_sig "$URL" MessageSid SM00000000000000000000000000000000 MessageStatus delivered)
  expect "valid signature, unknown sid -> 204 (ignored)" "$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$URL" -H "x-twilio-signature: $SIG" -d 'MessageSid=SM00000000000000000000000000000000&MessageStatus=delivered')" '^204$'

  step "account/delete needs device credentials"
  expect "no creds -> 401" "$(code account/delete '{}')" '^401$'

  step "account/delete removes rows and the evidence object"
  S=$(new_device "Privacy Test")
  alert_for "$S"
  CT=$(head -c 64 /dev/urandom | base64); SHA=$(printf %s "$CT" | shasum -a 256 | cut -d' ' -f1)
  for seq in 0 1; do
    post evidence/upload "$(jq -n --arg a "$(cat "$S/alert")" --arg c "$CT" --arg h "$SHA" --argjson s $seq '{alert_id:$a, seq:$s, sha256:$h, ciphertext_b64:$c}')" "$S" > /dev/null
  done
  post alert/location "$(jq -n --arg a "$(cat "$S/alert")" '{alert_id:$a, lat:35.085, lng:-106.62, accuracy:8, battery:0.5}')" "$S" > /dev/null
  D=$(post account/delete '{}' "$S"); echo "  $D"
  expect "ok" "$D" '"ok":true'
  expect "2 evidence objects deleted" "$D" '"evidence_objects":2'
  expect "2 evidence rows" "$D" '"evidence_rows":2'
  expect "1 alert, 1 contact, device" "$D" '"contacts":1,"sessions":0,"alerts":1,"locations":2'
  expect "old secret rejected" "$(post alert/status "$(jq -n --arg a "$(cat "$S/alert")" '{alert_id:$a}')" "$S")" 'unauthorized'
  expect "share link gone" "$(post share/get "{\"token\":\"$(cat "$S/token")\"}")" 'link not found'
  expect "second delete -> unauthorized" "$(post account/delete '{}' "$S")" 'unauthorized'
  echo "  (check Storage: select count(*) from storage.objects where name like '$(cat "$S/id")/%'; -> 0)"

  step "existing routes still answer"
  expect "share/get bad token -> 404" "$(code share/get '{"token":"short"}')" '^404$'
  expect "unknown route -> 404" "$(code nope '{}')" '^404$'

  if [ "${RATE:-}" = 1 ]; then
    step "register rate limit (per network, per hour)"
    got=""; dirs=()
    for i in 1 2 3 4 5 6 7; do
      R=$(post register '{"name":"Rate Test"}')
      if echo "$R" | grep -q 'Too many sign-ups'; then got=$i; break; fi
      d=$(mktemp -d); echo "$R" | jq -r .device_id > "$d/id"; echo "$R" | jq -r .device_secret > "$d/secret"; dirs+=("$d")
    done
    if [ -n "$got" ]; then ok "429 after $((got-1)) more sign-ups"; else bad "rate limit" "no 429 in 7 tries"; fi
    expect "429 status code" "$(code register '{"name":"Rate Test"}')" '^429$'
    for d in "${dirs[@]}"; do post account/delete '{}' "$d" > /dev/null; done
  fi
  printf '\n%d passed, %d failed\n' "$pass" "$fail"; [ "$fail" = 0 ]

elif [ "$MODE" = sms-setup ]; then
  S=$(new_device "SMS Status Test"); alert_for "$S"
  echo "state=$S alert=$(cat "$S/alert")"
  echo "tag the event in SQL: select id from public.events where alert_id='$(cat "$S/alert")' and action='text_sent';"

elif [ "$MODE" = sms-finish ]; then
  SID=$2; S=$3; TOKEN=$(cat "$S/token"); C=x
  URL="$API/twilio/sms-status?token=$TOKEN&c=$C"
  cb() { # status [errorcode]
    local args=(MessageSid "$SID" MessageStatus "$1") body="MessageSid=$SID&MessageStatus=$1"
    if [ -n "${2:-}" ]; then args+=(ErrorCode "$2"); body+="&ErrorCode=$2"; fi
    curl -sS -o /dev/null -w '%{http_code}' -X POST "$URL" -H "x-twilio-signature: $(twilio_sig "$URL" "${args[@]}")" -d "$body"
  }
  step "signed callbacks: sent, then undelivered 30034, then a late 'sent' (must not overwrite)"
  expect "sent -> 204" "$(cb sent)" '^204$'
  expect "undelivered -> 204" "$(cb undelivered 30034)" '^204$'
  expect "late sent -> 204" "$(cb sent)" '^204$'
  ST=$(post alert/status "$(jq -n --arg a "$(cat "$S/alert")" '{alert_id:$a}')" "$S" | jq -c '[.events[]|select(.action=="text_sent")][0]')
  echo "  alert/status: $ST"
  expect "alert/status shows undelivered" "$ST" '"delivery_status":"undelivered"'
  expect "alert/status shows 30034" "$ST" '"error_code":"30034"'
  expect "detail says not delivered" "$ST" 'not delivered \(error 30034\)'
  SG=$(post share/get "{\"token\":\"$TOKEN\"}" | jq -c '[.events[]|select(.action=="text_sent")][0]')
  echo "  share/get:    $SG"
  expect "share/get shows undelivered" "$SG" '"delivery_status":"undelivered"'
  expect "cleanup" "$(post account/delete '{}' "$S")" '"ok":true'
  printf '\n%d passed, %d failed\n' "$pass" "$fail"; [ "$fail" = 0 ]

elif [ "$MODE" = deferred ]; then
  S=$(new_device "Deferred Delete Test")
  post contacts/set '{"contacts":[]}' "$S" > /dev/null
  # Live (not dry-run) but with no contacts and contacts_first: nobody is called or texted, nothing is dispatched.
  A=$(post alert/create '{"level":2,"reason":"Deferred delete test","trigger":"manual_sos","dispatch_policy":"contacts_first"}' "$S")
  AID=$(echo "$A" | jq -r .alert_id); TOKEN=$(basename "$(echo "$A" | jq -r .share_url)" | sed -E 's/^(.{32})-p$/\1/')
  expect "nobody notified" "$(echo "$A" | jq -c .notified)" '^\[\]$'
  D=$(post account/delete '{}' "$S"); echo "  $D"
  expect "same response shape" "$D" '"ok":true,"deleted":\{"contacts":0,"sessions":0,"alerts":1'
  expect "creds revoked at once" "$(post alert/status "{\"alert_id\":\"$AID\"}" "$S")" 'unauthorized'
  expect "contacts can still open the live link" "$(post share/get "{\"token\":\"$TOKEN\"}")" '"status":"active"'
  echo "  NOW (within 90 s, before the watchdog escalates): update public.alerts set status='cancelled', cancelled_at=now() where id='$AID';"
  echo "  then run cron/retention via pg_net; expect devices_deleted >= 1."
  printf '\n%d passed, %d failed\n' "$pass" "$fail"; [ "$fail" = 0 ]
fi
