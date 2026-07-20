// Public surface of the identity domain. Export ONLY what other
// domains may use. Everything else stays internal to this folder.
export {
  can,
  completeAccept,
  createInvitation,
  ensureInvitedUser,
  normalizeEmail,
  previewInvitation,
  type Capability,
  type Role,
} from "./service";
