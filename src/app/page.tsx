"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

const SIZES = [2, 10, 15, 20] as const;
type Size = (typeof SIZES)[number];

export default function HomePage() {
  const router = useRouter();
  const [joinInput, setJoinInput] = useState("");
  const [size, setSize] = useState<Size>(10);

  const createRoom = useCallback(() => {
    const roomId = crypto.randomUUID();
    router.push(`/room/${roomId}?size=${size}&host=1`);
  }, [size, router]);

  const joinRoom = useCallback(() => {
    const raw = joinInput.trim();
    // Allow pasting full URL or just room id
    let roomId: string;
    let joinSize: number = 10;
    try {
      if (raw.startsWith("http")) {
        const u = new URL(raw);
        const pathRoom = u.pathname.split("/").filter(Boolean);
        roomId = pathRoom[pathRoom.length - 1] ?? "";
        joinSize = Math.min(20, Math.max(2, parseInt(u.searchParams.get("size") ?? "10", 10) || 10));
      } else {
        roomId = raw;
        joinSize = size;
      }
      if (!roomId) return;
      if (![2, 10, 15, 20].includes(joinSize)) joinSize = 10;
      router.push(`/room/${roomId}?size=${joinSize}`);
    } catch {
      if (raw) router.push(`/room/${raw}?size=${size}`);
    }
  }, [joinInput, size, router]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <h1 className="text-4xl font-bold text-center mb-2">Nonogram 1v1</h1>
      <p className="text-gray-400 text-center mb-8">Create a room, send the link. Host starts when everyone’s in; shared timer, first to finish wins.</p>

      <div className="w-full max-w-sm space-y-4">
        <div className="border-t border-white/10 pt-4 first:border-t-0 first:pt-0">
          <p className="text-sm text-gray-400 mb-2">Create room</p>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {SIZES.map((s) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className={`py-2 rounded-lg font-medium transition ${size === s ? "bg-rose-600 text-white" : "bg-white/10 text-gray-300 hover:bg-white/20"}`}
              >
                {s}×{s}
              </button>
            ))}
          </div>
          <button
            onClick={createRoom}
            className="w-full py-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium transition"
          >
            Create room
          </button>
        </div>

        <div className="border-t border-white/10 pt-4">
          <p className="text-sm text-gray-400 mb-2">Join with link</p>
          <input
            type="text"
            placeholder="Paste room link or room ID"
            value={joinInput}
            onChange={(e) => setJoinInput(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-rose-500 mb-2"
          />
          <button
            onClick={joinRoom}
            className="w-full py-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium border border-white/20 transition"
          >
            Join room
          </button>
        </div>
      </div>
    </main>
  );
}
