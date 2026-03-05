import { broadcastHostChanged, broadcastPlayerLeft, broadcastRoomSync } from "@/lib/pusher-server";
import { getRoomState, removeMember } from "@/lib/room-state";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const body = await _req.json().catch(() => ({}));
  const userId = (body as { userId?: string }).userId;
  const uid = typeof userId === "string" ? userId : "anon";
  if (!roomId) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  await removeMember(roomId, uid);
  broadcastPlayerLeft(roomId, { userId: uid });
  const state = await getRoomState(roomId);
  const hostUserId = state?.hostUserId ?? null;
  broadcastHostChanged(roomId, { hostUserId });
  broadcastRoomSync(roomId, {
    members: state?.members ?? [],
    hostUserId,
    startedAt: state?.startedAt ?? null,
    finished: state?.finished ?? [],
  });
  return NextResponse.json({ ok: true });
}
