-- CreateEnum
CREATE TYPE "AttachmentTargetType" AS ENUM ('DISCUSSION', 'CONTRIBUTION', 'ARTICLE', 'NOTE', 'NEWSPOST', 'TABLEBLOCK', 'SUMMARY');
CREATE TYPE "AttachmentKind" AS ENUM ('IMAGE', 'PDF', 'FILE');
CREATE TYPE "LinkTargetType" AS ENUM ('TOPIC', 'DISCUSSION', 'CONTRIBUTION', 'SUMMARY', 'ARTICLE', 'NOTE', 'TABLEBLOCK', 'NEWSPOST', 'SOURCE');
CREATE TYPE "LinkRelation" AS ENUM ('RELATED', 'REFERENCES', 'RESPONDS_TO', 'SUPERSEDES');

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "entityType" "AttachmentTargetType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "kind" "AttachmentKind" NOT NULL,
    "objectKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "thumbnailKey" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InternalLink" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "fromType" "LinkTargetType" NOT NULL,
    "fromId" TEXT NOT NULL,
    "toType" "LinkTargetType" NOT NULL,
    "toId" TEXT NOT NULL,
    "relation" "LinkRelation" NOT NULL DEFAULT 'RELATED',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "InternalLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_objectKey_key" ON "Attachment"("objectKey");
CREATE INDEX "Attachment_groupId_entityType_entityId_idx" ON "Attachment"("groupId", "entityType", "entityId");
CREATE INDEX "InternalLink_groupId_fromType_fromId_idx" ON "InternalLink"("groupId", "fromType", "fromId");
CREATE INDEX "InternalLink_groupId_toType_toId_idx" ON "InternalLink"("groupId", "toType", "toId");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InternalLink" ADD CONSTRAINT "InternalLink_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InternalLink" ADD CONSTRAINT "InternalLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============ hand-authored (SPEC §4/§6) ============
-- Tenant wall on both (the catalog-scan test fails the build otherwise).
ALTER TABLE "Attachment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Attachment" FORCE ROW LEVEL SECURITY;
CREATE POLICY "attachment_tenant_isolation" ON "Attachment" FOR ALL
  USING ("groupId" = current_setting('app.group_id', true))
  WITH CHECK ("groupId" = current_setting('app.group_id', true));

ALTER TABLE "InternalLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InternalLink" FORCE ROW LEVEL SECURITY;
CREATE POLICY "internallink_tenant_isolation" ON "InternalLink" FOR ALL
  USING ("groupId" = current_setting('app.group_id', true))
  WITH CHECK ("groupId" = current_setting('app.group_id', true));

-- The edge unique must bind LIVE rows only (ADR 0002): a soft-deleted link
-- would otherwise permanently block re-linking the same two things.
-- Leads with groupId: unique indexes are enforced BELOW row security, so a
-- tenant-blind edge key would let one group's insert collide with a row it
-- cannot see — both a hard block and an existence oracle.
CREATE UNIQUE INDEX "InternalLink_edge_active_key"
  ON "InternalLink"("groupId", "fromType", "fromId", "toType", "toId", "relation")
  WHERE "deletedAt" IS NULL;

-- Every object key is namespaced by group ("<groupId>/..."), enforced here so
-- a service-layer bug cannot write one tenant's blob under another's prefix.
ALTER TABLE "Attachment" ADD CONSTRAINT "attachment_key_group_prefixed"
  CHECK ("objectKey" LIKE "groupId" || '/%');
