import { syncSessionFromRequest } from "@/core/persistence/syncIdentity";
import { findUserById } from "../_shared";

export const runtime = "edge";

export async function GET(request: Request): Promise<Response> {
  const session = syncSessionFromRequest(request);
  if (!session.authenticated) {
    return sessionJson(session);
  }

  try {
    const user = await findUserById(session.userId);
    return sessionJson({
      ...session,
      ...(user ? { username: user.username } : {}),
    });
  } catch (error) {
    console.warn("Failed to resolve session username", error);
    return sessionJson(session);
  }
}

function sessionJson(session: ReturnType<typeof syncSessionFromRequest>): Response {
  return Response.json(session, {
    headers: {
      "cache-control": "no-store",
    },
  });
}
