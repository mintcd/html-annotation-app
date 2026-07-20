import { getEnv } from "@/core/utils/env";
import {
  AuthRequestError,
  errorResponse,
  hashPassword,
  readCredentials,
  sessionResponse,
  syncSessionForUser,
  userIdForUsername,
} from "../_shared";

export const runtime = "edge";

export async function POST(request: Request): Promise<Response> {
  try {
    const credentials = await readCredentials(request);
    const userId = await userIdForUsername(credentials.username);
    const passwordHash = await hashPassword(credentials.password);

    try {
      await getEnv().DB.prepare(
        "INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)",
      )
        .bind(userId, credentials.username, passwordHash)
        .run();
    } catch (error) {
      if (String(error).toLowerCase().includes("unique")) {
        throw new AuthRequestError("Username already exists", 409);
      }
      throw error;
    }

    return sessionResponse(
      syncSessionForUser({
        id: userId,
        username: credentials.username,
      }),
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
