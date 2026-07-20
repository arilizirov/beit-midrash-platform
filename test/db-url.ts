/**
 * Shared by global-setup and the RLS tests: which DB to test against, and the
 * derived NON-superuser app-role connection (RLS never binds superusers, so
 * testing as one would pass vacuously).
 */
export const APP_ROLE = "learntorah_app";
export const APP_ROLE_PASSWORD = process.env.APP_DB_PASSWORD ?? "localdev"; // local/CI only — never a production credential

// The password lands in BOTH a SQL literal (global-setup) and a URL — reserved
// characters would make the two disagree or break the DDL (debt-hawk, F1).
if (!/^[A-Za-z0-9_]+$/.test(APP_ROLE_PASSWORD)) {
  throw new Error("APP_DB_PASSWORD must match [A-Za-z0-9_]+ (test-only credential)");
}

export function adminUrl(): string {
  try {
    process.loadEnvFile();
  } catch {
    /* CI: env comes from the workflow */
  }
  const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    // Fail, never skip: a silently-skipped RLS suite is a green lie.
    throw new Error("TEST_DATABASE_URL or DATABASE_URL must be set for DB tests");
  }
  return url;
}

export function appUrl(): string {
  const u = new URL(adminUrl());
  u.username = APP_ROLE;
  u.password = APP_ROLE_PASSWORD;
  return u.toString();
}
