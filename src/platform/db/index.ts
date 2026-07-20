/**
 * platform/db — the Prisma client factory + lazy app singleton.
 *
 * Prisma 7: no Rust engine; connections go through the pg driver adapter.
 * The connection role must be a NON-superuser in every environment — RLS
 * never binds superusers, so running the app as one would silently disable
 * enforcement layer 4 (SPEC §6).
 */
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../../generated/prisma/client";

/**
 * Layer 3 (SPEC §6): the global soft-delete read filter. List reads on
 * soft-deletable models get `deletedAt: null` injected UNLESS the caller
 * names `deletedAt` in the where — the explicit escape hatch is
 * `deletedAt: {}` (present, no constraint → history included, on purpose).
 * NOT covered by design: findUnique* (unique inputs only — check deletedAt
 * after, or use findFirst) and all mutations (reactivation must stay legal).
 */
const SOFT_DELETABLE = new Set(["Group", "User", "Membership", "Invitation", "Revision"]);
const FILTERED_READS = new Set(["findMany", "findFirst", "findFirstOrThrow", "count"]);

function withSoftDeleteFilter(base: PrismaClient) {
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (SOFT_DELETABLE.has(model) && FILTERED_READS.has(operation)) {
            const a = args as { where?: Record<string, unknown> };
            if (!a.where || !("deletedAt" in a.where)) {
              a.where = { ...a.where, deletedAt: null };
            }
          }
          return query(args);
        },
      },
    },
  }) as unknown as PrismaClient;
}

export function createClient(connectionString: string): PrismaClient {
  return withSoftDeleteFilter(
    new PrismaClient({ adapter: new PrismaPg({ connectionString }) }),
  );
}

// Lazy on purpose (debt-hawk, F1): an eager module-level singleton would (a)
// demand DATABASE_URL from every importer — the RLS tests import only
// createClient and connect as the app role — and (b) instantiate an unused,
// possibly-superuser client inside the test process. Next.js dev hot-reload
// still gets exactly one client via globalThis.
const g = globalThis as unknown as { prisma?: PrismaClient };

export function getPrisma(): PrismaClient {
  if (!g.prisma) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    g.prisma = createClient(url);
  }
  return g.prisma;
}

export type { PrismaClient };
