import assert from "node:assert/strict";
import test from "node:test";
import { SyncHttpError } from "@mintcd/sync-engine/transport/http-server";
import { resolveSyncRequestContext } from "../core/persistence/syncServerAuth.ts";

const origin = "https://annotation.test";
const scope = { protocolVersion: 1, contractVersion: "html-annotation/2", streamId: "user:alice" } as const;

function request(headers: HeadersInit = {}) {
  return new Request(`${origin}/api/sync`, {
    method: "POST",
    headers: { origin, cookie: "html_annotation_user_id=alice", ...headers },
  });
}

function denied(status: number, code: string) {
  return (error: unknown) => error instanceof SyncHttpError && error.status === status && error.code === code;
}

test("authorizes the existing cookie session and its own stream", () => {
  assert.deepEqual(resolveSyncRequestContext(request(), scope), {
    streamId: "user:alice", context: { userId: "alice" },
  });
});

test("requires a cookie session even when a public identity header is supplied", () => {
  assert.throws(() => resolveSyncRequestContext(request({ cookie: "", "x-html-annotation-user-id": "alice" }), scope), denied(401, "unauthenticated"));
  assert.throws(() => resolveSyncRequestContext(request({ cookie: "html_annotation_user_id=%zz" }), scope), denied(401, "unauthenticated"));
});

test("cannot select another user's stream with an identity header", () => {
  assert.throws(() => resolveSyncRequestContext(request({ "x-html-annotation-user-id": "bob" }), { ...scope, streamId: "user:bob" }), denied(403, "stream-denied"));
});

test("rejects foreign, missing and cross-site request origins", () => {
  const origins: HeadersInit[] = [{ origin: "https://foreign.test" }, { origin: "" }, { "sec-fetch-site": "cross-site" }];
  for (const headers of origins) {
    assert.throws(() => resolveSyncRequestContext(request(headers), scope), denied(403, "origin-denied"));
  }
});
