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
  return rect
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
  return rect
}

export function highlightBoundingRect(id: string, doc: Document): DOMRect {
  const spans = doc.querySelectorAll<HTMLSpanElement>(`span.highlighted-text[data-highlight-id="${id}"]`);
  if (spans.length === 0) throw new Error(`No spans found for highlight ID: ${id}`);

  const first = spans[0].getBoundingClientRect();
  const last = spans[spans.length - 1].getBoundingClientRect();

  const left = Math.min(first.left, last.left);
  const right = Math.max(first.right, last.right);
  const top = Math.min(first.top, last.top);
  const bottom = Math.max(first.bottom, last.bottom);

  // Construct a DOMRect-like object 
  return { left, top, right, bottom, width: right - left, height: bottom - top } as DOMRect;
}