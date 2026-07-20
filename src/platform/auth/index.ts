/**
 * platform/auth — public surface.
 * `auth` reads the session server-side; `handlers` mount at /api/auth;
 * `signIn`/`signOut` are the server actions. Policy fns are exported for the
 * request guards (F2c requireUser couples soft-delete → session revocation).
 */
export { auth, handlers, signIn, signOut } from "./config";
export { canSignIn, canUseSession, type GateUser } from "./policy";
