# STACK.md — current decisions (the freshness layer)

Project: **LearnTorah — בית המדרש הדיגיטלי**. Locked build spec: [`docs/SPEC.md`](./SPEC.md).
The brains hold timeless judgment; this file holds the current, project-specific facts.

> Versions below were pinned at scaffold time (2026-07-20) from what `npm install`
> actually resolved — the lockfile is the ground truth. For anything genuinely
> time-sensitive, fetch live docs at task time and name the source.

## Languages & runtimes
- TypeScript **6.0.x** (strict). Node **>=22.12** (floor set by dependency-cruiser 18's `commander@15`; CI and local dev run 24).
- Python is present only for the bigbrain kit's own tooling (verify, boundaries, tests) — not app code.

## Pinned at scaffold (see package-lock.json for exact truth)
- next **16.2.10** · react/react-dom **19.2.7** · typescript **6.0.3**
- vitest **4.1.10** · eslint **10.7.0** + typescript-eslint · dependency-cruiser **18.1.0**
- prisma / @prisma/client / @prisma/adapter-pg **7.8.0** · pg **8.22.0** — Prisma 7: no Rust engine, pg driver adapter, `prisma.config.ts`, generated client at `generated/` (gitignored; `prisma generate` in CI)
- Not yet installed (join at their slice): Auth.js, TipTap, Tailwind, Playwright, sharp.

## Frameworks & key libraries
- **Next.js — App Router**, React Server Components + Server Actions.
- **Prisma** — ORM + migrations (single system of record: Postgres).
- **Auth.js (NextAuth v5)** — self-hosted, invite-only, email magic-link primary + optional password; Prisma adapter. TOTP 2FA required for OWNER/ADMIN.
- **TipTap (ProseMirror)** — canonical content is `contentJson` + derived `contentText` (+ optional `contentHtml`). Derived rendering is a pure, tested function of the JSON, never hand-edited. Exactly four custom nodes in V1: SourceCitation, Attachment, InternalLink, TableBlock (official TipTap table extension only).
- **Tailwind** — RTL via CSS logical properties (`inline-start/end`).
- **Playwright** — e2e (a vertical slice isn't done until one real journey passes).

## Data
- **PostgreSQL**. Prisma migrations.
- IDs: `cuid()` everywhere, never auto-increment.
- `groupId` on every content row; all composite indexes lead with it.
- Soft delete via `deletedAt` + global read filter; hard delete only via the audited purge flow.
- Search: `tsvector` (`simple` config) + `pg_trgm`, fed by ONE **`IMMUTABLE`** SQL function `bm_normalize(text)` used by all `GENERATED ALWAYS … STORED` columns. **Never `unaccent()`** (STABLE) inside a generated column — it will not compile.
- `pgvector` reserved for future RAG; not installed in V1.

## Auth / security
- Four fail-closed enforcement layers: edge middleware → `requireMembership()` + `assertCan()` → tenant-scoped Prisma client (`$extends` injecting `where: { groupId }`) → **Postgres RLS on every content table (mandatory)**.
- CI must contain a cross-tenant read/write must-fail test; merges blocked without it.
- PRIVATE Notes are author-only for **everyone including OWNER**, in UI *and* search.
- Secrets via environment; never in code. Parameterized queries only.

## Hosting & infra
- Vercel + **Neon (pooled connection string from day 1)** + **Cloudflare R2** (presigned direct upload; DB stores object keys + metadata only).
- CI also builds a Docker image every release so a VPS path stays real.
- Jobs: **Postgres-backed job table behind a queue seam. No Redis/BullMQ in V1.**
- Backups: Neon PITR + R2 object versioning; restore runbook verified once before real content.

## Conventions specific to this repo
- Business logic lives in framework-agnostic service modules — SearchService, AIService (stub), StorageService, SourceRefService, TenancyGuard, ContentService — reachable only through each module's public surface.
- Hebrew-first: RTL-native, per-segment bidi isolation (`dir="auto"`) for mixed Hebrew/Latin/refs. Slugs may contain Hebrew + a stable short-id prefix.
- No raw free-text source ref anywhere in the UI — entry goes through the normalizer (SPEC §9).

## Folder layout (parameters only — the process lives in `AGENTS.md`)
- `layout: features`, `source_root: src` — declared in `boundaries.yaml`, which is
  the single source of truth for the convention.
- Next.js routes at `src/app`; domains at `src/features/<name>`; platform at
  `src/platform`; design system at `src/components/ui`.

## Known danger zones
- **RLS binds neither superusers nor (without FORCE) table owners.** The app and
  its tests must always connect as a non-superuser role — locally/CI the test
  suite provisions `learntorah_app` and asserts it; **on Neon, provisioning the
  non-superuser app role is a deploy-runbook gate** before anything user-facing
  ships. The catalog-scan test in `rls.test.ts` fails any future `groupId` table
  that ships without ENABLE+FORCE+policy.
- **Generated-column search** — the `IMMUTABLE`/`STABLE` trap above is a compile-time footgun; touch `bm_normalize` only with a migration + test.
- **Hebrew FTS quality** — Postgres has no Hebrew stemmer. SPEC §8 sets a measured exit criterion (≥50 real items, morphological queries, <80% ⇒ Meilisearch enters V1 behind the SearchService seam). Measure, don't assume.
- **Polymorphic tables** (SourceCitation, Attachment, InternalLink, Revision, Follow, Reaction, Notification) carry no DB FK on `entityId`; integrity depends on soft-delete-only + transactional cascade + the orphan sweep. Use the single `resolveEntity()` helper — never a bespoke switch at each call site.
- **Concurrent edits** — optimistic concurrency via `baseRevisionId`; stale base ⇒ 409. Last-write-wins is not acceptable for Summaries/Tables.
