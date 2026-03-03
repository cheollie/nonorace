import { broadcastGameStart } from "@/lib/pusher-server";
import { setRoomStarted } from "@/lib/room-state";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  if (!roomId) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const startedAt = Date.now();
  setRoomStarted(roomId, startedAt);
  broadcastGameStart(roomId, { startedAt });
  return NextResponse.json({ ok: true, startedAt });
}
