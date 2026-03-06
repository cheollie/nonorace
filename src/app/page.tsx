"use client";

import { HowToPlayText } from "@/components/HowToPlay";
import { generateRoomCode } from "@/lib/room-code";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

const SIZES = [2, 10, 15, 20] as const;
type Size = (typeof SIZES)[number];

export default function HomePage() {
  const router = useRouter();
  const [joinInput, setJoinInput] = useState("");
  const [size, setSize] = useState<Size>(10);

  const createRoom = useCallback(() => {
    const code = generateRoomCode(6);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`nono-creator-${code}`, "1");
      sessionStorage.setItem(`nono-room-size-${code}`, String(size));
    }
    router.push(`/room?code=${code}`);
  }, [size, router]);

  const joinRoom = useCallback(() => {
    const raw = joinInput.trim();
    let code: string;
    try {
      if (raw.startsWith("http")) {
        const u = new URL(raw);
        code = (u.searchParams.get("code") ?? "").trim().toUpperCase();
      } else {
        code = raw.replace(/\s/g, "").toUpperCase();
      }
      if (!code) return;
      router.push(`/room?code=${code}`);
    } catch {
      if (raw) router.push(`/room?code=${raw.replace(/\s/g, "").toUpperCase()}`);
    }
  }, [joinInput, router]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <h1 className="text-4xl font-bold text-center mb-2">Nonorace</h1>
      <p className="text-gray-400 text-center mb-6 max-w-md">
        A nonogram (picross) game: use the row and column number clues to fill the grid.
      </p>

      <section className="w-full max-w-md mb-8 p-4 rounded-lg bg-white/5 border border-white/10">
        <h2 className="text-sm font-medium text-gray-300 mb-2">How to play</h2>
        <HowToPlayText />
      </section>

      <div className="w-full max-w-sm space-y-4">
        <section className="border-t border-white/10 pt-4 first:border-t-0 first:pt-0">
          <h2 className="text-sm font-medium text-gray-300 mb-2">Daily</h2>
          <p className="text-xs text-gray-500 mb-2">One puzzle per size per day (Eastern). Play solo and share your time.</p>
          <div className="grid grid-cols-4 gap-2 mb-2">
            {SIZES.map((s) => (
              <a
                key={s}
                href={`/daily?size=${s}`}
                className="py-2 rounded-lg font-medium transition text-center bg-amber-600/20 hover:bg-amber-600/40 text-amber-200 border border-amber-500/30"
              >
                {s}×{s}
              </a>
            ))}
          </div>
        </section>

        <section className="border-t border-white/10 pt-4">
          <h2 className="text-sm font-medium text-gray-300 mb-2">Multiplayer</h2>
          <p className="text-xs text-gray-500 mb-3">Create a room and share the link; host starts the timer. First to finish wins.</p>
          <p className="text-xs text-gray-500 mb-2">Create room</p>
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
          <p className="text-xs text-gray-500 mb-2 mt-4">Join with link or code</p>
          <input
            type="text"
            placeholder="Paste link or enter code (e.g. ABCDEF)"
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
        </section>
      </div>
    </main>
  );
}
