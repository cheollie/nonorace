"use client";

import type { CellState, NonogramPuzzle } from "@/lib/nonogram";
import { useCallback, useRef } from "react";

function cycle(state: CellState): CellState {
  if (state === "empty") return "filled";
  if (state === "filled") return "cross";
  return "empty";
}

type DragState = {
  active: boolean;
  brush: CellState;
  startR: number;
  startC: number;
  hasMoved: boolean;
  pointerId: number;
};

interface GameGridProps {
  puzzle: NonogramPuzzle;
  grid: CellState[][];
  onCellChange: (r: number, c: number, state: CellState) => void;
  disabled?: boolean;
  violations?: { rowIndices: number[]; colIndices: number[] };
}

export function GameGrid({ puzzle, grid, onCellChange, disabled, violations }: GameGridProps) {
  const { rows, cols, rowClues, colClues } = puzzle;
  const maxRowClues = Math.max(1, ...rowClues.map((c) => c.length));
  const maxColClues = Math.max(1, ...colClues.map((c) => c.length));

  const gridRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState>({
    active: false,
    brush: "filled",
    startR: 0,
    startC: 0,
    hasMoved: false,
    pointerId: 0,
  });

  const rowSet = new Set(violations?.rowIndices ?? []);
  const colSet = new Set(violations?.colIndices ?? []);

  const handlePointerDown = (e: React.PointerEvent, r: number, c: number) => {
    if (disabled) return;
    const current = grid[r][c];
    const brush: CellState = cycle(current);
    lastCellRef.current = null;
    dragRef.current = { active: true, brush, startR: r, startC: c, hasMoved: false, pointerId: e.pointerId };
    onCellChange(r, c, brush);
    gridRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerEnter = (r: number, c: number) => {
    if (disabled || !dragRef.current.active) return;
    const { brush, startR, startC } = dragRef.current;
    if (r !== startR || c !== startC) {
      dragRef.current.hasMoved = true;
      onCellChange(r, c, brush);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d.active || e.pointerId !== d.pointerId) return;
    dragRef.current.active = false;
    lastCellRef.current = null;
    gridRef.current?.releasePointerCapture(d.pointerId);
  };

  const cellSize = Math.min(28, Math.floor(420 / Math.max(rows, cols)));
  const clueSize = 20;
  const gap = 1;

  const lastCellRef = useRef<{ r: number; c: number } | null>(null);

  const getCellFromPoint = useCallback(
    (clientX: number, clientY: number): { r: number; c: number } | null => {
      const el = gridRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const pad = 4;
      const startX = rect.left + pad + maxRowClues * (clueSize + gap) - el.scrollLeft;
      const startY = rect.top + pad + maxColClues * (clueSize + gap) - el.scrollTop;
      const localX = clientX - startX;
      const localY = clientY - startY;
      if (localX < 0 || localY < 0) return null;
      const c = Math.floor(localX / (cellSize + gap));
      const r = Math.floor(localY / (cellSize + gap));
      if (c < 0 || c >= cols || r < 0 || r >= rows) return null;
      return { r, c };
    },
    [maxRowClues, maxColClues, clueSize, cellSize, gap, rows, cols]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d.active || e.pointerId !== d.pointerId || disabled) return;
      const cell = getCellFromPoint(e.clientX, e.clientY);
      if (!cell) return;
      const { r, c } = cell;
      if (r === d.startR && c === d.startC) return;
      if (lastCellRef.current?.r === r && lastCellRef.current?.c === c) return;
      lastCellRef.current = { r, c };
      dragRef.current.hasMoved = true;
      onCellChange(r, c, d.brush);
    },
    [getCellFromPoint, disabled, onCellChange]
  );

  const pad = 4;
  const cellAreaLeft = pad + maxRowClues * (clueSize + gap);
  const cellAreaTop = pad + maxColClues * (clueSize + gap);
  const step = cellSize + gap;
  const verticalLines = Array.from({ length: Math.floor(cols / 5) }, (_, i) => (i + 1) * 5).filter((c) => c < cols);
  const horizontalLines = Array.from({ length: Math.floor(rows / 5) }, (_, i) => (i + 1) * 5).filter((r) => r < rows);

  return (
    <div
      ref={gridRef}
      className="inline-block overflow-auto p-1 select-none relative touch-none"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <div
        className="grid gap-px bg-white/20"
        style={{
          gridTemplateRows: `repeat(${maxColClues}, ${clueSize}px) repeat(${rows}, ${cellSize}px)`,
          gridTemplateColumns: `repeat(${maxRowClues}, ${clueSize}px) repeat(${cols}, ${cellSize}px)`,
        }}
      >
        <div
          className="bg-[#0f3460]"
          style={{ gridRow: `1 / ${maxColClues + 1}`, gridColumn: `1 / ${maxRowClues + 1}` }}
        />

        {colClues.map((clue, c) => (
          <div
            key={`col-${c}`}
            className={`flex flex-col items-center justify-end gap-px p-0.5 ${colSet.has(c) ? "bg-red-900/60" : "bg-[#0f3460]"}`}
            style={{
              gridRow: `1 / ${maxColClues + 1}`,
              gridColumn: `${maxRowClues + c + 1}`,
            }}
          >
            {Array.from({ length: maxColClues - clue.length }, (_, i) => (
              <div key={`e-${i}`} className="min-h-[14px] min-w-[14px]" />
            ))}
            {clue.map((n, i) => (
              <div
                key={i}
                className="text-[10px] text-gray-300 flex items-center justify-center min-h-[14px] min-w-[14px]"
              >
                {n || ""}
              </div>
            ))}
          </div>
        ))}

        {rowClues.map((clue, r) => (
          <div
            key={`rowclue-${r}`}
            className={`flex items-center justify-end gap-px p-0.5 ${rowSet.has(r) ? "bg-red-900/60" : "bg-[#0f3460]"}`}
            style={{
              gridRow: `${maxColClues + r + 1}`,
              gridColumn: `1 / ${maxRowClues + 1}`,
            }}
          >
            {Array.from({ length: maxRowClues - clue.length }, (_, i) => (
              <div key={`e-${i}`} className="min-h-[14px] min-w-[14px]" />
            ))}
            {clue.map((n, i) => (
              <div
                key={i}
                className="text-[10px] text-gray-300 flex items-center justify-center min-h-[14px] min-w-[14px]"
              >
                {n || ""}
              </div>
            ))}
          </div>
        ))}

        {grid.map((row, r) =>
          row.map((cell, c) => (
            <button
              key={`${r}-${c}`}
              type="button"
              disabled={disabled}
              onPointerDown={(e) => {
                e.preventDefault();
                handlePointerDown(e, r, c);
              }}
              onPointerEnter={() => handlePointerEnter(r, c)}
              className={`
                min-w-0 min-h-0 border border-white/10 transition touch-none
                ${cell === "filled" ? "bg-rose-600" : ""}
                ${cell === "cross" ? "bg-white/20" : ""}
                ${cell === "empty" ? "bg-[#0d1321] hover:bg-[#1a2332] hover:ring-1 hover:ring-rose-400/50" : ""}
                ${disabled ? "cursor-default" : "cursor-pointer"}
              `}
              style={{
                gridRow: maxColClues + r + 1,
                gridColumn: maxRowClues + c + 1,
                width: cellSize - 2,
                height: cellSize - 2,
              }}
            >
              {cell === "cross" && <span className="text-gray-400 text-xs">✕</span>}
            </button>
          ))
        )}
      </div>

      <div
        className="absolute pointer-events-none"
        style={{
          left: cellAreaLeft,
          top: cellAreaTop,
          width: cols * step - gap,
          height: rows * step - gap,
        }}
      >
        {verticalLines.map((c) => (
          <div
            key={`v-${c}`}
            className="absolute top-0 bottom-0 w-[2px] bg-white/60"
            style={{ left: c * step - 1 }}
          />
        ))}
        {horizontalLines.map((r) => (
          <div
            key={`h-${r}`}
            className="absolute left-0 right-0 h-[2px] bg-white/60"
            style={{ top: r * step - 1 }}
          />
        ))}
      </div>
    </div>
  );
}
