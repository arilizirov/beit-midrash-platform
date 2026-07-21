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
