// src/main.js
import TextareaEditorView from "./TextareaEditorView.js";

const textarea = document.querySelector("#editor");
const status = document.querySelector("#status");
const debug = document.querySelector("#debug");

new TextareaEditorView(textarea, status, debug);