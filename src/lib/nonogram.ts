import { createSeededRandom } from "./seedrandom";

export type CellState = "empty" | "filled" | "cross";

export interface NonogramPuzzle {
  rows: number;
  cols: number;
  rowClues: number[][];
  colClues: number[][];
  solution: boolean[][]; // true = filled
}

/** Pick a run length 1–maxLen with 1s and 2s common, but 3–8+ possible (for patterns like 1 1 5, 7 2, 2 3 2, 10, 1 8 1). */
function pickRunLength(rng: () => number, maxLen: number): number {
  if (maxLen <= 0) return 1;
  const roll = rng();
  if (roll < 0.32) return 1;
  if (roll < 0.58) return 2;
  if (roll < 0.75) return 3;
  if (roll < 0.87) return 4;
  if (roll < 0.94) return 5;
  if (roll < 0.98) return 6;
  // 7, 8, or up to maxLen for single long runs (e.g. "10")
  return Math.min(7 + Math.floor(rng() * Math.max(1, maxLen - 6)), maxLen);
}

/**
 * Generate a deterministic nonogram puzzle from room id and size.
 * Builds each row from a mix of run lengths (1s and 2s common, plus 3–8) so clues look like 1 1 5, 7 2, 2 3 2, 10, 1 8 1.
 */
export function generatePuzzle(roomId: string, rows: number, cols: number): NonogramPuzzle {
  const rng = createSeededRandom(`${roomId}-${rows}x${cols}`);
  const solution: boolean[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => false)
  );

  for (let r = 0; r < rows; r++) {
    // Number of runs in this row: 1 to ~5 (so we can get "10" or "1 1 1 1" or "2 3 2")
    const numRuns = 1 + Math.floor(rng() * Math.min(5, Math.max(1, cols)));
    const runs: number[] = [];
    let sum = 0;
    const maxSum = cols - (numRuns - 1); // need at least 1 gap between each run
    for (let i = 0; i < numRuns; i++) {
      const remaining = numRuns - 1 - i; // min gaps still needed
      const maxForThis = Math.min(maxSum - sum - remaining, cols);
      if (maxForThis < 1) break;
      const len = Math.max(1, pickRunLength(rng, maxForThis));
      runs.push(len);
      sum += len;
    }
    // If we overshot, trim from the end or shrink a run
    while (sum + (runs.length - 1) > cols && runs.length > 0) {
      const last = runs.pop()!;
      sum -= last;
      if (runs.length > 0 && last > 1) {
        runs.push(last - 1);
        sum += last - 1;
      }
    }
    if (runs.length === 0) runs.push(Math.min(cols, Math.max(1, pickRunLength(rng, cols))));

    // Place runs with exactly 1 cell gap between (so we never overflow the row)
    const totalUsed = sum + (runs.length - 1);
    const startOffset = totalUsed <= cols ? Math.floor(rng() * (cols - totalUsed + 1)) : 0;
    let pos = startOffset;
    for (let i = 0; i < runs.length; i++) {
      for (let j = 0; j < runs[i]; j++) {
        if (pos + j < cols) solution[r][pos + j] = true;
      }
      pos += runs[i];
      if (i < runs.length - 1) pos += 1; // exactly 1 gap so layout always fits
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
