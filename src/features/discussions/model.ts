// Domain entities and pure business rules for discussions.
import type { ContributionStatus, DiscussionStatus } from "../../../generated/prisma/enums";

export type { ContributionStatus, DiscussionStatus };

/**
 * SPEC §4: "edit own" checks createdById — the SCRIBE, not the person quoted.
 *
 * This is the whole point of splitting the two fields. If it checked authorId,
 * the Rav could edit words he never typed, and the person who actually wrote
 * them down could not correct their own transcription. Moderators (owner /
 * admin / editor) are handled by can() at the caller; this answers only the
 * "own" half.
 */
export function canEditContribution(
  contribution: { authorId: string; createdById: string },
  userId: string,
): boolean {
  return contribution.createdById === userId;
}
