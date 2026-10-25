import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import type { Room, Seat } from "./types";
import { SEATS } from "./types";

// Prototype storage: an in-process map, mirrored to .data/rooms.json so a
// dev-server restart doesn't lose rooms. Run as a single Node server.
const DATA_DIR = process.env.ROOMPEACE_DATA_DIR ?? path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "rooms.json");

type Store = { rooms: Map<string, Room>; loaded: boolean };
const g = globalThis as unknown as { __roompeace?: Store };
const localStore: Store = (g.__roompeace ??= { rooms: new Map(), loaded: false });
const requestStore = new AsyncLocalStorage<Store>();
const store = () => requestStore.getStore() ?? localStore;
export const isDatabaseRequest = () => Boolean(requestStore.getStore());

/** Isolate database snapshots between concurrent requests and bypass filesystem writes. */
export async function withRoomSnapshot<T>(rooms: Room[], fn: () => Promise<T>): Promise<{ value: T; rooms: Room[] }> {
  const state: Store = { rooms: new Map(rooms.map(room => [room.id, room])), loaded: true };
  const value = await requestStore.run(state, fn);
  return { value, rooms: [...state.rooms.values()] };
}

function load() {
  const current = store();
  if (current.loaded) return;
  if (process.env.VERCEL && !isDatabaseRequest()) throw new Error("Database request context required on Vercel.");
  current.loaded = true;
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) as Room[];
    for (const r of raw) {
      if (!isCurrent(r)) continue;
      r.accepts ??= [];
      // Nobody is mid-call after a restart.
      for (const s of Object.values(r.seats)) s.busy = false;
      current.rooms.set(r.id, r);
    }
  } catch {
    // No saved rooms yet.
  }
}

export function save() {
  if (isDatabaseRequest()) return; // The route transaction commits the complete state atomically.
  if (process.env.VERCEL) throw new Error("Filesystem persistence is unavailable on Vercel.");
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify([...store().rooms.values()]));
}

export const newId = (bytes = 9) => crypto.randomBytes(bytes).toString("base64url");

export function putRoom(room: Room) {
  load();
  store().rooms.set(room.id, room);
  save();
}

export function findBySeatToken(token: string): { room: Room; seat: Seat } | null {
  load();
  for (const room of store().rooms.values()) {
    if (!isCurrent(room)) continue;
    for (const seat of SEATS) {
      const s = room.seats[seat];
      if (s && safeEq(s.token, token)) return { room, seat };
    }
  }
  return null;
}

export function findByDemoToken(token: string): Room | null {
  load();
  for (const room of store().rooms.values()) {
    if (!isCurrent(room)) continue;
    if (room.demo && room.demoToken && safeEq(room.demoToken, token)) return room;
  }
  return null;
}

/** Rooms from the earlier two-roommate version can't be resumed; their links read as "not found". */
const isCurrent = (room: Room) => Boolean(room.seats?.c);

function safeEq(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
