/**
 * SPEC §7: the audited HARD purge — the one sanctioned way to remove data for
 * real. It must take the topic and its edges, leave the audit behind, never
 * reach outside its tenant, and never touch a neighbour that merely shares an
 * id.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { appUrl } from "../../../test/db-url";
import { createClient, type PrismaClient } from "../db";
import { withGroup } from "../tenancy";

import { purgeTopic } from "./index";

let db: PrismaClient;
let groupA: string, groupB: string, userId: string;

beforeAll(async () => {
  db = createClient(appUrl());
  groupA = (await db.group.create({ data: { slug: "pur-a", name: "חבורה" } })).id;
  groupB = (await db.group.create({ data: { slug: "pur-b", name: "אחרת" } })).id;
  userId = (await db.user.create({ data: { email: "purger@p.local" } })).id;
});

afterAll(async () => {
  await db?.$disconnect();
});

/** A topic in its LEGAL shape: a tag join row and edges in both directions. */
async function seedTopic(groupId: string, slug: string) {
  return withGroup(db, groupId, async (tx) => {
    const topic = await tx.topic.create({
      data: { groupId, title: `נושא ${slug}`, slug, authorId: userId },
    });
    const tag = await tx.tag.create({
      data: { groupId, name: `תג-${slug}`, slug: `t-${slug}` },
    });
    await tx.topicTag.create({ data: { topicId: topic.id, tagId: tag.id, groupId } });
    await tx.internalLink.create({
      data: {
        groupId,
        fromType: "TOPIC",
        fromId: topic.id,
        toType: "NOTE",
        toId: "other",
        createdById: userId,
      },
    });
    await tx.internalLink.create({
      data: {
        groupId,
        fromType: "NOTE",
        fromId: "other",
        toType: "TOPIC",
        toId: topic.id,
        createdById: userId,
      },
    });
    return { topic, tag };
  });
}

const purge = (groupId: string, topicId: string) =>
  purgeTopic(db, { groupId, topicId, actorId: userId, reason: "test" });

describe("purgeTopic", () => {
  it("removes the topic, its tag join rows (by cascade) and its edges both ways", async () => {
    const { topic } = await seedTopic(groupA, "purge-1");
    const report = await purge(groupA, topic.id);

    expect(report.rows).toEqual({ topic: 1, links: 2, tags: 1 });
    await withGroup(db, groupA, async (tx) => {
      expect(await tx.topic.findFirst({ where: { id: topic.id, deletedAt: {} } })).toBeNull();
      // TopicTag has no deletedAt — it vanishes via ON DELETE CASCADE, which
      // the schema reserves for exactly this flow. Nobody had watched it fire.
      expect(await tx.topicTag.count({ where: { topicId: topic.id } })).toBe(0);
      expect(
        await tx.internalLink.findMany({ where: { fromId: topic.id, deletedAt: {} } }),
      ).toEqual([]);
      expect(
        await tx.internalLink.findMany({ where: { toId: topic.id, deletedAt: {} } }),
      ).toEqual([]);
    });
  });

  it("spares a neighbour that merely shares the purged id", async () => {
    // An id-only predicate would delete these. cuid2 makes a real collision
    // near-impossible, which is precisely why nothing would ever catch it.
    const { topic } = await seedTopic(groupA, "purge-2");
    await withGroup(db, groupA, (tx) =>
      tx.internalLink.create({
        data: {
          groupId: groupA,
          fromType: "NOTE", // same id, different TYPE — a different thing
          fromId: topic.id,
          toType: "ARTICLE",
          toId: "elsewhere",
          createdById: userId,
        },
      }),
    );
    await purge(groupA, topic.id);
    const survivor = await withGroup(db, groupA, (tx) =>
      tx.internalLink.findFirst({ where: { fromType: "NOTE", fromId: topic.id } }),
    );
    expect(survivor).not.toBeNull();
  });

  it("purges a topic that was already soft-deleted", async () => {
    // The layer-3 filter hides tombstones from ordinary reads; a purge that
    // inherited it would skip the very rows it exists to destroy.
    const { topic } = await seedTopic(groupA, "purge-3");
    await withGroup(db, groupA, (tx) =>
      tx.topic.update({ where: { id: topic.id }, data: { deletedAt: new Date() } }),
    );
    const report = await purge(groupA, topic.id);
    expect(report.rows.topic).toBe(1);
  });

  it("leaves a legible audit entry behind — the log outlives what it describes", async () => {
    const { topic } = await seedTopic(groupA, "purge-4");
    await purge(groupA, topic.id);
    const audit = await withGroup(db, groupA, (tx) =>
      tx.activityLog.findMany({
        where: { entityId: topic.id },
        select: { action: true, metadataJson: true },
      }),
    );
    expect(audit.map((a) => a.action)).toContain("entity.purge");
    // the id now points at nothing, so the entry must carry something human
    expect(JSON.stringify(audit.map((a) => a.metadataJson))).toContain("purge-4");
  });

  it("cannot reach into another tenant", async () => {
    const { topic } = await seedTopic(groupB, "purge-5");
    await expect(purge(groupA, topic.id)).rejects.toThrow("topic not found in this group");
    expect(
      await withGroup(db, groupB, (tx) => tx.topic.findFirst({ where: { id: topic.id } })),
    ).not.toBeNull();
  });
});
