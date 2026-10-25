import { Client } from "pg";
import { createHash } from "node:crypto";
import type { Room } from "./types";
import { SEATS } from "./types";
import { withRoomSnapshot } from "./store";

export class StorageError extends Error {
  constructor(message: string, public status = 503) { super(message); }
}

export const usesDatabase = () => Boolean(process.env.DATABASE_URL);
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
let schemaReady = false;

// The advisory lock serializes first-use DDL across serverless instances.
async function ensureSchema(client: Client) {
  if (schemaReady) return;
  await client.query("BEGIN");
  try {
    await client.query("SELECT pg_advisory_xact_lock(17482, 1)");
    await client.query(`CREATE TABLE IF NOT EXISTS roompeace_rooms (
      id text PRIMARY KEY,
      data jsonb NOT NULL,
      seat_tokens text[] NOT NULL,
      demo_token text UNIQUE,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await client.query("CREATE INDEX IF NOT EXISTS roompeace_seat_tokens_idx ON roompeace_rooms USING gin (seat_tokens)");
    await client.query("COMMIT");
    schemaReady = true;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}

/** Short-lived connections cannot be stranded by a frozen serverless instance. */
async function connect(): Promise<Client> {
  if (!usesDatabase()) throw new StorageError("Set DATABASE_URL in the server environment and redeploy.");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 8_000,
    statement_timeout: 10_000,
    idle_in_transaction_session_timeout: 55_000,
  });
  try {
    await client.connect();
    await ensureSchema(client);
    return client;
  } catch {
    await client.end().catch(() => {});
    // Never expose connection strings, credentials, SQL or private room data.
    throw new StorageError("Room storage is unavailable. Check DATABASE_URL and database access on the server.");
  }
}

function requireLocalOrDatabase() {
  if (process.env.VERCEL && !usesDatabase()) throw new StorageError("Set DATABASE_URL in Vercel and redeploy. Local file storage is not supported there.");
}

export async function createStoredRoom<T>(fn: () => Promise<T>): Promise<T> {
  requireLocalOrDatabase();
  if (!usesDatabase()) return fn();
  const client = await connect();
  try {
    const result = await withRoomSnapshot([], fn);
    await client.query("BEGIN");
    for (const room of result.rooms) {
      await client.query("INSERT INTO roompeace_rooms (id, data, seat_tokens, demo_token) VALUES ($1, $2::jsonb, $3, $4)",
        [room.id, JSON.stringify(room), SEATS.map(s => hash(room.seats[s].token)), room.demoToken ? hash(room.demoToken) : null]);
    }
    await client.query("COMMIT");
    return result.value;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { await client.end(); }
}

/**
 * Writers hold one room row lock through validation and the bounded agent call.
 * NOWAIT makes concurrent writers retry rather than overwrite or queue indefinitely.
 * Readers see the last committed snapshot and never touch another room's private data.
 */
export async function accessStoredRoom<T>(token: string, kind: "seat" | "demo", write: boolean, fn: () => Promise<T>): Promise<T> {
  requireLocalOrDatabase();
  if (!usesDatabase()) return fn();
  const client = await connect();
  try {
    if (write) await client.query("BEGIN");
    const where = kind === "seat" ? "seat_tokens @> ARRAY[$1]::text[]" : "demo_token = $1";
    const found = await client.query<{ data: Room }>(`SELECT data FROM roompeace_rooms WHERE ${where}${write ? " FOR UPDATE NOWAIT" : ""}`, [hash(token)]);
    const result = await withRoomSnapshot(found.rows.map(row => row.data), fn);
    if (write) {
      for (const room of result.rooms) {
        await client.query("UPDATE roompeace_rooms SET data = $2::jsonb, updated_at = now() WHERE id = $1", [room.id, JSON.stringify(room)]);
      }
      await client.query("COMMIT");
    }
    return result.value;
  } catch (error) {
    if (write) await client.query("ROLLBACK").catch(() => {});
    if ((error as { code?: string })?.code === "55P03") throw new StorageError("This room is processing another request. Please try again in a moment.", 409);
    throw error;
  } finally { await client.end(); }
}

export function storageResponse(error: unknown): Response {
  if (error instanceof StorageError) return Response.json({ error: error.message }, { status: error.status });
  console.error("[roompeace] Storage request failed; no private details logged.");
  return Response.json({ error: "The room could not be saved. Please try again." }, { status: 503 });
}
