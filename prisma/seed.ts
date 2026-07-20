/**
 * V1 seed (SPEC §4: seeds exactly one Group + its owner). Idempotent.
 * Runs with the migration role (superuser locally — RLS bypass is expected
 * and acceptable for this documented admin operation).
 */
import { createClient } from "../src/platform/db";

async function main() {
  try {
    process.loadEnvFile();
  } catch {
    /* env from environment */
  }
  const url = process.env.DATABASE_URL;
  const slug = process.env.SEED_GROUP_SLUG ?? "beit-midrash";
  const ownerEmail = process.env.SEED_OWNER_EMAIL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!ownerEmail) throw new Error("SEED_OWNER_EMAIL is not set (the first OWNER's email)");

  const db = createClient(url);
  const group = await db.group.upsert({
    where: { slug },
    update: {},
    create: { slug, name: process.env.SEED_GROUP_NAME ?? "בית המדרש" },
  });
  const owner = await db.user.upsert({
    where: { email: ownerEmail },
    update: {},
    create: { email: ownerEmail, status: "ACTIVE" },
  });
  const existing = await db.membership.findFirst({
    where: { userId: owner.id, groupId: group.id, deletedAt: null },
  });
  if (!existing) {
    await db.membership.create({
      data: { userId: owner.id, groupId: group.id, role: "OWNER", status: "ACTIVE", joinedAt: new Date() },
    });
  }
  console.log(`seeded: group=${group.slug} owner=${owner.email}`);
  await db.$disconnect();
}

main();
