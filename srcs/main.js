// srcs/main.js

import EditorPresenter from "./app/EditorPresenter.js";
import EditorDocument from "./domain/EditorDocument.js";
import LocalDocumentStorage from "./storage/LocalDocumentStorage.js";
import TextareaEditorView from "./ui/TextareaEditorView.js";

const DEFAULT_TEXT = "Hello, circular gap buffer!\n\nTry typing here.";

const textarea = document.querySelector("#editor");
const statusElement = document.querySelector("#status");
const debugElement = document.querySelector("#debug");

const storage = new LocalDocumentStorage();
const documentModel = new EditorDocument(storage.loadText() ?? DEFAULT_TEXT);
// const view = new TextareaEditorView({ textarea, statusElement, debugElement });
const view = new TextareaEditorView({
  textarea: document.querySelector("#editor"),
  lineNumbersElement: document.querySelector("#line-numbers"),
  statusElement: document.querySelector("#status"),
  debugElement: document.querySelector("#debug")
});
const presenter = new EditorPresenter({
  document: documentModel,
  view,
  storage
});

presenter.start();
