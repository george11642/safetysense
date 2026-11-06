#!/usr/bin/env bash
# SafetySense relay-line tests against the deployed function.
#
# Calls and texts here are SIMULATED: this script signs Twilio-style webhook POSTs locally with
# TWILIO_AUTH_TOKEN (never printed) and reads the TwiML that comes back. Nothing it does makes Twilio
# dial or text anyone, and that TwiML is never executed by Twilio. Alarms go to the Noonlight SANDBOX.
# A real dispatcher, a real forwarded call, voicemail and the Twilio trial preamble are NOT exercised.
#
# Test devices have a made-up phone number. Every test alert is created with NO contacts, and contacts
# are only added between duress notices, so no alert or notice reaches a real person.
#
#   relay_test.sh normal    no alert, forwarding, screening, voicemail, no phone on file, two alarms, texts, callers
#   relay_test.sh after     duress entered AFTER dispatch: flips at call time, in flight, one-way
#   relay_test.sh before    duress entered BEFORE dispatch
#   relay_test.sh born      duress PIN with no alert running (alert/create reason, including repeat)
#   relay_test.sh selfcontact   her own number on the contact list (dry runs only)
#   relay_test.sh scope-setup   then the printed SQL, then scope-check: how far a duress alarm reaches
#   relay_test.sh twin-setup    then the printed SQL, then twin-check: forced delete, same number on a new device
#   relay_test.sh cancel <noonlight alarm id>...    cancels sandbox alarms left by a duress stage
#
# Duress alerts can't be cancelled (that's the point), so "after", "before", "born" and the scope stages
# leave one behind. It blocks every other number's forwarding for 1 hour after the duress PIN, and its own
# number's for 48 hours on any device, so it fails the next stage safe. Between stages, read the alarm id and delete the rows in SQL:
#   select dispatch_alarm_id from public.alerts where device_id='<printed id>';
#   delete from public.devices where id='<printed id>';      -- cascades
#   delete from public.register_hits;                        -- each stage registers one device
set -euo pipefail
set -a; source ~/.config/global.env; set +a
API=${API:-https://uvunyysuyuonhoviszmc.supabase.co/functions/v1/api}
KEY=${KEY:-sb_publishable__JyRQ8x_BXI2FWlRsgUULA__5tdSYuh}
STAGE=${1:-normal}
PHONE=+15055550142        # the test device. Never dialled: the TwiML comes back to this script.
DISPATCHER=+15055550199   # stands in for the monitoring center
CONTACT=+15055550177
STATE=${RELAY_STATE:-$(mktemp -d)}   # set RELAY_STATE to carry the scope-setup devices into scope-check

pass=0; fail=0
ok()   { pass=$((pass+1)); printf '  PASS %s\n' "$1"; }
bad()  { fail=$((fail+1)); printf '  FAIL %s (got: %s)\n' "$1" "$(printf %s "$2" | sed -E 's/\+1[0-9]{10}/<phone>/g' | head -c 400)"; }
has()  { if printf %s "$2" | grep -Eq -- "$3"; then ok "$1"; else bad "$1" "$2"; fi; }
hasnt(){ if printf %s "$2" | grep -Eq -- "$3"; then bad "$1" "$2"; else ok "$1"; fi; }
step() { printf '\n== %s\n' "$1"; }

post() { # route json [dev]
  local h=(-H "content-type: application/json" -H "apikey: $KEY")
  if [ "${3:-}" = dev ]; then h+=(-H "x-device-id: $(cat "$STATE/id")" -H "x-device-secret: $(cat "$STATE/secret")"); fi
  curl -sS -X POST "$API/$1" "${h[@]}" --data-binary "$2"
}
sign() { # url k v k v ...  -> line 1: signature, line 2: form body.
  python3 -I -c '
import sys, hmac, hashlib, base64, os, urllib.parse as u
url = sys.argv[1]; kv = sys.argv[2:]
pairs = sorted(zip(kv[0::2], kv[1::2]))
data = url + "".join(k + v for k, v in pairs)
print(base64.b64encode(hmac.new(os.environ["TWILIO_AUTH_TOKEN"].encode(), data.encode(), hashlib.sha1).digest()).decode())
print(u.urlencode(pairs))
' "$@"
}
tw() { # route[?query] k v ... -> TwiML, prefixed with the status code
  local url="$API/$1"; shift
  local s; s=$(sign "$url" "$@")
  curl -sS -w ' [http %{http_code}]' -X POST "$url" -H "x-twilio-signature: $(printf %s "$s" | sed -n 1p)" \
    -H "content-type: application/x-www-form-urlencoded" --data-binary "$(printf %s "$s" | sed -n 2p)"
}
sid() { echo "CA$(openssl rand -hex 16)"; }
call() { tw twilio/relay/voice CallSid "${2:-$(sid)}" From "$1" To "+15055550100" CallStatus ringing; }
text() { tw twilio/relay/sms MessageSid "SM$(openssl rand -hex 16)" From "$1" To "+15055550100" Body "Are you OK?"; }
new_device() {
  local R; R=$(post register "$(jq -n --arg p "$PHONE" '{name:"Relay Test", phone:$p, campus:"UNM"}')")
  echo "$R" | jq -r .device_id > "$STATE/id"; echo "$R" | jq -r .device_secret > "$STATE/secret"
  [ "$(cat "$STATE/id")" != null ] || { echo "register failed: $R"; exit 1; }
  echo "test device: $(cat "$STATE/id")"
}
alert() { # level reason -> alert id; share token in $STATE/token. Live, not a dry run: there are no contacts to reach.
  local R; R=$(post alert/create "$(jq -n --argjson l "$1" --arg r "$2" --arg s "${SESSION_ID:-}" '{level:$l, reason:$r, trigger:"manual_sos", lat:35.0846, lng:-106.6201, accuracy:10.6, battery:0.6, dispatch_policy:"contacts_first"} + (if $s == "" then {} else {session_id:$s} end)')" dev)
  basename "$(echo "$R" | jq -r .share_url)" > "$STATE/token"
  echo "$R" | jq -r .alert_id
}
cancel() { post alert/cancel "$(jq -n --arg a "$1" --argjson d "${2:-false}" '{alert_id:$a, duress:$d}')" dev; }
set_contacts() { # phone or empty
  if [ -n "${1:-}" ]; then post contacts/set "$(jq -n --arg p "$1" '{contacts:[{name:"Test Contact", phone:$p}]}')" dev >/dev/null
  else post contacts/set '{"contacts":[]}' dev >/dev/null; fi
}
alarm_of() { post alert/escalate "$(jq -n --arg a "$1" '{alert_id:$a}')" dev | jq -r .dispatch.alarm_id; }
alarm_status() { curl -sS "https://api-sandbox.noonlight.com/dispatch/v1/alarms/$1/status" -H "authorization: Bearer $NOONLIGHT_SANDBOX_TOKEN" | jq -r .status; }
share() { post share/get "{\"token\":\"$(cat "$STATE/token")\"}"; }
finish() {
  printf '\n%s passed, %s failed\n' "$pass" "$fail"
  [ "$fail" = 0 ]
}

DURESS_WORDS='may be coerced\. Do not call or text them\. Send police'
NEUTRAL_WORDS='This line does not connect to anyone'
NOANSWER_WORDS='The person did not answer.*send police'
CONTACT_WORDS='use the live link we sent you, and do not call or text their phone'

duress_assertions() { # label: the call-time checks once duress is on
  local r; r=$(call "$DISPATCHER")
  has   "$1: dispatcher hears the duress message" "$r" "$DURESS_WORDS"
  hasnt "$1: her phone is never dialled" "$r" '<Dial|<Number'
  r=$(text "$DISPATCHER"); hasnt "$1: inbound text is not forwarded" "$r" '<Dial|<Number|to='
  hasnt "$1: text reply says nothing about state" "$r" 'coerced|duress|police'
  r=$(call "$PHONE"); has "$1: her own phone calling hears no state" "$r" "$NEUTRAL_WORDS"; hasnt "$1: same, no duress words" "$r" 'coerced|police'
  r=$(text "$PHONE"); hasnt "$1: nothing is texted back to her phone" "$r" '<Message'
}

case "$STAGE" in
cancel)
  shift
  for id in "$@"; do
    curl -sS -o /dev/null -w "cancel $id: %{http_code}\n" -X POST "https://api-sandbox.noonlight.com/dispatch/v1/alarms/$id/status" \
      -H "authorization: Bearer $NOONLIGHT_SANDBOX_TOKEN" -H 'content-type: application/json' -d '{"status":"CANCELED","pin":"1234"}'
  done
  exit 0 ;;

normal)
  step "signatures: every relay webhook refuses unsigned and badly signed requests"
  for route in voice screen accept dial-done sms; do
    c=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$API/twilio/relay/$route" -d "From=$DISPATCHER")
    has "$route unsigned" "$c" '^403$'
    c=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$API/twilio/relay/$route" -H 'x-twilio-signature: AAAAAAAAAAAAAAAAAAAAAAAAAAA=' -d "From=$DISPATCHER")
    has "$route bad signature" "$c" '^403$'
  done

  step "no active alert"
  r=$(call "$DISPATCHER"); has "neutral message" "$r" "$NEUTRAL_WORDS"; hasnt "no dial" "$r" '<Dial'
  r=$(text "$DISPATCHER"); has "text gets the call-this-number reply" "$r" 'Please call this number'; hasnt "text not forwarded" "$r" '<Dial'

  step "fail-safe: a lookup that errors never rings"
  # A From this long makes the real database lookup fail at the gateway: a genuine error, with no test
  # hook in the server. (A NUL byte does not do it: that comes back as a clean "no match".)
  HUGE=$(head -c 40000 /dev/zero | tr '\0' 5)
  r=$(call "$HUGE")
  has "voice: police message" "$r" "$DURESS_WORDS"; hasnt "voice: no dial" "$r" '<Dial'; has "voice: valid TwiML, http 200" "$r" '\[http 200\]'
  r=$(tw "twilio/relay/dial-done?alert=not-a-uuid" CallSid "$(sid)" DialCallStatus no-answer); has "dial-done: police message" "$r" "$DURESS_WORDS"
  r=$(tw "twilio/relay/screen?alert=not-a-uuid&parent=x" CallSid "$(sid)"); has "screen: hangs up" "$r" '<Hangup/>'; hasnt "screen: no prompt" "$r" '<Gather'
  r=$(tw "twilio/relay/accept?alert=not-a-uuid&parent=x" CallSid "$(sid)" Digits 1); has "accept: hangs up" "$r" '<Hangup/>'
  r=$(tw twilio/relay/sms From "$HUGE" Body hi); hasnt "sms: no reply" "$r" '<Message'

  new_device

  step "normal call forwards"
  A=$(alert 3 "Relay test alert")
  sleep 1
  P=$(share | jq -r '.dispatch.provider'); has "alarm went to the Noonlight sandbox" "$P" '^noonlight_sandbox$'
  PARENT=$(sid); r=$(call "$DISPATCHER" "$PARENT")
  has   "dials her real phone" "$r" "<Number[^>]*>\\$PHONE</Number>"
  hasnt "sets no callerId, so the relay number never shows on her phone" "$r" 'callerId'
  hasnt "says nothing to the dispatcher first" "$r" '<Say'

  step "screening"
  q="alert=$A&parent=$PARENT"
  r=$(tw "twilio/relay/screen?$q" CallSid "$(sid)" ParentCallSid "$PARENT"); has "person must press 1" "$r" '<Gather numDigits="1".*Press 1 to connect'; hasnt "prompt says nothing about dispatch" "$r" 'police|dispatch|alarm'; hasnt "prompt doesn't name the app, a voicemail can record it" "$r" 'SafetySense'
  r=$(tw "twilio/relay/accept?$q" CallSid "$(sid)" Digits 2); has "wrong key hangs up" "$r" '<Hangup/>'

  step "not answered: rang out, and voicemail (call 'completed' but nobody pressed 1)"
  r=$(tw "twilio/relay/dial-done?alert=$A" CallSid "$PARENT" DialCallStatus no-answer); has "no-answer tells the dispatcher to send police" "$r" "$NOANSWER_WORDS"
  r=$(tw "twilio/relay/dial-done?alert=$A" CallSid "$PARENT" DialCallStatus completed); has "voicemail gets the same" "$r" "$NOANSWER_WORDS"
  r=$(tw "twilio/relay/dial-done?alert=$A" CallSid "$PARENT" DialCallStatus busy); has "busy gets the same" "$r" "$NOANSWER_WORDS"

  step "answered and accepted"
  r=$(tw "twilio/relay/accept?$q" CallSid "$(sid)" Digits 1); hasnt "pressing 1 connects (empty TwiML)" "$r" '<Hangup|<Say'; has "pressing 1 returns http 200" "$r" '\[http 200\]'
  r=$(tw "twilio/relay/dial-done?alert=$A" CallSid "$PARENT" DialCallStatus completed); has "a finished call just ends" "$r" '<Hangup/>'; hasnt "no send-police message" "$r" 'police'

  step "inbound text, no duress"
  r=$(text "$DISPATCHER"); has "reply says call this number" "$r" 'Please call this number'; hasnt "not forwarded" "$r" '<Dial|to='
  r=$(text "$PHONE"); hasnt "her own phone gets no reply" "$r" '<Message'

  step "contact and device callers"
  set_contacts "$CONTACT"
  r=$(call "$CONTACT"); has "contact gets the link message" "$r" "$CONTACT_WORDS"; hasnt "contact is never dialled through" "$r" '<Dial'
  r=$(text "$CONTACT"); has "contact text gets the link reply" "$r" 'use the live link'
  r=$(call "$PHONE"); has "her own phone gets the neutral message" "$r" "$NEUTRAL_WORDS"; hasnt "and doesn't ring itself" "$r" '<Dial'
  set_contacts ""

  step "two alarms at once: can't tell whose, so never ring"
  ALARM_A=$(alarm_of "$A")
  B=$(alert 3 "Second relay test alert"); sleep 1
  ALARM_B=$(alarm_of "$B")
  r=$(call "$DISPATCHER"); has "police message" "$r" "$DURESS_WORDS"; hasnt "no dial" "$r" '<Dial'
  cancel "$B" >/dev/null

  step "normal cancel takes the alarm off the relay"
  cancel "$A" >/dev/null
  r=$(call "$DISPATCHER"); has "neutral again" "$r" "$NEUTRAL_WORDS"
  r=$(tw "twilio/relay/dial-done?alert=$A" CallSid "$(sid)" DialCallStatus no-answer)
  has "cancelled while it rang: dispatcher hears it was cancelled" "$r" 'cancelled this alarm with their PIN'; hasnt "and is not told to send police" "$r" 'police'

  step "no phone on file: alarm still works, dispatcher told to send police"
  post profile/update '{"name":"Relay Test","campus":"UNM"}' dev >/dev/null
  C=$(alert 3 "No phone relay test"); sleep 1
  P=$(share | jq -r '.dispatch.provider'); has "alarm went to the sandbox with no phone on the device" "$P" '^noonlight_sandbox$'
  r=$(call "$DISPATCHER"); has "no-answer message" "$r" "$NOANSWER_WORDS"; hasnt "no dial" "$r" '<Dial'
  ALARM_C=$(alarm_of "$C")
  cancel "$C" >/dev/null

  step "every test alarm really is cancelled at Noonlight"
  for a in "$ALARM_A" "$ALARM_B" "$ALARM_C"; do has "alarm $a" "$(alarm_status "$a")" '^CANCELED$'; done

  step "cleanup"
  post account/delete '{}' dev | jq -c '{ok,alerts:.deleted.alerts,device:.deleted.device}'
  finish ;;

after)
  new_device
  step "dispatched first, a normal call would forward"
  SESSION_ID=$(post session/start '{"mode":"walk","check_in_interval_s":60,"grace_s":3600}' dev | jq -r .session_id)
  A=$(alert 3 "Relay test, after dispatch"); sleep 1
  H=$(post session/heartbeat "$(jq -n --arg s "$SESSION_ID" '{session_id:$s}')" dev)
  has "heartbeat is about a real session" "$(echo "$H" | jq -r .ok)" '^true$'
  has "heartbeat shows the alert before duress" "$(echo "$H" | jq -r .alert.id)" "^$A$"
  PARENT=$(sid); r=$(call "$DISPATCHER" "$PARENT"); has "before duress it forwards" "$r" '<Dial'
  q="alert=$A&parent=$PARENT"

  step "duress PIN entered after dispatch"
  c=$(cancel "$A" true); has "phone sees a normal cancel" "$c" '^\{"ok":true,"status":"cancelled"\}$'
  duress_assertions "after dispatch"

  step "the call already in flight"
  r=$(tw "twilio/relay/screen?$q" CallSid "$(sid)"); has "screen hangs up" "$r" '<Hangup/>'; hasnt "no prompt" "$r" '<Gather'
  r=$(tw "twilio/relay/accept?$q" CallSid "$(sid)" Digits 1); has "pressing 1 no longer connects" "$r" '<Hangup/>'
  r=$(tw "twilio/relay/dial-done?alert=$A" CallSid "$PARENT" DialCallStatus no-answer); has "dial-done plays the duress message" "$r" "$DURESS_WORDS"

  step "a later normal cancel can't undo it"
  c=$(cancel "$A"); has "same response" "$c" '^\{"ok":true,"status":"cancelled"\}$'
  S=$(share); has "contacts still see it live" "$(echo "$S" | jq -r .status)" '^dispatched$'
  has "share/get says duress" "$(echo "$S" | jq -r .duress)" '^true$'
  has "share/get gives the time" "$(echo "$S" | jq -r .duress_at)" '^20'
  r=$(call "$DISPATCHER"); has "relay is still blocked" "$r" "$DURESS_WORDS"

  step "what the phone can see"
  P=$(post alert/status "$(jq -n --arg a "$A" '{alert_id:$a}')" dev)
  has "status cancelled" "$(echo "$P" | jq -r .status)" '^cancelled$'
  has "no dispatch" "$(echo "$P" | jq -r .dispatch)" '^null$'
  has "ends with a marked_safe" "$(echo "$P" | jq -r '.events[-1].action')" '^marked_safe$'
  hasnt "no dispatch or duress words" "$P" 'dispatch_requested|[Dd]uress|relay'
  E=$(post alert/escalate "$(jq -n --arg a "$A" '{alert_id:$a}')" dev); has "alert/escalate answers like a cancelled alert" "$E" 'no longer active'
  H=$(post session/heartbeat "$(jq -n --arg s "$SESSION_ID" '{session_id:$s}')" dev)
  has "heartbeat on that same session still works" "$(echo "$H" | jq -r .ok)" '^true$'
  hasnt "heartbeat drops the alert after duress" "$H" '"alert"'

  step "contacts"
  set_contacts "$CONTACT"
  r=$(call "$CONTACT"); has "contact calling back gets the same link message" "$r" "$CONTACT_WORDS"; hasnt "and no state" "$r" 'coerced|police'
  r=$(tw "twilio/voice?token=$(cat "$STATE/token")&c=" CallSid "$(sid)"); has "automated call says not to call or text her" "$r" 'Do not call or text'; hasnt "does not say marked safe" "$r" 'marked themselves safe'
  r=$(tw "twilio/gather?token=$(cat "$STATE/token")&c=" CallSid "$(sid)" Digits 1); has "press 1 says not to call or text" "$r" 'do not call or text their phone'
  P=$(curl -sS "$(jq -nr --arg t "$(cat "$STATE/token")" '"https://safetysense-live.vercel.app/a/" + $t')"); has "live page has the duress banner" "$P" 'id="duress-card"'
  set_contacts ""
  echo "leaves device $(cat "$STATE/id") and its duress alert: clean up in SQL"
  finish ;;

before)
  new_device
  step "duress PIN entered before dispatch (level 2 alert, then duress cancel)"
  A=$(alert 2 "Relay test, before dispatch")
  r=$(call "$DISPATCHER"); has "no alarm yet, so nothing to forward" "$r" "$NEUTRAL_WORDS"
  c=$(cancel "$A" true); has "phone sees a normal cancel" "$c" '^\{"ok":true,"status":"cancelled"\}$'; sleep 1
  S=$(share)
  has "a sandbox alarm was created" "$(echo "$S" | jq -r .dispatch.provider)" '^noonlight_sandbox$'
  has "contacts see dispatched" "$(echo "$S" | jq -r .status)" '^dispatched$'
  duress_assertions "before dispatch"
  echo "leaves device $(cat "$STATE/id") and its duress alert: clean up in SQL"
  finish ;;

born)
  new_device
  step "duress PIN with no alert running: reason alone marks it"
  CID=$(python3 -I -c 'import uuid; print(uuid.uuid4())')
  R=$(post alert/create "$(jq -n --arg c "$CID" '{level:2, reason:"Duress PIN entered", trigger:"manual_sos", lat:35.08, lng:-106.62, accuracy:9.4, client_alert_id:$c, dispatch_policy:"contacts_first"}')" dev)
  basename "$(echo "$R" | jq -r .share_url)" > "$STATE/token"
  A=$(echo "$R" | jq -r .alert_id); has "client id honoured" "$A" "^$CID$"; sleep 1
  S=$(share)
  has "marked duress at creation" "$(echo "$S" | jq -r .duress)" '^true$'
  has "went straight to a sandbox alarm, with no duress cancel" "$(echo "$S" | jq -r .dispatch.provider)" '^noonlight_sandbox$'
  duress_assertions "no alert running"
  P=$(post alert/status "$(jq -n --arg a "$A" '{alert_id:$a}')" dev)
  has "phone sees only a cancel" "$(echo "$P" | jq -r '[.events[].action]|join(",")')" '^marked_safe$'
  c=$(cancel "$A" true); has "the new app's duress cancel still works" "$c" '^\{"ok":true,"status":"cancelled"\}$'
  echo "leaves device $(cat "$STATE/id") and its duress alert: clean up in SQL"
  finish ;;

selfcontact)
  # Dry runs only: Twilio is never called, and every number is made up.
  new_device
  FIRST=+15055550161; SECOND=+15055550162
  dry() { post alert/create '{"level":2, "reason":"Self contact test", "trigger":"manual_sos", "dry_run":true, "dispatch_policy":"contacts_first"}' dev; }
  two="$(jq -n --arg a "$FIRST" --arg b "$SECOND" '{contacts:[{name:"First Contact", phone:$a},{name:"Second Contact", phone:$b}]}')"

  step "contacts/set refuses her own number, and keeps the saved list"
  c=$(post contacts/set "$two" dev); has "a normal list saves" "$c" '"ok":true'
  c=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$API/contacts/set" -H 'content-type: application/json' -H "apikey: $KEY" \
    -H "x-device-id: $(cat "$STATE/id")" -H "x-device-secret: $(cat "$STATE/secret")" \
    --data-binary "$(jq -n --arg p "$PHONE" '{contacts:[{name:"Me", phone:$p}]}')"); has "her number: 400" "$c" '^400$'
  c=$(post contacts/set '{"contacts":[{"name":"Me","phone":"(505) 555-0142"}]}' dev); has "written another way: refused too" "$c" 'own number'
  R=$(dry); n=$(echo "$R" | jq -r '[.notified[].name]|unique|join(",")'); has "the saved list survived" "$n" '^First Contact,Second Contact$'
  post alert/cancel "$(jq -n --arg a "$(echo "$R" | jq -r .alert_id)" '{alert_id:$a}')" dev >/dev/null

  step "profile/update can make a saved contact her own number later"
  post profile/update "$(jq -n --arg p "$FIRST" '{name:"Relay Test", phone:$p, campus:"UNM"}')" dev >/dev/null
  R=$(dry); AL=$(echo "$R" | jq -r .alert_id); basename "$(echo "$R" | jq -r .share_url)" > "$STATE/token"
  has "first run skips her" "$(echo "$R" | jq -r '[.notified[].name]|unique|join(",")')" '^Second Contact$'
  has "the next contact gets the sms and the call" "$(echo "$R" | jq -r '[.notified[].channel]|join(",")')" '^sms,call$'
  r=$(call "$FIRST"); has "her phone calling hears neutral words, not contact words" "$r" "$NEUTRAL_WORDS"
  r=$(text "$FIRST"); hasnt "her phone texting gets no reply" "$r" '<Message'
  cancel "$AL" true >/dev/null; sleep 1
  E=$(share | jq -r '[.events[]|select(.action=="text_sent" or .action=="call_placed")|.detail]|join(";")')
  hasnt "duress run skips her too" "$E" 'First Contact'
  has "duress run still warns the others" "$E" 'Text to Second Contact.*Text to Second Contact'

  step "no phone on file: nothing to compare, so the list runs as saved"
  post profile/update '{"name":"Relay Test","campus":"UNM"}' dev >/dev/null
  SID2=$(post session/start '{"mode":"walk","dry_run":true,"check_in_interval_s":60,"grace_s":3600}' dev | jq -r .session_id)
  R=$(post alert/create "$(jq -n --arg s "$SID2" '{session_id:$s, level:2, reason:"Self contact test", trigger:"manual_sos", dry_run:true, dispatch_policy:"contacts_first"}')" dev)
  has "both contacts are on the run" "$(echo "$R" | jq -r '[.notified[].name]|unique|join(",")')" '^First Contact,Second Contact$'

  step "cleanup"
  post account/delete '{}' dev | jq -c '{ok,alerts:.deleted.alerts,device:.deleted.device}'
  finish ;;

scope-setup)
  : "${RELAY_STATE:?set RELAY_STATE to a directory that scope-check can read}"
  new_device; mkdir -p "$STATE/a"; cp "$STATE/id" "$STATE/secret" "$STATE/a/"
  step "a duress alarm on device A"
  A=$(alert 3 "Scope test, duress"); sleep 1
  c=$(cancel "$A" true); has "phone sees a normal cancel" "$c" '"status":"cancelled"'
  PHONE=+15055550143; new_device; mkdir -p "$STATE/b"; cp "$STATE/id" "$STATE/secret" "$STATE/b/"
  step "device B's normal alarm while A's duress is recent: can't tell whose, so never ring"
  B=$(alert 3 "Scope test, other person"); sleep 1
  r=$(call "$DISPATCHER"); has "police message" "$r" "$DURESS_WORDS"; hasnt "no dial" "$r" '<Dial'
  cancel "$B" >/dev/null
  echo "$A" > "$STATE/a/alert"
  printf '\nNow run in SQL, then scope-check:\n  update public.events set created_at = now() - interval %s where alert_id = %s and action = %s;\n' "'2 hours'" "'$A'" "'duress'"
  finish ;;

scope-check)
  : "${RELAY_STATE:?set RELAY_STATE to the scope-setup directory}"
  use() { cp "$STATE/$1/id" "$STATE/$1/secret" "$STATE/"; }
  step "that duress is now 2 hours old: device B forwards again, to B's phone"
  use b; B=$(alert 3 "Scope test, other person later"); sleep 1
  r=$(call "$DISPATCHER"); has "dials B" "$r" '<Number[^>]*>\+15055550143</Number>'
  r=$(tw "twilio/relay/dial-done?alert=$B" CallSid "$(sid)" DialCallStatus no-answer); has "B's no-answer is not treated as duress" "$r" "$NOANSWER_WORDS"
  ALARM_B=$(alarm_of "$B"); cancel "$B" >/dev/null
  step "a new alert on A's own device stays blocked, and is never forwarded"
  use a; C=$(alert 3 "Scope test, same person"); sleep 1
  ALARM_C=$(alarm_of "$C")
  r=$(call "$DISPATCHER"); has "police message" "$r" "$DURESS_WORDS"; hasnt "no dial" "$r" '<Dial|<Number'
  r=$(tw "twilio/relay/screen?alert=$C&parent=$(sid)" CallSid "$(sid)"); has "screen hangs up" "$r" '<Hangup/>'; hasnt "no prompt" "$r" '<Gather'
  r=$(tw "twilio/relay/accept?alert=$C&parent=$(sid)" CallSid "$(sid)" Digits 1); has "accept hangs up" "$r" '<Hangup/>'
  cancel "$C" >/dev/null
  step "only the old duress alarm left: still its message, never a forward"
  r=$(call "$DISPATCHER"); has "police message" "$r" "$DURESS_WORDS"; hasnt "no dial" "$r" '<Dial|<Number'
  step "test alarms"
  for a in "$ALARM_B" "$ALARM_C"; do has "alarm $a" "$(alarm_status "$a")" '^CANCELED$'; done
  echo "leaves devices $(cat "$STATE/a/id") and $(cat "$STATE/b/id") and the duress alert: clean up in SQL"
  finish ;;

twin-setup)
  : "${RELAY_STATE:?set RELAY_STATE to a directory that twin-check can read}"
  new_device; mkdir -p "$STATE/a"; cp "$STATE/id" "$STATE/secret" "$STATE/a/"
  step "duress on device A, then she's forced to delete the account"
  A=$(alert 3 "Twin test, duress"); sleep 1
  c=$(cancel "$A" true); has "phone sees a normal cancel" "$c" '"status":"cancelled"'
  c=$(post account/delete '{}' dev); has "delete looks normal" "$c" '"ok":true'
  c=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$API/alert/status" -H 'content-type: application/json' -H "apikey: $KEY" \
    -H "x-device-id: $(cat "$STATE/id")" -H "x-device-secret: $(cat "$STATE/secret")" --data-binary "$(jq -n --arg a "$A" '{alert_id:$a}')")
  has "old credentials are dead" "$c" '^401$'
  step "she signs up again with the same number, while the duress is recent"
  new_device; mkdir -p "$STATE/b"; cp "$STATE/id" "$STATE/secret" "$STATE/b/"
  B=$(alert 3 "Twin test, new device"); sleep 1
  ALARM_B=$(alarm_of "$B")
  r=$(call "$DISPATCHER"); has "police message" "$r" "$DURESS_WORDS"; hasnt "no dial" "$r" '<Dial|<Number'
  cancel "$B" >/dev/null
  has "alarm $ALARM_B" "$(alarm_status "$ALARM_B")" '^CANCELED$'
  echo "$A" > "$STATE/a/alert"
  printf '\nNow run in SQL, then twin-check:\n  update public.events set created_at = now() - interval %s where alert_id = %s and action = %s;\n' "'2 hours'" "'$A'" "'duress'"
  finish ;;

twin-check)
  : "${RELAY_STATE:?set RELAY_STATE to the twin-setup directory}"
  use() { cp "$STATE/$1/id" "$STATE/$1/secret" "$STATE/"; }
  use b
  step "the duress is now 2 hours old, past the 1 hour block, and a new alarm is on the new device"
  B=$(alert 3 "Twin test, later alarm"); sleep 1
  ALARM_B=$(alarm_of "$B")
  r=$(call "$DISPATCHER"); has "police message" "$r" "$DURESS_WORDS"; hasnt "her number is never dialled" "$r" '<Dial|<Number'
  P=$(sid); q="alert=$B&parent=$P"
  r=$(tw "twilio/relay/screen?$q" CallSid "$(sid)"); has "screen hangs up" "$r" '<Hangup/>'; hasnt "no prompt" "$r" '<Gather'
  r=$(tw "twilio/relay/accept?$q" CallSid "$(sid)" Digits 1); has "accept hangs up" "$r" '<Hangup/>'
  r=$(tw "twilio/relay/dial-done?alert=$B" CallSid "$P" DialCallStatus no-answer); has "dial-done plays the duress message" "$r" "$DURESS_WORDS"
  step "control: the block follows the number, so a different number on that device forwards"
  post profile/update "$(jq -n '{name:"Relay Test", phone:"+15055550144", campus:"UNM"}')" dev >/dev/null
  r=$(call "$DISPATCHER"); has "dials the different number" "$r" '<Number[^>]*>\+15055550144</Number>'
  cancel "$B" >/dev/null
  has "alarm $ALARM_B" "$(alarm_status "$ALARM_B")" '^CANCELED$'
  echo "leaves devices $(cat "$STATE/a/id") and $(cat "$STATE/b/id") and the duress alert: clean up in SQL"
  finish ;;

*) echo "unknown stage: $STAGE"; exit 2 ;;
esac
