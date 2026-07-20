/**
 * V1 seed (SPEC §4: seeds exactly one Group + its owner). Idempotent.
 * Runs with the migration role (superuser locally — RLS bypass is expected
 * and acceptable for this documented admin operation).
 */
import { createClient } from "../src/platform/db";
import { seedGroupSlug } from "../src/shared_kernel/group-slug";
import { seedGroupSlug } from "../src/shared_kernel/group-slug";

async function main() {
  try {
    process.loadEnvFile();
  } catch {
    /* env from environment */
  }
  const url = process.env.DATABASE_URL;
  const slug = seedGroupSlug(); // ONE definition, shared with the runtime guard
  // Auth.js lowercases+trims the sign-in identifier before it ever reaches
  // us; User.email is case-sensitive unique. Normalize here or a mixed-case
  // seed email locks the owner out of a fresh deploy. (F2c accept flow must
  // normalize the same way.)
  const ownerEmail = process.env.SEED_OWNER_EMAIL?.trim().toLowerCase();
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!ownerEmail) throw new Error("SEED_OWNER_EMAIL is not set (the first OWNER's email)");

  const db = createClient(url);
  const group = await db.group.upsert({
    where: { slug },
    update: {},
    create: { slug, name: process.env.SEED_GROUP_NAME ?? "בית המדרש" },
  });
  // Re-seeding an existing owner REACTIVATES them (an "idempotent bootstrap"
  // that silently keeps the owner locked out would be a lie).
  const owner = await db.user.upsert({
    where: { email: ownerEmail },
    update: { status: "ACTIVE", deletedAt: null },
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

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
