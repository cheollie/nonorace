import { broadcastJoin } from "@/lib/pusher-server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const body = await _req.json();
  const { userId, username } = body as { userId?: string; username?: string };
  if (!roomId) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  broadcastJoin(roomId, {
    userId: typeof userId === "string" ? userId : "anon",
    username: typeof username === "string" ? username : "Player",
  });
  return NextResponse.json({ ok: true });
}
