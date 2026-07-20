// Domain entities and pure business rules for identity.
import type { Role } from "../../../generated/prisma/enums";

export type { Role };

/**
 * Capabilities with LIVE callers only — the SPEC §6 matrix is the target map;
 * rows join here when their slice ships (same live-only discipline as
 * boundaries.yaml, ADR 0001). F2c-2 adds invitation.revoke + member.list
 * with the admin page that calls them.
 */
export type Capability = "invitation.create";

// One shared set: SPEC §6 gives OWNER and ADMIN identical grants for every
// capability live so far — a single constant can't drift between them.
const ADMIN_GRANTS: ReadonlySet<Capability> = new Set(["invitation.create"]);
const NONE: ReadonlySet<Capability> = new Set();

const GRANTS: Record<Role, ReadonlySet<Capability>> = {
  OWNER: ADMIN_GRANTS,
  ADMIN: ADMIN_GRANTS,
  EDITOR: NONE,
  MEMBER: NONE,
  GUEST: NONE,
};

export function can(role: Role, capability: Capability): boolean {
  return GRANTS[role].has(capability);
}

/** Auth.js lowercases sign-in identifiers; every stored email must match. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
