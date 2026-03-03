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

/** Get run lengths of filled cells in a line (empty and cross both count as break). */
export function getRunsFromLine(line: CellState[]): number[] {
  const out: number[] = [];
  let count = 0;
  for (const cell of line) {
    if (cell === "filled") count++;
    else if (count > 0) {
      out.push(count);
      count = 0;
    }
  }
  if (count > 0) out.push(count);
  return out;
}

/** Clue [0] means "no filled cells"; getRunsFromLine returns [] for that. Treat as matching. */
function runsMatchClue(runs: number[], clue: number[]): boolean {
  if (clue.length === 1 && clue[0] === 0) return runs.length === 0;
  if (runs.length !== clue.length) return false;
  return runs.every((n, i) => n === clue[i]);
}

/** Violation when current runs don't match clue (e.g. 2,4,2 vs clue 2,3,2). */
function runsViolateClue(runs: number[], clue: number[]): boolean {
  return !runsMatchClue(runs, clue);
}

/**
 * Win when all row and column clues are satisfied by current filled cells.
 * Any configuration that satisfies the clues counts (not just the generated solution).
 */
export function checkSolved(grid: CellState[][], puzzle: NonogramPuzzle): boolean {
  for (let r = 0; r < puzzle.rows; r++) {
    const runs = getRunsFromLine(grid[r]);
    if (!runsMatchClue(runs, puzzle.rowClues[r])) return false;
  }
  for (let c = 0; c < puzzle.cols; c++) {
    const col = grid.map((row) => row[c]);
    const runs = getRunsFromLine(col);
    if (!runsMatchClue(runs, puzzle.colClues[c])) return false;
  }
  return true;
}

/**
 * Which row and column indices have a clue violation (current runs don't match clue).
 */
export function getViolations(
  grid: CellState[][],
  puzzle: NonogramPuzzle
): { rowIndices: number[]; colIndices: number[] } {
  const rowIndices: number[] = [];
  const colIndices: number[] = [];
  for (let r = 0; r < puzzle.rows; r++) {
    const runs = getRunsFromLine(grid[r]);
    if (runsViolateClue(runs, puzzle.rowClues[r])) rowIndices.push(r);
  }
  for (let c = 0; c < puzzle.cols; c++) {
    const col = grid.map((row) => row[c]);
    const runs = getRunsFromLine(col);
    if (runsViolateClue(runs, puzzle.colClues[c])) colIndices.push(c);
  }
  return { rowIndices, colIndices };
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
