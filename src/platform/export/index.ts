/**
 * platform/export — per-group JSON + file manifest (SPEC §7).
 *
 * A GROUP-OWNED portability dump: a backup, or the file you hand the group
 * when it wants everything it has written. **Not** a subject-access response —
 * it is group-scoped and contains EVERY member's email, so giving it to one
 * member would disclose the others.
 *
 * **AUTHZ IS THE CALLER'S JOB** (platform cannot import can()). Unlike purge,
 * which needs a topic id only an insider knows, this needs nothing but a
 * groupId and returns every address — so it also makes a defence-in-depth
 * membership check of its own.
 *
 * Shape decisions: a MANIFEST, not an archive (blobs named, never inlined —
 * base64 in JSON is neither readable nor streamable). Emails are in the dump
 * but deliberately NOT in the audit entry, since ActivityLog has no delete
 * path and must not become a second, unerasable copy. Tombstones excluded by
 * default; `includeDeleted` gives a true archival copy in which every table
 * carries deletedAt. RepeatableRead, because a coherent point-in-time
 * document is the whole reason for the transaction — under Postgres'
 * READ COMMITTED default (verified) each statement takes a new snapshot.
 *
 * LEFT OUT, so nobody finds out on restore day: Revision / ActivityLog /
 * EventLog (history and audit are not portable content); Account / Session /
 * VerificationToken (global identity, no groupId). The file manifest and
 * pending invitations land in the next slice.
 *
 * SCALING LIMIT: built in memory in one transaction. Right for a chevruta of
 * tens; a large multi-group deployment needs this streamed on the queue tier.
 */
import type { PrismaClient } from "../db";
import { logActivity } from "../telemetry";
import { withGroup } from "../tenancy";

/** Bump when the document shape changes — these files outlive the code. */
export const EXPORT_FORMAT_VERSION = 1;

export async function exportGroup(
  db: PrismaClient,
  input: { groupId: string; actorId: string; includeDeleted?: boolean },
) {
  const { groupId, includeDeleted = false } = input;
  // `deletedAt: {}` is the layer-3 escape hatch (key present, unconstrained):
  // history comes through. Omitting the key lets the global filter apply.
  const scope = includeDeleted ? { deletedAt: {} } : {};

  return withGroup(
    db,
    groupId,
    async (tx) => {
      // Defence in depth: a forgotten can() in one server action should cost
      // an error, not every member's email.
      const actor = await tx.membership.findFirst({
        where: { userId: input.actorId, status: "ACTIVE" },
        select: { id: true },
      });
      if (!actor) throw new Error("actor is not an active member of this group");

      // Unconditional `deletedAt: {}` — a soft-deleted group is exactly when
      // you most want the dump.
      const group = await tx.group.findFirst({
        where: { id: groupId, deletedAt: {} },
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          settingsJson: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
        },
      });
      if (!group) throw new Error("group not found");

      // Sequential, not Promise.all: an interactive transaction holds ONE
      // connection, so the driver serializes these anyway — concurrency buys
      // nothing and costs a nondeterministic statement order plus confusing
      // rollback noise when one query rejects.
      const memberships = await tx.membership.findMany({
        where: scope,
        // createdAt is transaction-START time, so rows written together tie —
        // every other list here orders on a unique column.
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          userId: true,
          role: true,
          status: true,
          joinedAt: true,
          deletedAt: true,
          user: { select: { email: true, name: true, hebrewName: true } },
        },
      });
      const categories = await tx.category.findMany({
        where: scope,
        orderBy: { slug: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          parentId: true,
          position: true,
          deletedAt: true,
        },
      });
      const topics = await tx.topic.findMany({
        where: scope,
        orderBy: { slug: "asc" },
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          status: true,
          categoryId: true,
          authorId: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
        },
      });
      const tags = await tx.tag.findMany({
        where: scope,
        orderBy: { slug: "asc" },
        select: { id: true, name: true, slug: true, deletedAt: true },
      });
      const allTopicTags = await tx.topicTag.findMany({
        orderBy: [{ topicId: "asc" }, { tagId: "asc" }],
        select: { topicId: true, tagId: true },
      });
      const allLinks = await tx.internalLink.findMany({
        where: scope,
        orderBy: { id: "asc" },
        select: {
          id: true,
          fromType: true,
          fromId: true,
          toType: true,
          toId: true,
          relation: true,
          createdById: true,
          deletedAt: true,
        },
      });

      // TopicTag has no deletedAt, so a default export would emit edges
      // pointing at topics/tags that are NOT in this document — a restore
      // would find dangling ids. Same for links whose TOPIC end is excluded.
      const topicIds = new Set(topics.map((t) => t.id));
      const tagIds = new Set(tags.map((t) => t.id));
      const topicTags = allTopicTags.filter(
        (tt) => topicIds.has(tt.topicId) && tagIds.has(tt.tagId),
      );
      const links = allLinks.filter(
        (l) =>
          (l.fromType !== "TOPIC" || topicIds.has(l.fromId)) &&
          (l.toType !== "TOPIC" || topicIds.has(l.toId)),
      );

      await logActivity(tx, {
        groupId,
        action: "group.export",
        entityType: "GROUP",
        entityId: groupId,
        actorId: input.actorId,
        // No emails: ActivityLog has no delete path, so it must not become a
        // second permanent copy of what the export contains.
        metadata: { includeDeleted, topics: topics.length },
      });

      return {
        formatVersion: EXPORT_FORMAT_VERSION,
        exportedAt: new Date().toISOString(),
        includeDeleted,
        group,
        memberships,
        categories,
        topics,
        tags,
        topicTags,
        links,
      };
    },
    // A coherent snapshot is the whole reason for the transaction; the
    // default timeout (5s) is too tight for a whole-group read.
    { isolationLevel: "RepeatableRead", timeout: 30_000 },
  );
}

export type GroupExport = Awaited<ReturnType<typeof exportGroup>>;
