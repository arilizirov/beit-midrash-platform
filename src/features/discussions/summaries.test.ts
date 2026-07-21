/**
 * Summaries and comments (SPEC §4).
 *
 * Recording summaries. A discussion may carry several: drafts, a rav's
 * write-up, an AI first pass. Choosing WHICH one is the version of record is
 * a separate capability and lands in the next slice.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { appUrl } from "../../../test/db-url";
import { createClient, type PrismaClient } from "../../platform/db";
import { withGroup } from "../../platform/tenancy";

import { addSummary, createDiscussion, listSummaries } from "./service";

let db: PrismaClient;
let groupA: string, groupB: string, topicA: string;
let ravId: string;

beforeAll(async () => {
  db = createClient(appUrl());
  groupA = (await db.group.create({ data: { slug: "sum-a", name: "חבורה" } })).id;
  groupB = (await db.group.create({ data: { slug: "sum-b", name: "אחרת" } })).id;
  ravId = (await db.user.create({ data: { email: "rav@s.local" } })).id;
  topicA = (
    await withGroup(db, groupA, (tx) =>
      tx.topic.create({ data: { groupId: groupA, title: "נושא", slug: "s-a", authorId: ravId } }),
    )
  ).id;
});

afterAll(async () => {
  await db?.$disconnect();
});

const newDiscussion = (title: string) =>
  createDiscussion(db, { groupId: groupA, topicId: topicA, title, authorId: ravId });

describe("summaries", () => {
  it("records a summary and marks whether a person or the AI wrote it", async () => {
    // SPEC §5: AI output is always labelled. If this attribution is lost, a
    // machine paraphrase becomes indistinguishable from the rav's own words.
    const d = await newDiscussion("סיכום ראשון");
    await addSummary(db, {
      groupId: groupA,
      discussionId: d.id,
      authorId: ravId,
      contentText: "מסקנת החבורה",
    });
    await addSummary(db, {
      groupId: groupA,
      discussionId: d.id,
      authorId: ravId,
      contentText: "טיוטה אוטומטית",
      generatedByAI: true,
    });

    const rows = await listSummaries(db, groupA, d.id);
    expect(rows.map((r) => r.generatedByAI).sort()).toEqual([false, true]);
    const audit = await withGroup(db, groupA, (tx) =>
      tx.activityLog.findMany({ where: { action: "summary.create", entityId: rows[0].id } }),
    );
    expect(audit).toHaveLength(1);
  });

  it("files a summary under its discussion's own topic, not one the caller names", async () => {
    // topicId is denormalized for the topic page. If it were caller-supplied,
    // a summary could surface under a topic its discussion has nothing to do
    // with.
    const d = await newDiscussion("נושא נגזר");
    const s = await addSummary(db, {
      groupId: groupA,
      discussionId: d.id,
      authorId: ravId,
      contentText: "תוכן",
    });
    const row = await withGroup(db, groupA, (tx) =>
      tx.summary.findFirstOrThrow({ where: { id: s.id }, select: { topicId: true } }),
    );
    expect(row.topicId).toBe(topicA);
  });

  it("refuses a summary with no content at all", async () => {
    const d = await newDiscussion("ריק");
    await expect(
      addSummary(db, { groupId: groupA, discussionId: d.id, authorId: ravId, contentText: "  " }),
    ).rejects.toThrow("must have content");
  });

  it("cannot summarize another group's discussion", async () => {
    const d = await newDiscussion("שלי לסיכום");
    await expect(
      addSummary(db, { groupId: groupB, discussionId: d.id, authorId: ravId, contentText: "פלישה" }),
    ).rejects.toThrow("discussion not found in this group");
  });

  it("does not read another group's summaries", async () => {
    const d = await newDiscussion("קיר קריאה");
    await addSummary(db, {
      groupId: groupA,
      discussionId: d.id,
      authorId: ravId,
      contentText: "פנימי",
    });
    // Positive control first: without it, an empty result proves nothing.
    expect(await listSummaries(db, groupA, d.id)).toHaveLength(1);
    expect(await listSummaries(db, groupB, d.id)).toEqual([]);
  });
});
