import { broadcastJoin, broadcastHostChanged, broadcastRoomSync } from "@/lib/pusher-server";
import { addMember, getRoomState, recordFinished } from "@/lib/room-state";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const body = await _req.json().catch(() => ({}));
  const { userId, username, host, size: bodySize, finishedTimeMs: bodyFinishedMs } = body as {
    userId?: string;
    username?: string;
    host?: boolean;
    size?: number;
    finishedTimeMs?: number;
  };
  const uid = typeof userId === "string" ? userId : "anon";
  const name = (typeof username === "string" ? username : "Player").trim() || "Player";
  if (!roomId) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { isHost } = await addMember(roomId, uid, host === true, name, bodySize);
  if (typeof bodyFinishedMs === "number") {
    await recordFinished(roomId, uid, name, bodyFinishedMs);
  }
  const state = await getRoomState(roomId);
  const finishedEntry = state?.finished?.find((e) => e.userId === uid);
  broadcastJoin(roomId, {
    userId: uid,
    username: name,
    ...(finishedEntry && { finishedTimeMs: finishedEntry.timeMs }),
  });
  broadcastHostChanged(roomId, { hostUserId: state?.hostUserId ?? null });
  broadcastRoomSync(roomId, {
    members: state?.members ?? [],
    hostUserId: state?.hostUserId ?? null,
    startedAt: state?.startedAt ?? null,
    size: state?.size ?? null,
    finished: state?.finished ?? [],
  });
  return NextResponse.json({
    ok: true,
    startedAt: state?.startedAt ?? null,
    size: state?.size ?? null,
    hostUserId: state?.hostUserId ?? null,
    isHost,
    finished: state?.finished ?? [],
    members: state?.members ?? [],
  });
}
