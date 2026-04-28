// srcs/CircularGapBufferFileStorage.js

import { readFile, writeFile } from "node:fs/promises";
import CircularGapBuffer from "./CircularGapBuffer.js";

/**
 * Saves a CircularGapBuffer to a JSON file.
 *
 * @param {string} path - File path.
 * @param {CircularGapBuffer} buffer - Buffer to save.
 * @returns {Promise<void>}
 */
export async function saveCircularGapBufferToFile(path, buffer) {
  const data = buffer.toSerializable();
  const json = JSON.stringify(data, null, 2);

  await writeFile(path, json, "utf8");
}

/**
 * Loads a CircularGapBuffer from a JSON file.
 *
 * @param {string} path - File path.
 * @returns {Promise<CircularGapBuffer>} Restored circular gap buffer.
 */
export async function loadCircularGapBufferFromFile(path) {
  const json = await readFile(path, "utf8");
  const data = JSON.parse(json);

  return CircularGapBuffer.fromSerializable(data);
}
