"use client";

import {
  checkSolved,
  createEmptyGrid,
  generatePuzzle,
  progressPercent,
  type CellState,
  type NonogramPuzzle,
} from "@/lib/nonogram";
import { subscribeRoom } from "@/lib/pusher-client";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameGrid } from "./GameGrid";

const SIZES = [2, 10, 15, 20] as const;
type Size = (typeof SIZES)[number];

type PlayerState = {
  username: string;
  percent: number | null;
  finishedTimeMs: number | null;
};

function getSize(searchParams: ReturnType<typeof useSearchParams>): Size {
  const s = searchParams.get("size");
  const n = s ? parseInt(s, 10) : 10;
  if (SIZES.includes(n as Size)) return n as Size;
  return 10;
}

function getUsername(): string {
  if (typeof window === "undefined") return "Player";
  return (localStorage.getItem("nono-username") || "Player").trim() || "Player";
}

function getUserId(): string {
  if (typeof window === "undefined") return "anon";
  let id = localStorage.getItem("nono-userid");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("nono-userid", id);
  }
  return id;
}

function formatTime(ms: number): string {
  return `${Math.floor(ms / 60000)}:${(Math.floor(ms / 1000) % 60).toString().padStart(2, "0")}.${Math.floor(ms / 100) % 10}`;
}

function UsernameForm({
  initialName,
  onSubmit,
  onContinueAsPlayer,
}: {
  initialName: string;
  onSubmit: (name: string) => void;
  onContinueAsPlayer: () => void;
}) {
  const [value, setValue] = useState(initialName);
  return (
    <div className="space-y-3">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Your name"
        className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-rose-500"
        onKeyDown={(e) => e.key === "Enter" && onSubmit(value)}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSubmit(value)}
          className="flex-1 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium"
        >
          Join
        </button>
        <button
          type="button"
          onClick={onContinueAsPlayer}
          className="py-2 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 text-sm"
        >
          Continue as Player
        </button>
      </div>
    </div>
  );
}

export default function RoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roomId = params.roomId as string;
  const size = getSize(searchParams);
  const isHost = searchParams.get("host") === "1";

  const puzzle = useMemo(() => generatePuzzle(roomId, size, size), [roomId, size]);
  const [grid, setGrid] = useState<CellState[][]>(() => createEmptyGrid(size, size));
  const [gameStartedAt, setGameStartedAt] = useState<number | null>(null);
  const [finishedTime, setFinishedTime] = useState<number | null>(null);
  const [displayTimeMs, setDisplayTimeMs] = useState(0);
  const [players, setPlayers] = useState<Record<string, PlayerState>>({});
  const sentJoin = useRef(false);
  const lastProgressSent = useRef(0);

  const USERNAME_CONFIRMED_KEY = "nono-username-confirmed";

  const userId = getUserId();
  const [username, setUsernameState] = useState("");
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(false);
  const [hasConfirmedUsername, setHasConfirmedUsername] = useState(false);

  // On mount: if they already confirmed this session (same tab), skip prompt. Else show prompt (new tab/browser).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const confirmed = sessionStorage.getItem(USERNAME_CONFIRMED_KEY);
    const saved = getUsername();
    setUsernameState(saved);
    if (confirmed) {
      setHasConfirmedUsername(true);
      setShowUsernamePrompt(false);
    } else {
      setShowUsernamePrompt(true);
    }
  }, []);

  const setUsername = useCallback((name: string) => {
    const v = (name || "Player").trim() || "Player";
    if (typeof window !== "undefined") {
      localStorage.setItem("nono-username", v);
      sessionStorage.setItem(USERNAME_CONFIRMED_KEY, "1");
    }
    setUsernameState(v);
    setHasConfirmedUsername(true);
    setShowUsernamePrompt(false);
  }, []);

  const usernameOrFallback = username || "Player";

  // Add self to players once username is confirmed
  useEffect(() => {
    if (showUsernamePrompt) return;
    setPlayers((prev) => ({
      ...prev,
      [userId]: { username: usernameOrFallback, percent: null, finishedTimeMs: null },
    }));
  }, [userId, usernameOrFallback, showUsernamePrompt]);

  // Timer: only run after game start; use shared gameStartedAt
  useEffect(() => {
    if (gameStartedAt == null) {
      setDisplayTimeMs(0);
      return;
    }
    if (finishedTime != null) {
      setDisplayTimeMs(finishedTime);
      return;
    }
    const t = setInterval(() => setDisplayTimeMs(Date.now() - gameStartedAt), 100);
    return () => clearInterval(t);
  }, [gameStartedAt, finishedTime]);

  // Report progress (throttled) — only after game started
  useEffect(() => {
    if (!roomId || gameStartedAt == null || finishedTime != null) return;
    const pct = progressPercent(grid, puzzle);
    const now = Date.now();
    if (now - lastProgressSent.current < 800) return;
    lastProgressSent.current = now;
    fetch(`/api/room/${roomId}/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, username: usernameOrFallback, percent: pct }),
    }).catch(() => {});
  }, [roomId, userId, usernameOrFallback, grid, puzzle, gameStartedAt, finishedTime]);

  // Join room once, only after user has confirmed username (so joiners see prompt first)
  useEffect(() => {
    if (!roomId || !hasConfirmedUsername || sentJoin.current) return;
    sentJoin.current = true;
    fetch(`/api/room/${roomId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, username: usernameOrFallback }),
    }).catch(() => {});
  }, [roomId, userId, usernameOrFallback, hasConfirmedUsername]);

  // Late joiner: fetch room state so we get gameStartedAt if the game already started
  useEffect(() => {
    if (!roomId) return;
    fetch(`/api/room/${roomId}/state`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.startedAt != null) setGameStartedAt(data.startedAt);
      })
      .catch(() => {});
  }, [roomId]);

  // Subscribe to room events
  useEffect(() => {
    if (!roomId) return;
    return subscribeRoom(
      roomId,
      (data) => {
        setPlayers((prev) => ({
          ...prev,
          [data.userId]: {
            ...(prev[data.userId] ?? { username: data.username, finishedTimeMs: null }),
            percent: data.percent,
          },
        }));
      },
      (data) => {
        setPlayers((prev) => ({
          ...prev,
          [data.userId]: prev[data.userId]
            ? { ...prev[data.userId], username: data.username }
            : { username: data.username, percent: null, finishedTimeMs: null },
        }));
      },
      (data) => {
        setPlayers((prev) => ({
          ...prev,
          [data.userId]: {
            ...(prev[data.userId] ?? { username: data.username, percent: null }),
            finishedTimeMs: data.timeMs,
          },
        }));
      },
      (data) => {
        setGameStartedAt(data.startedAt);
      }
    );
  }, [roomId]);

  const startGame = useCallback(() => {
    fetch(`/api/room/${roomId}/start`, { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.startedAt != null) setGameStartedAt(data.startedAt);
      })
      .catch(() => {});
  }, [roomId]);

  const onCellChange = useCallback(
    (r: number, c: number, state: CellState) => {
      if (gameStartedAt == null || finishedTime != null) return;
      setGrid((prev) => {
        const next = prev.map((row, i) =>
          i === r ? row.map((cell, j) => (j === c ? state : cell)) : row
        );
        if (checkSolved(next, puzzle)) {
          const timeMs = Date.now() - gameStartedAt;
          setFinishedTime(timeMs);
          fetch(`/api/room/${roomId}/finished`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, username: usernameOrFallback, timeMs }),
          }).catch(() => {});
        }
        return next;
      });
    },
    [puzzle, gameStartedAt, finishedTime, roomId, userId, usernameOrFallback]
  );

  const roomLink = typeof window !== "undefined" ? `${window.location.origin}/room/${roomId}?size=${size}` : "";
  const canPlay = gameStartedAt != null;
  const playerList = Object.entries(players);
  const finishedList = playerList
    .filter(([, p]) => p.finishedTimeMs != null)
    .sort((a, b) => (a[1].finishedTimeMs ?? 0) - (b[1].finishedTimeMs ?? 0));
  const winner = finishedList[0];
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  return (
    <main className="min-h-screen p-4 md:p-6">
      {/* Username prompt when joining via link (no name set or still "Player") */}
      {showUsernamePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-xl bg-[#1a1a2e] border border-white/20 p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-white mb-2">What’s your name?</h2>
            <p className="text-sm text-gray-400 mb-4">So others in the room can see who joined.</p>
            <UsernameForm
              initialName={usernameOrFallback}
              onSubmit={setUsername}
              onContinueAsPlayer={() => setUsername("Player")}
            />
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-4 flex-wrap">
            <a href="/" className="text-gray-400 hover:text-white transition">
              ← Home
            </a>
            <a
              href="/"
              className="text-sm px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-gray-300 transition"
            >
              Leave
            </a>
            <span className="text-gray-500">|</span>
            <span className="text-sm text-gray-400">
              Room: {roomId.slice(0, 8)}… · {size}×{size}
              {isHost && <span className="ml-1 text-rose-400">(Host)</span>}
            </span>
            <button
              type="button"
              onClick={() => setShowHowToPlay((v) => !v)}
              className="text-gray-400 hover:text-white transition w-8 h-8 rounded-full flex items-center justify-center border border-white/20 hover:bg-white/10"
              title="How to play"
            >
              ?
            </button>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-lg font-mono tabular-nums text-white">
              {gameStartedAt == null ? "—" : formatTime(displayTimeMs)}
            </span>
            <button
              type="button"
              onClick={() => roomLink && navigator.clipboard.writeText(roomLink)}
              className="text-sm px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 transition"
            >
              Copy link
            </button>
          </div>
        </div>

        {showHowToPlay && (
          <div className="mb-4 p-4 rounded-lg bg-white/10 border border-white/20 text-sm text-gray-300 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-white">How to play</span>
              <button
                type="button"
                onClick={() => setShowHowToPlay(false)}
                className="text-gray-400 hover:text-white"
              >
                ×
              </button>
            </div>
            <p>Fill cells to match the row and column clues. Each number is a run of filled cells; <code className="text-rose-400">0</code> means no filled cells in that row/column.</p>
            <p><strong>Tap/click:</strong> 1st = black (filled), 2nd = X (empty for sure), 3rd = clear.</p>
            <p><strong>Drag:</strong> Press and drag to paint multiple cells — starts black or X depending on the cell you started on.</p>
            <p>Only the black cells are checked; first to finish with all correct filled cells wins.</p>
          </div>
        )}

        {gameStartedAt == null && (
          <div className="mb-4 p-4 rounded-lg bg-white/10 border border-white/20">
            {isHost ? (
              <>
                <p className="text-gray-300 mb-2">Players in room ({playerList.length})</p>
                <ul className="list-disc list-inside text-gray-400 text-sm mb-3">
                  {playerList.map(([id, p]) => (
                    <li key={id}>
                      {p.username}
                      {id === userId && " (you)"}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={startGame}
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium"
                >
                  Start game
                </button>
              </>
            ) : (
              <p className="text-gray-300">Waiting for host to start the game…</p>
            )}
          </div>
        )}

        {canPlay && finishedList.length > 0 && (
          <div className="mb-4 p-4 rounded-lg bg-white/10 border border-white/20">
            <p className="text-sm text-gray-400 mb-2">Finished</p>
            <ul className="space-y-1">
              {finishedList.map(([id, p], i) => (
                <li key={id} className="text-white">
                  {i + 1}. {p.username}
                  {id === userId && " (you)"} — {(p.finishedTimeMs! / 1000).toFixed(1)}s
                  {winner && winner[0] === id && <span className="text-green-400 ml-1">✓</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className={!canPlay ? "opacity-60 pointer-events-none" : ""}>
          <GameGrid
            puzzle={puzzle}
            grid={grid}
            onCellChange={onCellChange}
            disabled={finishedTime != null}
          />
        </div>

        {canPlay && playerList.length > 0 && (
          <div className="mt-4 rounded-lg bg-white/5 border border-white/10 overflow-hidden">
            <p className="text-xs text-gray-500 uppercase tracking-wider px-4 py-2 border-b border-white/10">
              Players
            </p>
            <ul className="divide-y divide-white/10">
              {playerList.map(([id, p]) => (
                <li key={id} className="px-4 py-3 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-white font-medium truncate">
                      {p.username}
                      {id === userId && (
                        <span className="ml-1.5 text-gray-400 font-normal text-sm">(you)</span>
                      )}
                    </span>
                    {p.finishedTimeMs != null ? (
                      <span className="text-green-400 text-sm font-mono tabular-nums shrink-0">
                        {(p.finishedTimeMs / 1000).toFixed(1)}s
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm tabular-nums shrink-0">
                        {(p.percent ?? 0)}%
                      </span>
                    )}
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-rose-500/80 transition-all duration-300"
                      style={{
                        width: `${p.finishedTimeMs != null ? 100 : (p.percent ?? 0)}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
