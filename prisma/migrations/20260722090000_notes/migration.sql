-- Note + NoteTag (SPEC §4).
--
-- The interesting part of this migration is the Note policy. SPEC §6 says a
-- PRIVATE note is author-only for EVERYONE, the group owner included. That is
-- not a role capability anybody can be granted, so it does not belong in
-- can(); it is an ownership rule that outranks every role. Encoding it in the
-- policy means a service that forgets its WHERE clause returns nothing rather
-- than someone else's private writing.
--
-- withGroup always writes app.user_id, using "" when no viewer was given, so
-- in practice the fail-closed comparison is `authorId = ''` — definitely
-- false for every cuid2 id, rather than the NULL/unknown a missing setting
-- would give. Both are safe; this is the one that actually runs.

CREATE TYPE "NoteVisibility" AS ENUM ('PRIVATE', 'GROUP');

CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "title" TEXT,
    "contentJson" JSONB,
    "contentText" TEXT,
    "visibility" "NoteVisibility" NOT NULL DEFAULT 'PRIVATE',
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NoteTag" (
    "noteId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    CONSTRAINT "NoteTag_pkey" PRIMARY KEY ("noteId", "tagId")
);

CREATE UNIQUE INDEX "Note_id_groupId_key" ON "Note"("id", "groupId");
CREATE INDEX "Note_groupId_authorId_idx" ON "Note"("groupId", "authorId");
CREATE INDEX "NoteTag_groupId_tagId_idx" ON "NoteTag"("groupId", "tagId");

ALTER TABLE "Note" ADD CONSTRAINT "Note_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Note" ADD CONSTRAINT "Note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Composite on both sides: a join row can only bind a note and a tag that
-- both belong to ITS group (Postgres validates FKs with row security OFF).
ALTER TABLE "NoteTag" ADD CONSTRAINT "NoteTag_noteId_groupId_fkey" FOREIGN KEY ("noteId", "groupId") REFERENCES "Note"("id", "groupId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NoteTag" ADD CONSTRAINT "NoteTag_tagId_groupId_fkey" FOREIGN KEY ("tagId", "groupId") REFERENCES "Tag"("id", "groupId") ON DELETE CASCADE ON UPDATE CASCADE;

-- SCOPE: this policy covers Note (and, through it, NoteTag). It does NOT
-- reach Revision, Attachment, SourceCitation or InternalLink — all
-- polymorphic and tenant-only, and all of which SPEC §4 lets point at a NOTE.
-- A Revision in particular stores a full content snapshot. See ADR 0004.
ALTER TABLE "Note" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Note" FORCE ROW LEVEL SECURITY;
-- Tenant wall AND the private-note rule in one policy.
--
-- WITH CHECK is spelled out rather than left implicit. It is NOT load-bearing:
-- for a FOR ALL policy Postgres reuses the USING expression as the write check
-- when WITH CHECK is omitted, and dropping it here was verified to change no
-- behaviour at all. It is written out because a reader should not have to know
-- that rule to see that writes are guarded too — a member cannot create a
-- PRIVATE note attributed to somebody else, a row they could not then see.
CREATE POLICY "note_tenant_and_privacy" ON "Note" FOR ALL
  USING (
    "groupId" = current_setting('app.group_id', true)
    AND ("visibility" = 'GROUP' OR "authorId" = current_setting('app.user_id', true))
  )
  WITH CHECK (
    "groupId" = current_setting('app.group_id', true)
    AND ("visibility" = 'GROUP' OR "authorId" = current_setting('app.user_id', true))
  );

ALTER TABLE "NoteTag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NoteTag" FORCE ROW LEVEL SECURITY;
-- A tenant-only policy here was VERIFIED to leak: any member could list the
-- join rows of other members' PRIVATE notes (learning that a private note
-- exists and which tags it carries), and could both tag and UNTAG them. The
-- composite FK does not save this — Postgres validates FKs with row security
-- OFF, which is the same reason the composite keys exist at all.
--
-- So the join row re-enters Note's own policy: the EXISTS below is subject to
-- RLS on "Note", so it finds nothing when the note is invisible to the viewer.
CREATE POLICY "notetag_tenant_and_privacy" ON "NoteTag" FOR ALL
  USING (
    "groupId" = current_setting('app.group_id', true)
    AND EXISTS (SELECT 1 FROM "Note" n WHERE n."id" = "NoteTag"."noteId")
  )
  WITH CHECK (
    "groupId" = current_setting('app.group_id', true)
    AND EXISTS (SELECT 1 FROM "Note" n WHERE n."id" = "NoteTag"."noteId")
  );
