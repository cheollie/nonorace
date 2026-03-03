import { broadcastProgress } from "@/lib/pusher-server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const body = await _req.json();
  const { userId, username, percent } = body as { userId?: string; username?: string; percent?: number };
  if (!roomId || typeof percent !== "number") {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  broadcastProgress(roomId, {
    userId: typeof userId === "string" ? userId : "anon",
    username: typeof username === "string" ? username : "Player",
    percent: Math.min(100, Math.max(0, percent)),
  });
  return NextResponse.json({ ok: true });
}
