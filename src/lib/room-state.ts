/**
 * In-memory room state so late joiners can get game start time.
 * Serverless: may not persist across instances; best-effort.
 */
const roomState = new Map<string, { startedAt: number }>();

export function setRoomStarted(roomId: string, startedAt: number): void {
  roomState.set(roomId, { startedAt });
}

export function getRoomState(roomId: string): { startedAt: number } | null {
  return roomState.get(roomId) ?? null;
}
