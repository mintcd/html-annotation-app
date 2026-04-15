import { buildKMPTable } from "./string";

export async function awaitDomSettled(iframe: HTMLIFrameElement) {
  if (!iframe) return;
  const doc = iframe.contentDocument;
  if (!doc) return;

  // Wait until document reports complete (if not already)
  if (doc.readyState !== 'complete') {
    await new Promise<void>((resolve) => {
      const onReady = () => {
        if (doc.readyState === 'complete') {
          doc.removeEventListener('readystatechange', onReady);
          resolve();
        }
      };
      doc.addEventListener('readystatechange', onReady);
    });
  }

  // Wait for document.fonts if available
  const fonts = (doc as any).fonts;
  if (fonts && fonts.ready) await fonts.ready;

  // Wait for DOM to be idle (no mutations) for a short window
  await new Promise<void>((resolve) => {
    let timer: number | null = null;
    const IDLE_MS = 2000;
    const observer = new MutationObserver(() => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        observer.disconnect();
        resolve();
      }, IDLE_MS);
    });

    try {
      observer.observe(doc, { childList: true, subtree: true, attributes: true, characterData: true });
    } catch (e) {
      // If observe fails for any reason, fall back to a short timeout
      resolve();
      return;
    }

    // In case there are no mutations at all, resolve after the idle window
    timer = window.setTimeout(() => {
      observer.disconnect();
      resolve();
    }, IDLE_MS);
  });

  // Ensure paints/layouts have run
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  console.log("DOM settled");
}

export function trackScriptExecution(iframe: HTMLIFrameElement) {
  try {
    const doc = iframe.contentDocument as Document;
    const iWin = iframe.contentWindow ?? (doc as any)?.defaultView;
    if (doc && iWin) {
      const initialScripts = Array.from(doc.getElementsByTagName('script')) as HTMLScriptElement[];
      let totalScripts = initialScripts.length;
      let executedCount = 0;
      let concluded = false;

      console.log('Total scripts:', totalScripts);

      const externalListeners: Array<{ el: HTMLScriptElement; handler: EventListener }> = [];
      const observed = new WeakSet<HTMLScriptElement>();
      let observer: MutationObserver | null = null;
      let onFrameUnload: (() => void) | null = null;

      const getPerfEntries = (): PerformanceResourceTiming[] => {
        try {
          if (iWin && iWin.performance && typeof iWin.performance.getEntriesByType === 'function') {
            return iWin.performance.getEntriesByType('resource') as PerformanceResourceTiming[];
          }
        } catch (e) {
          // ignore
        }
        return [];
      };

      const conclude = async () => {
        if (concluded) return;
        concluded = true;
        console.log('Execution complete - total scripts:', totalScripts);

        // cleanup
        try { observer?.disconnect(); } catch (e) { /* ignore */ }
        externalListeners.forEach(({ el, handler }) => {
          el.removeEventListener('load', handler);
          el.removeEventListener('error', handler);
        });
        if (onFrameUnload) iframe.removeEventListener('load', onFrameUnload);

      };

      const checkAndConclude = () => {
        // console.log('trackScriptExecution: executedCount=', executedCount, 'total=', totalScripts);
        if (executedCount >= totalScripts) conclude();
      };

      function processExistingScript(s: HTMLScriptElement) {
        observed.add(s);
        if (!s.src) {
          executedCount++;
          return;
        }

        const absSrc = (() => { try { return new URL(s.src, doc.baseURI).href; } catch (e) { return s.src; } })();
        const perf = getPerfEntries();
        const already = perf.some((p) => p.name === absSrc || p.name === s.src || (typeof p.name === 'string' && p.name.endsWith(s.src)));
        if (already) {
          executedCount++;
          // console.log('trackScriptExecution: external already-loaded', s.src);
          return;
        }

        const handler: EventListener = () => {
          executedCount++;
          console.log('trackScriptExecution: load/error for', s.src, 'count=', executedCount);
          s.removeEventListener('load', handler);
          s.removeEventListener('error', handler);
          checkAndConclude();
        };
        s.addEventListener('load', handler);
        s.addEventListener('error', handler);
        externalListeners.push({ el: s, handler });
      }

      function handleNewScript(s: HTMLScriptElement) {
        if (observed.has(s)) return;
        observed.add(s);
        totalScripts++;
        console.log('trackScriptExecution: new script added, totalScripts=', totalScripts, 'src=', s.src || '[inline]');

        if (!s.src) {
          executedCount++;
          console.log('trackScriptExecution: new inline script counted, count=', executedCount);
          checkAndConclude();
          return;
        }

        const absSrc = (() => { try { return new URL(s.src, doc.baseURI).href; } catch (e) { return s.src; } })();
        const perf = getPerfEntries();
        const already = perf.some((p) => p.name === absSrc || p.name === s.src || (typeof p.name === 'string' && p.name.endsWith(s.src)));
        if (already) {
          executedCount++;
          console.log('trackScriptExecution: new external already-loaded', s.src, 'count=', executedCount);
          checkAndConclude();
          return;
        }

        const handler: EventListener = () => {
          executedCount++;
          console.log('trackScriptExecution: new load/error for', s.src, 'count=', executedCount);
          s.removeEventListener('load', handler);
          s.removeEventListener('error', handler);
          checkAndConclude();
        };
        s.addEventListener('load', handler);
        s.addEventListener('error', handler);
        externalListeners.push({ el: s, handler });
      }

      // Process currently existing scripts
      initialScripts.forEach(processExistingScript);

      // Observe dynamically added scripts
      observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of Array.from(m.addedNodes)) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            const el = node as Element;
            if (el.tagName?.toLowerCase() === 'script') {
              handleNewScript(el as HTMLScriptElement);
            } else {
              el.querySelectorAll && el.querySelectorAll('script').forEach((sc) => handleNewScript(sc as HTMLScriptElement));
            }
          }
        }
      });
      try { observer.observe(doc, { childList: true, subtree: true }); } catch (e) { /* ignore */ }

      // If nothing to wait for, conclude immediately.
      checkAndConclude();

      // Cleanup listeners if iframe reloads/navigates.
      onFrameUnload = () => {
        externalListeners.forEach(({ el, handler }) => {
          el.removeEventListener('load', handler);
          el.removeEventListener('error', handler);
        });
        try { observer?.disconnect(); } catch (e) { /* ignore */ }
      };
      iframe.addEventListener('load', onFrameUnload);
    }
  } catch (err) {
    console.warn('Script load tracking failed', err);
  }
}


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


const positionsCache = new WeakMap<HTMLElement, TextPosition[]>();
function getTextPositions(root: HTMLElement): TextPosition[] {
  const ownerDoc = root.ownerDocument;

  let positions = positionsCache.get(root);
  if (!positions) {
    const walker = ownerDoc.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const t = (node as Text).nodeValue;
          if (!t || t.length === 0) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const textNodes: Text[] = [];
    for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
      textNodes.push(n);
    }
    if (textNodes.length === 0)
      throw new Error("No text nodes found in the document");

    // Build positions of non-whitespace characters
    positions = [];
    for (const node of textNodes) {
      const s = node.nodeValue as string;
      for (let i = 0; i < s.length; i++) {
        if (!/\s/.test(s[i])) {
          positions.push({ node, offset: i, char: s[i] });
        }
      }
    }
    positionsCache.set(root, positions);
  }
  return positions;
}

export function getRange(root: HTMLElement, searchText: string, rangePosition?: Annotation['position']): {
  range: Range;
  usedPosition: boolean;
  resolvedPosition?: { startPosition: number, endPosition: number, startOffset: number, endOffset: number };
} {
  // First try the position-based resolver when a cached position is provided
  if (rangePosition) {
    try {
      const range = getRangeByPosition(root, searchText, rangePosition);
      if (range) {
        return { range, usedPosition: true };
      }
    } catch (e) {
      // fall through to full-text fallback
    }
  }

  // Fallback to full-text KMP-based resolver which also returns canonical
  // position information so callers can persist it.
  const res = getRangeByText(root, searchText);
  return {
    range: res.range,
    usedPosition: false,
    resolvedPosition: { startPosition: res.startPosition, endPosition: res.endPosition, startOffset: res.startOffset, endOffset: res.endOffset }
  };
}



export function getRangeByText(root: HTMLElement, searchText: string): {
  range: Range,
  startPosition: number,
  endPosition: number,
  startOffset: number,
  endOffset: number
} {
  if (!searchText || !searchText.trim())
    throw new Error("Search text must be non-empty");

  // Normalize searchText by removing all whitespace
  const pat = searchText.replace(/\s/g, '');
  const m = pat.length;
  const lps = buildKMPTable(pat);

  const positions = getTextPositions(root);
  const ownerDoc = root.ownerDocument;

  // Run KMP on the flattened text
  let j = 0;
  for (let idx = 0; idx < positions.length; idx++) {
    const ch = positions[idx].char;
    while (j > 0 && ch !== pat[j]) j = lps[j - 1];
    if (ch === pat[j]) {
      j++;
      if (j === m) {
        const startPos = positions[idx - m + 1];
        const endPos = positions[idx];
        const range = ownerDoc.createRange();
        range.setStart(startPos.node, startPos.offset);
        range.setEnd(endPos.node, endPos.offset + 1);

        return { range, startPosition: idx - m + 1, endPosition: idx, startOffset: startPos.offset, endOffset: endPos.offset + 1 };
      }
    }
  }

  console.warn(`Text "${searchText.substring(0, 50)}..." not found in document`);
  throw new Error("Text not found in document");
}

export function getRangeByPosition(root: HTMLElement, searchText: string, rangePosition: { startPosition: number, endPosition: number, startOffset: number, endOffset: number }): Range | null {
  // console.log('Attempting position-based range retrieval with', rangePosition);
  if (!searchText || !searchText.trim()) throw new Error("Search text must be non-empty");

  const pat = searchText.replace(/\s/g, '');
  const positions = getTextPositions(root);
  const ownerDoc = root.ownerDocument;

  const { startPosition, endPosition, startOffset, endOffset } = rangePosition;

  // Reconstruct the flattened (non-whitespace) string from the positions slice
  let s = '';
  for (let i = startPosition; i <= endPosition; i++) s += positions[i].char;

  if (s !== pat) {
    console.warn(`Position-based retrieval failed: expected "${pat}", got "${s}"`);
    return null;
  };

  console.log('Position range matches search text, building Range');

  const startNode = positions[startPosition].node;
  const endNode = positions[endPosition].node;
  const range = ownerDoc.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);

  return range;
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

  spans.forEach((span) => {
    const parent = span.parentNode;
    if (!parent) return;

    // Unwrap span → put back its contents (text nodes or elements)
    while (span.firstChild) {
      parent.insertBefore(span.firstChild, span);
    }
    parent.removeChild(span);
  });
}