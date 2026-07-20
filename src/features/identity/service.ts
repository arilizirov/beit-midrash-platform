// Use-cases for identity. Orchestrates model + platform. No framework leakage.
import { createHash, randomBytes } from "node:crypto";

import type { PrismaClient } from "../../platform/db";
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
 */
export async function createInvitation(
  db: PrismaClient,
  input: { groupId: string; email: string; role: Role; invitedById: string },
) {
  const email = normalizeEmail(input.email);
  const rawToken = randomBytes(32).toString("base64url");
  const invitation = await withGroup(db, input.groupId, async (tx) => {
    await tx.invitation.updateMany({
      where: { email, acceptedAt: null, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return tx.invitation.create({
      data: {
        groupId: input.groupId,
        email,
        role: input.role,
        tokenHash: hashToken(rawToken),
        invitedById: input.invitedById,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
    });
  });
  return { rawToken, invitation };
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
 * soft-deleted user.
 */
export async function ensureInvitedUser(db: PrismaClient, groupId: string, rawToken: string) {
  const invite = await previewInvitation(db, groupId, rawToken);
  if (!invite) return null;
  return db.user.upsert({
    where: { email: invite.email },
    update: { status: "ACTIVE", deletedAt: null },
    create: { email: invite.email, status: "ACTIVE" },
  });
}

/**
 * Authenticated completion: the session's email must be the invited email;
 * membership is created with the invited role; the invitation becomes
 * accepted (single-use) — all in one transaction under RLS.
 */
export async function completeAccept(
  db: PrismaClient,
  input: { groupId: string; rawToken: string; userId: string; userEmail: string },
): Promise<{ ok: boolean; reason?: string }> {
  return withGroup(db, input.groupId, async (tx) => {
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
    if (!existing) {
      await tx.membership.create({
        data: {
          userId: input.userId,
          groupId: input.groupId,
          role: invite.role,
          status: "ACTIVE",
          joinedAt: new Date(),
        },
      });
    }
    await tx.invitation.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
    return { ok: true };
  });
}
