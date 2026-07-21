/**
 * Summaries and comments (SPEC §4).
 *
 * The property under guard: a discussion has at most ONE canonical summary —
 * the version-of-record a member cites later. Pinning a new one must displace
 * the old one atomically, or the discussion is left with either two answers
 * or none.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { appUrl } from "../../../test/db-url";
import { createClient, type PrismaClient } from "../../platform/db";
import { withGroup } from "../../platform/tenancy";

import { addSummary, createDiscussion, listSummaries, setCanonicalSummary } from "./service";

let db: PrismaClient;
let groupA: string, groupB: string, topicA: string;
let ravId: string, talmidId: string;

beforeAll(async () => {
  db = createClient(appUrl());
  groupA = (await db.group.create({ data: { slug: "sum-a", name: "חבורה" } })).id;
  groupB = (await db.group.create({ data: { slug: "sum-b", name: "אחרת" } })).id;
  ravId = (await db.user.create({ data: { email: "rav@s.local" } })).id;
  talmidId = (await db.user.create({ data: { email: "talmid@s.local" } })).id;
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

  it("pins one summary as the version-of-record and unpins the previous one", async () => {
    const d = await newDiscussion("החלפת סיכום");
    const first = await addSummary(db, {
      groupId: groupA,
      discussionId: d.id,
      authorId: ravId,
      contentText: "גרסה א",
    });
    const second = await addSummary(db, {
      groupId: groupA,
      discussionId: d.id,
      authorId: talmidId,
      contentText: "גרסה ב",
    });

    await setCanonicalSummary(db, groupA, first.id, ravId);
    await setCanonicalSummary(db, groupA, second.id, ravId);

    const rows = await listSummaries(db, groupA, d.id);
    const canonical = rows.filter((r) => r.isCanonical);
    expect(canonical.map((r) => r.id)).toEqual([second.id]);
    // and the displaced one is still THERE — pinning replaces the pin, not
    // the earlier attempt to summarize
    expect(rows).toHaveLength(2);
  });

  it("sorts the canonical summary to the top of the list", async () => {
    const d = await newDiscussion("סדר תצוגה");
    await addSummary(db, {
      groupId: groupA,
      discussionId: d.id,
      authorId: ravId,
      contentText: "ישן",
    });
    const later = await addSummary(db, {
      groupId: groupA,
      discussionId: d.id,
      authorId: ravId,
      contentText: "נבחר",
    });
    await setCanonicalSummary(db, groupA, later.id, ravId);

    const rows = await listSummaries(db, groupA, d.id);
    expect(rows[0].contentText).toBe("נבחר");
  });

  it("refuses a second canonical summary written behind the service's back", async () => {
    // The service unpins before it pins, so it can never trip this itself.
    // The index is here for the read-then-write race between two people
    // pinning at once — which no service-layer check can close.
    const d = await newDiscussion("מרוץ");
    const a = await addSummary(db, {
      groupId: groupA,
      discussionId: d.id,
      authorId: ravId,
      contentText: "א",
    });
    await setCanonicalSummary(db, groupA, a.id, ravId);
    const b = await addSummary(db, {
      groupId: groupA,
      discussionId: d.id,
      authorId: ravId,
      contentText: "ב",
    });
    await expect(
      withGroup(db, groupA, (tx) =>
        tx.summary.update({ where: { id: b.id }, data: { isCanonical: true } }),
      ),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("lets a soft-deleted canonical summary be replaced", async () => {
    // The partial index is scoped `WHERE deletedAt IS NULL`. Were it not,
    // retracting a summary would permanently burn the discussion's one slot
    // and nothing could ever be pinned again.
    const d = await newDiscussion("סיכום שנמחק");
    const gone = await addSummary(db, {
      groupId: groupA,
      discussionId: d.id,
      authorId: ravId,
      contentText: "הוסר",
    });
    await setCanonicalSummary(db, groupA, gone.id, ravId);
    await withGroup(db, groupA, (tx) =>
      tx.summary.update({ where: { id: gone.id }, data: { deletedAt: new Date() } }),
    );

    const replacement = await addSummary(db, {
      groupId: groupA,
      discussionId: d.id,
      authorId: ravId,
      contentText: "חדש",
    });
    // Pinned DIRECTLY, not through the service: the service unpins first via
    // updateMany, which is not soft-delete filtered and would clear the
    // tombstone's flag anyway — so routing through it would prove nothing.
    await expect(
      withGroup(db, groupA, (tx) =>
        tx.summary.update({ where: { id: replacement.id }, data: { isCanonical: true } }),
      ),
    ).resolves.toMatchObject({ isCanonical: true });
  });

  it("checks the target BEFORE unpinning, so a bad id changes nothing", async () => {
    // Guard-before-unpin ordering only — NOT atomicity; a pure transaction
    // split still passes this, because the guard throws first. The rollback
    // itself is covered by the next test.
    const d = await newDiscussion("כישלון בהצמדה");
    const standing = await addSummary(db, {
      groupId: groupA,
      discussionId: d.id,
      authorId: ravId,
      contentText: "הקיים",
    });
    await setCanonicalSummary(db, groupA, standing.id, ravId);

    const retracted = await addSummary(db, {
      groupId: groupA,
      discussionId: d.id,
      authorId: ravId,
      contentText: "נסוג",
    });
    await withGroup(db, groupA, (tx) =>
      tx.summary.update({ where: { id: retracted.id }, data: { deletedAt: new Date() } }),
    );

    await expect(setCanonicalSummary(db, groupA, retracted.id, ravId)).rejects.toThrow(
      "summary not found in this group",
    );
    const rows = await listSummaries(db, groupA, d.id);
    expect(rows.filter((r) => r.isCanonical).map((r) => r.id)).toEqual([standing.id]);
  });

  it("rolls the unpin back when the pin itself fails — never zero canonical", async () => {
    // The real atomicity test. The unpin succeeds, then the pin is forced to
    // fail; if the two were not in one transaction the discussion would be
    // left with NO version of record. Injected at the client rather than by
    // editing the service, so it tests the shipped code path.
    const d = await newDiscussion("גלגול לאחור");
    const standing = await addSummary(db, {
      groupId: groupA,
      discussionId: d.id,
      authorId: ravId,
      contentText: "הקיים",
    });
    await setCanonicalSummary(db, groupA, standing.id, ravId);
    const candidate = await addSummary(db, {
      groupId: groupA,
      discussionId: d.id,
      authorId: ravId,
      contentText: "מועמד",
    });

    const failing = db.$extends({
      query: {
        summary: {
          update() {
            throw new Error("injected failure after the unpin");
          },
        },
      },
    }) as unknown as PrismaClient;

    await expect(setCanonicalSummary(failing, groupA, candidate.id, ravId)).rejects.toThrow(
      "injected failure",
    );
    const rows = await listSummaries(db, groupA, d.id);
    expect(rows.filter((r) => r.isCanonical).map((r) => r.id)).toEqual([standing.id]);
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

  it("cannot pin a summary belonging to another group", async () => {
    const d = await newDiscussion("שלי");
    const mine = await addSummary(db, {
      groupId: groupA,
      discussionId: d.id,
      authorId: ravId,
      contentText: "שלי",
    });
    await expect(setCanonicalSummary(db, groupB, mine.id, ravId)).rejects.toThrow(
      "summary not found in this group",
    );
    // and it is untouched
    const rows = await listSummaries(db, groupA, d.id);
    expect(rows.find((r) => r.id === mine.id)?.isCanonical).toBe(false);
  });
});

