/**
 * Pure user-gate rule (shared kernel: imports nothing, importable by all).
 * One rule, two enforcement points: sign-in (platform/auth callback) and
 * session continuation (identity guards) — suspending or soft-deleting a
 * user must bite at BOTH doors with identical semantics.
 */
export type GateUser = {
  status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
  deletedAt: Date | null;
} | null;

export function canSignIn(user: GateUser): boolean {
  return user !== null && user.status === "ACTIVE" && user.deletedAt === null;
}
