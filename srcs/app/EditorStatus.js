// srcs/app/EditorStatus.js

/**
 * Builds the card-style footer view-model from editor state.
 *
 * The presenter gathers the raw data from EditorDocument and EditorViewport.
 * This module only formats that data into short strings. TextareaEditorView then
 * copies those strings into the footer DOM nodes.
 */
export function formatEditorStatus({ cursor, viewport, stats, message = "" }) {
  const mode = viewport?.mode === "characters" ? "Characters" : "Lines";
  const saveState = message || "Ready";

  return {
    cursorGlobal: `Global ${cursor.globalLine}:${cursor.globalColumn}`,
    cursorLocal: `Local ${cursor.localLine}:${cursor.localColumn}`,
    windowLines: `Lines ${formatNumber(viewport.startLine)}–${formatNumber(viewport.endLine)}`,
    windowChars: `Chars ${formatNumber(viewport.startOffset)}–${formatNumber(viewport.endOffset)}`,
    documentLines: `${formatNumber(stats.lineCount)} ${plural(stats.lineCount, "line")} · ${formatNumber(stats.wordCount)} ${plural(stats.wordCount, "word")}`,
    documentSize: `${formatNumber(stats.characterCount)} chars · ~${formatBytes(stats.characterCount)}`,
    mode,
    save: saveState
  };
}

function formatNumber(value) {
  return Number(value ?? 0).toLocaleString();
}

function plural(value, singular) {
  return Number(value) === 1 ? singular : `${singular}s`;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;

  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unitIndex]}`;
}
