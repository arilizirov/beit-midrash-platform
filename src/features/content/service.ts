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
