// Use-cases for taxonomy. Orchestrates model + platform. No framework leakage.
import type { PrismaClient } from "../../platform/db";
import { logActivity } from "../../platform/telemetry";
import { withGroup } from "../../platform/tenancy";
import { idPrefix, makeSlug, newId } from "../../shared_kernel";

import { assertDepthAllowed, type TopicStatus } from "./model";

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

export async function createCategory(
  db: PrismaClient,
  input: {
    groupId: string;
    name: string;
    parentId?: string;
    position?: number;
    actorId: string;
  },
) {
  const id = newId();
  return withGroup(db, input.groupId, async (tx) => {
    if (input.parentId) {
      // Walk the parent chain and enforce the depth bound. The composite FK
      // already makes a cross-group parent impossible; this lookup turns a
      // missing parent into a clear domain error instead of a raw FK
      // violation, and supplies the chain the depth rule needs.
      // Depth is bounded at MAX_CATEGORY_DEPTH, so the whole chain fits in
      // ONE query — no loop, no N round-trips inside the transaction.
      // Nested reads are NOT soft-delete filtered (platform/db gap 3), which
      // is what we want here: an archived ancestor must still count toward
      // depth rather than silently shortening the chain.
      const parent = await tx.category.findFirst({
        where: { id: input.parentId },
        select: { id: true, parent: { select: { id: true, parent: { select: { id: true } } } } },
      });
      if (!parent) throw new Error("parent category not found in this group");
      let ancestorCount = 1;
      if (parent.parent) ancestorCount++;
      if (parent.parent?.parent) ancestorCount++;
      assertDepthAllowed(ancestorCount);
    }
    const category = await tx.category.create({
      data: {
        id,
        groupId: input.groupId,
        name: input.name,
        slug: makeSlug(input.name, idPrefix(id)),
        parentId: input.parentId,
        // YAGNI: position is stored but unread until the category-tree UI
        // needs ordering — the column is SPEC §4, the reader is not here yet.
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
