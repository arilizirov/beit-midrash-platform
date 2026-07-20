/**
 * platform/db — the Prisma client singleton (public surface of the db seam).
 *
 * Prisma 7: no Rust engine; connections go through the pg driver adapter.
 * The connection role must be a NON-superuser in every environment — RLS
 * never binds superusers, so running the app as one would silently disable
 * enforcement layer 4 (SPEC §6).
 */
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../../generated/prisma/client";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export function createClient(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

// Next.js dev hot-reload spawns many module instances; keep one client.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createClient(required("DATABASE_URL"));

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type { PrismaClient };
