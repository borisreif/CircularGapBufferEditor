// srcs/app/EditorStatus.js

import TextSelection from "../domain/TextSelection.js";

export function formatEditorStatus({ selection, stats, message = "" }) {
  const currentSelection = TextSelection.from(selection).normalize();
  const location = currentSelection.isCollapsed
    ? `Cursor: ${currentSelection.start}`
    : `Selection: ${currentSelection.start}–${currentSelection.end}`;

  const base = [
    location,
    `Length: ${stats.length}`,
    `Words: ${stats.words}`,
    `Lines: ${stats.lines}`
  ];

  if (message) {
    base.push(message);
  }

  return base.join(" | ");
}
