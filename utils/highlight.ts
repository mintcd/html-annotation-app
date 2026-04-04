function findFirstTextNode(element: Element | null, doc: Document): Text | null {
  if (!element) return null;
  const walker = doc.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
  return walker.nextNode() as Text;
}

function findLastTextNode(element: Element | null, doc: Document): Text | null {
  if (!element) return null;
  const walker = doc.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
  let last: Text | null = null;
  let node = walker.nextNode() as Text;
  while (node) {
    last = node;
    node = walker.nextNode() as Text;
  }
  return last;
}

export function highlightStartPosition(id: string, doc: Document = document): DOMRect | null {
  const spans = doc.querySelectorAll<HTMLSpanElement>(`span.highlighted-text[data-highlight-id="${id}"]`);
  if (spans.length === 0) return null;

  const firstSpan = spans[0];

  // Get position of the first character
  const startRange = doc.createRange();
  const startTextNode = findFirstTextNode(firstSpan, doc);
  if (startTextNode && startTextNode.nodeValue && startTextNode.nodeValue.length > 0) {
    startRange.setStart(startTextNode, 0);
    startRange.setEnd(startTextNode, 1);
  } else if (firstSpan) {
    startRange.selectNodeContents(firstSpan);
  }
  const rect = startRange.getBoundingClientRect();
  return toTopWindowRect(rect, doc);
}

export function highlightEndPosition(id: string, doc: Document = document): DOMRect | null {
  const spans = doc.querySelectorAll<HTMLSpanElement>(`span.highlighted-text[data-highlight-id="${id}"]`);
  if (spans.length === 0) return null;

  const lastSpan = spans[spans.length - 1];

  // Get position of the last character
  const endRange = doc.createRange();
  const endTextNode = findLastTextNode(lastSpan, doc);
  if (endTextNode && endTextNode.nodeValue && endTextNode.nodeValue.length > 0) {
    const textLength = endTextNode.nodeValue.length;
    endRange.setStart(endTextNode, Math.max(0, textLength - 1));
    endRange.setEnd(endTextNode, textLength);
  } else if (lastSpan) {
    endRange.selectNodeContents(lastSpan);
  }
  const rect = endRange.getBoundingClientRect();
  return toTopWindowRect(rect, doc);
}

export function highlightBoundingRect(id: string, doc: Document = document): DOMRect | null {
  const spans = doc.querySelectorAll<HTMLSpanElement>(`span.highlighted-text[data-highlight-id="${id}"]`);
  if (spans.length === 0) return null;

  const first = spans[0].getBoundingClientRect();
  const last = spans[spans.length - 1].getBoundingClientRect();

  const left = Math.min(first.left, last.left);
  const right = Math.max(first.right, last.right);
  const top = Math.min(first.top, last.top);
  const bottom = Math.max(first.bottom, last.bottom);

  // Construct a DOMRect-like object in the source document's viewport,
  // then convert it into the top-level window coordinate space.
  const localRect = { left, top, right, bottom, width: right - left, height: bottom - top } as DOMRect;
  return toTopWindowRect(localRect, doc);
}

// Convert a client rect from an arbitrary document's viewport into the
// top-level window coordinate space by walking up through any containing
// frame elements and adding their bounding rect offsets. This helps keep
// overlays positioned correctly when content lives inside an <iframe> and
// the top-level page is zoomed or scrolled differently (notably on iOS).
export function toTopWindowRect(rect: DOMRect, doc: Document = document): DOMRect {
  let left = rect.left;
  let top = rect.top;
  let right = rect.right;
  let bottom = rect.bottom;

  // Walk up through nested frames, accumulating offsets of each frame
  // element as reported in its parent's viewport.
  let win: Window | null = doc.defaultView ?? null;
  while (win && win !== window) {
    try {
      const fe = win.frameElement as HTMLElement | null;
      if (!fe) break;
      const fRect = fe.getBoundingClientRect();
      left += fRect.left;
      right += fRect.left;
      top += fRect.top;
      bottom += fRect.top;
      win = win.parent;
    } catch (err) {
      // If cross-origin or other errors occur, stop converting further.
      break;
    }
  }

  // Adjust for the top-level visual viewport offset. When the user pinches
  // to zoom or pans on mobile, the visual viewport can be offset relative
  // to the layout viewport. Fixed-position elements are placed relative
  // to the visual viewport, so subtract the offset to convert the
  // layout-based coordinates into visual-viewport coordinates.
  try {
    const topVV = window.visualViewport;
    if (topVV) {
      left -= topVV.offsetLeft;
      right -= topVV.offsetLeft;
      top -= topVV.offsetTop;
      bottom -= topVV.offsetTop;
    }
  } catch (err) {
    // ignore - if access is denied, return best-effort coords
  }

  return { left, top, right, bottom, width: right - left, height: bottom - top } as DOMRect;
}