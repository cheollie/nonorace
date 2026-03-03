"use client";

import Pusher from "pusher-js";

let pusher: Pusher | null = null;

export function getPusherClient(): Pusher | null {
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? "us2";
  if (!key) return null;
  if (!pusher) {
    pusher = new Pusher(key, {
      cluster,
      forceTLS: true,
    });
  }
  return pusher;
}

export function subscribeRoom(
  roomId: string,
  onProgress: (data: { userId: string; username: string; percent: number }) => void,
  onJoin: (data: { userId: string; username: string }) => void,
  onFinished: (data: { userId: string; username: string; timeMs: number }) => void,
  onGameStart: (data: { startedAt: number }) => void
): (() => void) {
  const client = getPusherClient();
  if (!client) return () => {};
  const channelName = `room-${roomId}`;
  const channel = client.subscribe(channelName);

  channel.bind("progress", onProgress);
  channel.bind("player-join", onJoin);
  channel.bind("finished", onFinished);
  channel.bind("game-start", onGameStart);

  return () => {
    channel.unbind_all();
    client.unsubscribe(channelName);
  };
}
