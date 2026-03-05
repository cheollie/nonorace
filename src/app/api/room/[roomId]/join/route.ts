import { broadcastJoin, broadcastHostChanged, broadcastRoomSync } from "@/lib/pusher-server";
import { addMember, recordFinished } from "@/lib/room-state";
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
  const { isHost, state } = await addMember(roomId, uid, host === true, name, bodySize);
  let finalState = state;
  if (typeof bodyFinishedMs === "number") {
    await recordFinished(roomId, uid, name, bodyFinishedMs);
    finalState = { ...state, finished: [...state.finished.filter((e) => e.userId !== uid), { userId: uid, username: name, timeMs: bodyFinishedMs }] };
  }
  const finishedEntry = finalState.finished.find((e) => e.userId === uid);
  broadcastJoin(roomId, {
    userId: uid,
    username: name,
    ...(finishedEntry && { finishedTimeMs: finishedEntry.timeMs }),
  });
  broadcastHostChanged(roomId, { hostUserId: finalState.hostUserId ?? null });
  broadcastRoomSync(roomId, {
    members: finalState.members,
    hostUserId: finalState.hostUserId ?? null,
    startedAt: finalState.startedAt ?? null,
    size: finalState.size ?? null,
    finished: finalState.finished,
  });
  return NextResponse.json({
    ok: true,
    startedAt: finalState.startedAt ?? null,
    size: finalState.size ?? null,
    hostUserId: finalState.hostUserId ?? null,
    isHost,
    finished: finalState.finished,
    members: finalState.members,
  });
}
