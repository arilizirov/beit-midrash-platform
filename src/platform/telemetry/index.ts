/**
 * platform/telemetry — ActivityLog (writes, audited) + EventLog (reads,
 * metrics). SPEC §4. Append-only is enforced by the DATABASE (no
 * UPDATE/DELETE RLS policy on either table), not by this module's manners.
 */
import type { Prisma } from "../../../generated/prisma/client";

import type { GroupTx } from "../tenancy";
import type { PrismaClient } from "../db";
import { withGroup } from "../tenancy";

/**
 * Record an audited action IN THE SAME TRANSACTION as the mutation it
 * describes — an audit row that can commit without its action (or vice
 * versa) is worse than none. groupId MUST equal the tx's tenant context or
 * the INSERT policy aborts the whole business mutation — that's a feature.
 * NEVER put PII in metadata: this table has NO update/delete path (only a
 * superuser can ever scrub it); reference entityId, not personal fields.
 */
export async function logActivity(
  tx: GroupTx,
  entry: {
    groupId: string;
    action: string;
    entityType: string;
    entityId?: string;
    actorId?: string;
    metadata?: Prisma.InputJsonObject;
  },
): Promise<void> {
  await tx.activityLog.create({
    data: {
      groupId: entry.groupId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      actorId: entry.actorId,
      metadataJson: entry.metadata,
    },
  });
}

/** Fire-and-forget read-side metric; failures must never break the read. */
export async function logEvent(
  db: PrismaClient,
  entry: {
    groupId: string;
    event: string;
    userId?: string;
    entityType?: string;
    entityId?: string;
    metadata?: Prisma.InputJsonObject;
  },
): Promise<void> {
  try {
    await withGroup(db, entry.groupId, (tx) =>
      tx.eventLog.create({
        data: {
          groupId: entry.groupId,
          event: entry.event,
          userId: entry.userId,
          entityType: entry.entityType,
          entityId: entry.entityId,
          metadataJson: entry.metadata,
        },
      }),
    );
  } catch (e) {
    console.error("[telemetry] logEvent failed:", e);
  }
}
