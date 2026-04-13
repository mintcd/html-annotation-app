export type PrefetchResult = {
  total: number;
  cached: number;
};

function makeAbsolute(base: string, u?: string | null) {
  if (!u) return null;
  if (/^(data:|blob:|http|https|\/\/)/i.test(u)) {
    if (u.startsWith('//')) return window.location.protocol + u;
    return u;
  }
  try { return new URL(u, base).href; } catch { return u; }
}

export async function prefetchResourcesForUrl(frameUrl: string, concurrency = 6): Promise<PrefetchResult> {
  const res = await fetch(frameUrl, { credentials: 'omit' });
  if (!res.ok) throw new Error(`Failed to fetch frame HTML: ${res.status}`);
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const resourceSet = new Set<string>();
  const add = (u?: string | null) => {
    if (!u) return;
    if (u.startsWith('data:') || u.startsWith('blob:')) return;
    const abs = makeAbsolute(frameUrl, u);
    if (abs) resourceSet.add(abs);
  };

  doc.querySelectorAll('link[rel="stylesheet"]').forEach(l => add(l.getAttribute('href')));
  doc.querySelectorAll('img').forEach(i => add(i.getAttribute('src')));
  doc.querySelectorAll('[srcset]').forEach(el => {
    const ss = el.getAttribute('srcset') || '';
    ss.split(',').map(p => p.trim().split(' ')[0]).forEach(part => add(part));
  });
  doc.querySelectorAll('link[rel~="icon"]').forEach(l => add(l.getAttribute('href')));
  doc.querySelectorAll('audio,video,source').forEach(el => add((el as HTMLSourceElement).getAttribute('src')));

  // Inline style url() references
  doc.querySelectorAll('[style]').forEach(el => {
    const s = el.getAttribute('style') || '';
    const re = /url\(\s*(['"]?)(.*?)\1\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) add(m[2]);
  });

  const resources = Array.from(resourceSet);
  const cache = await caches.open('frames-cache-v1');

  let idx = 0;
  let cached = 0;

  async function worker() {
    while (idx < resources.length) {
      const i = idx++;
      const url = resources[i];
      try {
        const r = await fetch(url, { credentials: 'omit' });
        if (r && r.ok) {
          try { await cache.put(url, r.clone()); cached++; } catch (e) { /* ignore */ }
        }
      } catch (e) { /* ignore per-resource */ }
    }
  }

  const runners = Array(Math.min(concurrency, resources.length)).fill(null).map(() => worker());
  await Promise.all(runners);
  return { total: resources.length, cached };
}
