// srcs/CircularGapBufferStorage.js

import CircularGapBuffer from "./CircularGapBuffer.js";

/**
 * Saves a CircularGapBuffer to localStorage.
 *
 * @param {string} key - localStorage key.
 * @param {CircularGapBuffer} buffer - Buffer to save.
 * @returns {void}
 */
export function saveCircularGapBufferToLocalStorage(key, buffer) {
  const data = buffer.toSerializable();
  localStorage.setItem(key, JSON.stringify(data));
}

/**
 * Loads a CircularGapBuffer from localStorage.
 *
 * @param {string} key - localStorage key.
 * @returns {CircularGapBuffer|null} Restored buffer, or null if no data exists.
 */
export function loadCircularGapBufferFromLocalStorage(key) {
  const raw = localStorage.getItem(key);

  if (raw === null) {
    return null;
  }

  const data = JSON.parse(raw);

  return CircularGapBuffer.fromSerializable(data);
}

/**
 * Removes a saved CircularGapBuffer from localStorage.
 *
 * @param {string} key - localStorage key.
 * @returns {void}
 */
export function removeCircularGapBufferFromLocalStorage(key) {
  localStorage.removeItem(key);
}
