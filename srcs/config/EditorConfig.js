// srcs/config/EditorConfig.js

export const DEFAULT_EDITOR_CONFIG = Object.freeze({
  viewport: Object.freeze({
    mode: "lines",          // "lines" or "characters"
    linesPerWindow: 25,
    charactersPerWindow: 2000
  }),

  indentation: Object.freeze({
    tabText: "  ",
    tabSize: 2
  }),

  autosave: Object.freeze({
    onLineBreak: true,
    onBeforeUnload: true,
    onShortcut: true
  }),

  display: Object.freeze({
    showDebug: true,
    showLineNumbers: true
  })
});