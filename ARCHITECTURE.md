# Circular Gap Buffer Editor Architecture

This version uses an MVP-style split rather than a classic MVC split. The goal 
is to keep the circular gap buffer isolated behind a document-level API and 
keep DOM details isolated inside the view adapter.

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
  └─ CircularGapBuffer.js

ui/TextareaEditorView.js
  └─ browser DOM only

storage/LocalDocumentStorage.js
  └─ localStorage only
```

## Responsibilities

### `CircularGapBuffer.js`

Low-level mutable text storage. This file is intentionally left untouched.

### `domain/EditorDocument.js`

Editor-shaped document API. It is the only application layer 
that talks directly to `CircularGapBuffer`.

Typical methods:

```js
getText();
setText(text);
getCursor();
moveCursor(position);
insertText(text);
replaceRange(start, end, text);
deleteRange(start, end);
getStats();
debugState();
```

### `ui/TextareaEditorView.js`

Passive adapter around the native `<textarea>`. It owns DOM events and 
DOM state, but it does not mutate the document directly.

Typical methods:

```js
getText();
setText(text);
getSelection();
setSelection(start, end);
showStatus(text);
showDebug(text);
onBeforeInput(callback);
onNativeInput(callback);
onSelectionChange(callback);
onPaste(callback);
onSave(callback);
```

### `app/EditorPresenter.js`

Application coordinator. It interprets user intent, mutates the document, 
updates the view, and saves through storage.

### `storage/LocalDocumentStorage.js`

Plain-text persistence through `localStorage`. It deliberately knows 
nothing about the gap buffer.

## Why this is future-proof

To replace the native `<textarea>` with a custom `div`, canvas, or another 
rendering surface, create a new view adapter that implements the same view API 
as `TextareaEditorView`. The presenter, document, storage, 
and circular gap buffer can stay unchanged.
