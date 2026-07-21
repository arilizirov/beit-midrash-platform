/**
 * Notes service, create + read half (SPEC §4). The mutation half (edit,
 * delete, and the author-laundering guard that is the point of the whole
 * feature) lands in the stacked slice behind this one.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { appUrl } from "../../../test/db-url";
import { createClient, type PrismaClient } from "../../platform/db";
import { withGroup } from "../../platform/tenancy";

import { addNote, getNote, listNotes } from "./service";

let db: PrismaClient;
let groupA: string, groupB: string;
let author: string, member: string;

beforeAll(async () => {
  db = createClient(appUrl());
  const s = Date.now();
  groupA = (await db.group.create({ data: { slug: `nt-a-${s}`, name: "חבורה" } })).id;
  groupB = (await db.group.create({ data: { slug: `nt-b-${s}`, name: "אחרת" } })).id;
  author = (await db.user.create({ data: { email: `n-author-${s}@t.local` } })).id;
  member = (await db.user.create({ data: { email: `n-member-${s}@t.local` } })).id;
});

afterAll(async () => {
  await db?.$disconnect();
});

describe("addNote", () => {
  it("defaults to PRIVATE and records the visibility in the audit", async () => {
    const note = await addNote(db, { groupId: groupA, authorId: author, title: "טיוטה" });
    expect(note.visibility).toBe("PRIVATE");
    const audit = await withGroup(
      db,
      groupA,
      (tx) => tx.activityLog.findMany({ where: { entityId: note.id, action: "note.create" } }),
      { viewerId: author },
    );
    expect(audit).toHaveLength(1);
    expect(JSON.stringify(audit[0].metadataJson)).toContain("PRIVATE");
  });

  it("stores a GROUP note when asked", async () => {
    const note = await addNote(db, {
      groupId: groupA,
      authorId: author,
      visibility: "GROUP",
      title: "לכולם",
    });
    expect(note.visibility).toBe("GROUP");
    // another member can read it
    expect(await getNote(db, groupA, note.id, member)).not.toBeNull();
  });
});

describe("listNotes", () => {
  it("shows a viewer their own private notes plus every group note, newest first", async () => {
    const s = Date.now();
    const g = (await db.group.create({ data: { slug: `nl-${s}`, name: "ל" } })).id;
    const mine = await addNote(db, { groupId: g, authorId: member, title: "שלי" });
    const theirsPrivate = await addNote(db, { groupId: g, authorId: author, title: "שלהם" });
    const shared = await addNote(db, { groupId: g, authorId: author, visibility: "GROUP", title: "משותף" });

    const ids = (await listNotes(db, g, member)).map((n) => n.id);
    expect(ids).toContain(mine.id);
    expect(ids).toContain(shared.id);
    expect(ids).not.toContain(theirsPrivate.id);
  });

  it("does not cross the tenant wall", async () => {
    const note = await addNote(db, {
      groupId: groupA,
      authorId: author,
      visibility: "GROUP",
      title: "של א",
    });
    const ids = (await listNotes(db, groupB, author)).map((n) => n.id);
    expect(ids).not.toContain(note.id);
  });
});
