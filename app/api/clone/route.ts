import { getClonedPage } from "@/core/frame/clone";
import { normalizeUrl } from "@/core/utils/url";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("url");
  if (!raw) {
    return Response.json({ error: "Missing url parameter" }, { status: 400 });
  }

  const url = normalizeUrl(raw);
  try {
    const page = await getClonedPage(url);
    return Response.json(page);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 502 });
  }
}
