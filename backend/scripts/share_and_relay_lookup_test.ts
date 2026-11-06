// Local test of the phone's live link and the relay's phone lookups: deno run -A backend/scripts/share_and_relay_lookup_test.ts
// Loads the real index.ts with fetch stubbed and Deno.serve captured, so nothing leaves this machine.
// The two SQL functions are stubbed here. Their SQL has not been run: see the migration.
Deno.env.set("SUPABASE_URL", "https://stub.invalid");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "stub");
let serve: (req: Request) => Promise<Response> = () => { throw new Error("not served"); };
(Deno as unknown as { serve: unknown }).serve = (h: typeof serve) => { serve = h; };

const TOKEN = "abcdefghijklmnopqrstuvwxyz012345";
const CREATED = "2026-11-06T10:00:00.000Z", DURESS_AT = "2026-11-06T10:05:00.000Z";
let alert: Record<string, unknown> = {};
const requests: string[] = [];
const events = [
  { who: "SafetySense", action: "escalated", detail: "The alert was escalated.", created_at: "2026-11-06T10:05:01.000Z", delivery_status: null, error_code: null },
  { who: "Maya", action: "text_sent", detail: "Do not call or text", created_at: "2026-11-06T10:05:02.000Z", delivery_status: null, error_code: null },
  { who: "SafetySense", action: "alert_started", detail: "Alert started", created_at: CREATED, delivery_status: null, error_code: null },
].sort((a, b) => b.created_at.localeCompare(a.created_at));

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const req = input instanceof Request ? input : null;
  const url = decodeURIComponent(String(req ? req.url : input));
  const method = req?.method ?? init?.method ?? "GET";
  const text = req ? await req.clone().text() : String(init?.body ?? "");
  requests.push(`${method} ${url}`);
  const reply = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  const one = new Headers(req?.headers ?? init?.headers).get("accept")?.includes("vnd.pgrst.object") ?? false;
  const rows = (r: unknown[]) => reply(one ? r[0] ?? null : r);
  if (url.includes("/rpc/ss_get_secret")) return reply(null);
  if (url.includes("/rpc/ss_relay_caller_kind")) return reply(text.includes("+15055550142") ? "device" : "other");
  if (url.includes("/rpc/ss_same_phone_devices")) return reply(["22222222-2222-2222-2222-222222222222"]);
  if (url.includes("/rest/v1/alerts")) return rows(url.includes(`share_token=eq.${TOKEN}`) ? [alert] : []);
  if (url.includes("/rest/v1/devices")) return rows([{ name: "Alex Rivera" }]);
  if (url.includes("/rest/v1/events") && url.includes("action=eq.duress")) return rows([{ created_at: DURESS_AT }]);
  if (url.includes("/rest/v1/events")) return rows(events);
  if (url.includes("/rest/v1/locations")) return rows([{ lat: 35, lng: -106, accuracy: 5, battery: 0.5, created_at: DURESS_AT }]);
  return rows([]);
}) as typeof fetch;

const { relayCaller, samePhoneDevices } = await import("../supabase/functions/api/index.ts");

let pass = 0, fail = 0;
function check(name: string, ok: boolean, got?: unknown) {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : ` (got ${JSON.stringify(got)})`}`);
}
async function post(path: string, body: unknown) {
  const res = await serve(new Request(`https://stub.invalid/functions/v1/api/${path}`, { method: "POST", body: JSON.stringify(body) }));
  return { status: res.status, body: await res.json() };
}
const base = {
  id: "11111111-1111-1111-1111-111111111111", device_id: "22222222-2222-2222-2222-222222222222", session_id: null, level: 3,
  reason: "They asked for help", created_at: new Date().toISOString(), cancelled_at: null, dry_run: false,
  share_token: TOKEN, dispatch_provider: "noonlight_sandbox", dispatch_status: "active",
};

alert = { ...base, duress: true, status: "dispatched" };
let r = await post("share/get", { token: TOKEN });
check("a contact's link still shows duress", r.body.duress === true && r.body.duress_at === DURESS_AT && r.body.status === "dispatched", r.body);
check("a contact's link still shows the location", r.body.location?.lat === 35, r.body.location);

r = await post("share/get", { token: `${TOKEN}-p` });
check("the phone's link reads as cancelled", r.status === 200 && r.body.status === "cancelled", r.body);
check("the phone's link carries no duress fields", r.body.duress === false && r.body.duress_at === null, r.body);
check("the phone's link has no dispatch, location or sealed details",
  r.body.dispatch === null && r.body.location === null && r.body.battery === null && r.body.sealed_details === null, r.body);
check("its timeline ends at a normal cancel", JSON.stringify(r.body.events.map((e: { action: string }) => e.action)) === '["marked_safe","alert_started"]', r.body.events);
check("nothing in it mentions duress", !/duress|do not call|escalated/i.test(JSON.stringify({ ...r.body, duress: undefined, duress_at: undefined })), r.body);
r = await post("share/action", { token: `${TOKEN}-p`, action: "send_help" });
check("the phone's link can't act on the alert", r.status === 409, r);

alert = { ...base, duress: false, status: "dispatched" };
r = await post("share/get", { token: `${TOKEN}-p` });
check("before duress the phone's link is the live page", r.body.status === "dispatched" && r.body.location?.lat === 35, r.body);

r = await post("share/get", { token: `${TOKEN.slice(0, 30)}-p` });
check("a short token with the mark is not a phone link", r.status === 404, r);

requests.length = 0;
check("a device's number is recognised", (await relayCaller("+15055550142")) === "device");
check("an unknown number is other", (await relayCaller("+15055550100")) === "other");
const same = await samePhoneDevices("33333333-3333-3333-3333-333333333333");
check("same-phone devices include the device itself", same.length === 2 && same[0].startsWith("3333"), same);
check("lookups are POST RPCs", requests.length === 3 && requests.every((u) => u.startsWith("POST ") && u.includes("/rpc/")), requests);
check("no number in any URL", !requests.some((u) => /phone=|\+1505|%2B1505/.test(u)), requests);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) Deno.exit(1);
