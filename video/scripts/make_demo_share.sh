#!/bin/bash
# Creates a DRY-RUN alert on the live backend (no calls/SMS are placed for dry_run alerts)
# so the contact's live-link page can be recorded for the demo video. Prints the share URL.
set -euo pipefail
API="https://uvunyysuyuonhoviszmc.supabase.co/functions/v1/api"
KEY="sb_publishable__JyRQ8x_BXI2FWlRsgUULA__5tdSYuh"
post() { curl -sS -X POST "$API/$1" -H "content-type: application/json" -H "apikey: $KEY" ${DID:+-H "x-device-id: $DID"} ${DSEC:+-H "x-device-secret: $DSEC"} -d "$2"; }
REG=$(post register '{"name":"Alex Rivera","phone":"+15055550100","campus":"unm"}')
DID=$(echo "$REG" | python3 -c 'import json,sys;print(json.load(sys.stdin)["device_id"])')
DSEC=$(echo "$REG" | python3 -c 'import json,sys;print(json.load(sys.stdin)["device_secret"])')
post contacts/set '{"contacts":[{"name":"Maya Chen","phone":"+15055550111"},{"name":"Jordan Lee","phone":"+15055550122"},{"name":"Sam Rivera","phone":"+15055550133"}]}' >/dev/null
SID=$(post session/start '{"mode":"night_out","check_in_interval_s":1800,"dry_run":true,"dispatch_policy":"contacts_first","sealed_details":"Night Out at a house party near Central & Girard. With: Riley (friend). Leaving by 1 AM."}' | python3 -c 'import json,sys;print(json.load(sys.stdin)["session_id"])')
post session/heartbeat "{\"session_id\":\"$SID\",\"lat\":35.0812,\"lng\":-106.6215,\"accuracy\":12,\"battery\":0.64}" >/dev/null
AL=$(post alert/create "{\"session_id\":\"$SID\",\"level\":2,\"reason\":\"Distress words, impact, then stillness\",\"trigger\":\"risk_engine\",\"lat\":35.0812,\"lng\":-106.6215,\"accuracy\":12,\"battery\":0.64,\"dry_run\":true,\"dispatch_policy\":\"contacts_first\"}")
echo "$AL" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["share_url"]);print(d["notified"])'
