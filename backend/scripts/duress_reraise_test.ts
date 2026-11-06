// Local test of applyDuress on a cancelled alert: deno run -A backend/scripts/duress_reraise_test.ts
// Loads the real index.ts with fetch and Deno.serve stubbed, so nothing leaves this machine. The alert
// is dry_run, so dispatch is simulated. It proves what the alert row is told, not how Noonlight behaves.
Deno.env.set("SUPABASE_URL", "https://stub.invalid");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "stub");
(Deno as unknown as { serve: unknown }).serve = () => {};

const patches: Record<string, unknown>[] = [];
let row: Record<string, unknown> = {};

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const request = input instanceof Request ? input : new Request(input, init);
  const url = request.url;
  const reply = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  if (url.includes("/rpc/")) return reply("stub");
  if (url.includes("/rest/v1/alerts") && request.method === "PATCH") {
    const patch = await request.json() as Record<string, unknown>;
    // A filter on dispatch_provider must still match, or escalate() claims nothing.
    if (url.includes("dispatch_provider=is.null") && row.dispatch_provider !== null) return reply([]);
    patches.push(patch);
    row = { ...row, ...patch };
    return reply([{ id: row.id }]);
  }
  const single = (request.headers.get("accept") ?? "").includes("vnd.pgrst.object");
  if (url.includes("/rest/v1/devices")) return reply(single ? { name: "Test" } : [{ name: "Test" }]);
  return reply(single ? {} : []);
}) as typeof fetch;

const { applyDuress } = await import("../supabase/functions/api/index.ts");

const device = { id: "d1", name: "Test", phone: "", campus: "unm" };
const base = {
  id: "a1", device_id: "d1", session_id: null, level: 2, reason: "x", trigger: "heartbeat_lost", dispatch_policy: "contacts_first",
  share_token: "t", dry_run: true, duress: false, created_at: new Date().toISOString(), escalated_at: null,
};
let fail = 0;
async function check(name: string, alert: Record<string, unknown>, test: () => string | null) {
  row = { ...alert };
  patches.length = 0;
  // deno-lint-ignore no-explicit-any
  await applyDuress(alert as any, device as any);
  const problem = test();
  if (problem) fail++;
  console.log(`  ${problem ? "FAIL" : "PASS"} ${name}${problem ? ` (${problem}; row ${JSON.stringify(row)})` : ""}`);
}

await check("a cancelled alert that dispatched goes live and dispatches again", {
  ...base, status: "cancelled", cancelled_at: new Date().toISOString(),
  dispatch_provider: "simulated", dispatch_alarm_id: "sim_old", dispatch_status: "simulated_dispatch",
}, () => {
  if (row.duress !== true) return "duress not set";
  if (row.status !== "dispatched") return "not dispatched";
  if (row.cancelled_at !== null) return "cancelled_at kept";
  if (row.dispatch_provider !== "simulated") return "no provider";
  if (row.dispatch_alarm_id === "sim_old") return "kept the cancelled alarm";
  return null;
});

await check("a cancelled alert that never dispatched goes live and dispatches", {
  ...base, status: "cancelled", cancelled_at: new Date().toISOString(),
  dispatch_provider: null, dispatch_alarm_id: null, dispatch_status: null,
}, () => row.status === "dispatched" ? null : "not dispatched");

await check("a live alert is only escalated", {
  ...base, status: "active", cancelled_at: null, dispatch_provider: null, dispatch_alarm_id: null, dispatch_status: null,
}, () => {
  if (row.status !== "dispatched") return "not dispatched";
  return patches.some((p) => p.status === "active") ? "re-raised a live alert" : null;
});

await check("an alert already dispatched keeps its alarm", {
  ...base, status: "dispatched", cancelled_at: null, dispatch_provider: "simulated", dispatch_alarm_id: "sim_keep", dispatch_status: "simulated_dispatch",
}, () => row.dispatch_alarm_id === "sim_keep" ? null : "replaced the live alarm");

if (fail) Deno.exit(1);
console.log("all passed");
