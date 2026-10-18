# ADR-0006: Verified account and offline recovery

Status: Accepted (retrospective record of the current implementation).

Date: 2026-10-18.

Requirements: [S10-S17 and S21](../requirements/sync-and-auth.md).

## Context

A browser can reload while offline and still hold pending edits for an existing
account. Treating that reload as a new login could allocate a new replica
identity; treating every session request failure as logout could disable the
replica holding those edits. Account switches and React effect cleanup also
race with asynchronous client opening and closing.

Local identity is needed to select browser storage, while the server needs its
own access checks before opening a requested sync stream. The application's
existing authentication uses D1 users and a user-ID cookie rather than signed
server sessions.

## Decision

Resolve the session through `/api/auth/session` before explicit initialization.
Map normalized account IDs to `user:{normalizedUserId}`; the `anonymous` UI
identity does not open a replica. A successful session response is considered
verified for bootstrap and lifecycle decisions. This term describes a network
response, not cryptographic verification of the cookie.

Remember the last verified authenticated identity in local storage. Rebuild its
stream ID from the user ID when reading it, and clear it only after a verified
signed-out response. Storage exceptions do not fail a successful login. Use the
remembered identity for ordinary offline recovery without `initialize: true`.
The package requires IndexedDB and Web Locks, reopens existing replica state,
and reports missing/evicted storage rather than silently issuing another client
identity. Explicit sign-in may reenable the same retained account's pending
work.

When the browser is offline or the fetch fails with a `TypeError`, allow cached
identity recovery. Unsuccessful HTTP responses and other session errors remain
errors; they do not become verified sign-outs. Session responses use
`Cache-Control: no-store`, the service worker bypasses that route, and worker
activation deletes the old `api-session-v1` cache.

Use [syncClientLifecycle.ts](../../core/persistence/syncClientLifecycle.ts) to
serialize opening, closing, React cleanup and verified logout/account changes.
Close the current client before disabling its registry slot or opening another
account. Hide the old engine and invalidate imperative access as soon as the
session identity changes; reject saves through stale runtime generations.
Ordinary offline recovery never invokes logout. Default logout disables the
slot while retaining its browser data, and late cleanup only closes the client
it owns.

At the sync boundary, require the cookie identity independently on every
request, an exact same-origin `Origin`, no cross-site Fetch Metadata and a
requested stream matching that identity. Ignore the public user-ID header when
authenticating sync. Perform these checks before legacy import or authority
access. The transport includes same-origin cookies; authorization failure
preserves pending local intent.

## Alternatives

- Using a remembered identity as server authorization would let browser storage
  select another stream without independent access checks.
- Initializing during offline recovery could silently replace missing state and
  lose continuity with retained pending operations.
- Logging out on any request failure would confuse connectivity or server errors
  with a verified account change.
- Independently opening clients from React effects would allow an abandoned
  opening or late cleanup to overlap the replacement client.
- Replacing the authentication system with signed sessions would be a separate
  change to login, credential storage and all consumers of identity. This sync
  integration retains the current system.

## Consequences

Offline reload can recover an existing account without making its cached identity
a credential. Same-account retained work survives ordinary logout, while server
access remains conditional on the current cookie and request checks. Clearing
or evicting browser storage can still remove local work; recovery reports that
failure.

The queue and runtime generation guard cover the application runtime, and the
package coordinates participating page/worker sessions with registry leases.
This is not a guarantee that all browser contexts have completed a global
account transition simultaneously.

The cookie contains a user ID, passwords use the existing SHA-256 comparison,
and `/api/auth/session` can return cookie-derived identity even when username
lookup fails. The sync integration adds neither signed sessions nor a new
password scheme. Its cookie/Origin/stream requirements apply to the sync route;
other routes retain their own identity handling. The local selector must never
be described as proof that the user is currently authorized online.
