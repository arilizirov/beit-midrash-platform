/**
 * platform/db — Prisma client factory + lazy app singletons.
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
 * soft-deletable models get `deletedAt: null` injected unless the caller
 * supplies a `deletedAt` constraint (`deletedAt: {}` = include history, on
 * purpose).
 *
 * GAPS — all EMPIRICALLY VERIFIED against Prisma 7.8, not assumed:
 *  1. `findUnique`/`findUniqueOrThrow` are not filtered (unique inputs
 *     only). This is the documented way to look a tombstone up on purpose.
 *  2. Mutations are not filtered — reactivation must stay legal.
 *  3. **Relation reads via `include`/`select` are NOT filtered.** A query
 *     extension intercepts only the top-level operation, so
 *     `group.findFirst({ include: { memberships: true } })` returns
 *     soft-deleted memberships. Filter nested reads by hand until Prisma
 *     supports it; pinned by a test so the day it changes, we find out.
 *  4. `updateMany`/`deleteMany` pass through — a future bulk flow must
 *     exclude tombstones itself.
 */
export const SOFT_DELETABLE: ReadonlySet<string> = new Set([
  "Group",
  "User",
  "Membership",
  "Invitation",
  "Revision",
  "Category",
  "Topic",
  "Tag",
  "Attachment",
  "InternalLink",
]);

const FILTERED_READS: ReadonlySet<string> = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "count",
  // aggregate/groupBy take a `where` and silently counted tombstones before
  // (verified) — the north-star metrics are built on exactly these.
  "aggregate",
  "groupBy",
]);

function withSoftDeleteFilter(base: PrismaClient): PrismaClient {
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (SOFT_DELETABLE.has(model) && FILTERED_READS.has(operation)) {
            const a = args as { where?: Record<string, unknown> };
            // `=== undefined`, NOT `"deletedAt" in where`: an explicitly
            // undefined key (`deletedAt: maybeUndefinedVar`) is present but
            // constrains nothing, and `in` skipped the filter → tombstones
            // leaked (verified). Checking the VALUE fails closed.
            if (a.where?.deletedAt === undefined) {
              // Never mutate the caller's args: a reused args object would
              // carry the injected filter into a later, unfiltered call.
              return query({
                ...(args as object),
                where: { ...(a.where ?? {}), deletedAt: null },
              } as typeof args);
            }
          }
          return query(args);
        },
      },
    },
  }) as unknown as PrismaClient;
}

/** Unfiltered client — for third parties that must see every row. */
export function createBaseClient(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/** The application client: soft-delete filtered (layer 3). */
export function createClient(connectionString: string): PrismaClient {
  return withSoftDeleteFilter(createBaseClient(connectionString));
}

// Lazy on purpose (debt-hawk, F1): an eager module-level singleton would (a)
// demand DATABASE_URL from every importer and (b) instantiate an unused,
// possibly-superuser client inside the test process. The extended client
// wraps the base one, so both share a single connection pool.
const g = globalThis as unknown as { prismaBase?: PrismaClient; prisma?: PrismaClient };

function baseSingleton(): PrismaClient {
  if (!g.prismaBase) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    g.prismaBase = createBaseClient(url);
  }
  return g.prismaBase;
}

/**
 * UNFILTERED singleton. Only for code that must not inherit our filter —
 * currently the Auth.js adapter, whose lookups are its own contract (if a
 * version bump swapped findUnique for findFirst, a filtered client would
 * turn a soft-deleted user's sign-in into createUser → P2002 500 instead of
 * a clean rejection). App code wants getPrisma().
 */
export function getBasePrisma(): PrismaClient {
  return baseSingleton();
}

export function getPrisma(): PrismaClient {
  if (!g.prisma) g.prisma = withSoftDeleteFilter(baseSingleton());
  return g.prisma;
}

/** Test helper: drop the cached singletons (e.g. after $disconnect). */
export function resetPrismaSingletons(): void {
  g.prisma = undefined;
  g.prismaBase = undefined;
}

export type { PrismaClient };
