/**
 * Comments on contributions (SPEC §4).
 *
 * V1 keeps them flat text. The property worth guarding is that a thread stays
 * a thread: a reply's parent must live on the SAME contribution, or the tree
 * silently sprouts orphans that no query would flag.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { appUrl } from "../../../test/db-url";
import { createClient, type PrismaClient } from "../../platform/db";
import { withGroup } from "../../platform/tenancy";

import { addComment, addContribution, createDiscussion, listComments } from "./service";

let db: PrismaClient;
let groupA: string, groupB: string, topicA: string;
let ravId: string, talmidId: string;

beforeAll(async () => {
  db = createClient(appUrl());
  groupA = (await db.group.create({ data: { slug: "cmt-a", name: "חבורה" } })).id;
  groupB = (await db.group.create({ data: { slug: "cmt-b", name: "אחרת" } })).id;
  ravId = (await db.user.create({ data: { email: "rav@c.local" } })).id;
  talmidId = (await db.user.create({ data: { email: "talmid@c.local" } })).id;
  // Must go through withGroup: RLS is FORCEd, so a bare create has no tenant
  // context and is refused outright.
  topicA = (
    await withGroup(db, groupA, (tx) =>
      tx.topic.create({ data: { groupId: groupA, title: "נושא", slug: "c-a", authorId: ravId } }),
    )
  ).id;
});

afterAll(async () => {
  await db?.$disconnect();
});

const newDiscussion = (title: string) =>
  createDiscussion(db, { groupId: groupA, topicId: topicA, title, authorId: ravId });

describe("comments", () => {
  let seq = 0;
  const seedContribution = async () => {
    const d = await newDiscussion(`הערות ${++seq}`);
    const c = await addContribution(db, {
      groupId: groupA,
      discussionId: d.id,
      authorId: ravId,
      createdById: ravId,
      contentText: "דברי הרב",
    });
    return c;
  };

  it("threads replies under a contribution in the order they were written", async () => {
    const c = await seedContribution();
    for (const body of ["ראשון", "שני", "שלישי"]) {
      await addComment(db, {
        groupId: groupA,
        contributionId: c.id,
        authorId: talmidId,
        body,
      });
    }
    const rows = await listComments(db, groupA, c.id);
    expect(rows.map((r) => r.body)).toEqual(["ראשון", "שני", "שלישי"]);
  });

  it("records a reply-to-a-reply", async () => {
    const c = await seedContribution();
    const parent = await addComment(db, {
      groupId: groupA,
      contributionId: c.id,
      authorId: talmidId,
      body: "שאלה",
    });
    const child = await addComment(db, {
      groupId: groupA,
      contributionId: c.id,
      authorId: ravId,
      body: "תשובה",
      parentCommentId: parent.id,
    });
    const rows = await listComments(db, groupA, c.id);
    expect(rows.find((r) => r.id === child.id)?.parentCommentId).toBe(parent.id);
  });

  it("refuses a reply whose parent lives on a different contribution", async () => {
    // Same tenant, wrong thread. Without the composite FK on (parent,
    // contribution) this is accepted, and listComments then returns a reply
    // whose parent is not in the result — an orphan with nothing going red.
    const a = await seedContribution();
    const b = await seedContribution();
    const parent = await addComment(db, {
      groupId: groupA,
      contributionId: a.id,
      authorId: ravId,
      body: "שייך לאחד",
    });
    await expect(
      addComment(db, {
        groupId: groupA,
        contributionId: b.id,
        authorId: ravId,
        body: "מצביע לשני",
        parentCommentId: parent.id,
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });

  it("does not read another group's comments", async () => {
    const c = await seedContribution();
    await addComment(db, { groupId: groupA, contributionId: c.id, authorId: ravId, body: "פנימי" });
    expect(await listComments(db, groupA, c.id)).toHaveLength(1);
    expect(await listComments(db, groupB, c.id)).toEqual([]);
  });

  it("rejects an empty or whitespace-only comment", async () => {
    const c = await seedContribution();
    await expect(
      addComment(db, { groupId: groupA, contributionId: c.id, authorId: ravId, body: "   \n " }),
    ).rejects.toThrow("empty");
    expect(await listComments(db, groupA, c.id)).toHaveLength(0);
  });

  it("cannot comment on another group's contribution", async () => {
    const c = await seedContribution();
    // P2003 specifically: the composite FK refuses it at the DB, which is the
    // wall we mean. A bare toThrow() would also accept a TypeError.
    await expect(
      addComment(db, { groupId: groupB, contributionId: c.id, authorId: ravId, body: "פלישה" }),
    ).rejects.toMatchObject({ code: "P2003" });
  });
});
