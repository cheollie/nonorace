"use client";

import {
  checkSolved,
  createEmptyGrid,
  generatePuzzle,
  getViolations,
  progressPercent,
  type CellState,
  type NonogramPuzzle,
} from "@/lib/nonogram";
import { subscribeRoom } from "@/lib/pusher-client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameGrid } from "./GameGrid";

const SIZES = [2, 10, 15, 20] as const;
type Size = (typeof SIZES)[number];

type PlayerState = {
  username: string;
  percent: number | null;
  finishedTimeMs: number | null;
};

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
  value,
  onChange,
  onSubmit,
  onContinueAsPlayer,
}: {
  value: string;
  onChange: (name: string) => void;
  onSubmit: (name: string) => void;
  onContinueAsPlayer: () => void;
}) {
  return (
    <div className="space-y-3">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
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

export function RoomScreen({
  roomId,
  size,
  isHostFromUrl,
}: {
  roomId: string;
  size: Size;
  isHostFromUrl: boolean;
}) {
  const router = useRouter();

  const puzzle = useMemo(() => generatePuzzle(roomId, size, size), [roomId, size]);

  // Neutral initial state so server and client match (avoids hydration mismatch)
  const [grid, setGrid] = useState<CellState[][]>(() => createEmptyGrid(size, size));
  const [gameStartedAt, setGameStartedAtState] = useState<number | null>(null);
  const setGameStartedAt = useCallback((value: number | null) => {
    setGameStartedAtState(value);
    if (typeof window !== "undefined") {
      const key = `nono-started-${roomId}`;
      if (value == null) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, String(value));
    }
  }, [roomId]);

  // After mount: restore grid and game start from storage (client-only)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const key = `nono-grid-${roomId}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const data = JSON.parse(raw) as { rows: number; cols: number; grid: CellState[][] };
        if (data.rows === size && data.cols === size && Array.isArray(data.grid) && data.grid.length === size && data.grid[0]?.length === size) {
          setGrid(data.grid);
          lastProgressSent.current = 0;
        }
      }
    } catch {
      /* ignore */
    }
    const startedKey = `nono-started-${roomId}`;
    const s = sessionStorage.getItem(startedKey);
    if (s) {
      const n = Number(s);
      if (!Number.isNaN(n)) setGameStartedAtState(n);
    }
  }, [roomId, size]);

  const [serverHostUserId, setServerHostUserId] = useState<string | null>(null);
  const [finishedTime, setFinishedTime] = useState<number | null>(null);
  const [displayTimeMs, setDisplayTimeMs] = useState(0);
  const [players, setPlayers] = useState<Record<string, PlayerState>>({});
  const sentJoin = useRef(false);
  const lastProgressSent = useRef(0);
  const lastPercentRef = useRef(0);

  const USERNAME_CONFIRMED_KEY = "nono-username-confirmed";

  const userId = getUserId();
  const isHost = serverHostUserId === userId;
  const [username, setUsernameState] = useState("");
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(false);
  const [hasConfirmedUsername, setHasConfirmedUsername] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = getUsername();
    setUsernameState(saved);
    setShowUsernamePrompt(true);
    setHasConfirmedUsername(false);
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

  useEffect(() => {
    if (showUsernamePrompt) return;
    setPlayers((prev) => ({
      ...prev,
      [userId]: {
        username: usernameOrFallback,
        percent: prev[userId]?.percent ?? null,
        finishedTimeMs: prev[userId]?.finishedTimeMs ?? null,
      },
    }));
  }, [userId, usernameOrFallback, showUsernamePrompt]);

  const gridSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    gridSaveRef.current && clearTimeout(gridSaveRef.current);
    gridSaveRef.current = setTimeout(() => {
      const key = `nono-grid-${roomId}`;
      try {
        localStorage.setItem(key, JSON.stringify({ rows: size, cols: size, grid }));
      } catch {
        /* ignore */
      }
      gridSaveRef.current = null;
    }, 500);
    return () => {
      if (gridSaveRef.current) clearTimeout(gridSaveRef.current);
    };
  }, [roomId, size, grid]);

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

  useEffect(() => {
    if (!roomId || gameStartedAt == null || finishedTime != null) return;
    const pct = progressPercent(grid, puzzle);
    lastPercentRef.current = pct;
    const now = Date.now();
    if (now - lastProgressSent.current < 800) return;
    lastProgressSent.current = now;
    fetch(`/api/room/${roomId}/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, username: getUsername(), percent: pct }),
    }).catch(() => {});
  }, [roomId, userId, grid, puzzle, gameStartedAt, finishedTime]);

  const applyStateToPlayers = useCallback(
    (data: {
      members?: { userId: string; username: string }[];
      finished?: { userId: string; username: string; timeMs: number }[];
    }) => {
      const members = Array.isArray(data?.members) ? data.members : [];
      const list = Array.isArray(data?.finished) ? data.finished : [];
      setPlayers((prev) => {
        const next: Record<string, PlayerState> = {};
        for (const m of members) {
          next[m.userId] = {
            username: m.username,
            percent: prev[m.userId]?.percent ?? null,
            finishedTimeMs: prev[m.userId]?.finishedTimeMs ?? null,
          };
        }
        for (const f of list) {
          const existing = next[f.userId];
          next[f.userId] = {
            username: f.username,
            percent: existing?.percent ?? prev[f.userId]?.percent ?? null,
            finishedTimeMs: f.timeMs,
          };
        }
        return next;
      });
      const myEntry = list.find((f: { userId: string }) => f.userId === userId);
      if (myEntry) {
        setFinishedTime(myEntry.timeMs);
        if (typeof window !== "undefined") {
          sessionStorage.setItem(`nono-finished-${roomId}`, String(myEntry.timeMs));
        }
      }
    },
    [userId, roomId]
  );

  const applyFullState = useCallback(
    (data: {
      startedAt?: number | null;
      hostUserId?: string | null;
      members?: { userId: string; username: string }[];
      finished?: { userId: string; username: string; timeMs: number }[];
    }) => {
      if (data?.startedAt != null) setGameStartedAt(data.startedAt);
      if (data?.hostUserId !== undefined) setServerHostUserId(data.hostUserId ?? null);
      if (Array.isArray(data?.members) || Array.isArray(data?.finished)) applyStateToPlayers(data);
    },
    [setGameStartedAt, applyStateToPlayers]
  );

  const applyFullStateRef = useRef(applyFullState);
  applyFullStateRef.current = applyFullState;

  useEffect(() => {
    if (!roomId || !hasConfirmedUsername || sentJoin.current) return;
    sentJoin.current = true;
    const nameToSend = getUsername();
    fetch(`/api/room/${roomId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, username: nameToSend, host: isHostFromUrl }),
    })
      .then((res) => res.json())
      .then((data) => {
        applyFullState(data);
        return fetch(`/api/room/${roomId}/state`).then((r) => r.json());
      })
      .then((stateData) => {
        if (stateData && !stateData.error) applyFullState(stateData);
      })
      .catch(() => {});
  }, [roomId, userId, hasConfirmedUsername, isHostFromUrl, applyFullState]);

  useEffect(() => {
    if (gameStartedAt == null || !checkSolved(grid, puzzle)) return;
    const timeMs =
      finishedTime ??
      (typeof window !== "undefined"
        ? (() => {
            const s = sessionStorage.getItem(`nono-finished-${roomId}`);
            if (!s) return null;
            const n = Number(s);
            return Number.isNaN(n) ? null : n;
          })()
        : null) ??
      0;
    if (timeMs <= 0) return;
    if (finishedTime != null) return;
    setFinishedTime(timeMs);
    setPlayers((prev) => ({
      ...prev,
      [userId]: { ...(prev[userId] ?? { username: usernameOrFallback, percent: null }), finishedTimeMs: timeMs },
    }));
  }, [grid, puzzle, gameStartedAt, roomId, userId, usernameOrFallback, finishedTime]);

  useEffect(() => {
    if (!roomId) return;
    return subscribeRoom(
      roomId,
      (data) => {
        setPlayers((prev) => {
          const existing = prev[data.userId];
          const finishedTimeMs = existing?.finishedTimeMs ?? null;
          return {
            ...prev,
            [data.userId]: {
              ...(existing ?? { username: data.username, finishedTimeMs: null }),
              percent: data.percent,
              ...(finishedTimeMs != null && { finishedTimeMs }),
            },
          };
        });
      },
      (data: { userId: string; username: string; finishedTimeMs?: number }) => {
        setPlayers((prev) => {
          const existing = prev[data.userId];
          const finishedTimeMs = data.finishedTimeMs ?? existing?.finishedTimeMs ?? null;
          return {
            ...prev,
            [data.userId]: existing
              ? { ...existing, username: data.username, finishedTimeMs }
              : { username: data.username, percent: null, finishedTimeMs },
          };
        });
        if (data.userId !== userId) {
          fetch(`/api/room/${roomId}/progress`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, username: usernameOrFallback, percent: lastPercentRef.current }),
          }).catch(() => {});
        }
        fetch(`/api/room/${roomId}/state`)
          .then((res) => res.json())
          .then((stateData) => {
            if (stateData && !stateData.error) applyFullStateRef.current(stateData);
          })
          .catch(() => {});
      },
      (data) => {
        setPlayers((prev) => ({
          ...prev,
          [data.userId]: { ...(prev[data.userId] ?? { username: data.username, percent: null }), finishedTimeMs: data.timeMs },
        }));
        fetch(`/api/room/${roomId}/state`)
          .then((res) => res.json())
          .then((stateData) => {
            if (stateData && !stateData.error) applyFullStateRef.current(stateData);
          })
          .catch(() => {});
      },
      (data) => setGameStartedAt(data.startedAt),
      (data: { userId: string }) => {
        setPlayers((prev) => {
          const next = { ...prev };
          delete next[data.userId];
          return next;
        });
      },
      (data: { hostUserId: string | null }) => setServerHostUserId(data.hostUserId),
      (data: { startedAt: number | null; hostUserId: string | null; members: { userId: string; username: string }[]; finished: { userId: string; username: string; timeMs: number }[] }) => {
        applyFullStateRef.current(data);
      },
      () => {
        fetch(`/api/room/${roomId}/state`)
          .then((res) => res.json())
          .then((stateData) => {
            if (stateData && !stateData.error) applyFullStateRef.current(stateData);
          })
          .catch(() => {});
      }
    );
    // Intentionally only [roomId]: handlers use refs; re-subscribing on other deps would drop Pusher events (e.g. game-start, player-join)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    if (!roomId || gameStartedAt == null) return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      fetch(`/api/room/${roomId}/state`)
        .then((res) => res.json())
        .then((data) => {
          if (data && !data.error) applyFullState(data);
        })
        .catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [roomId, gameStartedAt, applyFullState]);

  useEffect(() => {
    if (!roomId || !userId) return;
    const leaveUrl = `/api/room/${roomId}/leave`;
    const payload = new Blob([JSON.stringify({ userId })], { type: "application/json" });
    const onUnload = () => navigator.sendBeacon(leaveUrl, payload);
    window.addEventListener("pagehide", onUnload);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("pagehide", onUnload);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [roomId, userId]);

  const startGame = useCallback(() => {
    fetch(`/api/room/${roomId}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.startedAt != null) setGameStartedAt(data.startedAt);
      })
      .catch(() => {});
  }, [roomId, userId, setGameStartedAt]);

  const onCellChange = useCallback(
    (r: number, c: number, state: CellState) => {
      if (gameStartedAt == null || finishedTime != null) return;
      setGrid((prev) => prev.map((row, i) => (i === r ? row.map((cell, j) => (j === c ? state : cell)) : row)));
    },
    [gameStartedAt, finishedTime]
  );

  useEffect(() => {
    if (gameStartedAt == null || finishedTime != null || !checkSolved(grid, puzzle)) return;
    const timeMs = Date.now() - gameStartedAt;
    lastPercentRef.current = 100;
    setFinishedTime(timeMs);
    setPlayers((prev) => ({
      ...prev,
      [userId]: { ...(prev[userId] ?? { username: usernameOrFallback, percent: null }), finishedTimeMs: timeMs },
    }));
    if (typeof window !== "undefined") sessionStorage.setItem(`nono-finished-${roomId}`, String(timeMs));
    fetch(`/api/room/${roomId}/finished`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, username: getUsername(), timeMs }),
    }).catch(() => {});
  }, [grid, puzzle, gameStartedAt, finishedTime, roomId, userId, usernameOrFallback]);

  const roomLink = typeof window !== "undefined" ? `${window.location.origin}/room?code=${roomId}&size=${size}` : "";
  const canPlay = gameStartedAt != null;
  const playerList = Object.entries(players);
  const finishedList = playerList
    .filter(([, p]) => p.finishedTimeMs != null)
    .sort((a, b) => (a[1].finishedTimeMs ?? 0) - (b[1].finishedTimeMs ?? 0));
  const winner = finishedList[0];
  const myProgressPercent = canPlay ? progressPercent(grid, puzzle) : 0;
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  return (
    <main className="min-h-screen p-4 md:p-6">
      {showUsernamePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-xl bg-[#1a1a2e] border border-white/20 p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-white mb-2">What’s your name?</h2>
            <p className="text-sm text-gray-400 mb-4">So others in the room can see who joined.</p>
            <UsernameForm value={username} onChange={setUsernameState} onSubmit={setUsername} onContinueAsPlayer={() => setUsername("Player")} />
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-4 flex-wrap">
            <a href="/" className="text-gray-400 hover:text-white transition">← Home</a>
            <button
              type="button"
              onClick={() => {
                fetch(`/api/room/${roomId}/leave`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) }).catch(() => {});
                router.push("/");
              }}
              className="text-sm px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-gray-300 transition"
            >
              Leave
            </button>
            <span className="text-gray-500">|</span>
            <span className="text-sm text-gray-400">
              Room: {roomId} · {size}×{size}
              {isHost && <span className="ml-1 text-rose-400">(Host)</span>}
            </span>
            <button type="button" onClick={() => setShowHowToPlay((v) => !v)} className="text-gray-400 hover:text-white transition w-8 h-8 rounded-full flex items-center justify-center border border-white/20 hover:bg-white/10" title="How to play">?</button>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-lg font-mono tabular-nums text-white">{gameStartedAt == null ? "—" : formatTime(displayTimeMs)}</span>
            <button type="button" onClick={() => roomLink && navigator.clipboard.writeText(roomLink)} className="text-sm px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 transition">Copy link</button>
          </div>
        </div>

        {showHowToPlay && (
          <div className="mb-4 p-4 rounded-lg bg-white/10 border border-white/20 text-sm text-gray-300 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-white">How to play</span>
              <button type="button" onClick={() => setShowHowToPlay(false)} className="text-gray-400 hover:text-white">×</button>
            </div>
            <p>Fill cells to match the row and column clues. Each number is a run of filled cells; <code className="text-rose-400">0</code> means no filled cells in that row/column.</p>
            <p><strong>Tap/click:</strong> 1st = black (filled), 2nd = X (empty for sure), 3rd = clear.</p>
            <p><strong>Drag:</strong> Press and drag to paint multiple cells.</p>
            <p>Only the black cells are checked; first to finish with all correct filled cells wins.</p>
            <p className="text-gray-500 text-xs mt-2 pt-2 border-t border-white/10"><strong>Reload:</strong> Your grid is saved per room. Closing the tab counts as leaving.</p>
          </div>
        )}

        {gameStartedAt == null && (
          <div className="mb-4 p-4 rounded-lg bg-white/10 border border-white/20">
            <p className="text-gray-300 mb-2">Players in room ({playerList.length})</p>
            <ul className="list-disc list-inside text-gray-400 text-sm mb-3">
              {playerList.map(([id, p]) => (
                <li key={id}>{p.username}{id === userId && " (you)"}</li>
              ))}
            </ul>
            {isHost ? (
              <button type="button" onClick={startGame} className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium">Start game</button>
            ) : (
              <p className="text-gray-300 text-sm">Waiting for host to start the game…</p>
            )}
          </div>
        )}

        {canPlay && finishedList.length > 0 && (
          <div className="mb-4 p-4 rounded-lg bg-white/10 border border-white/20">
            <p className="text-sm text-gray-400 mb-2">Finished</p>
            <ul className="space-y-1">
              {finishedList.map(([id, p], i) => (
                <li key={id} className="text-white">
                  {i + 1}. {p.username}{id === userId && " (you)"} — {formatTime(p.finishedTimeMs!)}
                  {winner && winner[0] === id && <span className="text-green-400 ml-1">✓</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className={!canPlay ? "opacity-60 pointer-events-none" : ""}>
          <GameGrid puzzle={puzzle} grid={grid} onCellChange={onCellChange} disabled={finishedTime != null} violations={getViolations(grid, puzzle)} />
        </div>

        {canPlay && playerList.length > 0 && (
          <div className="mt-4 rounded-lg bg-white/5 border border-white/10 overflow-hidden">
            <p className="text-xs text-gray-500 uppercase tracking-wider px-4 py-2 border-b border-white/10">Players</p>
            <ul className="divide-y divide-white/10">
              {playerList.map(([id, p]) => (
                <li key={id} className="px-4 py-3 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-white font-medium truncate">{p.username}{id === userId && <span className="ml-1.5 text-gray-400 font-normal text-sm">(you)</span>}</span>
                    {p.finishedTimeMs != null ? (
                      <span className="text-green-400 text-sm font-mono tabular-nums shrink-0">{formatTime(p.finishedTimeMs)}</span>
                    ) : (
                      <span className="text-gray-400 text-sm tabular-nums shrink-0">{(id === userId ? myProgressPercent : (p.percent ?? 0))}%</span>
                    )}
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full bg-rose-500/80 transition-all duration-300" style={{ width: `${p.finishedTimeMs != null ? 100 : (id === userId ? myProgressPercent : (p.percent ?? 0))}%` }} />
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
