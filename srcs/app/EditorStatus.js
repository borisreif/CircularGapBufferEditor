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
    documentLines: `${formatNumber(stats.lines)} ${plural(stats.lines, "line")}`,
    documentSize: `${formatNumber(stats.length)} chars · ${formatNumber(stats.words)} ${plural(stats.words, "word")}`,
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
