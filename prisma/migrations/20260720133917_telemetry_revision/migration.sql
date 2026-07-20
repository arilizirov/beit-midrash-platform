-- CreateEnum
CREATE TYPE "RevisionEntityType" AS ENUM ('DISCUSSION', 'CONTRIBUTION', 'ARTICLE', 'NOTE', 'SUMMARY', 'TABLEBLOCK', 'NEWSPOST');

-- CreateTable
CREATE TABLE "Revision" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "entityType" "RevisionEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "contentJson" JSONB NOT NULL,
    "title" TEXT,
    "editedById" TEXT NOT NULL,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventLog" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT,
    "event" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Revision_groupId_entityType_entityId_idx" ON "Revision"("groupId", "entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Revision_entityType_entityId_version_key" ON "Revision"("entityType", "entityId", "version");

-- CreateIndex
CREATE INDEX "ActivityLog_groupId_createdAt_idx" ON "ActivityLog"("groupId", "createdAt");

-- CreateIndex
CREATE INDEX "EventLog_groupId_createdAt_idx" ON "EventLog"("groupId", "createdAt");

-- CreateIndex
CREATE INDEX "EventLog_groupId_event_idx" ON "EventLog"("groupId", "event");

-- ============ hand-authored (SPEC §4/§6) ============

-- Revision: standard tenant wall (soft-delete is its only mutation path).
ALTER TABLE "Revision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Revision" FORCE ROW LEVEL SECURITY;
CREATE POLICY "revision_tenant_isolation" ON "Revision"
  FOR ALL
  USING ("groupId" = current_setting('app.group_id', true))
  WITH CHECK ("groupId" = current_setting('app.group_id', true));

-- ActivityLog / EventLog: APPEND-ONLY BY CONSTRUCTION. Only SELECT and
-- INSERT policies exist; with FORCEd RLS and no UPDATE/DELETE policy,
-- Postgres denies rewrites of history to every role but superusers.
ALTER TABLE "ActivityLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ActivityLog" FORCE ROW LEVEL SECURITY;
CREATE POLICY "activitylog_tenant_select" ON "ActivityLog"
  FOR SELECT USING ("groupId" = current_setting('app.group_id', true));
CREATE POLICY "activitylog_tenant_insert" ON "ActivityLog"
  FOR INSERT WITH CHECK ("groupId" = current_setting('app.group_id', true));

ALTER TABLE "EventLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EventLog" FORCE ROW LEVEL SECURITY;
CREATE POLICY "eventlog_tenant_select" ON "EventLog"
  FOR SELECT USING ("groupId" = current_setting('app.group_id', true));
CREATE POLICY "eventlog_tenant_insert" ON "EventLog"
  FOR INSERT WITH CHECK ("groupId" = current_setting('app.group_id', true));
