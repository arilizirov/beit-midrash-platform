/**
 * Notes service, MUTATION half (SPEC §4). The property this suite protects
 * above all others: a member cannot launder another member's note into their
 * own private one. That attack was VERIFIED to work at the DB level if the
 * service lets authorId be reassigned (F5b probe) — so the service never does,
 * and these tests hold it to that.
 *
 * A separate file from notes.test.ts on purpose: that one owns create/read,
 * this one owns mutation. Splitting the FEATURE across two stacked PRs must not
 * split a single test file, or the second PR's copy silently deletes the
 * first's coverage on merge.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { appUrl } from "../../../test/db-url";
import { createClient, type PrismaClient } from "../../platform/db";
import { withGroup } from "../../platform/tenancy";

import { addNote, deleteNote, getNote, updateNote } from "./service";

let db: PrismaClient;
let groupA: string;
let author: string, member: string, editor: string;

beforeAll(async () => {
  db = createClient(appUrl());
  const s = Date.now();
  groupA = (await db.group.create({ data: { slug: `nm-a-${s}`, name: "חבורה" } })).id;
  author = (await db.user.create({ data: { email: `m-author-${s}@t.local` } })).id;
  member = (await db.user.create({ data: { email: `m-member-${s}@t.local` } })).id;
  editor = (await db.user.create({ data: { email: `m-editor-${s}@t.local` } })).id;
});

afterAll(async () => {
  await db?.$disconnect();
});

describe("author-laundering is inexpressible", () => {
  it("updateNote ignores an attempt to reassign authorId", async () => {
    // The full attack: take a GROUP note, become its author, turn it PRIVATE.
    // The service must not let step one happen. `authorId` is not an accepted
    // field, so even a caller who passes it changes nothing.
    const note = await addNote(db, {
      groupId: groupA,
      authorId: author,
      visibility: "GROUP",
      title: "יעד",
    });
    await updateNote(db, {
      groupId: groupA,
      noteId: note.id,
      actorId: member,
      canModerate: true,
      // @ts-expect-error authorId is deliberately not part of the update input
      authorId: member,
      title: "נערך",
    });
    const after = await getNote(db, groupA, note.id, author);
    expect(after?.authorId).toBe(author);
  });

  it("refuses a non-author's flip of a GROUP note to PRIVATE (clean error)", async () => {
    // The service pre-checks this so a moderator gets a legible message rather
    // than a raw DB error. The DB backstop is proven separately in
    // note-privacy.test.ts.
    const note = await addNote(db, {
      groupId: groupA,
      authorId: author,
      visibility: "GROUP",
      title: "לא שלך להסתיר",
    });
    await expect(
      updateNote(db, {
        groupId: groupA,
        noteId: note.id,
        actorId: member,
        canModerate: true,
        visibility: "PRIVATE",
      }),
    ).rejects.toThrow("only the author can make a note private");
    expect((await getNote(db, groupA, note.id, member))?.visibility).toBe("GROUP");
  });

  it("the author CAN turn their own note private", async () => {
    const note = await addNote(db, {
      groupId: groupA,
      authorId: author,
      visibility: "GROUP",
      title: "שלי להסתיר",
    });
    const updated = await updateNote(db, {
      groupId: groupA,
      noteId: note.id,
      actorId: author,
      visibility: "PRIVATE",
    });
    expect(updated.visibility).toBe("PRIVATE");
    // and now nobody else can see it
    expect(await getNote(db, groupA, note.id, member)).toBeNull();
  });
});

describe("edit permissions", () => {
  it("a plain member cannot edit another member's GROUP note", async () => {
    const note = await addNote(db, {
      groupId: groupA,
      authorId: author,
      visibility: "GROUP",
      title: "של המחבר",
    });
    await expect(
      updateNote(db, { groupId: groupA, noteId: note.id, actorId: member, title: "פלישה" }),
    ).rejects.toThrow("not allowed to edit");
  });

  it("an editor (canModerate) can edit another member's GROUP note", async () => {
    const note = await addNote(db, {
      groupId: groupA,
      authorId: author,
      visibility: "GROUP",
      title: "מקורי",
    });
    const updated = await updateNote(db, {
      groupId: groupA,
      noteId: note.id,
      actorId: editor,
      canModerate: true,
      title: "מתוקן",
    });
    expect(updated.title).toBe("מתוקן");
  });

  it("even an editor cannot reach another member's PRIVATE note", async () => {
    // canModerate is irrelevant: the DB never hands the row over, so the
    // service's own findFirst returns nothing and refuses.
    const note = await addNote(db, {
      groupId: groupA,
      authorId: author,
      visibility: "PRIVATE",
      title: "סוד",
    });
    await expect(
      updateNote(db, {
        groupId: groupA,
        noteId: note.id,
        actorId: editor,
        canModerate: true,
        title: "חדירה",
      }),
    ).rejects.toThrow("note not found");
  });

  it("a content-only edit leaves visibility untouched", async () => {
    // Prisma treats an undefined field as "don't change". If updateNote ever
    // passed visibility unconditionally, a plain title edit of a PRIVATE note
    // would silently reset it to the default and expose it.
    const note = await addNote(db, { groupId: groupA, authorId: author, title: "פרטי" });
    expect(note.visibility).toBe("PRIVATE");
    await updateNote(db, { groupId: groupA, noteId: note.id, actorId: author, title: "פרטי ערוך" });
    // still invisible to another member
    expect(await getNote(db, groupA, note.id, member)).toBeNull();
    expect((await getNote(db, groupA, note.id, author))?.visibility).toBe("PRIVATE");
  });
});

describe("deleteNote", () => {
  it("soft-deletes and hides the note from later reads", async () => {
    const note = await addNote(db, { groupId: groupA, authorId: author, title: "למחיקה" });
    await deleteNote(db, { groupId: groupA, noteId: note.id, actorId: author });
    expect(await getNote(db, groupA, note.id, author)).toBeNull();
    // the tombstone is really there, just filtered
    const raw = await withGroup(
      db,
      groupA,
      (tx) => tx.note.findFirst({ where: { id: note.id, deletedAt: {} } }),
      { viewerId: author },
    );
    expect(raw?.deletedAt).not.toBeNull();
  });

  it("a plain member cannot delete another member's note", async () => {
    const note = await addNote(db, {
      groupId: groupA,
      authorId: author,
      visibility: "GROUP",
      title: "לא שלך",
    });
    await expect(
      deleteNote(db, { groupId: groupA, noteId: note.id, actorId: member }),
    ).rejects.toThrow("not allowed to delete");
  });
});
