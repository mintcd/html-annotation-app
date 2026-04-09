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
 *  Returns Annotation[] ready for the client. */
export async function loadAnnotationsForPage(pageUrl: string): Promise<Annotation[]> {
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
      let html: string | null = null;
      if (a.html) {
        const obj = await env.ANNOTATIONS_BUCKET.get(a.html);
        html = obj ? await obj.text() : null;
      }
      return {
        id: a.id,
        text: a.text,
        color: a.color || '#87ceeb',
        comment: a.comment,
        created_at: a.created_at,
        updated_at: a.updated_at,
        html,
        // Normalize position: DB may return a JSON string, an array, or an object
        position: (function () {
          try {
            let p = (a as any).position;
            if (p == null) return null;
            if (typeof p === 'string') {
              try { p = JSON.parse(p as string); } catch { return null; }
            }
            if (Array.isArray(p)) {
              const [startPosition, endPosition, startOffset, endOffset] = p;
              return {
                startPosition: Number(startPosition),
                endPosition: Number(endPosition),
                startOffset: Number(startOffset),
                endOffset: Number(endOffset),
              };
            }
            if (typeof p === 'object') {
              const sp = (p as any).startPosition ?? (p as any).start_pos ?? (p as any)[0];
              const ep = (p as any).endPosition ?? (p as any).end_pos ?? (p as any)[1];
              const so = (p as any).startOffset ?? (p as any).start_offset ?? (p as any)[2];
              const eo = (p as any).endOffset ?? (p as any).end_offset ?? (p as any)[3];
              if (sp == null || ep == null || so == null || eo == null) return null;
              return { startPosition: Number(sp), endPosition: Number(ep), startOffset: Number(so), endOffset: Number(eo) };
            }
            return null;
          } catch (e) {
            return null;
          }
        })(),
      };
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
