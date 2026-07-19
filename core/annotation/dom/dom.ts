import {
  INVISIBLE_TEXT_RE,
  createTextAnchorModel,
  findOccurrences,
  findTextAnchorMatch,
  isTextAnchor,
  normalizeAnchorText,
  textAnchorsEqual,
} from '../model/index.ts';

export {
  findTextAnchorMatch,
  normalizeAnchorText,
} from '../model/index.ts';

export function shortenHtml(html: string, maxLength: number = 150): string {
  html = (html || '').trim();
  if (!html) return '';

  const src = document.createElement('div');
  src.innerHTML = html;

  const out = document.createElement('div');
  let count = 0;
  let finished = false;

  // Helpers to detect math delimiters in a text chunk and avoid splitting them
  function findNextClosingDoubleDollar(text: string, from: number): number {
    return text.indexOf('$$', from);
  }

  function findNextClosingSingleDollar(text: string, from: number): number {
    return text.indexOf('$', from);
  }

  // Count occurrences of a substring non-overlapping
  function countOccurrences(text: string, sub: string): number {
    if (!sub) return 0;
    let c = 0;
    let idx = 0;
    while ((idx = text.indexOf(sub, idx)) !== -1) {
      c++;
      idx += sub.length;
    }
    return c;
  }

  function appendTextFragment(parent: Node, text: string) {
    parent.appendChild(document.createTextNode(text));
  }

  function visit(node: Node, outParent: Node) {
    if (finished) return;

    if (node.nodeType === Node.TEXT_NODE) {
      const txt = (node as Text).nodeValue || '';
      if (txt.length === 0) return;

      const remaining = maxLength - count;
      if (remaining <= 0) {
        finished = true;
        return;
      }

      if (txt.length <= remaining) {
        appendTextFragment(outParent, txt);
        count += txt.length;
        return;
      }

      // We'll need to cut this text node but avoid splitting math delimited by $$ or $
      let cutIndex = remaining;

      // Check for $$ occurrences
      // Count how many $$ exist in the prefix (non-overlapping). If odd -> unmatched opening
      const prefix = txt.slice(0, cutIndex);
      const suffix = txt.slice(cutIndex);

      const doubleBefore = countOccurrences(prefix, '$$');
      if (doubleBefore % 2 === 1) {
        const next = findNextClosingDoubleDollar(txt, cutIndex);
        if (next !== -1) {
          cutIndex = next + 2;
        } else {
          // no closing found in this node, try to include full node to avoid breaking
          appendTextFragment(outParent, txt);
          count += txt.length;
          // let traversal continue but we already added the whole node
          return;
        }
      } else {
        // Handle single $ that are not part of $$
        // Build a simple view where we mask out $$ so single $ count is accurate
        const masked = txt.replace(/\$\$/g, '__DOLLAR2__');
        const singleBefore = countOccurrences(masked.slice(0, cutIndex), '$');
        if (singleBefore % 2 === 1) {
          const next = findNextClosingSingleDollar(txt, cutIndex);
          if (next !== -1) {
            cutIndex = next + 1;
          } else {
            // no closing found in this node, include full node
            appendTextFragment(outParent, txt);
            count += txt.length;
            return;
          }
        }
      }

      // Strip at word boundary: walk back to the end of the previous word
      let wordCut = cutIndex;
      while (wordCut > 0 && !/\s/.test(txt[wordCut - 1])) {
        wordCut--;
      }
      // Only use the word boundary if we actually found whitespace;
      // otherwise fall back to the original cutIndex to avoid empty output
      if (wordCut > 0) cutIndex = wordCut;

      // Final safe cut
      appendTextFragment(outParent, txt.slice(0, cutIndex));
      count += cutIndex;
      finished = true;
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;

      // Treat math/script-like elements as atomic: if they contain math source we append whole element
      const isMathScript = el.tagName.toLowerCase() === 'script' && (el.getAttribute('type') || '').toLowerCase().startsWith('math');
      const hasMathAttr = el.hasAttribute('data-mathml') || el.tagName.toLowerCase() === 'annotation' || el.classList.contains('katex') || el.className.indexOf('MathJax') !== -1;

      if ((isMathScript || hasMathAttr) && !finished) {
        // append clone of entire element to ensure math is not split
        outParent.appendChild(el.cloneNode(true));
        // update count with textContent length (best-effort)
        count += (el.textContent || '').length;
        // If we've reached or exceeded the limit, stop
        if (count >= maxLength) finished = true;
        return;
      }

      // Normal element: clone shallowly, then descend into children until limit
      const shallow = el.cloneNode(false);
      outParent.appendChild(shallow);
      for (let child = node.firstChild; child; child = child.nextSibling) {
        if (finished) break;
        visit(child, shallow);
      }
      // If element became empty (no children and no text), remove it to avoid stray empty tags
      if (!shallow.childNodes || shallow.childNodes.length === 0) {
        shallow.parentNode?.removeChild(shallow);
      }
      return;
    }

    // For other node types, ignore
  }

  for (let c = src.firstChild; c; c = c.nextSibling) {
    if (finished) break;
    visit(c, out);
  }

  // Trim trailing whitespace in output; only append "..." if the text was truncated
  return out.innerHTML.trim() + (finished ? "..." : "");
}

export function rangeToHtml(range: Range | null): string {
  if (!range) {
    console.log("Range is null")
    return '';
  }

  // Clone the range to avoid affecting the original
  const clonedRange = range.cloneRange();
  const fragment = clonedRange.cloneContents();

  // Create a temporary container
  const tempDiv = document.createElement('div');
  tempDiv.appendChild(fragment);
  return tempDiv.innerHTML;
}

/**
 * Find the deepest element under `root` such that no single direct child
 * accounts for more than `threshold` fraction of the element's text.
 * This is useful to locate a content node that is not merely a wrapper
 * composed mostly of a single child block.
 */
export function findBestContentNode(root: HTMLElement, threshold: number = 0.9, minTotal: number = 20): HTMLElement {
  const annotationHighlightSelector = 'span.highlighted-text[data-highlight-id]';

  function nodeTextLen(n: Node | null): number {
    if (!n) return 0;
    const t = n.textContent || '';
    return t.trim().length;
  }

  let current: HTMLElement = root;

  while (true) {
    const currentTotal = nodeTextLen(current);
    if (currentTotal < minTotal) return current;

    // Look through all children to find one that accounts for >threshold of parent's text
    let dominantChild: HTMLElement | null = null;
    for (let child = current.firstElementChild; child; child = child.nextElementSibling) {
      if (child.matches(annotationHighlightSelector)) continue;

      const childTotal = nodeTextLen(child);
      if (currentTotal > 0 && (childTotal / currentTotal) > threshold) {
        dominantChild = child as HTMLElement;
        break;
      }
    }

    // If no child dominates, this is our optimal node
    if (!dominantChild) {
      return current;
    }

    // Otherwise, descend into the dominant child
    current = dominantChild;
  }
}

export function cleanedHtml(html: string): { html: string; mathSource?: string } {
  if (!html.trim()) return { html: '' };

  // Parse the HTML string into a DOM element
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  const clone = tempDiv.cloneNode(true) as HTMLElement;

  // Annotation wrappers are presentation-only and must never leak into saved
  // excerpts (notably when an existing highlight is resized across another
  // highlight). Keep their contents and discard only annotator-owned markup.
  clone.querySelectorAll('span.highlighted-text[data-highlight-id]').forEach((span) => {
    span.replaceWith(...Array.from(span.childNodes));
  });

  // Remove only the noisy/assistive MathJax elements that interfere with
  // saving/re-processing. Preserve core rendered output (e.g. .MathJax,
  // .katex) and <math> nodes so the Dashboard can display already-rendered
  // math or re-run the renderer when needed.
  const toRemoveSelectors = [
    '.MathJax_Preview',
    '.MJX_Assistive_MathML',
    'mjx-assistive-mml'
  ];
  toRemoveSelectors.forEach(selector => {
    clone.querySelectorAll(selector).forEach(el => el.remove());
  });

  // Collect math sources from various places
  const mathSources: string[] = [];

  // For script[type="math/tex"], remove MathJax-assigned ids to allow re-processing
  // Replace script[type="math/..."] with placeholder spans and remember
  // the wrapped math text (e.g. $...$ or $$...$$). We'll later inject the
  // math text back after whitespace normalization so KaTeX can find it.
  const mathMap: string[] = [];
  Array.from(clone.querySelectorAll('script[type^="math/"]')).forEach((script, idx) => {
    try {
      // remove MathJax-assigned ids
      script.removeAttribute('id');
      const raw = (script.textContent || '').trim();
      if (!raw) {
        // empty script: just remove
        script.remove();
        return;
      }

      // Collect raw math source
      mathSources.push(raw);

      const typeAttr = (script.getAttribute('type') || '').toLowerCase();
      let isDisplay = /mode\s*=\s*display/.test(typeAttr) || /^\\\[/.test(raw) || /^\$\$/.test(raw);

      // Check if the corresponding MathJax element has display class
      if (!isDisplay) {
        const scriptId = script.getAttribute('id');
        if (scriptId) {
          const mathJaxElement = clone.querySelector(`[id="${scriptId}-Frame"]`);
          if (mathJaxElement && mathJaxElement.classList.contains('mjx-display')) {
            isDisplay = true;
          }
        }
      }

      const wrapped = isDisplay ? `$$ ${raw} $$` : `$ ${raw} $`;
      mathMap.push(wrapped);

      const placeholder = document.createElement('span');
      placeholder.setAttribute('data-math-placeholder', String(mathMap.length - 1));
      // insert placeholder where script was
      script.parentNode?.replaceChild(placeholder, script);
    } catch (e) {
      try { script.remove(); } catch (_e) { }
    }
  });

  // Extract math source from MathML <annotation> elements
  Array.from(clone.querySelectorAll('annotation')).forEach(ann => {
    const content = (ann.textContent || '').trim();
    if (content) mathSources.push(content);
  });

  // Extract math source from data-mathml attributes
  Array.from(clone.querySelectorAll('[data-mathml]')).forEach(el => {
    const mathml = (el.getAttribute('data-mathml') || '').trim();
    if (mathml) mathSources.push(mathml);
  });

  // If the fragment contains math script placeholders (we replaced scripts
  // above) or MathML, remove any already-rendered MathJax/KaTeX output to
  // avoid duplicated visuals when the Dashboard runs MathJax.
  const hasMathScript = clone.querySelector('[data-math-placeholder]');
  const hasMathML = clone.querySelector('math');
  const hasRenderedMath = clone.querySelector('[class*="MathJax"], [class*="mjx-"], .katex, [data-mathml]');
  if (hasMathScript || hasMathML || hasRenderedMath) {
    // Remove rendered output nodes that would duplicate script-driven rendering
    clone.querySelectorAll('[class*="MathJax"], [class*="mjx-"], .katex, .katex-display, span.math, [data-mathml], [id^="MathJax-"]').forEach(el => el.remove());
  }

  // Remove event handler attributes for safety
  const allElements = clone.querySelectorAll('*');
  allElements.forEach(el => {
    Array.from(el.attributes).forEach(attr => {
      if (attr.name.startsWith('on') ||
        attr.name === 'javascript:' ||
        attr.name === 'data-react' ||
        attr.name.startsWith('data-testid')) {
        el.removeAttribute(attr.name);
      }
    });
  });

  // Normalize whitespace in the HTML but preserve the math placeholders.
  const normalized = clone.innerHTML.replace(/\s+/g, ' ').trim();

  // Build a new DOM from the normalized HTML so we can replace placeholders
  // with actual text nodes (containing $...$ or $$...$$) safely.
  const finalDiv = document.createElement('div');
  finalDiv.innerHTML = normalized;

  // Replace placeholders with text nodes containing the wrapped math
  Array.from(finalDiv.querySelectorAll('[data-math-placeholder]')).forEach((ph) => {
    const id = ph.getAttribute('data-math-placeholder');
    if (!id) return;
    const idx = Number(id);
    const mathText = mathMap[idx];
    if (mathText == null) return;
    ph.parentNode?.replaceChild(document.createTextNode(mathText), ph);
  });

  // Return the finalized HTML string and math source
  // Note: we intentionally do not re-run a global whitespace collapse here so
  // the math text is preserved exactly as inserted above.
  const finalHtml = finalDiv.innerHTML.trim();
  const mathSource = mathSources.length > 0 ? mathSources.join('\n') : undefined;

  return { html: finalHtml, mathSource };
}

const EXCLUDED_TEXT_SELECTOR = [
  'script',
  'style',
  'noscript',
  'template',
  '[hidden]',
  '.MathJax_Preview',
  '.MJX_Assistive_MathML',
  'mjx-assistive-mml',
  '.katex-mathml',
].join(',');
const RENDERED_MATH_SELECTOR = '[data-mathml], .MathJax, .katex';

type IndexedCharacter = {
  char: string;
  startNode: Text;
  startOffset: number;
  endNode: Text;
  endOffset: number;
};

export type TextIndex = {
  root: HTMLElement;
  text: string;
  characters: IndexedCharacter[];
  compactText: string;
  compactCharacters: IndexedCharacter[];
};

function getGraphemeSegments(value: string): Array<{ segment: string; index: number }> {
  if (typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return Array.from(segmenter.segment(value), ({ segment, index }) => ({ segment, index }));
  }

  const segments: Array<{ segment: string; index: number }> = [];
  let index = 0;
  for (const segment of value) {
    segments.push({ segment, index });
    index += segment.length;
  }
  return segments;
}

function isIndexableTextNode(node: Text, root: HTMLElement, visibility: WeakMap<Element, boolean>): boolean {
  if (!node.nodeValue) return false;

  // MathJax and KaTeX mark their visual output aria-hidden because a second,
  // assistive representation is provided to screen readers. Index the visual
  // tree once and continue to exclude the assistive tree above. Otherwise a
  // formula either disappears from the anchor or is counted multiple times.
  const renderedMath = node.parentElement?.closest(RENDERED_MATH_SELECTOR);
  const isRenderedMath = Boolean(renderedMath && root.contains(renderedMath));

  for (let element = node.parentElement; element; element = element.parentElement) {
    let visible = visibility.get(element);
    if (visible === undefined) {
      visible = !element.matches(EXCLUDED_TEXT_SELECTOR);
      const isMathRenderingElement = isRenderedMath && renderedMath?.contains(element);
      if (visible && element.matches('[aria-hidden="true"]') && !isMathRenderingElement) {
        visible = false;
      }
      if (visible) {
        const style = element.ownerDocument.defaultView?.getComputedStyle(element);
        visible = style?.display !== 'none'
          && style?.visibility !== 'hidden'
          && style?.visibility !== 'collapse';
      }
      visibility.set(element, visible);
    }
    if (!visible) return false;
    if (element === root) return true;
  }

  return false;
}

function buildTextIndex(
  root: HTMLElement,
  accepts: (node: Text) => boolean,
  emptyMessage: string,
): TextIndex {
  const characters: IndexedCharacter[] = [];
  const compactCharacters: IndexedCharacter[] = [];
  const walker = root.ownerDocument.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        return accepts(node as Text)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    },
  );

  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const value = node.nodeValue ?? '';
    for (const { segment, index } of getGraphemeSegments(value)) {
      const normalized = segment.normalize('NFC').replace(INVISIBLE_TEXT_RE, '');
      const endOffset = index + segment.length;

      for (let i = 0; i < normalized.length; i++) {
        const char = normalized[i];
        const indexed: IndexedCharacter = {
          char,
          startNode: node,
          startOffset: index,
          endNode: node,
          endOffset,
        };

        if (/\s/u.test(char)) {
          const previous = characters[characters.length - 1];
          if (!previous) continue;
          if (previous.char === ' ') {
            previous.endNode = node;
            previous.endOffset = endOffset;
          } else {
            characters.push({ ...indexed, char: ' ' });
          }
        } else {
          characters.push(indexed);
          compactCharacters.push(indexed);
        }
      }
    }
  }

  if (characters[characters.length - 1]?.char === ' ') characters.pop();
  if (characters.length === 0) throw new Error(emptyMessage);

  return {
    root,
    text: characters.map(({ char }) => char).join(''),
    characters,
    compactText: compactCharacters.map(({ char }) => char).join(''),
    compactCharacters,
  };
}

export function createTextIndex(root: HTMLElement): TextIndex {
  const visibility = new WeakMap<Element, boolean>();
  return buildTextIndex(
    root,
    (node) => isIndexableTextNode(node, root, visibility),
    'No visible text found in the document',
  );
}

function rangeFromCharacters(
  ownerDocument: Document,
  characters: IndexedCharacter[],
  start: number,
  end: number,
): Range | null {
  if (
    !Number.isInteger(start)
    || !Number.isInteger(end)
    || start < 0
    || end <= start
    || end > characters.length
  ) return null;

  const first = characters[start];
  const last = characters[end - 1];
  const range = ownerDocument.createRange();
  range.setStart(first.startNode, first.startOffset);
  range.setEnd(last.endNode, last.endOffset);
  return range;
}

function anchorAt(index: TextIndex, start: number, end: number): TextAnchor {
  return createTextAnchorModel(index.text, start, end);
}

function isLegacyMathRepeat(fragment: string): boolean {
  return /[\[\](){}=+*\/^_<>|\\]/u.test(fragment) || /^[A-Z]$/u.test(fragment);
}

function collapseAdjacentRepeatedFragments(value: string): {
  text: string;
  changed: boolean;
} {
  let text = '';
  let changed = false;
  let index = 0;

  while (index < value.length) {
    const maxLength = Math.min(80, Math.floor((value.length - index) / 2));
    let repeated: { fragment: string; count: number } | null = null;

    for (let length = 1; length <= maxLength; length++) {
      const fragment = value.slice(index, index + length);
      if (!fragment.trim()) continue;

      let count = 1;
      while (
        index + (count + 1) * length <= value.length
        && value.slice(index + count * length, index + (count + 1) * length) === fragment
      ) {
        count++;
      }

      if (count > 1 && isLegacyMathRepeat(fragment)) {
        repeated = { fragment, count };
        break;
      }
    }

    if (!repeated) {
      text += value[index];
      index++;
      continue;
    }

    text += repeated.fragment;
    changed = true;
    index += repeated.fragment.length * repeated.count;
  }

  return { text, changed };
}

export function createTextAnchor(
  root: HTMLElement,
  range: Range,
  index: TextIndex = createTextIndex(root),
): TextAnchor | null {
  const ownerDocument = root.ownerDocument;
  const startBoundary = range.cloneRange();
  const endBoundary = range.cloneRange();
  const point = ownerDocument.createRange();
  startBoundary.collapse(true);
  endBoundary.collapse(false);

  let start = -1;
  let end = -1;

  try {
    for (let i = 0; i < index.characters.length; i++) {
      const character = index.characters[i];
      point.setStart(character.endNode, character.endOffset);
      point.collapse(true);
      if (point.compareBoundaryPoints(Range.START_TO_START, startBoundary) <= 0) continue;

      point.setStart(character.startNode, character.startOffset);
      point.collapse(true);
      if (point.compareBoundaryPoints(Range.START_TO_START, endBoundary) >= 0) break;

      if (start === -1) start = i;
      end = i + 1;
    }
  } catch {
    return null;
  }

  if (start === -1 || end <= start) return null;
  return anchorAt(index, start, end);
}

export function getRange(
  root: HTMLElement,
  searchText: string,
  rangePosition?: Annotation['position'],
  index: TextIndex = createTextIndex(root),
): {
  range: Range;
  usedPosition: boolean;
  resolvedPosition?: TextAnchor;
} {
  const exact = normalizeAnchorText(searchText);
  if (!exact) throw new Error('Search text must be non-empty');

  if (rangePosition && isTextAnchor(rangePosition)) {
    // The displayed annotation text may come from Range#toString(), which
    // included MathJax's visual, assistive, and script representations in old
    // annotations. The anchor exact is the canonical one-representation quote.
    const anchorExact = normalizeAnchorText(rangePosition.exact);
    const start = findTextAnchorMatch(index.text, anchorExact, rangePosition);
    if (start !== null) {
      const end = start + anchorExact.length;
      const range = rangeFromCharacters(root.ownerDocument, index.characters, start, end);
      if (range) {
        const resolvedPosition = anchorAt(index, start, end);
        const unchanged = textAnchorsEqual(rangePosition, resolvedPosition);
        return {
          range,
          usedPosition: unchanged,
          resolvedPosition: unchanged ? undefined : resolvedPosition,
        };
      }
    }
  }

  const start = findTextAnchorMatch(index.text, exact);
  if (start !== null) {
    const end = start + exact.length;
    const range = rangeFromCharacters(root.ownerDocument, index.characters, start, end);
    if (!range) throw new Error('Unable to reconstruct annotation range');
    return { range, usedPosition: false, resolvedPosition: anchorAt(index, start, end) };
  }

  const collapsedLegacyExact = collapseAdjacentRepeatedFragments(exact);
  if (collapsedLegacyExact.changed) {
    const repairedStart = findTextAnchorMatch(index.text, collapsedLegacyExact.text);
    if (repairedStart !== null) {
      const repairedEnd = repairedStart + collapsedLegacyExact.text.length;
      const range = rangeFromCharacters(root.ownerDocument, index.characters, repairedStart, repairedEnd);
      if (!range) throw new Error('Unable to reconstruct annotation range');
      return {
        range,
        usedPosition: false,
        resolvedPosition: anchorAt(index, repairedStart, repairedEnd),
      };
    }
  }

  const occurrences = Math.max(
    findOccurrences(index.text, exact).length,
  );
  if (occurrences > 1) throw new Error(`Annotation text is ambiguous (${occurrences} matches)`);
  throw new Error(`${searchText} not found in document`);
}

export function getRangeByText(root: HTMLElement, searchText: string): {
  range: Range;
  startPosition: number;
  endPosition: number;
  startOffset: number;
  endOffset: number;
} {
  const index = createTextIndex(root);
  const exact = normalizeAnchorText(searchText);
  const start = findTextAnchorMatch(index.text, exact);
  if (start === null) throw new Error('Text not found or is ambiguous');

  const end = start + exact.length;
  const range = rangeFromCharacters(root.ownerDocument, index.characters, start, end);
  if (!range) throw new Error('Unable to reconstruct annotation range');
  const first = index.characters[start];
  const last = index.characters[end - 1];
  return {
    range,
    startPosition: start,
    endPosition: end - 1,
    startOffset: first.startOffset,
    endOffset: last.endOffset,
  };
}

export function highlightRange(range: Range, color: string = "#ffff00", id?: string): string {
  if (!id) {
    id = Date.now().toString();
  }

  // Split boundaries so the selected parts become whole text nodes
  // Only split when the offset is strictly inside a text node. Splitting at
  // offset 0 or at node length creates empty text nodes which later lead to
  // empty highlighted spans.
  if (range.endContainer.nodeType === Node.TEXT_NODE) {
    const t = range.endContainer as Text;
    const tv = t.nodeValue || '';
    if (range.endOffset > 0 && range.endOffset < tv.length) {
      t.splitText(range.endOffset);
    }
  }
  if (range.startContainer.nodeType === Node.TEXT_NODE) {
    const t = range.startContainer as Text;
    const tv = t.nodeValue || '';
    if (range.startOffset > 0 && range.startOffset < tv.length) {
      t.splitText(range.startOffset);
    }
  }
  // Build ordered wrap actions between the split boundaries. Each action is
  // either a group of consecutive sibling inline nodes to wrap, or a block
  // element that should have its inline children wrapped recursively.
  const actions = collectWrapActions(range);
  for (const a of actions) {
    if (a.type === 'wrap') {
      wrapNodes(a.nodes, color, id);
    } else {
      wrapInlineChildren(a.node, color, id);
    }
  }

  return id;
}

type WrapAction =
  | { type: 'wrap'; parent: Node; nodes: Node[] }
  | { type: 'block'; node: Node };

function collectWrapActions(range: Range): WrapAction[] {
  const actions: WrapAction[] = [];
  const start = range.startContainer;
  const end = range.endContainer;
  const root = range.commonAncestorContainer;
  if (!root) return actions;

  const doc = (root && root.ownerDocument) || document;

  const walker = doc.createTreeWalker(
    root as Node,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode(node: Node) {
        if (node.nodeType === Node.TEXT_NODE) {
          const s = (node as Text).nodeValue;
          if (!s || s.length === 0) return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  // Advance walker to the start node
  walker.currentNode = start;
  let n: Node | null = start;

  let inlineGroup: { parent: Node | null; nodes: Node[] } | null = null;

  function flushInline() {
    if (inlineGroup && inlineGroup.nodes.length > 0) {
      actions.push({ type: 'wrap', parent: inlineGroup.parent as Node, nodes: inlineGroup.nodes });
      inlineGroup = null;
    }
  }

  while (n) {
    // If this is a block element fully inside the range, handle it separately
    if (n.nodeType === Node.ELEMENT_NODE && isBlockElement(n) && nodeFullyContained(range, n)) {
      flushInline();
      actions.push({ type: 'block', node: n });
      // Skip the block's subtree
      const next = walker.nextSibling();
      n = next;
      if (!n) break;
      if (n === end) {
        // continue loop to process end
      }
      continue;
    }

    // If the node itself is fully contained and is an inline element or text,
    // group it by its direct parent (so wrappers are inserted in the correct
    // parent and we never attempt to wrap across different parents).
    if (nodeFullyContained(range, n)) {
      const parent = n.parentNode;
      if (parent) {
        if (!inlineGroup) {
          inlineGroup = { parent, nodes: [n] };
        } else {
          const last = inlineGroup.nodes[inlineGroup.nodes.length - 1] as Node;
          if (inlineGroup.parent === parent && last.nextSibling === n) {
            inlineGroup.nodes.push(n);
          } else {
            flushInline();
            inlineGroup = { parent, nodes: [n] };
          }
        }

        // If we included an element node, skip its descendants to avoid
        // double-including children.
        if (n.nodeType === Node.ELEMENT_NODE) {
          const next = walker.nextSibling();
          n = next;
          if (!n) break;
          if (n === end) {
            // continue loop to allow finalization
          }
          continue;
        }
      }
    }

    if (n === end) break;
    n = walker.nextNode();
  }

  flushInline();
  return actions;
}

function wrapInlineChildren(parent: Node, color: string, id: string) {
  if (parent.nodeType !== Node.ELEMENT_NODE) return;

  const children = Array.from(parent.childNodes);
  let i = 0;
  while (i < children.length) {
    if (isBlockElement(children[i])) {
      // Recursively wrap inline children of this block
      wrapInlineChildren(children[i], color, id);
      i++;
    } else {
      // Collect consecutive inline children
      const inlineGroup: Node[] = [];
      while (i < children.length && !isBlockElement(children[i])) {
        inlineGroup.push(children[i]);
        i++;
      }
      if (inlineGroup.length > 0) {
        wrapNodes(inlineGroup, color, id);
      }
    }
  }
}

function wrapNodes(nodes: Node[], color: string, id: string) {
  if (nodes.length === 0) return;

  const first = nodes[0];
  const parent = first.parentNode;
  if (!parent) return;

  const wrapper = (first.ownerDocument || document).createElement('span');
  wrapper.className = 'highlighted-text';
  wrapper.dataset.highlightId = id;
  wrapper.style.backgroundColor = color;

  parent.insertBefore(wrapper, first);

  for (const node of nodes) {
    wrapper.appendChild(node);
  }
  // If the wrapper contains only whitespace text (no visible content),
  // unwrap it to avoid creating tiny empty highlighted spans between blocks.
  const text = (wrapper.textContent || '');
  if (text.trim().length === 0) {
    const hasElementChild = Array.from(wrapper.childNodes).some(n => n.nodeType === Node.ELEMENT_NODE);
    if (!hasElementChild) {
      while (wrapper.firstChild) {
        parent.insertBefore(wrapper.firstChild, wrapper);
      }
      parent.removeChild(wrapper);
    }
  }
}

function nodeFullyContained(rng: Range, node: Node): boolean {
  try {
    const nr = (node.ownerDocument || document).createRange();
    if (node.nodeType === Node.TEXT_NODE) {
      nr.selectNodeContents(node);
    } else {
      nr.selectNode(node);
    }
    // rng.start <= nr.start  AND rng.end >= nr.end
    return (
      rng.compareBoundaryPoints(Range.START_TO_START, nr) <= 0 &&
      rng.compareBoundaryPoints(Range.END_TO_END, nr) >= 0
    );
  } catch (e) {
    return false;
  }
}

function isBlockElement(node: Node): boolean {
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  // cheap fast-path for common blocks; you can expand this list
  if (['p', 'div', 'li', 'ul', 'ol', 'section', 'article', 'blockquote', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) return true;
  // fallback (in case of custom blocks)
  const display = getComputedStyle(el).display;
  return display === 'block' || display === 'list-item' || display === 'table' || display === 'flex' || display === 'grid';
}

export function removeHighlights(container: HTMLElement, id: string): void {
  // Find all highlight spans with this id inside the container
  const spans = container.querySelectorAll<HTMLSpanElement>(
    `span.highlighted-text[data-highlight-id="${id}"]`
  );

  const affectedParents = new Set<Node>();

  spans.forEach((span) => {
    const parent = span.parentNode;
    if (!parent) return;

    affectedParents.add(parent);

    // Unwrap span → put back its contents (text nodes or elements)
    while (span.firstChild) {
      parent.insertBefore(span.firstChild, span);
    }
    parent.removeChild(span);
  });

  // Repeated resize/delete cycles otherwise leave a growing number of
  // adjacent text nodes. Normalizing once per affected parent keeps later
  // range lookup and caret movement inexpensive.
  affectedParents.forEach((parent) => parent.normalize());
}
