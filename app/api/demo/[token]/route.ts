import { NextResponse } from "next/server";
import { findByDemoToken } from "@/lib/store";
import { accessStoredRoom, storageResponse } from "@/lib/database";

export const runtime = "nodejs";

// Demo rooms use fictional people, so the demo view may hold every seat link.
// Real rooms have no demo token and never expose one seat to the other.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    return await accessStoredRoom(token, "demo", false, async () => {
      const room = findByDemoToken(token);
      if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ a: room.seats.a.token, b: room.seats.b.token, c: room.seats.c.token }, { headers: { "Cache-Control": "no-store" } });
    });
  } catch (error) { return storageResponse(error); }
}
