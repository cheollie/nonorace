/**
 * In-memory room state: game start time, host, members (with usernames), and finished times for reload.
 * Serverless: may not persist across instances; best-effort.
 */
export type FinishedEntry = { userId: string; username: string; timeMs: number };
export type MemberEntry = { userId: string; username: string };

type RoomData = {
  startedAt?: number;
  hostUserId: string | null;
  members: MemberEntry[];
  finished: FinishedEntry[];
};

const roomState = new Map<string, RoomData>();

function getOrCreate(roomId: string): RoomData {
  let data = roomState.get(roomId);
  if (!data) {
    data = { hostUserId: null, members: [], finished: [] };
    roomState.set(roomId, data);
  }
  return data;
}

export function setRoomStarted(roomId: string, startedAt: number): void {
  const data = getOrCreate(roomId);
  data.startedAt = startedAt;
}

export function recordFinished(
  roomId: string,
  userId: string,
  username: string,
  timeMs: number
): void {
  const data = getOrCreate(roomId);
  const existing = data.finished.findIndex((e) => e.userId === userId);
  if (existing >= 0) data.finished[existing] = { userId, username, timeMs };
  else data.finished.push({ userId, username, timeMs });
}

export function getRoomState(roomId: string): {
  startedAt: number | null;
  hostUserId: string | null;
  members: MemberEntry[];
  finished: FinishedEntry[];
} | null {
  const data = roomState.get(roomId);
  if (!data) return null;
  return {
    startedAt: data.startedAt ?? null,
    hostUserId: data.hostUserId,
    members: [...data.members],
    finished: [...data.finished],
  };
}

/** Add member with username. Only the first claimHost (room creator) becomes host; later joiners with host=1 cannot steal it. If no host yet and no claimHost, first joiner becomes host. */
export function addMember(
  roomId: string,
  userId: string,
  claimHost: boolean,
  username: string
): { isHost: boolean } {
  const data = getOrCreate(roomId);
  const existing = data.members.findIndex((m) => m.userId === userId);
  const entry = { userId, username: username || "Player" };
  if (existing >= 0) data.members[existing] = entry;
  else data.members.push(entry);
  // Only set host if: no host yet, or claimer is re-joining as current host (e.g. refresh). Never let a new joiner overwrite existing host.
  if (claimHost && (!data.hostUserId || data.hostUserId === userId)) {
    data.hostUserId = userId;
  } else if (!data.hostUserId) {
    data.hostUserId = userId;
  }
  return { isHost: data.hostUserId === userId };
}

/** Remove member; if they were host, assign next member as host. */
export function removeMember(roomId: string, userId: string): void {
  const data = roomState.get(roomId);
  if (!data) return;
  const wasHost = data.hostUserId === userId;
  data.members = data.members.filter((m) => m.userId !== userId);
  if (wasHost) {
    data.hostUserId = data.members.length > 0 ? data.members[0].userId : null;
  }
}
