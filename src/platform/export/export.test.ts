/**
 * SPEC §7: per-group JSON + files export. The tests care about four things —
 * that it stops at the tenant boundary, that the document is internally
 * consistent enough to restore from, that the egress is recorded WITHOUT
 * copying emails into the unerasable log, and that only a member can ask.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { appUrl } from "../../../test/db-url";
import { createClient, type PrismaClient } from "../db";
import { withGroup } from "../tenancy";

import { exportGroup } from "./index";

let db: PrismaClient;
let groupA: string, groupB: string, userId: string, outsiderId: string;

beforeAll(async () => {
  db = createClient(appUrl());
  groupA = (await db.group.create({ data: { slug: "exp-a", name: "חבורה" } })).id;
  groupB = (await db.group.create({ data: { slug: "exp-b", name: "אחרת" } })).id;
  userId = (await db.user.create({ data: { email: "exporter@e.local" } })).id;
  outsiderId = (await db.user.create({ data: { email: "outsider@e.local" } })).id;

  // Both groups get the SAME shape — a policy dropped on any one table has to
  // show up as a leak rather than as an absence nobody seeded.
  for (const [gid, sfx] of [
    [groupA, "a"],
    [groupB, "b"],
  ] as const) {
    await withGroup(db, gid, async (tx) => {
      await tx.membership.create({
        data: { userId, groupId: gid, role: "OWNER", status: "ACTIVE" },
      });
      const cat = await tx.category.create({
        data: { groupId: gid, name: `קטגוריה-${sfx}`, slug: `c-${sfx}` },
      });
      const live = await tx.topic.create({
        data: {
          groupId: gid,
          title: `חי-${sfx}`,
          slug: `live-${sfx}`,
          authorId: userId,
          categoryId: cat.id,
        },
      });
      const gone = await tx.topic.create({
        data: {
          groupId: gid,
          title: `ארכיון-${sfx}`,
          slug: `gone-${sfx}`,
          authorId: userId,
          deletedAt: new Date(),
        },
      });
      const tag = await tx.tag.create({
        data: { groupId: gid, name: `תג-${sfx}`, slug: `tg-${sfx}` },
      });
      await tx.topicTag.create({ data: { topicId: live.id, tagId: tag.id, groupId: gid } });
      // an edge whose TOPIC end is soft-deleted — must not dangle in a
      // default (live-only) export
      await tx.topicTag.create({ data: { topicId: gone.id, tagId: tag.id, groupId: gid } });
      await tx.internalLink.create({
        data: {
          groupId: gid,
          fromType: "TOPIC",
          fromId: gone.id,
          toType: "NOTE",
          toId: "elsewhere",
          createdById: userId,
        },
      });
    });
  }
});

afterAll(async () => {
  await db?.$disconnect();
});

const dumpA = (includeDeleted = false) =>
  exportGroup(db, { groupId: groupA, actorId: userId, includeDeleted });

describe("exportGroup", () => {
  it("exports the group's own content and nothing from another tenant", async () => {
    const dump = await dumpA();
    expect(dump.group.slug).toBe("exp-a");
    expect(dump.topics.map((t) => t.slug)).toContain("live-a");
    expect(dump.categories.map((c) => c.slug)).toContain("c-a");
    expect(dump.tags.map((t) => t.slug)).toContain("tg-a");
    expect(dump.topicTags.length).toBeGreaterThan(0);

    const serialized = JSON.stringify(dump);
    for (const foreign of ["live-b", "c-b", "tg-b", groupB]) {
      expect(serialized).not.toContain(foreign);
    }
  });

  it("emits no edge pointing at a row the document does not contain", async () => {
    // TopicTag has no deletedAt, so a live-only export would otherwise carry
    // a join row for a soft-deleted topic — dangling on restore.
    const dump = await dumpA();
    const topicIds = new Set(dump.topics.map((t) => t.id));
    const tagIds = new Set(dump.tags.map((t) => t.id));
    for (const tt of dump.topicTags) {
      expect(topicIds.has(tt.topicId)).toBe(true);
      expect(tagIds.has(tt.tagId)).toBe(true);
    }
    for (const l of dump.links) {
      if (l.fromType === "TOPIC") expect(topicIds.has(l.fromId)).toBe(true);
      if (l.toType === "TOPIC") expect(topicIds.has(l.toId)).toBe(true);
    }
    // and the archival copy DOES carry them, now that their topic is present
    const archival = await dumpA(true);
    expect(archival.topicTags.length).toBeGreaterThan(dump.topicTags.length);
  });

  it("carries the ids a restore needs to reattach rows", async () => {
    const dump = await dumpA();
    expect(dump.memberships[0]!.userId).toBe(userId);
    expect(dump.topics[0]!.authorId).toBe(userId);
    expect(dump.group.settingsJson === null || typeof dump.group.settingsJson === "object").toBe(
      true,
    );
  });

  it("omits soft-deleted rows by default and marks them when included", async () => {
    const live = await dumpA();
    expect(live.topics.map((t) => t.slug)).not.toContain("gone-a");

    const archival = await dumpA(true);
    const gone = archival.topics.find((t) => t.slug === "gone-a");
    expect(gone).toBeDefined();
    // an archival copy where live and deleted rows are indistinguishable is
    // not an archival copy
    expect(gone!.deletedAt).not.toBeNull();
  });

  it("records the egress WITHOUT copying emails into the unerasable log", async () => {
    const before = await withGroup(db, groupA, (tx) =>
      tx.activityLog.count({ where: { action: "group.export" } }),
    );
    await dumpA();
    const after = await withGroup(db, groupA, (tx) =>
      tx.activityLog.findMany({
        where: { action: "group.export" },
        select: { actorId: true, entityId: true, metadataJson: true },
      }),
    );
    expect(after.length).toBe(before + 1);
    expect(after.at(-1)!.actorId).toBe(userId);
    expect(after.at(-1)!.entityId).toBe(groupA);
    // ActivityLog has no delete path — it must not become a second copy
    expect(JSON.stringify(after.map((a) => a.metadataJson))).not.toContain("@e.local");
  });

  it("refuses a caller who is not an active member of the group", async () => {
    await expect(
      exportGroup(db, { groupId: groupA, actorId: outsiderId }),
    ).rejects.toThrow(/not an active member/i);
  });
});
