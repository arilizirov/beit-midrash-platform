/**
 * Sign-in policy — the rule itself lives in shared_kernel/user-gate (pure,
 * boundary-clean for every consumer); this module keeps auth's public API
 * stable. Invite-only means: a User row EXISTS before first sign-in (the
 * invite-accept flow creates it; see ADR 0002 + SPEC §6).
 */
export { canSignIn, type GateUser } from "../../shared_kernel";
