// Domain entities and pure business rules for identity.
import type { Role } from "../../../generated/prisma/enums";

export type { Role };

/**
 * Capabilities with LIVE callers only — the SPEC §6 matrix is the target map;
 * rows join here when their slice ships (same live-only discipline as
 * boundaries.yaml, ADR 0001).
 */
export type Capability = "invitation.create" | "invitation.revoke" | "member.list";

const GRANTS: Record<Role, ReadonlySet<Capability>> = {
  OWNER: new Set(["invitation.create", "invitation.revoke", "member.list"]),
  ADMIN: new Set(["invitation.create", "invitation.revoke", "member.list"]),
  EDITOR: new Set([]),
  MEMBER: new Set([]),
  GUEST: new Set([]),
};

export function can(role: Role, capability: Capability): boolean {
  return GRANTS[role].has(capability);
}

/** Auth.js lowercases sign-in identifiers; every stored email must match. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
