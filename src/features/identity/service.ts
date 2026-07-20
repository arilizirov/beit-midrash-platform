// Use-cases for identity. Orchestrates model + platform. No framework leakage.
import { createHash, randomBytes } from "node:crypto";

import type { PrismaClient } from "../../platform/db";
import { logActivity } from "../../platform/telemetry";
import { withGroup } from "../../platform/tenancy";

import { can, normalizeEmail, type Capability, type Role } from "./model";

export { can, normalizeEmail, type Capability, type Role };

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Create an invitation, SUPERSEDING any pending one for the same email
 * (ADR 0002: expiry is time-derived, so a lapsed invite holds the pending
 * slot until explicitly replaced — this is that replacement, in one tx).
 * Returns the raw token exactly once; only its hash is stored.
 *
 * AUTHZ IS THE CALLER'S JOB: the F2c-2 server action must gate this behind
 * requireMembership + can(role, "invitation.create") — this service trusts
 * its inputs by design (no framework leakage).
 */
export async function createInvitation(
  db: PrismaClient,
  input: { groupId: string; email: string; role: Role; invitedById: string },
) {
  // Ownership is transferred, never granted by invite link (SPEC §6).
  if (input.role === "OWNER") throw new Error("invitations cannot grant OWNER");
  const email = normalizeEmail(input.email);
  const rawToken = randomBytes(32).toString("base64url");
  const invitation = await withGroup(db, input.groupId, async (tx) => {
    // groupId is explicit although RLS already scopes the tx — defense in
    // depth (SPEC §6): one misconfigured layer must not cross tenants.
    await tx.invitation.updateMany({
      where: { groupId: input.groupId, email, acceptedAt: null, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    const created = await tx.invitation.create({
      data: {
        groupId: input.groupId,
        email,
        role: input.role,
        tokenHash: hashToken(rawToken),
        invitedById: input.invitedById,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
    });
    // No email in metadata: ActivityLog is unerasable by design (debt-hawk,
    // F3a) — the address stays reachable via entityId → Invitation, which
    // the purge flow CAN scrub.
    await logActivity(tx, {
      groupId: input.groupId,
      action: "invitation.create",
      entityType: "INVITATION",
      entityId: created.id,
      actorId: input.invitedById,
      metadata: { role: input.role },
    });
    return created;
  });
  return { rawToken, invitation };
}

/** Pending invitations for the admin screen (newest first). */
export async function listPendingInvitations(db: PrismaClient, groupId: string) {
  return withGroup(db, groupId, (tx) =>
    tx.invitation.findMany({
      where: { acceptedAt: null, deletedAt: null },
      select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  );
}

/** Revoke = soft-delete; the token dies immediately (preview returns null). */
export async function revokeInvitation(
  db: PrismaClient,
  groupId: string,
  invitationId: string,
  actorId?: string,
) {
  return withGroup(db, groupId, async (tx) => {
    const res = await tx.invitation.updateMany({
      where: { id: invitationId, acceptedAt: null, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (res.count > 0) {
      await logActivity(tx, {
        groupId,
        action: "invitation.revoke",
        entityType: "INVITATION",
        entityId: invitationId,
        actorId,
      });
    }
    return res;
  });
}

/** A pending, unexpired invitation matching this token — or null. */
export async function previewInvitation(db: PrismaClient, groupId: string, rawToken: string) {
  return withGroup(db, groupId, (tx) =>
    tx.invitation.findFirst({
      where: {
        tokenHash: hashToken(rawToken),
        acceptedAt: null,
        deletedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, email: true, role: true, expiresAt: true },
    }),
  );
}

/**
 * Anonymous pre-step: a valid invitation creates (or reactivates) the User
 * row so the magic-link sign-in can succeed (invite-only = User must exist
 * before first sign-in). Inviting IS explicit re-admission for a previously
 * soft-DELETED user — but it must NOT override a global moderation state:
 * a SUSPENDED/DEACTIVATED user stays locked until an admin lifts it
 * explicitly (this runs pre-auth; an invite link is not a moderation tool).
 */
export async function ensureInvitedUser(db: PrismaClient, groupId: string, rawToken: string) {
  const invite = await previewInvitation(db, groupId, rawToken);
  if (!invite) return null;
  // findUnique: the documented UNFILTERED path (email is @unique) — we
  // must SEE a soft-deleted user in order to reactivate them.
  const existing = await db.user.findUnique({ where: { email: invite.email } });
  if (!existing) {
    return db.user.create({ data: { email: invite.email, status: "ACTIVE" } });
  }
  if (existing.status !== "ACTIVE") return null; // refuse: suspension outranks invitation
  if (existing.deletedAt !== null) {
    return db.user.update({ where: { id: existing.id }, data: { deletedAt: null } });
  }
  return existing;
}

/**
 * Authenticated completion: the session's email must be the invited email;
 * membership is created with the invited role; the invitation becomes
 * accepted (single-use) — all in one transaction under RLS.
 *
 * An EXISTING active membership does NOT consume the token: role changes and
 * suspension lifts are admin actions ("manage members"), never a side effect
 * of an invite link — the caller sees `already_member` and the admin can
 * revoke the dangling invite.
 */
export async function completeAccept(
  db: PrismaClient,
  input: { groupId: string; rawToken: string; userId: string; userEmail: string },
): Promise<{ ok: boolean; reason?: string }> {
  try {
    return await withGroup(db, input.groupId, async (tx) => {
      const invite = await tx.invitation.findFirst({
        where: {
          tokenHash: hashToken(input.rawToken),
          acceptedAt: null,
          deletedAt: null,
          expiresAt: { gt: new Date() },
        },
      });
      if (!invite) return { ok: false, reason: "invalid_or_used" };
      if (invite.email !== normalizeEmail(input.userEmail)) {
        return { ok: false, reason: "email_mismatch" };
      }
      const existing = await tx.membership.findFirst({
        where: { userId: input.userId, groupId: input.groupId, deletedAt: null },
      });
      if (existing) return { ok: false, reason: "already_member" };
      const membership = await tx.membership.create({
        data: {
          userId: input.userId,
          groupId: input.groupId,
          role: invite.role,
          status: "ACTIVE",
          joinedAt: new Date(),
        },
      });
      await tx.invitation.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
      await logActivity(tx, {
        groupId: input.groupId,
        action: "membership.create",
        entityType: "MEMBERSHIP",
        entityId: membership.id,
        actorId: input.userId,
        metadata: { via: "invitation", role: invite.role },
      });
      return { ok: true };
    });
  } catch (e) {
    // Double-submit race: both requests pass the existing-check, the loser
    // hits the active-row partial unique and Postgres aborts its tx — so the
    // race is mapped HERE, outside the transaction. The user IS a member
    // (the winner committed membership + acceptedAt); that's a success.
    if ((e as { code?: string }).code === "P2002") return { ok: true };
    throw e;
  }
}
