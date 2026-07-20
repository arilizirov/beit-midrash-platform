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

export function createClient(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
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
