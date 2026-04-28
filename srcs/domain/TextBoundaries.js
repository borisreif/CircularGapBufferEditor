// srcs/domain/TextBoundaries.js

let cachedSegmenter = null;

function getGraphemeSegmenter() {
  if (typeof Intl === "undefined" || typeof Intl.Segmenter !== "function") {
    return null;
  }

  cachedSegmenter ??= new Intl.Segmenter(undefined, { granularity: "grapheme" });
  return cachedSegmenter;
}

function isHighSurrogate(codeUnit) {
  return codeUnit >= 0xd800 && codeUnit <= 0xdbff;
}

function isLowSurrogate(codeUnit) {
  return codeUnit >= 0xdc00 && codeUnit <= 0xdfff;
}

function clampOffset(value, textLength) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError("Text offset must be a finite number.");
  }

  return Math.max(0, Math.min(Math.trunc(value), textLength));
}

function findSegmentAtOrBefore(text, offset) {
  const segmenter = getGraphemeSegmenter();
  if (!segmenter) {
    return null;
  }

  let previousSegment = null;

  for (const segment of segmenter.segment(text)) {
    if (segment.index >= offset) {
      break;
    }

    previousSegment = segment;
  }

  return previousSegment;
}

function findSegmentAtOrAfter(text, offset) {
  const segmenter = getGraphemeSegmenter();
  if (!segmenter) {
    return null;
  }

  for (const segment of segmenter.segment(text)) {
    if (segment.index >= offset) {
      return segment;
    }

    const segmentEnd = segment.index + segment.segment.length;
    if (offset < segmentEnd) {
      return segment;
    }
  }

  return null;
}

/**
 * Returns the previous deletion boundary before a cursor offset.
 *
 * This prefers grapheme-cluster boundaries when Intl.Segmenter is available and
 * falls back to surrogate-pair-aware UTF-16 deletion otherwise.
 */
export function previousGraphemeBoundary(text, cursor) {
  if (typeof text !== "string") {
    throw new TypeError("previousGraphemeBoundary() expects text to be a string.");
  }

  const offset = clampOffset(cursor, text.length);

  if (offset <= 0) {
    return 0;
  }

  const segment = findSegmentAtOrBefore(text, offset);
  if (segment) {
    return segment.index;
  }

  const previous = text.charCodeAt(offset - 1);
  const beforePrevious = text.charCodeAt(offset - 2);
  const deletesSurrogatePair =
    offset >= 2 && isLowSurrogate(previous) && isHighSurrogate(beforePrevious);

  return offset - (deletesSurrogatePair ? 2 : 1);
}

/**
 * Returns the next deletion boundary after a cursor offset.
 *
 * This prefers grapheme-cluster boundaries when Intl.Segmenter is available and
 * falls back to surrogate-pair-aware UTF-16 deletion otherwise.
 */
export function nextGraphemeBoundary(text, cursor) {
  if (typeof text !== "string") {
    throw new TypeError("nextGraphemeBoundary() expects text to be a string.");
  }

  const offset = clampOffset(cursor, text.length);

  if (offset >= text.length) {
    return text.length;
  }

  const segment = findSegmentAtOrAfter(text, offset);
  if (segment) {
    return segment.index + segment.segment.length;
  }

  const current = text.charCodeAt(offset);
  const next = text.charCodeAt(offset + 1);
  const deletesSurrogatePair =
    offset + 1 < text.length && isHighSurrogate(current) && isLowSurrogate(next);

  return offset + (deletesSurrogatePair ? 2 : 1);
}
