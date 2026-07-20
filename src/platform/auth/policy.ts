/**
 * Pure sign-in / session policy — no I/O, fully unit-tested.
 *
 * Invite-only means: a User row EXISTS before first sign-in (the invite-accept
 * flow validates the token inside withGroup and creates the User; see ADR
 * 0002 + SPEC §6). The auth callback therefore never needs a cross-tenant
 * Invitation scan — which RLS would rightly refuse.
 */
export type GateUser = {
  status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
  deletedAt: Date | null;
} | null;

/**
 * May this email start a magic-link sign-in?
 * F2c's requireUser MUST apply this same rule per-request (session
 * continuation), so suspending or soft-deleting a user revokes access on
 * their next request — Session rows cascade only on HARD delete.
 */
export function canSignIn(user: GateUser): boolean {
  return user !== null && user.status === "ACTIVE" && user.deletedAt === null;
}
