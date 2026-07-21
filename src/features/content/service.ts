// Use-cases for content entities. V1 slice: Notes. Orchestrates platform; no
// framework leakage. AUTHZ IS THE CALLER'S JOB (server actions gate on
// requireMembership + can()); the private-note wall is enforced under this, in
// the Postgres policy (ADR 0004), so a forgotten check here cannot leak a
// PRIVATE note — it can only wrongly allow a GROUP-note edit.
import type { PrismaClient } from "../../platform/db";
import { logActivity } from "../../platform/telemetry";
import { withGroup } from "../../platform/tenancy";
import { newId } from "../../shared_kernel";

import { canEditNote, type NoteVisibility } from "./model";

export { canEditNote };
export type { NoteVisibility } from "./model";

type NoteContent = { title?: string; contentJson?: object; contentText?: string };

export async function addNote(
  db: PrismaClient,
  input: {
    groupId: string;
    authorId: string;
    visibility?: NoteVisibility;
  } & NoteContent,
) {
  const id = newId();
  const visibility = input.visibility ?? "PRIVATE";
  // The viewer MUST be the author for a PRIVATE write: the policy's WITH CHECK
  // refuses a private row whose authorId is not the current viewer. Passing it
  // here means addNote works without the caller knowing that rule.
  return withGroup(
    db,
    input.groupId,
    async (tx) => {
      const note = await tx.note.create({
        data: {
          id,
          groupId: input.groupId,
          authorId: input.authorId,
          visibility,
          title: input.title,
          contentJson: input.contentJson,
          contentText: input.contentText,
        },
      });
      await logActivity(tx, {
        groupId: input.groupId,
        action: "note.create",
        entityType: "NOTE",
        entityId: note.id,
        actorId: input.authorId,
        // visibility is audit-worthy: a note flipping in and out of PRIVATE is
        // exactly the history a laundering attempt would leave.
        metadata: { visibility },
      });
      return note;
    },
    { viewerId: input.authorId },
  );
}

/**
 * Edit a note's CONTENT and/or visibility. authorId is not accepted — it is
 * immutable — never in the update payload — which is what makes the
 * author-laundering attack inexpressible (verified, F5b).
 *
 * The viewer is the ACTOR, not the author: an editor moderating a GROUP note is
 * not its author, and must still pass the policy. A GROUP note's USING clause
 * is satisfied by any member, so a content edit works. Making a note PRIVATE is
 * different — only its author may, since a private row must be attributed to the
 * current viewer. This is checked here so a moderator's flip-to-private returns
 * a clean domain error, but the WITH CHECK on the policy is the real backstop
 * (proven independently in note-privacy.test.ts); this pre-check is for the
 * error surface, not the security.
 */
export async function updateNote(
  db: PrismaClient,
  input: {
    groupId: string;
    noteId: string;
    actorId: string;
    canModerate?: boolean;
    visibility?: NoteVisibility;
  } & NoteContent,
) {
  return withGroup(
    db,
    input.groupId,
    async (tx) => {
      const note = await tx.note.findFirst({
        where: { id: input.noteId },
        select: { id: true, authorId: true, visibility: true },
      });
      // Not found here means EITHER absent OR invisible to this actor (a
      // non-author's PRIVATE note). Both correctly refuse the edit.
      if (!note) throw new Error("note not found in this group");

      if (!canEditNote(note, { userId: input.actorId, canModerate: input.canModerate ?? false })) {
        throw new Error("not allowed to edit this note");
      }

      // Only the author may take a note private. Without this the DB still
      // refuses (WITH CHECK), but as a raw row-level-security error; this turns
      // the moderator-flips-someone-else's-note case into a legible message.
      if (
        input.visibility === "PRIVATE" &&
        note.visibility !== "PRIVATE" &&
        note.authorId !== input.actorId
      ) {
        throw new Error("only the author can make a note private");
      }

      const updated = await tx.note.update({
        where: { id: input.noteId },
        data: {
          // Deliberately field-by-field, NOT a spread of input: authorId,
          // groupId and id must never reach this payload.
          title: input.title,
          contentJson: input.contentJson,
          contentText: input.contentText,
          visibility: input.visibility,
        },
      });
      await logActivity(tx, {
        groupId: input.groupId,
        action: "note.update",
        entityType: "NOTE",
        entityId: input.noteId,
        actorId: input.actorId,
        metadata: input.visibility ? { visibility: input.visibility } : undefined,
      });
      return updated;
    },
    { viewerId: input.actorId },
  );
}

/** Soft delete (SPEC §4 — hard delete only via the audited purge flow). */
export async function deleteNote(
  db: PrismaClient,
  input: { groupId: string; noteId: string; actorId: string; canModerate?: boolean },
) {
  return withGroup(
    db,
    input.groupId,
    async (tx) => {
      const note = await tx.note.findFirst({
        where: { id: input.noteId },
        select: { id: true, authorId: true, visibility: true },
      });
      if (!note) throw new Error("note not found in this group");
      if (!canEditNote(note, { userId: input.actorId, canModerate: input.canModerate ?? false })) {
        throw new Error("not allowed to delete this note");
      }
      await tx.note.update({ where: { id: input.noteId }, data: { deletedAt: new Date() } });
      await logActivity(tx, {
        groupId: input.groupId,
        action: "note.delete",
        entityType: "NOTE",
        entityId: input.noteId,
        actorId: input.actorId,
      });
      return { id: input.noteId };
    },
    { viewerId: input.actorId },
  );
}

/**
 * Notes visible to a viewer: their own private ones plus every GROUP note.
 * The filter is not written here — the policy applies it — so this cannot
 * forget it. The viewer must be threaded through, though: omit it and the
 * caller sees only GROUP notes, never their own private ones.
 */
export async function listNotes(
  db: PrismaClient,
  groupId: string,
  viewerId: string,
) {
  return withGroup(
    db,
    groupId,
    (tx) =>
      tx.note.findMany({
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        select: {
          id: true,
          title: true,
          visibility: true,
          authorId: true,
          updatedAt: true,
        },
      }),
    { viewerId },
  );
}

export async function getNote(db: PrismaClient, groupId: string, noteId: string, viewerId: string) {
  return withGroup(
    db,
    groupId,
    (tx) =>
      tx.note.findFirst({
        where: { id: noteId },
        select: {
          id: true,
          title: true,
          contentJson: true,
          contentText: true,
          visibility: true,
          authorId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    { viewerId },
  );
}
