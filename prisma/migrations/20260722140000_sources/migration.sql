-- Source + SourceCitation (SPEC §4, §9). Mirrors the notes/content_taxonomy
-- idioms: composite tenant FKs, FORCED RLS, a partial unique on the live ref,
-- and DB-generated search columns reusing the existing bm_normalize.

CREATE TYPE "WorkCategory" AS ENUM ('TALMUD_BAVLI', 'TANACH', 'MISHNAH', 'RAMBAM', 'SHULCHAN_ARUCH', 'MIDRASH', 'OTHER');
CREATE TYPE "CitationEntityType" AS ENUM ('DISCUSSION', 'CONTRIBUTION', 'ARTICLE', 'NOTE', 'NEWSPOST', 'SUMMARY');

CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "workTitle" TEXT NOT NULL,
    "workCategory" "WorkCategory" NOT NULL,
    "ref" TEXT NOT NULL,
    "refStructured" JSONB NOT NULL,
    "hebrewRef" TEXT,
    "textHebrew" TEXT,
    "sefariaRef" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SourceCitation" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "entityType" "CitationEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "selectionText" TEXT,
    "selectionRange" JSONB,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "SourceCitation_pkey" PRIMARY KEY ("id")
);

-- Composite-FK target uniques (citations reference Source(id, groupId)).
CREATE UNIQUE INDEX "Source_id_groupId_key" ON "Source"("id", "groupId");
CREATE UNIQUE INDEX "SourceCitation_id_groupId_key" ON "SourceCitation"("id", "groupId");

-- One LIVE source per (groupId, ref): the find-or-create dedup invariant. A
-- soft-deleted source must not squat its ref forever (ADR 0002), so the unique
-- is partial. Prisma cannot express this, which is why it is not in the schema.
CREATE UNIQUE INDEX "Source_groupId_ref_active_key" ON "Source"("groupId", "ref") WHERE "deletedAt" IS NULL;

CREATE INDEX "Source_groupId_workCategory_idx" ON "Source"("groupId", "workCategory");
CREATE INDEX "SourceCitation_groupId_entityType_entityId_idx" ON "SourceCitation"("groupId", "entityType", "entityId");
CREATE INDEX "SourceCitation_groupId_sourceId_idx" ON "SourceCitation"("groupId", "sourceId");

ALTER TABLE "Source" ADD CONSTRAINT "Source_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Source" ADD CONSTRAINT "Source_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SourceCitation" ADD CONSTRAINT "SourceCitation_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SourceCitation" ADD CONSTRAINT "SourceCitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Composite FK carries groupId INTO the key: a citation can only point at a
-- source in its OWN group (Postgres validates FKs with row security OFF). The
-- entityId column deliberately has NO FK — it is a polymorphic discriminator.
ALTER TABLE "SourceCitation" ADD CONSTRAINT "SourceCitation_sourceId_groupId_fkey" FOREIGN KEY ("sourceId", "groupId") REFERENCES "Source"("id", "groupId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS — mandatory or the rls.test catalog scan reds the build. Both tables are
-- plain tenant-only (a Source has no stricter-than-tenant ownership rule, unlike
-- a PRIVATE note): ENABLE + FORCE + a FOR ALL policy with USING and WITH CHECK.
ALTER TABLE "Source" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Source" FORCE ROW LEVEL SECURITY;
CREATE POLICY "source_tenant_isolation" ON "Source" FOR ALL
  USING ("groupId" = current_setting('app.group_id', true))
  WITH CHECK ("groupId" = current_setting('app.group_id', true));

ALTER TABLE "SourceCitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SourceCitation" FORCE ROW LEVEL SECURITY;
CREATE POLICY "sourcecitation_tenant_isolation" ON "SourceCitation" FOR ALL
  USING ("groupId" = current_setting('app.group_id', true))
  WITH CHECK ("groupId" = current_setting('app.group_id', true));

-- Search columns (SPEC §8 — Source is in the searchable set). REUSE the
-- existing IMMUTABLE bm_normalize; do NOT CREATE OR REPLACE it (the documented
-- trap that leaves STORED columns stale). Weight A = the work title, B = the
-- Hebrew ref + cached text. Partial GIN indexes on live rows, mirroring Topic.
ALTER TABLE "Source" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple'::regconfig, bm_normalize(COALESCE("workTitle", ''))), 'A') ||
    setweight(to_tsvector('simple'::regconfig, bm_normalize(COALESCE("hebrewRef", '') || ' ' || COALESCE("textHebrew", ''))), 'B')
  ) STORED;
ALTER TABLE "Source" ADD COLUMN "searchText" text
  GENERATED ALWAYS AS (
    bm_normalize(COALESCE("workTitle", '') || ' ' || COALESCE("hebrewRef", '') || ' ' || COALESCE("textHebrew", ''))
  ) STORED;

CREATE INDEX "Source_searchVector_idx" ON "Source" USING GIN ("searchVector") WHERE "deletedAt" IS NULL;
CREATE INDEX "Source_searchText_idx" ON "Source" USING GIN ("searchText" gin_trgm_ops) WHERE "deletedAt" IS NULL;
