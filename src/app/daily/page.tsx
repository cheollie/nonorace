"use client";

import {
  checkSolved,
  createEmptyGrid,
  generatePuzzle,
  getViolations,
  type CellState,
  type NonogramPuzzle,
} from "@/lib/nonogram";
import { GameGrid } from "@/app/room/[roomId]/GameGrid";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

const SIZES = [2, 10, 15, 20] as const;
type Size = (typeof SIZES)[number];

function getSize(searchParams: ReturnType<typeof useSearchParams>): Size {
  const s = searchParams.get("size");
  const n = s ? parseInt(s, 10) : 10;
  if (SIZES.includes(n as Size)) return n as Size;
  return 10;
}

/** Today's date in UTC (YYYY-MM-DD) so everyone gets the same daily. */
function getTodayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatTime(ms: number): string {
  return `${Math.floor(ms / 60000)}:${(Math.floor(ms / 1000) % 60).toString().padStart(2, "0")}.${Math.floor(ms / 100) % 10}`;
}

function DailyContent() {
  const searchParams = useSearchParams();
  const size = getSize(searchParams);
  const dateStr = getTodayUTC();

  const puzzle = useMemo(
    () => generatePuzzle(`daily-${dateStr}-${size}`, size, size),
    [dateStr, size]
  );

  type SizeState = {
    grid: CellState[][];
    gameStartedAt: number | null;
    finishedTime: number | null;
  };

  const [stateBySize, setStateBySize] = useState<Record<string, SizeState>>({});
  const [displayTimeMs, setDisplayTimeMs] = useState(0);
  const [copied, setCopied] = useState(false);

  // Current size's state (or empty); ensure grid dimensions match current size
  const emptyGridForSize = useMemo(() => createEmptyGrid(size, size), [size]);
  const currentState = stateBySize[String(size)];
  const grid =
    currentState?.grid &&
    currentState.grid.length === size &&
    currentState.grid[0]?.length === size
      ? currentState.grid
      : emptyGridForSize;
  const gameStartedAt = currentState?.gameStartedAt ?? null;
  const finishedTime = currentState?.finishedTime ?? null;

  const setGrid = useCallback(
    (update: CellState[][] | ((prev: CellState[][]) => CellState[][])) => {
      setStateBySize((prev) => {
        const cur = prev[String(size)] ?? {
          grid: createEmptyGrid(size, size),
          gameStartedAt: null,
          finishedTime: null,
        };
        const newGrid = typeof update === "function" ? update(cur.grid) : update;
        return { ...prev, [String(size)]: { ...cur, grid: newGrid } };
      });
    },
    [size]
  );

  const setGameStartedAt = useCallback((value: number | null) => {
    setStateBySize((prev) => {
      const cur = prev[String(size)] ?? {
        grid: createEmptyGrid(size, size),
        gameStartedAt: null,
        finishedTime: null,
      };
      return { ...prev, [String(size)]: { ...cur, gameStartedAt: value } };
    });
  }, [size]);

  const setFinishedTime = useCallback((value: number | null) => {
    setStateBySize((prev) => {
      const cur = prev[String(size)] ?? {
        grid: createEmptyGrid(size, size),
        gameStartedAt: null,
        finishedTime: null,
      };
      return { ...prev, [String(size)]: { ...cur, finishedTime: value } };
    });
  }, [size]);

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

  const onCellChange = useCallback(
    (r: number, c: number, state: CellState) => {
      if (finishedTime != null) return;
      if (gameStartedAt == null) setGameStartedAt(Date.now());
      setGrid((prev) =>
        prev.map((row, i) =>
          i === r ? row.map((cell, j) => (j === c ? state : cell)) : row
        )
      );
    },
    [gameStartedAt, finishedTime, setGrid, setGameStartedAt]
  );

  useEffect(() => {
    if (gameStartedAt == null || finishedTime != null || !checkSolved(grid, puzzle)) return;
    setFinishedTime(Date.now() - gameStartedAt);
  }, [grid, puzzle, gameStartedAt, finishedTime, setFinishedTime]);

  const timeMs = finishedTime ?? (gameStartedAt != null ? Date.now() - gameStartedAt : 0);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const copyText = [
    `✨ Nonorace Daily · ${dateStr} · ${size}×${size}`,
    `Finished in ${formatTime(timeMs)} 🎉`,
    origin ? `Play at ${origin}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const copyScore = useCallback(() => {
    navigator.clipboard.writeText(copyText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [copyText]);

  const canPlay = gameStartedAt != null;
  const isDone = finishedTime != null;

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Link href="/" className="text-gray-400 hover:text-white transition">
              ← Home
            </Link>
            <span className="text-gray-500">|</span>
            <span className="text-sm text-gray-400">
              Daily {size}×{size} · {dateStr} (UTC)
            </span>
            <div className="flex gap-1">
              {SIZES.map((s) => (
                <Link
                  key={s}
                  href={`/daily?size=${s}`}
                  className={`px-2 py-1 rounded text-sm transition ${size === s ? "bg-amber-600/40 text-amber-200" : "bg-white/10 text-gray-400 hover:bg-white/20"}`}
                >
                  {s}×{s}
                </Link>
              ))}
            </div>
          </div>
          <span className="text-lg font-mono tabular-nums text-white">
            {gameStartedAt == null ? "—" : formatTime(displayTimeMs)}
          </span>
        </div>

        {isDone && (
          <div className="mb-4 p-4 rounded-lg bg-amber-600/20 border border-amber-500/30">
            <p className="text-amber-200 font-medium mb-2">You did it!</p>
            <p className="text-white text-lg font-mono tabular-nums mb-3">{formatTime(finishedTime!)}</p>
            <p className="text-xs text-gray-400 mb-2">Copy to share:</p>
            <div className="flex flex-col gap-2">
              <pre className="text-sm text-gray-300 bg-black/30 px-3 py-2 rounded whitespace-pre-wrap font-sans">
                {copyText}
              </pre>
              <button
                type="button"
                onClick={copyScore}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium shrink-0"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        )}

        {!canPlay && (
          <p className="text-sm text-gray-500 mb-2">Tap a cell to start the timer.</p>
        )}

        <div className={isDone ? "opacity-60 pointer-events-none" : ""}>
          <GameGrid
            puzzle={puzzle}
            grid={grid}
            onCellChange={onCellChange}
            disabled={isDone}
            violations={getViolations(grid, puzzle)}
          />
        </div>
      </div>
    </main>
  );
}

export default function DailyPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen p-4 md:p-6 flex items-center justify-center">
          <p className="text-gray-400">Loading...</p>
        </main>
      }
    >
      <DailyContent />
    </Suspense>
  );
}
