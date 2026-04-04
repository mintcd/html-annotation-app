import { headers } from 'next/headers';
import { getEnv } from './env';
import { generatePageId } from './api-helpers';

export async function getServerOrigin(): Promise<string> {
  const h = await headers() as unknown as { get(name: string): string | null };
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost';
  const proto = h.get('x-forwarded-proto') ?? h.get('x-forwarded-protocol') ?? h.get('x-forwarded') ?? 'http';
  const serverOrigin = `${proto}://${host}`;

  return serverOrigin;
}

// Server components query D1 by bindings.

/** Look up a website by its slug. Returns null when not found. */
export async function getWebsiteBySlug(slug: string): Promise<Website | null> {
  const env = getEnv();
  const website = await env.DB.prepare('SELECT * FROM websites WHERE id = ?')
    .bind(slug)
    .first<Website>();
  return website ?? null;
}

/** Look up or create the website entry for the given origin URL. */
export async function getOrCreateWebsite(originUrl: string): Promise<Website> {
  const env = getEnv();

  // Normalize to scheme+host only
  const normalizedOrigin = new URL(originUrl).origin;

  // Return early if this origin is already registered
  const existing = await env.DB.prepare('SELECT * FROM websites WHERE origin = ?')
    .bind(normalizedOrigin)
    .first<Website>();
  if (existing) return existing;

  // Compute candidate slug, resolving any collisions with a numeric suffix
  const { originToSlug } = await import('./url');
  const baseSlug = originToSlug(normalizedOrigin);
  let slug = baseSlug;
  let suffix = 1;
  while (true) {
    const conflict = await env.DB.prepare('SELECT id FROM websites WHERE id = ?')
      .bind(slug)
      .first<{ id: string }>();
    if (!conflict) break;
    suffix++;
    slug = `${baseSlug}-${suffix}`;
  }

  const ts = new Date().toISOString();
  const website = await env.DB.prepare(
    `INSERT INTO websites (id, origin, created_at, updated_at)
     VALUES (?, ?, ?, ?) RETURNING *`,
  )
    .bind(slug, normalizedOrigin, ts, ts)
    .first<Website>();

  return website!;
}

/** Load annotations for a page URL, including HTML content from R2.
 *  Returns AnnotationItem[] ready for the client. */
export async function loadAnnotationsForPage(pageUrl: string): Promise<AnnotationItem[]> {
  const env = getEnv();
  const pageId = await generatePageId(pageUrl);

  const result = await env.DB.prepare(
    'SELECT * FROM annotations WHERE page_id = ? ORDER BY created_at ASC',
  )
    .bind(pageId)
    .all<Annotation>();

  // Fetch HTML content from R2 for each annotation
  const annotations = await Promise.all(
    (result.results || []).map(async (a: Annotation) => {
      let html: string | undefined;
      if (a.html) {
        try {
          const obj = await env.ANNOTATIONS_BUCKET.get(a.html);
          html = obj ? await obj.text() : undefined;
        } catch {
          html = undefined;
        }
      }
      return {
        id: a.id,
        text: a.text,
        color: a.color || '#87ceeb',
        comment: a.comment || undefined,
        created: new Date(a.created_at).getTime(),
        lastModified: new Date(a.updated_at).getTime(),
        html,
      } satisfies AnnotationItem;
    }),
  );

  return annotations;
}
export async function getPageFromServer(pageUrl: string): Promise<{ title: string; numberOfScripts: number }> {
  const env = getEnv();
  const pageId = await generatePageId(pageUrl);
  const page = await env.DB.prepare('SELECT title, number_of_scripts FROM pages WHERE id = ?')
    .bind(pageId)
    .first<{ title: string; number_of_scripts: number }>();
  return { title: page?.title ?? '', numberOfScripts: page?.number_of_scripts ?? 0 };
}
