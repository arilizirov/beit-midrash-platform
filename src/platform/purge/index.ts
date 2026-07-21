/**
 * platform/purge — the audited HARD delete (SPEC §7).
 *
 * Everywhere else "delete" means soft-delete. This is the single sanctioned
 * exception: it destroys rows for real and unrecoverably.
 *
 * **AUTHZ IS THE CALLER'S JOB, and here it matters more than anywhere else.**
 * SPEC §7 says purge is admin-only; `platform` cannot import `can()` (it
 * depends on no domain), so the server action MUST gate this before calling.
 * Nothing in this module can enforce that for you.
 *
 * SCOPE TODAY: topics only, because a Topic is the only purgeable entity that
 * exists. Deliberately NOT generalized — an `entityType` parameter with one
 * legal value and a hardcoded table underneath is a dispatch that does not
 * exist, and it would fail at runtime with a lying error the moment a second
 * type was added. When entity #2 arrives, the split should be: platform owns
 * the MECHANISM (transaction + audit + post-commit blob deletion), the owning
 * domain supplies its own delete plan — otherwise every new child table
 * silently makes purge incomplete with nothing going red.
 *
 * Launch gate §10.8 ("entity + revisions + R2 objects + search rows") is
 * therefore NOT yet met: a Topic can carry none of those three. `TOPIC` is
 * absent from RevisionEntityType and AttachmentTargetType, and no search index
 * exists. Do not mark that gate done on the strength of this module.
 *
 * When blobs do enter the picture, the ordering is already settled: delete
 * them AFTER the transaction commits. Deleting first would leave rows pointing
 * at missing objects on rollback; this way the worst case is a leaked blob,
 * which a sweep can reclaim. Losing the reference is worse than leaking bytes.
 */
import type { PrismaClient } from "../db";
import { logActivity } from "../telemetry";
import { withGroup } from "../tenancy";

export type PurgeReport = {
  rows: { topic: number; links: number; tags: number };
};

export async function purgeTopic(
  db: PrismaClient,
  input: { groupId: string; topicId: string; actorId: string; reason: string },
): Promise<PurgeReport> {
  const { groupId, topicId } = input;

  return withGroup(db, groupId, async (tx) => {
    // `deletedAt: {}` — purge must SEE tombstones. Inheriting the layer-3
    // filter would make it silently skip exactly the rows it exists to
    // destroy, and report success.
    const topic = await tx.topic.findFirst({
      where: { id: topicId, deletedAt: {} },
      select: { id: true, slug: true, title: true },
    });
    // Resolved inside the tenant context, so another group's id does not
    // exist here — a cross-tenant purge is not expressible.
    if (!topic) throw new Error("topic not found in this group");

    // Counted before the delete: TopicTag rows go by ON DELETE CASCADE, which
    // the schema reserves for exactly this flow. Counting them keeps the
    // report honest about what vanished rather than silent about it.
    const tags = await tx.topicTag.count({ where: { topicId } });

    // Typed on both ends: an id-only predicate would delete another entity's
    // edges that happened to share an id, and could not use the indexes.
    const linksFrom = await tx.internalLink.deleteMany({
      where: { fromType: "TOPIC", fromId: topicId },
    });
    const linksTo = await tx.internalLink.deleteMany({
      where: { toType: "TOPIC", toId: topicId },
    });

    const removed = await tx.topic.deleteMany({ where: { id: topicId } });

    // Inside the transaction: an audit entry that could commit without its
    // purge (or vice versa) would be worse than none. It survives the purge —
    // ActivityLog has no UPDATE/DELETE policy, enforced by Postgres.
    // The slug and title are recorded because the id now points at nothing;
    // an audit trail nobody can read in a year is not a trail.
    await logActivity(tx, {
      groupId,
      action: "entity.purge",
      entityType: "TOPIC",
      entityId: topicId,
      actorId: input.actorId,
      metadata: {
        reason: input.reason,
        slug: topic.slug,
        title: topic.title,
        links: linksFrom.count + linksTo.count,
        tags,
      },
    });

    return { rows: { topic: removed.count, links: linksFrom.count + linksTo.count, tags } };
  });
}
