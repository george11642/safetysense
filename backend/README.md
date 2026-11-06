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
- `scripts/relay_test.sh`: relay-line and duress tests using signed, simulated Twilio webhooks and the Noonlight sandbox
- `scripts/relay_takeback_test.ts`: local test of taking a forwarded call back, against scripted Twilio answers; nothing leaves the machine
- `scripts/privacy_test.sh`: tests for account/delete, cron/retention auth, SMS status callbacks, deferred deletion and the register rate limit
- `../web/`: static live-link page (`a.html`), landing page (`index.html`), `relay-failsafe.xml` (static TwiML Twilio plays if it can't reach the function), `vercel.json` (rewrites `/a/:token` to `a.html`)

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
Monitoring center ──▶ relay number (Twilio) ──▶ api/twilio/relay/voice, api/twilio/relay/sms
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
  | Locations, and the last location and battery on a session row | 30 days |
  | Sessions the phone never closed (`active` or `alerted`) | 90 days after the last heartbeat |
  | Alerts and their events (and locations, by cascade) | 90 days |
  | Test (dry-run) alerts | 48 h (the share-link lifetime) |
  | Ended sessions | 90 days |
  | Sealed date details | Cleared 48 h after the session started (no share link can show them after that) |
  | Storage objects with no evidence row | Removed once older than 1 day, or at once if their device no longer exists |
  | `register_hits` | 1 day |
  | Accounts whose deletion waited for a live alert | Deleted on the first run after the alert ends |

## Escalation behaviour

- `alert/create` level 2: logs the alert, then sends each contact an SMS (with the share URL) and places a voice call to the first contact only (`Url = api/twilio/voice?token=…&c=<contact>`). Each attempt's Twilio status is returned in `notified` and logged as an event. With `dry_run: true` (or a session started with `dry_run: true`), Twilio is never called and the status is `"dry_run"`.
- Level 3, `dispatch_policy: "dispatch_immediately"`, a contact's "Send help now" (web or press 9 on the call), `alert/escalate`, or 90 s at level 2 with no cancel (watchdog) all lead to escalation:
  - With a Noonlight token and a non-dry-run alert: `POST https://api-sandbox.noonlight.com/dispatch/v1/alarms` `{name, phone, pin, location:{coordinates:{lat,lng,accuracy}}}`, plus `instructions.entry` with a duress note on an alarm that is already duress. `phone` is always the relay number (11 digits), never hers: `escalate()` doesn't read `devices.phone`. Later `alert/location` and in-alert heartbeats are pushed to `/alarms/{id}/locations`. A normal cancel posts `CANCELED` to `/alarms/{id}/status`.
  - Otherwise the provider is `"simulated"`, labelled everywhere as "SIMULATED for the demo; no responders were sent". This happens only with no Noonlight token or on a dry run.
  - A failed Noonlight request, or a missing relay number, is not a dispatch: the alert stays `active` with no provider, the timeline says monitoring couldn't be reached yet, and the watchdog retries every minute. It never falls back to her real number.
- **Duress cancel** (`alert/cancel {duress:true}`) returns exactly `{ok:true,status:"cancelled"}`, but the server marks `duress`, escalates, and keeps the alert live for contacts. `alert/status` on the phone then reports `cancelled` with `dispatch:null` and shows only what a normal cancel would. Duress is one-way: a later normal cancel changes nothing. The first duress also tells contacts again not to call or text her (first contact by voice, everyone by SMS), takes back any forwarded call in progress, and adds a note to the alarm's person record (`additional_info`). An `alert/create` whose reason starts `Duress PIN entered` is treated as duress from the start, which covers installed builds that never follow it with a duress cancel.
- **Text delivery receipts:** every SMS is sent with `StatusCallback = api/twilio/sms-status?token=…&c=<contact>`. The callback is signature-checked and matched to the `text_sent` event by `MessageSid`, which records `delivery_status` (`queued`/`sent`/`delivered`/`undelivered`/`failed`) and `error_code`. A late `sent` never overwrites a final status. Undelivered texts read `Text to <name>: not delivered (error 30034)` in `detail`. A synchronous Twilio rejection is recorded the same way (`failed` + code).
- **`session/end` after a dead zone:** it also closes any live non-duress `heartbeat_lost` alert on that session. The phone has stopped sending heartbeats, so it can never see that alert or cancel it.
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
| `share/get` | token | The phone's `-p` link reads as cancelled on a duress alert. `{token}` → `{first_name, status, level, reason, started_at, dry_run, duress, duress_at, mode, dispatch, location, battery, events, sealed_details}` (events carry `delivery_status`, `error_code`) |
| `share/action` | token | `{token, action:"on_my_way"\|"called_911"\|"send_help", responder_name}` → `{ok}` |
| `twilio/voice`, `twilio/gather`, `twilio/status`, `twilio/sms-status` | Twilio signature | TwiML / 204 |
| `twilio/relay/voice`, `/screen`, `/accept`, `/dial-done`, `/sms` | Twilio signature | TwiML. A bad signature gets 403; any other failure gets the fail-safe TwiML |
| `cron/watchdog` | `x-cron-secret` | `{}` → `{ok, heartbeat_lost, escalated}` |
| `cron/retention` | `x-cron-secret` | `{}` → `{ok, evidence_rows, evidence_objects, orphan_objects, alerts, test_alerts, events, locations, session_locations_cleared, sessions, stale_sessions, sealed_cleared, devices_deleted, register_hits}` |
| `admin/setup` | `x-setup-key` + `setup_open` | `{twilio_sid, twilio_token, twilio_from, noonlight_token?, share_base?, close?}` → `{ok, stored}` |
| `admin/selftest` | `x-setup-key` | `{}` → Twilio account fetch status, Noonlight configured or not, flags. Places no calls. |

The extra optional fields (`session/start.dry_run`, `session/start.dispatch_policy`, `share/get.dry_run`, `share/get.dispatch`, the event fields `detail`/`delivery_status`/`error_code`) and `account/delete` are additions to the original contract. Clients that ignore unknown keys are unaffected.

## Environment

The function uses only the Supabase-provided `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Everything else is in Vault. Local secrets live in `~/.config/global.env` (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `NOONLIGHT_SANDBOX_TOKEN`, `SAFETYSENSE_GEORGE_PHONE`, `SAFETYSENSE_MARY_PHONE`). The admin setup key is in the session scratchpad file `setup_key`; regenerate it if you lose it (see below).

The Twilio number's inbound webhooks point at the relay: voice `api/twilio/relay/voice`, SMS `api/twilio/relay/sms` (both POST), voice fallback `https://safetysense-live.vercel.app/relay-failsafe.xml` (**GET**: Vercel answers POST with 405). Before 2026-11-06 they were Twilio's demo URLs, `https://demo.twilio.com/welcome/voice/` and `https://demo.twilio.com/welcome/sms/reply/` (POST, no fallback).

Twilio is on a **trial** account. Trial calls start with Twilio's own "press any key" message, and SafetySense's message and the 1/9 menu only play after the person picks up and presses a key. US SMS fails with error 30034 (unregistered A2P 10DLC), and the failure is recorded, not fatal. After the daily limit is hit, messages can show 63038 instead until it resets. Voice calls work only to verified numbers. **Mary's number is not verified yet**, so calls to her fail with a Twilio error until George verifies her in the Twilio console.

## Deploying

- Function: deploy `supabase/functions/api/index.ts` as `api` with `verify_jwt=false`. The Supabase MCP `deploy_edge_function` works. The CLI also works once authenticated: `supabase functions deploy api --project-ref uvunyysuyuonhoviszmc --no-verify-jwt`.
- **After every deploy, read the function back and compare its sha256 and line count with the local file, then check that an unsigned POST to `twilio/relay/voice` returns 403 at once.** The MCP tool takes the whole file inline and accepts a cut-off file without complaint. On 2026-11-06 versions 6 to 10 were all cut off this way (the last stopped at line 68, before any route), and the API was down from 07:51 to 08:10 UTC. Workers booted and then hung, so `status: ACTIVE` proves nothing. Version 11 fixed it.
- Web: `cd web && vercel deploy --prod` (project `safetysense-live`).
- The publishable key and API base are hard-coded in `web/a.html`. Change them there if the project changes.

## Relay line and the duress callback gap

**The problem:** after a duress PIN, the monitoring center could call or text her phone in front of the person forcing her. Noonlight's API has no duress or no-callback field.

**What's built:** Noonlight gets the Twilio relay number instead of hers, so what happens to a callback is decided by our server when the call arrives, rather than by a note someone has to read.

| Who calls or texts the relay | What happens |
|---|---|
| Call, one active alarm, no duress | `<Dial>` to her phone, screened: she must press 1. No `callerId`, so her phone never shows the relay number |
| Call, duress at call time, in either order | Never rings her. Plays the message: person may be coerced, do not call or text them, send police to the location being shared |
| Call forwarded, no answer, busy, failed, or voicemail | "The person did not answer", send police. Voicemail can't press 1, so it counts as no answer. The press-1 prompt doesn't name the app, because a voicemail can record it |
| Call forwarded, she cancels with her real PIN while it rings | "The person cancelled this alarm with their PIN" |
| Duress lands while a forwarded call is ringing or connected | The call is taken back through the Twilio API and the caller hears the duress message. Screen and accept also re-check |
| Two or more alarms could match | Never rings. Same message as duress, since the line can't tell whose alarm it is. A duress alarm stops counting here 1 hour after the duress PIN, so another person's alarm can then forward to that person |
| A new alarm on her number, after a duress alarm on that number | Never rings for 48 h from the duress alarm, on any device with the same number. This covers being forced to delete the account and sign up again. The match uses the number on file at call time |
| No active alarm | Neutral message |
| Her own phone calls in | Neutral message whenever the lookups work |
| A trusted contact calls back | Link message whenever the lookups work. Never connected to her |
| Any text | Logged with `internal=true` (length only, no body) and never forwarded. Contacts and others get a fixed reply; her own phone gets none |
| A relay lookup fails | Treated as duress, before the caller has been identified: never rings, and tells every caller to send police |
| Twilio can't reach the function | `relay-failsafe.xml` plays the same police message to every caller, even with no alarm active |

"Active alarm" means `dispatch_provider = noonlight_sandbox`, not a dry run, under 48 h old, and `active`, `dispatched` or duress.

**The fail-safe tradeoff:** the last two rows can't tell who is calling. Her own phone, a contact, or a stranger would hear "may be coerced, send police", with no alarm running at all. We accept that because the alternative is ringing her when the state is unknown. Forwarded calls don't show the relay number on her phone, which limits how often she'd call it. A normal alarm also gets the police message during such a failure and never reaches her. On 2026-11-06, while the function was down, this was the behaviour for any call. Texts have no fallback (`sms_fallback_url` is unset), so during an outage a text gets no reply.

**Contacts during duress:** the server's texts and the automated call say not to call or text her, and the live page shows a "Do not call or text" banner. Even a non-duress alert asks contacts to use the link, because any alert can turn out to be coerced. **Not all of that arrives on this account.** Texts fail with error 30034, so only the first contact gets the warning, by voice, and only if the number is verified on the trial. Contacts 2 to 5 get no alert at all, and what they hold is the app's intro text. `ContactMessaging.swift:19` still tells them "try calling me", which contradicts every server message until the app changes it.

**Limits. This is a prototype of the relay design, and the gap is not closed:**

- **No real dispatcher call has happened.** Every relay voice test is a signed, simulated webhook. Twilio's log shows 0 inbound calls, so Twilio has never executed the voice TwiML on a real call. Forwarding, the press-1 screen, voicemail and the mid-call takeover are untested on a live call.
- **Real sandbox texts do reach the relay.** Noonlight's sandbox texts the alarm number when an alarm starts and again on cancel. Those texts passed real Twilio signature validation, were logged with `relay_sms` (length only) and were not forwarded. Twilio's log on 2026-11-06 held 88 inbound texts from the sandbox and 88 relay replies to that sandbox number, none delivered. No reply went to a person.
- **Noonlight hasn't confirmed a relay number is allowed.** Its docs don't say whether the alarm phone must belong to the user, and its quick-start lists a "verified phone number" for the individual. Sandbox acceptance says nothing about production.
- **Noonlight has no way to read the stored number back.** That it gets the relay is true by construction (`escalate()` never reads `devices.phone`), not confirmed from their side.
- **Nothing guarantees a dispatcher listens or complies.** The spoken message, `instructions.entry` and `additional_info` are all things a person may or may not act on. The sandbox accepted the `additional_info` PUT (200); the docs don't say dispatchers see it. `instructions.entry` is documented for access details such as gate codes.
- **One shared number.** A real service needs one relay number per active alarm. Here, two alarms at once means no call is forwarded, unless one is a duress alarm more than 1 hour old, and then the other person's alarm forwards. An unrelated caller during a live alarm is treated as the dispatcher.
- **Texts never reach her, in any state.** Noonlight's first contact is a text, as seen in the sandbox, so this is real behaviour on a normal alarm too. Our auto-replies failed with 21608 (unverified number, 52) and 63038 (daily message limit, 36), never 30034. The dispatcher's text goes unanswered, and nobody has confirmed what Noonlight does then. The in-app PIN still cancels. `twilio/relay/sms` has no reply throttle, so if replies start delivering it could loop with Noonlight's bot; that's untested. `relay_sms` rows attach to the newest candidate alert, so a text about another alarm can land on the wrong one.
- **Twilio trial.** Inbound callers hear a preamble and must press a key before the webhook runs, so a real dispatcher call wouldn't behave like production. Forwarding reaches verified numbers only; anything else ends as no answer.
- **Duress the server hasn't heard yet can't be seen.** If she's offline, or a call lands in the moment before duress arrives, the call can ring her.
- **A forward started before duress can leave a trace.** Taking the call back stops the ring, but a missed-call alert or a voicemail notice can still appear on her phone afterward, in front of the attacker. A voicemail would hold the "Press 1" prompt. Carrier behaviour is untested and can't be tested without a real call.
- **The same-number check depends on the number on file.** A device with no phone on file can't be matched, and neither can a number changed after the duress PIN. Forwarding rings only the number now on file, so a changed number would ring that new number.
- **No system can stop a direct dial.** A contact who already has her number can still call her. The messages ask them not to.
- **The duress message plays to any unknown caller** while a duress alarm is active. It carries no name or location.
- **The phone's live link hides duress, and that has a cost.** The `share_url` given to the phone is the contacts' link plus `-p`. Once duress is set, `share/get` answers that link like a normal cancel (`a.html` then says "marked themselves safe"), and `share/action` refuses it. So someone she shared it with by hand reads that she's safe and is invited to check in with her. Listed contacts get the plain link and the real page. A listed contact's own link on the held phone (her own number on her list) still shows duress. The app also stops offering "Share link" for 48 hours after a duress PIN. **Written and tested with stubs only; not deployed.**
- **A contact notice can reach the attacker.** The first duress texts every contact and calls the first one, and a real-PIN cancel sends no such notice. If the person in the room is a listed contact, his phone rings seconds after her "cancel". Not fixed, and needs George's decision.
- **A duress cancel re-raises a cancelled alert.** `session/end` can close a watchdog alert before a held-up duress cancel arrives, and `escalate()` returned early because the old provider was still set. `applyDuress` now puts a cancelled alert back to active, clears the provider fields and opens a new alarm. The phone also holds `session/end` until the duress cancel lands, and that side works without this deploy. Tested with stubs in `scripts/duress_reraise_test.ts`. **Not deployed.**
- **Phone numbers reached Supabase's gateway logs.** The relay's `.eq("phone", ...)` lookups put the number in a GET URL, and `edge_logs` keep that URL. They're now the POST RPCs `ss_relay_caller_kind` and `ss_same_phone_devices` (migration `20261106000001_relay_phone_lookups.sql`). **Not applied or deployed.** Apply the migration first, then deploy `index.ts`: in the other order every relay call fails safe to the duress message and nothing forwards. After deploying, check `edge_logs` for `phone=eq`. Rows already logged stay until Supabase ages them out.
- **A forwarded call can be answered by whoever holds the phone.** The relay only knows about duress, and silent triggers (`safe_word`, `action_button`) forward like any other alert.

**Questions for Noonlight:** may `phone` be a partner relay or masked number, and what does "verified" require? Is there a duress or no-contact workflow? Do dispatchers see `additional_info` and `instructions.entry`, and do they reach the PSAP? Would `read:alarm.inbound_phone` identify which alarm a call belongs to? What happens when a text goes unanswered?

**If Noonlight refuses a relay:** first ask for a partner-level no-contact workflow; then a per-alarm number pool, if they accept masked numbers; otherwise dispatch with her real number and disclose the gap. Don't cancel and re-create an alarm to attach a note, because the PSAP is told about a cancel.

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

- **Don't run `smoke.sh` until the `phone=eq` lookups are fixed.** Its duress cancel runs on a device with a real number, which writes that number to the gateway logs again.
- `backend/scripts/smoke.sh` runs the whole flow with `dry_run`, so Twilio is never called: register → contacts → session → heartbeat → alert → location → evidence → share page → share action → duress cancel → status checks → a stale session for the watchdog → `account/delete` (removes everything, including the evidence object) → checks that the old credentials and share link are dead. `KEEP=1` skips the delete so the watchdog can pick up the stale session. Responses are printed with secrets and phone numbers redacted.
- `backend/scripts/relay_test.sh <normal|after|before|born>`: signs Twilio-style webhooks locally with `TWILIO_AUTH_TOKEN` and reads the TwiML that comes back, so the script's own calls and texts are simulated and no person is reached. Test devices use a made-up number, and alerts are raised with no contacts. Alarms go to the Noonlight sandbox, and each one makes the sandbox really text the relay, which attempts a real reply to that sandbox number.
  - `normal`: signatures, no alert, fail-safe on a real lookup failure, forwarding, screening, no answer and voicemail, cancel while ringing, texts, contact and device callers, two alarms, no phone on file, and that each test alarm reads `CANCELED` at Noonlight. It cleans up after itself.
  - `selfcontact`: her own number on the contact list, dry runs only.
  - `scope-setup`, `scope-check`: how far a duress alarm reaches, with two different numbers. `twin-setup`, `twin-check`: duress, forced account deletion, then the same number on a new device, including after the 1 hour block. Set `RELAY_STATE` to a directory, and run the printed SQL between the two parts.
  - `after`, `before`, `born`: duress after dispatch (flips at call time, in flight, one-way), before dispatch, and with no alert running. Each leaves a duress alert behind on purpose, and that alert fails the next stage safe. Between stages, read `dispatch_alarm_id` in SQL, run `relay_test.sh cancel <id>`, then `delete from public.devices where id='<printed id>';`. Each stage registers a device, so `delete from public.register_hits;` when you reach the limit.
- `backend/scripts/privacy_test.sh` (no calls, texts or dispatch):
  - default: the cron routes refuse callers without the secret, `twilio/sms-status` refuses unsigned or badly signed callbacks, and `account/delete` removes 2 evidence objects, their rows, the alert, locations, events and contacts, after which the credentials and share link are dead.
  - `RATE=1`: also checks for the 429. This uses up this IP's hourly quota; clear it with `delete from public.register_hits;`.
  - `sms-setup` / `sms-finish <MessageSid> <state>`: Twilio-signed callbacks (signed locally with `TWILIO_AUTH_TOKEN`; Twilio itself isn't contacted) for sent → undelivered 30034 → a late sent, then checks that `alert/status` and `share/get` both show `undelivered` / `30034`. Dry runs never get a real MessageSid, so tag the `text_sent` event in SQL between the two steps (the script prints how).
  - `deferred`: a live alert with **no contacts** (so nobody is called), then `account/delete`. The credentials die at once and the share link still works. Then cancel the alert in SQL (within 90 s, before the watchdog escalates) and run `cron/retention`; it reports `devices_deleted: 1`.
- `deno run -A backend/scripts/relay_takeback_test.ts`: scripted Twilio answers for taking back a forwarded call. It proves what our code does with each answer, not how real Twilio behaves.
- **Twilio can't be exercised without a real call.** Don't test the relay by dialing a real person: use `relay_test.sh`.
- To run retention or the watchdog by hand without seeing the secret: `select net.http_post(url := '<API>/cron/retention', headers := jsonb_build_object('content-type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='safetysense_cron_secret')), body := '{}'::jsonb);` then read `net._http_response`.

Last run 2026-11-06 against function version 11 (sha256 `a3d4ec2c…`, 1,367 lines, read back and identical to `index.ts`): relay_test normal 56/56, after 33/33, before 11/11, born 12/12, selfcontact 11/11, scope 14/14, twin 14/14; smoke passes; privacy_test default 16/16 (`RATE=1`, `sms` and `deferred` not re-run). relay_takeback_test.ts 11/11 locally. All test rows were removed, including the 'Verify Test' device left from an earlier run, every test alarm was cancelled in the sandbox, and 4 devices and 0 alerts remain. The test assertions use simulated webhooks and sandbox alarms, and each alarm also caused real sandbox texts and failed reply attempts to Noonlight's sandbox number.

Run 2026-11-04: smoke passes; privacy_test 18/18, sms 8/8, deferred 4/4 (retention then deleted the deferred device). Test data cleared the same day: all dry-run alerts, both "Alex Rivera" demo devices, the 64-byte orphan object in `evidence` (the bucket is now empty), and `register_hits`. The "Alex" device (the simulator's registration) and its contacts and sessions were kept so the simulator keeps working.
