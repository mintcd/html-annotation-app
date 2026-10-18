export interface SyncClientIdentity {
  readonly accountId: string;
  readonly streamId: string;
}

interface ClosableSyncClient {
  close(): Promise<void>;
}

/** One queue also spans React effect cleanup and Strict Mode remounts. */
export function createSyncClientLifecycle<Client extends ClosableSyncClient>(options: {
  create(identity: SyncClientIdentity, initialize: boolean): Promise<Client>;
  logout(): Promise<void>;
  previousIdentity?: SyncClientIdentity;
}) {
  let queue = Promise.resolve();
  let current: Client | undefined;
  let previousIdentity = options.previousIdentity;

  function enqueue<Result>(work: () => Promise<Result>): Promise<Result> {
    const result = queue.then(work);
    queue = result.then(() => undefined, () => undefined);
    return result;
  }

  function sameIdentity(left: SyncClientIdentity, right: SyncClientIdentity): boolean {
    return left.accountId === right.accountId && left.streamId === right.streamId;
  }

  return {
    open(
      identity: SyncClientIdentity | undefined,
      verified: boolean,
      isCurrent: () => boolean,
    ): Promise<Client | undefined> {
      return enqueue(async () => {
        if (!isCurrent()) return undefined;

        if (current) {
          const closing = current;
          current = undefined;
          await closing.close();
        }

        // Only a verified logout/account switch may disable an account's replica.
        if (verified && (!identity || (previousIdentity && !sameIdentity(previousIdentity, identity)))) {
          await options.logout();
          previousIdentity = undefined;
        }

        if (!identity || !isCurrent()) return undefined;
        const client = await options.create(identity, verified);
        previousIdentity = identity;
        if (!isCurrent()) {
          await client.close();
          return undefined;
        }
        current = client;
        return client;
      });
    },
    close(client: Client | undefined): Promise<void> {
      return enqueue(async () => {
        if (!client || current !== client) return;
        current = undefined;
        await client.close();
      });
    },
  };
}
