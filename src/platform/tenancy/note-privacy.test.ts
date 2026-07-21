/**
 * SPEC §6: a PRIVATE note is author-only for EVERYONE — the group owner
 * included. §10.2 makes it a launch gate: "PRIVATE note invisible to any
 * other user in UI **and** search."
 *
 * That is not a capability anyone can be granted, so it is not in can(). It
 * is enforced in the RLS policy (ADR 0004), which means these tests talk to
 * Postgres as the NON-SUPERUSER app role (appUrl) — RLS never binds a
 * superuser, so testing as one would pass without proving anything.
 *
 * This suite proves the DATABASE half of §10.2 only. The "and search" half is
 * not met: no SearchService exists, and when it does it inherits this policy
 * only if it goes through withGroup WITH a viewer. Do not mark §10.2 done on
 * the strength of this file.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { appUrl } from "../../../test/db-url";
import { createClient, type PrismaClient } from "../db";

import { withGroup } from "./index";

let db: PrismaClient;
let groupA: string, groupB: string;
let author: string, otherMember: string, owner: string;

beforeAll(async () => {
  db = createClient(appUrl());
  const s = Date.now();
  groupA = (await db.group.create({ data: { slug: `np-a-${s}`, name: "חבורה" } })).id;
  groupB = (await db.group.create({ data: { slug: `np-b-${s}`, name: "אחרת" } })).id;
  author = (await db.user.create({ data: { email: `np-author-${s}@t.local` } })).id;
  otherMember = (await db.user.create({ data: { email: `np-other-${s}@t.local` } })).id;
  owner = (await db.user.create({ data: { email: `np-owner-${s}@t.local` } })).id;
});

afterAll(async () => {
  await db?.$disconnect();
});

/** Written as the author, which the policy requires for a PRIVATE row. */
const writeNote = (groupId: string, authorId: string, visibility: "PRIVATE" | "GROUP", title: string) =>
  withGroup(
    db,
    groupId,
    (tx) => tx.note.create({ data: { groupId, authorId, visibility, title } }),
    { viewerId: authorId },
  );

const readAs = (groupId: string, viewerId: string | undefined, noteId: string) =>
  withGroup(db, groupId, (tx) => tx.note.findFirst({ where: { id: noteId } }), { viewerId });

describe("PRIVATE notes are author-only, enforced by Postgres", () => {
  it("the author can read their own private note", async () => {
    // Positive control. Without it, every assertion below would be satisfied
    // by a policy that simply hides everything from everyone.
    const note = await writeNote(groupA, author, "PRIVATE", "מחשבה פרטית");
    expect(await readAs(groupA, author, note.id)).not.toBeNull();
  });

  it("another member of the same group cannot", async () => {
    const note = await writeNote(groupA, author, "PRIVATE", "לא לעיניים");
    expect(await readAs(groupA, otherMember, note.id)).toBeNull();
  });

  it("the group OWNER cannot either — the rule outranks every role", async () => {
    // The one that makes this a policy rather than a can() check: there is no
    // role that unlocks it, so no future capability grant can widen it.
    const note = await writeNote(groupA, author, "PRIVATE", "גם לא לבעלים");
    expect(await readAs(groupA, owner, note.id)).toBeNull();
  });

  it("a query with NO viewer sees no private notes — fail-closed", async () => {
    const note = await writeNote(groupA, author, "PRIVATE", "ללא צופה");
    expect(await readAs(groupA, undefined, note.id)).toBeNull();
  });

  it("a GROUP note is visible to any member of that group", async () => {
    const note = await writeNote(groupA, author, "GROUP", "לכולם");
    expect(await readAs(groupA, otherMember, note.id)).not.toBeNull();
    expect(await readAs(groupA, owner, note.id)).not.toBeNull();
  });

  it("a GROUP note is still invisible to another tenant", async () => {
    // Privacy must not have quietly replaced the tenant wall.
    const note = await writeNote(groupA, author, "GROUP", "של החבורה");
    expect(await readAs(groupB, author, note.id)).toBeNull();
  });

  it("hides private notes from list reads, not just by-id lookups", async () => {
    // findFirst({where:{id}}) is the easy case. A list is what actually ships
    // in a UI, and it is where a missing filter would leak in bulk.
    const mine = await writeNote(groupA, otherMember, "PRIVATE", "שלי בלבד");
    const theirs = await writeNote(groupA, author, "PRIVATE", "שלהם בלבד");
    const shared = await writeNote(groupA, author, "GROUP", "משותף");

    const visible = await withGroup(db, groupA, (tx) => tx.note.findMany(), {
      viewerId: otherMember,
    });
    const ids = visible.map((n) => n.id);
    expect(ids).toContain(mine.id);
    expect(ids).toContain(shared.id);
    expect(ids).not.toContain(theirs.id);
  });

  it("refuses to WRITE a private note attributed to someone else", async () => {
    // Otherwise a member could plant a row that its supposed author can see
    // and nobody can trace. Matched on the message, not a bare toThrow():
    // a validation error or a renamed enum member would satisfy that too.
    await expect(
      withGroup(
        db,
        groupA,
        (tx) => tx.note.create({ data: { groupId: groupA, authorId: author, visibility: "PRIVATE", title: "שתול" } }),
        { viewerId: otherMember },
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("shows nothing at all to a client with no tenant context", async () => {
    // Outside withGroup entirely: neither setting is present, so both halves
    // of the policy fail. The blunt fail-closed case.
    await writeNote(groupA, author, "GROUP", "מחוץ להקשר");
    expect(await db.note.findMany()).toEqual([]);
  });

  it("hides a private note's TAG LINKS from other members", async () => {
    // Verified to leak before the NoteTag policy carried the same predicate:
    // a tenant-only policy let any member list the join rows of someone
    // else's private note, learning that it exists and what it is tagged.
    // The composite FK does not help — Postgres validates FKs with row
    // security OFF, which is why the composite keys exist in the first place.
    const secret = await writeNote(groupA, author, "PRIVATE", "מתויג בסוד");
    const shared = await writeNote(groupA, author, "GROUP", "מתויג בגלוי");
    const tag = await withGroup(db, groupA, (tx) =>
      tx.tag.create({ data: { groupId: groupA, name: "תג", slug: `nt-${Date.now()}` } }),
    );
    await withGroup(
      db,
      groupA,
      (tx) =>
        tx.noteTag.createMany({
          data: [
            { noteId: secret.id, tagId: tag.id, groupId: groupA },
            { noteId: shared.id, tagId: tag.id, groupId: groupA },
          ],
        }),
      { viewerId: author },
    );

    const authorSees = await withGroup(db, groupA, (tx) => tx.noteTag.findMany(), {
      viewerId: author,
    });
    expect(authorSees).toHaveLength(2); // positive control

    const otherSees = await withGroup(db, groupA, (tx) => tx.noteTag.findMany(), {
      viewerId: otherMember,
    });
    expect(otherSees.map((r) => r.noteId)).toEqual([shared.id]);
  });

  it("refuses to tag — or UNTAG — another member's private note", async () => {
    // Untagging is the destructive half and was the worse leak: it needed no
    // read access at all, so a member could quietly strip another member's
    // private note of its tags.
    const secret = await writeNote(groupA, author, "PRIVATE", "אל תיגע בתגים");
    const tag = await withGroup(db, groupA, (tx) =>
      tx.tag.create({ data: { groupId: groupA, name: "תג2", slug: `nt2-${Date.now()}` } }),
    );
    await withGroup(
      db,
      groupA,
      (tx) => tx.noteTag.create({ data: { noteId: secret.id, tagId: tag.id, groupId: groupA } }),
      { viewerId: author },
    );

    await expect(
      withGroup(
        db,
        groupA,
        (tx) => tx.noteTag.create({ data: { noteId: secret.id, tagId: tag.id, groupId: groupA } }),
        { viewerId: otherMember },
      ),
    ).rejects.toThrow();

    const removed = await withGroup(
      db,
      groupA,
      (tx) => tx.noteTag.deleteMany({ where: { noteId: secret.id } }),
      { viewerId: otherMember },
    );
    expect(removed.count).toBe(0);

    const survivors = await withGroup(
      db,
      groupA,
      (tx) => tx.noteTag.findMany({ where: { noteId: secret.id } }),
      { viewerId: author },
    );
    expect(survivors).toHaveLength(1);
  });

  it("cannot be updated or deleted by a non-author", async () => {
    // Invisible must also mean untouchable: the policy is FOR ALL, so a blind
    // updateMany/deleteMany must match zero rows rather than silently work.
    const note = await writeNote(groupA, author, "PRIVATE", "לא לגעת");
    const updated = await withGroup(
      db,
      groupA,
      (tx) => tx.note.updateMany({ where: { id: note.id }, data: { title: "נחטף" } }),
      { viewerId: otherMember },
    );
    expect(updated.count).toBe(0);

    const stillThere = await readAs(groupA, author, note.id);
    expect(stillThere?.title).toBe("לא לגעת");
  });
});
