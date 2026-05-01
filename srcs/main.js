// srcs/main.js

import EditorPresenter from "./app/EditorPresenter.js";
import EditorDocument from "./domain/EditorDocument.js";
import LocalDocumentStorage from "./storage/LocalDocumentStorage.js";
import TextareaEditorView from "./ui/TextareaEditorView.js";

const DEFAULT_TEXT = "Hello, circular gap buffer!\n\nTry typing here.";
const DEFAULT_WINDOW_SIZE = 4000;

const storage = new LocalDocumentStorage();
const documentModel = new EditorDocument(storage.loadText() ?? DEFAULT_TEXT, {
  windowSize: DEFAULT_WINDOW_SIZE
});

const view = new TextareaEditorView({
  textarea: document.querySelector("#editor"),
  lineNumbersElement: document.querySelector("#line-numbers"),
  statusElement: document.querySelector("#status"),
  debugElement: document.querySelector("#debug"),
  firstWindowButton: document.querySelector("#first-window"),
  previousWindowButton: document.querySelector("#previous-window"),
  nextWindowButton: document.querySelector("#next-window"),
  lastWindowButton: document.querySelector("#last-window")
});

const presenter = new EditorPresenter({
  document: documentModel,
  view,
  storage
});

presenter.start();
