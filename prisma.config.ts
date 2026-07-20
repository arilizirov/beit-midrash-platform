import { defineConfig } from "prisma/config";

// Prisma 7 no longer loads .env implicitly; Node >=20.12 can, natively.
// CI provides DATABASE_URL directly and has no .env file — hence the guard.
try {
  process.loadEnvFile();
} catch {
  /* no .env — env vars must come from the environment (CI) */
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
