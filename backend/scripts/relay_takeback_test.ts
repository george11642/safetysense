// Local test of takeBackRelayCall against scripted Twilio answers: deno run -A backend/scripts/relay_takeback_test.ts
// Loads the real index.ts with fetch and Deno.serve stubbed, so nothing leaves this machine. It proves
// what our code does with each answer. Whether real Twilio answers this way, or stops a ringing leg
// this way, has not been tested on a live call.
Deno.env.set("SUPABASE_URL", "https://stub.invalid");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "stub");
(Deno as unknown as { serve: unknown }).serve = () => {};

type Answer = { status: number; body?: Record<string, unknown> };
let script: Answer[] = [];
let seen: string[] = [];

globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  const reply = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
  if (url.includes("/rpc/ss_get_secret")) return reply(200, "stub");
  if (url.startsWith("https://api.twilio.com/")) {
    const params = init?.body instanceof URLSearchParams ? `?${init.body}` : "";
    seen.push(`${init?.method} ${url.replace(/^.*\/Accounts\/[^/]+/, "")} ${decodeURIComponent(params).replace(/^.*relay\/voice.*$/, "REDIRECT")}`.trim());
    const next = script.shift();
    if (!next) throw new Error(`unscripted Twilio request: ${seen.at(-1)}`);
    return reply(next.status, next.body ?? {});
  }
  throw new Error(`unexpected request: ${url}`);
}) as typeof fetch;

const { takeBackRelayCall } = await import("../supabase/functions/api/index.ts");

const SID = "CAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", KID = "CAbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const live = { status: 200, body: { status: "in-progress" } };
const noWait = () => Promise.resolve();
let pass = 0, fail = 0;

async function check(name: string, answers: Answer[], want: string, needs: RegExp[] = []) {
  script = [...answers]; seen = [];
  let got: string;
  try { got = await takeBackRelayCall(SID, noWait); } catch (e) { got = `threw: ${e}`; }
  const log = seen.join(" | ");
  const ok = got === want && script.length === 0 && needs.every((r) => r.test(log));
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : ` (got ${got}, ${script.length} unused, saw: ${log})`}`);
}

const tries = (a: Answer) => [live, a, live, a, live, a];
await check("redirect works first time", [live, { status: 200 }], "redirected", [/REDIRECT/]);
await check("429 then success is retried", [live, { status: 429 }, live, { status: 200 }], "redirected");
await check("503 twice then success", [live, { status: 503 }, live, { status: 503 }, live, { status: 200 }], "redirected");
await check("a call that already ended is left alone", [{ status: 200, body: { status: "completed" } }], "ended");
await check("an unknown call is left alone", [{ status: 404 }], "ended");
await check("ends between tries", [live, { status: 400, body: { code: 21220 } }, { status: 200, body: { status: "completed" } }], "ended");
await check("ringing child is cancelled after three failures", [
  ...tries({ status: 503 }), { status: 200, body: { calls: [{ sid: KID, status: "ringing" }] } }, { status: 200 },
], "leg_stopped", [/ParentCallSid=CAa/, new RegExp(`POST /Calls/${KID}.json \\?Status=canceled`)]);
await check("connected child is completed after three failures", [
  ...tries({ status: 429 }), { status: 200, body: { calls: [{ sid: KID, status: "in-progress" }] } }, { status: 200 },
], "leg_stopped", [new RegExp(`POST /Calls/${KID}.json \\?Status=completed`)]);
await check("a finished child is not touched", [
  ...tries({ status: 400, body: { code: 21220 } }), { status: 200, body: { calls: [{ sid: KID, status: "completed" }] } },
], "no_leg_found");
await check("no child yet is reported, not hidden", [...tries({ status: 400, body: { code: 21220 } }), { status: 200, body: { calls: [] } }], "no_leg_found");
await check("Twilio down throughout is reported", [...tries({ status: 503 }), { status: 503 }], "failed");

console.log(`\n${pass} passed, ${fail} failed`);
Deno.exit(fail === 0 ? 0 : 1);
