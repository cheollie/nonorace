"use client";

/** localStorage key: set after user has seen the first-visit how to play (so we don’t show it every time). */
export const HAS_VISITED_KEY = "nono-has-visited";

const CORE_CONTENT = (
  <>
    <p>Fill cells to match the row and column clues. Each number is a run of filled cells; <code className="text-rose-400">0</code> means no filled cells in that row/column.</p>
    <p><strong>Tap/click:</strong> 1st = black (filled), 2nd = X (empty for sure), 3rd = clear.</p>
    <p><strong>Drag:</strong> Press and drag to paint multiple cells.</p>
    <p>Only the black cells are checked; first to finish with all correct filled cells wins.</p>
  </>
);

const ROOM_FOOTNOTE = (
  <p className="text-gray-500 text-xs mt-2 pt-2 border-t border-white/10"><strong>Reload:</strong> Your grid is saved per room. Closing the tab counts as leaving.</p>
);

/** Inline “how to play” text (for home page). */
export function HowToPlayText({ includeRoomNote = false }: { includeRoomNote?: boolean }) {
  return (
    <div className="text-sm text-gray-300 space-y-2">
      {CORE_CONTENT}
      {includeRoomNote && ROOM_FOOTNOTE}
    </div>
  );
}

/** Panel with title and close button (for room + daily). */
export function HowToPlayPanel({
  onClose,
  includeRoomNote = false,
  className = "",
}: {
  onClose: () => void;
  includeRoomNote?: boolean;
  className?: string;
}) {
  return (
    <div className={`p-4 rounded-lg bg-white/10 border border-white/20 text-sm text-gray-300 space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="font-medium text-white">How to play</span>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-white transition">×</button>
      </div>
      {CORE_CONTENT}
      {includeRoomNote && ROOM_FOOTNOTE}
    </div>
  );
}
