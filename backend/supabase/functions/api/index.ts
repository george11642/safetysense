// SafetySense API — one Supabase Edge Function ("api", verify_jwt=false).
// It authenticates devices itself (x-device-id + x-device-secret, sha256 hash,
// constant-time compare), talks to Postgres with the service role, reads
// Twilio/Noonlight secrets from Vault through public.ss_get_secret(), and
// serves Twilio voice webhooks and the pg_cron watchdog.
//
// SafetySense supplements 911; it never replaces it.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.49.4";

const PROJECT_URL = Deno.env.get("SUPABASE_URL") ?? "https://uvunyysuyuonhoviszmc.supabase.co";
const API_BASE = `${PROJECT_URL.replace(/^http:/, "https:")}/functions/v1/api`;
const NOONLIGHT_BASE = "https://api-sandbox.noonlight.com/dispatch/v1";
const ESCALATE_AFTER_S = 90;
const MAX_LIVE_ALERTS_PER_HOUR = 6;
const SHARE_EXPIRES_AFTER_END_S = 2 * 3600;
const SHARE_MAX_AGE_S = 48 * 3600;
// Retention (privacy): evidence 30 days, alerts + their events 90 days, test (dry-run) alerts 48 h.
const EVIDENCE_KEEP_DAYS = 30;
const LOCATION_KEEP_DAYS = 30;
const ALERT_KEEP_DAYS = 90;
const DRY_RUN_KEEP_S = SHARE_MAX_AGE_S;
const DAY_MS = 86_400_000;

const db: SupabaseClient = createClient(PROJECT_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ------------------------------------------------------------------ helpers
class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, apikey, authorization, x-client-info, x-device-id, x-device-secret",
  "access-control-max-age": "86400",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function twiml(inner: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`, {
    headers: { "content-type": "text/xml; charset=utf-8" },
  });
}

function xml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

const enc = new TextEncoder();

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function b64(buf: ArrayBuffer | Uint8Array): string {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}
function unb64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
async function sha256hex(s: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}
function safeEqual(a: string, b: string): boolean {
  const ab = enc.encode(a), bb = enc.encode(b);
  const n = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < n; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}
function randomToken(bytes = 24): string {
  const u = crypto.getRandomValues(new Uint8Array(bytes));
  return b64(u).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); // 32 url-safe chars
}

function str(v: unknown, name: string, max = 200, required = true): string | null {
  if (v === undefined || v === null || v === "") {
    if (required) throw new HttpError(400, `${name} is required`);
    return null;
  }
  if (typeof v !== "string") throw new HttpError(400, `${name} must be a string`);
  const t = v.trim();
  if (t.length > max) throw new HttpError(400, `${name} is too long`);
  return t;
}
function num(v: unknown, name: string, min: number, max: number): number | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) throw new HttpError(400, `${name} is out of range`);
  return v;
}
function phone(v: unknown, name: string): string {
  const p = str(v, name, 20)!.replace(/[\s().-]/g, "");
  const digits = p.replace(/^\+/, "");
  const e164 = p.startsWith("+") ? p : digits.length === 10 ? `+1${digits}` : `+${digits}`;
  if (!/^\+1[2-9]\d{9}$/.test(e164)) throw new HttpError(400, `${name} must be a US phone number`);
  return e164;
}
function uuid(v: unknown, name: string): string {
  const s = str(v, name, 36)!;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) throw new HttpError(400, `${name} is invalid`);
  return s;
}
function firstName(full: string): string {
  return (full.trim().split(/\s+/)[0] || "Your friend").slice(0, 40);
}
function must<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new HttpError(500, `database error: ${res.error.message}`);
  return res.data;
}

// ------------------------------------------------------------------ secrets & flags (Vault)
const secretCache = new Map<string, { v: string | null; at: number }>();
async function secret(name: string): Promise<string | null> {
  const hit = secretCache.get(name);
  if (hit && Date.now() - hit.at < 60_000) return hit.v;
  const { data, error } = await db.rpc("ss_get_secret", { p_name: name });
  if (error) throw new HttpError(500, "secret lookup failed");
  const v = (data as string | null) || null;
  secretCache.set(name, { v, at: Date.now() });
  return v;
}
async function flag<T>(key: string, fallback: T): Promise<T> {
  const { data } = await db.from("app_flags").select("value").eq("key", key).maybeSingle();
  return (data?.value as T) ?? fallback;
}
async function shareUrl(token: string): Promise<string> {
  return (await flag<string>("share_base", "https://safetysense-live.vercel.app/a/")) + token;
}

// ------------------------------------------------------------------ sealed details (AES-256-GCM)
async function sealedKey(): Promise<CryptoKey> {
  const raw = await secret("sealed_key");
  if (!raw) throw new HttpError(500, "sealed key missing");
  return crypto.subtle.importKey("raw", unb64(raw), "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function seal(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await sealedKey(), enc.encode(plain));
  return `v1:${b64(iv)}:${b64(ct)}`;
}
async function unseal(sealed: string | null): Promise<string | null> {
  if (!sealed) return null;
  const [v, iv, ct] = sealed.split(":");
  if (v !== "v1") return null;
  try {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await sealedKey(), unb64(ct));
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ device auth
type Device = { id: string; name: string; phone: string | null; campus: string | null };
async function authDevice(req: Request): Promise<Device> {
  const id = req.headers.get("x-device-id") ?? "";
  const sec = req.headers.get("x-device-secret") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || sec.length < 16) throw new HttpError(401, "unauthorized");
  const { data } = await db.from("devices").select("id,name,phone,campus,secret_hash").eq("id", id).maybeSingle();
  const want = data?.secret_hash ?? "0".repeat(64);
  const ok = safeEqual(await sha256hex(sec), want) && !!data;
  if (!ok) throw new HttpError(401, "unauthorized");
  return { id: data!.id, name: data!.name, phone: data!.phone, campus: data!.campus };
}

async function ownedAlert(device: Device, alertId: string) {
  const a = must(await db.from("alerts").select("*").eq("id", alertId).eq("device_id", device.id).maybeSingle());
  if (!a) throw new HttpError(404, "alert not found");
  return a as Alert;
}
async function ownedSession(device: Device, sessionId: string) {
  const s = must(await db.from("sessions").select("*").eq("id", sessionId).eq("device_id", device.id).maybeSingle());
  if (!s) throw new HttpError(404, "session not found");
  return s as Session;
}

type Alert = {
  id: string; session_id: string | null; device_id: string; level: number; reason: string; trigger: string;
  status: string; dispatch_policy: string; share_token: string; dispatch_provider: string | null;
  dispatch_alarm_id: string | null; dispatch_status: string | null; duress: boolean; dry_run: boolean;
  created_at: string; escalated_at: string | null; cancelled_at: string | null;
};
type Session = {
  id: string; device_id: string; mode: string; status: string; last_heartbeat_at: string; grace_s: number;
  dispatch_policy: string; dry_run: boolean; last_lat: number | null; last_lng: number | null;
  last_accuracy: number | null; last_battery: number | null; sealed_details: string | null;
};

async function addEvent(alertId: string, who: string, action: string, detail: string | null = null, internal = false,
  extra: { provider_sid?: string | null; delivery_status?: string | null; error_code?: string | null } = {}) {
  await db.from("events").insert({ alert_id: alertId, who: who.slice(0, 60), action, detail: detail?.slice(0, 300) ?? null, internal, ...extra });
}

// Event rows as the phone and the share page see them. delivery_status / error_code come from
// Twilio's SMS status callback ("undelivered" + "30034" means the text never arrived).
type EventRow = { who: string; action: string; detail: string | null; created_at: string; delivery_status: string | null; error_code: string | null };
const EVENT_COLS = "who,action,detail,created_at,delivery_status,error_code";
function eventOut(e: EventRow, withDetail = true) {
  return {
    who: e.who, action: e.action, ...(withDetail ? { detail: e.detail } : {}), at: e.created_at,
    delivery_status: e.delivery_status, error_code: e.error_code,
  };
}

async function latestLocation(alert: Alert) {
  const { data } = await db.from("locations").select("lat,lng,accuracy,battery,created_at")
    .eq("alert_id", alert.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data as { lat: number; lng: number; accuracy: number | null; battery: number | null; created_at: string } | null;
}

// ------------------------------------------------------------------ Twilio
async function twilio(path: string, params: URLSearchParams | null, method = "POST") {
  const sid = await secret("twilio_sid"), token = await secret("twilio_token");
  if (!sid || !token) return { ok: false, status: 0, body: { message: "twilio not configured" } as Record<string, unknown> };
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}${path}`, {
    method,
    headers: { authorization: "Basic " + btoa(`${sid}:${token}`), ...(params ? { "content-type": "application/x-www-form-urlencoded" } : {}) },
    body: params ?? undefined,
  });
  let body: Record<string, unknown> = {};
  try { body = await res.json(); } catch { /* ignore */ }
  return { ok: res.ok, status: res.status, body };
}

// Validate X-Twilio-Signature: HMAC-SHA1(authToken, publicUrl + sorted(k+v)) base64.
async function validTwilio(req: Request, route: string, form: URLSearchParams): Promise<boolean> {
  const sig = req.headers.get("x-twilio-signature");
  const token = await secret("twilio_token");
  if (!sig || !token) return false;
  let data = `${API_BASE}/${route}${new URL(req.url).search}`;
  for (const k of [...new Set(form.keys())].sort()) for (const v of form.getAll(k)) data += k + v;
  const key = await crypto.subtle.importKey("raw", enc.encode(token), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const mac = b64(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
  return safeEqual(mac, sig);
}

type Notified = { name: string; channel: "call" | "sms"; status: string };

async function notifyContacts(alert: Alert, device: Device): Promise<Notified[]> {
  // contacts/set writes them in the phone's order, primary first.
  const contacts = must(await db.from("contacts").select("id,name,phone").eq("device_id", device.id).order("created_at")) as
    { id: string; name: string; phone: string }[];
  const url = await shareUrl(alert.share_token);
  const from = await secret("twilio_from");
  const who = firstName(device.name);
  const out: Notified[] = [];
  if (contacts.length === 0) await addEvent(alert.id, "SafetySense", "no_contacts", "No trusted contacts are set up");
  for (const [index, c] of contacts.entries()) {
    // SMS (Twilio trial blocks US SMS with error 30034; recorded, never fatal)
    let smsStatus = "dry_run";
    let smsSid: string | null = null, smsDelivery: string | null = null, smsError: string | null = null;
    if (!alert.dry_run) {
      const body = `SafetySense: ${who} may need help (${alert.reason}). Live location and what to do: ${url}\n` +
        `If you think ${who} is in danger, call 911.`;
      try {
        const r = await twilio("/Messages.json", new URLSearchParams({
          To: c.phone, From: from ?? "", Body: body,
          StatusCallback: `${API_BASE}/twilio/sms-status?token=${encodeURIComponent(alert.share_token)}&c=${c.id}`,
        }));
        smsStatus = r.ok ? String(r.body.status ?? "queued") : `failed:${r.body.code ?? r.status}`;
        smsSid = r.ok && typeof r.body.sid === "string" ? r.body.sid : null;
        smsDelivery = r.ok ? smsStatus : "failed";
        smsError = r.ok ? null : String(r.body.code ?? r.status);
      } catch { smsStatus = "failed:network"; smsDelivery = "failed"; smsError = "network"; }
    }
    out.push({ name: c.name, channel: "sms", status: smsStatus });
    await addEvent(alert.id, "SafetySense", "text_sent",
      smsDelivery === "failed" ? `Text to ${c.name}: not delivered (error ${smsError})` : `Text to ${c.name}: ${smsStatus}`,
      false, { provider_sid: smsSid, delivery_status: smsDelivery, error_code: smsError });

    // Voice call: the first contact only, as the app promises. Everyone else gets the text.
    if (index > 0) continue;
    let callStatus = "dry_run";
    if (!alert.dry_run) {
      const q = `token=${encodeURIComponent(alert.share_token)}&c=${c.id}`;
      const p = new URLSearchParams({
        To: c.phone, From: from ?? "", Url: `${API_BASE}/twilio/voice?${q}`, Method: "POST",
        StatusCallback: `${API_BASE}/twilio/status?${q}`, StatusCallbackMethod: "POST", Timeout: "30",
      });
      for (const e of ["answered", "completed"]) p.append("StatusCallbackEvent", e);
      try {
        const r = await twilio("/Calls.json", p);
        callStatus = r.ok ? String(r.body.status ?? "queued") : `failed:${r.body.code ?? r.status}`;
      } catch { callStatus = "failed:network"; }
    }
    out.push({ name: c.name, channel: "call", status: callStatus });
    await addEvent(alert.id, "SafetySense", "call_placed", `Call to ${c.name}: ${callStatus}`);
  }
  return out;
}

// ------------------------------------------------------------------ dispatch (Noonlight sandbox or simulated)
async function escalate(alert: Alert, reason: string, by: string, internal = false) {
  if (alert.dispatch_provider) {
    return { provider: alert.dispatch_provider, alarm_id: alert.dispatch_alarm_id, status: alert.dispatch_status };
  }
  const device = must(await db.from("devices").select("name,phone").eq("id", alert.device_id).single()) as { name: string; phone: string | null };
  const loc = await latestLocation(alert);
  const nl = alert.dry_run ? null : await secret("noonlight_token");
  let provider = "simulated", alarmId = `sim_${randomToken(9)}`, status = "simulated_dispatch";
  if (nl) {
    try {
      const res = await fetch(`${NOONLIGHT_BASE}/alarms`, {
        method: "POST",
        headers: { authorization: `Bearer ${nl}`, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          name: device.name,
          phone: (device.phone ?? "").replace(/\D/g, "").replace(/^(\d{10})$/, "1$1"),
          pin: "1234",
          location: { coordinates: { lat: loc?.lat ?? 35.0844, lng: loc?.lng ?? -106.6504, accuracy: loc?.accuracy ?? 50 } },
          // Noonlight has no duress or no-callback field. This free-text note is the only channel to
          // dispatchers, and only reaches a new alarm: an alarm already sent can't be updated.
          ...(alert.duress ? { instructions: { entry: "DURESS: person may be coerced. Do not call or text this phone. Send police." } } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.id) {
        provider = "noonlight_sandbox"; alarmId = String(body.id); status = String(body.status ?? "ACTIVE");
      } else {
        status = `simulated_dispatch (noonlight error ${res.status})`;
      }
    } catch {
      status = "simulated_dispatch (noonlight unreachable)";
    }
  }
  // Only claim the row if nobody else escalated meanwhile.
  const upd = must(await db.from("alerts").update({
    status: "dispatched", level: 3, dispatch_provider: provider, dispatch_alarm_id: alarmId,
    dispatch_status: status, escalated_at: new Date().toISOString(),
  }).eq("id", alert.id).is("dispatch_provider", null).select("id")) as { id: string }[];
  if (upd.length === 0) {
    const cur = must(await db.from("alerts").select("dispatch_provider,dispatch_alarm_id,dispatch_status").eq("id", alert.id).single()) as Alert;
    return { provider: cur.dispatch_provider, alarm_id: cur.dispatch_alarm_id, status: cur.dispatch_status };
  }
  await addEvent(alert.id, by, "dispatch_requested",
    provider === "simulated"
      ? `Emergency dispatch requested (SIMULATED for the demo; no responders were sent). ${reason}`
      : `Professional monitoring (Noonlight sandbox) requested. ${reason}`,
    internal);
  return { provider, alarm_id: alarmId, status };
}

async function pushNoonlightLocation(alert: Alert, lat: number, lng: number, accuracy: number | null) {
  if (alert.dispatch_provider !== "noonlight_sandbox" || !alert.dispatch_alarm_id) return;
  const nl = await secret("noonlight_token");
  if (!nl) return;
  await fetch(`${NOONLIGHT_BASE}/alarms/${alert.dispatch_alarm_id}/locations`, {
    method: "POST",
    headers: { authorization: `Bearer ${nl}`, "content-type": "application/json" },
    body: JSON.stringify({ coordinates: { lat, lng, accuracy: accuracy ?? 50 } }),
  }).catch(() => {});
}

async function cancelNoonlight(alert: Alert) {
  if (alert.dispatch_provider !== "noonlight_sandbox" || !alert.dispatch_alarm_id) return;
  const nl = await secret("noonlight_token");
  if (!nl) return;
  await fetch(`${NOONLIGHT_BASE}/alarms/${alert.dispatch_alarm_id}/status`, {
    method: "POST",
    headers: { authorization: `Bearer ${nl}`, "content-type": "application/json" },
    body: JSON.stringify({ status: "CANCELED", pin: "1234" }),
  }).catch(() => {});
}

// ------------------------------------------------------------------ alert creation (shared by device + watchdog)
async function createAlert(opts: {
  device: Device; session: Session | null; level: 2 | 3; reason: string; trigger: string;
  lat: number | null; lng: number | null; accuracy: number | null; battery: number | null;
  dryRun: boolean; policy: string; clientAlertId?: string | null;
}) {
  const { device, session } = opts;
  // The phone retries until it hears back. A repeat of an alert that landed must not call anyone again.
  if (opts.clientAlertId) {
    const repeat = must(await db.from("alerts").select("*").eq("id", opts.clientAlertId).maybeSingle()) as Alert | null;
    if (repeat?.device_id === device.id) return { alert: repeat, notified: [] as Notified[], reused: true };
  }
  // One live alert per session: re-use it (and upgrade to level 3 if asked).
  if (session) {
    const existing = (must(await db.from("alerts").select("*").eq("session_id", session.id)
      .in("status", ["active", "dispatched"]).order("created_at", { ascending: false }).limit(1)) as Alert[])[0];
    if (existing) {
      if (opts.level === 3 || opts.policy === "dispatch_immediately") await escalate(existing, opts.reason, "SafetySense");
      if (opts.lat !== null && opts.lng !== null) {
        await db.from("locations").insert({ alert_id: existing.id, session_id: session.id, lat: opts.lat, lng: opts.lng, accuracy: opts.accuracy, battery: opts.battery });
      }
      return { alert: existing, notified: [] as Notified[], reused: true };
    }
  }
  if (!opts.dryRun) {
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await db.from("alerts").select("id", { count: "exact", head: true })
      .eq("device_id", device.id).eq("dry_run", false).gte("created_at", since);
    if ((count ?? 0) >= MAX_LIVE_ALERTS_PER_HOUR) throw new HttpError(429, "too many alerts in the last hour; call 911 if you need help");
  }
  const alert = must(await db.from("alerts").insert({
    ...(opts.clientAlertId ? { id: opts.clientAlertId } : {}),
    session_id: session?.id ?? null, device_id: device.id, level: opts.level, reason: opts.reason, trigger: opts.trigger,
    dispatch_policy: opts.policy, share_token: randomToken(24), dry_run: opts.dryRun,
  }).select("*").single()) as Alert;
  if (session) await db.from("sessions").update({ status: "alerted" }).eq("id", session.id);

  const lat = opts.lat ?? session?.last_lat ?? null, lng = opts.lng ?? session?.last_lng ?? null;
  if (lat !== null && lng !== null) {
    await db.from("locations").insert({
      alert_id: alert.id, session_id: session?.id ?? null, lat, lng,
      accuracy: opts.accuracy ?? session?.last_accuracy ?? null, battery: opts.battery ?? session?.last_battery ?? null,
    });
  }
  await addEvent(alert.id, "SafetySense", "alert_started", `${opts.reason}${opts.dryRun ? " (TEST: no one was contacted)" : ""}`);
  const notified = await notifyContacts(alert, device);
  if (opts.level === 3 || opts.policy === "dispatch_immediately") {
    await escalate(alert, opts.trigger === "manual_sos" ? "SOS held." : "Immediate dispatch policy.", "SafetySense");
  }
  return { alert, notified, reused: false };
}

// ------------------------------------------------------------------ privacy: storage deletes, account deletion
// Deletes objects from the private "evidence" bucket with the service role (SQL cannot delete Storage objects).
async function removeObjects(paths: string[]): Promise<number> {
  const unique = [...new Set(paths.filter(Boolean))];
  let removed = 0;
  for (let i = 0; i < unique.length; i += 100) {
    const batch = unique.slice(i, i + 100);
    const { data, error } = await db.storage.from("evidence").remove(batch);
    if (error) throw new HttpError(500, "evidence storage delete failed");
    removed += data?.length ?? 0;
  }
  return removed;
}

async function evidenceObjectNames(prefix: string, orphansOnly: boolean, minAgeS = 0): Promise<string[]> {
  const { data, error } = await db.rpc("ss_evidence_objects", { p_prefix: prefix, p_orphans_only: orphansOnly, p_min_age_s: minAgeS });
  if (error) throw new HttpError(500, "evidence listing failed");
  return (data as string[] | null) ?? [];
}

async function headCount(q: PromiseLike<{ count: number | null; error: { message: string } | null }>): Promise<number> {
  const { count, error } = await q;
  if (error) throw new HttpError(500, `database error: ${error.message}`);
  return count ?? 0;
}

type DeleteCounts = {
  contacts: number; sessions: number; alerts: number; locations: number; events: number;
  evidence_rows: number; evidence_objects: number; device: number;
};

// Counts everything a device owns on the server. Used for the account/delete response.
async function countDeviceData(deviceId: string): Promise<{ counts: DeleteCounts; alertIds: string[]; objectPaths: string[] }> {
  const alertIds = (must(await db.from("alerts").select("id").eq("device_id", deviceId)) as { id: string }[]).map((a) => a.id);
  const sessionIds = (must(await db.from("sessions").select("id").eq("device_id", deviceId)) as { id: string }[]).map((s) => s.id);
  const evRows = alertIds.length
    ? must(await db.from("evidence").select("storage_path").in("alert_id", alertIds)) as { storage_path: string }[] : [];
  const objectPaths = [...new Set([...evRows.map((r) => r.storage_path), ...(await evidenceObjectNames(`${deviceId}/`, false))])];
  const ors = [alertIds.length ? `alert_id.in.(${alertIds.join(",")})` : "", sessionIds.length ? `session_id.in.(${sessionIds.join(",")})` : ""]
    .filter(Boolean).join(",");
  const counts: DeleteCounts = {
    contacts: await headCount(db.from("contacts").select("id", { count: "exact", head: true }).eq("device_id", deviceId)),
    sessions: sessionIds.length,
    alerts: alertIds.length,
    locations: ors ? await headCount(db.from("locations").select("id", { count: "exact", head: true }).or(ors)) : 0,
    events: alertIds.length ? await headCount(db.from("events").select("id", { count: "exact", head: true }).in("alert_id", alertIds)) : 0,
    evidence_rows: evRows.length,
    evidence_objects: objectPaths.length,
    device: 1,
  };
  return { counts, alertIds, objectPaths };
}

// Removes the device's evidence objects, then the device row; the foreign keys cascade to
// contacts, sessions, alerts, locations, events and evidence rows.
async function purgeDevice(deviceId: string): Promise<DeleteCounts> {
  const { counts, objectPaths } = await countDeviceData(deviceId);
  await removeObjects(objectPaths);
  must(await db.from("devices").delete().eq("id", deviceId));
  return counts;
}

// A non-test alert contacts can still open (share links live 48 h).
async function liveAlertCount(deviceId: string): Promise<number> {
  const since = new Date(Date.now() - SHARE_MAX_AGE_S * 1000).toISOString();
  return headCount(db.from("alerts").select("id", { count: "exact", head: true }).eq("device_id", deviceId)
    .eq("dry_run", false).in("status", ["active", "dispatched"]).gte("created_at", since));
}

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return xff || req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "unknown";
}

// Twilio message statuses, in order. A late "sent" never overwrites "delivered"/"undelivered".
const SMS_RANK: Record<string, number> = { accepted: 0, queued: 0, sending: 1, sent: 2, delivered: 3, undelivered: 3, failed: 3, read: 4 };

// ------------------------------------------------------------------ routes
type Ctx = { req: Request; body: Record<string, unknown> };
type Handler = (c: Ctx) => Promise<Response>;

const routes: Record<string, Handler> = {
  // ---------- device lifecycle
  async "register"({ req, body }) {
    const name = str(body.name, "name", 80)!;
    const ph = body.phone ? phone(body.phone, "phone") : null;
    const campus = str(body.campus, "campus", 40, false);
    // Rate limit (no App Attest yet): per network (salted hash of the IP, kept 1 day) and overall.
    const salt = (await secret("cron_secret")) ?? "safetysense";
    const ipHash = await sha256hex(`register|${clientIp(req)}|${salt}`);
    const hourAgo = new Date(Date.now() - 3600_000).toISOString(), dayAgo = new Date(Date.now() - DAY_MS).toISOString();
    const perHour = await flag<number>("register_per_ip_hour", 5), perDay = await flag<number>("register_per_ip_day", 20);
    const globalHour = await flag<number>("register_global_hour", 200);
    const [ipHour, ipDay, allHour] = await Promise.all([
      headCount(db.from("register_hits").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("at", hourAgo)),
      headCount(db.from("register_hits").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("at", dayAgo)),
      headCount(db.from("register_hits").select("id", { count: "exact", head: true }).gte("at", hourAgo)),
    ]);
    if (ipHour >= perHour || ipDay >= perDay || allHour >= globalHour) {
      throw new HttpError(429, "Too many sign-ups from this network right now. Please try again later. If you need help now, call 911.");
    }
    must(await db.from("register_hits").insert({ ip_hash: ipHash }));
    const secretValue = randomToken(32);
    const d = must(await db.from("devices").insert({ name, phone: ph, campus, secret_hash: await sha256hex(secretValue) })
      .select("id").single()) as { id: string };
    return json({ device_id: d.id, device_secret: secretValue });
  },

  // Name and phone edits after registration, so contacts and dispatch aren't left with old values.
  async "profile/update"({ req, body }) {
    const device = await authDevice(req);
    const name = str(body.name, "name", 80)!;
    const ph = body.phone ? phone(body.phone, "phone") : null;
    const campus = str(body.campus, "campus", 40, false);
    must(await db.from("devices").update({ name, phone: ph, campus }).eq("id", device.id));
    return json({ ok: true });
  },

  async "contacts/set"({ req, body }) {
    const device = await authDevice(req);
    if (!Array.isArray(body.contacts) || body.contacts.length > 5) throw new HttpError(400, "contacts must be a list of up to 5");
    const rows = (body.contacts as Record<string, unknown>[]).map((c, i) => ({
      device_id: device.id, name: str(c?.name, `contacts[${i}].name`, 60)!, phone: phone(c?.phone, `contacts[${i}].phone`),
    }));
    must(await db.from("contacts").delete().eq("device_id", device.id));
    // One at a time: created_at keeps their order, and the first one gets the phone call.
    for (const row of rows) must(await db.from("contacts").insert(row));
    return json({ ok: true });
  },

  // Deletes everything the server holds for this device: contacts, sessions, alerts, locations,
  // events, evidence rows and the encrypted evidence objects in Storage. The device secret stops
  // working at once. If a non-test alert is still live, contacts keep their link until it ends
  // (at most 48 h), then cron/retention finishes the deletion. The response is the same either way.
  async "account/delete"({ req }) {
    const device = await authDevice(req);
    const live = await liveAlertCount(device.id);
    if (live === 0) {
      const deleted = await purgeDevice(device.id);
      return json({ ok: true, deleted });
    }
    const { counts } = await countDeviceData(device.id);
    must(await db.from("devices").update({
      delete_requested_at: new Date().toISOString(), secret_hash: await sha256hex(randomToken(32)),
    }).eq("id", device.id));
    // An open (not alerted) session would otherwise trip the watchdog once heartbeats stop.
    await db.from("sessions").update({ status: "ended", ended_at: new Date().toISOString() }).eq("device_id", device.id).eq("status", "active");
    return json({ ok: true, deleted: counts });
  },

  async "session/start"({ req, body }) {
    const device = await authDevice(req);
    const mode = str(body.mode, "mode", 20)!;
    if (!["everyday", "walk", "night_out", "date", "ride"].includes(mode)) throw new HttpError(400, "mode is invalid");
    const interval = num(body.check_in_interval_s, "check_in_interval_s", 15, 3600) ?? 60;
    const grace = num(body.grace_s, "grace_s", 5, 3600) ?? 180;
    const policy = (body.dispatch_policy as string) ?? "contacts_first";
    if (!["contacts_first", "dispatch_immediately"].includes(policy)) throw new HttpError(400, "dispatch_policy is invalid");
    const sealedPlain = str(body.sealed_details, "sealed_details", 4000, false);
    // End any session this device left open.
    await db.from("sessions").update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("device_id", device.id).eq("status", "active");
    const s = must(await db.from("sessions").insert({
      device_id: device.id, mode, check_in_interval_s: Math.round(interval), grace_s: Math.round(grace),
      dispatch_policy: policy, dry_run: body.dry_run === true,
      sealed_details: sealedPlain ? await seal(sealedPlain) : null,
    }).select("id").single()) as { id: string };
    return json({ session_id: s.id });
  },

  async "session/heartbeat"({ req, body }) {
    const device = await authDevice(req);
    const s = await ownedSession(device, uuid(body.session_id, "session_id"));
    if (s.status === "ended") throw new HttpError(409, "session has ended");
    const lat = num(body.lat, "lat", -90, 90), lng = num(body.lng, "lng", -180, 180);
    const accuracy = num(body.accuracy, "accuracy", 0, 100000), battery = num(body.battery, "battery", 0, 1);
    const patch: Record<string, unknown> = { last_heartbeat_at: new Date().toISOString() };
    if (lat !== null && lng !== null) Object.assign(patch, { last_lat: lat, last_lng: lng, last_accuracy: accuracy });
    if (battery !== null) patch.last_battery = battery;
    must(await db.from("sessions").update(patch).eq("id", s.id));
    // While an alert is live, every heartbeat also feeds the contacts' live map.
    let live: Alert | undefined;
    if (s.status === "alerted") {
      live = (must(await db.from("alerts").select("*").eq("session_id", s.id).in("status", ["active", "dispatched"])
        .order("created_at", { ascending: false }).limit(1)) as Alert[])[0];
      if (live && lat !== null && lng !== null) {
        await db.from("locations").insert({ alert_id: live.id, session_id: s.id, lat, lng, accuracy, battery });
        await pushNoonlightLocation(live, lat, lng, accuracy);
      }
    }
    // Tells a phone that was out of reach about an alert the watchdog raised, so the person can
    // see it and stop it. A duress alert is never mentioned: the phone may be in someone's hands.
    const alert = live && !live.duress ? {
      id: live.id, level: live.level, share_url: await shareUrl(live.share_token), trigger: live.trigger,
      reason: live.reason, started_at: live.created_at, status: live.status, dispatch_policy: live.dispatch_policy,
    } : undefined;
    return json({ ok: true, server_time: new Date().toISOString(), ...(alert ? { alert } : {}) });
  },

  async "session/end"({ req, body }) {
    const device = await authDevice(req);
    const s = await ownedSession(device, uuid(body.session_id, "session_id"));
    must(await db.from("sessions").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", s.id));
    return json({ ok: true });
  },

  // ---------- alerts
  async "alert/create"({ req, body }) {
    const device = await authDevice(req);
    const level = body.level === 3 ? 3 : body.level === 2 ? 2 : (() => { throw new HttpError(400, "level must be 2 or 3"); })();
    const reason = str(body.reason, "reason", 140)!;
    const trigger = str(body.trigger, "trigger", 20)!;
    if (!["risk_engine", "missed_check_in", "safe_word", "action_button", "manual_sos", "heartbeat_lost", "contact"].includes(trigger)) {
      throw new HttpError(400, "trigger is invalid");
    }
    const policy = (body.dispatch_policy as string) ?? "contacts_first";
    if (!["contacts_first", "dispatch_immediately"].includes(policy)) throw new HttpError(400, "dispatch_policy is invalid");
    const session = body.session_id ? await ownedSession(device, uuid(body.session_id, "session_id")) : null;
    const { alert, notified } = await createAlert({
      device, session, level, reason, trigger,
      lat: num(body.lat, "lat", -90, 90), lng: num(body.lng, "lng", -180, 180),
      accuracy: num(body.accuracy, "accuracy", 0, 100000), battery: num(body.battery, "battery", 0, 1),
      dryRun: body.dry_run === true || session?.dry_run === true, policy,
      clientAlertId: body.client_alert_id ? uuid(body.client_alert_id, "client_alert_id") : null,
    });
    return json({ alert_id: alert.id, share_url: await shareUrl(alert.share_token), notified });
  },

  async "alert/escalate"({ req, body }) {
    const device = await authDevice(req);
    const alert = await ownedAlert(device, uuid(body.alert_id, "alert_id"));
    if (alert.status === "cancelled" || alert.status === "resolved") throw new HttpError(409, "alert is no longer active");
    const reason = str(body.reason, "reason", 140, false) ?? "Escalated from the phone.";
    const dispatch = await escalate(alert, reason, "SafetySense");
    return json({ dispatch });
  },

  async "alert/cancel"({ req, body }) {
    const device = await authDevice(req);
    const alert = await ownedAlert(device, uuid(body.alert_id, "alert_id"));
    if (body.duress === true) {
      // Duress PIN: looks exactly like a normal cancel to whoever holds the phone,
      // but silently escalates to dispatch. Contacts still see help is on the way.
      must(await db.from("alerts").update({ duress: true }).eq("id", alert.id));
      await addEvent(alert.id, "SafetySense", "duress", "Cancel entered with the duress PIN", true);
      await escalate({ ...alert, duress: true }, "The alert was escalated.", "SafetySense");
      return json({ ok: true, status: "cancelled" });
    }
    if (alert.status === "active" || alert.status === "dispatched") {
      must(await db.from("alerts").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", alert.id));
      await cancelNoonlight(alert);
      await addEvent(alert.id, firstName(device.name), "marked_safe", "Cancelled with their Safety PIN");
      if (alert.session_id) await db.from("sessions").update({ status: "active" }).eq("id", alert.session_id).eq("status", "alerted");
    }
    return json({ ok: true, status: "cancelled" });
  },

  async "alert/location"({ req, body }) {
    const device = await authDevice(req);
    const alert = await ownedAlert(device, uuid(body.alert_id, "alert_id"));
    const lat = num(body.lat, "lat", -90, 90), lng = num(body.lng, "lng", -180, 180);
    if (lat === null || lng === null) throw new HttpError(400, "lat and lng are required");
    const accuracy = num(body.accuracy, "accuracy", 0, 100000), battery = num(body.battery, "battery", 0, 1);
    must(await db.from("locations").insert({ alert_id: alert.id, session_id: alert.session_id, lat, lng, accuracy, battery }));
    await pushNoonlightLocation(alert, lat, lng, accuracy);
    return json({ ok: true });
  },

  async "alert/status"({ req, body }) {
    const device = await authDevice(req);
    const alert = await ownedAlert(device, uuid(body.alert_id, "alert_id"));
    const events = must(await db.from("events").select(EVENT_COLS).eq("alert_id", alert.id)
      .eq("internal", false).order("created_at")) as EventRow[];
    if (alert.duress) {
      // Never reveal the silent escalation on the (possibly coerced) phone.
      return json({
        status: "cancelled", level: alert.level, dispatch: null,
        events: events.filter((e) => e.action !== "dispatch_requested").map((e) => eventOut(e, false)),
      });
    }
    return json({
      status: alert.status, level: alert.level,
      dispatch: alert.dispatch_provider ? { provider: alert.dispatch_provider, status: alert.dispatch_status } : null,
      events: events.map((e) => eventOut(e)),
    });
  },

  async "evidence/upload"({ req, body }) {
    const device = await authDevice(req);
    const alert = await ownedAlert(device, uuid(body.alert_id, "alert_id"));
    const seq = num(body.seq, "seq", 0, 100000);
    if (seq === null || !Number.isInteger(seq)) throw new HttpError(400, "seq is required");
    const sha = str(body.sha256, "sha256", 64)!.toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(sha)) throw new HttpError(400, "sha256 must be 64 hex chars");
    const ctB64 = str(body.ciphertext_b64, "ciphertext_b64", 8_000_000)!;
    let bytes: Uint8Array;
    try { bytes = unb64(ctB64); } catch { throw new HttpError(400, "ciphertext_b64 is not base64"); }
    const path = `${alert.device_id}/${alert.id}/${String(seq).padStart(5, "0")}.bin`;
    const up = await db.storage.from("evidence").upload(path, bytes, { contentType: "application/octet-stream", upsert: false });
    if (up.error && !/exists/i.test(up.error.message)) throw new HttpError(500, "evidence storage failed");
    const ins = await db.from("evidence").upsert({ alert_id: alert.id, seq, sha256: sha, storage_path: path, bytes: bytes.length },
      { onConflict: "alert_id,seq", ignoreDuplicates: true });
    if (ins.error) throw new HttpError(500, "evidence record failed");
    return json({ ok: true });
  },

  // ---------- public share page (token-scoped, no device headers)
  async "share/get"({ body }) {
    const alert = await alertByToken(body.token);
    const device = must(await db.from("devices").select("name").eq("id", alert.device_id).single()) as { name: string };
    const ended = alert.status === "cancelled" || alert.status === "resolved";
    const live = !ended;
    const loc = live ? await latestLocation(alert) : null;
    const events = must(await db.from("events").select(EVENT_COLS).eq("alert_id", alert.id)
      .eq("internal", false).order("created_at", { ascending: false }).limit(40)) as EventRow[];
    let sealed: string | null = null;
    if (live && alert.session_id) {
      const s = must(await db.from("sessions").select("sealed_details").eq("id", alert.session_id).maybeSingle()) as { sealed_details: string | null } | null;
      sealed = await unseal(s?.sealed_details ?? null);
    }
    return json({
      first_name: firstName(device.name),
      status: alert.status,
      level: alert.level,
      reason: alert.reason,
      started_at: alert.created_at,
      dry_run: alert.dry_run,
      dispatch: alert.dispatch_provider ? { provider: alert.dispatch_provider, status: alert.dispatch_status } : null,
      location: loc ? { lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy, at: loc.created_at } : null,
      battery: loc?.battery ?? null,
      events: events.map((e) => eventOut(e)),
      sealed_details: sealed,
    });
  },

  async "share/action"({ body }) {
    const alert = await alertByToken(body.token);
    if (alert.status === "cancelled" || alert.status === "resolved") throw new HttpError(409, "this alert has ended");
    const action = str(body.action, "action", 20)!;
    const name = (str(body.responder_name, "responder_name", 40, false) ?? "A contact").replace(/[<>]/g, "");
    if (action === "on_my_way") await addEvent(alert.id, name, "on_my_way", `${name} is on the way`);
    else if (action === "called_911") await addEvent(alert.id, name, "called_911", `${name} called 911`);
    else if (action === "send_help") {
      await addEvent(alert.id, name, "send_help", `${name} asked SafetySense to send help`);
      await escalate(alert, `Requested by ${name}.`, name);
    } else throw new HttpError(400, "action is invalid");
    return json({ ok: true });
  },

  // ---------- Twilio webhooks
  async "twilio/voice"({ req }) {
    const form = new URLSearchParams(await req.text());
    if (!(await validTwilio(req, "twilio/voice", form))) return new Response("forbidden", { status: 403 });
    const q = new URL(req.url).searchParams;
    const alert = await alertByToken(q.get("token")).catch(() => null);
    if (!alert) return twiml(`<Say>This SafetySense alert has expired. Goodbye.</Say>`);
    const device = must(await db.from("devices").select("name").eq("id", alert.device_id).single()) as { name: string };
    const who = xml(firstName(device.name));
    if (alert.status === "cancelled" || alert.status === "resolved") {
      return twiml(`<Say>This is SafetySense. ${who} has marked themselves safe. No action is needed. Goodbye.</Say>`);
    }
    const action = xml(`${API_BASE}/twilio/gather?token=${encodeURIComponent(alert.share_token)}&c=${q.get("c") ?? ""}`);
    return twiml(
      `<Say voice="Polly.Joanna">SafetySense alert. ${who} may need help. Reason: ${xml(alert.reason)}. ` +
        `A live location link has been sent to you.</Say>` +
        `<Gather numDigits="1" timeout="8" method="POST" action="${action}">` +
        `<Say voice="Polly.Joanna">Press 1 if you are on your way. Press 9 to send emergency help.</Say></Gather>` +
        `<Say voice="Polly.Joanna">We did not get a response. If you think ${who} is in danger, call 9 1 1. Goodbye.</Say>`,
    );
  },

  async "twilio/gather"({ req }) {
    const form = new URLSearchParams(await req.text());
    if (!(await validTwilio(req, "twilio/gather", form))) return new Response("forbidden", { status: 403 });
    const q = new URL(req.url).searchParams;
    const alert = await alertByToken(q.get("token")).catch(() => null);
    if (!alert) return twiml(`<Say>This alert has expired. Goodbye.</Say>`);
    const who = await contactName(q.get("c"), alert.device_id);
    const digits = form.get("Digits");
    if (digits === "1") {
      await addEvent(alert.id, who, "on_my_way", `${who} is on the way (phone call)`);
      return twiml(`<Say voice="Polly.Joanna">Thank you. We have let them know you are on your way. If they are in immediate danger, call 9 1 1. Goodbye.</Say>`);
    }
    if (digits === "9") {
      await addEvent(alert.id, who, "send_help", `${who} asked for emergency help (phone call)`);
      const d = await escalate(alert, `Requested by ${who} by phone.`, who);
      const sim = d.provider === "simulated";
      return twiml(`<Say voice="Polly.Joanna">${sim
        ? "Emergency dispatch was requested. This is a demo, so dispatch is simulated. If this is a real emergency, hang up and call 9 1 1."
        : "Professional monitoring has been asked to send help. Please also call 9 1 1 if you can."} Goodbye.</Say>`);
    }
    return twiml(`<Say voice="Polly.Joanna">Sorry, that was not an option. If you think they are in danger, call 9 1 1. Goodbye.</Say>`);
  },

  async "twilio/status"({ req }) {
    const form = new URLSearchParams(await req.text());
    if (!(await validTwilio(req, "twilio/status", form))) return new Response("forbidden", { status: 403 });
    const q = new URL(req.url).searchParams;
    const alert = await alertByToken(q.get("token")).catch(() => null);
    if (alert) {
      const who = await contactName(q.get("c"), alert.device_id);
      const st = form.get("CallStatus") ?? "unknown";
      await addEvent(alert.id, "SafetySense", "call_status", `Call to ${who}: ${st}`);
    }
    return new Response(null, { status: 204 });
  },

  // Twilio SMS StatusCallback: records delivered / undelivered (+ error code, e.g. 30034) on the
  // alert's "text_sent" event, so alert/status and share/get can say "Text not delivered".
  async "twilio/sms-status"({ req }) {
    const form = new URLSearchParams(await req.text());
    if (!(await validTwilio(req, "twilio/sms-status", form))) return new Response("forbidden", { status: 403 });
    const sid = form.get("MessageSid") ?? form.get("SmsSid") ?? "";
    const st = (form.get("MessageStatus") ?? form.get("SmsStatus") ?? "").toLowerCase();
    const code = form.get("ErrorCode") || null;
    if (!/^(SM|MM)[0-9a-f]{32}$/i.test(sid) || !(st in SMS_RANK)) return new Response(null, { status: 204 });
    const ev = (must(await db.from("events").select("id,detail,delivery_status").eq("provider_sid", sid).eq("action", "text_sent").limit(1)) as
      { id: number; detail: string | null; delivery_status: string | null }[])[0];
    if (!ev) return new Response(null, { status: 204 });
    if ((SMS_RANK[ev.delivery_status ?? "queued"] ?? 0) > SMS_RANK[st]) return new Response(null, { status: 204 });
    const name = ev.detail?.match(/^Text to (.+?):/)?.[1] ?? "contact";
    const failed = st === "undelivered" || st === "failed";
    const detail = failed ? `Text to ${name}: not delivered${code ? ` (error ${code})` : ""}` : `Text to ${name}: ${st}`;
    must(await db.from("events").update({ delivery_status: st, error_code: failed ? code : null, detail }).eq("id", ev.id));
    return new Response(null, { status: 204 });
  },

  // ---------- retention (pg_cron hourly via pg_net)
  async "cron/retention"({ req }) {
    const want = await secret("cron_secret");
    if (!want || !safeEqual(req.headers.get("x-cron-secret") ?? "", want)) throw new HttpError(401, "unauthorized");
    const now = Date.now();
    const ago = (ms: number) => new Date(now - ms).toISOString();
    const r = {
      evidence_rows: 0, evidence_objects: 0, orphan_objects: 0, alerts: 0, test_alerts: 0, events: 0,
      locations: 0, sessions: 0, sealed_cleared: 0, devices_deleted: 0, register_hits: 0,
    };

    // 1) Evidence older than 30 days: Storage objects first, then rows.
    const oldEv = must(await db.from("evidence").select("id,storage_path").lt("created_at", ago(EVIDENCE_KEEP_DAYS * DAY_MS)).limit(1000)) as
      { id: number; storage_path: string }[];
    if (oldEv.length) {
      r.evidence_objects += await removeObjects(oldEv.map((e) => e.storage_path));
      const del = must(await db.from("evidence").delete().in("id", oldEv.map((e) => e.id)).select("id")) as unknown[];
      r.evidence_rows += del.length;
    }

    // 2) Alerts older than 90 days, and test (dry-run) alerts older than 48 h. Events and
    //    locations cascade; any evidence they still have goes first.
    for (const [kind, q] of [
      ["alerts", db.from("alerts").select("id").lt("created_at", ago(ALERT_KEEP_DAYS * DAY_MS)).limit(500)],
      ["test_alerts", db.from("alerts").select("id").eq("dry_run", true).lt("created_at", ago(DRY_RUN_KEEP_S * 1000)).limit(500)],
    ] as const) {
      const ids = (must(await q) as { id: string }[]).map((a) => a.id);
      if (!ids.length) continue;
      const ev = must(await db.from("evidence").select("storage_path").in("alert_id", ids)) as { storage_path: string }[];
      r.evidence_objects += await removeObjects(ev.map((e) => e.storage_path));
      r.evidence_rows += ev.length;
      r.events += await headCount(db.from("events").select("id", { count: "exact", head: true }).in("alert_id", ids));
      const del = must(await db.from("alerts").delete().in("id", ids).select("id")) as unknown[];
      r[kind] += del.length;
    }
    const evDel = must(await db.from("events").delete().lt("created_at", ago(ALERT_KEEP_DAYS * DAY_MS)).select("id")) as unknown[];
    r.events += evDel.length;

    // 3) Location history 30 days; ended sessions 90 days; sealed date details once no share link can show them.
    r.locations = (must(await db.from("locations").delete().lt("created_at", ago(LOCATION_KEEP_DAYS * DAY_MS)).select("id")) as unknown[]).length;
    r.sessions = (must(await db.from("sessions").delete().eq("status", "ended").lt("started_at", ago(ALERT_KEEP_DAYS * DAY_MS)).select("id")) as unknown[]).length;
    r.sealed_cleared = (must(await db.from("sessions").update({ sealed_details: null }).not("sealed_details", "is", null)
      .lt("started_at", ago(SHARE_MAX_AGE_S * 1000)).select("id")) as unknown[]).length;

    // 4) Account deletions that waited for a live alert to end.
    const pending = must(await db.from("devices").select("id").not("delete_requested_at", "is", null).limit(100)) as { id: string }[];
    for (const d of pending) {
      if ((await liveAlertCount(d.id)) > 0) continue;
      await purgeDevice(d.id).then(() => r.devices_deleted++).catch((e) => console.error("deferred delete failed", d.id, String(e)));
    }

    // 5) Storage objects no evidence row points at (older than a day), and old rate-limit hits.
    r.orphan_objects = await removeObjects(await evidenceObjectNames("", true, 86_400));
    r.register_hits = (must(await db.from("register_hits").delete().lt("at", ago(DAY_MS)).select("id")) as unknown[]).length;
    return json({ ok: true, ...r });
  },

  // ---------- watchdog (pg_cron every minute via pg_net)
  async "cron/watchdog"({ req }) {
    const want = await secret("cron_secret");
    if (!want || !safeEqual(req.headers.get("x-cron-secret") ?? "", want)) throw new HttpError(401, "unauthorized");
    const result = { heartbeat_lost: 0, escalated: 0 };

    // 1) Phones that went dark: active sessions with no heartbeat for > grace_s.
    const active = must(await db.from("sessions").select("*").eq("status", "active").limit(500)) as Session[];
    const now = Date.now();
    for (const s of active) {
      if (now - Date.parse(s.last_heartbeat_at) <= s.grace_s * 1000) continue;
      // Claim atomically so overlapping runs never double-alert.
      const claimed = must(await db.from("sessions").update({ status: "alerted" }).eq("id", s.id).eq("status", "active").select("id")) as unknown[];
      if (!claimed.length) continue;
      const device = must(await db.from("devices").select("id,name,phone,campus").eq("id", s.device_id).single()) as Device;
      const mins = Math.max(1, Math.round((now - Date.parse(s.last_heartbeat_at)) / 60000));
      await createAlert({
        device, session: { ...s, status: "alerted" }, level: 2, trigger: "heartbeat_lost",
        reason: `Their phone stopped checking in ${mins} min ago`,
        lat: null, lng: null, accuracy: null, battery: null, dryRun: s.dry_run, policy: s.dispatch_policy,
      }).catch((e) => console.error("watchdog alert failed", s.id, String(e)));
      result.heartbeat_lost++;
    }

    // 2) Level-2 alerts with no valid cancel after 90 s: escalate to dispatch.
    const cutoff = new Date(now - ESCALATE_AFTER_S * 1000).toISOString();
    const stale = must(await db.from("alerts").select("*").eq("status", "active").eq("level", 2)
      .is("dispatch_provider", null).lt("created_at", cutoff).limit(100)) as Alert[];
    for (const a of stale) {
      await escalate(a, `No response for ${ESCALATE_AFTER_S} seconds.`, "SafetySense").catch((e) => console.error("escalate failed", a.id, String(e)));
      result.escalated++;
    }
    return json({ ok: true, ...result });
  },

  // ---------- one-time admin setup (secrets go straight into Vault)
  async "admin/setup"({ req, body }) {
    await requireSetupKey(req);
    if ((await flag<boolean>("setup_open", false)) !== true) throw new HttpError(403, "setup is closed");
    const sid = str(body.twilio_sid, "twilio_sid", 64)!;
    const tok = str(body.twilio_token, "twilio_token", 128)!;
    const from = phone(body.twilio_from, "twilio_from");
    if (!/^AC[0-9a-f]{32}$/i.test(sid)) throw new HttpError(400, "twilio_sid looks wrong");
    const nl = str(body.noonlight_token, "noonlight_token", 512, false);
    for (const [k, v] of [["twilio_sid", sid], ["twilio_token", tok], ["twilio_from", from], ...(nl ? [["noonlight_token", nl]] : [])]) {
      const { error } = await db.rpc("ss_set_secret", { p_name: k, p_value: v });
      if (error) throw new HttpError(500, "could not store secret");
    }
    if (body.close === true) await db.from("app_flags").update({ value: false }).eq("key", "setup_open");
    if (typeof body.share_base === "string" && /^https:\/\/[a-z0-9.-]+\/a\/$/.test(body.share_base)) {
      await db.from("app_flags").update({ value: body.share_base }).eq("key", "share_base");
    }
    secretCache.clear();
    return json({ ok: true, stored: ["twilio_sid", "twilio_token", "twilio_from", ...(nl ? ["noonlight_token"] : [])] });
  },

  async "admin/selftest"({ req }) {
    await requireSetupKey(req);
    secretCache.clear();
    const sid = await secret("twilio_sid");
    const r = sid ? await twilio(".json", null, "GET") : { ok: false, status: 0, body: {} };
    return json({
      twilio_account_fetch: r.status,
      twilio_account_status: r.ok ? r.body.status : null,
      twilio_account_type: r.ok ? r.body.type : null,
      twilio_from_set: !!(await secret("twilio_from")),
      noonlight: (await secret("noonlight_token")) ? "configured" : "absent (simulated dispatch)",
      setup_open: await flag<boolean>("setup_open", false),
      share_base: await flag<string>("share_base", ""),
    });
  },
};

async function requireSetupKey(req: Request) {
  const want = await secret("setup_key_sha256");
  const got = await sha256hex(req.headers.get("x-setup-key") ?? "");
  if (!want || !safeEqual(got, want)) throw new HttpError(401, "unauthorized");
}

async function alertByToken(token: unknown): Promise<Alert> {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{24,64}$/.test(token)) throw new HttpError(404, "link not found");
  const a = must(await db.from("alerts").select("*").eq("share_token", token).maybeSingle()) as Alert | null;
  if (!a) throw new HttpError(404, "link not found");
  const age = (Date.now() - Date.parse(a.created_at)) / 1000;
  const endedAge = a.cancelled_at ? (Date.now() - Date.parse(a.cancelled_at)) / 1000 : 0;
  if (age > SHARE_MAX_AGE_S || endedAge > SHARE_EXPIRES_AFTER_END_S) throw new HttpError(410, "this link has expired");
  return a;
}

async function contactName(id: string | null, deviceId: string): Promise<string> {
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return "A contact";
  const { data } = await db.from("contacts").select("name").eq("id", id).eq("device_id", deviceId).maybeSingle();
  return data?.name ? firstName(data.name) : "A contact";
}

// ------------------------------------------------------------------ server
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const path = new URL(req.url).pathname.replace(/^.*?\/api\/?/, "").replace(/\/+$/, "");
  const handler = routes[path];
  if (!handler) return json({ error: "not found" }, 404);
  if (req.method !== "POST") return json({ error: "use POST" }, 405);
  try {
    let body: Record<string, unknown> = {};
    if (!path.startsWith("twilio/")) {
      const text = await req.text();
      if (text.length > 12_000_000) throw new HttpError(413, "request too large");
      if (text) {
        try { body = JSON.parse(text); } catch { throw new HttpError(400, "body must be JSON"); }
        if (typeof body !== "object" || body === null || Array.isArray(body)) throw new HttpError(400, "body must be a JSON object");
      }
    }
    return await handler({ req, body });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error("unhandled", path, e instanceof Error ? e.message : String(e));
    return json({ error: "internal error" }, 500);
  }
});
