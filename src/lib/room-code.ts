/**
 * Generate a short, readable room code (Skribbl.io style).
 * Uses A-Z and 2-9 (no 0, O, 1, I, L) to avoid confusion when read aloud.
 */
const CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateRoomCode(length = 6): string {
  let code = "";
  const random = typeof crypto !== "undefined" && crypto.getRandomValues
    ? () => {
        const arr = new Uint32Array(1);
        crypto.getRandomValues(arr);
        return arr[0]! / (0xffff_ffff + 1);
      }
    : () => Math.random();
  for (let i = 0; i < length; i++) {
    code += CHARS[Math.floor(random() * CHARS.length)];
  }
  return code;
}
