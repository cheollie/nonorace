import { broadcastFinished } from "@/lib/pusher-server";
import { recordFinished } from "@/lib/room-state";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const body = await _req.json();
  const { userId, username, timeMs } = body as { userId?: string; username?: string; timeMs?: number };
  if (!roomId || typeof timeMs !== "number") {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const uid = typeof userId === "string" ? userId : "anon";
  const name = typeof username === "string" ? username : "Player";
  recordFinished(roomId, uid, name, timeMs);
  broadcastFinished(roomId, { userId: uid, username: name, timeMs });
  return NextResponse.json({ ok: true });
}
