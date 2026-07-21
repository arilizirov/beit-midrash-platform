/**
 * Discussion core (SPEC §4). The property worth most care here is the
 * author/scribe split: in a real chevruta one person routinely writes down
 * what another said, and the system must not quietly attribute those words
 * to whoever typed them.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { appUrl } from "../../../test/db-url";
import { createClient, type PrismaClient } from "../../platform/db";
import { withGroup } from "../../platform/tenancy";

import {
  addContribution,
  canEditContribution,
  createDiscussion,
  listContributions,
  listDiscussions,
  setDiscussionStatus,
} from "./service";

let db: PrismaClient;
let groupA: string, groupB: string, topicA: string, topicB: string;
let ravId: string, scribeId: string, otherId: string;

beforeAll(async () => {
  db = createClient(appUrl());
  groupA = (await db.group.create({ data: { slug: "dsc-a", name: "חבורה" } })).id;
  groupB = (await db.group.create({ data: { slug: "dsc-b", name: "אחרת" } })).id;
  ravId = (await db.user.create({ data: { email: "rav@d.local" } })).id;
  scribeId = (await db.user.create({ data: { email: "scribe@d.local" } })).id;
  otherId = (await db.user.create({ data: { email: "other@d.local" } })).id;
  topicA = (
    await withGroup(db, groupA, (tx) =>
      tx.topic.create({ data: { groupId: groupA, title: "נושא", slug: "t-a", authorId: ravId } }),
    )
  ).id;
  topicB = (
    await withGroup(db, groupB, (tx) =>
      tx.topic.create({ data: { groupId: groupB, title: "נושא", slug: "t-b", authorId: ravId } }),
    )
  ).id;
});

afterAll(async () => {
  await db?.$disconnect();
});

describe("discussions", () => {
  it("opens a discussion under its topic and audits it", async () => {
    const d = await createDiscussion(db, {
      groupId: groupA,
      topicId: topicA,
      title: "מה פשר המחלוקת?",
      authorId: ravId,
    });
    expect(d.status).toBe("DRAFT");
    const audit = await withGroup(db, groupA, (tx) =>
      tx.activityLog.findMany({ where: { entityId: d.id }, select: { action: true } }),
    );
    expect(audit.map((a) => a.action)).toContain("discussion.create");
  });

  it("cannot be opened under another group's topic", async () => {
    // The composite FK makes this unexpressible in the database, not merely
    // discouraged in the service.
    await expect(
      createDiscussion(db, {
        groupId: groupA,
        topicId: topicB,
        title: "גנוב",
        authorId: ravId,
      }),
    ).rejects.toThrow();
  });

  it("is invisible across the tenant wall", async () => {
    const mine = await listDiscussions(db, groupA, topicA);
    expect(mine.length).toBeGreaterThan(0); // positive control first
    expect(await listDiscussions(db, groupB, topicA)).toEqual([]);
  });

  it("moves through its lifecycle", async () => {
    const d = await createDiscussion(db, {
      groupId: groupA,
      topicId: topicA,
      title: "לשאלה",
      authorId: ravId,
    });
    const opened = await setDiscussionStatus(db, groupA, d.id, "OPEN", ravId);
    expect(opened.status).toBe("OPEN");
    const resolved = await setDiscussionStatus(db, groupA, d.id, "RESOLVED", ravId);
    expect(resolved.status).toBe("RESOLVED");
  });
});

describe("contributions — whose opinion vs who typed it", () => {
  it("records the author and the scribe separately", async () => {
    const d = await createDiscussion(db, {
      groupId: groupA,
      topicId: topicA,
      title: "דעות",
      authorId: ravId,
    });
    // the scribe writes down what the Rav said
    const c = await addContribution(db, {
      groupId: groupA,
      discussionId: d.id,
      authorId: ravId,
      createdById: scribeId,
      contentText: "כך אמר הרב",
    });
    expect(c.authorId).toBe(ravId);
    expect(c.createdById).toBe(scribeId);
  });

  it("gives edit rights to the scribe, not the person quoted", async () => {
    // SPEC §4: "edit own" checks createdById. Otherwise the Rav could edit
    // words he never typed, and the scribe could not fix his own transcription.
    const opinion = { authorId: ravId, createdById: scribeId };
    expect(canEditContribution(opinion, scribeId)).toBe(true);
    expect(canEditContribution(opinion, ravId)).toBe(false);
    expect(canEditContribution(opinion, otherId)).toBe(false);
  });

  it("keeps contributions in explicit order", async () => {
    const d = await createDiscussion(db, {
      groupId: groupA,
      topicId: topicA,
      title: "סדר",
      authorId: ravId,
    });
    for (const text of ["ראשון", "שני", "שלישי"]) {
      await addContribution(db, {
        groupId: groupA,
        discussionId: d.id,
        authorId: ravId,
        createdById: scribeId,
        contentText: text,
      });
    }
    const rows = await listContributions(db, groupA, d.id);
    expect(rows.map((r) => r.contentText)).toEqual(["ראשון", "שני", "שלישי"]);
    expect(rows.map((r) => r.position)).toEqual([0, 1, 2]);
  });

  it("cannot attach to another group's discussion", async () => {
    const d = await createDiscussion(db, {
      groupId: groupA,
      topicId: topicA,
      title: "שלי",
      authorId: ravId,
    });
    await expect(
      addContribution(db, {
        groupId: groupB,
        discussionId: d.id,
        authorId: ravId,
        createdById: scribeId,
        contentText: "פלישה",
      }),
    ).rejects.toThrow();
  });
});
