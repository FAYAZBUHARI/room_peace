// Opt-in integration check: run a local server first. Uses real server-side Gemini calls.
import assert from "node:assert/strict";
import { DEMO_LINES } from "../lib/demo";
import type { SeatView } from "../lib/types";

const base = process.env.ROOMPEACE_TEST_URL ?? "http://localhost:3000";
async function api(route: string, body?: unknown) {
  const res = await fetch(`${base}/api/${route}`, body === undefined ? {} : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const data = await res.json();
  assert.ok(res.ok, `API ${res.status}: ${data.error ?? "request failed"}`);
  return data;
}
const tokens = await api("rooms", { demo: true });
const seats = ["a", "b", "c"] as const;
for (const seat of seats) {
  const view: SeatView = await api(`seat/${tokens[seat]}`, { action: "chat", text: DEMO_LINES[seat][0] });
  assert.ok(view.me.pending?.length, `No sharing preview for ${seat}: ${view.me.chat.at(-1)?.text}`);
  // Explicitly consent to the assignment reason, so the group may discuss that conflict.
  const chosen = view.me.pending.filter((p) => p.kind !== "complaint").map((p) => p.id);
  await api(`seat/${tokens[seat]}`, { action: "approveShare", checked: chosen });
  console.log(`ok ${seat}: private chat -> reviewed sharing preview -> approved facts`);
}
let view: SeatView;
const deadline = Date.now() + 240_000;
do {
  view = await api(`seat/${tokens.a}`);
  assert.equal(view.error, null, view.error ?? "");
  if (view.status !== "negotiating") break;
  assert.ok(Date.now() < deadline, "Negotiation timed out");
  await new Promise((resolve) => setTimeout(resolve, 1000));
} while (true);
assert.equal(view.status, "awaiting_approval");
assert.ok(view.exchange.some((e) => e.kind === "propose" && /Option 2:/.test(e.text)));
assert.ok(view.agreement!.tasks.some((t) => t.seat === "a" && /sat/i.test(t.due)));
assert.ok(view.agreement!.tasks.some((t) => t.seat === "b"));
console.log("ok shared summary, options and reciprocal bathroom swap presented");
const version = view.agreement!.version;
for (const [i, seat] of seats.entries()) {
  view = await api(`seat/${tokens[seat]}`, { action: "approve", version });
  assert.equal(view.status, i === 2 ? "confirmed" : "awaiting_approval");
}
console.log(`ok confirmed only after all three approved v${version}`);
