/**
 * platform/tenancy — TenancyGuard seam (SPEC §6, layer 4 setter).
 *
 * Every group-scoped DB access runs inside `withGroup`, which opens a
 * transaction and sets the tenant context for exactly that transaction
 * (set_config(..., true) = transaction-local). The Postgres RLS policies
 * compare each row's groupId to this setting; with no context set they
 * evaluate NULL and expose nothing — fail-closed by construction.
 */
import type { Prisma } from "../../../generated/prisma/client";

import type { PrismaClient } from "../db";

/** The transaction handle passed to `withGroup` callbacks. */
export type GroupTx = Prisma.TransactionClient;

export type GroupTxOptions = {
  /** Postgres default is READ COMMITTED — every statement takes a NEW
   *  snapshot, so a multi-statement read is NOT a point-in-time view.
   *  Pass "RepeatableRead" when the caller needs one (e.g. an export). */
  isolationLevel?: "ReadCommitted" | "RepeatableRead" | "Serializable";
  /** Prisma's interactive-transaction default is 5s. */
  timeout?: number;
  /**
   * WHO is asking. No policy reads it yet; the Note policy in the next slice
   * is the first, enforcing SPEC §6's rule that a PRIVATE note is author-only
   * for everyone including the owner.
   *
   * Omitting it errs in the safe direction: unset becomes the empty string,
   * which matches no id (cuid2 is never empty — ADR 0003), so viewer-scoped
   * rows stay hidden. **A forgotten viewer under-returns; it never leaks.**
   * Two consequences worth knowing before you rely on that:
   *   - a group-wide flow (export, purge) that later touches a viewer-scoped
   *     table will silently see NOTHING and report success;
   *   - a search that forgets it hides the searcher's OWN rows from them.
   */
  viewerId?: string;
};

export async function withGroup<T>(
  client: PrismaClient,
  groupId: string,
  fn: (tx: GroupTx) => Promise<T>,
  options?: GroupTxOptions,
): Promise<T> {
  const { viewerId = "", ...txOptions } = options ?? {};
  return client.$transaction(
    async (tx) => {
      // Transaction-local (the `true`), so neither setting can survive into
      // the next user of a pooled connection. app.user_id is written on EVERY
      // transaction rather than only when supplied — not because a local
      // value could persist (it cannot), but because a NON-local default from
      // `ALTER ROLE ... SET` or postgresql.conf otherwise would.
      await tx.$queryRaw`SELECT set_config('app.group_id', ${groupId}, true), set_config('app.user_id', ${viewerId}, true)`;
      return fn(tx);
    },
    // viewerId is ours, not Prisma's — destructured out above so it is never
    // handed to a third-party API that has no idea what it is.
    txOptions as Parameters<PrismaClient["$transaction"]>[1],
  );
}
