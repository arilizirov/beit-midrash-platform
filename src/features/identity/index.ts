// Public surface of the identity domain. Export ONLY what other
// domains may use. Everything else stays internal to this folder.
export {
  can,
  completeAccept,
  createInvitation,
  ensureInvitedUser,
  listPendingInvitations,
  normalizeEmail,
  previewInvitation,
  revokeInvitation,
  type Capability,
  type Role,
} from "./service";
export { currentGroup, requireMembership, requireUser } from "./guards";
