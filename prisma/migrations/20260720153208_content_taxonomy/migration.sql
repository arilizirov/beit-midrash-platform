-- CreateEnum
CREATE TYPE "TopicStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "status" "TopicStatus" NOT NULL DEFAULT 'DRAFT',
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicTag" (
    "topicId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,

    CONSTRAINT "TopicTag_pkey" PRIMARY KEY ("topicId","tagId")
);

-- CreateIndex
CREATE INDEX "Category_groupId_parentId_position_idx" ON "Category"("groupId", "parentId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Category_groupId_slug_key" ON "Category"("groupId", "slug");

-- CreateIndex
CREATE INDEX "Topic_groupId_status_updatedAt_idx" ON "Topic"("groupId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "Topic_groupId_categoryId_idx" ON "Topic"("groupId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_groupId_slug_key" ON "Topic"("groupId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_groupId_slug_key" ON "Tag"("groupId", "slug");

-- CreateIndex
CREATE INDEX "TopicTag_groupId_tagId_idx" ON "TopicTag"("groupId", "tagId");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicTag" ADD CONSTRAINT "TopicTag_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicTag" ADD CONSTRAINT "TopicTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============ hand-authored (SPEC §4/§6) ============
-- Every groupId table gets the tenant wall; the catalog-scan test in
-- rls.test.ts fails the build for any that doesn't.

ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Category" FORCE ROW LEVEL SECURITY;
CREATE POLICY "category_tenant_isolation" ON "Category" FOR ALL
  USING ("groupId" = current_setting('app.group_id', true))
  WITH CHECK ("groupId" = current_setting('app.group_id', true));

ALTER TABLE "Topic" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Topic" FORCE ROW LEVEL SECURITY;
CREATE POLICY "topic_tenant_isolation" ON "Topic" FOR ALL
  USING ("groupId" = current_setting('app.group_id', true))
  WITH CHECK ("groupId" = current_setting('app.group_id', true));

ALTER TABLE "Tag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tag" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tag_tenant_isolation" ON "Tag" FOR ALL
  USING ("groupId" = current_setting('app.group_id', true))
  WITH CHECK ("groupId" = current_setting('app.group_id', true));

ALTER TABLE "TopicTag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TopicTag" FORCE ROW LEVEL SECURITY;
CREATE POLICY "topictag_tenant_isolation" ON "TopicTag" FOR ALL
  USING ("groupId" = current_setting('app.group_id', true))
  WITH CHECK ("groupId" = current_setting('app.group_id', true));

-- Slug uniqueness binds LIVE rows only (ADR 0002): an archived/soft-deleted
-- topic must not squat its slug forever. Prisma's @@unique is absolute, so
-- replace it with a partial index.
DROP INDEX "Topic_groupId_slug_key";
CREATE UNIQUE INDEX "Topic_groupId_slug_active_key" ON "Topic"("groupId", "slug")
  WHERE "deletedAt" IS NULL;
DROP INDEX "Category_groupId_slug_key";
CREATE UNIQUE INDEX "Category_groupId_slug_active_key" ON "Category"("groupId", "slug")
  WHERE "deletedAt" IS NULL;
DROP INDEX "Tag_groupId_slug_key";
CREATE UNIQUE INDEX "Tag_groupId_slug_active_key" ON "Tag"("groupId", "slug")
  WHERE "deletedAt" IS NULL;
