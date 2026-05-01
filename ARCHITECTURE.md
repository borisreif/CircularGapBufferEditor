# Circular Gap Buffer Editor Architecture

This project uses an MVP-style split rather than classic MVC. The goal is to
keep text storage, document behavior, browser DOM details, and persistence in
separate layers.

The current design is also moving toward a **windowed textarea** model:

```txt
CircularGapBuffer  stores the full document text
BufferWindow       stores only window metadata: start, size, cursor
Textarea           stores only the currently visible window text
```

The circular gap buffer remains the authoritative text store, but the textarea
no longer has to mirror the entire document.

## Dependency direction

```txt
main.js
  ├─ app/EditorPresenter.js
  ├─ domain/EditorDocument.js
  ├─ ui/TextareaEditorView.js
  └─ storage/LocalDocumentStorage.js

app/EditorPresenter.js
  ├─ domain/TextSelection.js
  ├─ domain/TextBoundaries.js
  ├─ app/EditorStatus.js
  └─ app/EditorDebug.js

domain/EditorDocument.js
  └─ domain/BufferWindow.js

 domain/BufferWindow.js
  └─ CircularGapBuffer.js

ui/TextareaEditorView.js
  └─ browser DOM only

storage/LocalDocumentStorage.js
  └─ localStorage only
```

## Responsibilities

### `CircularGapBuffer.js`

Low-level mutable text storage. This file is intentionally isolated and should
not know about the editor UI, localStorage, line numbers, or textarea behavior.

The circular nature of the buffer is an implementation detail. Public offsets
are logical text offsets, not physical circular-array indexes.

### `domain/BufferWindow.js`

Generic sliding editing window over the full circular gap buffer.

It owns the `CircularGapBuffer`, but callers edit through the window. All normal
editing offsets are **local to the current window**.

Typical methods:

```js
insert(text);
replaceRange(start, end, text);
deleteRange(start, end);
backspace();
deleteForward();
moveCursor(position);
getCursor();
getGlobalCursor();
getText();
toString();

getSourceText();
getSourceLength();
setSourceText(text);

getWindowStart();
getWindowEnd();
getWindowSize();
moveWindowTo(globalOffset);
moveWindowBy(delta);
resizeWindow(size);

localToGlobal(localOffset);
globalToLocal(globalOffset);
snapshot();
debugState();
validate();
```

`BufferWindow` is deliberately not editor-specific. It knows nothing about line
numbers, textareas, saving, DOM events, or status bars.

### `domain/EditorDocument.js`

Editor-shaped document API above `BufferWindow`.

It provides document/editor vocabulary for the presenter, such as full-document
stats, visible-window stats, line counts, search helpers, and debug state.

Important distinction:

```js
getText();        // full document text
getFullText();    // full document text
getVisibleText(); // current window text shown in the textarea
```

Current cursor and selection methods are local to the visible window because
they normally come from `textarea.selectionStart` and `textarea.selectionEnd`.

### `ui/TextareaEditorView.js`

Passive adapter around the native `<textarea>`.

It owns DOM elements and DOM events, but it does not know about the document,
`BufferWindow`, storage, or `CircularGapBuffer`.

Typical methods:

```js
getText();
setText(text);
getSelection();
setSelection(start, end);
showLineNumbers(lineCount, startLine);
showStatus(text);
showDebug(text);
onBeforeInput(callback);
onNativeInput(callback);
onSelectionChange(callback);
onPaste(callback);
onSave(callback);
```

### `app/EditorPresenter.js`

Application coordinator.

It interprets user intent, mutates `EditorDocument`, updates the view, and saves
through storage. In the windowed design, textarea positions are window-local, so
the presenter uses visible/window document methods for edits and full-document
methods for persistence.

### `storage/LocalDocumentStorage.js`

Plain-text persistence through `localStorage`. It deliberately knows nothing
about the gap buffer, the window, or editor behavior.

## Why this design is useful

The native textarea remains convenient for keyboard input, selection, clipboard,
IME/composition, and accessibility. But the circular gap buffer remains the real
text store.

The next step is to add controls for moving the window through the document. At
that point the textarea can display only a small working region while the full
document remains in the circular gap buffer.
