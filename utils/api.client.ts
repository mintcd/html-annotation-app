
// worker/index.ts stores the request origin on globalThis.__origin.
function getBase(): string {
  if (typeof window !== 'undefined') return '';
  return globalThis.__origin ?? '';
}

// ===== Pages API =====

export async function listPages(): Promise<Page[]> {
  const base = getBase();
  const response = await fetch(`${base}/api/pages`);

  if (!response.ok) {
    throw new Error(`Failed to list pages: ${response.status}`);
  }

  return await response.json();
}

export async function getPage(url: string): Promise<Page> {
  const base = getBase();
  const response = await fetch(`${base}/api/pages?url=${encodeURIComponent(url)}`);

  if (response.ok) return await response.json();
  throw new Error(`Failed to get page: ${response.status}`);
}

export async function createPage({ url, title = "", numberOfScripts = 0 }:
  {
    url: string,
    title?: string,
    numberOfScripts?: number
  }
): Promise<Page> {
  const base = getBase();
  const response = await fetch(`${base}/api/pages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, title, number_of_scripts: numberOfScripts })
  });

  if (!response.ok) {
    throw new Error(`Failed to create page: ${response.status}`);
  }

  return await response.json();
}

export async function updatePage({ url, title, numberOfScripts }: {
  url: string,
  title?: string,
  numberOfScripts?: number
}
): Promise<Page> {
  const base = getBase();
  const response = await fetch(`${base}/api/pages`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, title, number_of_scripts: numberOfScripts })
  });

  if (!response.ok) {
    throw new Error(`Failed to update page: ${response.status}`);
  }

  return await response.json();
}

export async function deletePage(url: string): Promise<void> {
  const base = getBase();
  const response = await fetch(`${base}/api/pages?url=${encodeURIComponent(url)}`, {
    method: 'DELETE'
  });
  if (!response.ok) {
    throw new Error(`Failed to delete page: ${response.status}`);
  }
}

// ===== Annotations API =====

export async function getAnnotationsForPage(url: string): Promise<Annotation[]> {
  const base = getBase();
  const response = await fetch(`${base}/api/annotations?url=${encodeURIComponent(url)}`, {
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Failed to get annotations: ${response.status}`);
  }

  return await response.json();
}

export async function createAnnotation(params: {
  url: string;
  text: string;
  html?: string;
  color?: string;
  comment?: string;
  position?: { startPosition: number; endPosition: number; startOffset: number; endOffset: number } | null;
}): Promise<Annotation> {
  const { url, text, html, color, comment, position } = params;
  const base = getBase();
  const response = await fetch(`${base}/api/annotations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, text, html, color, comment, position })
  });

  if (!response.ok) {
    throw new Error(`Failed to create annotation: ${response.status}`);
  }

  return await response.json();
}

export async function updateAnnotation(
  id: string,
  payload: {
    text?: string;
    html?: string | null;
    color?: string;
    comment?: string;
    position?: { startPosition: number; endPosition: number; startOffset: number; endOffset: number } | null;
  }
): Promise<Annotation> {
  const base = getBase();
  const response = await fetch(`${base}/api/annotations`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      text: payload.text,
      html: payload.html,
      color: payload.color,
      comment: payload.comment,
      position: payload.position,
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to update annotation: ${response.status}`);
  }

  return await response.json();
}

export async function deleteAnnotation(id: string): Promise<void> {
  const base = getBase();
  const response = await fetch(`${base}/api/annotations?id=${id}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    throw new Error(`Failed to delete annotation: ${response.status}`);
  }
}

export async function getAnnotationHtml(id: string): Promise<string> {
  const base = getBase();
  const response = await fetch(`${base}/api/annotations/${id}/html`, {
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Failed to get annotation HTML: ${response.status}`);
  }

  return await response.text();
}

/** Return all registered websites. */
export async function listWebsites(): Promise<Website[]> {
  const base = getBase();
  const response = await fetch(`${base}/api/websites`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to list websites: ${response.status}`);
  return response.json();
}

/** Look up a website by its slug. Returns null when not found. */
export async function getWebsiteBySlug(slug: string): Promise<Website | null> {
  const base = getBase();
  const url = `${base}/api/websites?slug=${encodeURIComponent(slug)}`;
  const response = await fetch(url, { cache: 'no-store' });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Failed to get website: ${response.status}`);
  return response.json();
}

/**
 * Look up or create the website entry for the given origin.
 * The server resolves any slug collisions automatically.
 */
export async function getOrCreateWebsite(origin: string): Promise<Website> {
  const base = getBase();
  const response = await fetch(`${base}/api/websites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Failed to get/create website: ${response.status}`);
  return response.json();
}
