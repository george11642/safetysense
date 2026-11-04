# SafetySense backend

Server side of SafetySense ("Calls for help when you can't"). It holds device registrations, trusted contacts, Guard sessions and alerts. It calls contacts through Twilio, asks Noonlight (sandbox) to dispatch, and serves the contact live-link page. SafetySense supplements 911; it never replaces it.

| Piece | Where |
|---|---|
| Postgres + Vault + pg_cron + pg_net | Supabase project `uvunyysuyuonhoviszmc` |
| API (one edge function, `api`) | `https://uvunyysuyuonhoviszmc.supabase.co/functions/v1/api/<route>` |
| Contact live-link page | `https://safetysense-live.vercel.app/a/<token>` (source: `web/`) |
| Landing page | `https://safetysense-live.vercel.app/` |

Source layout:

- `supabase/migrations/20261104000001_safetysense_schema.sql`: tables, RLS, Vault helper functions, generated secrets, the private `evidence` bucket
- `supabase/migrations/20261104000002_watchdog_cron.sql`: pg_cron watchdog (every minute)
- `supabase/migrations/20261104000003_privacy_retention.sql`: account deletion, SMS delivery columns on `events`, `register_hits` rate-limit table, `ss_evidence_objects()` helper, hourly `safetysense-retention` job → `api/cron/retention`
- `supabase/functions/api/index.ts`: the whole API
- `scripts/smoke.sh`: dry-run end-to-end test (no calls or texts); deletes its own test device at the end
- `scripts/privacy_test.sh`: tests for account/delete, cron/retention auth, SMS status callbacks, deferred deletion and the register rate limit
- `../web/`: static live-link page (`a.html`), landing page (`index.html`), `vercel.json` (rewrites `/a/:token` to `a.html`)

## Architecture

```
iPhone app ──POST json──▶ edge function "api" ──service role──▶ Postgres (RLS on, no policies)
                              │   │                                 ▲
                              │   └─ ss_get_secret() ─▶ Vault ──────┘
                              ├──▶ Twilio (SMS + voice call per contact)
                              │       └─ Twilio fetches twilio/voice, posts twilio/gather + twilio/status
                              └──▶ Noonlight sandbox /dispatch/v1/alarms (or "simulated")
pg_cron (every minute) ──pg_net──▶ api/cron/watchdog   (x-cron-secret read from Vault at run time)
pg_cron (hourly, :17)  ──pg_net──▶ api/cron/retention  (same secret; deletes Storage objects + rows)
Twilio ──▶ api/twilio/sms-status (StatusCallback on every text: delivered / undelivered + error code)
Contact's browser ──▶ safetysense-live.vercel.app/a/<token> ──▶ api/share/get + api/share/action
```

**Security model**

- Every table has RLS enabled and no policies, and `anon`/`authenticated` have no grants. Only the service role inside the edge function touches data. The publishable key is public and grants nothing by itself.
- The function is deployed with `verify_jwt = false` and does its own auth:
  - **Device routes** need `x-device-id` + `x-device-secret`. The server stores only `sha256(secret)` and compares in constant time. The secret is returned once by `register`.
  - **Share routes** are scoped by a 32-char URL-safe random token per alert (24 random bytes). Links stop working 2 h after an alert is cancelled, and 48 h after it started.
  - **Twilio webhooks** check `X-Twilio-Signature` (HMAC-SHA1 with the auth token over the public URL + sorted POST params).
  - **`cron/watchdog`** and **`cron/retention`** need `x-cron-secret` (generated inside Postgres, never printed).
  - **`admin/*`** needs `x-setup-key`. Only its SHA-256 is stored (Vault `safetysense_setup_key_sha256`). `admin/setup` also requires `app_flags.setup_open = true`, which is now `false`.
- Secrets live in Supabase Vault, named `safetysense_<name>`: `twilio_sid`, `twilio_token`, `twilio_from`, `noonlight_token`, `cron_secret`, `sealed_key`, `setup_key_sha256`. The function reads them through `public.ss_get_secret(name)`, a `SECURITY DEFINER` function executable only by `service_role` (`ss_set_secret` likewise).
- **Sealed date details** are encrypted with AES-256-GCM using the Vault `sealed_key` before they are stored (`sessions.sealed_details` = `v1:<iv>:<ciphertext>`). `share/get` decrypts them only while the alert is `active` or `dispatched`.
- **Abuse limits:** US numbers only, at most 5 contacts, and at most 6 live (non-dry-run) alerts per device per hour. One live alert per session; a repeat `alert/create` re-uses it, and level 3 upgrades it.
- **Register rate limit** (there is no App Attest yet): 5 sign-ups per network per hour, 20 per day, 200 per hour overall (`app_flags` `register_per_ip_hour`, `register_per_ip_day`, `register_global_hour`). The server stores only `sha256("register|<ip>|<cron secret>")` in `register_hits`, never the IP, and deletes hits after 1 day. Over the limit: 429 "Too many sign-ups from this network right now…".
- **Privacy:** Evidence is stored as client-side ciphertext in the private `evidence` Storage bucket; the server never sees plaintext. The share page shows no location once an alert is cancelled.
- **Account deletion** (`account/delete`): deletes the device's contacts, sessions, alerts, locations, events, evidence rows **and** its evidence objects in Storage (removed with the service role through the Storage API, because SQL can't delete Storage objects), then returns the counts. The device secret stops working at once. If a non-test alert is still live (`active`/`dispatched`, under 48 h old), the rows are kept until it ends so contacts don't lose the live link mid-emergency, and the hourly retention job then finishes the deletion. This also covers a duress cancel: the phone was told "cancelled", so the response is the same in both cases and doesn't reveal the silent escalation.
- **Retention** (`cron/retention`, hourly via pg_cron + pg_net):

  | Data | Kept for |
  |---|---|
  | Evidence rows **and** Storage objects | 30 days |
  | Locations | 30 days |
  | Alerts and their events (and locations, by cascade) | 90 days |
  | Test (dry-run) alerts | 48 h (the share-link lifetime) |
  | Ended sessions | 90 days |
  | Sealed date details | Cleared 48 h after the session started (no share link can show them after that) |
  | Storage objects with no evidence row | Removed once older than 1 day, or at once if their device no longer exists |
  | `register_hits` | 1 day |
  | Accounts whose deletion waited for a live alert | Deleted on the first run after the alert ends |

## Escalation behaviour

- `alert/create` level 2: logs the alert, then for each contact sends an SMS (with the share URL) and places a voice call (`Url = api/twilio/voice?token=…&c=<contact>`). Each attempt's Twilio status is returned in `notified` and logged as an event. With `dry_run: true` (or a session started with `dry_run: true`), Twilio is never called and the status is `"dry_run"`.
- Level 3, `dispatch_policy: "dispatch_immediately"`, a contact's "Send help now" (web or press 9 on the call), `alert/escalate`, or 90 s at level 2 with no cancel (watchdog) all lead to escalation:
  - With a Noonlight token and a non-dry-run alert: `POST https://api-sandbox.noonlight.com/dispatch/v1/alarms` `{name, phone (11 digits), pin, location:{coordinates:{lat,lng,accuracy}}}`. Later `alert/location` and in-alert heartbeats are pushed to `/alarms/{id}/locations`. A normal cancel posts `CANCELED` to `/alarms/{id}/status`.
  - Otherwise the provider is `"simulated"`, labelled everywhere as "SIMULATED for the demo; no responders were sent".
- **Duress cancel** (`alert/cancel {duress:true}`) returns exactly `{ok:true,status:"cancelled"}`, but the server marks `duress`, escalates, and keeps the alert live for contacts. `alert/status` on the phone then reports `cancelled` with `dispatch:null` and hides the dispatch events.
- **Text delivery receipts:** every SMS is sent with `StatusCallback = api/twilio/sms-status?token=…&c=<contact>`. The callback is signature-checked and matched to the `text_sent` event by `MessageSid`, which records `delivery_status` (`queued`/`sent`/`delivered`/`undelivered`/`failed`) and `error_code`. A late `sent` never overwrites a final status. Undelivered texts read `Text to <name>: not delivered (error 30034)` in `detail`. A synchronous Twilio rejection is recorded the same way (`failed` + code).
- **Watchdog** (`cron/watchdog`, every minute): any `active` session whose `last_heartbeat_at` is older than its `grace_s` gets a level-2 `heartbeat_lost` alert using the last known location, and contacts are notified. It then escalates level-2 alerts older than 90 s that have no dispatch.

## Routes

All routes are `POST` with a JSON body and return JSON. Errors look like `{error}` with a 4xx/5xx status. Send `content-type: application/json` and `apikey: <publishable key>`. Device routes also need `x-device-id` and `x-device-secret`.

| Route | Auth | Body → Response |
|---|---|---|
| `register` | none | `{name, phone?, campus?}` → `{device_id, device_secret}` |
| `contacts/set` | device | `{contacts:[{name, phone}]}` (≤5, replaces all) → `{ok}` |
| `session/start` | device | `{mode, check_in_interval_s, grace_s?, sealed_details?, dispatch_policy?, dry_run?}` → `{session_id}` (ends any other active session) |
| `session/heartbeat` | device | `{session_id, lat?, lng?, accuracy?, battery? (0–1)}` → `{ok, server_time}` |
| `session/end` | device | `{session_id}` → `{ok}` |
| `alert/create` | device | `{session_id?, level:2\|3, reason, trigger, lat?, lng?, accuracy?, battery?, dry_run?, dispatch_policy}` → `{alert_id, share_url, notified:[{name, channel, status}]}` |
| `alert/escalate` | device | `{alert_id, reason}` → `{dispatch:{provider, alarm_id, status}}` |
| `alert/cancel` | device | `{alert_id, duress}` → `{ok, status:"cancelled"}` |
| `alert/location` | device | `{alert_id, lat, lng, accuracy, battery}` → `{ok}` |
| `alert/status` | device | `{alert_id}` → `{status, level, dispatch, events:[{who, action, detail, at, delivery_status, error_code}]}` (no `detail` after a duress cancel) |
| `evidence/upload` | device | `{alert_id, seq, sha256, ciphertext_b64}` (≤ ~6 MB) → `{ok}` |
| `account/delete` | device | `{}` → `{ok, deleted:{contacts, sessions, alerts, locations, events, evidence_rows, evidence_objects, device}}`; the credentials stop working |
| `share/get` | token | `{token}` → `{first_name, status, level, reason, started_at, dry_run, dispatch, location, battery, events, sealed_details}` (events carry `delivery_status`, `error_code`) |
| `share/action` | token | `{token, action:"on_my_way"\|"called_911"\|"send_help", responder_name}` → `{ok}` |
| `twilio/voice`, `twilio/gather`, `twilio/status`, `twilio/sms-status` | Twilio signature | TwiML / 204 |
| `cron/watchdog` | `x-cron-secret` | `{}` → `{ok, heartbeat_lost, escalated}` |
| `cron/retention` | `x-cron-secret` | `{}` → `{ok, evidence_rows, evidence_objects, orphan_objects, alerts, test_alerts, events, locations, sessions, sealed_cleared, devices_deleted, register_hits}` |
| `admin/setup` | `x-setup-key` + `setup_open` | `{twilio_sid, twilio_token, twilio_from, noonlight_token?, share_base?, close?}` → `{ok, stored}` |
| `admin/selftest` | `x-setup-key` | `{}` → Twilio account fetch status, Noonlight configured or not, flags. Places no calls. |

The extra optional fields (`session/start.dry_run`, `session/start.dispatch_policy`, `share/get.dry_run`, `share/get.dispatch`, the event fields `detail`/`delivery_status`/`error_code`) and `account/delete` are additions to the original contract. Clients that ignore unknown keys are unaffected.

## Environment

The function uses only the Supabase-provided `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Everything else is in Vault. Local secrets live in `~/.config/global.env` (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `NOONLIGHT_SANDBOX_TOKEN`, `SAFETYSENSE_GEORGE_PHONE`, `SAFETYSENSE_MARY_PHONE`). The admin setup key is in the session scratchpad file `setup_key`; regenerate it if you lose it (see below).

Twilio is on a **trial** account. Trial calls start with Twilio's own "press any key" message, and SafetySense's message and the 1/9 menu only play after the person picks up and presses a key. US SMS fails with error 30034 (unregistered A2P 10DLC), and the failure is recorded, not fatal. Voice calls work only to verified numbers. **Mary's number is not verified yet**, so calls to her fail with a Twilio error until George verifies her in the Twilio console.

## Deploying

- Function: deploy `supabase/functions/api/index.ts` as `api` with `verify_jwt=false`. The Supabase MCP `deploy_edge_function` works. The CLI also works once authenticated: `supabase functions deploy api --project-ref uvunyysuyuonhoviszmc --no-verify-jwt`.
- Web: `cd web && vercel deploy --prod` (project `safetysense-live`).
- The publishable key and API base are hard-coded in `web/a.html`. Change them there if the project changes.

## Rotating secrets

Never paste secret values into chat, logs, or SQL that gets echoed. Read them from env inside the command.

1. **New setup key:**
   ```sh
   umask 077; openssl rand -hex 32 | tr -d '\n' > setup_key
   printf %s "$(cat setup_key)" | shasum -a 256   # hash only
   ```
   Then in SQL: `select public.ss_set_secret('setup_key_sha256', '<that hash>');`
2. **Re-open setup:** `update public.app_flags set value='true' where key='setup_open';`
3. **Push new Twilio/Noonlight values** from env:
   ```sh
   set -a; source ~/.config/global.env; set +a
   jq -n '{twilio_sid:env.TWILIO_ACCOUNT_SID, twilio_token:env.TWILIO_AUTH_TOKEN, twilio_from:env.TWILIO_FROM_NUMBER, noonlight_token:env.NOONLIGHT_SANDBOX_TOKEN, close:true}' \
     | curl -s -X POST "$API/admin/setup" -H 'content-type: application/json' -H "x-setup-key: $(cat setup_key)" --data-binary @-
   ```
   `close:true` sets `setup_open=false` again.
4. **Check:** `curl -s -X POST "$API/admin/selftest" -H "x-setup-key: $(cat setup_key)" -d '{}'` should report `twilio_account_fetch: 200`.
5. **Cron secret or sealed key:**
   ```sql
   select public.ss_set_secret('cron_secret', encode(extensions.gen_random_bytes(32),'hex'));
   ```
   The cron job reads it from Vault on every run. Rotating `sealed_key` makes existing sealed details unreadable, which is fine because sessions are short-lived.
6. Secret values are cached in the function for up to 60 s.
7. **Device secrets:** a device re-registers to get a new one. To revoke a device and erase its data, call `account/delete` with its credentials. `delete from devices where id=…` also cascades every row, but it leaves the Storage objects; the hourly orphan sweep removes those.

## Testing

- `backend/scripts/smoke.sh` runs the whole flow with `dry_run`, so Twilio is never called: register → contacts → session → heartbeat → alert → location → evidence → share page → share action → duress cancel → status checks → a stale session for the watchdog → `account/delete` (removes everything, including the evidence object) → checks that the old credentials and share link are dead. `KEEP=1` skips the delete so the watchdog can pick up the stale session. Responses are printed with secrets and phone numbers redacted.
- `backend/scripts/privacy_test.sh` (no calls, texts or dispatch):
  - default: the cron routes refuse callers without the secret, `twilio/sms-status` refuses unsigned or badly signed callbacks, and `account/delete` removes 2 evidence objects, their rows, the alert, locations, events and contacts, after which the credentials and share link are dead.
  - `RATE=1`: also checks for the 429. This uses up this IP's hourly quota; clear it with `delete from public.register_hits;`.
  - `sms-setup` / `sms-finish <MessageSid> <state>`: Twilio-signed callbacks (signed locally with `TWILIO_AUTH_TOKEN`; Twilio itself isn't contacted) for sent → undelivered 30034 → a late sent, then checks that `alert/status` and `share/get` both show `undelivered` / `30034`. Dry runs never get a real MessageSid, so tag the `text_sent` event in SQL between the two steps (the script prints how).
  - `deferred`: a live alert with **no contacts** (so nobody is called), then `account/delete`. The credentials die at once and the share link still works. Then cancel the alert in SQL (within 90 s, before the watchdog escalates) and run `cron/retention`; it reports `devices_deleted: 1`.
- To run retention or the watchdog by hand without seeing the secret: `select net.http_post(url := '<API>/cron/retention', headers := jsonb_build_object('content-type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='safetysense_cron_secret')), body := '{}'::jsonb);` then read `net._http_response`.

Last run 2026-11-04: smoke passes; privacy_test 18/18, sms 8/8, deferred 4/4 (retention then deleted the deferred device). Test data cleared the same day: all dry-run alerts, both "Alex Rivera" demo devices, the 64-byte orphan object in `evidence` (the bucket is now empty), and `register_hits`. The "Alex" device (the simulator's registration) and its contacts and sessions were kept so the simulator keeps working.
