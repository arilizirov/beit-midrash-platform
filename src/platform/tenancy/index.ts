/**
 * platform/tenancy — TenancyGuard seam (SPEC §6, layer 4 setter).
 *
 * Every group-scoped DB access runs inside `withGroup`, which opens a
 * transaction and sets the tenant context for exactly that transaction
 * (set_config(..., true) = transaction-local). The Postgres RLS policies
 * compare each row's groupId to this setting; with no context set they
 * evaluate NULL and expose nothing — fail-closed by construction.
 */
import type { PrismaClient } from "../db";

/** The transaction handle passed to `withGroup` callbacks. */
export type GroupTx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export async function withGroup<T>(
  client: PrismaClient,
  groupId: string,
  fn: (tx: GroupTx) => Promise<T>,
): Promise<T> {
  return client.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.group_id', ${groupId}, true)`;
    return fn(tx);
  });
}
