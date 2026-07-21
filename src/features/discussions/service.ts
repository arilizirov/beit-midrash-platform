// Use-cases for discussions. Orchestrates model + platform. No framework leakage.
import type { PrismaClient } from "../../platform/db";
import { logActivity } from "../../platform/telemetry";
import { withGroup } from "../../platform/tenancy";
import { newId } from "../../shared_kernel";

import { canEditContribution, type DiscussionStatus } from "./model";

export { canEditContribution };
export type { ContributionStatus, DiscussionStatus } from "./model";

/** AUTHZ IS THE CALLER'S JOB (server actions gate on requireMembership + can()). */
export async function createDiscussion(
  db: PrismaClient,
  input: {
    groupId: string;
    topicId: string;
    title: string;
    authorId: string;
    contentJson?: object;
    contentText?: string;
  },
) {
  const id = newId();
  return withGroup(db, input.groupId, async (tx) => {
    const discussion = await tx.discussion.create({
      data: {
        id,
        groupId: input.groupId,
        topicId: input.topicId,
        title: input.title,
        contentJson: input.contentJson,
        contentText: input.contentText,
        authorId: input.authorId,
      },
    });
    await logActivity(tx, {
      groupId: input.groupId,
      action: "discussion.create",
      entityType: "DISCUSSION",
      entityId: discussion.id,
      actorId: input.authorId,
    });
    return discussion;
  });
}

export async function listDiscussions(db: PrismaClient, groupId: string, topicId?: string) {
  return withGroup(db, groupId, (tx) =>
    tx.discussion.findMany({
      where: { topicId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, status: true, topicId: true, updatedAt: true },
    }),
  );
}

export async function setDiscussionStatus(
  db: PrismaClient,
  groupId: string,
  discussionId: string,
  status: DiscussionStatus,
  actorId: string,
) {
  return withGroup(db, groupId, async (tx) => {
    const updated = await tx.discussion.update({
      where: { id: discussionId },
      data: { status },
    });
    await logActivity(tx, {
      groupId,
      action: "discussion.status",
      entityType: "DISCUSSION",
      entityId: discussionId,
      actorId,
      metadata: { status },
    });
    return updated;
  });
}

/**
 * Append one participant's opinion. `authorId` is WHOSE opinion it is;
 * `createdById` is who typed it — routinely different when someone writes
 * down what was said aloud.
 *
 * Position is assigned as MAX+1 inside the transaction. Two concurrent
 * appends can still race to the same position; that is a display-order tie,
 * not a correctness bug, and is cheaper to live with than serializing every
 * append. Revisit if ordering ever becomes load-bearing.
 */
export async function addContribution(
  db: PrismaClient,
  input: {
    groupId: string;
    discussionId: string;
    authorId: string;
    createdById: string;
    contentJson?: object;
    contentText?: string;
  },
) {
  const id = newId();
  return withGroup(db, input.groupId, async (tx) => {
    const last = await tx.contribution.findFirst({
      where: { discussionId: input.discussionId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const contribution = await tx.contribution.create({
      data: {
        id,
        groupId: input.groupId,
        discussionId: input.discussionId,
        authorId: input.authorId,
        createdById: input.createdById,
        contentJson: input.contentJson,
        contentText: input.contentText,
        position: (last?.position ?? -1) + 1,
      },
    });
    await logActivity(tx, {
      groupId: input.groupId,
      action: "contribution.create",
      entityType: "CONTRIBUTION",
      entityId: contribution.id,
      actorId: input.createdById,
      // recorded because the pair is the point: who spoke vs who wrote
      metadata: { authorId: input.authorId, scribed: input.authorId !== input.createdById },
    });
    return contribution;
  });
}

export async function listContributions(db: PrismaClient, groupId: string, discussionId: string) {
  return withGroup(db, groupId, (tx) =>
    tx.contribution.findMany({
      where: { discussionId },
      orderBy: { position: "asc" },
      select: {
        id: true,
        authorId: true,
        createdById: true,
        contentText: true,
        position: true,
        status: true,
      },
    }),
  );
}

/**
 * Record a summary of a discussion. Several may coexist; at most one is
 * canonical (the version-of-record), and that is enforced by a partial unique
 * index, not by this function's good intentions.
 */
export async function addSummary(
  db: PrismaClient,
  input: {
    groupId: string;
    discussionId: string;
    authorId: string;
    contentJson?: object;
    contentText?: string;
    generatedByAI?: boolean;
  },
) {
  // A summary with no content could still be pinned as the version-of-record.
  if (!input.contentText?.trim() && !input.contentJson) {
    throw new Error("summary must have content");
  }
  const id = newId();
  return withGroup(db, input.groupId, async (tx) => {
    // topicId is DERIVED, never supplied: it denormalizes the discussion's own
    // topic so a topic page can list summaries without a join. Taking it from
    // the caller would let a summary be filed under an unrelated topic.
    const discussion = await tx.discussion.findFirst({
      where: { id: input.discussionId },
      select: { topicId: true },
    });
    if (!discussion) throw new Error("discussion not found in this group");

    const summary = await tx.summary.create({
      data: {
        id,
        groupId: input.groupId,
        discussionId: input.discussionId,
        topicId: discussion.topicId,
        contentJson: input.contentJson,
        contentText: input.contentText,
        generatedByAI: input.generatedByAI ?? false,
        authorId: input.authorId,
      },
    });
    await logActivity(tx, {
      groupId: input.groupId,
      action: "summary.create",
      entityType: "SUMMARY",
      entityId: summary.id,
      actorId: input.authorId,
      // worth auditing: an AI-written summary must never be mistaken for a
      // member's own words
      metadata: { generatedByAI: summary.generatedByAI },
    });
    return summary;
  });
}

/**
 * Pin a summary as the version-of-record, unpinning whichever held the slot.
 *
 * **AUTHZ: pinning is a MODERATE capability (SPEC §6) — owner/admin only.**
 * It is strictly narrower than "write a summary", which any editor may do.
 * Do not reuse the create-summary check here; deciding which text the group
 * will cite later is a different decision from adding one more draft.
 *
 * The unpin and the pin share ONE transaction. Nothing here can survive
 * halfway: a failure after the unpin would otherwise commit a discussion with
 * NO version of record, which is worse than the state we started in. The
 * guard also runs BEFORE the unpin, so an unresolvable target changes nothing.
 */
export async function setCanonicalSummary(
  db: PrismaClient,
  groupId: string,
  summaryId: string,
  actorId: string,
) {
  try {
    return await pinCanonical(db, groupId, summaryId, actorId);
  } catch (error) {
    // The partial unique index turns a concurrent double-pin into a raw
    // P2002. That is the index doing its job, but the loser of the race
    // deserves a sentence rather than a driver error code.
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002") {
      throw new Error("another summary was pinned at the same moment — reload and try again");
    }
    throw error;
  }
}

async function pinCanonical(
  db: PrismaClient,
  groupId: string,
  summaryId: string,
  actorId: string,
) {
  return withGroup(db, groupId, async (tx) => {
    const target = await tx.summary.findFirst({
      where: { id: summaryId },
      select: { id: true, discussionId: true },
    });
    if (!target) throw new Error("summary not found in this group");

    // Read before the unpin: the audit's most interesting half is WHICH text
    // stopped being the version of record.
    const displaced = await tx.summary.findFirst({
      where: { groupId, discussionId: target.discussionId, isCanonical: true },
      select: { id: true },
    });
    // groupId is redundant under FORCEd RLS and included anyway — referential
    // integrity must not depend on RLS alone (see Revision).
    await tx.summary.updateMany({
      where: { groupId, discussionId: target.discussionId, isCanonical: true },
      data: { isCanonical: false },
    });
    const pinned = await tx.summary.update({
      where: { id: summaryId },
      data: { isCanonical: true },
    });
    await logActivity(tx, {
      groupId,
      action: "summary.pin",
      entityType: "SUMMARY",
      entityId: summaryId,
      actorId,
      metadata: { discussionId: target.discussionId, displacedId: displaced?.id ?? null },
    });
    return pinned;
  });
}

export async function listSummaries(db: PrismaClient, groupId: string, discussionId: string) {
  return withGroup(db, groupId, (tx) =>
    tx.summary.findMany({
      where: { discussionId },
      // createdAt is transaction-START time, so rows written together tie;
      // id breaks it so the order is total and the list never reshuffles.
      orderBy: [{ isCanonical: "desc" }, { createdAt: "desc" }, { id: "asc" }],
      select: {
        id: true,
        contentText: true,
        isCanonical: true,
        generatedByAI: true,
        authorId: true,
        createdAt: true,
      },
    }),
  );
}

/** A flat text reply on a contribution (SPEC §4 — V1 keeps comments plain). */
export async function addComment(
  db: PrismaClient,
  input: {
    groupId: string;
    contributionId: string;
    authorId: string;
    body: string;
    parentCommentId?: string;
  },
) {
  const body = input.body.trim();
  if (!body) throw new Error("comment body cannot be empty");
  const id = newId();
  return withGroup(db, input.groupId, async (tx) => {
    const comment = await tx.comment.create({
      data: {
        id,
        groupId: input.groupId,
        contributionId: input.contributionId,
        authorId: input.authorId,
        body,
        parentCommentId: input.parentCommentId,
      },
    });
    await logActivity(tx, {
      groupId: input.groupId,
      action: "comment.create",
      entityType: "COMMENT",
      entityId: comment.id,
      actorId: input.authorId,
    });
    return comment;
  });
}

export async function listComments(db: PrismaClient, groupId: string, contributionId: string) {
  return withGroup(db, groupId, (tx) =>
    tx.comment.findMany({
      where: { contributionId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, body: true, authorId: true, parentCommentId: true, createdAt: true },
    }),
  );
}
