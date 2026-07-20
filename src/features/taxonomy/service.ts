// Use-cases for taxonomy. Orchestrates model + platform. No framework leakage.
import type { PrismaClient } from "../../platform/db";
import { logActivity } from "../../platform/telemetry";
import { withGroup } from "../../platform/tenancy";
import { makeSlug } from "../../shared_kernel";

import type { TopicStatus } from "./model";

export type { TopicStatus };

/** cuid's tail is the random part — a short, stable, collision-safe prefix. */
function idPrefix(id: string): string {
  return id.slice(-6);
}

/**
 * AUTHZ IS THE CALLER'S JOB throughout this module: server actions gate on
 * requireMembership + can(...) before calling in (no framework leakage).
 */
export async function createTopic(
  db: PrismaClient,
  input: { groupId: string; title: string; authorId: string; categoryId?: string; description?: string },
) {
  return withGroup(db, input.groupId, async (tx) => {
    // Two steps on purpose: the slug embeds the row's own id prefix, which
    // only exists after the insert. Same transaction, so no partial state.
    const created = await tx.topic.create({
      data: {
        groupId: input.groupId,
        title: input.title,
        slug: "",
        description: input.description,
        categoryId: input.categoryId,
        authorId: input.authorId,
      },
    });
    const topic = await tx.topic.update({
      where: { id: created.id },
      data: { slug: makeSlug(input.title, idPrefix(created.id)) },
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
      select: { id: true, title: true, slug: true, status: true, categoryId: true, updatedAt: true },
    }),
  );
}

export async function getTopicBySlug(db: PrismaClient, groupId: string, slug: string) {
  return withGroup(db, groupId, (tx) =>
    tx.topic.findFirst({
      where: { slug },
      select: {
        id: true, title: true, slug: true, description: true,
        status: true, categoryId: true, authorId: true, updatedAt: true,
      },
    }),
  );
}

export async function createCategory(
  db: PrismaClient,
  input: { groupId: string; name: string; parentId?: string; position?: number },
) {
  return withGroup(db, input.groupId, async (tx) => {
    if (input.parentId) {
      // Defence in depth: RLS already hides other groups' rows, but an
      // explicit check turns a silent FK error into a clear domain error.
      const parent = await tx.category.findFirst({ where: { id: input.parentId } });
      if (!parent) throw new Error("parent category not found in this group");
    }
    const created = await tx.category.create({
      data: {
        groupId: input.groupId,
        name: input.name,
        slug: "",
        parentId: input.parentId,
        position: input.position ?? 0,
      },
    });
    return tx.category.update({
      where: { id: created.id },
      data: { slug: makeSlug(input.name, idPrefix(created.id)) },
    });
  });
}

export async function createTag(db: PrismaClient, input: { groupId: string; name: string }) {
  return withGroup(db, input.groupId, async (tx) => {
    const created = await tx.tag.create({
      data: { groupId: input.groupId, name: input.name, slug: "" },
    });
    return tx.tag.update({
      where: { id: created.id },
      data: { slug: makeSlug(input.name, idPrefix(created.id)) },
    });
  });
}

/** Idempotent: tagging an already-tagged topic is a no-op, not an error. */
export async function addTagToTopic(
  db: PrismaClient,
  groupId: string,
  topicId: string,
  tagId: string,
): Promise<void> {
  await withGroup(db, groupId, async (tx) => {
    const existing = await tx.topicTag.findFirst({ where: { topicId, tagId } });
    if (existing) return;
    await tx.topicTag.create({ data: { topicId, tagId, groupId } });
  });
}

export async function removeTagFromTopic(
  db: PrismaClient,
  groupId: string,
  topicId: string,
  tagId: string,
): Promise<void> {
  await withGroup(db, groupId, (tx) =>
    tx.topicTag.deleteMany({ where: { topicId, tagId } }),
  );
}
