import type { RefObject } from 'react';
import localDb from './db/indexedDB';

type CaptureOpts = {
  iframeRef?: RefObject<HTMLIFrameElement | null>;
  contentRef?: RefObject<HTMLElement | null>;
  url: string;
  title?: string;
  inlineResources?: boolean;
};

function makeAbsolute(href: string | null | undefined, base: string) {
  if (!href) return null;
  try { return new URL(href, base).href; } catch (e) { return null; }
}

function serializeComputedStyle(win: Window | null, el: Element | null): string {
  if (!win || !el) return '';
  try {
    const cs = win.getComputedStyle(el as Element);
    let txt = '';
    for (let i = 0; i < cs.length; i++) {
      const prop = cs[i];
      const val = cs.getPropertyValue(prop);
      if (val) txt += `${prop}:${val};`;
    }
    return txt;
  } catch (e) {
    return '';
  }
}

function serializePseudoStyle(win: Window | null, el: Element | null, pseudo: '::before' | '::after'): string {
  if (!win || !el) return '';
  try {
    const cs = win.getComputedStyle(el as Element, pseudo);
    // If content is none and display none, skip
    const content = cs.getPropertyValue('content');
    const display = cs.getPropertyValue('display');
    if ((!content || content === 'none' || content === 'normal') && (!display || display === 'none')) return '';
    let txt = '';
    for (let i = 0; i < cs.length; i++) {
      const prop = cs[i];
      const val = cs.getPropertyValue(prop);
      if (val) txt += `${prop}:${val};`;
    }
    return txt;
  } catch (e) {
    return '';
  }
}

export async function captureAndStoreSnapshot(opts: CaptureOpts): Promise<string> {
  const { iframeRef, contentRef, url, title, inlineResources } = opts;
  const doInline = inlineResources !== false;

  // Pre-generate id so asset URLs can reference it during capture
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2);

  let doc: Document | null = null;
  if (iframeRef && iframeRef.current && iframeRef.current.contentDocument) doc = iframeRef.current.contentDocument;
  if (!doc && contentRef && contentRef.current && (contentRef.current.ownerDocument)) doc = contentRef.current.ownerDocument as Document;
  if (!doc && typeof document !== 'undefined') doc = document;

  if (!doc) throw new Error('No document available to snapshot');

  const win = (doc.defaultView || (typeof window !== 'undefined' ? window : null));

  // Clone the documentElement to avoid mutating live DOM
  const docEl = doc.documentElement;
  if (!docEl) throw new Error('Document has no documentElement');
  const clone = docEl.cloneNode(true) as HTMLElement;

  // Optionally inline computed styles by pairing source and clone element lists
  if (doInline) {
    try {
      const srcAll: Element[] = [docEl as Element, ...Array.from(docEl.querySelectorAll('*'))];
      const cloneAll: Element[] = [clone as Element, ...Array.from(clone.querySelectorAll('*'))];

      const min = Math.min(srcAll.length, cloneAll.length);
      const pseudoRules: string[] = [];

      for (let i = 0; i < min; i++) {
        const src = srcAll[i];
        const cl = cloneAll[i];
        try {
          // Apply full computed style as inline style on the clone
          const cssText = serializeComputedStyle(win, src as Element);
          if (cssText) cl.setAttribute('style', cssText);

          // Assign a data-snap-id so we can target pseudo-elements
          const snapId = `s-${i}`;
          cl.setAttribute('data-snap-id', snapId);

          // Capture pseudo-elements (::before and ::after)
          const beforeCss = serializePseudoStyle(win, src as Element, '::before');
          if (beforeCss) pseudoRules.push(`[data-snap-id="${snapId}"]::before{${beforeCss}}`);
          const afterCss = serializePseudoStyle(win, src as Element, '::after');
          if (afterCss) pseudoRules.push(`[data-snap-id="${snapId}"]::after{${afterCss}}`);
        } catch (e) {
          /* ignore per-element failures */
        }
      }

      // Inject pseudo-element rules into a style element in the clone's head
      try {
        if (pseudoRules.length) {
          const head = clone.querySelector('head');
          const styleEl = doc.createElement('style');
          styleEl.setAttribute('data-snapshot-pseudo', '1');
          styleEl.textContent = pseudoRules.join('\n');
          if (head && head.appendChild) head.appendChild(styleEl);
          else {
            // Prepend to html if no head found
            clone.insertBefore(styleEl, clone.firstChild);
          }
        }
      } catch (e) { /* ignore */ }
    } catch (e) {
      // If pairing fails, continue with a best-effort snapshot
      try { clone.querySelectorAll('script').forEach(s => s.remove()); } catch (er) { /* ignore */ }
    }
  }

  // Remove scripts and inline event handlers and srcdoc attributes
  try {
    clone.querySelectorAll('script').forEach(s => s.remove());
  } catch (e) { /* ignore */ }

  try {
    const all = clone.querySelectorAll('*');
    all.forEach(el => {
      try {
        for (const a of Array.from((el as Element).attributes)) {
          const an = a.name.toLowerCase();
          if (an.startsWith('on')) (el as Element).removeAttribute(a.name);
          if (an === 'srcdoc') (el as Element).removeAttribute(a.name);
        }
      } catch (e) { /* ignore */ }
    });
  } catch (e) { /* ignore */ }

  // Ensure <base> is present to resolve relative URLs
  try {
    if (!clone.querySelector('base')) {
      const head = clone.querySelector('head');
      if (head) {
        const base = doc.createElement('base');
        base.setAttribute('href', url);
        head.insertBefore(base, head.firstChild);
      }
    }
  } catch (e) { /* ignore */ }

  // Serialize
  let html = '<!doctype html>\n' + clone.outerHTML;

  // Collect resource URLs (stylesheets, images, srcset) from the clone DOM
  const resourceSet = new Set<string>();
  try {
    const qRoot = clone as Element;
    qRoot.querySelectorAll('link[rel="stylesheet"]').forEach(l => {
      const href = makeAbsolute((l.getAttribute('href') || ''), url);
      if (href) resourceSet.add(href);
    });
    qRoot.querySelectorAll('img').forEach(i => {
      const s = makeAbsolute(i.getAttribute('src') || '', url); if (s) resourceSet.add(s);
    });
    qRoot.querySelectorAll('[srcset]').forEach(el => {
      const ss = el.getAttribute('srcset') || '';
      ss.split(',').map(p => p.trim().split(' ')[0]).forEach(part => {
        const s = makeAbsolute(part, url); if (s) resourceSet.add(s);
      });
    });
    qRoot.querySelectorAll('link[rel~="icon"]').forEach(l => {
      const href = makeAbsolute((l.getAttribute('href') || ''), url); if (href) resourceSet.add(href);
    });
  } catch (e) { /* ignore */ }

  if (doInline) {
    // Inline small image/svg/icon assets into the cloned DOM as data URLs.
    // This keeps the snapshot self-contained for offline viewing. Larger assets are left cached instead.
    const MAX_INLINE_BYTES = 500 * 1024; // 500 KB

    async function arrayBufferToBase64(buffer: ArrayBuffer) {
      const bytes = new Uint8Array(buffer);
      const chunkSize = 0x8000; // 32KB
      let binary = '';
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, Array.prototype.slice.call(chunk) as any);
      }
      return btoa(binary);
    }

    async function fetchAsDataUrl(absUrl: string): Promise<string | null> {
      try {
        const res = await fetch(absUrl, { credentials: 'omit' });
        if (!res.ok) return null;
        const contentType = (res.headers.get('Content-Type') || '').split(';')[0];
        // Try to use Content-Length header to avoid downloading huge files
        const cl = res.headers.get('Content-Length');
        if (cl && Number(cl) > MAX_INLINE_BYTES) return null;

        if (contentType.includes('svg') || contentType.startsWith('text/')) {
          const text = await res.text();
          // encodeURIComponent for SVG/text
          const encoded = encodeURIComponent(text).replace(/'/g, '%27').replace(/\"/g, '%22');
          return `data:${contentType};charset=utf-8,${encoded}`;
        } else {
          const buf = await res.arrayBuffer();
          if (buf.byteLength > MAX_INLINE_BYTES) return null;
          const base64 = await arrayBufferToBase64(buf);
          return `data:${contentType};base64,${base64}`;
        }
      } catch (e) {
        return null;
      }
    }

    // Replace src/srcset on images and icon links and inline background images found in styles
    try {
      // Images
      const imgs = Array.from(clone.querySelectorAll('img')) as HTMLImageElement[];
      for (const img of imgs) {
        try {
          const raw = img.getAttribute('src') || '';
          if (raw && !raw.startsWith('data:') && !raw.startsWith('blob:')) {
            const abs = makeAbsolute(raw, url) || raw;
            const dataUrl = await fetchAsDataUrl(abs);
            if (dataUrl) {
              img.setAttribute('src', dataUrl);
              try { console.debug('[snapshot] inlined image ->', abs); } catch (e) { }
            } else {
              // fallback to SW-served cached asset
              const assetUrl = snapshotAssetUrl(abs);
              img.setAttribute('src', assetUrl);
              try { console.debug('[snapshot] referencing asset ->', abs, assetUrl); } catch (e) { }
            }
          }

          const srcset = img.getAttribute('srcset') || '';
          if (srcset) {
            const parts = srcset.split(',').map(p => p.trim()).filter(Boolean);
            const outParts: string[] = [];
            for (const part of parts) {
              const [u, desc] = part.split(/\s+/, 2);
              if (!u) continue;
              if (u.startsWith('data:') || u.startsWith('blob:')) { outParts.push(part); continue; }
              const abs = makeAbsolute(u, url) || u;
              const dataUrl = await fetchAsDataUrl(abs);
              if (dataUrl) outParts.push(desc ? `${dataUrl} ${desc}` : dataUrl);
              else outParts.push(desc ? `${snapshotAssetUrl(abs)} ${desc}` : snapshotAssetUrl(abs));
            }
            if (outParts.length) img.setAttribute('srcset', outParts.join(', '));
          }
        } catch (e) { /* ignore per-image errors */ }
      }

      // Icons
      const icons = Array.from(clone.querySelectorAll('link[rel~="icon"],link[rel="shortcut icon"]')) as HTMLLinkElement[];
      for (const l of icons) {
        try {
          const raw = l.getAttribute('href') || '';
          if (raw && !raw.startsWith('data:') && !raw.startsWith('blob:')) {
            const abs = makeAbsolute(raw, url) || raw;
            const dataUrl = await fetchAsDataUrl(abs);
            if (dataUrl) l.setAttribute('href', dataUrl);
            else l.setAttribute('href', snapshotAssetUrl(abs));
          }
        } catch (e) { /* ignore */ }
      }

      // Inline urls in style attributes
      const styled = Array.from(clone.querySelectorAll('[style]')) as Element[];
      const urlRegex = /url\(\s*(['"]?)(.*?)\1\s*\)/g;
      for (const el of styled) {
        try {
          const s = el.getAttribute('style') || '';
          if (!s || s.indexOf('url(') === -1) continue;
          let newStyle = s;
          const matches = Array.from(s.matchAll(urlRegex));
          for (const m of matches) {
            const ref = m[2];
            if (!ref || ref.startsWith('data:') || ref.startsWith('blob:')) continue;
            const abs = makeAbsolute(ref, url) || ref;
            try {
              const dataUrl = await fetchAsDataUrl(abs);
              if (dataUrl) newStyle = newStyle.split(m[0]).join(`url('${dataUrl}')`);
              else newStyle = newStyle.split(m[0]).join(`url('${snapshotAssetUrl(abs)}')`);
            } catch (e) { /* ignore */ }
          }
          if (newStyle !== s) el.setAttribute('style', newStyle);
        } catch (e) { /* ignore */ }
      }

      // Replace urls inside pseudo rules style element if present
      const pseudoStyle = clone.querySelector('style[data-snapshot-pseudo]');
      if (pseudoStyle && pseudoStyle.textContent) {
        let text = pseudoStyle.textContent;
        if (text && text.indexOf('url(') !== -1) {
          const matches = Array.from(text.matchAll(urlRegex));
          for (const m of matches) {
            const ref = m[2];
            if (!ref || ref.startsWith('data:') || ref.startsWith('blob:')) continue;
            const abs = makeAbsolute(ref, url) || ref;
            try {
              const dataUrl = await fetchAsDataUrl(abs);
              if (dataUrl) text = text.split(m[0]).join(`url('${dataUrl}')`);
              else text = text.split(m[0]).join(`url('${snapshotAssetUrl(abs)}')`);
            } catch (e) { /* ignore */ }
          }
          pseudoStyle.textContent = text;
        }
      }
    } catch (e) { /* ignore overall inlining errors */ }
  }

  // Recompute resources from the final cloned DOM (after inlining)
  const resourceSetFinal = new Set<string>();
  try {
    const qRoot2 = clone as Element;
    qRoot2.querySelectorAll('link[rel="stylesheet"]').forEach(l => {
      const href = makeAbsolute((l.getAttribute('href') || ''), url);
      if (href) resourceSetFinal.add(href);
    });
    qRoot2.querySelectorAll('img').forEach(i => {
      const s = makeAbsolute(i.getAttribute('src') || '', url); if (s) resourceSetFinal.add(s);
    });
    qRoot2.querySelectorAll('[srcset]').forEach(el => {
      const ss = el.getAttribute('srcset') || '';
      ss.split(',').map(p => p.trim().split(' ')[0]).forEach(part => {
        const s = makeAbsolute(part, url); if (s) resourceSetFinal.add(s);
      });
    });
    qRoot2.querySelectorAll('link[rel~="icon"]').forEach(l => {
      const href = makeAbsolute((l.getAttribute('href') || ''), url); if (href) resourceSetFinal.add(href);
    });
  } catch (e) { /* ignore */ }

  const resources = Array.from(resourceSetFinal);

  // Re-serialize HTML after modifications
  html = '<!doctype html>\n' + clone.outerHTML;

  // Cache resources into Cache Storage (best-effort)
  if (doInline) {
    try {
      const cache = await caches.open('snapshots-cache-v1');
      for (const r of resources) {
        try {
          // Try normal CORS fetch first so we can cache a usable response.
          // If that fails (CORS), fall back to a no-cors fetch to store an opaque response.
          let res: Response | null = null;
          try {
            res = await fetch(r, { credentials: 'omit' });
          } catch (e) {
            try {
              res = await fetch(r, { credentials: 'omit', mode: 'no-cors' });
            } catch (e2) {
              res = null;
            }
          }
          if (res) {
            try {
              await cache.put(r, res.clone());
            } catch (e) { /* ignore per-resource put failures */ }
            try {
              // Also cache under the snapshot proxy path so SW can match the request directly.
              const proxy = snapshotAssetUrl(r);
              try { await cache.put(proxy, res.clone()); } catch (e2) { /* ignore */ }
              try { console.debug('[snapshot] cached resource ->', r); console.debug('[snapshot] cached proxy ->', proxy); } catch (e3) { }
            } catch (e) { /* ignore */ }
          }
        } catch (e) { /* ignore per-resource failures */ }
      }
    } catch (e) { /* ignore cache errors */ }
  }

  // Helper for snapshot-scoped asset URL
  function snapshotAssetUrl(abs: string) {
    return `/__snapshot_asset__/${id}/${encodeURIComponent(abs)}`;
  }

  await localDb.putRow('snapshots' as any, {
    id,
    url,
    title,
    html,
    resources,
    created_at: Date.now(),
  } as any);

  return id;
}

export async function getSnapshot(id: string) {
  return await localDb.getRow('snapshots' as any, id);
}

export async function getSnapshotHtml(id: string): Promise<string | undefined> {
  const s = await getSnapshot(id);
  return s ? (s as any).html : undefined;
}

export async function listSnapshotsForUrl(url: string) {
  try {
    return await localDb.queryIndex('snapshots' as any, 'by_url', url) as any[];
  } catch (e) {
    // Fallback to scanning all
    const all = await localDb.getAllRows('snapshots' as any);
    return all.filter(s => (s as any).url === url);
  }
}
