/**
 * Simple deterministic PRNG from a string seed (for same puzzle in same room).
 */
export function createSeededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  let state = (h >>> 0) / 0xffffffff;
  return function next() {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}
