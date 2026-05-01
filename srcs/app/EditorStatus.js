// srcs/app/EditorStatus.js

import TextSelection from "../domain/TextSelection.js";

/**
 * Formats the small status/footer line shown below the editor.
 *
 * `selection` is local to the currently visible text window. `stats` also
 * contains global/full-document values so the user can see where the window sits
 * inside the full document.
 */
export function formatEditorStatus({ selection, stats, message = "" }) {
  const currentSelection = TextSelection.from(selection).normalize();
  const localLocation = currentSelection.isCollapsed
    ? `Cursor: ${currentSelection.start}`
    : `Selection: ${currentSelection.start}–${currentSelection.end}`;

  const base = [
    localLocation,
    `Global cursor: ${stats.globalCursor}`,
    `Window: ${stats.windowStart}–${stats.windowEnd}`,
    `Visible: ${stats.visibleLength} chars, ${stats.visibleLines} lines`,
    `Document: ${stats.length} chars, ${stats.words} words, ${stats.lines} lines`
  ];

  if (message) {
    base.push(message);
  }

  return base.join(" | ");
}
