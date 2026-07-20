// Use-cases for taxonomy. Orchestrates model + platform. No framework leakage.
import type { PrismaClient } from "../../platform/db";
import { logActivity } from "../../platform/telemetry";
import { withGroup } from "../../platform/tenancy";
import { idPrefix, makeSlug, newId } from "../../shared_kernel";

import { assertDepthAllowed, MAX_CATEGORY_DEPTH, type TopicStatus } from "./model";

export { MAX_CATEGORY_DEPTH };
export type { TopicStatus };

/**
 * AUTHZ IS THE CALLER'S JOB throughout this module: server actions gate on
 * requireMembership + can(...) before calling in (no framework leakage).
 *
 * Ids are generated in APP CODE so the slug — which embeds a prefix of the
 * row's own id — is known before the insert. Inserting a placeholder slug
 * and updating it afterwards would make every concurrent create in a group
 * contend on the same placeholder key of the partial unique index.
 */
export async function createTopic(
  db: PrismaClient,
  input: {
    groupId: string;
    title: string;
    authorId: string;
    categoryId?: string;
    description?: string;
  },
) {
  const id = newId();
  return withGroup(db, input.groupId, async (tx) => {
    const topic = await tx.topic.create({
      data: {
        id,
        groupId: input.groupId,
        title: input.title,
        slug: makeSlug(input.title, idPrefix(id)),
        description: input.description,
        categoryId: input.categoryId,
        authorId: input.authorId,
      },
    });
    await logActivity(tx, {
      groupId: input.groupId,
      action: "topic.create",
      entityType: "TOPIC",
      entityId: topic.id,
      actorId: input.authorId,
    });
    return topic;
  });
}

export async function listTopics(
  db: PrismaClient,
  groupId: string,
  filter?: { categoryId?: string; status?: TopicStatus },
) {
  return withGroup(db, groupId, (tx) =>
    tx.topic.findMany({
      where: { categoryId: filter?.categoryId, status: filter?.status },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        categoryId: true,
        updatedAt: true,
      },
    }),
  );
}

export async function getTopicBySlug(db: PrismaClient, groupId: string, slug: string) {
  return withGroup(db, groupId, (tx) =>
    tx.topic.findFirst({
      where: { slug },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        status: true,
        categoryId: true,
        authorId: true,
        updatedAt: true,
      },
    }),
  );
}

export async function createCategory(
  db: PrismaClient,
  input: {
    groupId: string;
    name: string;
    parentId?: string;
    position?: number;
    actorId?: string;
  },
) {
  const id = newId();
  return withGroup(db, input.groupId, async (tx) => {
    if (input.parentId) {
      // Walk the parent chain and enforce the depth bound. The composite FK
      // already makes a cross-group parent impossible; this lookup turns a
      // missing parent into a clear domain error instead of a raw FK
      // violation, and supplies the chain the depth rule needs.
      const ancestors: { id: string }[] = [];
      let cursor: string | undefined = input.parentId;
      while (cursor) {
        const node: { id: string; parentId: string | null } | null =
          await tx.category.findFirst({
            where: { id: cursor },
            select: { id: true, parentId: true },
          });
        if (!node) throw new Error("parent category not found in this group");
        ancestors.push({ id: node.id });
        // Defensive: a cycle would otherwise spin forever. Cycles are
        // impossible today (no re-parent operation exists) — this is the
        // guard for the day one lands.
        if (ancestors.length > MAX_CATEGORY_DEPTH) break;
        cursor = node.parentId ?? undefined;
      }
      assertDepthAllowed(ancestors);
    }
    const category = await tx.category.create({
      data: {
        id,
        groupId: input.groupId,
        name: input.name,
        slug: makeSlug(input.name, idPrefix(id)),
        parentId: input.parentId,
        position: input.position ?? 0,
      },
    });
    await logActivity(tx, {
      groupId: input.groupId,
      action: "category.create",
      entityType: "CATEGORY",
      entityId: category.id,
      actorId: input.actorId,
    });
    return category;
  });
}

export async function listCategories(db: PrismaClient, groupId: string) {
  return withGroup(db, groupId, (tx) =>
    tx.category.findMany({
      orderBy: [{ parentId: "asc" }, { position: "asc" }],
      select: { id: true, name: true, slug: true, parentId: true, position: true },
    }),
  );
}

export async function createTag(
  db: PrismaClient,
  input: { groupId: string; name: string; actorId?: string },
) {
  const id = newId();
  return withGroup(db, input.groupId, async (tx) => {
    const tag = await tx.tag.create({
      data: {
        id,
        groupId: input.groupId,
        name: input.name,
        slug: makeSlug(input.name, idPrefix(id)),
      },
    });
    await logActivity(tx, {
      groupId: input.groupId,
      action: "tag.create",
      entityType: "TAG",
      entityId: tag.id,
      actorId: input.actorId,
    });
    return tag;
  });
}

/**
 * Idempotent AND concurrency-safe: `skipDuplicates` settles the race in one
 * statement, where a check-then-insert would let the loser hit the primary
 * key and abort its whole transaction.
 */
export async function addTagToTopic(
  db: PrismaClient,
  groupId: string,
  topicId: string,
  tagId: string,
): Promise<void> {
  await withGroup(db, groupId, (tx) =>
    tx.topicTag.createMany({
      data: { topicId, tagId, groupId },
      skipDuplicates: true,
    }),
  );
}

/**
 * Hard DELETE — the one place V1 does that (SPEC §7 prohibits it elsewhere).
 * A link row carries no content of its own: soft-deleting it would leave a
 * tombstone every tag query then has to filter. Audited, so untagging still
 * leaves a trace.
 */
export async function removeTagFromTopic(
  db: PrismaClient,
  groupId: string,
  topicId: string,
  tagId: string,
  actorId?: string,
): Promise<void> {
  await withGroup(db, groupId, async (tx) => {
    const res = await tx.topicTag.deleteMany({ where: { topicId, tagId } });
    if (res.count > 0) {
      await logActivity(tx, {
        groupId,
        action: "topic.untag",
        entityType: "TOPIC",
        entityId: topicId,
        actorId,
        metadata: { tagId },
      });
    }
  });
}
