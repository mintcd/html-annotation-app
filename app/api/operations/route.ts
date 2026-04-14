import { getEnv } from "../../../utils/env";
import { json as jsonResp, err } from "../../../utils/api-helpers";

// GET /api/operations?since=[timestamp]
export async function GET(request: Request) {
  const env = getEnv();
  const url = new URL(request.url);
  const sinceParam = url.searchParams.get("since");

  const createdExpr = "CASE WHEN typeof(created_at)='text' THEN (strftime('%s', created_at) * 1000) ELSE CAST(created_at AS INTEGER) END";

  let sql = `SELECT id, entity, op_type, payload, client_id, client_op_id, ${createdExpr} as created_at FROM operations WHERE processed = 1`;
  const bindings: unknown[] = [];
  if (sinceParam !== null && sinceParam !== "") {
    const sinceNum = Number(sinceParam) || 0;
    sql += ` AND (${createdExpr}) > ?`;
    bindings.push(sinceNum);
  }
  sql += ` ORDER BY (${createdExpr}) ASC`;

  const { results } = await env.DB.prepare(sql).bind(...bindings).all();

  const out = (results || []).map((r: Record<string, unknown>) => {
    let payload = r.payload;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload as string);
      } catch {
        /* leave as string */
      }
    }
    return {
      id: r.id,
      entity: r.entity,
      op_type: r.op_type,
      payload,
      client_id: r.client_id,
      client_op_id: r.client_op_id,
      created_at: r.created_at,
    };
  });

  return jsonResp(out, 200);
}
