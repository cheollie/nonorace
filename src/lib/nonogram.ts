import { createSeededRandom } from "./seedrandom";

export type CellState = "empty" | "filled" | "cross";

export interface NonogramPuzzle {
  rows: number;
  cols: number;
  rowClues: number[][];
  colClues: number[][];
  solution: boolean[][]; // true = filled
}

/**
 * Generate a deterministic nonogram puzzle from room id and size.
 * Uses a simple random grid; both players get the same puzzle.
 */
export function generatePuzzle(roomId: string, rows: number, cols: number): NonogramPuzzle {
  const rng = createSeededRandom(`${roomId}-${rows}x${cols}`);
  const solution: boolean[][] = [];
  for (let r = 0; r < rows; r++) {
    solution[r] = [];
    for (let c = 0; c < cols; c++) {
      solution[r][c] = rng() < 0.45; // ~45% filled for variety
    }
  }

  const rowClues = solution.map((row) => getClue(row));
  const colClues: number[][] = [];
  for (let c = 0; c < cols; c++) {
    const col = solution.map((row) => row[c]);
    colClues.push(getClue(col));
  }

  return { rows, cols, rowClues, colClues, solution };
}

function getClue(line: boolean[]): number[] {
  const out: number[] = [];
  let count = 0;
  for (const cell of line) {
    if (cell) count++;
    else if (count > 0) {
      out.push(count);
      count = 0;
    }
  }
  if (count > 0) out.push(count);
  return out.length ? out : [0];
}

/**
 * Check if current grid state matches the solution (only filled vs not matters for win).
 */
export function checkSolved(grid: CellState[][], puzzle: NonogramPuzzle): boolean {
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.cols; c++) {
      const filled = grid[r][c] === "filled";
      if (filled !== puzzle.solution[r][c]) return false;
    }
  }
  return true;
}

/**
 * Progress as "how much of the grid is marked" (filled or X): 0–100%.
 * Does not measure correctness — just total marked / total cells.
 */
export function progressPercent(grid: CellState[][], puzzle: NonogramPuzzle): number {
  let marked = 0;
  const total = puzzle.rows * puzzle.cols;
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.cols; c++) {
      if (grid[r][c] === "filled" || grid[r][c] === "cross") marked++;
    }
  }
  return total === 0 ? 0 : Math.round((marked / total) * 100);
}

export function createEmptyGrid(rows: number, cols: number): CellState[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => "empty")
  );
}
