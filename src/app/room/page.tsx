"use client";

import { RoomScreen } from "./RoomScreen";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

const SIZES = [2, 10, 15, 20] as const;
type Size = (typeof SIZES)[number];

function getSize(searchParams: ReturnType<typeof useSearchParams>): Size {
  const s = searchParams.get("size");
  const n = s ? parseInt(s, 10) : 10;
  if (SIZES.includes(n as Size)) return n as Size;
  return 10;
}

function RoomPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code")?.trim().toUpperCase() ?? "";
  const size = getSize(searchParams);
  const isHostFromUrl = searchParams.get("host") === "1";
  const [joinCode, setJoinCode] = useState("");

  if (code) {
    return <RoomScreen roomId={code} size={size} isHostFromUrl={isHostFromUrl} />;
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-bold text-white mb-2">Join a room</h1>
      <p className="text-gray-400 text-center mb-6 max-w-sm">
        Enter the room code your friend shared (e.g. <span className="font-mono text-rose-400">ABCDEF</span>).
      </p>
      <div className="w-full max-w-sm space-y-3">
        <input
          type="text"
          placeholder="Room code"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.replace(/\s/g, "").toUpperCase().slice(0, 12))}
          className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white text-center font-mono text-lg tracking-widest placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-rose-500"
          onKeyDown={(e) => e.key === "Enter" && joinCode && router.push(`/room?code=${joinCode}&size=${size}`)}
        />
        <button
          type="button"
          onClick={() => joinCode && router.push(`/room?code=${joinCode}&size=${size}`)}
          disabled={!joinCode.trim()}
          className="w-full py-3 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition"
        >
          Join room
        </button>
      </div>
      <a href="/" className="mt-6 text-gray-400 hover:text-white transition text-sm">
        ← Back to home
      </a>
    </main>
  );
}

export default function RoomPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>}>
      <RoomPageContent />
    </Suspense>
  );
}
