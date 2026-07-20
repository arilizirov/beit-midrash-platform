/**
 * vitest globalSetup: bring the TEST database to the current schema, provision
 * the non-superuser app role the RLS tests connect as, and start clean.
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

import { Client } from "pg";

import { adminUrl, APP_ROLE, APP_ROLE_PASSWORD } from "./db-url";

export default async function setup(): Promise<void> {
  // Infra can land a slice ahead of the schema: nothing to migrate or
  // provision until prisma/ exists (and no DB tests exist without it).
  if (!existsSync("prisma/schema.prisma")) return;

  const url = adminUrl();

  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });

  const admin = new Client({ connectionString: url });
  await admin.connect();
  try {
    await admin.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${APP_ROLE}') THEN
          CREATE ROLE ${APP_ROLE} LOGIN PASSWORD '${APP_ROLE_PASSWORD}';
        END IF;
      END $$;
    `);
    await admin.query(`ALTER ROLE ${APP_ROLE} WITH LOGIN PASSWORD '${APP_ROLE_PASSWORD}' NOSUPERUSER NOBYPASSRLS`);
    await admin.query(`GRANT USAGE ON SCHEMA public TO ${APP_ROLE}`);
    await admin.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${APP_ROLE}`);
    // Deterministic reruns. Dynamic on purpose (debt-hawk, F1): a hardcoded
    // table list silently goes stale as every future slice adds entities.
    const { rows } = await admin.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables
       WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
    );
    if (rows.length > 0) {
      await admin.query(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(", ")} CASCADE`);
    }
  } finally {
    await admin.end();
  }
}
