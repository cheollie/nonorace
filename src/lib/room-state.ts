/**
 * Room state: game start time, host, members, finished. Uses Upstash Redis when
 * UPSTASH_REDIS_REST_URL is set (e.g. Vercel + Upstash integration); falls back to in-memory for local dev.
 */
export type FinishedEntry = { userId: string; username: string; timeMs: number };
export type MemberEntry = { userId: string; username: string };

export type RoomData = {
  startedAt?: number;
  size: number | null;
  hostUserId: string | null;
  creatorUserId: string | null;
  members: MemberEntry[];
  finished: FinishedEntry[];
};

const ROOM_KEY_PREFIX = "nono:room:";
const defaultRoom = (): RoomData => ({
  hostUserId: null,
  creatorUserId: null,
  size: null,
  members: [],
  finished: [],
});

// In-memory fallback when Upstash env vars are not set (e.g. local dev)
const memoryStore = new Map<string, RoomData>();

function roomKey(roomId: string): string {
  return `${ROOM_KEY_PREFIX}${roomId}`;
}

function hasUpstashConfig(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

let redisClient: Awaited<ReturnType<typeof createRedis>> | null = null;

async function createRedis() {
  const { Redis } = await import("@upstash/redis");
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

async function getRedis(): Promise<Awaited<ReturnType<typeof createRedis>> | null> {
  if (!hasUpstashConfig()) return null;
  if (redisClient) return redisClient;
  try {
    redisClient = await createRedis();
    return redisClient;
  } catch {
    return null;
  }
}

async function getRoomRaw(roomId: string): Promise<RoomData | null> {
  const redis = await getRedis();
  if (redis) {
    try {
      const data = await redis.get<RoomData>(roomKey(roomId));
      return (data ?? null) as RoomData | null;
    } catch {
      return memoryStore.get(roomId) ?? null;
    }
  }
  return memoryStore.get(roomId) ?? null;
}

async function setRoomRaw(roomId: string, data: RoomData): Promise<void> {
  const copy: RoomData = {
    ...data,
    members: [...data.members],
    finished: [...data.finished],
  };
  const redis = await getRedis();
  if (redis) {
    try {
      await redis.set(roomKey(roomId), copy);
      return;
    } catch {
      memoryStore.set(roomId, copy);
      return;
    }
  }
  memoryStore.set(roomId, copy);
}

async function getOrCreate(roomId: string): Promise<RoomData> {
  const data = await getRoomRaw(roomId);
  if (data) return data;
  const newRoom = defaultRoom();
  await setRoomRaw(roomId, newRoom);
  return newRoom;
}

export async function setRoomStarted(roomId: string, startedAt: number): Promise<void> {
  const data = await getOrCreate(roomId);
  data.startedAt = startedAt;
  await setRoomRaw(roomId, data);
}

export async function recordFinished(
  roomId: string,
  userId: string,
  username: string,
  timeMs: number
): Promise<void> {
  const data = await getRoomRaw(roomId);
  if (!data) return; // room doesn't exist (e.g. serverless cold start); don't create an empty room and overwrite
  const existing = data.finished.findIndex((e) => e.userId === userId);
  if (existing >= 0) data.finished[existing] = { userId, username, timeMs };
  else data.finished.push({ userId, username, timeMs });
  await setRoomRaw(roomId, data);
}

export async function getRoomState(roomId: string): Promise<{
  startedAt: number | null;
  size: number | null;
  hostUserId: string | null;
  members: MemberEntry[];
  finished: FinishedEntry[];
} | null> {
  const data = await getRoomRaw(roomId);
  if (!data) return null;
  return {
    startedAt: data.startedAt ?? null,
    size: data.size ?? null,
    hostUserId: data.hostUserId,
    members: [...data.members],
    finished: [...data.finished],
  };
}

const VALID_SIZES = [2, 10, 15, 20] as const;

/** Add member. Only room creator (first claimHost) is ever host. Size is set when creator first joins. */
export async function addMember(
  roomId: string,
  userId: string,
  claimHost: boolean,
  username: string,
  size?: number
): Promise<{ isHost: boolean }> {
  const data = await getOrCreate(roomId);
  const existing = data.members.findIndex((m) => m.userId === userId);
  const name = (username && username.trim() !== "" && username.trim() !== "Player") ? username.trim() : "Player";
  if (existing >= 0) {
    const keep = data.members[existing];
    data.members[existing] = { userId, username: name !== "Player" ? name : keep.username };
  } else {
    data.members.push({ userId, username: name });
  }
  if (claimHost) {
    if (!data.creatorUserId) {
      data.creatorUserId = userId;
      data.hostUserId = userId;
      if (typeof size === "number" && VALID_SIZES.includes(size as (typeof VALID_SIZES)[number])) {
        data.size = size;
      }
    } else if (data.creatorUserId === userId) {
      data.hostUserId = userId;
    }
  }
  await setRoomRaw(roomId, data);
  return { isHost: data.hostUserId === userId };
}

/** Remove member. Host/creator are never reassigned; they stay set for the life of the room. */
export async function removeMember(roomId: string, userId: string): Promise<void> {
  const data = await getRoomRaw(roomId);
  if (!data) return;
  data.members = data.members.filter((m) => m.userId !== userId);
  await setRoomRaw(roomId, data);
}
