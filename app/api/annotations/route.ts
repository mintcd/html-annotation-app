import { getEnv } from "../../../utils/env";
import {
  generatePageId,
  now,
  json,
  err,
} from "../../../utils/api-helpers";

function normalizeAnnotationPosition(a: any) {
  if (!a) return a;
  let p = (a as any).position;
  if (p == null) {
    a.position = null;
    return a;
  }

  // If position is a JSON string, parse it first
  if (typeof p === 'string') {
    try {
      p = JSON.parse(p);
    } catch (e) {
      a.position = null;
      return a;
    }
  }

  if (Array.isArray(p)) {
    const [startPosition, endPosition, startOffset, endOffset] = p;
    a.position = {
      startPosition: Number(startPosition),
      endPosition: Number(endPosition),
      startOffset: Number(startOffset),
      endOffset: Number(endOffset),
    };
    return a;
  }

  // If it's already an object, coerce numeric fields if present
  if (typeof p === 'object') {
    const sp = (p as any).startPosition ?? (p as any).start_pos ?? (p as any)[0];
    const ep = (p as any).endPosition ?? (p as any).end_pos ?? (p as any)[1];
    const so = (p as any).startOffset ?? (p as any).start_offset ?? (p as any)[2];
    const eo = (p as any).endOffset ?? (p as any).end_offset ?? (p as any)[3];

    if (sp == null || ep == null || so == null || eo == null) {
      a.position = null;
      return a;
    }

    a.position = {
      startPosition: Number(sp),
      endPosition: Number(ep),
      startOffset: Number(so),
      endOffset: Number(eo),
    };
    return a;
  }

  a.position = null;
  return a;
}

export async function GET(request: Request) {
  const env = getEnv();
  const url = new URL(request.url);

  // GET /api/annotations?url=...
  const pageUrl = url.searchParams.get("url");
  if (!pageUrl) return err("Missing required parameter: url", 400);
  const pageId = await generatePageId(pageUrl);
  const result = await env.DB.prepare(
    "SELECT * FROM annotations WHERE page_id = ? ORDER BY created_at ASC"
  )
    .bind(pageId)
    .all<Annotation>();

  // Fetch HTML content from R2 for each annotation and parse stored `path` JSON.
  const annotations = await Promise.all(
    (result.results || []).map(async (a: Annotation) => {
      // Fetch HTML content (if any) and let the normalizer handle `position`
      let htmlContent: string | null = null;
      if (a.html) {
        try {
          const obj = await env.ANNOTATIONS_BUCKET.get(a.html);
          htmlContent = obj ? await obj.text() : null;
        } catch { htmlContent = null; }
      }
      return normalizeAnnotationPosition({ ...a, html: htmlContent });
    })
  );
  return json(annotations);
}

export async function POST(request: Request) {
  const env = getEnv();
  const body = (await request.json()) as {
    url?: string;
    text?: string;
    html?: string;
    color?: string;
    comment?: string;
    position?: { startPosition: number; endPosition: number; startOffset: number; endOffset: number } | null;
  };
  if (!body.url || !body.text)
    return err("Missing required fields: url, text", 400);

  const pageId = await generatePageId(body.url);
  const id = Date.now().toString();
  const ts = now();

  const annotation = await env.DB.prepare(
    `INSERT INTO annotations (id, page_id, text, html, color, comment, position, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
  )
    .bind(
      id,
      pageId,
      body.text,
      null,
      body.color || "#87ceeb",
      body.comment || null,
      body.position ? JSON.stringify(body.position) : null,
      ts,
      ts
    )
    .first<Annotation>();

  let returnAnnotation = annotation!;
  // normalize stored position (may be a JSON string coming from the DB)
  returnAnnotation = normalizeAnnotationPosition(returnAnnotation as any);
  let htmlContent = body.html ?? null;

  // Upload HTML to R2 if provided
  if (body.html) {
    const htmlPath = `${id}.html`;
    await env.ANNOTATIONS_BUCKET.put(htmlPath, body.html, {
      httpMetadata: { contentType: "text/html; charset=utf-8" },
    });
    // Update annotation with HTML reference
    returnAnnotation = (await env.DB.prepare(
      "UPDATE annotations SET html = ?, updated_at = ? WHERE id = ? RETURNING *"
    )
      .bind(htmlPath, ts, id)
      .first<Annotation>())!;
    returnAnnotation = normalizeAnnotationPosition(returnAnnotation as any);
  }

  // Update page annotation count
  await env.DB.prepare(
    `UPDATE pages SET number_of_annotations = number_of_annotations + 1, updated_at = ? WHERE id = ?`
  )
    .bind(ts, pageId)
    .run();


  const resp = { ...returnAnnotation, html: htmlContent } as any;
  normalizeAnnotationPosition(resp);
  return json(resp);
}

export async function PUT(request: Request) {
  const env = getEnv();
  const body = (await request.json()) as {
    id?: string;
    text?: string;
    html?: string;
    color?: string;
    comment?: string;
    position?: { startPosition: number; endPosition: number; startOffset: number; endOffset: number } | null;
  };
  if (!body.id) return err("Missing required field: id", 400);

  const existing = await env.DB.prepare(
    "SELECT * FROM annotations WHERE id = ?"
  )
    .bind(body.id)
    .first<Annotation>();
  if (!existing) return err("Annotation not found", 404);

  let htmlPath = existing.html;

  // Update HTML in R2 if provided
  if (body.html !== undefined) {
    htmlPath = `${body.id}.html`;
    await env.ANNOTATIONS_BUCKET.put(htmlPath, body.html, {
      httpMetadata: { contentType: "text/html; charset=utf-8" },
    });
  }

  // Build dynamic update
  const updates: string[] = [];
  const values: unknown[] = [];
  if (body.text !== undefined) {
    updates.push("text = ?");
    values.push(body.text);
  }
  if (htmlPath !== undefined) {
    updates.push("html = ?");
    values.push(htmlPath);
  }
  if (body.color !== undefined) {
    updates.push("color = ?");
    values.push(body.color);
  }
  if (body.comment !== undefined) {
    updates.push("comment = ?");
    values.push(body.comment);
  }
  if (body.position !== undefined) {
    updates.push("position = ?");
    values.push(body.position ? JSON.stringify(body.position) : null);
  }

  const ts = now();
  updates.push("updated_at = ?");
  values.push(ts);
  values.push(body.id);

  const updated = await env.DB.prepare(
    `UPDATE annotations SET ${updates.join(", ")} WHERE id = ? RETURNING *`
  )
    .bind(...values)
    .first<Annotation>();

  // Fetch HTML content for response
  let htmlContent: string | null = null;
  if (updated?.html) {
    try {
      const obj = await env.ANNOTATIONS_BUCKET.get(updated.html);
      htmlContent = obj ? await obj.text() : null;
    } catch { }
  }



  const resp = { ...updated, html: htmlContent } as any;
  normalizeAnnotationPosition(resp);
  return json(resp);
}

export async function DELETE(request: Request) {
  const env = getEnv();
  const url = new URL(request.url);
  const annotationId = url.searchParams.get("id");
  if (!annotationId) return err("Missing required parameter: id", 400);

  const annotation = await env.DB.prepare(
    "SELECT * FROM annotations WHERE id = ?"
  )
    .bind(annotationId)
    .first<Annotation>();

  if (annotation) {
    if (annotation.html) {
      try {
        await env.ANNOTATIONS_BUCKET.delete(annotation.html);
      } catch { }
    }
    await env.DB.prepare(
      `UPDATE pages SET number_of_annotations = number_of_annotations - 1, updated_at = ? WHERE id = ?`
    )
      .bind(now(), annotation.page_id)
      .run();
  }

  await env.DB.prepare("DELETE FROM annotations WHERE id = ?")
    .bind(annotationId)
    .run();
  return json({
    success: true,
    message: "Annotation deleted successfully",
  });
}
