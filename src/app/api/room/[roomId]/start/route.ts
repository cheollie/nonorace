import { broadcastGameStart } from "@/lib/pusher-server";
import { getRoomState, setRoomStarted } from "@/lib/room-state";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  if (!roomId) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const userId = typeof (body as { userId?: string }).userId === "string" ? (body as { userId: string }).userId : null;
  const state = await getRoomState(roomId);
  if (state && state.hostUserId != null && userId !== state.hostUserId) {
    return NextResponse.json({ error: "Only the host can start the game" }, { status: 403 });
  }
  const startedAt = Date.now();
  await setRoomStarted(roomId, startedAt);
  broadcastGameStart(roomId, { startedAt });
  return NextResponse.json({ ok: true, startedAt });
}
