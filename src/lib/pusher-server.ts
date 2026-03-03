import Pusher from "pusher";

function getPusher(): Pusher | null {
  const key = process.env.PUSHER_APP_KEY ?? process.env.NEXT_PUBLIC_PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const appId = process.env.PUSHER_APP_ID;
  const cluster =
    process.env.PUSHER_CLUSTER ??
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER ??
    "us2";
  if (!key || !secret || !appId) return null;
  return new Pusher({
    appId,
    key,
    secret,
    cluster,
    useTLS: true,
  });
}

export function getPusherChannel(roomId: string): string {
  return `room-${roomId}`;
}

export function broadcastProgress(roomId: string, payload: { userId: string; username: string; percent: number }) {
  const pusher = getPusher();
  if (!pusher) return;
  pusher.trigger(getPusherChannel(roomId), "progress", payload);
}

export function broadcastJoin(roomId: string, payload: { userId: string; username: string }) {
  const pusher = getPusher();
  if (!pusher) return;
  pusher.trigger(getPusherChannel(roomId), "player-join", payload);
}

export function broadcastFinished(roomId: string, payload: { userId: string; username: string; timeMs: number }) {
  const pusher = getPusher();
  if (!pusher) return;
  pusher.trigger(getPusherChannel(roomId), "finished", payload);
}

export function broadcastGameStart(roomId: string, payload: { startedAt: number }) {
  const pusher = getPusher();
  if (!pusher) return;
  pusher.trigger(getPusherChannel(roomId), "game-start", payload);
}
