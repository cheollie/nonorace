import { getRoomState } from "@/lib/room-state";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  if (!roomId) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const state = await getRoomState(roomId);
  return NextResponse.json({
    startedAt: state?.startedAt ?? null,
    hostUserId: state?.hostUserId ?? null,
    finished: state?.finished ?? [],
    members: state?.members ?? [],
  });
}
