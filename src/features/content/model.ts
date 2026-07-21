// Pure rules for content entities. No IO, no framework, no Prisma.

export type NoteVisibility = "PRIVATE" | "GROUP";

/**
 * Who may edit a note, at the DOMAIN level (SPEC §6: create/edit is "Own" for a
 * member; an editor/admin/owner may moderate any GROUP note).
 *
 * This is NOT the private-note wall. That one lives in the Postgres policy,
 * because it must hold even against a forgotten check here (ADR 0004): a
 * PRIVATE note is unreadable and unwritable to a non-author no matter what this
 * function returns. This function decides the softer question — may this member
 * edit a note they CAN see — and exists so a server action has one place to ask.
 */
export function canEditNote(
  note: { authorId: string; visibility: NoteVisibility },
  actor: { userId: string; canModerate: boolean },
): boolean {
  if (note.authorId === actor.userId) return true;
  // A PRIVATE note is never reachable by a non-author — the DB already refused
  // to hand it over — so moderation applies to GROUP notes only.
  return note.visibility === "GROUP" && actor.canModerate;
}

/**
 * authorId is immutable after creation. This is the whole of the
 * author-laundering fix (verified, F5b): the only way to turn another member's
 * GROUP note PRIVATE is to first become its author, and the WITH CHECK on the
 * Note policy already refuses a PRIVATE write by a non-author. Deny the
 * reassignment and the attack is not expressible; allow it and the policy is
 * powerless, because after the reassignment the thief IS the author.
 */
export const IMMUTABLE_NOTE_FIELDS = ["authorId", "groupId", "id"] as const;
