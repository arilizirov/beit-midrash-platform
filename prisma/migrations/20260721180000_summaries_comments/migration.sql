-- Summary + Comment (SPEC §4).

CREATE TABLE "Summary" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "discussionId" TEXT NOT NULL,
    "topicId" TEXT,
    "contentJson" JSONB,
    "contentText" TEXT,
    "isCanonical" BOOLEAN NOT NULL DEFAULT false,
    "generatedByAI" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Summary_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "contributionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "parentCommentId" TEXT,
    "anchorJson" JSONB,
    "voiceRecordingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Summary_id_groupId_key" ON "Summary"("id", "groupId");
CREATE INDEX "Summary_groupId_discussionId_idx" ON "Summary"("groupId", "discussionId");
CREATE INDEX "Summary_groupId_topicId_idx" ON "Summary"("groupId", "topicId");
CREATE UNIQUE INDEX "Comment_id_groupId_key" ON "Comment"("id", "groupId");
CREATE INDEX "Comment_groupId_contributionId_createdAt_idx" ON "Comment"("groupId", "contributionId", "createdAt");
-- The target of the self-FK below. Without it a reply could name a parent
-- living on a DIFFERENT contribution: same tenant, wrong thread, and
-- listComments would return an orphan whose parent is not in the result.
CREATE UNIQUE INDEX "Comment_id_contributionId_key" ON "Comment"("id", "contributionId");
CREATE INDEX "Comment_parentCommentId_idx" ON "Comment"("parentCommentId");

-- Composite FKs carry groupId INTO the key: Postgres validates foreign keys
-- with row security OFF, so an id-only FK lets one tenant reference another's.
ALTER TABLE "Summary" ADD CONSTRAINT "Summary_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Summary" ADD CONSTRAINT "Summary_discussionId_groupId_fkey" FOREIGN KEY ("discussionId", "groupId") REFERENCES "Discussion"("id", "groupId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Summary" ADD CONSTRAINT "Summary_topicId_groupId_fkey" FOREIGN KEY ("topicId", "groupId") REFERENCES "Topic"("id", "groupId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Summary" ADD CONSTRAINT "Summary_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_contributionId_groupId_fkey" FOREIGN KEY ("contributionId", "groupId") REFERENCES "Contribution"("id", "groupId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Composite on CONTRIBUTION, not group: the group is already covered by the
-- FK above, and same-tenant is too weak a wall for a thread. MATCH SIMPLE
-- means a NULL parentCommentId (a top-level comment) skips the check.
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentCommentId_contributionId_fkey" FOREIGN KEY ("parentCommentId", "contributionId") REFERENCES "Comment"("id", "contributionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ONE canonical summary per discussion, enforced by the DATABASE.
-- SPEC §4 asks for this in the service layer; a service check is a
-- read-then-write race (two people pinning different summaries at once both
-- pass the check and both commit). Partial, so superseded and soft-deleted
-- summaries do not hold the slot.
CREATE UNIQUE INDEX "Summary_one_canonical_per_discussion"
  ON "Summary"("discussionId")
  WHERE "isCanonical" AND "deletedAt" IS NULL;

-- Tenant wall.
ALTER TABLE "Summary" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Summary" FORCE ROW LEVEL SECURITY;
CREATE POLICY "summary_tenant_isolation" ON "Summary" FOR ALL
  USING ("groupId" = current_setting('app.group_id', true))
  WITH CHECK ("groupId" = current_setting('app.group_id', true));

ALTER TABLE "Comment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Comment" FORCE ROW LEVEL SECURITY;
CREATE POLICY "comment_tenant_isolation" ON "Comment" FOR ALL
  USING ("groupId" = current_setting('app.group_id', true))
  WITH CHECK ("groupId" = current_setting('app.group_id', true));
