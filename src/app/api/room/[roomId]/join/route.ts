import { broadcastJoin } from "@/lib/pusher-server";
import { addMember, getRoomState, recordFinished } from "@/lib/room-state";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const body = await _req.json().catch(() => ({}));
  const { userId, username, host, finishedTimeMs: bodyFinishedMs } = body as {
    userId?: string;
    username?: string;
    host?: boolean;
    finishedTimeMs?: number;
  };
  const uid = typeof userId === "string" ? userId : "anon";
  const name = (typeof username === "string" ? username : "Player").trim() || "Player";
  if (!roomId) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { isHost } = addMember(roomId, uid, host === true, name);
  if (typeof bodyFinishedMs === "number") {
    recordFinished(roomId, uid, name, bodyFinishedMs);
  }
  const state = getRoomState(roomId);
  const finishedEntry = state?.finished?.find((e) => e.userId === uid);
  broadcastJoin(roomId, {
    userId: uid,
    username: name,
    ...(finishedEntry && { finishedTimeMs: finishedEntry.timeMs }),
  });
  return NextResponse.json({
    ok: true,
    startedAt: state?.startedAt ?? null,
    hostUserId: state?.hostUserId ?? null,
    isHost,
    finished: state?.finished ?? [],
    members: state?.members ?? [],
  });
}
