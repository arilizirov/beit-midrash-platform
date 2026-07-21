-- Discussion core (SPEC §4).

CREATE TYPE "DiscussionStatus" AS ENUM ('DRAFT', 'OPEN', 'RESOLVED', 'ARCHIVED');
CREATE TYPE "ContributionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "Discussion" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentJson" JSONB,
    "contentText" TEXT,
    "status" "DiscussionStatus" NOT NULL DEFAULT 'DRAFT',
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Discussion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Contribution" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "discussionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "contentJson" JSONB,
    "contentText" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "status" "ContributionStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Contribution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Discussion_id_groupId_key" ON "Discussion"("id", "groupId");
CREATE INDEX "Discussion_groupId_topicId_status_idx" ON "Discussion"("groupId", "topicId", "status");
CREATE INDEX "Discussion_groupId_updatedAt_idx" ON "Discussion"("groupId", "updatedAt");
CREATE UNIQUE INDEX "Contribution_id_groupId_key" ON "Contribution"("id", "groupId");
CREATE INDEX "Contribution_groupId_discussionId_position_idx" ON "Contribution"("groupId", "discussionId", "position");

-- Composite FKs carry groupId INTO the key: Postgres validates foreign keys
-- with row security OFF, so an id-only FK lets one tenant reference another
-- tenant's row (verified when this pattern was introduced).
ALTER TABLE "Discussion" ADD CONSTRAINT "Discussion_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Discussion" ADD CONSTRAINT "Discussion_topicId_groupId_fkey" FOREIGN KEY ("topicId", "groupId") REFERENCES "Topic"("id", "groupId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Discussion" ADD CONSTRAINT "Discussion_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_discussionId_groupId_fkey" FOREIGN KEY ("discussionId", "groupId") REFERENCES "Discussion"("id", "groupId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tenant wall (the catalog-scan test fails the build for any groupId table
-- that lacks ENABLE + FORCE + a policy).
ALTER TABLE "Discussion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Discussion" FORCE ROW LEVEL SECURITY;
CREATE POLICY "discussion_tenant_isolation" ON "Discussion" FOR ALL
  USING ("groupId" = current_setting('app.group_id', true))
  WITH CHECK ("groupId" = current_setting('app.group_id', true));

ALTER TABLE "Contribution" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Contribution" FORCE ROW LEVEL SECURITY;
CREATE POLICY "contribution_tenant_isolation" ON "Contribution" FOR ALL
  USING ("groupId" = current_setting('app.group_id', true))
  WITH CHECK ("groupId" = current_setting('app.group_id', true));
