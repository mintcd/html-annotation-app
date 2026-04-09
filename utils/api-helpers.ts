// ─── Shared API helpers ──────────────────────────────────────────────────────

export interface Page {
  id: string;
  url: string;
  title: string;
  number_of_scripts: number;
  number_of_annotations: number;
  created_at: string;
  updated_at: string;
}


export async function generatePageId(url: string): Promise<string> {
  const data = new TextEncoder().encode(url);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function now(): string {
  return new Date().toISOString();
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function err(message: string, status = 500): Response {
  return json({ error: message }, status);
}
