// Uses DATABASE_URL from .env.local. Creates and removes only its own fictional rooms.
import { loadEnvConfig } from "@next/env";
import assert from "node:assert/strict";
import { Client } from "pg";
loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw new Error("Add DATABASE_URL to .env.local before running check:database.");
const { createStoredRoom, accessStoredRoom, StorageError } = await import("../lib/database");
const { findBySeatToken, findByDemoToken } = await import("../lib/store");
const engine = await import("../lib/engine");
const ids: string[] = [];
const seats = ["a", "b", "c"] as const;
engine.agents.hasApiKey = () => true;
engine.agents.runIntake = async (_room, seat) => ({ reply: "Review the preview.", items: [{ text: `${seat} can clean Saturday`, kind: "availability" }, { text: "PRIVATE_ASSIGNMENT", kind: "reason" }] });
engine.agents.runNegotiator = async room => room.currentProposal
  ? { action: "accept", message: "Ready for review", note: "", tasks: null }
  : { action: "propose", message: "Proposed swap", note: "", tasks: seats.map(seat => ({ seat, task: "Clean bathroom", due: "Saturday", dueIso: "2026-10-31T12:00:00-07:00" })) };
engine.agents.runAmend = async room => ({ tasks: room.agreement!.tasks, note: "Review revised version", reply: "Review it" });

try {
  const created = await createStoredRoom(async () => {
    const room = engine.createRoom(["DB Test A", "DB Test B", "DB Test C"], true);
    ids.push(room.id);
    return room;
  });
  const token = (s: typeof seats[number]) => created.seats[s].token;
  const access = <T>(s: typeof seats[number], write: boolean, fn: (room: typeof created) => Promise<T>) => accessStoredRoom(token(s), "seat", write, async () => fn(findBySeatToken(token(s))!.room));
  await access("a", false, async room => { assert.equal(room.id, created.id); assert.notEqual(room, created); });
  console.log("ok room persisted across independent connections");
  await accessStoredRoom("not-a-token", "seat", false, async () => assert.equal(findBySeatToken("not-a-token"), null));
  await accessStoredRoom(created.demoToken!, "demo", false, async () => assert.equal(findByDemoToken(created.demoToken!)?.id, created.id));

  for (const s of seats) {
    await access(s, true, async room => { await engine.studentChat(room, s, "PRIVATE_CHAT_MARKER"); });
    await access(s, true, async room => { engine.approveShare(room, s, room.seats[s].pending!.filter(p => p.checked).map(p => p.id)); });
  }
  await access("b", false, async room => {
    const view = engine.viewFor(room, "b");
    assert.ok(view.others.every(other => !("chat" in other) && !("token" in other)));
    assert.ok(!JSON.stringify(room.exchange).includes("PRIVATE_ASSIGNMENT"));
    assert.equal(room.status, "negotiating");
    assert.equal(room.currentProposal, null, "no fire-and-forget work is launched");
  });
  for (let i = 0; i < 3; i++) await access("a", true, async room => engine.advanceNegotiation(room));
  await access("a", false, async room => assert.equal(room.status, "awaiting_approval"));
  console.log("ok consent privacy and request-driven negotiation survive reloading");

  await access("a", true, async room => engine.approveAgreement(room, "a", 1));
  await access("b", true, async room => engine.approveAgreement(room, "b", 1));
  await access("a", false, async room => assert.equal(room.status, "awaiting_approval"));
  await access("c", true, async room => { await engine.requestAmend(room, "c", "Please revise"); engine.sendAmend(room, "c"); });
  await assert.rejects(access("a", true, async room => engine.approveAgreement(room, "a", 1)), engine.RuleError);
  for (const s of seats) await access(s, true, async room => engine.approveAgreement(room, s, 2));
  await access("b", false, async room => assert.equal(room.status, "confirmed"));
  console.log("ok only all three approvals of the same persisted version confirm");

  await assert.rejects(access("a", true, async room => { room.seats.a.name = "ROLLBACK"; throw new Error("test rollback"); }));
  await access("a", false, async room => assert.equal(room.seats.a.name, "DB Test A"));
  let unlock!: () => void;
  let entered!: () => void;
  const ready = new Promise<void>(resolve => { entered = resolve; });
  const hold = new Promise<void>(resolve => { unlock = resolve; });
  const writer = access("a", true, async room => { room.seats.a.reminders = true; entered(); await hold; });
  await ready;
  try {
    await assert.rejects(access("b", true, async room => { room.seats.b.reminders = true; }), error => error instanceof StorageError && error.status === 409);
    await access("c", false, async room => assert.equal(room.seats.a.reminders, false, "reader sees committed state"));
  } finally { unlock(); await writer; }
  await access("a", false, async room => { assert.equal(room.seats.a.reminders, true); assert.equal(room.seats.b.reminders, false); });
  console.log("ok rollback, nonblocking readers, and concurrent writer protection");
} finally {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try { await client.connect(); await client.query("DELETE FROM roompeace_rooms WHERE id = ANY($1::text[])", [ids]); }
  finally { await client.end(); }
}
