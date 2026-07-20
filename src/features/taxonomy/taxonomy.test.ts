/**
 * Taxonomy (SPEC §4): Topic is the organizing spine; Category is a tree;
 * Tag links via per-type join tables with real FKs. Everything runs under
 * the tenant wall, slugs carry the stable id prefix, and uniqueness binds
 * LIVE rows only (ADR 0002) so an archived topic cannot squat its slug.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { appUrl } from "../../../test/db-url";
import { createClient, type PrismaClient } from "../../platform/db";
import { withGroup } from "../../platform/tenancy";

import { addTagToTopic, createCategory, createTag, createTopic, listTopics } from "./service";

let db: PrismaClient;
let groupA: string, groupB: string, authorId: string;

beforeAll(async () => {
  db = createClient(appUrl());
  groupA = (await db.group.create({ data: { slug: "tax-a", name: "חבורה" } })).id;
  groupB = (await db.group.create({ data: { slug: "tax-b", name: "אחרת" } })).id;
  authorId = (await db.user.create({ data: { email: "author@tax.local" } })).id;
});

afterAll(async () => {
  await db?.$disconnect();
});

describe("topics", () => {
  it("creates a topic with a Hebrew slug carrying its id prefix", async () => {
    const t = await createTopic(db, { groupId: groupA, title: "פסול מחשבה בזבחים", authorId });
    expect(t.slug).toMatch(/^[a-z0-9]+-/); // stable id prefix first
    expect(t.slug).toContain("פסול");
    expect(t.status).toBe("DRAFT");
  });

  it("audits creation in the same transaction", async () => {
    const t = await createTopic(db, { groupId: groupA, title: "שמירת שבת", authorId });
    const audit = await withGroup(db, groupA, (tx) =>
      tx.activityLog.findMany({ where: { entityId: t.id }, select: { action: true } }),
    );
    expect(audit.map((a) => a.action)).toContain("topic.create");
  });

  it("is invisible to another group (tenant wall)", async () => {
    await createTopic(db, { groupId: groupA, title: "נושא פרטי", authorId });
    expect(await listTopics(db, groupB)).toEqual([]);
  });

  it("hides soft-deleted topics and frees the slug for a new row (ADR 0002)", async () => {
    const t = await createTopic(db, { groupId: groupA, title: "נושא זמני", authorId });
    await withGroup(db, groupA, (tx) =>
      tx.topic.update({ where: { id: t.id }, data: { deletedAt: new Date() } }),
    );
    const visible = await listTopics(db, groupA);
    expect(visible.map((x) => x.id)).not.toContain(t.id);
    // an archived row must not squat the slug forever
    const again = await withGroup(db, groupA, (tx) =>
      tx.topic.create({ data: { groupId: groupA, title: "נושא זמני", slug: t.slug, authorId } }),
    );
    expect(again.id).not.toBe(t.id);
  });
});

describe("categories", () => {
  it("nests under a parent", async () => {
    const root = await createCategory(db, { groupId: groupA, name: "קדשים" });
    const child = await createCategory(db, { groupId: groupA, name: "זבחים", parentId: root.id });
    expect(child.parentId).toBe(root.id);
  });

  it("cannot adopt a parent from another group (tenant wall)", async () => {
    const foreign = await createCategory(db, { groupId: groupB, name: "מועד" });
    await expect(
      createCategory(db, { groupId: groupA, name: "פסול", parentId: foreign.id }),
    ).rejects.toThrow();
  });
});

describe("tags", () => {
  it("links a tag to a topic through the join table", async () => {
    const topic = await createTopic(db, { groupId: groupA, title: "נושא מתויג", authorId });
    const tag = await createTag(db, { groupId: groupA, name: "קדשים" });
    await addTagToTopic(db, groupA, topic.id, tag.id);
    const rows = await withGroup(db, groupA, (tx) =>
      tx.topicTag.findMany({ where: { topicId: topic.id } }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].tagId).toBe(tag.id);
  });

  it("tagging twice is idempotent, not an error", async () => {
    const topic = await createTopic(db, { groupId: groupA, title: "נושא כפול", authorId });
    const tag = await createTag(db, { groupId: groupA, name: "מועד" });
    await addTagToTopic(db, groupA, topic.id, tag.id);
    await addTagToTopic(db, groupA, topic.id, tag.id);
    const rows = await withGroup(db, groupA, (tx) =>
      tx.topicTag.findMany({ where: { topicId: topic.id } }),
    );
    expect(rows).toHaveLength(1);
  });
});

describe("category depth (SPEC §4 — a documented invariant must be enforced)", () => {
  it("allows nesting up to MAX_CATEGORY_DEPTH and refuses past it", async () => {
    const d1 = await createCategory(db, { groupId: groupA, name: "עומק א" });
    const d2 = await createCategory(db, { groupId: groupA, name: "עומק ב", parentId: d1.id });
    const d3 = await createCategory(db, { groupId: groupA, name: "עומק ג", parentId: d2.id });
    expect(d3.parentId).toBe(d2.id);
    await expect(
      createCategory(db, { groupId: groupA, name: "עומק ד", parentId: d3.id }),
    ).rejects.toThrow(/MAX_CATEGORY_DEPTH/);
  });
});

describe("concurrency", () => {
  it("simultaneous topic creates do not contend on a shared slug key", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        createTopic(db, { groupId: groupA, title: `במקביל ${i}`, authorId }),
      ),
    );
    expect(new Set(results.map((r) => r.slug)).size).toBe(5);
  });

  it("simultaneous identical tagging yields exactly one link, no throw", async () => {
    const topic = await createTopic(db, { groupId: groupA, title: "מרוץ תיוג", authorId });
    const tag = await createTag(db, { groupId: groupA, name: "מרוץ" });
    await Promise.all([
      addTagToTopic(db, groupA, topic.id, tag.id),
      addTagToTopic(db, groupA, topic.id, tag.id),
      addTagToTopic(db, groupA, topic.id, tag.id),
    ]);
    const rows = await withGroup(db, groupA, (tx) =>
      tx.topicTag.findMany({ where: { topicId: topic.id } }),
    );
    expect(rows).toHaveLength(1);
  });
});
